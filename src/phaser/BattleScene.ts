/**
 * BATALHA ÚNICA estilo Chrono Trigger + orquestrador Heroes-style.
 * Missão multi-fase nasce MONOLITO: atacar sem decompor = agente afogado (20% dano).
 * O CLOCKINHO (slot 0) age como o herói de Heroes: nunca ataca, orquestra —
 *   todo_manager (DECOMPOR o monolito em atividades) · agent_invoke (reserva entra) ·
 *   handoff_list (sincronizar/limpar 429) · re-harness (trocar modelo/effort em campo).
 * Passivo: forma do mascote buffa o squad (+5%/estágio).
 */
import Phaser from 'phaser'
import { agentById } from '../data/agents'
import { skillById } from '../data/skills'
import { missionById, taskAsMission, type SquadMission } from '../data/missions'
import { MODELS, type EffortId } from '../data/models'
import {
  squadAttack, squadScout, squadSeal, orchDecompose, orchInvoke, orchSync, orchReharness, orchDismiss, orchParallel,
  frontIndex, isAvailable, actionCost, upkeepCost, type SquadBattleState, type SquadTurnResult, type ParallelHit,
} from '../engine/squadBattle'
import { makeSprites, makeMascotTextures, clockKey } from './textures'
import { bridge, type BattleParams } from './bridge'
import { chiptune } from '../audio/chiptune'
import type { Harness } from '../engine/battle'

const W = 918, H = 560
type Step = 'member' | 'action' | 'target' | 'busy'
type TargetMode = 'enemy' | 'member'

interface ActionOpt {
  kind: 'skill' | 'scout' | 'seal' | 'decompose' | 'invoke' | 'sync' | 'model' | 'effort' | 'dismiss' | 'parallel'
  skillId?: string
  reserve?: Harness
  modelId?: string
  effort?: EffortId
  label: string
  detail: string
}

export class BattleScene extends Phaser.Scene {
  private battle!: SquadBattleState
  private mission!: SquadMission
  private params!: BattleParams
  private enemyGroup: Phaser.GameObjects.GameObject[] = []
  private enemies: (Phaser.GameObjects.Sprite | null)[] = []
  private enemyBars: Phaser.GameObjects.Rectangle[] = []
  private enemyLabels: Phaser.GameObjects.Text[] = []
  private monolith: Phaser.GameObjects.Sprite | null = null
  private monolithBar: Phaser.GameObjects.Rectangle | null = null
  private clock!: Phaser.GameObjects.Sprite
  private members: Phaser.GameObjects.Sprite[] = []
  private cardBar!: Phaser.GameObjects.Container
  private memberCards: Phaser.GameObjects.Container[] = []
  private budgetTxt!: Phaser.GameObjects.Text
  private budgetBar!: Phaser.GameObjects.Rectangle
  private msg!: Phaser.GameObjects.Text
  private cursor!: Phaser.GameObjects.Text
  private hintTxt!: Phaser.GameObjects.Text
  private actionTexts: Phaser.GameObjects.Text[] = []
  private step: Step = 'busy'
  private mIdx = 0 // 0 = orquestrador; membros = 1..N
  private aIdx = 0
  private tIdx = 0
  private targetMode: TargetMode = 'enemy'
  private actions: ActionOpt[] = []
  private queue: string[] = []
  private typing = false
  private ended = false

  constructor() { super('Battle') }

