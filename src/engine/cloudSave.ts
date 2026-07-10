/**
 * Save em nuvem — Supabase (auth anônima + tabela game_saves com RLS own-row).
 * Identidade: signInAnonymously no primeiro boot; a sessão vive no localStorage
 * do browser. Sync: pull no boot (nuvem vence se mais nova) + push debounced.
 */
import { createClient } from '@supabase/supabase-js'
import type { GameState } from '../state'

const SUPABASE_URL = 'https://atrqyavpbjwpjsewwcrj.supabase.co'
// anon key: pública por design (vai no bundle); RLS é quem protege as linhas
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cnF5YXZwYmp3cGpzZXd3Y3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTQ5NzQsImV4cCI6MjA5MjA5MDk3NH0.k-EkfVZKh9ikF-BYxElRDrrH1UJ0WS4u81IM2fFrJb8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const SAVED_AT_KEY = 'overclock-mon-save-v2:at'

export async function ensureSession(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id
  const { data: anon, error } = await supabase.auth.signInAnonymously()
  if (error) return null
  return anon.user?.id ?? null
}

/** Pull do boot: retorna o save da nuvem SE for mais novo que o local. */
export async function pullCloudSave(): Promise<GameState | null> {
  try {
    const userId = await ensureSession()
    if (!userId) return null
    const { data, error } = await supabase
      .from('game_saves')
      .select('save, updated_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return null
    const localAt = Number(localStorage.getItem(SAVED_AT_KEY) ?? 0)
    const cloudAt = new Date(data.updated_at).getTime()
    if (cloudAt <= localAt) return null
    return data.save as GameState
  } catch { return null }
}

let pushTimer: number | null = null
let pending: GameState | null = null

async function flush() {
  if (!pending) return
  const gs = pending
  pending = null
  try {
    const userId = await ensureSession()
    if (!userId) return
    await supabase.from('game_saves').upsert({ user_id: userId, save: gs, updated_at: new Date().toISOString() })
    localStorage.setItem(SAVED_AT_KEY, String(Date.now()))
  } catch { /* offline — o localStorage segura */ }
}

/** Push debounced (4s) — chamar a cada mudança de estado salva. */
export function queueCloudPush(gs: GameState) {
  pending = gs
  if (pushTimer !== null) window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => { pushTimer = null; void flush() }, 4000)
}

// aba escondida/fechando → não perde o que tá na fila
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
}
