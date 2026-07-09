/** Gera texturas Phaser a partir da pixel art ASCII autorada + tileset do mundo. */
import Phaser from 'phaser'
import { PLAYER, ENEMIES, ROLE_BOTS, drawSprite, type AuthoredSprite } from '../art/sprites'
import { drawOverclockFrame, FORMS_INFO } from '../mascot/SpriteRenderer'
import type { FormId } from '../mascot/types'

const SPRITE_PX = 96
export const TILE = 34

function addSprite(scene: Phaser.Scene, key: string, sprite: AuthoredSprite, size = SPRITE_PX, flip = false) {
  if (scene.textures.exists(key)) return
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  drawSprite(c.getContext('2d')!, sprite, 0, 0, size, { flip })
  scene.textures.addCanvas(key, c)
}

/** Índices do tileset (1 tile = 1 célula no canvas-tileset). */
export const T = {
  void: 0, wall: 1, roofRed: 2, roofPurple: 3, roofBlue: 4,
  path: 5, path2: 6, grass: 7, grass2: 8, tall: 9, tall2: 10,
  tree: 11, water: 12, doorRed: 13, doorPurple: 14, doorBlue: 15,
  flower: 16, window: 17,
} as const

function px(ctx: CanvasRenderingContext2D, ox: number, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(ox + x, y, w, h)
}

/** Desenha o tileset inteiro num canvas (17 tiles lado a lado). */
export function makeTileset(scene: Phaser.Scene) {
  if (scene.textures.exists('tiles')) return
  const count = 18
  const c = document.createElement('canvas')
  c.width = TILE * count; c.height = TILE
  const ctx = c.getContext('2d')!

  const drawWall = (ox: number, roof: string | null) => {
    px(ctx, ox, 0, 0, TILE, TILE, '#1c2027')
    if (roof) {
      px(ctx, ox, 0, 0, TILE, 12, roof + '55')
      px(ctx, ox, 0, 0, TILE, 5, roof)
      px(ctx, ox, 3, 16, TILE - 6, TILE - 20, '#12151b')
    } else {
      px(ctx, ox, 0, 0, TILE, TILE, '#151920')
      px(ctx, ox, 2, 2, TILE - 4, TILE / 2 - 2, '#20262f')
      px(ctx, ox, 0, TILE - 5, TILE, 5, '#0c0f14')
    }
    ctx.strokeStyle = '#000'
    ctx.strokeRect(ox + 0.5, 0.5, TILE - 1, TILE - 1)
  }
  const drawPath = (ox: number, v: number) => {
    px(ctx, ox, 0, 0, TILE, TILE, v ? '#242b36' : '#212833')
    px(ctx, ox, 1, 1, TILE - 2, 3, '#2c3441')
    if (v) { px(ctx, ox, 5, 16, 8, 2, '#1a202a'); px(ctx, ox, 14, 22, 6, 2, 'rgba(239,68,68,0.3)') }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.strokeRect(ox + 0.5, 0.5, TILE - 1, TILE - 1)
  }
  const drawGrass = (ox: number, v: number) => {
    px(ctx, ox, 0, 0, TILE, TILE, v ? '#121d0e' : '#101a0d')
    if (v) { px(ctx, ox, 20, 22, 4, 3, '#2a4520'); px(ctx, ox, 6, 8, 3, 3, '#233a1a') }
  }
  const drawTall = (ox: number, v: number) => {
    px(ctx, ox, 0, 0, TILE, TILE, v ? '#132a10' : '#112509')
    ctx.strokeStyle = v ? '#4a8a33' : '#3c7029'
    ctx.lineWidth = 2.5
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(ox + 5 + i * 8, TILE - 3)
      ctx.lineTo(ox + 6 + i * 8 + (v ? 2 : -1), 7 + (i % 2) * 3)
      ctx.stroke()
    }
  }

  // 0 void
  px(ctx, 0, 0, 0, TILE, TILE, '#05070a')
  drawWall(TILE * T.wall, null)
  drawWall(TILE * T.roofRed, '#ef4444')
  drawWall(TILE * T.roofPurple, '#7c3aed')
  drawWall(TILE * T.roofBlue, '#0ea5e9')
  drawPath(TILE * T.path, 0)
  drawPath(TILE * T.path2, 1)
  drawGrass(TILE * T.grass, 0)
  drawGrass(TILE * T.grass2, 1)
  drawTall(TILE * T.tall, 0)
  drawTall(TILE * T.tall2, 1)
  // tree
  {
    const ox = TILE * T.tree
    px(ctx, ox, 0, 0, TILE, TILE, '#0a1208')
    ctx.fillStyle = '#12240d'
    ctx.beginPath(); ctx.arc(ox + TILE / 2, TILE / 2 - 3, TILE / 2.4, 0, 7); ctx.fill()
    ctx.fillStyle = '#1d3a14'
    ctx.beginPath(); ctx.arc(ox + TILE / 2 - 4, TILE / 2 - 7, TILE / 3.4, 0, 7); ctx.fill()
    px(ctx, ox, TILE / 2 - 2, TILE - 9, 4, 7, '#2a1a0a')
  }
  // water
  {
    const ox = TILE * T.water
    px(ctx, ox, 0, 0, TILE, TILE, '#07203a')
    px(ctx, ox, 0, 8, TILE, 3, '#0b3357')
    px(ctx, ox, 0, 22, TILE, 2, '#0b3357')
  }
  const drawDoor = (ox: number, tint: string, label: string) => {
    px(ctx, ox, 0, 0, TILE, TILE, '#1c2027')
    px(ctx, ox, 6, 3, TILE - 12, TILE - 6, tint)
    px(ctx, ox, 9, 7, TILE - 18, TILE - 12, '#0a0810')
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 13px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(label, ox + TILE / 2, TILE / 2 + 5)
  }
  drawDoor(TILE * T.doorRed, '#ef4444', '')
  drawDoor(TILE * T.doorPurple, '#7c3aed', 'C')
  drawDoor(TILE * T.doorBlue, '#0ea5e9', 'A')
  // flower
  drawGrass(TILE * T.flower, 0)
  px(ctx, TILE * T.flower, 8, 12, 3, 3, '#ef4444')
  px(ctx, TILE * T.flower, 9, 15, 1, 3, '#7f1d1d')

  scene.textures.addCanvas('tiles', c)
}

