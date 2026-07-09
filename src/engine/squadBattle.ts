/**
 * Combate RPG de squad — o inimigo é uma ENTREGA multi-fase.
 * A SEQUÊNCIA é a mecânica:
 *  - atacar fase à frente da corrente = trabalho às cegas (50% dano, retrabalho)
 *  - scout AGE: revela fases ocultas + buff de contexto (+40% nos 2 próximos golpes)
 *  - reviewer SELA fase concluída; fase não-selada pode VOLTAR no fim ("bug em produção")
 *  - mesmo agente 2x seguidas = 429 (pula a ação)
 *  - custo por ação = modelo × effort; alucinação em fase densa com reasoning < 55
 */
import { EFFORTS } from '../data/models'
import { agentById } from '../data/agents'
import { skillById } from '../data/skills'
import { missionById, type SquadMission, type MissionPhase } from '../data/missions'
import { modelById, gradeFor, type Harness, type Grade } from './battle'

export interface PhaseState {
  def: MissionPhase
  hp: number
  revealed: boolean
  done: boolean
  sealed: boolean
  regressed: boolean
}

export interface SquadBattleState {
  mission: SquadMission
  phases: PhaseState[]
  party: Harness[]
  budget: number
  spent: number
  turn: number
  lastActor: string | null
  contextBuff: number // golpes restantes com +40%
  outcome: 'ongoing' | 'won' | 'lost'
  log: string[]
  /** passivo do orquestrador (forma do mascote): +5% dano por estágio */
  formBonus?: number
  /** missão multi-fase nasce MONOLITO — atacar sem decompor = agente afogado no escopo */
  decomposed: boolean
}

export function startSquadBattle(missionId: string, party: Harness[], budget: number): SquadBattleState {
  const mission = missionById(missionId)
  return {
    mission,
    phases: mission.phases.map((def) => ({ def, hp: def.hp, revealed: !def.hidden, done: false, sealed: false, regressed: false })),
    party, budget, spent: 0, turn: 1, lastActor: null, contextBuff: 0,
    outcome: 'ongoing', log: [mission.intro],
    decomposed: mission.phases.length === 1, // task simples já é atômica
  }
}

/** Onda atual = menor onda com fase viva. Fases da mesma onda são paralelizáveis. */
export function currentWave(s: SquadBattleState): number {
  const alive = s.phases.filter((p) => !p.done)
  if (alive.length === 0) return Infinity
  return Math.min(...alive.map((p) => p.def.wave))
}
/** Fase disponível = viva, revelada e na onda atual (dependências satisfeitas). */
export function isAvailable(s: SquadBattleState, i: number): boolean {
  const p = s.phases[i]
  return p.revealed && !p.done && p.def.wave === currentWave(s)
}
/** compat: primeira fase disponível. */
export function frontIndex(s: SquadBattleState): number {
  return s.phases.findIndex((_, i) => isAvailable(s, i))
}

export function actionCost(h: Harness): number {
  return Math.round(modelById(h.modelId).costPerTurn * EFFORTS[h.effort].costMult)
}

export interface SquadTurnResult {
  state: SquadBattleState
  events: string[]
  dmg: number
  kind: 'attack' | 'scout' | 'seal' | '429' | 'hallucination'
}

/** Manutenção: worker em campo queima contexto MESMO parado (20% do custo de ação). */
export function upkeepCost(s: SquadBattleState): number {
  return s.party.reduce((sum, h) => sum + Math.round(actionCost(h) * 0.2), 0)
}

function enemyCounter(s: SquadBattleState, events: string[]) {
  // upkeep do squad — o trade-off de levar todo mundo de uma vez
  const upkeep = upkeepCost(s)
  if (upkeep > 0) {
    s.spent += upkeep
    s.budget -= upkeep
    if (s.turn <= 2 || s.turn % 4 === 0) {
      events.push(`🔥 Upkeep do squad: -${upkeep} tok/turno (${s.party.length} pane${s.party.length > 1 ? 's' : ''} aberto${s.party.length > 1 ? 's' : ''} queimando contexto — worker ocioso custa).`)
    }
  }
  const hit = Math.round(s.mission.attack * (0.85 + Math.random() * 0.3))
  s.budget -= hit
  events.push(`👾 ${s.mission.name} usou ${s.mission.attackName}! -${hit} tokens.`)
  if (s.budget <= 0) {
    s.outcome = 'lost'
    events.push('💸 BUDGET ZERADO. handoff status=blocked — a missão faliu.')
  }
}

