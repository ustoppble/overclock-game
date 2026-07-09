/**
 * PvP AO VIVO — duelo squad vs squad em tempo real via WebSocket.
 * O servidor é só relay (sala + seed + picks); a simulação é determinística
 * pela seed, então os dois clientes computam o MESMO resultado localmente.
 *
 * Regras do duelo:
 *  - 7 rodadas, cada uma num domínio de arena sorteado pela seed (sem repetir).
 *  - A cada rodada os DOIS jogadores escolhem (às cegas) qual harness mandar.
 *  - Score = stat do modelo × effort × afinidade do agente × diversidade do squad × ruído da seed.
 *  - 429 RATE LIMIT: repetir o mesmo agente da rodada anterior corta o score (força rotação).
 */
import { MODELS, EFFORTS, DOMAIN_INFO, type Domain } from '../data/models'
import { agentById } from '../data/agents'
import type { Harness } from './battle'

export const ROUNDS = 7
export const PICK_SECONDS = 20
export const RATE_LIMIT_MULT = 0.35

// ── RNG determinístico ───────────────────────────────────────────────────────
function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 7 domínios únicos sorteados pela seed (Fisher-Yates nos 8). */
export function deriveDomains(seed: number): Domain[] {
  const rng = mulberry32(seed)
  const all = Object.keys(DOMAIN_INFO) as Domain[]
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all.slice(0, ROUNDS)
}

function diversity(party: Harness[]): number {
  const roles = new Set(party.map((h) => agentById(h.agentId).role))
  return 1 + (roles.size - 1) * 0.12
}

export function harnessPower(h: Harness, d: Domain): number {
  const m = MODELS.find((m) => m.id === h.modelId)!
  const ag = agentById(h.agentId)
  return m.stats[d] * EFFORTS[h.effort].mult * (ag.affinity.includes(d) ? 1.3 : 1)
}

export interface LiveRound {
  domain: Domain
  aIdx: number
  bIdx: number
  a: number
  b: number
  /** true = tomou 429 por repetir o agente da rodada anterior */
  rateA: boolean
  rateB: boolean
}

/** Computa a rodada `round` de forma determinística (mesma nos 2 clientes). */
export function computeRound(
  seed: number, round: number, domain: Domain,
  aSquad: Harness[], bSquad: Harness[],
  aIdx: number, bIdx: number,
  prevAIdx: number | null, prevBIdx: number | null,
): LiveRound {
  const rng = mulberry32((seed ^ ((round + 1) * 0x9e3779b9)) >>> 0)
  const noiseA = 0.9 + rng() * 0.2
  const noiseB = 0.9 + rng() * 0.2
  const rateA = prevAIdx !== null && aSquad.length > 1 && aSquad[aIdx].agentId === aSquad[prevAIdx].agentId
  const rateB = prevBIdx !== null && bSquad.length > 1 && bSquad[bIdx].agentId === bSquad[prevBIdx].agentId
  const a = Math.round(harnessPower(aSquad[aIdx], domain) * diversity(aSquad) * noiseA * (rateA ? RATE_LIMIT_MULT : 1))
  const b = Math.round(harnessPower(bSquad[bIdx], domain) * diversity(bSquad) * noiseB * (rateB ? RATE_LIMIT_MULT : 1))
  return { domain, aIdx, bIdx, a, b, rateA, rateB }
}

// ── cliente WebSocket ────────────────────────────────────────────────────────
export interface MatchStart {
  seed: number
  you: 'a' | 'b'
  a: { name: string; squad: Harness[] }
  b: { name: string; squad: Harness[] }
}

export type LiveEvent =
  | { t: 'open' }
  | { t: 'room'; code: string }
  | { t: 'start'; match: MatchStart }
  | { t: 'reveal'; round: number; a: number; b: number }
  | { t: 'rematch-ask' }
  | { t: 'left' }
  | { t: 'err'; msg: string }
  | { t: 'closed' }

export function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const base = location.pathname.startsWith('/game') ? '/game/ws' : '/ws'
  return `${proto}://${location.host}${base}`
}

export class PvpClient {
  private ws: WebSocket | null = null
  private handler: (e: LiveEvent) => void

  constructor(handler: (e: LiveEvent) => void) {
    this.handler = handler
  }

  connect() {
    this.ws = new WebSocket(wsUrl())
    this.ws.onopen = () => this.handler({ t: 'open' })
    this.ws.onclose = () => this.handler({ t: 'closed' })
    this.ws.onerror = () => { /* onclose cobre */ }
    this.ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data as string)
        if (m.t === 'room') this.handler({ t: 'room', code: m.code })
        else if (m.t === 'start') this.handler({ t: 'start', match: { seed: m.seed, you: m.you, a: m.a, b: m.b } })
        else if (m.t === 'reveal') this.handler({ t: 'reveal', round: m.round, a: m.a, b: m.b })
        else if (m.t === 'rematch-ask') this.handler({ t: 'rematch-ask' })
        else if (m.t === 'left') this.handler({ t: 'left' })
        else if (m.t === 'err') this.handler({ t: 'err', msg: m.msg })
      } catch { /* ignora frame inválido */ }
    }
  }

  private send(obj: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj))
  }
  create(name: string, squad: Harness[]) { this.send({ t: 'create', name, squad }) }
  join(code: string, name: string, squad: Harness[]) { this.send({ t: 'join', code, name, squad }) }
  pick(round: number, idx: number) { this.send({ t: 'pick', round, idx }) }
  rematch() { this.send({ t: 'rematch' }) }
  close() { this.ws?.close(); this.ws = null }
}

export function roomUrl(code: string): string {
  return `${location.origin}${location.pathname}#room=${code}`
}
export function parseRoomHash(): string | null {
  return location.hash.match(/room=([A-Za-z0-9]{4,8})/)?.[1]?.toUpperCase() ?? null
}
