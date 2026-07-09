/**
 * Motor de batalha — máquina de estados pura, sem UI.
 * Regras fiéis ao conceito de Harness do Overclock:
 *  - dano = eficácia do bundle (modelo×domínio da arena real) × effort × afinidade do agente × skill
 *  - custo por turno = modelo × effort (sua "vida" é o budget de tokens)
 *  - modelo fraco vs task densa → ALUCINAÇÃO (HP do inimigo regenera)
 *  - effort low em task criativa → resultado genérico (dano 0.3x)
 *  - mesmo agente em turnos consecutivos (cap. 3+) → 429 RATE LIMIT (pula turno)
 */
import { MODELS, EFFORTS, type EffortId, type GameModel } from '../data/models'
import { AGENTS, agentById, type GameAgent } from '../data/agents'
import { skillById, type GameSkill } from '../data/skills'
import { type GameTask } from '../data/tasks'

export interface Harness {
  agentId: string
  modelId: string
  effort: EffortId
  skillIds: string[] // máx 4, dentro do allowedSkills
}

export interface BattleState {
  task: GameTask
  taskHp: number
  budget: number
  spent: number
  harness: Harness
  lastAgentId: string | null
  rateLimited: boolean
  turn: number
  log: string[]
  outcome: 'ongoing' | 'won' | 'lost'
  rateLimitRule: boolean
}

export const modelById = (id: string): GameModel => {
  const m = MODELS.find((m) => m.id === id)
  if (!m) throw new Error(`modelo desconhecido: ${id}`)
  return m
}

export function startBattle(task: GameTask, budget: number, harness: Harness, rateLimitRule: boolean): BattleState {
  return {
    task, taskHp: task.hp, budget, spent: 0, harness,
    lastAgentId: null, rateLimited: false, turn: 1,
    log: [task.intro], outcome: 'ongoing', rateLimitRule,
  }
}

export interface TurnResult {
  state: BattleState
  events: string[]
  dmg: number
  hallucinated: boolean
  generic: boolean
  ratelimited: boolean
  effectiveness: 'super' | 'normal' | 'fraco'
}

/** Eficácia modelo×domínio, normalizada: stat 0-100 → mult 0.3-2.0 */
function effectiveness(model: GameModel, task: GameTask): number {
  const stat = model.stats[task.domain]
  return 0.3 + (stat / 100) * 1.7
}

export function computeTurnCost(harness: Harness): number {
  return Math.round(modelById(harness.modelId).costPerTurn * EFFORTS[harness.effort].costMult)
}

export function estimateDamage(harness: Harness, task: GameTask, skill: GameSkill): { dmg: number; eff: number } {
  const model = modelById(harness.modelId)
  const agent = agentById(harness.agentId)
  const eff = effectiveness(model, task)
  const skillMatch = skill.domains.includes(task.domain) ? 1 : 0.4
  const roleMatch = agent.affinity.includes(task.domain) ? 1.3 : 1
  const effortMult = EFFORTS[harness.effort].mult
  const perHit = skill.power * eff * skillMatch * roleMatch * effortMult
  return { dmg: Math.round(perHit * model.hits), eff }
}

export function playTurn(prev: BattleState, skillId: string): TurnResult {
  const s: BattleState = { ...prev, log: [...prev.log] }
  const events: string[] = []
  const model = modelById(s.harness.modelId)
  const agent = agentById(s.harness.agentId)
  const skill = skillById(skillId)

  // 429 — agente repetido em turnos consecutivos (regra ativa do cap. 3 em diante)
  let ratelimited = false
  if (s.rateLimitRule && s.lastAgentId === s.harness.agentId && s.turn > 1 && !s.rateLimited) {
    ratelimited = true
    s.rateLimited = true
    events.push(`⚠️ 429 RATE LIMIT! ${agent.name} está sobrecarregado e perde o turno. Rotacione seus agentes!`)
  } else {
    s.rateLimited = false
  }

  // custo do turno sai SEMPRE (você pagou a chamada)
  const cost = computeTurnCost(s.harness)
  s.spent += cost
  s.budget -= cost

  let dmg = 0
  let hallucinated = false
  let generic = false
  let effTag: TurnResult['effectiveness'] = 'normal'

  if (!ratelimited) {
    const eff = effectiveness(model, s.task)
    // ALUCINAÇÃO — modelo fraco contra task densa
    if (s.task.dense && model.reasoning < 55 && Math.random() < 0.45) {
      hallucinated = true
      const heal = Math.round(s.task.hp * 0.15)
      s.taskHp = Math.min(s.task.hp, s.taskHp + heal)
      events.push(`🌀 ${model.name} usou ${skill.name}... ALUCINOU! Resolveu o problema errado — ${s.task.name} recupera ${heal} HP.`)
    } else {
      const { dmg: d } = estimateDamage(s.harness, s.task, skill)
      dmg = d
      // resultado genérico — effort low em domínio criativo
      if ((s.task.domain === 'copy' || s.task.domain === 'ux') && s.harness.effort === 'low') {
        generic = true
        dmg = Math.round(dmg * 0.3)
        events.push(`🫥 Effort low em task criativa: resultado GENÉRICO. Dano reduzido a ${dmg}.`)
      }
      s.taskHp = Math.max(0, s.taskHp - dmg)
      effTag = eff >= 1.4 ? 'super' : eff <= 0.75 ? 'fraco' : 'normal'
      const hitsTxt = model.hits > 1 ? ` ×${model.hits} golpes` : ''
      events.push(`${agent.emoji} ${agent.name} (${model.name}·${s.harness.effort}) usou ${skill.name}${hitsTxt} → ${dmg} de dano.`)
      if (effTag === 'super') events.push('💥 É SUPER EFICAZ!')
      if (effTag === 'fraco') events.push('… não é muito eficaz.')
    }
  }

  s.lastAgentId = s.harness.agentId

  // vitória?
  if (s.taskHp <= 0) {
    s.outcome = 'won'
    events.push(`✅ ${s.task.name} resolvida! ${agent.name} envia handoff_submit: status=done.`)
  } else {
    // contra-ataque da task
    const hit = Math.round(s.task.attack * (0.85 + Math.random() * 0.3))
    s.budget -= hit
    events.push(`👾 ${s.task.name} usou ${s.task.attackName}! Você queima ${hit} tokens em retrabalho.`)
    if (s.budget <= 0) {
      s.outcome = 'lost'
      events.push('💸 BUDGET ZERADO. A missão faliu — handoff status=blocked. Monte um harness mais eficiente.')
    }
  }

  s.turn += 1
  s.log.push(...events)
  return { state: s, events, dmg, hallucinated, generic, ratelimited, effectiveness: effTag }
}