function checkVictory(s: SquadBattleState, events: string[]) {
  if (!s.phases.every((p) => p.done)) return
  // fases não-seladas podem regredir UMA vez — "bug em produção"
  const unsealed = s.phases.filter((p) => !p.sealed && !p.regressed)
  const regressing = unsealed.filter(() => Math.random() < 0.45)
  if (regressing.length > 0) {
    for (const p of regressing) {
      p.done = false
      p.regressed = true
      p.hp = Math.round(p.def.hp * 0.3)
      events.push(`🚨 BUG EM PRODUÇÃO! "${p.def.name}" voltou com ${p.hp} HP — ninguém revisou essa fase (reviewer sela).`)
    }
    return
  }
  s.outcome = 'won'
  events.push(`✅ MISSÃO CONCLUÍDA! Squad envia handoff_submit: status=done. Você sintetiza a entrega.`)
}

/** Ação de ataque: harness do slot ataca a fase alvo com uma skill. */
export function squadAttack(prev: SquadBattleState, slot: number, phaseIdx: number, skillId: string): SquadTurnResult {
  const s: SquadBattleState = structuredClone(prev)
  const events: string[] = []
  const h = s.party[slot]
  const agent = agentById(h.agentId)
  const model = modelById(h.modelId)
  const skill = skillById(skillId)
  const phase = s.phases[phaseIdx]

  // 429
  if (s.party.length > 1 && s.lastActor === h.agentId && s.turn > 1) {
    s.spent += actionCost(h); s.budget -= actionCost(h)
    s.lastActor = h.agentId; s.turn++
    events.push(`⚠️ 429 RATE LIMIT! ${agent.name} agiu 2x seguidas e travou. Rotacione o squad!`)
    enemyCounter(s, events)
    s.log.push(...events)
    return { state: s, events, dmg: 0, kind: '429' }
  }

  const cost = actionCost(h)
  s.spent += cost; s.budget -= cost

  // alucinação em fase densa
  if (phase.def.dense && model.reasoning < 55 && Math.random() < 0.45) {
    const heal = Math.round(phase.def.hp * 0.2)
    phase.hp = Math.min(phase.def.hp, phase.hp + heal)
    events.push(`🌀 ${model.name} ALUCINOU em "${phase.def.name}"! Resolveu o problema errado: fase recupera ${heal} HP.`)
    s.lastActor = h.agentId; s.turn++
    enemyCounter(s, events)
    s.log.push(...events)
    return { state: s, events, dmg: 0, kind: 'hallucination' }
  }

  const stat = model.stats[phase.def.domain]
  const eff = 0.3 + (stat / 100) * 1.7
  const skillMatch = skill.domains.includes(phase.def.domain) ? 1 : 0.4
  const roleMatch = agent.affinity.includes(phase.def.domain) ? 1.3 : 1
  let dmg = skill.power * eff * skillMatch * roleMatch * EFFORTS[h.effort].mult * model.hits

  // monolito não-decomposto: escopo gigante afoga qualquer agente
  if (!s.decomposed) {
    dmg *= 0.2
    events.push(`🌊 ${agent.name} se AFOGA no escopo de "${s.mission.name}" — task grande demais pra um agente só. O ORQUESTRADOR precisa DECOMPOR primeiro!`)
  }
  // onda futura = dependência não satisfeita = trabalho às cegas
  if (s.decomposed && phase.def.wave > currentWave(s)) {
    dmg *= 0.5
    events.push(`🙈 "${phase.def.name}" depende de fase anterior ainda aberta — trabalho sem insumo, dano pela metade.`)
  }
  // buff de contexto do scout
  if (s.contextBuff > 0) {
    dmg *= 1.4
    s.contextBuff--
    events.push('🔎 Contexto do scout: +40% de dano.')
  }
  // passivo do orquestrador (Heroes-style): a forma do clockinho buffa o squad inteiro
  if (s.formBonus) dmg *= 1 + s.formBonus
  dmg = Math.round(dmg)
  phase.hp = Math.max(0, phase.hp - dmg)
  events.push(`${agent.emoji} ${agent.name} (${model.name}·${h.effort}) usou ${skill.name} em "${phase.def.name}" → ${dmg} de dano.${eff >= 1.4 ? ' 💥 SUPER EFICAZ!' : eff <= 0.75 ? ' …pouco eficaz.' : ''}`)
  if (phase.hp === 0 && !phase.done) {
    phase.done = true
    events.push(`✔️ Fase "${phase.def.name}" concluída${phase.sealed ? '' : ' (não revisada!)'}.`)
  }

  s.lastActor = h.agentId; s.turn++
  checkVictory(s, events)
  if (s.outcome === 'ongoing') enemyCounter(s, events)
  s.log.push(...events)
  return { state: s, events, dmg, kind: 'attack' }
}

