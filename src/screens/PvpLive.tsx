/** PvP AO VIVO — sala por código, 7 rodadas, picks simultâneos às cegas. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AGENTS, agentById } from '../data/agents'
import { MODELS, DOMAIN_INFO, EFFORTS } from '../data/models'
import type { Harness } from '../engine/battle'
import {
  PvpClient, computeRound, deriveDomains, harnessPower, roomUrl,
  ROUNDS, PICK_SECONDS, type LiveEvent, type LiveRound, type MatchStart,
} from '../engine/pvpLive'
import { chiptune } from '../audio/chiptune'
import { PixelSprite, ROLE_PALETTES } from './PixelSprite'
import { PhaserHost } from '../phaser/PhaserHost'
import { bridge } from '../phaser/bridge'
import type {
  PvpArenaEnd, PvpArenaParams, PvpArenaPick, PvpArenaReveal, PvpArenaTimer,
} from '../phaser/PvpArenaScene'

type Stage = 'menu' | 'hosting' | 'joining' | 'playing' | 'ended'

interface Props {
  party: Harness[]
  playerName: string
  joinCode?: string | null
  onBack: () => void
  /** chamado UMA vez por match completado (não dispara em desconexão no meio) */
  onResult?: (outcome: 'win' | 'loss' | 'draw') => void
}

const SEEDED_ROLE_PALETTES = Object.fromEntries(
  Object.entries(ROLE_PALETTES).map(([role, palette]) => [role, { ...palette }]),
) as typeof ROLE_PALETTES

function scoreRounds(rounds: LiveRound[], side: 'a' | 'b') {
  const wins = rounds.reduce((score, item) => {
    if (item.a > item.b) score.a++
    else if (item.b > item.a) score.b++
    return score
  }, { a: 0, b: 0 })
  return side === 'a'
    ? { myWins: wins.a, oppWins: wins.b }
    : { myWins: wins.b, oppWins: wins.a }
}

function isValidHarness(value: unknown): value is Harness {
  if (!value || typeof value !== 'object') return false
  const harness = value as Record<string, unknown>
  return typeof harness.agentId === 'string'
    && AGENTS.some((agent) => agent.id === harness.agentId)
    && typeof harness.modelId === 'string'
    && MODELS.some((model) => model.id === harness.modelId)
    && typeof harness.effort === 'string'
    && Object.prototype.hasOwnProperty.call(EFFORTS, harness.effort)
    && Array.isArray(harness.skillIds)
    && harness.skillIds.length <= 4
    && harness.skillIds.every((skill) => typeof skill === 'string')
}

function isValidMatch(value: unknown): value is MatchStart {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (!Number.isInteger(candidate.seed) || (candidate.you !== 'a' && candidate.you !== 'b')) return false
  return (['a', 'b'] as const).every((side) => {
    const player = candidate[side]
    if (!player || typeof player !== 'object') return false
    const record = player as Record<string, unknown>
    return typeof record.name === 'string'
      && record.name.length <= 24
      && Array.isArray(record.squad)
      && record.squad.length >= 1
      && record.squad.length <= 4
      && record.squad.every(isValidHarness)
  })
}