/** Troca de harness no meio da luta — custa o turno (a task contra-ataca). */
export function swapHarness(prev: BattleState, harness: Harness): { state: BattleState; events: string[] } {
  const s: BattleState = { ...prev, harness, log: [...prev.log] }
  const events: string[] = []
  const agent = agentById(harness.agentId)
  events.push(`🔄 Re-harness! Você despacha ${agent.emoji} ${agent.name} com ${modelById(harness.modelId).name}·${harness.effort}.`)
  const hit = Math.round(s.task.attack * 0.7)
  s.budget -= hit
  events.push(`👾 ${s.task.name} aproveita a troca: -${hit} tokens.`)
  s.lastAgentId = null
  s.rateLimited = false
  if (s.budget <= 0) {
    s.outcome = 'lost'
    events.push('💸 BUDGET ZERADO durante a troca. Missão falida.')
  }
  s.turn += 1
  s.log.push(...events)
  return { state: s, events }
}

export type Grade = 'S' | 'A' | 'B' | 'C'
export function gradeFor(spent: number, baseline: number): Grade {
  const r = spent / baseline
  if (r <= 0.8) return 'S'
  if (r <= 1.3) return 'A'
  if (r <= 2.2) return 'B'
  return 'C'
}
export const GRADE_XP: Record<Grade, number> = { S: 30, A: 20, B: 8, C: -10 }
export const GRADE_REWARD: Record<Grade, number> = { S: 2.2, A: 1.6, B: 1.1, C: 0.6 }

// ── ARENA (versus) — dois harnesses se desafiam, domínio sorteado por rodada ──
export interface ArenaRound { domain: string; emoji: string; a: number; b: number; note: string }
export interface ArenaResult { rounds: ArenaRound[]; winner: 'a' | 'b'; scoreA: number; scoreB: number }

import { DOMAIN_INFO, type Domain } from '../data/models'

export function runArena(a: Harness, b: Harness, roundCount = 5, rng: () => number = Math.random): ArenaResult {
  const domains = Object.keys(DOMAIN_INFO) as Domain[]
  const rounds: ArenaRound[] = []
  let hpA = 100, hpB = 100
  for (let i = 0; i < roundCount && hpA > 0 && hpB > 0; i++) {
    const d = domains[Math.floor(rng() * domains.length)]
    const mA = modelById(a.modelId), mB = modelById(b.modelId)
    const agA = agentById(a.agentId), agB = agentById(b.agentId)
    const powA = mA.stats[d] * EFFORTS[a.effort].mult * (agA.affinity.includes(d) ? 1.3 : 1) * (0.85 + rng() * 0.3)
    const powB = mB.stats[d] * EFFORTS[b.effort].mult * (agB.affinity.includes(d) ? 1.3 : 1) * (0.85 + rng() * 0.3)
    const dmgToB = Math.round(Math.max(0, powA - powB * 0.4) / 2)
    const dmgToA = Math.round(Math.max(0, powB - powA * 0.4) / 2)
    hpB -= dmgToB; hpA -= dmgToA
    const info = DOMAIN_INFO[d]
    rounds.push({
      domain: info.label, emoji: info.emoji, a: Math.round(powA), b: Math.round(powB),
      note: powA === powB ? 'empate' : powA > powB ? `${agA.name} leva a rodada` : `${agB.name} leva a rodada`,
    })
  }
  const winner: 'a' | 'b' = hpA === hpB ? (rounds.reduce((s, r) => s + r.a - r.b, 0) >= 0 ? 'a' : 'b') : hpA > hpB ? 'a' : 'b'
  return { rounds, winner, scoreA: Math.max(0, hpA), scoreB: Math.max(0, hpB) }
}

export function validHarness(h: Harness, unlockedModels: string[], ownedAgents: string[]): string | null {
  const agent = AGENTS.find((a) => a.id === h.agentId)
  if (!agent || !ownedAgents.includes(h.agentId)) return 'agente não instalado'
  if (!unlockedModels.includes(h.modelId)) return 'modelo bloqueado'
  if (h.skillIds.length === 0) return 'equipe pelo menos 1 skill'
  if (h.skillIds.length > 4) return 'máximo 4 skills'
  for (const id of h.skillIds) if (!agent.allowedSkills.includes(id)) return `skill ${id} fora do allowedSkills de ${agent.name} (skill gate)`
  return null
}
