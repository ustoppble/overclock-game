/**
 * Overclock Mon — servidor multiplayer + estático.
 * - Serve o build Vite (dist/) em / e /game/ (com ou sem strip de prefixo no proxy).
 * - WebSocket de salas em qualquer path terminado em /ws.
 *
 * O servidor é um RELAY fino: cria sala, pareia 2 jogadores, distribui seed e
 * repassa picks. A simulação do duelo é determinística (seed) e roda nos clientes.
 *
 * Protocolo (JSON):
 *   c→s  {t:'create', name, squad}                → s→c {t:'room', code}
 *   c→s  {t:'join', code, name, squad}            → ambos {t:'start', seed, you, a:{name,squad}, b:{name,squad}}
 *   c→s  {t:'pick', round, idx}                   → quando ambos: {t:'reveal', round, a:idx, b:idx}
 *   c→s  {t:'rematch'}                            → quando ambos: novo {t:'start'} (mesma sala, nova seed)
 *   s→c  {t:'left'} (oponente saiu) · {t:'err', msg}
 */
import { createServer } from 'node:http'
import { readFileSync, statSync } from 'node:fs'
import { join, extname, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { randomBytes } from 'node:crypto'

const PORT = Number(process.env.PORT || 80)
const DIST = resolve(process.env.DIST_DIR || join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist'))

// ── estático ─────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.map': 'application/json',
}
const INDEX = () => readFileSync(join(DIST, 'index.html'))

const server = createServer((req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0])
    if (path.startsWith('/game/') || path === '/game') path = path.slice(5) || '/'
    if (path === '/' || path === '') return res.writeHead(200, { 'content-type': MIME['.html'] }).end(INDEX())
    const file = normalize(join(DIST, path))
    if (!file.startsWith(DIST)) return res.writeHead(403).end()
    try {
      if (statSync(file).isFile()) {
        const ct = MIME[extname(file)] || 'application/octet-stream'
        return res.writeHead(200, { 'content-type': ct, 'cache-control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' }).end(readFileSync(file))
      }
    } catch { /* cai no fallback SPA */ }
    res.writeHead(200, { 'content-type': MIME['.html'] }).end(INDEX())
  } catch {
    res.writeHead(500).end()
  }
})

// ── salas ────────────────────────────────────────────────────────────────────
const ROOM_TTL_MS = 30 * 60 * 1000
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sem I/L/O/0/1
const rooms = new Map() // code → { a, b, createdAt, rematch: Set }

const newCode = () => {
  for (let tries = 0; tries < 50; tries++) {
    const c = [...randomBytes(4)].map((b) => ALPHABET[b % ALPHABET.length]).join('')
    if (!rooms.has(c)) return c
  }
  return null
}
const newSeed = () => randomBytes(4).readUInt32BE(0)
const send = (ws, obj) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)) }
const validSquad = (sq) => Array.isArray(sq) && sq.length >= 1 && sq.length <= 4 &&
  sq.every((h) => h && typeof h.agentId === 'string' && typeof h.modelId === 'string' && typeof h.effort === 'string')

function startMatch(room) {
  const seed = newSeed()
  room.picks = [{}, {}, {}, {}, {}, {}, {}]
  room.rematch = new Set()
  const payload = { seed, a: { name: room.a.name, squad: room.a.squad }, b: { name: room.b.name, squad: room.b.squad } }
  send(room.a.ws, { t: 'start', you: 'a', ...payload })
  send(room.b.ws, { t: 'start', you: 'b', ...payload })
}

const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  const path = (req.url || '').split('?')[0]
  if (!path.endsWith('/ws')) return socket.destroy()
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws))
})

wss.on('connection', (ws) => {
  ws.isAlive = true
  ws.on('pong', () => { ws.isAlive = true })

  ws.on('message', (raw) => {
    let m
    try { m = JSON.parse(raw.toString()) } catch { return }
    const room = ws.roomCode ? rooms.get(ws.roomCode) : null

    if (m.t === 'create') {
      if (!validSquad(m.squad)) return send(ws, { t: 'err', msg: 'squad inválido' })
      const code = newCode()
      if (!code) return send(ws, { t: 'err', msg: 'servidor lotado, tenta de novo' })
      rooms.set(code, { a: { ws, name: String(m.name || 'Orquestrador').slice(0, 24), squad: m.squad }, b: null, createdAt: Date.now() })
      ws.roomCode = code
      ws.side = 'a'
      send(ws, { t: 'room', code })
      return
    }

    if (m.t === 'join') {
      const code = String(m.code || '').toUpperCase().trim()
      const r = rooms.get(code)
      if (!r) return send(ws, { t: 'err', msg: 'sala não existe (ou expirou)' })
      if (r.b) return send(ws, { t: 'err', msg: 'sala cheia' })
      if (!validSquad(m.squad)) return send(ws, { t: 'err', msg: 'squad inválido' })
      r.b = { ws, name: String(m.name || 'Desafiante').slice(0, 24), squad: m.squad }
      ws.roomCode = code
      ws.side = 'b'
      startMatch(r)
      return
    }

    if (m.t === 'pick' && room && room.b) {
      const round = Number(m.round)
      const idx = Number(m.idx)
      if (!Number.isInteger(round) || round < 0 || round > 6) return
      const mySquad = ws.side === 'a' ? room.a.squad : room.b.squad
      if (!Number.isInteger(idx) || idx < 0 || idx >= mySquad.length) return
      const p = room.picks[round]
      if (p[ws.side] !== undefined) return // já escolheu
      p[ws.side] = idx
      if (p.a !== undefined && p.b !== undefined) {
        send(room.a.ws, { t: 'reveal', round, a: p.a, b: p.b })
        send(room.b.ws, { t: 'reveal', round, a: p.a, b: p.b })
      }
      return
    }

    if (m.t === 'rematch' && room && room.b) {
      room.rematch.add(ws.side)
      if (room.rematch.size === 2) startMatch(room)
      else send(ws.side === 'a' ? room.b.ws : room.a.ws, { t: 'rematch-ask' })
      return
    }
  })

  ws.on('close', () => {
    const room = ws.roomCode ? rooms.get(ws.roomCode) : null
    if (!room) return
    const other = ws.side === 'a' ? room.b : room.a
    send(other?.ws, { t: 'left' })
    rooms.delete(ws.roomCode)
  })
})

// heartbeat + GC de salas velhas
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue }
    ws.isAlive = false
    ws.ping()
  }
  const now = Date.now()
  for (const [code, r] of rooms) if (now - r.createdAt > ROOM_TTL_MS) {
    send(r.a?.ws, { t: 'err', msg: 'sala expirou' })
    send(r.b?.ws, { t: 'err', msg: 'sala expirou' })
    rooms.delete(code)
  }
}, 30_000)

server.listen(PORT, () => console.log(`overclock-mon server on :${PORT} · dist=${DIST}`))
