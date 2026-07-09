/** Montagem do SQUAD — 1 cartão por membro, harness inteiro visível inline. */
import { useState } from 'react'
import { MODELS, EFFORTS, DOMAIN_INFO, type EffortId } from '../data/models'
import { AGENTS, agentById } from '../data/agents'
import { skillById } from '../data/skills'
import type { Harness } from '../engine/battle'
import { actionCost } from '../engine/squadBattle'
import type { SquadMission } from '../data/missions'
import { PixelSprite, ROLE_PALETTES } from './PixelSprite'

interface Props {
  /** sem missão = editor de squad geral (menu SQUAD do mundo) */
  mission?: SquadMission | null
  ownedAgents: string[]
  unlockedModels: string[]
  extraSkills: Record<string, string[]>
  tokens: number
  initialParty: Harness[]
  /** cor do jogador — tinge os sprites do squad */
  clockColor?: string | null
  onStart: (party: Harness[]) => void
  onBack: () => void
}

function defaultHarness(agentId: string, models: string[], _extra: Record<string, string[]>): Harness {
  const a = agentById(agentId)
  // whitelist inteira é equipável (allowedSkills do produto) — nativas primeiro, completa até 4
  const skills = [...new Set([...a.nativeSkills, ...a.allowedSkills])].slice(0, 4)
  return { agentId, modelId: models[models.length - 1], effort: 'medium', skillIds: skills }
}

export function SquadPrep({ mission, ownedAgents, unlockedModels, extraSkills, tokens, initialParty, clockColor = null, onStart, onBack }: Props) {
  const [party, setParty] = useState<Harness[]>(initialParty.filter((h) => ownedAgents.includes(h.agentId)).slice(0, 4))

  const inParty = (id: string) => party.some((h) => h.agentId === id)
  const toggleAgent = (id: string) => {
    if (inParty(id)) setParty((p) => p.filter((h) => h.agentId !== id))
    else if (party.length < 4) setParty((p) => [...p, defaultHarness(id, unlockedModels, extraSkills)])
  }
  const patch = (i: number, p: Partial<Harness>) => setParty((prev) => prev.map((h, j) => (j === i ? { ...h, ...p } : h)))
  const totalPerRound = party.reduce((s, h) => s + actionCost(h), 0)

  return (
    <div className="panel">
      <h2>{mission ? mission.name : 'Seu Squad'}</h2>
      <p className="sub">{mission ? mission.intro : 'A formação que entra em TODA batalha — encontro selvagem ou ginásio. Monte o harness de cada membro aqui; a luta começa direto, sem interrupção.'}</p>

      {mission && (
        <div className="phase-preview">
          {mission.phases.map((p, i) => (
            <div key={p.id} className="phase-chip">
              {p.hidden ? '❓ ???' : <>{DOMAIN_INFO[p.domain].emoji} {p.name} <small>{p.hp} HP{p.dense ? ' · DENSO' : ''}</small></>}
              {i < mission.phases.length - 1 && <span className="arrow">→</span>}
            </div>
          ))}
        </div>
      )}

      {/* passo 1 — escalar */}
      <h3 className="slot-h">1 · Escale o squad ({party.length}/4) — clique pra entrar/sair</h3>
      <div className="chips">
        {AGENTS.filter((a) => ownedAgents.includes(a.id)).map((a) => (
          <button key={a.id} className={`chip ${inParty(a.id) ? 'sel' : ''}`} onClick={() => toggleAgent(a.id)}>
            {inParty(a.id) ? '✓ ' : ''}{a.emoji} {a.name} <small>· {a.role}</small>
          </button>
        ))}
      </div>

      {/* passo 2 — equipar: um cartão por membro, tudo visível */}
      {party.length > 0 && <h3 className="slot-h">2 · Equipe cada membro (harness da missão)</h3>}
      <div className="member-list">
        {party.map((h, i) => {
          const a = agentById(h.agentId)
          const equippable = a.allowedSkills
          return (
            <div className="member-card" key={h.agentId}>
              <div className="member-head">
                <PixelSprite seed={`agent-${a.id}`} palette={ROLE_PALETTES[a.role]} size={44} animate={false} tint={inParty(a.id) ? clockColor : null} />
                <div className="member-id">
                  <b>{a.name}</b>
                  <small>{a.role} · {actionCost(h)} tok/ação</small>
                </div>
                <button className="btn ghost small" onClick={() => toggleAgent(a.id)}>✕ tirar</button>
              </div>
              <div className="member-row">
                <span className="row-label">modelo</span>
                {MODELS.filter((m) => unlockedModels.includes(m.id)).map((m) => (
                  <button key={m.id} className={`chip ${m.id === h.modelId ? 'sel' : ''}`} title={m.flavor}
                    onClick={() => patch(i, { modelId: m.id })}>{m.name}</button>
                ))}
              </div>
              <div className="member-row">
                <span className="row-label">effort</span>
                {(Object.keys(EFFORTS) as EffortId[]).map((e) => (
                  <button key={e} className={`chip ${e === h.effort ? 'sel' : ''}`} onClick={() => patch(i, { effort: e })}>
                    {e} <small>×{EFFORTS[e].mult}</small>
                  </button>
                ))}
              </div>
              <div className="member-row">
                <span className="row-label">skills</span>
                {equippable.map((sid) => {
                  const s = skillById(sid)
                  const on = h.skillIds.includes(sid)
                  return (
                    <button key={sid} className={`chip ${on ? 'sel' : ''}`} title={s.desc}
                      onClick={() => patch(i, { skillIds: on ? h.skillIds.filter((x) => x !== sid) : h.skillIds.length < 4 ? [...h.skillIds, sid] : h.skillIds })}>
                      {on ? '✓ ' : ''}{s.name} <small>{s.domains.map((d) => DOMAIN_INFO[d].emoji).join('')}</small>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="cost-meter">
        <span>custo do squad/rodada: <b>{totalPerRound} tok</b></span>
        <span>· 🔥 upkeep (todos em campo): <b>{party.reduce((s, h) => s + Math.round(actionCost(h) * 0.2), 0)} tok/turno</b> — worker parado também custa</span>
        <span>· budget: <b>{tokens}</b></span>
        {mission && <span>· baseline da missão: {mission.baseline}</span>}
        {!party.some((h) => agentById(h.agentId).role === 'scout') && <span style={{ color: '#fbbf24' }}>· ⚠️ sem scout: fases ocultas ficam invisíveis</span>}
        {!party.some((h) => agentById(h.agentId).role === 'reviewer') && <span style={{ color: '#fbbf24' }}>· ⚠️ sem reviewer: fases podem voltar como bug</span>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn" disabled={party.length === 0 || party.some((h) => h.skillIds.length === 0)}
          onClick={() => onStart(party)}>{mission ? 'INICIAR MISSÃO' : 'SALVAR SQUAD'}</button>
        <button className="btn ghost" onClick={onBack}>voltar ao mundo</button>
      </div>
    </div>
  )
}
