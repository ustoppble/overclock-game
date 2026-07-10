/**
 * PvP AO VIVO — presentation-only Phaser arena.
 *
 * React/WebSocket remains the authority for picks, scores and match flow. This
 * scene only mirrors bridge events and acknowledges completed visual beats.
 */
import Phaser from 'phaser'
import { chiptune } from '../audio/chiptune'
import { agentById } from '../data/agents'
import { DOMAIN_INFO, MODELS, type Domain } from '../data/models'
import type { Harness } from '../engine/battle'
import { ROLE_PALETTES, type Palette } from '../screens/PixelSprite'
import { bridge } from './bridge'

const W = 918
const H = 560
const ME = 0xef4444
const OPP = 0x3b82f6
const INK = 0x0a0810
const TIMER_W = 240

export interface PvpArenaParams {
  seed: number
  me: { name: string; squad: Harness[] }
  opp: { name: string; squad: Harness[] }
  domains: Domain[]
  myWins: number
  oppWins: number
}

export interface PvpArenaReveal {
  round: number
  domain: Domain
  my: { idx: number; score: number; rate: boolean }
  opp: { idx: number; score: number; rate: boolean }
  myWins: number
  oppWins: number
  final: boolean
  outcome?: 'win' | 'loss' | 'draw'
}

export interface PvpArenaTimer {
  seconds: number
  total: number
  locked: boolean
  round: number
  domain?: Domain
}

export interface PvpArenaPick { idx: number }

export interface PvpArenaEnd {
  reason: 'left' | 'closed'
  myWins: number
  oppWins: number
}

type Side = 'me' | 'opp'

interface FighterView {
  root: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Sprite
  baseX: number
  baseY: number
  harness: Harness
  side: Side
}

interface FighterCard {
  root: Phaser.GameObjects.Container
  bg: Phaser.GameObjects.Rectangle
  status: Phaser.GameObjects.Text
}

function hashSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value |= 0
    value = (value + 0x6d2b79f5) | 0
    let result = Math.imul(value ^ (value >>> 15), 1 | value)
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Unique 18×18 creature generated from the exact `agent-<id>` identity.
 * Unlike the role-authored fallback used by PixelSprite, silhouette, markings,
 * horns and tail all come from the seed, so agents sharing a role still differ.
 */
function agentCanvas(seed: string, palette: Palette): HTMLCanvasElement {
  const gridSize = 18
  const pixel = 4
  const grid: number[][] = Array.from({ length: gridSize }, () => Array<number>(gridSize).fill(0))
  const random = seededRandom(hashSeed(seed))
  const variant = Math.floor(random() * 4)

  // Seeded mirrored body with a different width/profile on every row.
  for (let y = 3; y <= 14; y++) {
    const normalized = Math.abs(y - 9) / 7
    const baseWidth = Math.max(2, Math.round(5.4 - normalized * 2.5 + random() * 1.7))
    for (let offset = 0; offset <= baseWidth; offset++) {
      if (offset === baseWidth && random() < 0.2) continue
      const left = 8 - offset
      const right = 9 + offset
      const shade = random() < 0.24 || (y > 10 && offset > baseWidth - 2) ? 2 : 1
      grid[y][left] = shade
      grid[y][right] = shade
    }
  }

  // Four seeded head profiles: horns, antenna, ears or crown fins.
  if (variant === 0) {
    grid[1][5] = 4; grid[2][6] = 1; grid[1][12] = 4; grid[2][11] = 1
  } else if (variant === 1) {
    grid[0][8] = 4; grid[1][8] = 1; grid[0][9] = 4; grid[1][9] = 1
  } else if (variant === 2) {
    grid[2][3] = 2; grid[3][4] = 1; grid[2][14] = 2; grid[3][13] = 1
  } else {
    grid[1][6] = 4; grid[1][8] = 4; grid[1][9] = 4; grid[1][11] = 4
  }

  // Eyes and a seed-positioned chest glyph.
  const eyeY = 5 + Math.floor(random() * 2)
  const eyeInset = 4 + Math.floor(random() * 2)
  grid[eyeY][eyeInset] = 3
  grid[eyeY][gridSize - 1 - eyeInset] = 3
  const glyphY = 9 + Math.floor(random() * 3)
  const glyphX = 7 + Math.floor(random() * 2)
  grid[glyphY][glyphX] = 4
  grid[glyphY][gridSize - 1 - glyphX] = 4
  if (random() > 0.5) { grid[glyphY + 1][8] = 4; grid[glyphY + 1][9] = 4 }

  // Feet and an intentionally asymmetric tail make facing direction legible.
  grid[15][5] = 2; grid[15][6] = 2; grid[15][11] = 2; grid[15][12] = 2
  const tailY = 9 + Math.floor(random() * 3)
  const tailLeft = random() > 0.5
  grid[tailY][tailLeft ? 1 : 16] = 4
  grid[tailY + 1][tailLeft ? 2 : 15] = 1

  const canvas = document.createElement('canvas')
  canvas.width = gridSize * pixel
  canvas.height = gridSize * pixel
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  // One-cell outline first, then the colored cells.
  ctx.fillStyle = palette.outline
  for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
    if (!grid[y][x]) continue
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (Math.abs(ox) + Math.abs(oy) !== 1 || grid[y + oy]?.[x + ox]) continue
      ctx.fillRect((x + ox) * pixel, (y + oy) * pixel, pixel, pixel)
    }
  }
  for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
    const value = grid[y][x]
    if (!value) continue
    ctx.fillStyle = value === 1 ? palette.body : value === 2 ? palette.body2 : value === 3 ? palette.eye : palette.accent
    ctx.fillRect(x * pixel, y * pixel, pixel, pixel)
  }
  return canvas
}

