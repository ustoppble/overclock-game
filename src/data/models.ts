/**
 * Stats de modelos ancorados em benchmarks públicos (jul/2026):
 * llm-stats.com, LMArena (categorias), WebDev Arena, Design Arena.
 * Números normalizados pra escala de jogo — proporções preservadas.
 */
export type Domain = 'ux' | 'frontend' | 'copy' | 'debug' | 'qa' | 'logica' | 'mecanico' | 'pesquisa'

export interface GameModel {
  id: string
  name: string
  vendor: 'anthropic' | 'google' | 'openai' | 'deepseek'
  tier: 1 | 2 | 3 | 4 // 1=budget, 4=lendário
  /** 0-100 por domínio — derivado das arenas por categoria */
  stats: Record<Domain, number>
  /** golpes por turno (velocidade real c/s → 1..3) */
  hits: number
  /** tokens queimados por turno de trabalho (por effort=medium) */
  costPerTurn: number
  /** custo pra desbloquear no catálogo */
  unlockCost: number
  /** reasoning bruto — abaixo de 55 alucina em task densa */
  reasoning: number
  flavor: string
}

export const MODELS: GameModel[] = [
  {
    id: 'haiku', name: 'Haiku 4.5', vendor: 'anthropic', tier: 1,
    stats: { ux: 35, frontend: 45, copy: 40, debug: 48, qa: 40, logica: 42, mecanico: 85, pesquisa: 55 },
    hits: 3, costPerTurn: 120, unlockCost: 0, reasoning: 42,
    flavor: 'Rápido e barato. Carrega o early game. Não pense grande com ele.',
  },
  {
    id: 'flash', name: 'Gemini 3 Flash', vendor: 'google', tier: 1,
    stats: { ux: 50, frontend: 62, copy: 45, debug: 52, qa: 70, logica: 48, mecanico: 90, pesquisa: 60 },
    hits: 3, costPerTurn: 150, unlockCost: 800, reasoning: 47,
    flavor: '221 c/s. O mais veloz do jogo — 3 golpes por turno. Visão afiada.',
  },
  {
    id: 'deepseek', name: 'DeepSeek V3.2', vendor: 'deepseek', tier: 1,
    stats: { ux: 40, frontend: 55, copy: 42, debug: 60, qa: 45, logica: 88, mecanico: 70, pesquisa: 50 },
    hits: 2, costPerTurn: 90, unlockCost: 1200, reasoning: 54,
    flavor: 'O azarão. Math arena não perdoa: lógica de elite pelo preço de um café.',
  },
  {
    id: 'sonnet', name: 'Sonnet 5', vendor: 'anthropic', tier: 2,
    stats: { ux: 62, frontend: 70, copy: 65, debug: 72, qa: 60, logica: 64, mecanico: 75, pesquisa: 68 },
    hits: 2, costPerTurn: 400, unlockCost: 2500, reasoning: 62,
    flavor: 'O equilibrado. Melhor custo-benefício do cardápio — resolve 90% do jogo.',
  },
  {
    id: 'gemini-pro', name: 'Gemini 3.1 Pro', vendor: 'google', tier: 2,
    stats: { ux: 78, frontend: 82, copy: 60, debug: 68, qa: 85, logica: 66, mecanico: 60, pesquisa: 72 },
    hits: 2, costPerTurn: 350, unlockCost: 3000, reasoning: 55,
    flavor: 'Vision arena é dele. Código barato e forte, QA visual devastador.',
  },
  {
    id: 'gpt', name: 'GPT-5.5', vendor: 'openai', tier: 3,
    stats: { ux: 72, frontend: 78, copy: 80, debug: 75, qa: 65, logica: 74, mecanico: 55, pesquisa: 75 },
    hits: 1, costPerTurn: 700, unlockCost: 5000, reasoning: 59,
    flavor: 'All-rounder caro. Copy forte, nunca decepciona, nunca é a melhor escolha óbvia.',
  },
  {
    id: 'opus', name: 'Opus 4.8', vendor: 'anthropic', tier: 3,
    stats: { ux: 70, frontend: 85, copy: 75, debug: 88, qa: 68, logica: 80, mecanico: 50, pesquisa: 80 },
    hits: 1, costPerTurn: 800, unlockCost: 6000, reasoning: 63,
    flavor: 'Tier pesado padrão. WebDev arena no topo. Raciocínio denso é o habitat dele.',
  },
  {
    id: 'fable', name: 'Fable 5', vendor: 'anthropic', tier: 4,
    stats: { ux: 80, frontend: 92, copy: 85, debug: 96, qa: 75, logica: 90, mecanico: 45, pesquisa: 85 },
    hits: 1, costPerTurn: 1500, unlockCost: 15000, reasoning: 67,
    flavor: 'O lendário. Coding arena head-to-head: imbatível. Quase impagável.',
  },
]

export const EFFORTS = {
  low: { label: 'low', mult: 0.6, costMult: 0.5 },
  medium: { label: 'medium', mult: 1.0, costMult: 1.0 },
  high: { label: 'high', mult: 1.5, costMult: 2.2 },
} as const
export type EffortId = keyof typeof EFFORTS

export const DOMAIN_INFO: Record<Domain, { label: string; emoji: string; arena: string }> = {
  ux: { label: 'UX / Design', emoji: '🎨', arena: 'Design Arena' },
  frontend: { label: 'Frontend', emoji: '⚛️', arena: 'WebDev Arena' },
  copy: { label: 'Copy / Criativo', emoji: '✍️', arena: 'Creative Writing Arena' },
  debug: { label: 'Código / Debug', emoji: '🐛', arena: 'Coding Arena' },
  qa: { label: 'QA Visual', emoji: '🔍', arena: 'Vision Arena' },
  logica: { label: 'Lógica / Math', emoji: '🧮', arena: 'Math Arena' },
  mecanico: { label: 'Mecânico', emoji: '🔧', arena: 'Throughput (llm-stats)' },
  pesquisa: { label: 'Pesquisa', emoji: '🔎', arena: 'Search Arena' },
}
