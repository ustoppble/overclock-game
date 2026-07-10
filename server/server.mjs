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
    if (path === '/stats') {
      return res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-cache' }).end(JSON.stringify({
        online: world.size,
        players: [...world.values()].map((p) => ({ name: p.name, form: p.form, x: p.x, y: p.y, hasSquad: p.hasSquad })),
        duelRooms: [...rooms.values()].filter((r) => r.duo).length,
        rooms: rooms.size,
      }))
    }
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

// ── mundo aberto: presença + desafio 1x1 ────────────────────────────────────
const WORLD_MAX_X = 45
const WORLD_MAX_Y = 31
const CHALLENGE_TTL_MS = 15_000
const DIRS = new Set(['up', 'down', 'left', 'right'])
let nextWorldId = 1
const world = new Map() // id → { ws, name, x, y, dir, skin, form, hasSquad }
const challenges = new Map() // targetId → { fromId, timer }

const clampInt = (v, min, max, fallback) => {
  const n = Number(v)
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const wpublic = (id, p) => ({ id, name: p.name, x: p.x, y: p.y, dir: p.dir, skin: p.skin, form: p.form, hasSquad: p.hasSquad })
const wbroadcast = (obj, exceptId) => {
  for (const [id, p] of world) if (id !== exceptId) send(p.ws, obj)
}
const dropChallengesOf = (id) => {
  for (const [target, ch] of challenges) {
    if (target !== id && ch.fromId !== id) continue
    clearTimeout(ch.timer)
    challenges.delete(target)
    const other = target === id ? ch.fromId : target
    send(world.get(other)?.ws, { t: 'wdeclined', id })
  }
}
const inChallenge = (id) => {
  if (challenges.has(id)) return true
  for (const ch of challenges.values()) if (ch.fromId === id) return true
  return false
}

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
      // sala duo (desafio de mundo): primeiro join vira o lado 'a'
      if (r.duo && !r.a) {
        r.a = { ws, name: String(m.name || 'Duelista').slice(0, 24), squad: m.squad }
        ws.roomCode = code
        ws.side = 'a'
        return
      }
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

    // ── mundo aberto ─────────────────────────────────────────────────────────
    if (m.t === 'wjoin') {
      const id = ws.worldId ?? `w${nextWorldId++}`
      ws.worldId = id
      const p = {
        ws,
        name: String(m.name || 'Orquestrador').slice(0, 24),
        x: clampInt(m.x, 0, WORLD_MAX_X, 20),
        y: clampInt(m.y, 0, WORLD_MAX_Y, 18),
        dir: 'down',
        skin: typeof m.skin === 'string' ? m.skin.slice(0, 9) : null,
        form: String(m.form || 'base').slice(0, 12),
        hasSquad: !!m.hasSquad,
      }
      world.set(id, p)
      send(ws, { t: 'wstate', you: id, players: [...world].filter(([pid]) => pid !== id).map(([pid, pp]) => wpublic(pid, pp)) })
      wbroadcast({ t: 'wenter', player: wpublic(id, p) }, id)
      return
    }

    if (m.t === 'wmove' && ws.worldId && world.has(ws.worldId)) {
      const now = Date.now()
      if (ws.lastMoveAt && now - ws.lastMoveAt < 100) return
      ws.lastMoveAt = now
      const p = world.get(ws.worldId)
      p.x = clampInt(m.x, 0, WORLD_MAX_X, p.x)
      p.y = clampInt(m.y, 0, WORLD_MAX_Y, p.y)
      if (DIRS.has(m.dir)) p.dir = m.dir
      if (typeof m.form === 'string') p.form = m.form.slice(0, 12)
      wbroadcast({ t: 'wmove', id: ws.worldId, x: p.x, y: p.y, dir: p.dir, form: p.form }, ws.worldId)
      return
    }

    if (m.t === 'wchallenge' && ws.worldId) {
      const me = world.get(ws.worldId)
      const to = String(m.to || '')
      const target = world.get(to)
      if (!me || !target || to === ws.worldId) return send(ws, { t: 'err', msg: 'alvo indisponível' })
      if (!me.hasSquad || !target.hasSquad) return send(ws, { t: 'err', msg: 'os dois precisam de squad montado' })
      if (inChallenge(ws.worldId) || inChallenge(to)) return send(ws, { t: 'err', msg: 'desafio em andamento' })
      const timer = setTimeout(() => {
        challenges.delete(to)
        send(me.ws, { t: 'wdeclined', id: to })
      }, CHALLENGE_TTL_MS)
      challenges.set(to, { fromId: ws.worldId, timer })
      send(target.ws, { t: 'wchallenged', from: { id: ws.worldId, name: me.name } })
      send(ws, { t: 'wchallenge-sent', to })
      return
    }

    if (m.t === 'waccept' && ws.worldId) {
      const ch = challenges.get(ws.worldId)
      if (!ch || ch.fromId !== String(m.to || '')) return
      clearTimeout(ch.timer)
      challenges.delete(ws.worldId)
      const challenger = world.get(ch.fromId)
      if (!challenger) return send(ws, { t: 'err', msg: 'desafiante saiu' })
      const code = newCode()
      if (!code) return send(ws, { t: 'err', msg: 'servidor lotado, tenta de novo' })
      rooms.set(code, { duo: true, a: null, b: null, createdAt: Date.now() })
      send(challenger.ws, { t: 'wmatch', code })
      send(ws, { t: 'wmatch', code })
      return
    }

    if (m.t === 'wdecline' && ws.worldId) {
      const ch = challenges.get(ws.worldId)
      if (!ch) return
      clearTimeout(ch.timer)
      challenges.delete(ws.worldId)
      send(world.get(ch.fromId)?.ws, { t: 'wdeclined', id: ws.worldId })
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
    if (ws.worldId && world.has(ws.worldId)) {
      world.delete(ws.worldId)
      dropChallengesOf(ws.worldId)
      wbroadcast({ t: 'wleave', id: ws.worldId })
    }
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