/** Ação de scout: revela ocultas + buff de contexto. */
export function squadScout(prev: SquadBattleState, slot: number): SquadTurnResult {
  const s: SquadBattleState = structuredClone(prev)
  const events: string[] = []
  const h = s.party[slot]
  const agent = agentById(h.agentId)
  if (s.party.length > 1 && s.lastActor === h.agentId && s.turn > 1) {
    s.turn++
    events.push(`⚠️ 429! ${agent.name} precisa descansar.`)
    enemyCounter(s, events); s.log.push(...events)
    return { state: s, events, dmg: 0, kind: '429' }
  }
  const cost = actionCost(h)
  s.spent += cost; s.budget -= cost
  if (!s.decomposed) {
    s.contextBuff = 2
    events.push(`🔎 ${agent.emoji} ${agent.name} sonda o monolito: escopo gigante, sem pontos de entrada. Contexto coletado (+40% nos 2 próximos) — mas o ORQUESTRADOR precisa DECOMPOR.`)
  } else {
    const hidden = s.phases.filter((p) => !p.revealed)
    hidden.forEach((p) => { p.revealed = true })
    s.contextBuff = 2
    events.push(`🔎 ${agent.emoji} ${agent.name} faz reconhecimento: ${hidden.length > 0 ? `revela ${hidden.map((p) => `"${p.def.name}"`).join(', ')}! ` : ''}Contexto coletado — próximos 2 golpes +40%.`)
  }
  s.lastActor = h.agentId; s.turn++
  enemyCounter(s, events)
  s.log.push(...events)
  return { state: s, events, dmg: 0, kind: 'scout' }
}

/** Ação de reviewer: sela fase concluída (imune a regressão). */
export function squadSeal(prev: SquadBattleState, slot: number, phaseIdx: number): SquadTurnResult {
  const s: SquadBattleState = structuredClone(prev)
  const events: string[] = []
  const h = s.party[slot]
  const agent = agentById(h.agentId)
  if (s.party.length > 1 && s.lastActor === h.agentId && s.turn > 1) {
    s.turn++
    events.push(`⚠️ 429! ${agent.name} precisa descansar.`)
    enemyCounter(s, events); s.log.push(...events)
    return { state: s, events, dmg: 0, kind: '429' }
  }
  const cost = actionCost(h)
  s.spent += cost; s.budget -= cost
  const phase = s.phases[phaseIdx]
  phase.sealed = true
  events.push(`🛡️ ${agent.emoji} ${agent.name} revisa e SELA "${phase.def.name}" — verification-before-completion. Não volta mais.`)
  s.lastActor = h.agentId; s.turn++
  checkVictory(s, events)
  if (s.outcome === 'ongoing') enemyCounter(s, events)
  s.log.push(...events)
  return { state: s, events, dmg: 0, kind: 'seal' }
}

export function squadGrade(s: SquadBattleState): Grade {
  return gradeFor(s.spent, s.mission.baseline)
}

// ── AÇÕES DO ORQUESTRADOR (o clockinho — Heroes-style, nunca ataca) ──────────

