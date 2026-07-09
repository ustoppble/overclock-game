/** PvP AO VIVO — sala por código, 7 rodadas, picks simultâneos às cegas. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { agentById } from '../data/agents'
import { MODELS, DOMAIN_INFO } from '../data/models'
import type { Harness } from '../engine/battle'
import {
  PvpClient, computeRound, deriveDomains, harnessPower, roomUrl,
  ROUNDS, PICK_SECONDS, type LiveEvent, type LiveRound, type MatchStart,
} from '../engine/pvpLive'
import { chiptune } from '../audio/chiptune'
import { PixelSprite, ROLE_PALETTES } from './PixelSprite'

type Stage = 'menu' | 'hosting' | 'joining' | 'playing' | 'ended'

interface Props {
  party: Harness[]
  playerName: string
  joinCode?: string | null
  onBack: () => void
}

export function PvpLive({ party, playerName, joinCode, onBack }: Props) {
  const [stage, setStage] = useState<Stage>('menu')
  const [roomCode, setRoomCode] = useState('')
  const [codeInput, setCodeInput] = useState(joinCode ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [match, setMatch] = useState<MatchStart | null>(null)
  const [rounds, setRounds] = useState<LiveRound[]>([])
  const [myPick, setMyPick] = useState<number | null>(null)
  const [oppLeft, setOppLeft] = useState(false)
  const [rematchAsked, setRematchAsked] = useState(false)
  const [rematchSent, setRematchSent] = useState(false)
  const [timer, setTimer] = useState(PICK_SECONDS)
  const [copied, setCopied] = useState(false)

  const clientRef = useRef<PvpClient | null>(null)
  const matchRef = useRef<MatchStart | null>(null)
  matchRef.current = match
  const roundsRef = useRef<LiveRound[]>([])
  roundsRef.current = rounds

  const domains = useMemo(() => (match ? deriveDomains(match.seed) : []), [match])
  const round = rounds.length
  const mySide = match?.you ?? 'a'
  const mySquad = match ? match[mySide].squad : party
  const oppSide = mySide === 'a' ? 'b' : 'a'

  useEffect(() => {
    const client = new PvpClient((e: LiveEvent) => {
      if (e.t === 'room') { setRoomCode(e.code); setStage('hosting') }
      else if (e.t === 'start') {
        chiptune.confirm()
        setMatch(e.match); setRounds([]); setMyPick(null); setRematchAsked(false); setRematchSent(false); setOppLeft(false)
        setStage('playing')
      }
      else if (e.t === 'reveal') {
        const m = matchRef.current
        if (!m) return
        const prev = roundsRef.current
        const doms = deriveDomains(m.seed)
        const r = computeRound(
          m.seed, e.round, doms[e.round], m.a.squad, m.b.squad, e.a, e.b,
          prev.length ? prev[prev.length - 1].aIdx : null,
          prev.length ? prev[prev.length - 1].bIdx : null,
        )
        chiptune.confirm()
        const next = [...prev, r]
        setRounds(next)
        setMyPick(null)
        const wins = next.reduce((w, x) => { if (x.a > x.b) w.a++; else if (x.b > x.a) w.b++; return w }, { a: 0, b: 0 })
        if (next.length >= ROUNDS || wins.a > ROUNDS / 2 || wins.b > ROUNDS / 2) setStage('ended')
      }
      else if (e.t === 'rematch-ask') setRematchAsked(true)
      else if (e.t === 'left') { setOppLeft(true); if (matchRef.current) setStage('ended') }
      else if (e.t === 'err') setErr(e.msg)
      else if (e.t === 'closed') setErr((prev) => prev ?? 'conexão caiu — volta e tenta de novo')
    })
    client.connect()
    clientRef.current = client
    return () => client.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // auto-join se veio com código no link
  const autoJoined = useRef(false)
  useEffect(() => {
    if (joinCode && !autoJoined.current) {
      autoJoined.current = true
      const t = setTimeout(() => { clientRef.current?.join(joinCode, playerName, party); setStage('joining') }, 400)
      return () => clearTimeout(t)
    }
  }, [joinCode, playerName, party])

  // melhor pick legal pro domínio (usado no timeout)
  const bestLegal = (dom: (typeof domains)[number], prevIdx: number | null): number => {
    let best = 0, bestPow = -1
    for (let i = 0; i < mySquad.length; i++) {
      const repeated = prevIdx !== null && mySquad.length > 1 && mySquad[i].agentId === mySquad[prevIdx].agentId
      const pow = harnessPower(mySquad[i], dom) * (repeated ? 0.35 : 1)
      if (pow > bestPow) { bestPow = pow; best = i }
    }
    return best
  }

  // timer da rodada: estoura → auto-pick
  useEffect(() => {
    if (stage !== 'playing' || myPick !== null) return
    setTimer(PICK_SECONDS)
    const iv = setInterval(() => setTimer((t) => {
      if (t <= 1) {
        clearInterval(iv)
        const prevIdx = roundsRef.current.length ? roundsRef.current[roundsRef.current.length - 1][mySide === 'a' ? 'aIdx' : 'bIdx'] : null
        const idx = bestLegal(domains[roundsRef.current.length], prevIdx)
        setMyPick(idx)
        clientRef.current?.pick(roundsRef.current.length, idx)
        return 0
      }
      return t - 1
    }), 1000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, round, myPick])

  const doPick = (idx: number) => {
    if (myPick !== null || stage !== 'playing') return
    chiptune.confirm()
    setMyPick(idx)
    clientRef.current?.pick(round, idx)
  }

  const wins = rounds.reduce((w, r) => { if (r.a > r.b) w.a++; else if (r.b > r.a) w.b++; return w }, { a: 0, b: 0 })
  const myWins = mySide === 'a' ? wins.a : wins.b
  const oppWins = mySide === 'a' ? wins.b : wins.a
  const myPrevIdx = rounds.length ? rounds[rounds.length - 1][mySide === 'a' ? 'aIdx' : 'bIdx'] : null

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(roomUrl(roomCode)); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* http */ }
  }

  const HarnessChip = ({ h }: { h: Harness }) => {
    const a = agentById(h.agentId)
    return (
      <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <PixelSprite seed={`agent-${a.id}`} palette={ROLE_PALETTES[a.role]} size={22} animate={false} />
        {a.name} <small>{MODELS.find((m) => m.id === h.modelId)?.name}·{h.effort}</small>
      </span>
    )
  }

  // ── menu / lobby ───────────────────────────────────────────────────────────
  if (stage === 'menu' || stage === 'hosting' || stage === 'joining') {
    return (
      <div className="panel">
        <h2>🔴 PvP AO VIVO</h2>
        <p className="sub">Duelo em tempo real: 7 domínios de arena, os dois escolhem o harness às cegas a cada rodada. Repetir agente = 429 RATE LIMIT.</p>
        {err && <p className="sub" style={{ color: '#ef4444' }}>⚠ {err}</p>}

        {stage === 'menu' && (
          <>
            <div className="slot">
              <h4>Criar sala</h4>
              <button className="btn" onClick={() => { setErr(null); clientRef.current?.create(playerName, party) }}>➕ criar sala com meu squad</button>
            </div>
            <div className="slot" style={{ marginTop: 10 }}>
              <h4>Entrar numa sala</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="pvp-input" placeholder="código (ex: KX7Q)…" value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())} maxLength={8} />
                <button className="btn small" disabled={codeInput.trim().length < 4}
                  onClick={() => { setErr(null); clientRef.current?.join(codeInput.trim(), playerName, party); setStage('joining') }}>entrar</button>
              </div>
            </div>
          </>
        )}

        {stage === 'hosting' && (
          <div className="slot center" style={{ marginTop: 10 }}>
            <h4>Sala criada — esperando desafiante…</h4>
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 6, color: '#ef4444', margin: '8px 0' }}>{roomCode}</div>
            <button className="btn small" onClick={copyLink}>{copied ? '✓ copiado!' : '🔗 copiar link da sala'}</button>
            <p className="sub">manda o código ou o link — quem entrar duela na hora</p>
            <span className="press">aguardando…</span>
          </div>
        )}

        {stage === 'joining' && !err && <p className="sub center" style={{ marginTop: 14 }}>entrando na sala…</p>}

        <div style={{ marginTop: 14 }}><button className="btn ghost" onClick={onBack}>voltar</button></div>
      </div>
    )
  }

  // ── partida / fim ──────────────────────────────────────────────────────────
  const dom = domains[round]
  const info = dom ? DOMAIN_INFO[dom] : null
  const me = match![mySide], opp = match![oppSide]

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2>🔴 {me.name} <span style={{ color: '#ef4444' }}>{myWins}</span> × <span style={{ color: '#3b82f6' }}>{oppWins}</span> {opp.name}</h2>
        {stage === 'playing' && myPick === null && <span style={{ fontWeight: 900, color: timer <= 5 ? '#ef4444' : '#fbbf24' }}>⏱ {timer}s</span>}
      </div>

      {/* rodadas já resolvidas */}
      {rounds.map((r, i) => {
        const dInfo = DOMAIN_INFO[r.domain]
        const myScore = mySide === 'a' ? r.a : r.b
        const oppScore = mySide === 'a' ? r.b : r.a
        const myIdx = mySide === 'a' ? r.aIdx : r.bIdx
        const oppIdx = mySide === 'a' ? r.bIdx : r.aIdx
        const myRate = mySide === 'a' ? r.rateA : r.rateB
        const oppRate = mySide === 'a' ? r.rateB : r.rateA
        return (
          <div className="arena-round" key={i}>
            <span>{dInfo.emoji} {dInfo.label}</span>
            <span style={{ color: myScore >= oppScore ? '#22c55e' : '#6b7280' }}>
              {agentById(me.squad[myIdx].agentId).name} {myRate && '⚠429'} {myScore}
            </span>
            <div className="bar">
              <div style={{ width: `${(myScore / Math.max(1, myScore + oppScore)) * 100}%`, background: '#ef4444' }} />
              <div style={{ width: `${(oppScore / Math.max(1, myScore + oppScore)) * 100}%`, background: '#3b82f6' }} />
            </div>
            <span style={{ color: oppScore > myScore ? '#22c55e' : '#6b7280' }}>
              {oppScore} {oppRate && '⚠429'} {agentById(opp.squad[oppIdx].agentId).name}
            </span>
          </div>
        )
      })}

      {/* rodada atual — escolha */}
      {stage === 'playing' && info && (
        <div className="slot" style={{ marginTop: 10 }}>
          <h4>Rodada {round + 1}/{ROUNDS} — {info.emoji} {info.label} <small className="sub">({info.arena})</small></h4>
          {myPick === null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mySquad.map((h, i) => {
                const a = agentById(h.agentId)
                const repeated = myPrevIdx !== null && mySquad.length > 1 && h.agentId === mySquad[myPrevIdx].agentId
                const pow = Math.round(harnessPower(h, dom))
                return (
                  <button key={i} className="btn small" style={{ justifyContent: 'flex-start', textAlign: 'left', opacity: repeated ? 0.6 : 1 }} onClick={() => doPick(i)}>
                    <PixelSprite seed={`agent-${a.id}`} palette={ROLE_PALETTES[a.role]} size={22} animate={false} />
                    {' '}{a.name} · {MODELS.find((m) => m.id === h.modelId)?.name}·{h.effort}
                    {' '}<small>força ~{pow}{a.affinity.includes(dom) ? ' ★afinidade' : ''}{repeated ? ' · ⚠ 429 se repetir!' : ''}</small>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="sub">✓ despachado: <b>{agentById(mySquad[myPick].agentId).name}</b> — esperando {opp.name}…</p>
          )}
        </div>
      )}

      {/* fim */}
      {stage === 'ended' && (
        <div className="center" style={{ padding: '12px 0' }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            {oppLeft && rounds.length < ROUNDS && myWins <= oppWins ? `${opp.name} desconectou.` :
             myWins > oppWins ? `🏆 ${me.name} vence ${myWins}×${oppWins}!` :
             oppWins > myWins ? `💀 ${opp.name} vence ${oppWins}×${myWins}.` : '🤝 empate!'}
          </div>
          <div className="chips" style={{ margin: '8px 0' }}>{opp.squad.map((h, i) => <HarnessChip key={i} h={h} />)}</div>
          {!oppLeft && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn ghost small" disabled={rematchSent}
                onClick={() => { setRematchSent(true); clientRef.current?.rematch() }}>
                {rematchSent ? 'esperando rival…' : rematchAsked ? '⚔️ aceitar revanche!' : 'revanche'}
              </button>
            </div>
          )}
          {rematchAsked && !rematchSent && <p className="sub" style={{ color: '#fbbf24' }}>{opp.name} quer revanche!</p>}
        </div>
      )}

      <div style={{ marginTop: 12 }}><button className="btn ghost" onClick={onBack}>sair do duelo</button></div>
    </div>
  )
}
