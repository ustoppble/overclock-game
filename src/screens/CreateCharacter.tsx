/** Criação de personagem — nome, cor do clockinho e STARTER (laboratório Pokémon). */
import { useState } from 'react'
import { agentById } from '../data/agents'
import type { Harness } from '../engine/battle'
import { MascotWidget } from './MascotWidget'
import { PixelSprite, ROLE_PALETTES } from './PixelSprite'

const COLORS: { hex: string | null; name: string }[] = [
  { hex: null, name: 'laranja' },
  { hex: '#38bdf8', name: 'azul' },
  { hex: '#4ade80', name: 'verde' },
  { hex: '#c084fc', name: 'roxo' },
  { hex: '#ef4444', name: 'rubro' },
  { hex: '#fbbf24', name: 'dourado' },
]

const STARTERS = [
  { id: 'sonar', pitch: 'Começa OUVINDO. Revela fases ocultas, buffa o squad com contexto. Early game seguro, dano baixo.' },
  { id: 'forge', pitch: 'Começa FAZENDO. Dano sólido em código/lógica. O caminho direto — mas cego sem scout.' },
  { id: 'aegis', pitch: 'Começa REVISANDO. Sela entregas (nada volta como bug). Vence no longo prazo, early game lento.' },
]

interface Props {
  onDone: (d: { name: string; color: string | null; starter: Harness }) => void
}

export function CreateCharacter({ onDone }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [starter, setStarter] = useState<string | null>(null)

  const start = () => {
    if (!name.trim() || !starter) return
    const a = agentById(starter)
    onDone({
      name: name.trim().slice(0, 16),
      color,
      starter: { agentId: starter, modelId: 'haiku', effort: 'medium', skillIds: [...new Set([...a.nativeSkills, ...a.allowedSkills])].slice(0, 4) },
    })
  }

  return (
    <div className="panel">
      <h2>Novo Orquestrador</h2>
      <p className="sub">Você acaba de instalar o Overclock. Antes da primeira missão: quem é você?</p>

      <div className="create-grid">
        <div className="create-preview">
          <MascotWidget form="base" animation="idle" size={150} color={color} />
          <input
            className="pvp-input create-name" placeholder="seu nome…" maxLength={16} value={name}
            onChange={(e) => setName(e.target.value)} autoFocus
          />
        </div>
        <div>
          <h3 className="slot-h">Cor do seu clockinho</h3>
          <div className="chips">
            {COLORS.map((c) => (
              <button key={c.name} className={`chip swatch ${color === c.hex ? 'sel' : ''}`} onClick={() => setColor(c.hex)}>
                <span className="dot" style={{ background: c.hex ?? '#FF6B35' }} /> {c.name}
              </button>
            ))}
          </div>

          <h3 className="slot-h">Seu primeiro agente (starter)</h3>
          <div className="starter-row">
            {STARTERS.map(({ id, pitch }) => {
              const a = agentById(id)
              return (
                <button key={id} className={`starter-card ${starter === id ? 'sel' : ''}`} onClick={() => setStarter(id)}>
                  <PixelSprite seed={`agent-${a.id}`} palette={ROLE_PALETTES[a.role]} size={64} animate={starter === id} />
                  <b>{a.name}</b>
                  <span className="role">{a.role}</span>
                  <small>{pitch}</small>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
        <button className="btn" disabled={!name.trim() || !starter} onClick={start}>COMEÇAR A JORNADA</button>
        {(!name.trim() || !starter) && <span className="sub" style={{ margin: 0 }}>{!name.trim() ? 'dá um nome' : 'escolhe teu starter'}</span>}
      </div>
    </div>
  )
}