/** todo_manager: DECOMPÕE o monolito nas suas atividades — o golpe-assinatura do orquestrador. */
export function orchDecompose(prev: SquadBattleState): SquadTurnResult {
  const s: SquadBattleState = structuredClone(prev)
  const events: string[] = []
  s.decomposed = true
  const visible = s.phases.filter((p) => !p.def.hidden)
  const hidden = s.phases.length - visible.length
  events.push(`🎼 ORQUESTRADOR usa todo_manager: DECOMPOR! "${s.mission.name}" se parte em ${s.phases.length} atividade${s.phases.length > 1 ? 's' : ''}: ${visible.map((p) => p.def.name).join(' → ')}${hidden > 0 ? ` (+${hidden} oculta — um scout revela)` : ''}.`)
  events.push('Agora cada agente ataca a SUA atividade, na sequência.')
  s.lastActor = null
  s.turn++
  s.log.push(...events)
  return { state: s, events, dmg: 0, kind: 'scout' }
}

/** agent_invoke: traz um reserva pro campo (máx 4 em campo). Custa a ação do invocado. */
export function orchInvoke(prev: SquadBattleState, reserve: Harness): SquadTurnResult {
  const s: SquadBattleState = structuredClone(prev)
  const events: string[] = []
  const a = agentById(reserve.agentId)
  const cost = actionCost(reserve)
  s.spent += cost; s.budget -= cost
  s.party.push(reserve)
  events.push(`🎼 ORQUESTRADOR usa agent_invoke! ${a.emoji} ${a.name} entra em campo (${modelById(reserve.modelId).name}·${reserve.effort}).`)
  s.lastActor = null // invocação re-sincroniza o squad
  s.turn++
  enemyCounter(s, events)
  s.log.push(...events)
  return { state: s, events, dmg: 0, kind: 'scout' }
}

/** handoff_list/sync: limpa rate-limit + coordenação (+20% nos próximos 2 golpes). */
export function orchSync(prev: SquadBattleState): SquadTurnResult {
  const s: SquadBattleState = structuredClone(prev)
  const events: string[] = []
  s.lastActor = null
  s.contextBuff = Math.max(s.contextBuff, 2)
  events.push('🎼 ORQUESTRADOR usa handoff_list: squad sincronizado — rate-limit limpo, próximos 2 golpes coordenados (+40%).')
  s.turn++
  enemyCounter(s, events)
  s.log.push(...events)
  return { state: s, events, dmg: 0, kind: 'scout' }
}

/** squad_spawn: DESPACHO PARALELO — todos os membros atacam SUAS fases da onda atual num turno só.
 *  O superpoder do Overclock: paralelizar o que é independente. Custa a soma de todas as ações.
 *  Mais membros que fases abertas = excedente ocioso (pagou upkeep à toa — composição errada). */
