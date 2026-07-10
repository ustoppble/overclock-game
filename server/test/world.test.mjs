/** Testes do canal de presença de mundo + desafio 1x1. Roda: node --test server/test/ */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import WebSocket from 'ws'

const PORT = 8791
const WS_URL = `ws://127.0.0.1:${PORT}/ws`
const serverPath = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'server.mjs')
let proc

before(async () => {
  proc = spawn('node', [serverPath], { env: { ...process.env, PORT: String(PORT), DIST_DIR: '/tmp' }, stdio: ['ignore', 'pipe', 'inherit'] })
  await new Promise((res, rej) => {
    proc.stdout.on('data', (d) => { if (d.toString().includes('server on')) res() })
    proc.on('exit', () => rej(new Error('server morreu no boot')))
    setTimeout(() => rej(new Error('timeout boot')), 5000)
  })
})
after(() => proc?.kill())

/** cliente de teste: fila de mensagens + espera por tipo */
function client() {
  const ws = new WebSocket(WS_URL)
  const queue = []
  const waiters = []
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString())
    const i = waiters.findIndex((w) => w.t === m.t)
    if (i >= 0) waiters.splice(i, 1)[0].res(m)
    else queue.push(m)
  })
  return {
    ws,
    open: () => new Promise((res) => ws.once('open', res)),
    send: (obj) => ws.send(JSON.stringify(obj)),
    next: (t, ms = 2000) => {
      const i = queue.findIndex((m) => m.t === t)
      if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0])
      return new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error(`timeout esperando ${t}`)), ms)
        waiters.push({ t, res: (m) => { clearTimeout(timer); res(m) } })
      })
    },
    quiet: (t, ms = 300) => new Promise((res, rej) => {
      const timer = setTimeout(() => res(true), ms)
      waiters.push({ t, res: () => { clearTimeout(timer); rej(new Error(`recebeu ${t} indevido`)) } })
    }),
    close: () => ws.close(),
  }
}

const SQUAD = [{ agentId: 'forge', modelId: 'haiku', effort: 'medium', skillIds: [] }]

test('presença: wjoin/wstate/wenter/wmove/wleave', async () => {
  const a = client(); const b = client()
  await a.open(); await b.open()

  a.send({ t: 'wjoin', name: 'Alice', x: 20, y: 18, skin: '#ff0000', form: 'base', hasSquad: true })
  const stA = await a.next('wstate')
  assert.ok(stA.you)
  assert.equal(stA.players.length, 0)

  b.send({ t: 'wjoin', name: 'Bob', x: 21, y: 18, skin: null, form: 'boost', hasSquad: false })
  const stB = await b.next('wstate')
  assert.equal(stB.players.length, 1)
  assert.equal(stB.players[0].name, 'Alice')
  assert.equal(stB.players[0].form, 'base')

  const enter = await a.next('wenter')
  assert.equal(enter.player.name, 'Bob')
  assert.equal(enter.player.hasSquad, false)

  a.send({ t: 'wmove', x: 19, y: 18, dir: 'left', form: 'base' })
  const mv = await b.next('wmove')
  assert.equal(mv.id, stA.you)
  assert.equal(mv.x, 19)
  assert.equal(mv.dir, 'left')

  // throttle: dentro da mesma janela de 100ms só a primeira passa
  await new Promise((r) => setTimeout(r, 120))
  a.send({ t: 'wmove', x: 18, y: 18, dir: 'left', form: 'base' })
  a.send({ t: 'wmove', x: 17, y: 18, dir: 'left', form: 'base' })
  const burst = await b.next('wmove')
  assert.equal(burst.x, 18)
  await b.quiet('wmove')

  a.close()
  const lv = await b.next('wleave')
  assert.equal(lv.id, stA.you)
  b.close()
})

test('wmove clampa bounds e valida dir', async () => {
  const a = client(); const b = client()
  await a.open(); await b.open()
  a.send({ t: 'wjoin', name: 'A2', x: 999, y: -5, skin: null, form: 'base', hasSquad: true })
  await a.next('wstate')
  b.send({ t: 'wjoin', name: 'B2', x: 10, y: 10, skin: null, form: 'base', hasSquad: true })
  await b.next('wstate')
  await a.next('wenter')
  await new Promise((r) => setTimeout(r, 120)) // fora do throttle
  a.send({ t: 'wmove', x: 999, y: -5, dir: 'sideways', form: 'base' })
  const mv = await b.next('wmove')
  assert.equal(mv.x, 45)
  assert.equal(mv.y, 0)
  assert.equal(mv.dir, 'down') // dir inválida mantém a anterior (down inicial)
  a.close(); b.close()
})

test('desafio: wchallenge → waccept → wmatch → sala duo → start', async () => {
  const a = client(); const b = client()
  await a.open(); await b.open()
  a.send({ t: 'wjoin', name: 'Duelista', x: 5, y: 5, skin: null, form: 'base', hasSquad: true })
  const stA = await a.next('wstate')
  b.send({ t: 'wjoin', name: 'Rival', x: 6, y: 5, skin: null, form: 'base', hasSquad: true })
  const stB = await b.next('wstate')
  const bId = stB.you

  a.send({ t: 'wchallenge', to: bId })
  const ch = await b.next('wchallenged')
  assert.equal(ch.from.id, stA.you)
  assert.equal(ch.from.name, 'Duelista')
  await a.next('wchallenge-sent')

  b.send({ t: 'waccept', to: stA.you })
  const mA = await a.next('wmatch')
  const mB = await b.next('wmatch')
  assert.equal(mA.code, mB.code)

  // sala duo: dois joins diretos (sem create) → start pros dois
  const p1 = client(); const p2 = client()
  await p1.open(); await p2.open()
  p1.send({ t: 'join', code: mA.code, name: 'Duelista', squad: SQUAD })
  p2.send({ t: 'join', code: mA.code, name: 'Rival', squad: SQUAD })
  const s1 = await p1.next('start')
  const s2 = await p2.next('start')
  assert.equal(s1.seed, s2.seed)
  assert.deepEqual([s1.you, s2.you].sort(), ['a', 'b'])
  a.close(); b.close(); p1.close(); p2.close()
})

test('desafio: wdecline avisa o desafiante', async () => {
  const a = client(); const b = client()
  await a.open(); await b.open()
  a.send({ t: 'wjoin', name: 'C1', x: 1, y: 1, skin: null, form: 'base', hasSquad: true })
  const stA = await a.next('wstate')
  b.send({ t: 'wjoin', name: 'C2', x: 2, y: 1, skin: null, form: 'base', hasSquad: true })
  const stB = await b.next('wstate')
  a.send({ t: 'wchallenge', to: stB.you })
  await b.next('wchallenged')
  b.send({ t: 'wdecline', to: stA.you })
  const d = await a.next('wdeclined')
  assert.equal(d.id, stB.you)
  a.close(); b.close()
})

test('desafio: sem squad → err', async () => {
  const a = client(); const b = client()
  await a.open(); await b.open()
  a.send({ t: 'wjoin', name: 'S1', x: 1, y: 2, skin: null, form: 'base', hasSquad: true })
  await a.next('wstate')
  b.send({ t: 'wjoin', name: 'S2', x: 2, y: 2, skin: null, form: 'base', hasSquad: false })
  const stB = await b.next('wstate')
  a.send({ t: 'wchallenge', to: stB.you })
  const e = await a.next('err')
  assert.match(e.msg, /squad/)
  a.close(); b.close()
})