function safeName(value: string, max: number): string {
  return value.toUpperCase().slice(0, max)
}

export class PvpArenaScene extends Phaser.Scene {
  private params!: PvpArenaParams
  private reducedMotion = false
  private myFighters: FighterView[] = []
  private oppFighters: FighterView[] = []
  private myCards: FighterCard[] = []
  private oppCards: FighterCard[] = []
  private myScore!: Phaser.GameObjects.Text
  private oppScore!: Phaser.GameObjects.Text
  private roundLabel!: Phaser.GameObjects.Text
  private timerFill!: Phaser.GameObjects.Rectangle
  private timerText!: Phaser.GameObjects.Text
  private stateText!: Phaser.GameObjects.Text
  private resultText!: Phaser.GameObjects.Text
  private domainBanner!: Phaser.GameObjects.Container
  private domainRound!: Phaser.GameObjects.Text
  private domainTitle!: Phaser.GameObjects.Text
  private domainArena!: Phaser.GameObjects.Text
  private currentRound = -1
  private currentDomain: Domain | null = null
  private selectedIdx: number | null = null
  private locked = false
  private busy = false
  private ending = false
  private cutsceneSent = false
  private revealQueue: PvpArenaReveal[] = []
  private pendingEnd: PvpArenaEnd | null = null
  private endGate: Phaser.Time.TimerEvent | null = null
  private offBridge: Array<() => unknown> = []
  private cleaned = true

  constructor() { super('PvpArena') }

