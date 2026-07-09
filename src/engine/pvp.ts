/**
 * PvP assíncrono ZERO-BACKEND:
 *  - Squad vs Squad: teu squad vira código base64url compartilhável (#sq=...). Engine simula o duelo.
 *  - Corrida de eficiência: resultado de missão vira desafio (#race=...) — mesmo boss, ganha quem gastar menos.
 */
import { MODELS, EFFORTS, DOMAIN_INFO, type Domain } from '../data/models'
import { agentById } from '../data/agents'
import type { Harness } from './battle'
import type { Grade } from './battle'

// ── encoding ────────────────────────────────────────────────────────────────
function b64encode(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64decode<T>(s: string): T | null {
  try {
    const pad = s.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(escape(atob(pad)))) as T
  } catch { return null }
}

export interface SquadCode { n: string; p: Harness[] }
export function encodeSquad(name: string, party: Harness[]): string {
  return b64encode({ n: name, p: party })
}
export function decodeSquad(code: string): SquadCode | null {
  const d = b64decode<SquadCode>(code)
  if (!d || !Array.isArray(d.p) || d.p.length === 0) return null
  try { d.p.forEach((h) => agentById(h.agentId)) } catch { return null }
  return d
}
export function squadChallengeUrl(name: string, party: Harness[]): string {
  return `${location.origin}${location.pathname}#sq=${encodeSquad(name, party)}`
}

export interface RaceCode { m: string; s: number; g: Grade; n: string }
export function raceChallengeUrl(missionId: string, spent: number, grade: Grade, name: string): string {
  return `${location.origin}${location.pathname}#race=${b64encode({ m: missionId, s: spent, g: grade, n: name })}`
}
export function parseHashChallenges(): { squad?: SquadCode; race?: RaceCode } {
  const h = location.hash
  const out: { squad?: SquadCode; race?: RaceCode } = {}
  const sq = h.match(/sq=([A-Za-z0-9_-]+)/)
  if (sq) out.squad = decodeSquad(sq[1]) ?? undefined
  const race = h.match(/race=([A-Za-z0-9_-]+)/)
  if (race) out.race = b64decode<RaceCode>(race[1]) ?? undefined
  return out
}

// ── simulação squad vs squad ────────────────────────────────────────────────
export interface PvpRound { domain: string; emoji: string; aAgent: string; bAgent: string; a: number; b: number }
export interface PvpResult { rounds: PvpRound[]; winner: 'a' | 'b' | 'draw'; winsA: number; winsB: number; divA: number; divB: number }

function bestFor(party: Harness[], d: Domain): { h: Harness; pow: number } {
  let best = party[0], bestPow = -1
  for (const h of party) {
    const m = MODELS.find((m) => m.id === h.modelId)!
    const ag = agentById(h.agentId)
    const pow = m.stats[d] * EFFORTS[h.effort].mult * (ag.affinity.includes(d) ? 1.3 : 1)
    if (pow > bestPow) { best = h; bestPow = pow }
  }
  return { h: best, pow: bestPow }
}

/** Diversidade de roles = bônus de composição — squad só de executor caro perde pra squad completo. */
function diversity(party: Harness[]): number {
  const roles = new Set(party.map((h) => agentById(h.agentId).role))
  return 1 + (roles.size - 1) * 0.12
}

export function simulatePvp(a: Harness[], b: Harness[], rng: () => number = Math.random): PvpResult {
  const domains = Object.keys(DOMAIN_INFO) as Domain[]
  const rounds: PvpRound[] = []
  const divA = diversity(a), divB = diversity(b)
  let winsA = 0, winsB = 0
  const used: Domain[] = []
  for (let i = 0; i < 7; i++) {
    let d: Domain
    do { d = domains[Math.floor(rng() * domains.length)] } while (used.includes(d) && used.length < domains.length)
    used.push(d)
    const pa = bestFor(a, d), pb = bestFor(b, d)
    const sa = Math.round(pa.pow * divA * (0.9 + rng() * 0.2))
    const sb = Math.round(pb.pow * divB * (0.9 + rng() * 0.2))
    if (sa >= sb) winsA++; else winsB++
    const info = DOMAIN_INFO[d]
    rounds.push({ domain: info.label, emoji: info.emoji, aAgent: agentById(pa.h.agentId).name, bAgent: agentById(pb.h.agentId).name, a: sa, b: sb })
    if (winsA === 4 || winsB === 4) break
  }
  return { rounds, winner: winsA === winsB ? 'draw' : winsA > winsB ? 'a' : 'b', winsA, winsB, divA, divB }
}
