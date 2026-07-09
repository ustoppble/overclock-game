/** Mundo aberto em Phaser — tilemap, movimento em grid com tween, câmera, encontros. */
import Phaser from 'phaser'
import { WORLD, MAP_W, MAP_H, walkable, tileAt, encounterPool, ENCOUNTER_RATE, NPCS, TRAINERS, GYM_BOSSES } from '../world/worldMap'
import { makeTileset, makeSprites, makeMascotTextures, clockKey, TILE, T } from './textures'
import { bridge } from './bridge'
import { chiptune } from '../audio/chiptune'

const NPC_TINT: Record<string, number> = { a: 0x38bdf8, b: 0xfbbf24, c: 0xa78bfa, n: 0x6b7280, x: 0xef4444, y: 0x22c55e }

function charToTile(ch: string, x: number, y: number, facades: Map<string, number>): number {
  const n = ((x * 374761393 + y * 668265263) >>> 16) % 100
  switch (ch) {
    case '#': return facades.get(`${x},${y}`) ?? T.wall
    case 'T': return T.tree
    case 'w': return T.water
    case 'g': return n > 50 ? T.tall : T.tall2
    case ',': return n > 93 ? T.flower : n > 50 ? T.grass : T.grass2
    case 'C': return T.doorPurple
    case 'A': return T.doorBlue
    default:
      if (/[1-6]/.test(ch)) return T.doorRed
      return n > 50 ? T.path : T.path2
  }
}

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite
  private px = 20; private py = 18
  private dir: 'down' | 'up' | 'left' | 'right' = 'down'
  private moving = false
  private frozen = false
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>
  private dialogBox: Phaser.GameObjects.Container | null = null
  private dialogLines: string[] = []
  private dialogIdx = 0
  private dialogName = ''
  private pendingTrainer: 'x' | 'y' | null = null
  private idleFrame = 0

  constructor() { super('World') }

  create() {
    makeTileset(this)
    makeSprites(this)
    makeMascotTextures(this)

    // fachadas: muros perto de porta herdam telhado da função
    const facades = new Map<string, number>()
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const ch = WORLD[y][x]
      const roof = ch === 'C' ? T.roofPurple : ch === 'A' ? T.roofBlue : /[1-6]/.test(ch) ? T.roofRed : null
      if (!roof) continue
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (tileAt(x + dx, y + dy) === '#') facades.set(`${x + dx},${y + dy}`, roof)
      }
    }

    const data: number[][] = []
    for (let y = 0; y < MAP_H; y++) {
      const row: number[] = []
      for (let x = 0; x < MAP_W; x++) row.push(charToTile(WORLD[y][x], x, y, facades))
      data.push(row)
    }
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE })
    const tiles = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!
    map.createLayer(0, tiles, 0, 0)

    // PRÉDIOS coesos — cada ginásio/loja vira UMA estrutura desenhada inteira,
    // por cima dos tiles (o ASCII continua mandando na colisão e nos triggers)
    this.buildBuildings()

    // NPCs
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const ch = WORLD[y][x]
      if (NPCS[ch] || ch === 'x' || ch === 'y') {
        const bot = this.add.sprite(x * TILE + TILE / 2, y * TILE + TILE / 2 - 4, ch === 'x' || ch === 'y' ? 'bot-executor' : 'bot-scout')
        bot.setDisplaySize(30, 30).setTint(NPC_TINT[ch] ?? 0xffffff)
        this.tweens.add({ targets: bot, y: bot.y - 2, duration: 900 + (x % 4) * 120, yoyo: true, repeat: -1, ease: 'sine.inout' })
        if (ch === 'x' || ch === 'y') {
          const mark = this.add.text(bot.x, bot.y - 24, '!', { fontFamily: 'monospace', fontSize: '15px', color: '#fde047', fontStyle: 'bold' }).setOrigin(0.5)
          this.tweens.add({ targets: mark, y: mark.y - 4, duration: 500, yoyo: true, repeat: -1 })
        }
      }
    }

    // player = o CLOCKINHO (mascote real, forma atual do XP)
    const start = bridge.ctx.pos
    this.px = start.x; this.py = start.y
    this.player = this.add.sprite(this.px * TILE + TILE / 2, this.py * TILE + TILE / 2 - 8, clockKey(bridge.ctx.form, 'idle', 0))
    this.player.setDisplaySize(52, 52).setDepth(10)
    // respiração idle — 4 frames do SpriteRenderer real
    this.time.addEvent({
      delay: 260, loop: true,
      callback: () => {
        if (this.moving) return
        this.idleFrame = (this.idleFrame + 1) % 4
        this.player.setTexture(clockKey(bridge.ctx.form, 'idle', this.idleFrame))
      },
    })

    // vagalumes
    this.add.particles(0, 0, 'px', {
      x: { min: 0, max: MAP_W * TILE }, y: { min: 0, max: MAP_H * TILE },
      lifespan: 4000, alpha: { start: 0.7, end: 0 }, scale: { min: 0.3, max: 0.6 },
      tint: [0xef4444, 0xfbbf24], speed: 6, quantity: 1, frequency: 220,
    }).setDepth(20)

    // câmera
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE)
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12)
    this.cameras.main.setZoom(1)
    this.cameras.main.fadeIn(400)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D,E') as Record<string, Phaser.Input.Keyboard.Key>
    this.input.keyboard!.on('keydown-E', () => this.interactOrAdvance())
    this.input.keyboard!.on('keydown-ENTER', () => this.interactOrAdvance())
    this.input.keyboard!.on('keydown', () => chiptune.unlock())
    this.input.on('pointerdown', () => chiptune.unlock())

    chiptune.setTrack('world')
  }

  /** Detecta cada prédio pelo char da porta e desenha a fachada inteira num canvas só. */
  private buildBuildings() {
    const kinds: Record<string, { tint: string; label: string; sign: string }> = {
      '1': { tint: '#ef4444', label: '1', sign: 'GINÁSIO' },
      '2': { tint: '#ef4444', label: '2', sign: 'GINÁSIO' },
      '3': { tint: '#ef4444', label: '3', sign: 'GINÁSIO' },
      '4': { tint: '#ef4444', label: '4', sign: 'GINÁSIO' },
      '5': { tint: '#ef4444', label: '5', sign: 'GINÁSIO' },
      '6': { tint: '#ef4444', label: '6', sign: 'GINÁSIO' },
      C: { tint: '#7c3aed', label: 'C', sign: 'CATÁLOGO' },
      A: { tint: '#0ea5e9', label: 'A', sign: 'ARENA' },
    }
    for (const [ch, kind] of Object.entries(kinds)) {
      // bbox de todas as células do char + anel de muros
      let x0 = 999, y0 = 999, x1 = -1, y1 = -1
      let doorX = -1, doorY = -1
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
        if (WORLD[y][x] !== ch) continue
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
        if (y > doorY) { doorY = y; doorX = x } // porta = célula mais baixa
      }
      if (x1 < 0) continue
      x0 -= 1; y0 -= 1; x1 += 1; y1 += 1 // anel de '#'
      const w = (x1 - x0 + 1) * TILE, h = (y1 - y0 + 1) * TILE
      const key = `bld-${ch}`
      if (!this.textures.exists(key)) {
        const c = document.createElement('canvas'); c.width = w; c.height = h
        const g = c.getContext('2d')!
        const roofH = Math.round(h * 0.34)
        // parede
        g.fillStyle = '#262b36'; g.fillRect(0, roofH, w, h - roofH)
        g.fillStyle = '#20242e'
        for (let yy = roofH + 8; yy < h; yy += 8) g.fillRect(0, yy, w, 2) // réguas
        // telhado contínuo com beiral
        g.fillStyle = kind.tint; g.fillRect(-2, 0, w + 4, roofH)
        g.fillStyle = 'rgba(0,0,0,0.35)'
        for (let yy = 5; yy < roofH - 4; yy += 7) g.fillRect(0, yy, w, 2) // telhas
        g.fillStyle = '#0a0a0f'; g.fillRect(-2, roofH - 4, w + 4, 4) // beiral
        // janelas com luz acesa
        const winW = 16, winY = roofH + 10
        for (let wx = 12; wx + winW < w - 12; wx += 34) {
          g.fillStyle = '#0a0810'; g.fillRect(wx - 2, winY - 2, winW + 4, 18)
          g.fillStyle = 'rgba(251,191,36,0.75)'; g.fillRect(wx, winY, winW, 14)
          g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(wx + winW / 2 - 1, winY, 2, 14)
        }
        // porta centralizada na célula da porta real
        const dx = (doorX - x0) * TILE
        g.fillStyle = '#0a0a0f'; g.fillRect(dx + 3, h - 30, TILE - 6, 30)
        g.fillStyle = kind.tint; g.fillRect(dx + 3, h - 30, TILE - 6, 3)
        g.fillStyle = '#05060a'; g.fillRect(dx + 7, h - 26, TILE - 14, 26)
        // placa iluminada acima da porta
        g.fillStyle = '#0a0810'; g.fillRect(dx - 6, h - 46, TILE + 12, 14)
        g.strokeStyle = kind.tint; g.lineWidth = 1.5; g.strokeRect(dx - 6, h - 46, TILE + 12, 14)
        g.fillStyle = kind.tint; g.font = 'bold 9px monospace'; g.textAlign = 'center'
        g.fillText(`${kind.sign} ${kind.label}`.trim(), dx + TILE / 2, h - 36)
        // contorno geral
        g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2)
        this.textures.addCanvas(key, c)
      }
      this.add.image(x0 * TILE, y0 * TILE, key).setOrigin(0).setDepth(5)
      // glow pulsante na placa
      const glow = this.add.rectangle((doorX - x0 + x0) * TILE + TILE / 2, (y1 + 1) * TILE - 39, TILE + 12, 14, Phaser.Display.Color.HexStringToColor(kind.tint).color, 0.16).setDepth(6)
      glow.setPosition(doorX * TILE + TILE / 2, (y1) * TILE + TILE - 39)
      this.tweens.add({ targets: glow, alpha: 0.45, duration: 900, yoyo: true, repeat: -1, ease: 'sine.inout' })
    }
  }

  private facing(): { x: number; y: number; ch: string } {
    const dx = this.dir === 'left' ? -1 : this.dir === 'right' ? 1 : 0
    const dy = this.dir === 'up' ? -1 : this.dir === 'down' ? 1 : 0
    return { x: this.px + dx, y: this.py + dy, ch: tileAt(this.px + dx, this.py + dy) }
  }

  private interactOrAdvance() {
    if (this.dialogBox) { this.advanceDialog(); return }
    const { ch } = this.facing()
    if (NPCS[ch]) {
      chiptune.confirm()
      this.openDialog(NPCS[ch].name, NPCS[ch].lines)
    } else if (ch === 'x' || ch === 'y') {
      chiptune.confirm()
      if (bridge.ctx.tutorialsDone.includes(ch)) {
        this.openDialog(TRAINERS[ch].name, ['Você já aprendeu essa lição. O mato alto te espera.'])
      } else {
        this.pendingTrainer = ch
        this.openDialog(TRAINERS[ch].name, [TRAINERS[ch].intro, '(E pra aceitar o duelo-tutorial)'])
      }
    }
  }

  private openDialog(name: string, lines: string[]) {
    this.frozen = true
    this.dialogName = name
    this.dialogLines = lines
    this.dialogIdx = 0
    this.renderDialog()
  }

  private renderDialog() {
    this.dialogBox?.destroy()
    const cam = this.cameras.main
    const w = cam.width - 60
    const box = this.add.container(cam.scrollX + 30, cam.scrollY + cam.height - 118).setDepth(50)
    const bg = this.add.rectangle(0, 0, w, 96, 0x0a0810, 0.97).setOrigin(0).setStrokeStyle(2, 0x292524)
    const name = this.add.text(14, 8, this.dialogName.toUpperCase(), { fontFamily: 'monospace', fontSize: '11px', color: '#ef4444', fontStyle: 'bold' })
    const txt = this.add.text(14, 26, '', { fontFamily: 'monospace', fontSize: '14px', color: '#f5f5f4', wordWrap: { width: w - 28 }, lineSpacing: 4 })
    const hint = this.add.text(w - 14, 78, `E ▸ ${this.dialogIdx + 1}/${this.dialogLines.length}`, { fontFamily: 'monospace', fontSize: '10px', color: '#57534e' }).setOrigin(1, 0.5)
    box.add([bg, name, txt, hint])
    this.dialogBox = box
    // typewriter
    const full = this.dialogLines[this.dialogIdx]
    let i = 0
    this.time.addEvent({
      delay: 16, repeat: full.length - 1,
      callback: () => { i++; txt.setText(full.slice(0, i)); if (i % 3 === 0) chiptune.blip() },
    })
  }

  private advanceDialog() {
    chiptune.nav()
    if (this.dialogIdx + 1 < this.dialogLines.length) {
      this.dialogIdx++
      this.renderDialog()
      return
    }
    this.dialogBox?.destroy()
    this.dialogBox = null
    this.frozen = false
    if (this.pendingTrainer) {
      const t = this.pendingTrainer
      this.pendingTrainer = null
      this.toBattleFx(() => bridge.emit('trainer', t))
    }
  }

  /** shake + flash + zoom → wipe pro encontro. */
  private toBattleFx(cb: () => void) {
    this.frozen = true
    chiptune.encounter()
    const cam = this.cameras.main
    cam.shake(320, 0.006)
    cam.flash(180, 255, 255, 255)
    this.tweens.add({ targets: cam, zoom: 1.35, duration: 500, ease: 'quad.in' })
    cam.fadeOut(520, 0, 0, 0)
    this.time.delayedCall(560, () => { cam.setZoom(1); cb() })
  }

  private enterTile(ch: string) {
    if (/[1-6]/.test(ch)) {
      const gym = GYM_BOSSES[ch]
      const need = gym.chapter - 1
      if (bridge.ctx.badges.length >= need) {
        chiptune.confirm()
        this.toBattleFx(() => bridge.emit('gym', ch))
      } else {
        chiptune.back()
        this.showToast(`🔒 exige ${need} insígnia${need > 1 ? 's' : ''} — você tem ${bridge.ctx.badges.length}`)
      }
      return
    }
    if (ch === 'C') { chiptune.confirm(); this.toBattleFx(() => bridge.emit('catalog')); return }
    if (ch === 'A') { chiptune.confirm(); this.toBattleFx(() => bridge.emit('arena')); return }
    if (ch === 'g' && Math.random() < ENCOUNTER_RATE) {
      const pool = encounterPool(this.px, this.py)
      const taskId = pool[Math.floor(Math.random() * pool.length)]
      this.toBattleFx(() => bridge.emit('encounter', taskId))
    }
  }

  private showToast(msg: string) {
    const cam = this.cameras.main
    const t = this.add.text(cam.scrollX + cam.width / 2, cam.scrollY + 26, msg, {
      fontFamily: 'monospace', fontSize: '12px', color: '#fbbf24', backgroundColor: '#0a0810', padding: { x: 12, y: 7 },
    }).setOrigin(0.5, 0).setDepth(60)
    this.time.delayedCall(2200, () => t.destroy())
  }

  private tryMove(dx: number, dy: number, dir: typeof this.dir) {
    this.dir = dir
    this.player.setFlipX(dir === 'left')
    const nx = this.px + dx, ny = this.py + dy
    const ch = tileAt(nx, ny)
    const isNpc = !!NPCS[ch] || ch === 'x' || ch === 'y'
    if (!walkable(ch) || isNpc) return
    this.moving = true
    this.px = nx; this.py = ny
    // andando = pose de dash do clockinho, alternando 2 frames
    let frame = 0
    this.player.setTexture(clockKey(bridge.ctx.form, 'dash', 0))
    const stepAnim = this.time.addEvent({ delay: 75, repeat: 1, callback: () => { frame = 1 - frame; this.player.setTexture(clockKey(bridge.ctx.form, 'dash', frame)) } })
    chiptune.footstep()
    this.tweens.add({
      targets: this.player,
      x: nx * TILE + TILE / 2, y: ny * TILE + TILE / 2 - 8,
      duration: 150, ease: 'linear',
      onComplete: () => {
        this.moving = false
        stepAnim.remove()
        this.player.setTexture(clockKey(bridge.ctx.form, 'idle', 0))
        bridge.emit('move', { x: nx, y: ny })
        this.enterTile(tileAt(nx, ny))
      },
    })
  }

  update() {
    if (this.frozen || this.moving) return
    const c = this.cursors, k = this.wasd
    if (c.up.isDown || k.W.isDown) this.tryMove(0, -1, 'up')
    else if (c.down.isDown || k.S.isDown) this.tryMove(0, 1, 'down')
    else if (c.left.isDown || k.A.isDown) this.tryMove(-1, 0, 'left')
    else if (c.right.isDown || k.D.isDown) this.tryMove(1, 0, 'right')
  }
}