  create(params: PvpArenaParams) {
    this.cleanup()
    this.cleaned = false
    this.params = params
    this.reducedMotion = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    this.myFighters = []
    this.oppFighters = []
    this.myCards = []
    this.oppCards = []
    this.revealQueue = []
    this.pendingEnd = null
    this.currentRound = 0
    this.currentDomain = params.domains[0] ?? null
    this.selectedIdx = null
    this.locked = false
    this.busy = false
    this.ending = false
    this.cutsceneSent = false

    this.ensureFxTexture()
    this.cameras.main.setBackgroundColor('#000000')
    this.drawArena()
    this.buildHud()
    this.spawnSquad('me', params.me.squad)
    this.spawnSquad('opp', params.opp.squad)
    this.buildCards('me', params.me.squad)
    this.buildCards('opp', params.opp.squad)
    this.updateScore(params.myWins, params.oppWins, false)

    if (this.currentDomain) this.showDomain(this.currentDomain, 0, true)
    else this.domainBanner.setVisible(false)

    this.bindBridge()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup)
    chiptune.setTrack('battle')
    this.cameras.main.fadeIn(this.ms(260), 0, 0, 0)
  }

  private ensureFxTexture() {
    if (this.textures.exists('pvp-pixel')) return
    const canvas = document.createElement('canvas')
    canvas.width = 5; canvas.height = 5
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 5, 5)
    this.textures.addCanvas('pvp-pixel', canvas)
  }

  private ensureAgentTexture(harness: Harness): string {
    const agent = agentById(harness.agentId)
    const key = `pvp-agent-${agent.id.replace(/[^a-z0-9_-]/gi, '-')}`
    if (!this.textures.exists(key)) {
      const palette = ROLE_PALETTES[agent.role]
      this.textures.addCanvas(key, agentCanvas(`agent-${agent.id}`, palette))
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST)
    }
    return key
  }

  private drawArena() {
    const graphics = this.add.graphics()
    graphics.fillGradientStyle(0x000000, 0x000000, INK, INK, 1)
    graphics.fillRect(0, 0, W, H)

    // Seeded server-room lights make each match recognizable without assets.
    const random = seededRandom(this.params.seed)
    for (let i = 0; i < 34; i++) {
      const sideColor = random() > 0.5 ? ME : OPP
      graphics.fillStyle(sideColor, 0.12 + random() * 0.28)
      graphics.fillRect(Math.floor(random() * W), 104 + Math.floor(random() * 245), 1 + Math.floor(random() * 3), 1 + Math.floor(random() * 2))
    }

    graphics.fillStyle(ME, 0.07); graphics.fillEllipse(142, 270, 310, 250)
    graphics.fillStyle(OPP, 0.07); graphics.fillEllipse(W - 142, 270, 310, 250)
    graphics.lineStyle(1, 0x292524, 0.65)
    const horizon = 170
    for (let y = horizon; y <= 414; y += 28) {
      const spread = (y - horizon) * 1.7
      graphics.lineBetween(W / 2 - spread, y, W / 2 + spread, y)
    }
    for (let i = -9; i <= 9; i++) graphics.lineBetween(W / 2 + i * 18, horizon, W / 2 + i * 58, 414)
    graphics.lineStyle(2, 0xef4444, 0.28); graphics.lineBetween(0, 414, W / 2, 414)
    graphics.lineStyle(2, 0x3b82f6, 0.28); graphics.lineBetween(W / 2, 414, W, 414)
    graphics.lineStyle(1, 0xffffff, 0.08); graphics.lineBetween(W / 2, 154, W / 2, 414)

    // Pixel scanlines and side identifiers.
    graphics.fillStyle(0xffffff, 0.022)
    for (let y = 105; y < 414; y += 4) graphics.fillRect(0, y, W, 1)
    this.add.text(20, 394, 'LOCAL / RED', { fontFamily: 'monospace', fontSize: '9px', color: '#7f1d1d', fontStyle: 'bold' })
    this.add.text(W - 20, 394, 'REMOTE / BLUE', { fontFamily: 'monospace', fontSize: '9px', color: '#1e3a8a', fontStyle: 'bold' }).setOrigin(1, 0)
  }

  private buildHud() {
    this.add.rectangle(0, 0, W, 98, 0x050308, 0.97).setOrigin(0).setStrokeStyle(1, 0x292524)
    this.add.rectangle(0, 0, W / 2, 3, ME).setOrigin(0)
    this.add.rectangle(W / 2, 0, W / 2, 3, OPP).setOrigin(0)
    this.add.circle(24, 23, 4, ME)
    const live = this.add.text(35, 15, 'PVP AO VIVO', { fontFamily: 'monospace', fontSize: '10px', color: '#ef4444', fontStyle: 'bold' })
    if (!this.reducedMotion) this.tweens.add({ targets: live, alpha: 0.45, duration: 650, yoyo: true, repeat: -1 })

    this.add.text(26, 37, safeName(this.params.me.name, 23), {
      fontFamily: 'monospace', fontSize: '17px', color: '#fca5a5', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    })
    this.add.text(W - 26, 37, safeName(this.params.opp.name, 23), {
      fontFamily: 'monospace', fontSize: '17px', color: '#93c5fd', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 0)

    this.roundLabel = this.add.text(W / 2, 8, 'MELHOR DE 7', { fontFamily: 'monospace', fontSize: '9px', color: '#78716c', fontStyle: 'bold' }).setOrigin(0.5, 0)
    this.myScore = this.add.text(W / 2 - 45, 20, '0', {
      fontFamily: 'monospace', fontSize: '40px', color: '#ef4444', fontStyle: 'bold', stroke: '#2b0505', strokeThickness: 5,
    }).setOrigin(0.5, 0)
    this.oppScore = this.add.text(W / 2 + 45, 20, '0', {
      fontFamily: 'monospace', fontSize: '40px', color: '#3b82f6', fontStyle: 'bold', stroke: '#06152f', strokeThickness: 5,
    }).setOrigin(0.5, 0)
    this.add.text(W / 2, 30, '×', { fontFamily: 'monospace', fontSize: '23px', color: '#57534e', fontStyle: 'bold' }).setOrigin(0.5)

    this.add.rectangle(W / 2 - TIMER_W / 2, 81, TIMER_W, 8, 0x111017).setOrigin(0, 0.5).setStrokeStyle(1, 0x292524)
    this.timerFill = this.add.rectangle(W / 2 - TIMER_W / 2 + 1, 81, TIMER_W - 2, 6, 0xfbbf24).setOrigin(0, 0.5)
    this.timerText = this.add.text(W / 2, 70, '20s', { fontFamily: 'monospace', fontSize: '9px', color: '#fbbf24', fontStyle: 'bold' }).setOrigin(0.5, 1)
    this.stateText = this.add.text(W / 2, 92, 'ESCOLHA UM HARNESS NO PAINEL', { fontFamily: 'monospace', fontSize: '8px', color: '#78716c', fontStyle: 'bold' }).setOrigin(0.5, 1)

    const bannerBg = this.add.rectangle(0, 0, 472, 50, 0x0a0810, 0.96).setStrokeStyle(2, 0x44403c)
    const leftEdge = this.add.rectangle(-236, 0, 4, 48, ME).setOrigin(0, 0.5)
    const rightEdge = this.add.rectangle(232, 0, 4, 48, OPP).setOrigin(0, 0.5)
    this.domainRound = this.add.text(-218, -17, '', { fontFamily: 'monospace', fontSize: '8px', color: '#78716c', fontStyle: 'bold' })
    this.domainTitle = this.add.text(0, -13, '', { fontFamily: 'monospace', fontSize: '16px', color: '#f5f5f4', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0)
    this.domainArena = this.add.text(0, 9, '', { fontFamily: 'monospace', fontSize: '9px', color: '#a8a29e' }).setOrigin(0.5, 0)
    this.domainBanner = this.add.container(W / 2, 126, [bannerBg, leftEdge, rightEdge, this.domainRound, this.domainTitle, this.domainArena]).setDepth(25)

    this.resultText = this.add.text(W / 2, 382, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#f5f5f4', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(50)
  }

  private formation(side: Side, idx: number, total: number): { x: number; y: number; size: number } {
    if (total <= 1) return { x: side === 'me' ? 178 : W - 178, y: 270, size: 94 }
    const column = total === 2 ? 0 : idx % 2
    const row = total === 2 ? idx : Math.floor(idx / 2)
    const x = side === 'me' ? 126 + column * 92 : W - 126 - column * 92
    const y = 218 + row * 84 + column * 20
    return { x, y, size: total > 4 ? 58 : total > 3 ? 66 : 76 }
  }

  private spawnSquad(side: Side, squad: Harness[]) {
    const views = side === 'me' ? this.myFighters : this.oppFighters
    squad.forEach((harness, idx) => {
      const agent = agentById(harness.agentId)
      const pos = this.formation(side, idx, squad.length)
      const shadow = this.add.ellipse(0, pos.size * 0.38, pos.size * 0.88, pos.size * 0.2, side === 'me' ? ME : OPP, 0.16)
      const sprite = this.add.sprite(0, 0, this.ensureAgentTexture(harness)).setDisplaySize(pos.size, pos.size).setFlipX(side === 'opp')
      const name = this.add.text(0, pos.size * 0.5 - 1, safeName(agent.name, 13), {
        fontFamily: 'monospace', fontSize: squad.length > 4 ? '7px' : '8px', color: side === 'me' ? '#fca5a5' : '#93c5fd', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 0)
      const role = this.add.text(0, pos.size * 0.5 + 10, agent.role.toUpperCase(), { fontFamily: 'monospace', fontSize: '6px', color: '#78716c' }).setOrigin(0.5, 0)
      const root = this.add.container(side === 'me' ? -120 : W + 120, pos.y, [shadow, sprite, name, role]).setDepth(10 + idx)
      const view: FighterView = { root, sprite, baseX: pos.x, baseY: pos.y, harness, side }
      views.push(view)

      const arrive = () => {
        root.setPosition(pos.x, pos.y)
        if (!this.reducedMotion) this.tweens.add({ targets: root, y: pos.y - 3, duration: 850 + idx * 90, yoyo: true, repeat: -1, ease: 'sine.inout' })
      }
      if (this.reducedMotion) arrive()
      else this.tweens.add({ targets: root, x: pos.x, duration: 420, delay: idx * 65, ease: 'back.out', onComplete: arrive })
    })
  }

  private buildCards(side: Side, squad: Harness[]) {
    const cards = side === 'me' ? this.myCards : this.oppCards
    const halfX = side === 'me' ? 18 : W / 2 + 10
    const available = W / 2 - 28
    const gap = 5
    const width = squad.length ? Math.min(132, (available - gap * (squad.length - 1)) / squad.length) : available
    this.add.text(halfX, 420, side === 'me' ? 'SEU SQUAD' : 'SQUAD RIVAL', {
      fontFamily: 'monospace', fontSize: '9px', color: side === 'me' ? '#ef4444' : '#3b82f6', fontStyle: 'bold',
    })

    if (!squad.length) {
      this.add.text(halfX, 455, 'SEM HARNESS', { fontFamily: 'monospace', fontSize: '11px', color: '#57534e' })
      return
    }

    squad.forEach((harness, idx) => {
      const agent = agentById(harness.agentId)
      const model = MODELS.find((entry) => entry.id === harness.modelId)?.name ?? harness.modelId
      const x = halfX + idx * (width + gap)
      const bg = this.add.rectangle(0, 0, width, 94, 0x0e0d13, 0.97).setOrigin(0).setStrokeStyle(1, 0x292524)
      const accent = this.add.rectangle(0, 0, 3, 94, side === 'me' ? ME : OPP).setOrigin(0)
      const icon = this.add.image(9, 8, this.ensureAgentTexture(harness)).setOrigin(0).setDisplaySize(34, 34).setFlipX(side === 'opp')
      const status = this.add.text(width - 6, 7, '', { fontFamily: 'monospace', fontSize: '7px', color: '#fbbf24', fontStyle: 'bold' }).setOrigin(1, 0)
      const name = this.add.text(8, 47, safeName(agent.name, Math.max(7, Math.floor(width / 7))), { fontFamily: 'monospace', fontSize: '8px', color: '#f5f5f4', fontStyle: 'bold' })
      const modelText = this.add.text(8, 61, safeName(model, Math.max(8, Math.floor(width / 6.5))), { fontFamily: 'monospace', fontSize: '7px', color: '#a8a29e' })
      const effort = this.add.text(8, 76, `${harness.effort.toUpperCase()} · ${agent.role.toUpperCase()}`, { fontFamily: 'monospace', fontSize: '6px', color: '#57534e' })
      const root = this.add.container(x, 438, [bg, accent, icon, status, name, modelText, effort]).setDepth(30)
      cards.push({ root, bg, status })
    })
  }

  private bindBridge() {
    this.offBridge.push(
      bridge.on('pvp:timer', (payload) => this.onTimer(payload as PvpArenaTimer)),
      bridge.on('pvp:pick', (payload) => this.onPick(payload as PvpArenaPick)),
      bridge.on('pvp:reveal', (payload) => this.onReveal(payload as PvpArenaReveal)),
      bridge.on('pvp:end', (payload) => this.onEnd(payload as PvpArenaEnd)),
    )
  }

  private onTimer(payload: PvpArenaTimer) {
    if (this.ending || !payload || !Number.isFinite(payload.seconds)) return
    const roundChanged = payload.round !== this.currentRound
    this.currentRound = Math.max(0, payload.round)
    const domain = payload.domain ?? this.params.domains[this.currentRound]
    if (domain && (roundChanged || domain !== this.currentDomain)) {
      this.showDomain(domain, this.currentRound)
      this.resetSelection()
      this.resultText.setText('')
    }

    this.locked = payload.locked
    const total = Math.max(1, payload.total)
    const ratio = Phaser.Math.Clamp(payload.seconds / total, 0, 1)
    const width = (TIMER_W - 2) * ratio
    this.tweens.killTweensOf(this.timerFill)
    if (this.reducedMotion) this.timerFill.displayWidth = width
    else this.tweens.add({ targets: this.timerFill, displayWidth: width, duration: 180, ease: 'linear' })
    this.timerFill.fillColor = payload.seconds <= 5 ? ME : payload.locked ? 0x22c55e : 0xfbbf24
    this.timerText.setColor(payload.seconds <= 5 ? '#ef4444' : payload.locked ? '#4ade80' : '#fbbf24')
    this.timerText.setText(payload.locked ? 'LOCKED' : `${Math.max(0, Math.ceil(payload.seconds))}s`)
    this.stateText.setText(payload.locked ? 'HARNESS DESPACHADO · ESPERANDO RIVAL' : 'ESCOLHA UM HARNESS NO PAINEL')
  }

  private onPick(payload: PvpArenaPick) {
    if (this.ending || !payload || !Number.isInteger(payload.idx) || !this.myFighters[payload.idx]) return
    this.selectedIdx = payload.idx
    this.locked = true
    chiptune.confirm()
    this.setCardSelection(this.myCards, payload.idx, ME, 'LOCK')
    this.focusFighter(this.myFighters, payload.idx)
    this.timerFill.fillColor = 0x22c55e
    this.timerText.setColor('#4ade80').setText('LOCKED')
    this.stateText.setText('HARNESS DESPACHADO · ESPERANDO RIVAL')
  }

  private onReveal(payload: PvpArenaReveal) {
    if (this.ending || !payload || !Number.isInteger(payload.round)) return
    this.revealQueue.push(payload)
    this.endGate?.remove(false)
    this.endGate = null
    this.pumpQueue()
  }

  private onEnd(payload: PvpArenaEnd) {
    if (this.ending || !payload || (payload.reason !== 'left' && payload.reason !== 'closed')) return
    this.pendingEnd = payload
    this.locked = true
    this.stateText.setText('CONEXÃO ENCERRADA · FINALIZANDO ARENA')
    // One short gate lets a reveal already dispatched in the same frame enter
    // the queue first; active/queued reveals always win over this end event.
    this.endGate?.remove(false)
    this.endGate = this.time.delayedCall(this.ms(90), () => {
      this.endGate = null
      this.pumpQueue()
    })
  }

  private pumpQueue() {
    if (this.busy || this.ending) return
    const reveal = this.revealQueue.shift()
    if (reveal) {
      this.busy = true
      this.animateReveal(reveal)
      return
    }
    if (this.pendingEnd) {
      const end = this.pendingEnd
      this.pendingEnd = null
      this.playLeftCutscene(end)
    }
  }

  private animateReveal(reveal: PvpArenaReveal) {
    this.currentRound = reveal.round
    this.showDomain(reveal.domain, reveal.round)
    this.locked = true
    this.stateText.setText('PICKS REVELADOS · RESOLVENDO CLASH')
    this.setCardSelection(this.myCards, reveal.my.idx, ME, reveal.my.rate ? '429' : 'GO')
    this.setCardSelection(this.oppCards, reveal.opp.idx, OPP, reveal.opp.rate ? '429' : 'GO')
    this.focusFighter(this.myFighters, reveal.my.idx)
    this.focusFighter(this.oppFighters, reveal.opp.idx)
    chiptune.confirm()

    const mine = this.myFighters[reveal.my.idx]
    const theirs = this.oppFighters[reveal.opp.idx]
    this.after(180, () => {
      if (reveal.my.rate && mine) this.showRateLimit(mine)
      if (reveal.opp.rate && theirs) this.showRateLimit(theirs)
      if (!reveal.my.rate && mine) this.dash(mine)
      if (!reveal.opp.rate && theirs) this.dash(theirs)
    })

    this.after(500, () => {
      if (!reveal.my.rate && mine) this.launchProjectile(mine, ME)
      if (!reveal.opp.rate && theirs) this.launchProjectile(theirs, OPP)
    })

    this.after(780, () => {
      this.impactBurst(reveal.my.score === reveal.opp.score ? 0xf5f5f4 : reveal.my.score > reveal.opp.score ? ME : OPP)
      if (reveal.my.score === reveal.opp.score) chiptune.hit()
      else chiptune.superHit()
      if (reveal.my.score < reveal.opp.score && mine) this.hurt(mine)
      if (reveal.opp.score < reveal.my.score && theirs) this.hurt(theirs)
    })

    this.after(920, () => {
      this.floatScore(mine?.root.x ?? 285, mine?.root.y ?? 250, reveal.my.score, reveal.my.rate ? '#ef4444' : '#fca5a5')
      this.floatScore(theirs?.root.x ?? W - 285, theirs?.root.y ?? 250, reveal.opp.score, reveal.opp.rate ? '#ef4444' : '#93c5fd')
      const verdict = reveal.my.score > reveal.opp.score
        ? `PONTO · ${safeName(this.params.me.name, 22)}`
        : reveal.opp.score > reveal.my.score
          ? `PONTO · ${safeName(this.params.opp.name, 22)}`
          : 'CLASH EMPATADO'
      this.resultText.setText(verdict).setColor(reveal.my.score > reveal.opp.score ? '#ef4444' : reveal.opp.score > reveal.my.score ? '#3b82f6' : '#f5f5f4').setAlpha(1)
    })

    this.after(1210, () => this.updateScore(reveal.myWins, reveal.oppWins, true))
    this.after(1580, () => {
      this.restoreFormation()
      this.params.myWins = reveal.myWins
      this.params.oppWins = reveal.oppWins
      if (reveal.final) {
        const outcome = reveal.outcome ?? (reveal.myWins > reveal.oppWins ? 'win' : reveal.oppWins > reveal.myWins ? 'loss' : 'draw')
        this.playOutcomeCutscene(outcome)
        return
      }

      this.busy = false
      bridge.emit('pvp:round-complete', { round: reveal.round })
      this.pumpQueue()
    })
  }

  private showDomain(domain: Domain, round: number, immediate = false) {
    const info = DOMAIN_INFO[domain]
    this.currentDomain = domain
    this.currentRound = round
    this.domainBanner.setVisible(true)
    this.domainRound.setText(`ROUND ${round + 1}/${Math.max(1, this.params.domains.length)}`)
    this.domainTitle.setText(`${info.emoji} ${info.label.toUpperCase()}`)
    this.domainArena.setText(info.arena.toUpperCase())
    this.roundLabel.setText(`RODADA ${round + 1} · ${safeName(info.arena, 20)}`)
    this.tweens.killTweensOf(this.domainBanner)
    if (this.reducedMotion || immediate) {
      this.domainBanner.setPosition(W / 2, 126).setAlpha(1).setScale(1)
      return
    }
    this.domainBanner.setPosition(W + 260, 126).setAlpha(0).setScale(0.94)
    this.tweens.add({ targets: this.domainBanner, x: W / 2, alpha: 1, scaleX: 1, scaleY: 1, duration: 430, ease: 'back.out' })
  }

  private setCardSelection(cards: FighterCard[], selected: number, color: number, tag: string) {
    cards.forEach((card, idx) => {
      card.bg.setStrokeStyle(idx === selected ? 2 : 1, idx === selected ? color : 0x292524)
      card.bg.setFillStyle(idx === selected ? (color === ME ? 0x211014 : 0x0b162a) : 0x0e0d13, 0.98)
      card.status.setText(idx === selected ? tag : '')
      card.root.setAlpha(idx === selected ? 1 : 0.56)
    })
  }

  private focusFighter(fighters: FighterView[], selected: number) {
    fighters.forEach((fighter, idx) => {
      fighter.root.setAlpha(idx === selected ? 1 : 0.42)
      fighter.root.setScale(idx === selected ? 1.09 : 0.96)
    })
  }

  private resetSelection() {
    this.selectedIdx = null
    this.locked = false
    this.restoreCards(this.myCards)
    this.restoreCards(this.oppCards)
    this.restoreFormation()
  }

  private restoreCards(cards: FighterCard[]) {
    cards.forEach((card) => {
      card.bg.setStrokeStyle(1, 0x292524).setFillStyle(0x0e0d13, 0.97)
      card.status.setText('')
      card.root.setAlpha(1)
    })
  }

  private restoreFormation() {
    for (const fighter of [...this.myFighters, ...this.oppFighters]) {
      fighter.root.x = fighter.baseX
      fighter.root.setScale(1).setAlpha(1)
      fighter.sprite.x = 0
      fighter.sprite.clearTint()
    }
  }

  private dash(fighter: FighterView) {
    const direction = fighter.side === 'me' ? 1 : -1
    this.tweens.add({
      targets: fighter.root,
      x: fighter.baseX + direction * 54,
      scaleX: 1.15,
      scaleY: 0.9,
      duration: this.ms(150),
      yoyo: true,
      ease: 'quad.inout',
    })
  }

  private launchProjectile(fighter: FighterView, color: number) {
    const direction = fighter.side === 'me' ? 1 : -1
    const startX = fighter.root.x + direction * 30
    const startY = fighter.root.y - 8
    const glow = this.add.circle(0, 0, 13, color, 0.18)
    const core = this.add.rectangle(0, 0, 22, 7, color).setStrokeStyle(1, 0xffffff, 0.7)
    const tail = this.add.rectangle(-direction * 16, 0, 22, 3, color, 0.45)
    const projectile = this.add.container(startX, startY, [glow, tail, core]).setDepth(70)
    if (!this.reducedMotion) this.tweens.add({ targets: glow, scale: 1.8, alpha: 0.04, duration: 120, yoyo: true, repeat: 1 })
    this.tweens.add({
      targets: projectile,
      x: W / 2,
      y: 250,
      angle: direction * 12,
      duration: this.ms(260),
      ease: 'quad.in',
      onComplete: () => projectile.destroy(),
    })
  }

  private impactBurst(color: number) {
    if (!this.reducedMotion) this.cameras.main.shake(210, 0.009)
    const flash = this.add.rectangle(0, 0, W, H, 0xffffff, this.reducedMotion ? 0.08 : 0.34).setOrigin(0).setDepth(90).setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({ targets: flash, alpha: 0, duration: this.ms(210), onComplete: () => flash.destroy() })
    const ring = this.add.circle(W / 2, 250, 12, color, 0.25).setStrokeStyle(4, color, 0.9).setDepth(79)
    this.tweens.add({ targets: ring, radius: 72, alpha: 0, duration: this.ms(360), ease: 'quad.out', onComplete: () => ring.destroy() })
    const particles = this.add.particles(W / 2, 250, 'pvp-pixel', {
      speed: { min: 90, max: 260 }, lifespan: this.ms(480), quantity: this.reducedMotion ? 8 : 24,
      scale: { start: 1.35, end: 0 }, tint: [ME, OPP, color, 0xffffff], emitting: false,
    }).setDepth(80)
    particles.explode(this.reducedMotion ? 8 : 24)
    this.after(620, () => particles.destroy())
  }

  private showRateLimit(fighter: FighterView) {
    chiptune.hurt()
    const label = this.add.text(fighter.root.x, fighter.root.y - 55, '429\nRATE LIMIT', {
      align: 'center', fontFamily: 'monospace', fontSize: '13px', color: '#ef4444', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(85)
    fighter.sprite.setTintFill(ME)
    if (!this.reducedMotion) {
      let phase = 0
      this.time.addEvent({
        delay: 42, repeat: 7,
        callback: () => {
          phase++
          fighter.sprite.x = phase % 2 ? -5 : 5
          fighter.sprite.setTintFill(phase % 3 ? ME : 0xffffff)
        },
      })
      const bars = this.add.graphics().setDepth(84)
      bars.fillStyle(ME, 0.5)
      bars.fillRect(fighter.root.x - 42, fighter.root.y - 20, 90, 4)
      bars.fillRect(fighter.root.x - 26, fighter.root.y + 8, 58, 3)
      this.after(430, () => bars.destroy())
    }
    this.after(520, () => {
      if (fighter.sprite.active) { fighter.sprite.x = 0; fighter.sprite.clearTint() }
      this.tweens.add({ targets: label, y: label.y - 25, alpha: 0, duration: this.ms(280), onComplete: () => label.destroy() })
    })
  }

  private hurt(fighter: FighterView) {
    chiptune.hurt()
    fighter.sprite.setTintFill(0xffffff)
    const direction = fighter.side === 'me' ? -1 : 1
    this.tweens.add({
      targets: fighter.root, x: fighter.baseX + direction * 16, angle: direction * 4,
      duration: this.ms(65), yoyo: true, repeat: this.reducedMotion ? 0 : 2,
      onComplete: () => { fighter.root.setAngle(0); fighter.sprite.clearTint() },
    })
  }

  private floatScore(x: number, y: number, score: number, color: string) {
    const text = this.add.text(x, y - 48, `${score}`, {
      fontFamily: 'monospace', fontSize: '28px', color, fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(88)
    this.tweens.add({ targets: text, y: y - 92, alpha: 0, scale: 1.18, duration: this.ms(720), ease: 'quad.out', onComplete: () => text.destroy() })
  }

  private updateScore(myWins: number, oppWins: number, animate: boolean) {
    this.myScore.setText(String(myWins))
    this.oppScore.setText(String(oppWins))
    if (!animate || this.reducedMotion) return
    this.myScore.setScale(1.35); this.oppScore.setScale(1.35)
    this.tweens.add({ targets: [this.myScore, this.oppScore], scale: 1, duration: 260, ease: 'back.out' })
  }

  private playOutcomeCutscene(outcome: 'win' | 'loss' | 'draw') {
    if (this.ending) return
    this.busy = false
    this.ending = true
    this.locked = true
    this.pendingEnd = null
    this.revealQueue = []
    this.timerText.setText('FINAL').setColor('#f5f5f4')
    this.stateText.setText('PLACAR HOMOLOGADO · CUTSCENE FINAL')
    chiptune.setTrack('none')
    if (outcome === 'win') chiptune.victory()
    else if (outcome === 'loss') chiptune.gameover()
    else chiptune.confirm()

    const winners = outcome === 'draw' ? [...this.myFighters, ...this.oppFighters] : outcome === 'win' ? this.myFighters : this.oppFighters
    const losers = outcome === 'draw' ? [] : outcome === 'win' ? this.oppFighters : this.myFighters
    losers.forEach((fighter) => {
      this.tweens.killTweensOf(fighter.root)
      this.tweens.add({ targets: fighter.root, alpha: 0.16, y: fighter.baseY + 15, duration: this.ms(620), ease: 'quad.in' })
    })
    winners.forEach((fighter, idx) => {
      this.tweens.killTweensOf(fighter.root)
      if (this.reducedMotion) fighter.root.setScale(1.08)
      else this.tweens.add({ targets: fighter.root, y: fighter.baseY - 15, scale: 1.13, duration: 180, delay: idx * 70, yoyo: true, repeat: 3, ease: 'quad.out' })
    })

    const shade = this.add.rectangle(0, 98, W, 316, 0x000000, 0).setOrigin(0).setDepth(91)
    this.tweens.add({ targets: shade, alpha: 0.58, duration: this.ms(500) })
    const panelColor = outcome === 'win' ? ME : outcome === 'loss' ? OPP : 0xa8a29e
    const panel = this.add.rectangle(W / 2, 252, 500, 156, 0x050308, 0.96).setStrokeStyle(3, panelColor).setDepth(92).setScale(this.reducedMotion ? 1 : 0.7).setAlpha(this.reducedMotion ? 1 : 0)
    const title = this.add.text(W / 2, 198, outcome === 'win' ? 'VITÓRIA' : outcome === 'loss' ? 'DERROTA' : 'EMPATE', {
      fontFamily: 'monospace', fontSize: '37px', color: outcome === 'win' ? '#ef4444' : outcome === 'loss' ? '#3b82f6' : '#f5f5f4', fontStyle: 'bold', stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(93).setAlpha(this.reducedMotion ? 1 : 0)
    const score = this.add.text(W / 2, 249, `${this.params.myWins}  ×  ${this.params.oppWins}`, { fontFamily: 'monospace', fontSize: '27px', color: '#f5f5f4', fontStyle: 'bold' }).setOrigin(0.5).setDepth(93).setAlpha(this.reducedMotion ? 1 : 0)
    const subtitle = this.add.text(W / 2, 294, outcome === 'draw' ? 'SQUADS EQUILIBRADOS' : `${safeName(outcome === 'win' ? this.params.me.name : this.params.opp.name, 28)} DOMINA A ARENA`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#a8a29e', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(93).setAlpha(this.reducedMotion ? 1 : 0)
    if (!this.reducedMotion) {
      this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 430, ease: 'back.out' })
      this.tweens.add({ targets: [title, score, subtitle], alpha: 1, duration: 320, delay: 180 })
    }
    this.after(1750, () => {
      this.stateText.setText('REVANCHE E SAÍDA DISPONÍVEIS NO PAINEL')
      this.emitCutscene({ outcome })
    })
  }

  private playLeftCutscene(end: PvpArenaEnd) {
    if (this.ending) return
    this.ending = true
    this.locked = true
    this.updateScore(end.myWins, end.oppWins, true)
    this.params.myWins = end.myWins
    this.params.oppWins = end.oppWins
    chiptune.setTrack('none')
    chiptune.hurt()
    chiptune.gameover()
    const connectionLost = end.reason === 'closed'
    this.timerText.setText('OFFLINE').setColor('#ef4444')
    this.stateText.setText(connectionLost ? 'CONEXÃO PERDIDA · PLACAR PRESERVADO' : 'RIVAL DESCONECTOU · PLACAR PRESERVADO')

    this.oppFighters.forEach((fighter, idx) => {
      this.tweens.killTweensOf(fighter.root)
      fighter.sprite.setTintFill(ME)
      this.tweens.add({ targets: fighter.root, x: fighter.baseX + (idx % 2 ? -8 : 8), alpha: 0.1, duration: this.ms(520), ease: 'quad.in' })
    })
    const shade = this.add.rectangle(0, 98, W, 316, 0x000000, 0.62).setOrigin(0).setDepth(91)
    const panel = this.add.rectangle(W / 2, 252, 510, 150, 0x050308, 0.97).setStrokeStyle(3, ME).setDepth(92)
    const title = this.add.text(W / 2, 208, connectionLost ? 'CONEXÃO PERDIDA' : 'RIVAL DESCONECTOU', { fontFamily: 'monospace', fontSize: '27px', color: '#ef4444', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setDepth(93)
    const score = this.add.text(W / 2, 256, `${end.myWins}  ×  ${end.oppWins}`, { fontFamily: 'monospace', fontSize: '26px', color: '#f5f5f4', fontStyle: 'bold' }).setOrigin(0.5).setDepth(93)
    const info = this.add.text(W / 2, 296, connectionLost ? 'O SOCKET FECHOU ANTES DO PRÓXIMO CLASH' : 'A CONEXÃO TERMINOU ANTES DO PRÓXIMO CLASH', { fontFamily: 'monospace', fontSize: '9px', color: '#a8a29e' }).setOrigin(0.5).setDepth(93)
    if (!this.reducedMotion) {
      panel.setScale(0.75); title.setAlpha(0); score.setAlpha(0); info.setAlpha(0); shade.setAlpha(0)
      this.tweens.add({ targets: shade, alpha: 0.62, duration: 300 })
      this.tweens.add({ targets: panel, scale: 1, duration: 390, ease: 'back.out' })
      this.tweens.add({ targets: [title, score, info], alpha: 1, delay: 170, duration: 300 })
    }
    this.after(1300, () => this.emitCutscene({ reason: end.reason }))
  }

  private emitCutscene(payload: { outcome: 'win' | 'loss' | 'draw' } | { reason: 'left' | 'closed' }) {
    if (this.cutsceneSent) return
    this.cutsceneSent = true
    bridge.emit('pvp:cutscene-complete', payload)
  }

  private after(delay: number, callback: () => void) {
    this.time.delayedCall(this.ms(delay), callback)
  }

  private ms(duration: number): number {
    return this.reducedMotion ? Math.max(18, Math.round(duration * 0.12)) : duration
  }

  private cleanup = () => {
    if (this.cleaned) return
    this.cleaned = true
    for (const off of this.offBridge.splice(0)) off()
    this.endGate?.remove(false)
    this.endGate = null
    chiptune.setTrack('none')
  }
}