export function PvpLive({ party, playerName, joinCode, onBack, onResult }: Props) {
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
  const [visualBusy, setVisualBusy] = useState(false)
  const [resultReady, setResultReady] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [socketReady, setSocketReady] = useState(false)
  const [connectionLost, setConnectionLost] = useState(false)

  const clientRef = useRef<PvpClient | null>(null)
  const matchRef = useRef<MatchStart | null>(null)
  matchRef.current = match
  const roundsRef = useRef<LiveRound[]>([])
  roundsRef.current = rounds
  const visualBusyRef = useRef(false)
  visualBusyRef.current = visualBusy
  const pickLockedRef = useRef(false)
  const stageRef = useRef<Stage>(stage)
  stageRef.current = stage
  const oppLeftRef = useRef(oppLeft)
  oppLeftRef.current = oppLeft
  const connectionLostRef = useRef(connectionLost)
  connectionLostRef.current = connectionLost
  const visualRoundRef = useRef<number | null>(null)
  const visualWatchdogRef = useRef<number | null>(null)
  const autoJoined = useRef(false)
  const awardedRef = useRef(false)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const domains = useMemo(() => (match ? deriveDomains(match.seed) : []), [match])
  const round = rounds.length
  const mySide = match?.you ?? 'a'
  const mySquad = match ? match[mySide].squad : party
  const oppSide = mySide === 'a' ? 'b' : 'a'

  const completeVisualRound = (ackRound: number) => {
    if (visualRoundRef.current !== ackRound) return
    visualRoundRef.current = null
    if (visualWatchdogRef.current !== null) window.clearTimeout(visualWatchdogRef.current)
    visualWatchdogRef.current = null
    if (stageRef.current !== 'playing' || oppLeftRef.current) return
    visualBusyRef.current = false
    pickLockedRef.current = false
    setVisualBusy(false)
    setTimer(PICK_SECONDS)
    const m = matchRef.current
    const next = roundsRef.current.length
    if (m && next < ROUNDS) setAnnouncement(`Rodada ${next + 1}. Escolha o próximo harness.`)
  }

  const arenaParams = useMemo<PvpArenaParams | null>(() => {
    if (!match) return null
    const side = match.you
    const rival = side === 'a' ? 'b' : 'a'
    return {
      seed: match.seed,
      me: match[side],
      opp: match[rival],
      domains,
      myWins: 0,
      oppWins: 0,
    }
  }, [domains, match])

  useEffect(() => {
    let disposed = false
    const client = new PvpClient((e: LiveEvent) => {
      if (disposed) return
      if (e.t === 'open') {
        setSocketReady(true)
        if (joinCode && !autoJoined.current) {
          autoJoined.current = true
          client.join(joinCode, playerName, party)
          setStage('joining')
        }
      }
      else if (e.t === 'room') { setRoomCode(e.code); setStage('hosting') }
      else if (e.t === 'start') {
        if (!isValidMatch(e.match)) {
          setErr('sala rejeitada: squad remoto inválido')
          setStage('menu')
          return
        }
        chiptune.confirm()
        awardedRef.current = false
        setMatch(e.match); setRounds([]); setMyPick(null); setRematchAsked(false); setRematchSent(false); setOppLeft(false)
        visualBusyRef.current = false
        pickLockedRef.current = false
        oppLeftRef.current = false
        connectionLostRef.current = false
        stageRef.current = 'playing'
        visualRoundRef.current = null
        if (visualWatchdogRef.current !== null) window.clearTimeout(visualWatchdogRef.current)
        visualWatchdogRef.current = null
        setConnectionLost(false)
        setVisualBusy(false); setResultReady(false); setTimer(PICK_SECONDS)
        setAnnouncement(`Duelo iniciado contra ${e.match[e.match.you === 'a' ? 'b' : 'a'].name}. Rodada 1.`)
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
        const next = [...prev, r]
        const score = scoreRounds(next, m.you)
        const final = next.length >= ROUNDS || score.myWins > ROUNDS / 2 || score.oppWins > ROUNDS / 2
        const mine = m.you === 'a'
          ? { idx: r.aIdx, score: r.a, rate: r.rateA }
          : { idx: r.bIdx, score: r.b, rate: r.rateB }
        const theirs = m.you === 'a'
          ? { idx: r.bIdx, score: r.b, rate: r.rateB }
          : { idx: r.aIdx, score: r.a, rate: r.rateA }
        const outcome = score.myWins > score.oppWins ? 'win' : score.oppWins > score.myWins ? 'loss' : 'draw'
        const reveal: PvpArenaReveal = {
          round: e.round,
          domain: r.domain,
          my: mine,
          opp: theirs,
          myWins: score.myWins,
          oppWins: score.oppWins,
          final,
          outcome: final ? outcome : undefined,
        }
        visualBusyRef.current = true
        visualRoundRef.current = final ? null : e.round
        if (visualWatchdogRef.current !== null) window.clearTimeout(visualWatchdogRef.current)
        visualWatchdogRef.current = final ? null : window.setTimeout(() => completeVisualRound(e.round), 4500)
        setVisualBusy(true)
        setRounds(next)
        setMyPick(null)
        setAnnouncement(
          `${DOMAIN_INFO[r.domain].label}: ${agentById(m[m.you].squad[mine.idx].agentId).name} marcou ${mine.score}; `
          + `${agentById(m[m.you === 'a' ? 'b' : 'a'].squad[theirs.idx].agentId).name} marcou ${theirs.score}.`,
        )
        if (final) {
          stageRef.current = 'ended'; setResultReady(false); setStage('ended')
          if (!awardedRef.current) {
            awardedRef.current = true
            onResultRef.current?.(outcome)
          }
        }
        bridge.emit('pvp:reveal', reveal)
      }
      else if (e.t === 'rematch-ask') setRematchAsked(true)
      else if (e.t === 'left') {
        const m = matchRef.current
        oppLeftRef.current = true
        setOppLeft(true)
        if (m) {
          const score = scoreRounds(roundsRef.current, m.you)
          const completed = roundsRef.current.length >= ROUNDS || score.myWins > ROUNDS / 2 || score.oppWins > ROUNDS / 2
          if (completed) {
            setAnnouncement(`${m[m.you === 'a' ? 'b' : 'a'].name} saiu após o resultado.`)
          } else {
            const end: PvpArenaEnd = { reason: 'left', ...score }
            visualBusyRef.current = true
            stageRef.current = 'ended'
            setVisualBusy(true); setResultReady(false); setStage('ended')
            setAnnouncement(`${m[m.you === 'a' ? 'b' : 'a'].name} desconectou do duelo.`)
            bridge.emit('pvp:end', end)
          }
        }
      }
      else if (e.t === 'err') setErr(e.msg)
      else if (e.t === 'closed') {
        setSocketReady(false)
        setErr((prev) => prev ?? 'conexão caiu — volta e tenta de novo')
        const m = matchRef.current
        if (m) {
          const score = scoreRounds(roundsRef.current, m.you)
          const completed = roundsRef.current.length >= ROUNDS || score.myWins > ROUNDS / 2 || score.oppWins > ROUNDS / 2
          connectionLostRef.current = true
          setConnectionLost(true)
          if (completed) {
            setAnnouncement('Conexão encerrada após o resultado. A revanche ficou indisponível.')
          } else {
            const end: PvpArenaEnd = { reason: 'closed', ...score }
            visualBusyRef.current = true
            stageRef.current = 'ended'
            setVisualBusy(true); setResultReady(false); setStage('ended')
            setAnnouncement('Conexão perdida. O duelo foi encerrado com o placar atual.')
            bridge.emit('pvp:end', end)
          }
        }
      }
    })
    client.connect()
    clientRef.current = client
    return () => {
      disposed = true
      if (visualWatchdogRef.current !== null) window.clearTimeout(visualWatchdogRef.current)
      visualWatchdogRef.current = null
      client.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A cena confirma quando terminou de apresentar a rodada. Só então a próxima
  // janela de 20s é liberada; o protocolo e o cálculo continuam no React.
  useEffect(() => {
    const offRound = bridge.on('pvp:round-complete', (payload) => {
      const ack = payload as { round?: unknown } | undefined
      if (typeof ack?.round === 'number') completeVisualRound(ack.round)
    })
    const offCutscene = bridge.on('pvp:cutscene-complete', () => {
      visualBusyRef.current = false
      setVisualBusy(false)
      setResultReady(true)
      const m = matchRef.current
      if (!m) return
      const score = scoreRounds(roundsRef.current, m.you)
      const rival = m[m.you === 'a' ? 'b' : 'a'].name
      setAnnouncement(
        connectionLostRef.current ? `Conexão perdida. Placar ${score.myWins} a ${score.oppWins}.` :
        oppLeftRef.current ? `${rival} desconectou. Placar ${score.myWins} a ${score.oppWins}.` :
        score.myWins > score.oppWins ? `Vitória de ${m[m.you].name}, ${score.myWins} a ${score.oppWins}.` :
        score.oppWins > score.myWins ? `Vitória de ${rival}, ${score.oppWins} a ${score.myWins}.` :
        `Empate em ${score.myWins} a ${score.oppWins}.`,
      )
    })
    return () => { offRound(); offCutscene() }
  }, [])

  // Fallback de acessibilidade: os controles finais nunca ficam presos caso o
  // canvas seja suspenso pelo navegador durante a cutscene.
  useEffect(() => {
    if (stage !== 'ended' || resultReady) return
    const timeout = window.setTimeout(() => setResultReady(true), 6500)
    return () => window.clearTimeout(timeout)
  }, [resultReady, stage])

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
    if (stage !== 'playing' || myPick !== null || visualBusy) return
    setTimer(PICK_SECONDS)
    const iv = setInterval(() => setTimer((t) => {
      if (pickLockedRef.current) { clearInterval(iv); return t }
      if (t <= 1) {
        clearInterval(iv)
        const prevIdx = roundsRef.current.length ? roundsRef.current[roundsRef.current.length - 1][mySide === 'a' ? 'aIdx' : 'bIdx'] : null
        const idx = bestLegal(domains[roundsRef.current.length], prevIdx)
        pickLockedRef.current = true
        setMyPick(idx)
        setAnnouncement(`Tempo esgotado. ${agentById(mySquad[idx].agentId).name} foi despachado automaticamente.`)
        bridge.emit('pvp:pick', { idx } satisfies PvpArenaPick)
        clientRef.current?.pick(roundsRef.current.length, idx)
        return 0
      }
      return t - 1
    }), 1000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, round, myPick, visualBusy])

  useEffect(() => {
    if (!match || stage !== 'playing' || visualBusy) return
    bridge.emit('pvp:timer', {
      seconds: timer,
      total: PICK_SECONDS,
      locked: myPick !== null || visualBusy,
      round,
      domain: domains[round],
    } satisfies PvpArenaTimer)
  }, [domains, match, myPick, round, stage, timer, visualBusy])

  const doPick = (idx: number) => {
    if (myPick !== null || stage !== 'playing' || visualBusyRef.current || pickLockedRef.current) return
    pickLockedRef.current = true
    setMyPick(idx)
    setAnnouncement(`${agentById(mySquad[idx].agentId).name} despachado. Aguardando ${match?.[oppSide].name ?? 'rival'}.`)
    bridge.emit('pvp:pick', { idx } satisfies PvpArenaPick)
    clientRef.current?.pick(round, idx)
  }

  const { myWins, oppWins } = scoreRounds(rounds, mySide)
  const matchCompleted = rounds.length >= ROUNDS || myWins > ROUNDS / 2 || oppWins > ROUNDS / 2
  const matchUnavailable = oppLeft || connectionLost
  const myPrevIdx = rounds.length ? rounds[rounds.length - 1][mySide === 'a' ? 'aIdx' : 'bIdx'] : null

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(roomUrl(roomCode)); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* http */ }
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
              <button className="btn" disabled={!socketReady} onClick={() => { setErr(null); clientRef.current?.create(playerName, party) }}>
                {socketReady ? '➕ criar sala com meu squad' : 'conectando à arena…'}
              </button>
            </div>
            <div className="slot" style={{ marginTop: 10 }}>
              <h4>Entrar numa sala</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="pvp-input" placeholder="código (ex: KX7Q)…" value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())} maxLength={8} />
                <button className="btn small" disabled={!socketReady || codeInput.trim().length < 4}
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
    <div className="panel pvp-live-panel">
      <h2 className="sr-only">PvP ao vivo: {me.name} contra {opp.name}</h2>
      <p className="sr-only">Placar atual: {myWins} para {me.name}, {oppWins} para {opp.name}.</p>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>

      <div className="pvp-mobile-score" aria-hidden="true">
        <span><b>{me.name}</b><strong>{myWins}</strong></span>
        <em>×</em>
        <span className="opp"><strong>{oppWins}</strong><b>{opp.name}</b></span>
      </div>

      <div className="pvp-arena-canvas" aria-hidden="true">
        {arenaParams && <PhaserHost mode="pvp" pvpParams={arenaParams} />}
      </div>

      <section className="sr-only" aria-label="Histórico das rodadas">
        <h3>Rodadas concluídas</h3>
        <ol>
          {rounds.map((item, index) => {
            const mine = mySide === 'a' ? item.a : item.b
            const theirs = mySide === 'a' ? item.b : item.a
            return <li key={index}>{DOMAIN_INFO[item.domain].label}: você {mine}, rival {theirs}.</li>
          })}
        </ol>
      </section>

      {err && <p className="pvp-inline-error" role="alert">⚠ {err}</p>}

      {stage === 'playing' && visualBusy && (
        <section className="pvp-command-deck is-busy" aria-label="Rodada em animação">
          <span className="pvp-command-kicker">PACOTES EM TRÂNSITO</span>
          <strong>Executando confronto visual…</strong>
          <span>A próxima escolha abre quando o impacto terminar.</span>
        </section>
      )}

      {stage === 'playing' && !visualBusy && info && (
        <section className="pvp-command-deck" aria-labelledby="pvp-round-title">
          <header className="pvp-command-head">
            <div>
              <span className="pvp-command-kicker">RODADA {round + 1}/{ROUNDS} · ESCOLHA ÀS CEGAS</span>
              <h3 id="pvp-round-title">{info.emoji} {info.label}</h3>
              <p>{info.arena} · despache um harness</p>
            </div>
            <div className={`pvp-pick-timer ${timer <= 5 && myPick === null ? 'is-critical' : ''}`}>
              <span>{myPick === null ? `${timer}s` : 'LOCK'}</span>
              <progress
                max={PICK_SECONDS}
                value={myPick === null ? timer : 0}
                aria-label={myPick === null ? `${timer} segundos restantes` : 'Escolha bloqueada; aguardando rival'}
              />
            </div>
          </header>

          {myPick === null ? (
            <div className="pvp-harness-grid">
              {mySquad.map((h, i) => {
                const a = agentById(h.agentId)
                const model = MODELS.find((candidate) => candidate.id === h.modelId)
                const repeated = myPrevIdx !== null && mySquad.length > 1 && h.agentId === mySquad[myPrevIdx].agentId
                const affinity = a.affinity.includes(dom)
                const pow = Math.round(harnessPower(h, dom))
                const label = `Despachar ${a.name}, ${model?.name ?? h.modelId}, effort ${h.effort}, força estimada ${pow}`
                  + (affinity ? ', com afinidade' : '') + (repeated ? ', risco de 429 por repetição' : '')
                return (
                  <button
                    key={`${h.agentId}-${i}`}
                    type="button"
                    className={`pvp-harness-card ${affinity ? 'has-affinity' : ''} ${repeated ? 'has-rate-risk' : ''}`}
                    aria-label={label}
                    onPointerEnter={() => chiptune.nav()}
                    onClick={() => doPick(i)}
                  >
                    <span className="pvp-card-sprite">
                      <PixelSprite seed={`agent-${a.id}`} palette={SEEDED_ROLE_PALETTES[a.role]} size={52} animate={false} />
                    </span>
                    <span className="pvp-card-copy">
                      <strong>{a.name}</strong>
                      <small>{model?.name ?? h.modelId} · effort {h.effort}</small>
                      <span className="pvp-card-tags">
                        <b>FORÇA ~{pow}</b>
                        {affinity && <em>★ AFINIDADE</em>}
                        {repeated && <em className="rate">⚠ 429 SE REPETIR</em>}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="pvp-pick-status" role="status">
              <PixelSprite
                seed={`agent-${agentById(mySquad[myPick].agentId).id}`}
                palette={SEEDED_ROLE_PALETTES[agentById(mySquad[myPick].agentId).role]}
                size={46}
                animate={false}
              />
              <span>
                <small>HARNESS DESPACHADO</small>
                <strong>{agentById(mySquad[myPick].agentId).name}</strong>
                <b>aguardando {opp.name}…</b>
              </span>
            </div>
          )}
        </section>
      )}

      {stage === 'ended' && (
        <section className={`pvp-result-controls ${resultReady ? 'is-ready' : ''}`} aria-label="Resultado do duelo" aria-live="polite" aria-atomic="true">
          {!resultReady ? (
            <p role="status">CUTSCENE FINAL EM EXECUÇÃO…</p>
          ) : (
            <>
              <span className="pvp-command-kicker">MATCH ENCERRADO</span>
              <h3>
                {connectionLost && !matchCompleted ? 'Conexão perdida.' :
                 oppLeft && !matchCompleted ? `${opp.name} desconectou.` :
                 myWins > oppWins ? `🏆 ${me.name} vence ${myWins}×${oppWins}!` :
                 oppWins > myWins ? `💀 ${opp.name} vence ${oppWins}×${myWins}.` : '🤝 empate!'}
              </h3>
              {!matchUnavailable && rematchAsked && !rematchSent && <p>{opp.name} quer revanche!</p>}
              {!matchUnavailable && (
                <button className="btn small" disabled={rematchSent}
                  onClick={() => { setRematchSent(true); clientRef.current?.rematch() }}>
                  {rematchSent ? 'esperando rival…' : rematchAsked ? '⚔ aceitar revanche' : '↻ revanche'}
                </button>
              )}
            </>
          )}
        </section>
      )}

      <div className="pvp-exit-row"><button className="btn ghost small" onClick={onBack}>sair do duelo</button></div>
    </div>
  )
}