export interface ParallelHit { slot: number; phaseIdx: number; dmg: number; superHit: boolean; hallucinated: boolean }
export function orchParallel(prev: SquadBattleState): SquadTurnResult & { hits: ParallelHit[] } {
  const s: SquadBattleState = structuredClone(prev)
  const events: string[] = []
  const hits: ParallelHit[] = []
  events.push('🎼 ORQUESTRADOR usa squad_spawn: DESPACHO PARALELO! Todos os workers, cada um na sua frente — ao mesmo tempo.')

  // fases abertas da onda atual
  const open = s.phases.map((p, i) => ({ p, i })).filter(({ i }) => isAvailable(s, i))
  // atribuição: cada membro pega a fase disponível onde é mais forte; 1 worker por fase primeiro
  const taken = new Set<number>()
  const assignments: { slot: number; phaseIdx: number }[] = []
  s.party.forEach((h, slot) => {
    const model = modelById(h.modelId)
    const agent = agentById(h.agentId)
    const ranked = open
      .filter(({ i }) => !taken.has(i))
      .sort((a, b) => {
        const powA = model.stats[a.p.def.domain] * (agent.affinity.includes(a.p.def.domain) ? 1.3 : 1)
        const powB = model.stats[b.p.def.domain] * (agent.affinity.includes(b.p.def.domain) ? 1.3 : 1)
        return powB - powA
      })
    if (ranked.length > 0) {
      taken.add(ranked[0].i)
      assignments.push({ slot, phaseIdx: ranked[0].i })
    } else {
      events.push(`💤 ${agent.emoji} ${agent.name} sem frente disponível nesta onda — ocioso (upkeep pago à toa).`)
    }
  })

  for (const { slot, phaseIdx } of assignments) {
    const h = s.party[slot]
    const agent = agentById(h.agentId)
    const model = modelById(h.modelId)
    const phase = s.phases[phaseIdx]
    const cost = actionCost(h)
    s.spent += cost; s.budget -= cost
    if (phase.def.dense && model.reasoning < 55 && Math.random() < 0.45) {
      const heal = Math.round(phase.def.hp * 0.2)
      phase.hp = Math.min(phase.def.hp, phase.hp + heal)
      events.push(`🌀 ${model.name} ALUCINOU em "${phase.def.name}" (+${heal} HP).`)
      hits.push({ slot, phaseIdx, dmg: 0, superHit: false, hallucinated: true })
      continue
    }
    // melhor skill do membro pro domínio da fase
    const best = h.skillIds.map(skillById).sort((a, b) => {
      const pa = a.power * (a.domains.includes(phase.def.domain) ? 1 : 0.4)
      const pb = b.power * (b.domains.includes(phase.def.domain) ? 1 : 0.4)
      return pb - pa
    })[0]
    const stat = model.stats[phase.def.domain]
    const eff = 0.3 + (stat / 100) * 1.7
    const skillMatch = best.domains.includes(phase.def.domain) ? 1 : 0.4
    const roleMatch = agent.affinity.includes(phase.def.domain) ? 1.3 : 1
    let dmg = best.power * eff * skillMatch * roleMatch * EFFORTS[h.effort].mult * model.hits
    if (s.contextBuff > 0) { dmg *= 1.4; s.contextBuff-- }
    if (s.formBonus) dmg *= 1 + s.formBonus
    dmg = Math.round(dmg)
    phase.hp = Math.max(0, phase.hp - dmg)
    const superHit = eff >= 1.4
    events.push(`${agent.emoji} ${agent.name} → "${phase.def.name}" com ${best.name}: ${dmg} de dano.${superHit ? ' 💥' : ''}`)
    if (phase.hp === 0 && !phase.done) {
      phase.done = true
      events.push(`✔️ "${phase.def.name}" concluída${phase.sealed ? '' : ' (não revisada!)'}.`)
    }
    hits.push({ slot, phaseIdx, dmg, superHit, hallucinated: false })
  }

  s.lastActor = null
  s.turn++
  checkVictory(s, events)
  if (s.outcome === 'ongoing') enemyCounter(s, events)
  s.log.push(...events)
  return { state: s, events, dmg: hits.reduce((a, b) => a + b.dmg, 0), kind: 'attack', hits }
}

/** pane_close: dispensa um membro do campo — para de pagar upkeep. Não conta como turno. */
export function orchDismiss(prev: SquadBattleState, slot: number): SquadTurnResult {
  const s: SquadBattleState = structuredClone(prev)
  const events: string[] = []
  const a = agentById(s.party[slot].agentId)
  s.party.splice(slot, 1)
  if (s.lastActor === a.id) s.lastActor = null
  events.push(`🎼 ORQUESTRADOR usa pane_close: ${a.emoji} ${a.name} entrega e sai de campo. Upkeep agora: ${upkeepCost(s)} tok/turno.`)
  s.log.push(...events)
  return { state: s, events, dmg: 0, kind: 'scout' }
}

/** re-harness: troca modelo OU effort de um membro no meio da luta. */
export function orchReharness(prev: SquadBattleState, slot: number, patch: { modelId?: string; effort?: Harness['effort'] }): SquadTurnResult {
  const s: SquadBattleState = structuredClone(prev)
  const events: string[] = []
  const h = s.party[slot]
  const a = agentById(h.agentId)
  if (patch.modelId) h.modelId = patch.modelId
  if (patch.effort) h.effort = patch.effort
  events.push(`🎼 ORQUESTRADOR re-harness: ${a.emoji} ${a.name} agora roda ${modelById(h.modelId).name}·${h.effort}. A task mudou? O bundle muda junto.`)
  s.lastActor = null
  s.turn++
  enemyCounter(s, events)
  s.log.push(...events)
  return { state: s, events, dmg: 0, kind: 'scout' }
}
