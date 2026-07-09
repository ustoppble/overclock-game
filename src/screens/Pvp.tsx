/** PvP — squad vs squad por link (zero backend). Teu squad vira código; amigo cola e duela. */
import { useState } from 'react'
import { agentById } from '../data/agents'
import { MODELS } from '../data/models'
import type { Harness } from '../engine/battle'
import { simulatePvp, squadChallengeUrl, decodeSquad, type PvpResult, type SquadCode } from '../engine/pvp'
import { PixelSprite, ROLE_PALETTES } from './PixelSprite'

interface Props {
  party: Harness[]
  playerName: string
  rival: SquadCode | null
  onDone: () => void
}

export function Pvp({ party, playerName, rival: initialRival, onDone }: Props) {
  const [rival, setRival] = useState<SquadCode | null>(initialRival)
  const [paste, setPaste] = useState('')
  const [result, setResult] = useState<PvpResult | null>(null)
  const [copied, setCopied] = useState(false)

  const url = squadChallengeUrl(playerName, party)
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* http */ }
  }
  const loadPaste = () => {
    const code = paste.match(/sq=([A-Za-z0-9_-]+)/)?.[1] ?? paste.trim()
    const d = decodeSquad(code)
    if (d) { setRival(d); setResult(null) }
  }

  const SquadCard = ({ name, squad, tag }: { name: string; squad: Harness[]; tag: string }) => (
    <div className="cat-item">
      <div className="head">{name} <span className="role">{tag}</span></div>
      <div className="chips">
        {squad.map((h) => {
          const a = agentById(h.agentId)
          return (
            <span key={h.agentId} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <PixelSprite seed={`agent-${a.id}`} palette={ROLE_PALETTES[a.role]} size={26} animate={false} />
              {a.name} <small>{MODELS.find((m) => m.id === h.modelId)?.name}·{h.effort}</small>
            </span>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="panel">
      <h2>🌐 PvP — Squad vs Squad</h2>
      <p className="sub">Como no LMArena: 7 domínios sorteados, cada squad manda o melhor harness por rodada. Composição diversa (scout+executor+reviewer) dá bônus — squad só de executor caro PERDE.</p>

      <SquadCard name={playerName} squad={party} tag="seu squad" />
      <div style={{ display: 'flex', gap: 8, margin: '10px 0', flexWrap: 'wrap' }}>
        <button className="btn small" onClick={copy}>{copied ? '✓ copiado!' : '🔗 copiar link de desafio'}</button>
        <span className="sub" style={{ margin: 0, alignSelf: 'center' }}>manda no grupo — quem abrir enfrenta este squad</span>
      </div>

      {!rival && (
        <div className="slot" style={{ marginTop: 10 }}>
          <h4>Enfrentar um desafio</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="pvp-input" placeholder="cole o link/código do desafiante…" value={paste} onChange={(e) => setPaste(e.target.value)} />
            <button className="btn small" onClick={loadPaste} disabled={!paste.trim()}>carregar</button>
          </div>
        </div>
      )}

      {rival && (
        <>
          <div style={{ textAlign: 'center', fontWeight: 900, color: '#ef4444', fontSize: 20, margin: '6px 0' }}>VS</div>
          <SquadCard name={rival.n} squad={rival.p} tag="desafiante" />
          {!result && <button className="btn" style={{ marginTop: 10 }} onClick={() => setResult(simulatePvp(party, rival.p))}>⚔️ DUELAR</button>}
        </>
      )}

      {result && rival && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {result.rounds.map((r, i) => (
            <div className="arena-round" key={i}>
              <span>{r.emoji} {r.domain}</span>
              <span style={{ color: r.a >= r.b ? '#22c55e' : '#6b7280' }}>{r.aAgent} {r.a}</span>
              <div className="bar">
                <div style={{ width: `${(r.a / (r.a + r.b)) * 100}%`, background: '#ef4444' }} />
                <div style={{ width: `${(r.b / (r.a + r.b)) * 100}%`, background: '#3b82f6' }} />
              </div>
              <span style={{ color: r.b > r.a ? '#22c55e' : '#6b7280' }}>{r.b} {r.bAgent}</span>
            </div>
          ))}
          <div className="center" style={{ padding: '10px 0' }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>
              {result.winner === 'a' ? `🏆 ${playerName} vence ${result.winsA}×${result.winsB}!` :
               result.winner === 'b' ? `💀 ${rival.n} vence ${result.winsB}×${result.winsA}.` : 'empate!'}
            </div>
            <small className="sub">bônus de diversidade — você ×{result.divA.toFixed(2)} · rival ×{result.divB.toFixed(2)}</small>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost small" onClick={() => setResult(simulatePvp(party, rival.p))}>revanche</button>
              <button className="btn" onClick={onDone}>voltar ao mundo</button>
            </div>
          </div>
        </div>
      )}

      {!result && <div style={{ marginTop: 14 }}><button className="btn ghost" onClick={onDone}>voltar ao mundo</button></div>}
    </div>
  )
}