/** Escurece um hex (sombra do corpo custom). */
export function shadeColor(hex: string, f = 0.5): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

import { bridge } from './bridge'
/** Chave de textura do clockinho — inclui a cor custom (criação de personagem). */
export function clockKey(form: string, anim: 'idle' | 'dash', i: number): string {
  const c = (bridge.ctx.clockColor ?? 'std').replace('#', '')
  return `clock-${c}-${form}-${anim}-${i}`
}

/** O CLOCKINHO como personagem: assa frames do SpriteRenderer real em texturas.
 *  idle 4 frames (respiração) + dash 2 (andando). Todas as 5 formas, cor custom respeitada. */
export function makeMascotTextures(scene: Phaser.Scene) {
  const FORMS: FormId[] = ['base', 'boost', 'turbo', 'overdrive', 'redline']
  const RAGE: Record<FormId, number> = { base: 120, boost: 320, turbo: 560, overdrive: 800, redline: 1000 }
  const color = bridge.ctx.clockColor
  for (const f of FORMS) {
    const form = color ? { ...FORMS_INFO[f], primaryColor: color, secondaryColor: shadeColor(color, 0.55) } : FORMS_INFO[f]
    for (let i = 0; i < 4; i++) {
      const key = clockKey(f, 'idle', i)
      if (scene.textures.exists(key)) continue
      const c = document.createElement('canvas'); c.width = 96; c.height = 96
      drawOverclockFrame({ ctx: c.getContext('2d')!, ox: 0, oy: 0, pixelSize: 2, animation: 'idle', frameIndex: i, form, rageLevel: RAGE[f] })
      scene.textures.addCanvas(key, c)
    }
    for (let i = 0; i < 2; i++) {
      const key = clockKey(f, 'dash', i)
      if (scene.textures.exists(key)) continue
      const c = document.createElement('canvas'); c.width = 96; c.height = 96
      drawOverclockFrame({ ctx: c.getContext('2d')!, ox: 0, oy: 0, pixelSize: 2, animation: 'dash', frameIndex: i, form, rageLevel: RAGE[f] })
      scene.textures.addCanvas(key, c)
    }
  }
}

export function makeSprites(scene: Phaser.Scene) {
  Object.entries(ENEMIES).forEach(([k, s]) => addSprite(scene, `enemy-${k}`, s))
  Object.entries(ROLE_BOTS).forEach(([k, s]) => addSprite(scene, `bot-${k}`, s))
  const dirs = ['down', 'up', 'side'] as const
  dirs.forEach((d) => PLAYER[d].forEach((s, i) => addSprite(scene, `pl-${d}-${i}`, s, 46)))
  // partícula quadrada
  if (!scene.textures.exists('px')) {
    const c = document.createElement('canvas'); c.width = 4; c.height = 4
    const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, 4, 4)
    scene.textures.addCanvas('px', c)
  }
}
