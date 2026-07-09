/** Catálogo — instalar agentes (captura), desbloquear modelos (tiers), comprar TMs. */
import { AGENTS } from '../data/agents'
import { MODELS } from '../data/models'
import { skillById } from '../data/skills'
import { PixelSprite, ROLE_PALETTES } from './PixelSprite'


interface Props {
  tokens: number
  ownedAgents: string[]
  unlockedModels: string[]
  extraSkills: Record<string, string[]>
  onBuyAgent: (id: string, price: number) => void
  onUnlockModel: (id: string, price: number) => void
  onBuyTM: (agentId: string, skillId: string, price: number) => void
  onDone: () => void
}

export function Catalog({ tokens, ownedAgents, unlockedModels, extraSkills, onBuyAgent, onUnlockModel, onBuyTM, onDone }: Props) {
  return (
    <div className="panel">
      <h2>📦 Catálogo</h2>
      <p className="sub">No Overclock real: Settings → Catalog. Agents, skills e squads instaláveis. Aqui: gaste tokens com sabedoria.</p>

      <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280' }}>Agentes</h3>
      <div className="cat-grid">
        {AGENTS.filter((a) => a.role !== 'especial' || ownedAgents.includes(a.id)).map((a) => {
          const owned = ownedAgents.includes(a.id)
          return (
            <div className="cat-item" key={a.id}>
              <div className="head"><PixelSprite seed={`agent-${a.id}`} palette={ROLE_PALETTES[a.role]} size={40} animate={false} /> {a.name} <span className="role">{a.role}</span></div>
              <div className="desc">{a.desc}</div>
              <div className="desc">skills permitidas: {a.allowedSkills.map((s) => skillById(s).name).join(' · ')}</div>
              {owned
                ? <span className="owned">✓ instalado</span>
                : <button className="btn small" disabled={tokens < a.price} onClick={() => onBuyAgent(a.id, a.price)}>instalar — {a.price} tok</button>}
            </div>
          )
        })}
      </div>

      <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280', marginTop: 22 }}>Modelos (tiers)</h3>
      <div className="cat-grid">
        {MODELS.map((m) => {
          const owned = unlockedModels.includes(m.id)
          return (
            <div className="cat-item" key={m.id}>
              <div className="head">{m.name} <span className="role">tier {m.tier}</span></div>
              <div className="desc">{m.flavor}</div>
              <div className="desc">{m.hits}× golpes/turno · {m.costPerTurn} tok/turno · reasoning {m.reasoning}</div>
              {owned
                ? <span className="owned">✓ desbloqueado</span>
                : <button className="btn small" disabled={tokens < m.unlockCost} onClick={() => onUnlockModel(m.id, m.unlockCost)}>desbloquear — {m.unlockCost} tok</button>}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 18 }}>
        <button className="btn" onClick={onDone}>continuar</button>
        <span style={{ marginLeft: 12, color: '#eab308' }}>💰 {tokens} tokens</span>
      </div>
    </div>
  )
}
