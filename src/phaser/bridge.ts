/** Ponte Phaser ⇄ React — eventos + contexto compartilhado. */
import type { Harness } from '../engine/battle'

type Handler = (payload?: unknown) => void

class Bridge {
  private handlers = new Map<string, Set<Handler>>()
  /** contexto vivo lido pelas cenas (React atualiza a cada render) */
  ctx = {
    badges: [] as number[],
    tutorialsDone: [] as string[],
    pos: { x: 20, y: 18 },
    tokens: 0,
    form: 'base' as string,
    clockColor: null as string | null,
  }

  on(ev: string, fn: Handler) {
    if (!this.handlers.has(ev)) this.handlers.set(ev, new Set())
    this.handlers.get(ev)!.add(fn)
    return () => this.handlers.get(ev)?.delete(fn)
  }
  emit(ev: string, payload?: unknown) {
    this.handlers.get(ev)?.forEach((fn) => fn(payload))
  }
}

export const bridge = new Bridge()

export interface BattleParams {
  /** id de missão de ginásio (gym-N) OU taskId selvagem (vira missão 1-fase) */
  missionId?: string
  taskId?: string
  gymId?: string
  party: Harness[]
  budget: number
  tutorial?: boolean
  /** reservas invocáveis pelo orquestrador (agent_invoke) */
  reserves?: Harness[]
  /** modelos desbloqueados (re-harness em combate) */
  unlockedModels?: string[]
  /** passivo por forma do mascote: +5%/estágio */
  formBonus?: number
}

export interface BattleEnd {
  outcome: 'won' | 'lost'
  spent: number
  budget: number
  missionBaseline: number
  gymId?: string
  tutorial?: boolean
}
