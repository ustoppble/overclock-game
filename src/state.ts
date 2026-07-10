/** Estado global do jogo + save em localStorage. Reducer puro, sem libs. */
import type { Harness, Grade } from './engine/battle'
import type { FormId } from './mascot/types'

export interface Recipe { name: string; harness: Harness }

export type Screen =
  | 'title' | 'create' | 'world' | 'battle' | 'squad'
  | 'catalog' | 'pvp' | 'howto'
  | 'victory' | 'gameover' | 'finale'

export interface GameState {
  screen: Screen
  tokens: number
  xp: number
  ownedAgents: string[]
  unlockedModels: string[]
  extraSkills: Record<string, string[]>
  recipes: Recipe[]
  party: Harness[]
  badges: number[]
  worldPos: { x: number; y: number }
  tutorialsDone: string[]
  lastGrade: Grade | null
  lastSpent: number
  wonBattles: number
  playerName: string
  /** cor do corpo do clockinho (criação de personagem) — null = laranja original */
  clockColor: string | null
  created: boolean
}

export const START_TOKENS = 3000

export const initialState: GameState = {
  screen: 'title',
  tokens: START_TOKENS,
  xp: 0,
  ownedAgents: [],
  unlockedModels: ['haiku'],
  extraSkills: {},
  recipes: [],
  party: [],
  badges: [],
  worldPos: { x: 20, y: 18 },
  tutorialsDone: [],
  lastGrade: null,
  lastSpent: 0,
  wonBattles: 0,
  playerName: 'Orquestrador',
  clockColor: null,
  created: false,
}

const FORM_LADDER: FormId[] = ['base', 'boost', 'turbo', 'overdrive', 'redline']
const XP_THRESHOLDS = [0, 60, 160, 300, 480]

export function formForXp(xp: number): FormId {
  let idx = 0
  for (let i = 0; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]) idx = i
  return FORM_LADDER[idx]
}
export function xpProgress(xp: number): { form: FormId; pct: number } {
  let idx = 0
  for (let i = 0; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]) idx = i
  if (idx >= XP_THRESHOLDS.length - 1) return { form: FORM_LADDER[idx], pct: 100 }
  const lo = XP_THRESHOLDS[idx], hi = XP_THRESHOLDS[idx + 1]
  return { form: FORM_LADDER[idx], pct: Math.round(((xp - lo) / (hi - lo)) * 100) }
}

const SAVE_KEY = 'overclock-mon-save-v2'
const TRANSIENT: Screen[] = ['battle', 'squad', 'victory', 'gameover', 'catalog', 'pvp', 'howto']

export function saveGame(s: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
    localStorage.setItem(`${SAVE_KEY}:at`, String(Date.now()))
  } catch { /* quota */ }
}
/** Sanitiza um save vindo de fora (localStorage ou nuvem) pro shape atual. */
export function normalizeSave(s: GameState): GameState {
  // telas transientes ou de versões antigas do save não sobrevivem a reload
  const valid: Screen[] = ['title', 'world', 'finale']
  const screen: Screen = valid.includes(s.screen) && !TRANSIENT.includes(s.screen) ? s.screen : 'world'
  // saves de antes da criação de personagem: quem já jogou conta como criado
  const created = s.created ?? (typeof s.wonBattles === 'number' && (s.wonBattles > 0 || (s.ownedAgents?.length ?? 0) > 0))
  return { ...initialState, ...s, screen, created }
}
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as GameState
    if (!s || typeof s.tokens !== 'number') return null
    return normalizeSave(s)
  } catch { return null }
}
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY) } catch { /* noop */ }
}
