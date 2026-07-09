/**
 * Sprite procedural pixel-art (estilo criatura GBA) — determinístico por seed.
 * Grid espelhado + paleta por domínio/role, upscale nearest-neighbor no canvas.
 * Zero assets externos; cada task/agente ganha uma criatura única e estável.
 */
import { useEffect, useRef } from 'react'
import { ENEMIES, ROLE_BOTS, drawSprite, type AuthoredSprite } from '../art/sprites'

// mulberry32 — PRNG determinístico
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export interface Palette { body: string; body2: string; accent: string; eye: string; outline: string }

export const DOMAIN_PALETTES: Record<string, Palette> = {
  mecanico: { body: '#8a929e', body2: '#5b6470', accent: '#eab308', eye: '#fff', outline: '#1c2027' },
  debug: { body: '#4ade80', body2: '#166534', accent: '#ef4444', eye: '#fef08a', outline: '#052e16' },
  frontend: { body: '#60a5fa', body2: '#1d4ed8', accent: '#22d3ee', eye: '#fff', outline: '#0c1e46' },
  ux: { body: '#c084fc', body2: '#7e22ce', accent: '#f472b6', eye: '#fff', outline: '#2e1065' },
  copy: { body: '#fbbf24', body2: '#b45309', accent: '#fef3c7', eye: '#451a03', outline: '#451a03' },
  qa: { body: '#2dd4bf', body2: '#0f766e', accent: '#f0fdfa', eye: '#042f2e', outline: '#042f2e' },
  logica: { body: '#f87171', body2: '#991b1b', accent: '#fca5a5', eye: '#fff', outline: '#450a0a' },
  pesquisa: { body: '#a3e635', body2: '#3f6212', accent: '#ecfccb', eye: '#1a2e05', outline: '#1a2e05' },
}
export const ROLE_PALETTES: Record<string, Palette> = {
  scout: { body: '#38bdf8', body2: '#0369a1', accent: '#bae6fd', eye: '#082f49', outline: '#082f49' },
  executor: { body: '#fb923c', body2: '#c2410c', accent: '#fed7aa', eye: '#431407', outline: '#431407' },
  reviewer: { body: '#a78bfa', body2: '#6d28d9', accent: '#ddd6fe', eye: '#2e1065', outline: '#2e1065' },
  especial: { body: '#f43f5e', body2: '#9f1239', accent: '#fecdd3', eye: '#fff', outline: '#4c0519' },
}

const GRID = 14 // 14x14, espelhado na vertical (7 colunas geradas)

function buildGrid(seed: number, boss: boolean): number[][] {
  const r = rng(seed)
  const g: number[][] = Array.from({ length: GRID }, () => Array(GRID).fill(0))
  const half = GRID / 2
  const density = boss ? 0.62 : 0.52
  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x <= half; x++) {
      // corpo concentrado no centro — máscara radial
      const cx = half - x, cy = Math.abs(y - GRID / 2)
      const dist = Math.sqrt(cx * cx * 0.8 + cy * cy) / (GRID / 2)
      if (r() < density - dist * 0.55) {
        const v = r() < 0.22 ? 2 : 1 // 2 = sombra/segunda cor
        g[y][x] = v; g[y][GRID - 1 - x] = v
      }
    }
  }
  // olhos — sempre presentes, simétricos
  const eyeY = 4 + Math.floor(r() * 3)
  const eyeX = 3 + Math.floor(r() * 2)
  g[eyeY][eyeX] = 3; g[eyeY][GRID - 1 - eyeX] = 3
  // detalhe accent
  const ay = 8 + Math.floor(r() * 4)
  const ax = 4 + Math.floor(r() * 3)
  g[ay][ax] = 4; g[ay][GRID - 1 - ax] = 4
  return g
}

/** Resolve arte AUTORADA pela identidade da paleta (mesmos objetos do módulo). */
function authoredFor(palette: Palette): AuthoredSprite | null {
  for (const [k, v] of Object.entries(DOMAIN_PALETTES)) if (v === palette) return ENEMIES[k] ?? null
  for (const [k, v] of Object.entries(ROLE_PALETTES)) if (v === palette) return ROLE_BOTS[k] ?? null
  return null
}

export function PixelSprite({ seed, palette, size = 96, boss = false, flip = false, animate = true }: {
  seed: string; palette: Palette; size?: number; boss?: boolean; flip?: boolean; animate?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // arte desenhada à mão quando existe pro domínio/role — fallback: procedural
    const authored = authoredFor(palette)
    if (authored) {
      let frame = 0
      let raf = 0
      const drawAuthored = () => {
        ctx.clearRect(0, 0, size, size)
        const bob = animate ? Math.round(Math.sin(frame / 26) * size * 0.02) : 0
        if (boss) {
          ctx.save()
          ctx.shadowColor = '#ef4444'
          ctx.shadowBlur = 10 + Math.sin(frame / 18) * 5
          drawSprite(ctx, authored, 0, bob, size, { flip })
          ctx.restore()
        } else {
          drawSprite(ctx, authored, 0, bob, size, { flip })
        }
        frame++
        if (animate) raf = requestAnimationFrame(drawAuthored)
      }
      drawAuthored()
      return () => cancelAnimationFrame(raf)
    }
    const grid = buildGrid(hashStr(seed), boss)
    const px = size / GRID
    let frame = 0
    let raf = 0
    const draw = () => {
      ctx.clearRect(0, 0, size, size)
      // bob de idle — 2 frames como nos GBA
      const bob = animate ? Math.round(Math.sin(frame / 24) * px * 0.4) : 0
      ctx.save()
      if (flip) { ctx.translate(size, 0); ctx.scale(-1, 1) }
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          const v = grid[y][x]
          if (!v) continue
          ctx.fillStyle = v === 1 ? palette.body : v === 2 ? palette.body2 : v === 3 ? palette.eye : palette.accent
          ctx.fillRect(Math.round(x * px), Math.round(y * px + bob), Math.ceil(px), Math.ceil(px))
          // outline barato: pinta borda se vizinho vazio
          if (v === 1 || v === 2) {
            ctx.fillStyle = palette.outline
            if (!grid[y - 1]?.[x]) ctx.fillRect(Math.round(x * px), Math.round(y * px + bob), Math.ceil(px), 1.5)
            if (!grid[y + 1]?.[x]) ctx.fillRect(Math.round(x * px), Math.round((y + 1) * px + bob) - 1.5, Math.ceil(px), 1.5)
            if (!grid[y]?.[x - 1]) ctx.fillRect(Math.round(x * px), Math.round(y * px + bob), 1.5, Math.ceil(px))
            if (!grid[y]?.[x + 1]) ctx.fillRect(Math.round((x + 1) * px) - 1.5, Math.round(y * px + bob), 1.5, Math.ceil(px))
          }
        }
      }
      ctx.restore()
      frame++
      if (animate) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [seed, palette, size, boss, flip, animate])
  return <canvas ref={ref} width={size} height={size} style={{ imageRendering: 'pixelated', width: size, height: size }} />
}