  create(params: BattleParams) {
    makeSprites(this)
    makeMascotTextures(this)
    this.params = params
    this.ended = false
    this.queue = []
    this.enemies = []; this.enemyBars = []; this.enemyLabels = []; this.members = []; this.memberCards = []
    this.monolith = null; this.monolithBar = null
    this.mission = params.missionId ? missionById(params.missionId) : taskAsMission(params.taskId!)
    this.battle = {
      mission: this.mission,
      phases: this.mission.phases.map((def) => ({ def, hp: def.hp, revealed: !def.hidden, done: false, sealed: false, regressed: false })),
      party: [...params.party], budget: params.budget, spent: 0, turn: 1, lastActor: null, contextBuff: 0,
      outcome: 'ongoing', log: [], formBonus: params.formBonus ?? 0,
      decomposed: this.mission.phases.length === 1,
    }
    chiptune.setTrack('battle')

    // ── cenário ──
    const g = this.add.graphics()
    g.fillGradientStyle(0x16081f, 0x16081f, 0x06070c, 0x06070c, 1)
    g.fillRect(0, 0, W, H)
    g.lineStyle(1, 0xef4444, 0.13)
    for (let i = 0; i <= 12; i++) { const yy = H * 0.5 + i * i * 1.9; if (yy > H) break; g.moveTo(0, yy); g.lineTo(W, yy) }
    for (let i = 0; i <= 20; i++) { const xx = (i / 20) * W; g.moveTo(W / 2 + (xx - W / 2) * 0.5, H * 0.5); g.lineTo(xx, H) }
    g.strokePath()
    for (let i = 0; i < 26; i++) this.add.circle((i * 137) % W, (i * 61) % (H * 0.4), i % 3 === 0 ? 1.6 : 1, i % 4 === 0 ? 0xef4444 : 0x6b7280, 0.55)

    // ── inimigo: monolito OU fases ──
    if (this.battle.decomposed) this.spawnPhases()
    else this.spawnMonolith()

    // ── clockinho (orquestrador) + membros ──
    this.clock = this.add.sprite(-80, 120, clockKey(bridge.ctx.form, 'idle', 0)).setDisplaySize(62, 62)
    this.tweens.add({ targets: this.clock, x: 74, duration: 500, ease: 'back.out' })
    let ci = 0
    this.time.addEvent({ delay: 260, loop: true, callback: () => { ci = (ci + 1) % 4; this.clock.setTexture(clockKey(bridge.ctx.form, 'idle', ci)) } })
    this.params.party.forEach((h, i) => this.spawnMemberSprite(h, i, true))

    // ── faixa de UI inferior ──
    this.add.rectangle(0, H - 168, W, 168, 0x0a0810, 0.92).setOrigin(0)
    this.add.rectangle(0, H - 168, W, 2, 0x292524).setOrigin(0)
    this.rebuildCards()

    this.add.text(24, H - 92, 'BUDGET', { fontFamily: 'monospace', fontSize: '9px', color: '#57534e', fontStyle: 'bold' })
    this.add.rectangle(80, H - 89, 180, 8, 0x000000).setOrigin(0, 0.5).setStrokeStyle(1, 0x292524)
    this.budgetBar = this.add.rectangle(81, H - 89, 178, 6, 0xfbbf24).setOrigin(0, 0.5)
    this.budgetTxt = this.add.text(268, H - 95, '', { fontFamily: 'monospace', fontSize: '11px', color: '#fbbf24' })
    this.updateBudget()

    this.msg = this.add.text(24, H - 72, '', { fontFamily: 'monospace', fontSize: '14px', color: '#f5f5f4', wordWrap: { width: W - 48 } }).setDepth(11)
    this.hintTxt = this.add.text(W - 24, H - 14, '', { fontFamily: 'monospace', fontSize: '10px', color: '#57534e' }).setOrigin(1, 1).setDepth(11)
    this.cursor = this.add.text(0, 0, '▸', { fontFamily: 'monospace', fontSize: '16px', color: '#fbbf24', fontStyle: 'bold' }).setDepth(20).setVisible(false)

    const kb = this.input.keyboard!
    kb.on('keydown-LEFT', () => this.nav(-1))
    kb.on('keydown-RIGHT', () => this.nav(1))
    kb.on('keydown-UP', () => this.nav(-1))
    kb.on('keydown-DOWN', () => this.nav(1))
    const conf = () => this.confirm()
    kb.on('keydown-E', conf)
    kb.on('keydown-ENTER', conf)
    kb.on('keydown-SPACE', conf)
    kb.on('keydown-ESC', () => this.cancel())
    kb.on('keydown-BACKSPACE', () => this.cancel())

    this.cameras.main.fadeIn(300)
    const intro = [this.mission.intro]
    if (!this.battle.decomposed) intro.push(`"${this.mission.name}" é um MONOLITO — escopo gigante. Selecione o ORQUESTRADOR e use todo_manager: DECOMPOR.`)
    this.pushMsg(intro)
  }

