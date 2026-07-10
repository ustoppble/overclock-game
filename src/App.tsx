import { useEffect, useRef, useState } from 'react'
import { missionById, taskAsMission } from './data/missions'
import { gradeFor, GRADE_XP, GRADE_REWARD, type Harness } from './engine/battle'
import { parseHashChallenges, raceChallengeUrl, type SquadCode, type RaceCode } from './engine/pvp'
import { parseRoomHash } from './engine/pvpLive'
import { initialState, loadGame, saveGame, clearSave, normalizeSave, formForXp, xpProgress, type GameState } from './state'
import { pullCloudSave, queueCloudPush } from './engine/cloudSave'
import { PhaserHost } from './phaser/PhaserHost'
import { bridge, type BattleParams, type BattleEnd } from './phaser/bridge'
import { chiptune } from './audio/chiptune'
import { GYM_BOSSES, TRAINERS } from './world/worldMap'
import { SquadPrep } from './screens/SquadPrep'
import { Catalog } from './screens/Catalog'
import { CreateCharacter } from './screens/CreateCharacter'
import { Pvp } from './screens/Pvp'
import { MascotWidget } from './screens/MascotWidget'
import { HowToPlay } from './screens/HowToPlay'
import { useWorldLive } from './screens/useWorldLive'

/** Tutoriais dos treinadores — squad de 1 com mismatch forçado, pra lição doer no bolso. */
const FORCED: Record<string, Harness> = {
  x: { agentId: 'forge', modelId: 'fable', effort: 'high', skillIds: ['debug-sistematico', 'refactor-plan'] },
  y: { agentId: 'forge', modelId: 'haiku', effort: 'low', skillIds: ['debug-sistematico'] },
}

import { agentById } from './data/agents'
const FORM_LADDER = ['base', 'boost', 'turbo', 'overdrive', 'redline']
function reserveHarness(agentId: string, models: string[]): Harness {
  const a = agentById(agentId)
  return { agentId, modelId: models[models.length - 1], effort: 'medium', skillIds: [...new Set([...a.nativeSkills, ...a.allowedSkills])].slice(0, 4) }
}

