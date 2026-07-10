/**
 * Telemetria de gameplay — eventos insert-only na tabela game_events (Brain).
 * Cliente só escreve (RLS sem policy de select); leitura é pelo painel/SQL.
 * Fila batched: flush a cada 10s ou quando a aba esconde — nunca 1 request por evento.
 */
import { supabase, ensureSession } from './cloudSave'

interface QueuedEvent {
  event: string
  props: Record<string, unknown>
}

const queue: QueuedEvent[] = []
let flushTimer: number | null = null

async function flush() {
  if (queue.length === 0) return
  const batch = queue.splice(0, queue.length)
  try {
    const userId = await ensureSession()
    if (!userId) return
    await supabase.from('game_events').insert(
      batch.map((e) => ({ user_id: userId, event: e.event, props: e.props })),
    )
  } catch { /* telemetria nunca quebra o jogo */ }
}

/** Registra um evento de gameplay (batched, fire-and-forget). */
export function track(event: string, props: Record<string, unknown> = {}) {
  queue.push({ event: event.slice(0, 48), props })
  if (flushTimer === null) {
    flushTimer = window.setTimeout(() => { flushTimer = null; void flush() }, 10_000)
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
}