  // ── spawn de inimigos ────────────────────────────────────────────────────
  private spawnMonolith() {
    const domain = this.mission.phases.reduce((a, b) => (a.hp > b.hp ? a : b)).domain
    this.add.ellipse(W - 250, 300, 300, 62, 0xef4444, 0.12)
    this.monolith = this.add.sprite(W + 260, 208, `enemy-${domain}`).setDisplaySize(260, 260)
    this.tweens.add({ targets: this.monolith, x: W - 250, duration: 650, ease: 'back.out' })
    this.tweens.add({ targets: this.monolith, displayWidth: 274, displayHeight: 274, duration: 1300, yoyo: true, repeat: -1, ease: 'sine.inout', delay: 700 })
    const total = this.mission.phases.reduce((s, p) => s + p.hp, 0)
    this.add.text(W - 250, 52, this.mission.name.toUpperCase(), { fontFamily: 'monospace', fontSize: '15px', color: '#f5f5f4', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setName('monolabel')
    this.add.rectangle(W - 250 - 90, 70, 180, 9, 0x000).setOrigin(0, 0.5).setStrokeStyle(1, 0x292524).setName('monobarbg')
    this.monolithBar = this.add.rectangle(W - 250 - 89, 70, 178, 7, 0xef4444).setOrigin(0, 0.5)
    this.add.text(W - 250, 84, `MONOLITO · ${total} HP total · decomponha!`, { fontFamily: 'monospace', fontSize: '9px', color: '#a8a29e' }).setOrigin(0.5).setName('monosub')
  }

  private spawnPhases() {
    this.mission.phases.forEach((p, i) => {
      const pos = this.enemyPos(i, this.mission.phases.length)
      const st = this.battle.phases[i]
      this.add.ellipse(pos.x, pos.y + 46, 120, 26, 0xef4444, 0.10)
      const spr = this.add.sprite(W + 160, pos.y, `enemy-${p.domain}`).setDisplaySize(pos.size, pos.size)
      if (!st.revealed) spr.setVisible(false)
      if (st.done) spr.setAlpha(st.sealed ? 0.22 : 0.45)
      this.tweens.add({ targets: spr, x: pos.x, duration: 520, ease: 'back.out', delay: i * 90 })
      this.tweens.add({ targets: spr, y: pos.y - 5, duration: 1000 + i * 130, yoyo: true, repeat: -1, ease: 'sine.inout', delay: 600 })
      this.enemies.push(spr)
      const label = this.add.text(pos.x, pos.y - pos.size / 2 - 22, st.revealed ? p.name.toUpperCase() : '???', { fontFamily: 'monospace', fontSize: '11px', color: '#f5f5f4', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5)
      this.enemyLabels.push(label)
      const barBg = this.add.rectangle(pos.x - 42, pos.y - pos.size / 2 - 10, 84, 7, 0x000000).setOrigin(0, 0.5).setStrokeStyle(1, 0x292524)
      const bar = this.add.rectangle(pos.x - 41, pos.y - pos.size / 2 - 10, 82 * (st.hp / p.hp), 5, 0x4ade80).setOrigin(0, 0.5)
      if (!st.revealed) bar.setVisible(false)
      this.enemyBars.push(bar)
      this.enemyGroup.push(spr, label, barBg, bar)
    })
  }

  private enemyPos(i: number, total: number) {
    if (total === 1) return { x: W - 230, y: 210, size: 150 }
    const col = i % 2, row = Math.floor(i / 2)
    return { x: W - 190 - col * 150 - row * 20, y: 128 + row * 90 + col * 28, size: 88 }
  }

  private memberPos(i: number) {
    return { x: 168 + (i % 2) * 78, y: 128 + i * 58 }
  }

  private spawnMemberSprite(h: Harness, i: number, entrance: boolean) {
    const a = agentById(h.agentId)
    const pos = this.memberPos(i)
    this.add.ellipse(pos.x, pos.y + 38, 92, 22, 0x38bdf8, 0.08)
    const spr = this.add.sprite(entrance ? -120 : pos.x, pos.y, `bot-${a.role}`).setDisplaySize(80, 80)
    if (entrance) this.tweens.add({ targets: spr, x: pos.x, duration: 500, ease: 'back.out', delay: 120 + i * 90 })
    this.members.push(spr)
  }

  /** Cartões: slot 0 = ORQUESTRADOR (clockinho), depois membros. */
  private rebuildCards() {
    this.memberCards.forEach((c) => c.destroy())
    this.memberCards = []
    const total = this.battle.party.length + 1
    const cw = Math.min(206, (W - 48) / total - 8)
    // cartão do orquestrador
    {
      const card = this.add.container(24, H - 156).setDepth(10)
      const bg = this.add.rectangle(0, 0, cw, 54, 0x1a1020).setOrigin(0).setStrokeStyle(2, 0x7c3aed)
      const nm = this.add.text(10, 8, '🎼 ORQUESTRADOR', { fontFamily: 'monospace', fontSize: '11px', color: '#e9d5ff', fontStyle: 'bold' })
      const info = this.add.text(10, 26, `você · forma ${bridge.ctx.form} · squad +${Math.round((this.battle.formBonus ?? 0) * 100)}%`, { fontFamily: 'monospace', fontSize: '9px', color: '#a78bfa' })
      card.add([bg, nm, info])
      this.memberCards.push(card)
    }
    this.battle.party.forEach((h, i) => {
      const a = agentById(h.agentId)
      const m = MODELS.find((mm) => mm.id === h.modelId)!
      const cx = 24 + (i + 1) * (cw + 8)
      const card = this.add.container(cx, H - 156).setDepth(10)
      const bg = this.add.rectangle(0, 0, cw, 54, 0x14141c).setOrigin(0).setStrokeStyle(2, 0x292524)
      const nm = this.add.text(10, 8, a.name.toUpperCase().slice(0, 19), { fontFamily: 'monospace', fontSize: '10px', color: '#f5f5f4', fontStyle: 'bold' })
      const info = this.add.text(10, 26, `${m.name}·${h.effort} · ${actionCost(h)}t`, { fontFamily: 'monospace', fontSize: '9px', color: '#57534e' })
      const roleTag = this.add.text(cw - 8, 8, a.role, { fontFamily: 'monospace', fontSize: '8px', color: '#a8a29e' }).setOrigin(1, 0)
      card.add([bg, nm, info, roleTag])
      this.memberCards.push(card)
    })
  }

  private updateBudget() {
    const b = this.battle
    const pct = Math.max(0, Math.min(1, b.budget / Math.max(1, b.budget + b.spent)))
    this.tweens.add({ targets: this.budgetBar, displayWidth: 178 * pct, duration: 350 })
    this.budgetBar.fillColor = pct > 0.4 ? 0xfbbf24 : pct > 0.15 ? 0xd97706 : 0xef4444
    this.budgetTxt.setText(`${b.budget} tok · gasto ${b.spent} · turno ${b.turn} · 🔥upkeep ${upkeepCost(b)}/turno`)
  }

  private refreshEnemies(hitIdx = -1, superHit = false) {
    if (!this.battle.decomposed && this.monolithBar) {
      const total = this.mission.phases.reduce((s, p) => s + p.hp, 0)
      const cur = this.battle.phases.reduce((s, p) => s + p.hp, 0)
      this.tweens.add({ targets: this.monolithBar, displayWidth: 178 * (cur / total), duration: 400 })
      if (hitIdx >= 0 && this.monolith) {
        this.tweens.add({ targets: this.monolith, x: this.monolith.x + 10, duration: 60, yoyo: true, repeat: 2 })
        const px = this.add.particles(this.monolith.x, this.monolith.y, 'px', { speed: { min: 60, max: 160 }, lifespan: 380, quantity: 8, scale: { start: 1, end: 0 }, tint: 0x9ca3af, emitting: false })
        px.explode(8)
        this.time.delayedCall(500, () => px.destroy())
      }
      return
    }
    this.battle.phases.forEach((p, i) => {
      const spr = this.enemies[i]
      if (!spr) return
      const bar = this.enemyBars[i]
      const label = this.enemyLabels[i]
      if (p.revealed && !spr.visible) {
        spr.setVisible(true).setAlpha(0)
        this.tweens.add({ targets: spr, alpha: 1, duration: 400 })
        bar.setVisible(true)
        label.setText(p.def.name.toUpperCase())
      }
      const pct = Math.max(0, p.hp / p.def.hp)
      this.tweens.add({ targets: bar, displayWidth: 82 * pct, duration: 400 })
      bar.fillColor = pct > 0.5 ? 0x4ade80 : pct > 0.2 ? 0xd97706 : 0xef4444
      if (p.done) {
        spr.setAlpha(p.sealed ? 0.22 : 0.45)
        if (p.sealed) spr.setTint(0x8b5cf6)
        label.setText(`${p.def.name.toUpperCase()} ${p.sealed ? '🛡' : '⚠'}`)
      } else if (spr.alpha < 1 && p.revealed) {
        spr.setAlpha(1).clearTint()
      }
      if (i === hitIdx) {
        this.tweens.add({ targets: spr, x: spr.x + 12, duration: 60, yoyo: true, repeat: 2 })
        const px = this.add.particles(spr.x, spr.y, 'px', { speed: { min: 80, max: 220 }, lifespan: 420, quantity: 16, scale: { start: 1.3, end: 0 }, tint: superHit ? 0xfde047 : 0xffffff, emitting: false })
        px.explode(16)
        this.time.delayedCall(600, () => px.destroy())
      }
    })
  }

  /** DECOMPOR: monolito estilhaça → fases entram em formação. */
  private shatterMonolith() {
    chiptune.superHit()
    this.cameras.main.shake(360, 0.012)
    this.cameras.main.flash(220, 255, 255, 255)
    if (this.monolith) {
      const px = this.add.particles(this.monolith.x, this.monolith.y, 'px', { speed: { min: 120, max: 360 }, lifespan: 700, quantity: 60, scale: { start: 2, end: 0 }, tint: [0xef4444, 0xf5f5f4, 0xfbbf24], emitting: false })
      px.explode(60)
      this.time.delayedCall(900, () => px.destroy())
      this.monolith.destroy()
      this.monolith = null
    }
    this.monolithBar?.destroy(); this.monolithBar = null
    this.children.getByName('monolabel')?.destroy()
    this.children.getByName('monobarbg')?.destroy()
    this.children.getByName('monosub')?.destroy()
    this.time.delayedCall(300, () => this.spawnPhases())
  }

  private floatText(x: number, y: number, txt: string, color: string) {
    const t = this.add.text(x, y, txt, { fontFamily: 'monospace', fontSize: '24px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(30)
    this.tweens.add({ targets: t, y: y - 44, alpha: 0, duration: 950, ease: 'quad.out', onComplete: () => t.destroy() })
  }

  // ── fluxo: membro → ação → alvo ──────────────────────────────────────────
  private beginMemberSelect() {
    this.step = 'member'
    this.clearActionMenu()
    this.msg.setText('')
    this.hintTxt.setText('◂ ▸ membro · E confirma')
    this.mIdx = Math.min(this.mIdx, this.battle.party.length)
    this.highlightMember()
  }
  private highlightMember() {
    this.memberCards.forEach((c, i) => {
      const bg = c.list[0] as Phaser.GameObjects.Rectangle
      if (i === 0) { bg.setStrokeStyle(2, this.mIdx === 0 ? 0xfbbf24 : 0x7c3aed); return }
      const cooling = this.battle.lastActor === this.battle.party[i - 1].agentId && this.battle.party.length > 1
      bg.setStrokeStyle(2, i === this.mIdx ? 0xfbbf24 : cooling ? 0x7c2d12 : 0x292524)
    })
    const card = this.memberCards[this.mIdx]
    this.cursor.setVisible(true).setPosition(card.x - 16, card.y + 18)
    const spr = this.mIdx === 0 ? this.clock : this.members[this.mIdx - 1]
    if (spr) this.tweens.add({ targets: spr, displayWidth: spr.displayWidth + 8, displayHeight: spr.displayHeight + 8, duration: 110, yoyo: true })
  }

  private beginActionSelect() {
    this.actions = []
    if (this.mIdx === 0) {
      // AÇÕES DO ORQUESTRADOR
      if (!this.battle.decomposed) this.actions.push({ kind: 'decompose', label: '⚡ todo_manager: DECOMPOR', detail: 'quebra a missão nas suas atividades — o golpe-assinatura do orquestrador' })
      if (this.battle.decomposed && this.battle.party.length >= 2) {
        const openNow = this.battle.phases.filter((_, i) => isAvailable(this.battle, i)).length
        const costAll = this.battle.party.reduce((s, h) => s + actionCost(h), 0)
        this.actions.push({ kind: 'parallel', label: '🚀 squad_spawn: DESPACHO PARALELO', detail: `TODOS atacam suas frentes num turno · ${openNow} fase${openNow > 1 ? 's' : ''} aberta${openNow > 1 ? 's' : ''} na onda · custo ${costAll}t` })
      }
      const inField = new Set(this.battle.party.map((h) => h.agentId))
      const reserves = (this.params.reserves ?? []).filter((r) => !inField.has(r.agentId))
      if (this.battle.party.length < 4) {
        reserves.slice(0, 4).forEach((r) => {
          const a = agentById(r.agentId)
          this.actions.push({ kind: 'invoke', reserve: r, label: `agent_invoke: ${a.name}`, detail: `${a.role} entra em campo · ${actionCost(r)}t/ação` })
        })
      }
      this.actions.push({ kind: 'sync', label: 'handoff_list: sincronizar', detail: 'limpa rate-limit do squad · próximos 2 golpes +40%' })
      if (this.battle.party.length > 1) {
        this.actions.push({ kind: 'dismiss', label: 'pane_close: dispensar', detail: `membro sai de campo — corta upkeep (hoje ${upkeepCost(this.battle)} tok/turno). Não gasta turno.` })
      }
      const models = this.params.unlockedModels ?? []
      models.forEach((mid) => {
        const m = MODELS.find((mm) => mm.id === mid)!
        this.actions.push({ kind: 'model', modelId: mid, label: `re-harness → ${m.name}`, detail: `troca o MODELO de um membro em campo · ${m.costPerTurn}t/ação` })
      })
      ;(['low', 'medium', 'high'] as EffortId[]).forEach((e) => {
        this.actions.push({ kind: 'effort', effort: e, label: `re-harness → effort ${e}`, detail: 'troca o EFFORT de um membro em campo' })
      })
    } else {
      const h = this.battle.party[this.mIdx - 1]
      const a = agentById(h.agentId)
      this.actions = h.skillIds.map((sid) => {
        const s = skillById(sid)
        return { kind: 'skill' as const, skillId: sid, label: s.name, detail: s.desc }
      })
      if (a.role === 'scout') this.actions.push({ kind: 'scout', label: '🔎 reconhecimento', detail: 'revela atividades ocultas · +40% nos 2 próximos golpes' })
      if (a.role === 'reviewer' && this.battle.phases.some((p) => p.done && !p.sealed)) {
        this.actions.push({ kind: 'seal', label: '🛡 selar entrega', detail: 'atividade concluída não regride (verification-before-completion)' })
      }
    }
    this.step = 'action'
    this.aIdx = 0
    this.renderActionMenu()
    this.hintTxt.setText('◂ ▸ ação · E confirma · ESC volta')
  }
  private renderActionMenu() {
    this.clearActionMenu()
    const perCol = 3
    this.actions.forEach((opt, i) => {
      const col = i % perCol, row = Math.floor(i / perCol)
      const t = this.add.text(40 + col * 290, H - 74 + row * 22, `${i === this.aIdx ? '▸ ' : '  '}${opt.label}`, {
        fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold',
        color: i === this.aIdx ? '#fbbf24' : '#a8a29e',
      }).setDepth(12)
      this.actionTexts.push(t)
    })
    const cur = this.actions[this.aIdx]
    if (cur) {
      const d = this.add.text(40, H - 6, cur.detail.slice(0, 110), { fontFamily: 'monospace', fontSize: '10px', color: '#57534e' }).setOrigin(0, 1).setDepth(12)
      this.actionTexts.push(d)
    }
    this.cursor.setVisible(false)
  }
  private clearActionMenu() {
    this.actionTexts.forEach((t) => t.destroy())
    this.actionTexts = []
  }

  private beginTargetSelect(mode: TargetMode) {
    this.targetMode = mode
    const valid = this.targetables()
    if (valid.length === 0) { this.beginActionSelect(); return }
    this.step = 'target'
    this.tIdx = mode === 'enemy' && valid.includes(frontIndex(this.battle)) ? valid.indexOf(frontIndex(this.battle)) : 0
    this.hintTxt.setText(`◂ ▸ ${mode === 'enemy' ? 'alvo' : 'membro'} · E confirma · ESC volta`)
    this.highlightTarget()
  }
  private targetables(): number[] {
    if (this.targetMode === 'member') return this.battle.party.map((_, i) => i)
    if (!this.battle.decomposed) return [0]
    const act = this.actions[this.aIdx]
    if (act.kind === 'seal') return this.battle.phases.map((p, i) => (p.done && !p.sealed ? i : -1)).filter((i) => i >= 0)
    return this.battle.phases.map((p, i) => (p.revealed && !p.done ? i : -1)).filter((i) => i >= 0)
  }
  private highlightTarget() {
    const valid = this.targetables()
    const idx = valid[this.tIdx % valid.length]
    if (this.targetMode === 'member') {
      const spr = this.members[idx]
      this.cursor.setVisible(true).setPosition(spr.x - 8, spr.y - spr.displayHeight / 2 - 30)
      const h = this.battle.party[idx]
      this.msg.setText(`re-harness em ${agentById(h.agentId).name} (${MODELS.find((m) => m.id === h.modelId)?.name}·${h.effort})`)
      return
    }
    if (!this.battle.decomposed && this.monolith) {
      this.cursor.setVisible(true).setPosition(this.monolith.x - 8, this.monolith.y - this.monolith.displayHeight / 2 - 30)
      this.msg.setText('🌊 atacar o MONOLITO inteiro = afogar no escopo (20% de dano). Decomponha primeiro.')
      return
    }
    this.battle.phases.forEach((p, i) => { this.enemies[i]?.clearTint(); if (p.done && p.sealed) this.enemies[i]?.setTint(0x8b5cf6) })
    const spr = this.enemies[idx]!
    spr.setTint(0xfbbf24)
    this.cursor.setVisible(true).setPosition(spr.x - 8, spr.y - spr.displayHeight / 2 - 44)
    const front = frontIndex(this.battle)
    const act = this.actions[this.aIdx]
    const blind = act.kind === 'skill' && front !== -1 && idx > front
    this.msg.setText(blind ? '🙈 fora de sequência — trabalho às cegas (-50% de dano)' : '')
  }

  private nav(d: number) {
    if (this.step === 'member') {
      chiptune.nav()
      const total = this.battle.party.length + 1
      this.mIdx = (this.mIdx + d + total) % total
      this.highlightMember()
    } else if (this.step === 'action') {
      chiptune.nav()
      this.aIdx = (this.aIdx + d + this.actions.length) % this.actions.length
      this.renderActionMenu()
    } else if (this.step === 'target') {
      chiptune.nav()
      const valid = this.targetables()
      this.tIdx = (this.tIdx + d + valid.length) % valid.length
      this.highlightTarget()
    }
  }

  private cancel() {
    if (this.step === 'target') { chiptune.back(); this.enemies.forEach((e) => e?.clearTint()); this.beginActionSelect() }
    else if (this.step === 'action') { chiptune.back(); this.clearActionMenu(); this.beginMemberSelect() }
  }

  private confirm() {
    if (this.typing) { this.typing = false; return }
    if (this.step === 'member') { chiptune.confirm(); this.beginActionSelect(); return }
    if (this.step === 'action') {
      chiptune.confirm()
      const a = this.actions[this.aIdx]
      if (a.kind === 'scout' || a.kind === 'decompose' || a.kind === 'invoke' || a.kind === 'sync' || a.kind === 'parallel') { this.execute(-1); return }
      if (a.kind === 'model' || a.kind === 'effort' || a.kind === 'dismiss') { this.beginTargetSelect('member'); return }
      this.beginTargetSelect('enemy')
      return
    }
    if (this.step === 'target') {
      chiptune.confirm()
      const valid = this.targetables()
      this.execute(valid[this.tIdx % valid.length])
    }
  }

  private execute(targetIdx: number) {
    this.step = 'busy'
    this.clearActionMenu()
    this.cursor.setVisible(false)
    this.enemies.forEach((e) => e?.clearTint())
    const act = this.actions[this.aIdx]
    const wasDecomposed = this.battle.decomposed

    let res: SquadTurnResult
    let parallelHits: ParallelHit[] | null = null
    if (act.kind === 'parallel') { const r = orchParallel(this.battle); parallelHits = r.hits; res = r }
    else if (act.kind === 'decompose') res = orchDecompose(this.battle)
    else if (act.kind === 'invoke') res = orchInvoke(this.battle, act.reserve!)
    else if (act.kind === 'sync') res = orchSync(this.battle)
    else if (act.kind === 'model') res = orchReharness(this.battle, targetIdx, { modelId: act.modelId })
    else if (act.kind === 'effort') res = orchReharness(this.battle, targetIdx, { effort: act.effort })
    else if (act.kind === 'dismiss') res = orchDismiss(this.battle, targetIdx)
    else if (act.kind === 'scout') res = squadScout(this.battle, this.mIdx - 1)
    else if (act.kind === 'seal') res = squadSeal(this.battle, this.mIdx - 1, targetIdx)
    else res = squadAttack(this.battle, this.mIdx - 1, targetIdx, act.skillId!)
    this.battle = res.state

    // FX por tipo
    const actorSpr = this.mIdx === 0 ? this.clock : this.members[this.mIdx - 1]
    this.tweens.add({ targets: actorSpr, x: actorSpr.x + 30, duration: 100, yoyo: true, ease: 'quad.out' })

    this.time.delayedCall(150, () => {
      if (act.kind === 'parallel' && parallelHits) {
        // TRIPLE TECH: todos avançam e batem ao mesmo tempo
        chiptune.superHit()
        this.cameras.main.shake(300, 0.01)
        this.cameras.main.flash(160, 255, 255, 255)
        parallelHits.forEach((hit, k) => {
          const mSpr = this.members[hit.slot]
          const eSpr = this.enemies[hit.phaseIdx]
          if (!mSpr || !eSpr) return
          this.time.delayedCall(k * 120, () => {
            this.tweens.add({ targets: mSpr, x: mSpr.x + 60, duration: 130, yoyo: true, ease: 'quad.out' })
            if (hit.hallucinated) {
              chiptune.hallucinate()
              this.floatText(eSpr.x, eSpr.y - 56, 'ALUCINOU!', '#c084fc')
            } else {
              chiptune.hit()
              this.floatText(eSpr.x, eSpr.y - 56, `-${hit.dmg}`, hit.superHit ? '#fde047' : '#fff')
              const px = this.add.particles(eSpr.x, eSpr.y, 'px', { speed: { min: 80, max: 220 }, lifespan: 420, quantity: 14, scale: { start: 1.3, end: 0 }, tint: hit.superHit ? 0xfde047 : 0xffffff, emitting: false })
              px.explode(14)
              this.time.delayedCall(600, () => px.destroy())
            }
          })
        })
        this.time.delayedCall(parallelHits.length * 120 + 300, () => this.refreshEnemies())
      } else if (act.kind === 'decompose' && !wasDecomposed) {
        this.shatterMonolith()
      } else if (act.kind === 'invoke') {
        chiptune.levelup()
        this.spawnMemberSprite(this.battle.party[this.battle.party.length - 1], this.battle.party.length - 1, true)
        this.rebuildCards()
      } else if (act.kind === 'sync') {
        chiptune.confirm()
        this.cameras.main.flash(140, 124, 58, 237)
      } else if (act.kind === 'model' || act.kind === 'effort') {
        chiptune.levelup()
        this.cameras.main.flash(120, 251, 191, 36)
        this.rebuildCards()
      } else if (act.kind === 'dismiss') {
        chiptune.back()
        const spr = this.members[targetIdx]
        this.tweens.add({ targets: spr, x: -120, alpha: 0, duration: 450, ease: 'quad.in', onComplete: () => spr.destroy() })
        this.members.splice(targetIdx, 1)
        // re-alinha os que ficaram
        this.members.forEach((m, i) => { const pos = this.memberPos(i); this.tweens.add({ targets: m, x: pos.x, y: pos.y, duration: 300 }) })
        this.rebuildCards()
      } else if (res.kind === 'attack' && res.dmg > 0) {
        const superHit = res.events.some((e) => e.includes('SUPER EFICAZ'))
        if (superHit) { chiptune.superHit(); this.cameras.main.shake(200, 0.007); this.cameras.main.flash(110, 255, 220, 120) }
        else { chiptune.hit(); this.cameras.main.shake(110, 0.004) }
        const target = this.battle.decomposed ? this.enemies[targetIdx] : this.monolith
        if (target) this.floatText(target.x, target.y - 56, `-${res.dmg}`, superHit ? '#fde047' : '#fff')
        this.refreshEnemies(targetIdx, superHit)
      } else if (res.kind === 'hallucination') {
        chiptune.hallucinate()
        const target = this.battle.decomposed ? this.enemies[targetIdx] : this.monolith
        if (target) this.floatText(target.x, target.y - 56, 'ALUCINOU!', '#c084fc')
        this.refreshEnemies()
      } else if (res.kind === 'scout') {
        chiptune.confirm()
        this.cameras.main.flash(150, 56, 189, 248)
        this.refreshEnemies()
      } else if (res.kind === 'seal') {
        chiptune.levelup()
        this.refreshEnemies()
      } else if (res.kind === '429') {
        chiptune.hurt()
        this.floatText(actorSpr.x, actorSpr.y - 46, '429!', '#ef4444')
      }
      this.updateBudget()
      if (this.battle.outcome === 'ongoing') {
        this.time.delayedCall(650, () => {
          chiptune.hurt()
          this.members.forEach((m) => this.tweens.add({ targets: m, x: m.x - 8, duration: 55, yoyo: true, repeat: 1 }))
        })
      }
      this.pushMsg(res.events)
    })
  }

  // ── fila de mensagens ─────────────────────────────────────────────────
  private pushMsg(events: string[]) {
    this.queue.push(...events)
    if (!this.typing) this.nextMsg()
  }
  private nextMsg() {
    const line = this.queue.shift()
    if (!line) {
      if (this.battle.outcome === 'won') { this.endBattle(true); return }
      if (this.battle.outcome === 'lost') { this.endBattle(false); return }
      this.beginMemberSelect()
      return
    }
    this.step = 'busy'
    this.typing = true
    this.msg.setText('')
    let i = 0
    const ev = this.time.addEvent({
      delay: 13, repeat: line.length - 1,
      callback: () => {
        if (!this.typing) { this.msg.setText(line); ev.remove(); return }
        i++
        this.msg.setText(line.slice(0, i))
        if (i % 3 === 0) chiptune.blip()
      },
    })
    this.time.delayedCall(Math.min(2400, line.length * 13 + 850), () => {
      this.typing = false
      this.nextMsg()
    })
  }

  private endBattle(won: boolean) {
    if (this.ended) return
    this.ended = true
    this.step = 'busy'
    if (won) {
      chiptune.victory()
      this.enemies.forEach((e, i) => e && this.tweens.add({ targets: e, alpha: 0, y: e.y + 20, duration: 550, delay: i * 70 }))
    } else {
      chiptune.gameover()
      this.members.forEach((m) => this.tweens.add({ targets: m, alpha: 0.2, duration: 450 }))
    }
    this.time.delayedCall(1000, () => {
      this.cameras.main.fadeOut(400)
      this.time.delayedCall(440, () => {
        chiptune.setTrack('world')
        bridge.emit('battleEnd', {
          outcome: won ? 'won' : 'lost',
          spent: this.battle.spent,
          budget: this.battle.budget,
          missionBaseline: this.mission.baseline,
          gymId: this.params.gymId,
          tutorial: this.params.tutorial,
        })
      })
    })
  }
}