export default function App() {
  const [gs, setGs] = useState<GameState>(() => loadGame() ?? initialState)
  const [battleParams, setBattleParams] = useState<BattleParams | null>(null)
  const [pendingTrainer, setPendingTrainer] = useState<'x' | 'y' | null>(null)
  const [raceRun, setRaceRun] = useState<RaceCode | null>(null)
  const [rivalSquad, setRivalSquad] = useState<SquadCode | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [raceBanner, setRaceBanner] = useState<RaceCode | null>(null)
  const [raceShare, setRaceShare] = useState<string | null>(null)
  const gsRef = useRef(gs)
  gsRef.current = gs
  const trainerRef = useRef(pendingTrainer)
  trainerRef.current = pendingTrainer
  const raceRef = useRef(raceRun)
  raceRef.current = raceRun

  useEffect(() => { saveGame(gs); queueCloudPush(gs) }, [gs])

  // pull do save em nuvem no boot — nuvem só vence se for mais nova que o local
  useEffect(() => {
    void pullCloudSave().then((cloud) => {
      if (!cloud || typeof cloud.tokens !== 'number') return
      setGs((s) => {
        // não sobrescrever partida em andamento (batalha/duelo) com estado remoto
        if (s.screen === 'battle' || s.screen === 'pvp') return s
        return normalizeSave(cloud)
      })
    })
  }, [])

  // contexto vivo pras cenas Phaser
  bridge.ctx.badges = gs.badges
  bridge.ctx.tutorialsDone = gs.tutorialsDone
  bridge.ctx.pos = gs.worldPos
  bridge.ctx.tokens = gs.tokens
  bridge.ctx.form = formForXp(gs.xp)
  bridge.ctx.clockColor = gs.clockColor

  // presença multiplayer no mundo aberto (desafio 1x1 desemboca no PvP por sala duo)
  useWorldLive({
    active: gs.screen === 'world' && gs.created,
    name: gs.playerName,
    skin: gs.clockColor,
    form: formForXp(gs.xp),
    hasSquad: gs.party.length > 0,
    pos: gs.worldPos,
    onMatch: (code) => {
      setRivalSquad(null)
      setRoomCode(code)
      setGs((s) => ({ ...s, screen: 'pvp' }))
    },
  })

  // parâmetros comuns de batalha: party + reservas invocáveis + passivo da forma
  const commonBattle = () => {
    const s = gsRef.current
    const inParty = new Set(s.party.map((h) => h.agentId))
    const reserves = s.ownedAgents.filter((id) => !inParty.has(id)).map((id) => reserveHarness(id, s.unlockedModels))
    const formBonus = Math.max(0, FORM_LADDER.indexOf(formForXp(s.xp))) * 0.05
    return { party: s.party, budget: s.tokens, reserves, unlockedModels: s.unlockedModels, formBonus }
  }

  // ── eventos do mundo Phaser → UMA batalha só (estilo Chrono Trigger) ──────
  useEffect(() => {
    const offs = [
      bridge.on('move', (p) => {
        const { x, y } = p as { x: number; y: number }
        setGs((s) => ({ ...s, worldPos: { x, y } }))
      }),
      bridge.on('encounter', (taskId) => {
        setPendingTrainer(null)
        setBattleParams({ taskId: taskId as string, ...commonBattle() })
        setGs((s) => ({ ...s, screen: 'battle' }))
      }),
      bridge.on('trainer', (t) => {
        const tr = t as 'x' | 'y'
        setPendingTrainer(tr)
        setBattleParams({ taskId: TRAINERS[tr].taskId, party: [FORCED[tr]], budget: 30000, tutorial: true })
        setGs((s) => ({ ...s, screen: 'battle' }))
      }),
      bridge.on('gym', (gymId) => {
        setPendingTrainer(null)
        setBattleParams({ missionId: `gym-${gymId}`, gymId: gymId as string, ...commonBattle() })
        setGs((s) => ({ ...s, screen: 'battle' }))
      }),
      bridge.on('catalog', () => setGs((s) => ({ ...s, screen: 'catalog' }))),
      bridge.on('arena', () => setGs((s) => ({ ...s, screen: 'pvp' }))), // porta da Arena → PvP (squad vs squad)
      bridge.on('battleEnd', (payload) => finishBattle(payload as BattleEnd)),
    ]
    return () => offs.forEach((off) => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const { squad, race } = parseHashChallenges()
    if (squad) setRivalSquad(squad)
    if (race) setRaceBanner(race)
    setRoomCode(parseRoomHash())
  }, [])

  // ── navegação 100% teclado nos menus React ────────────────────────────────
  const screenRef = useRef(gs.screen)
  screenRef.current = gs.screen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (screenRef.current === 'world' || screenRef.current === 'battle') return
      const ae = document.activeElement as HTMLElement | null
      if (ae?.tagName === 'INPUT' && e.key !== 'Escape') return
      const nav = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'e', 'E', ' ', 'Escape']
      if (!nav.includes(e.key)) return
      const btns = [...document.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        .filter((b) => b.offsetParent !== null)
      if (btns.length === 0) return
      e.preventDefault()
      chiptune.unlock()
      const idx = btns.indexOf(document.activeElement as HTMLButtonElement)
      if (e.key === 'Enter' || e.key === 'e' || e.key === 'E' || e.key === ' ') {
        chiptune.confirm()
        ;(idx >= 0 ? btns[idx] : btns[0]).click()
        return
      }
      if (e.key === 'Escape') {
        chiptune.back()
        const back = btns.find((b) => /voltar|sair|continuar/i.test(b.textContent ?? ''))
        back?.click()
        return
      }
      chiptune.nav()
      const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
      const next = idx < 0 ? 0 : (idx + dir + btns.length) % btns.length
      btns[next].focus()
      btns[next].scrollIntoView({ block: 'nearest' })
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [])

  useEffect(() => {
    if (gs.screen === 'world' || gs.screen === 'battle') return
    const t = setTimeout(() => {
      const btns = [...document.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        .filter((b) => b.offsetParent !== null)
      const primary = btns.find((b) => !b.className.includes('ghost') && !b.className.includes('chip')) ?? btns[0]
      primary?.focus()
    }, 80)
    return () => clearTimeout(t)
  }, [gs.screen])

  const { form, pct } = xpProgress(gs.xp)
  const set = (patch: Partial<GameState>) => setGs((s) => ({ ...s, ...patch }))

  // ── fim de QUALQUER batalha (selvagem, treinador, ginásio, corrida) ───────
  const finishBattle = (end: BattleEnd) => {
    setBattleParams(null)
    const trainer = trainerRef.current
    setPendingTrainer(null)
    if (end.tutorial && trainer) {
      const grade = end.outcome === 'won' ? gradeFor(end.spent, end.missionBaseline) : 'C'
      setGs((s) => ({ ...s, tutorialsDone: [...new Set([...s.tutorialsDone, trainer])], lastGrade: grade, lastSpent: end.spent, screen: 'victory' }))
      return
    }
    if (end.outcome === 'won') {
      const grade = gradeFor(end.spent, end.missionBaseline)
      const reward = Math.round(end.missionBaseline * GRADE_REWARD[grade])
      const gymChapter = end.gymId ? GYM_BOSSES[end.gymId].chapter : null
      if (end.gymId || raceRef.current) {
        const mid = end.gymId ? `gym-${end.gymId}` : raceRef.current!.m
        setRaceShare(raceChallengeUrl(mid, end.spent, grade, gsRef.current.playerName))
      }
      setGs((s) => {
        const badges = gymChapter && !s.badges.includes(gymChapter) ? [...s.badges, gymChapter] : s.badges
        const rewardAgents = [...s.ownedAgents]
        if (gymChapter === 3 && !rewardAgents.includes('maestro-jr')) rewardAgents.push('maestro-jr')
        if (gymChapter === 6 && !rewardAgents.includes('chef')) rewardAgents.push('chef')
        const done = badges.length >= 6
        return {
          ...s, tokens: Math.max(0, end.budget) + reward, xp: Math.max(0, s.xp + GRADE_XP[grade] + (gymChapter ? 10 : 0)),
          badges, ownedAgents: rewardAgents, wonBattles: s.wonBattles + 1,
          lastGrade: grade, lastSpent: end.spent, screen: done ? 'finale' : 'victory',
        }
      })
    } else {
      setGs((s) => ({ ...s, tokens: Math.max(1000, Math.round(s.tokens * 0.4)), screen: 'gameover' }))
    }
    setRaceRun(null)
  }

  // ── título ─────────────────────────────────────────────────────────────────
  if (gs.screen === 'title') {
    return (
      <div className="shell">
        <div className="screen-area">
        <div className="title-screen">
          <MascotWidget form={formForXp(gs.xp)} animation="idle" size={140} color={gs.clockColor} />
          <h1>OVERCLOCK <b>MON</b></h1>
          <p className="tag">Você acordou numa IDE infinita. Tasks selvagens devoram tokens no mato alto; seis ginásios guardam o segredo do <b>HARNESS</b>. Você é o orquestrador — nunca lute. Monte o squad certo e despache.</p>
          {raceBanner && <p className="tag" style={{ color: '#fbbf24' }}>🏁 DESAFIO: {raceBanner.n} fez "{missionById(raceBanner.m).name}" com {raceBanner.s} tokens (nota {raceBanner.g}). Consegue melhor?</p>}
          {rivalSquad && <p className="tag" style={{ color: '#ef4444' }}>⚔️ {rivalSquad.n} te desafiou pra um squad vs squad!</p>}
          {roomCode && <p className="tag" style={{ color: '#ef4444' }}>🔴 Sala de duelo AO VIVO: {roomCode} — entre pra duelar em tempo real!</p>}
          <button className="btn" onClick={() => { chiptune.unlock(); set({ screen: (rivalSquad || roomCode) && gs.created ? 'pvp' : gs.created ? 'world' : 'create' }) }}>▶ {gs.created ? 'CONTINUAR' : 'CRIAR PERSONAGEM'}</button>
          {raceBanner && (
            <button className="btn ghost small" onClick={() => {
              chiptune.unlock(); setRaceRun(raceBanner)
              setBattleParams({ missionId: raceBanner.m, party: gsRef.current.party, budget: gsRef.current.tokens })
              set({ screen: 'battle' })
            }}>🏁 aceitar a corrida de eficiência</button>
          )}
          <button className="btn ghost small" onClick={() => { chiptune.unlock(); set({ screen: 'howto' }) }}>📖 como jogar</button>
          {gs.created && <button className="btn ghost small" onClick={() => { clearSave(); setGs({ ...initialState, screen: 'create' }) }}>novo jogo</button>}
          <span className="press">PRESS START</span>
        </div>
        </div>
      </div>
    )
  }

  if (gs.screen === 'create') {
    return (
      <div className="shell">
        <div className="screen-area">
          <CreateCharacter onDone={({ name, color, starter }) => {
            chiptune.confirm()
            setGs((s) => ({
              ...s, playerName: name, clockColor: color, created: true,
              ownedAgents: [starter.agentId], party: [starter], screen: roomCode ? 'pvp' : 'world',
            }))
          }} />
        </div>
      </div>
    )
  }

  const inPhaser = gs.screen === 'world' || gs.screen === 'battle'

  return (
    <div className="shell">
      <div className="hud">
        <span className="logo">OVERCLOCK <b>MON</b></span>
        <span className="tokens">💰 {gs.tokens} tok</span>
        <span className="badges">{[1, 2, 3, 4, 5, 6].map((c) => <span key={c} title={`Ginásio ${c}`} style={{ opacity: gs.badges.includes(c) ? 1 : 0.2 }}>◆</span>)}</span>
        <button className="btn ghost small" onClick={() => set({ screen: 'squad' })}>⚔ SQUAD</button>
        <button className="btn ghost small" onClick={() => set({ screen: 'howto' })} title="como jogar">📖</button>
        <button className="btn ghost small" onClick={() => chiptune.toggleMute()} title="som">🔊</button>
        <span className="spacer" />
        <span className="form-tag">{form}</span>
        <div className="xpbar"><div style={{ width: `${pct}%` }} /></div>
        <MascotWidget form={form} animation="idle" size={40} color={gs.clockColor} />
      </div>

      <div className="screen-area">
      {inPhaser && <PhaserHost mode={gs.screen === 'battle' ? 'battle' : 'world'} battleParams={battleParams} />}

      {gs.screen === 'squad' && (
        <SquadPrep
          mission={null}
          ownedAgents={gs.ownedAgents} unlockedModels={gs.unlockedModels}
          extraSkills={gs.extraSkills} tokens={gs.tokens} initialParty={gs.party} clockColor={gs.clockColor}
          onStart={(party) => setGs((s) => ({ ...s, party, screen: 'world' }))}
          onBack={() => set({ screen: 'world' })}
        />
      )}

      {gs.screen === 'victory' && (
        <div className="panel center">
          <div className={`grade ${gs.lastGrade ?? 'B'}`}>{gs.lastGrade}</div>
          <h2>handoff_submit · status=done</h2>
          <p className="sub">
            eficiência: {gs.lastSpent} tokens · nota {gs.lastGrade}
            {gs.lastGrade === 'C' ? ' — harness desproporcional. O mascote não gostou.' : gs.lastGrade === 'S' ? ' — harness perfeito. O mascote sentiu.' : ''}
          </p>
          {raceBanner && raceRun == null && raceShare == null ? null : raceBanner && (
            <p className="sub" style={{ color: gs.lastSpent < raceBanner.s ? '#4ade80' : '#ef4444' }}>
              🏁 {gs.lastSpent < raceBanner.s ? `VOCÊ VENCEU A CORRIDA! ${gs.lastSpent} vs ${raceBanner.s} de ${raceBanner.n}` : `${raceBanner.n} lidera: ${raceBanner.s} vs seus ${gs.lastSpent}`}
            </p>
          )}
          {raceShare && (gs.lastGrade === 'S' || gs.lastGrade === 'A') && (
            <button className="btn ghost small" onClick={() => navigator.clipboard?.writeText(raceShare)}>🏁 copiar desafio de eficiência</button>
          )}
          <button className="btn" onClick={() => { setRaceShare(null); set({ screen: 'world' }) }}>voltar ao mundo</button>
        </div>
      )}

      {gs.screen === 'gameover' && (
        <div className="panel center">
          <div className="grade C">✖</div>
          <h2>Missão falida — budget zerado</h2>
          <p className="sub lesson-box">handoff status=blocked. Harness errado queima crédito. Stipend de emergência: {gs.tokens} tok. O tipo da task pedia esse modelo? Esse effort? Essa sequência? Ajuste o squad (⚔ SQUAD) e volte.</p>
          <button className="btn" onClick={() => set({ screen: 'world' })}>voltar ao mundo</button>
          <button className="btn ghost small" onClick={() => set({ screen: 'squad' })}>⚔ ajustar squad</button>
        </div>
      )}

      {gs.screen === 'catalog' && (
        <Catalog
          tokens={gs.tokens} ownedAgents={gs.ownedAgents} unlockedModels={gs.unlockedModels} extraSkills={gs.extraSkills}
          onBuyAgent={(id, price) => setGs((s) => ({ ...s, tokens: s.tokens - price, ownedAgents: [...s.ownedAgents, id] }))}
          onUnlockModel={(id, price) => setGs((s) => ({ ...s, tokens: s.tokens - price, unlockedModels: [...s.unlockedModels, id] }))}
          onBuyTM={() => { /* skills vêm com a whitelist do agente */ }}
          onDone={() => set({ screen: 'world' })}
        />
      )}

      {gs.screen === 'pvp' && (
        <Pvp party={gs.party} playerName={gs.playerName} rival={rivalSquad} joinCode={roomCode} clockColor={gs.clockColor}
          onResult={(o) => setGs((s) => ({
            ...s,
            xp: s.xp + (o === 'win' ? 40 : o === 'draw' ? 20 : 10),
            wonBattles: o === 'win' ? s.wonBattles + 1 : s.wonBattles,
          }))}
          onDone={() => { setRivalSquad(null); setRoomCode(null); history.replaceState(null, '', location.pathname); set({ screen: 'world' }) }} />
      )}

      {gs.screen === 'howto' && (
        <HowToPlay onBack={() => set({ screen: gs.created ? 'world' : 'title' })} />
      )}

      {gs.screen === 'finale' && (
        <div className="panel center">
          <MascotWidget form="redline" animation="blast" size={160} color={gs.clockColor} />
          <h2 style={{ fontSize: 28 }}>🏆 REDLINE PERMANENTE — 6 INSÍGNIAS</h2>
          <p className="lesson-box">
            O que você fez aqui — classificar o tipo da task, montar <span className="kw">agente + modelo + effort + skills</span>, scout antes, reviewer no fim, rotacionar squad — <b>é literalmente operar o Overclock</b>.
          </p>
          <p className="lesson-box">Isso tudo existe de verdade. Sua primeira missão real te espera.</p>
          <a href="https://overclock.sh" style={{ textDecoration: 'none' }}><button className="btn">BAIXAR O OVERCLOCK →</button></a>
          <button className="btn ghost small" onClick={() => set({ screen: 'world' })}>continuar explorando</button>
        </div>
      )}
      </div>
    </div>
  )
}
