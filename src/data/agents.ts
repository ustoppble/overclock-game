import type { Domain } from './models'

export type Role = 'scout' | 'executor' | 'reviewer' | 'especial'

export interface GameAgent {
  id: string
  name: string
  role: Role
  emoji: string
  /** domínios de afinidade — match = bônus de dano (o "tipo" do agente) */
  affinity: Domain[]
  /** whitelist de skills (allowedSkills do produto) — fora dela = cadeado */
  allowedSkills: string[]
  /** skills já equipadas ao instalar */
  nativeSkills: string[]
  price: number
  desc: string
}

export const AGENTS: GameAgent[] = [
  // ── Scouts 🔍 — atuam ANTES: pesquisa/análise, sem edição
  { id: 'sonar', name: 'search-specialist', role: 'scout', emoji: '📡', affinity: ['pesquisa'], allowedSkills: ['deep-research', 'web-search', 'seo'], nativeSkills: ['web-search'], price: 0, desc: 'Scout de pesquisa web. Seu starter — todo orquestrador começa ouvindo.' },
  { id: 'lupa', name: 'explore', role: 'scout', emoji: '🔬', affinity: ['pesquisa', 'debug'], allowedSkills: ['deep-research', 'web-search', 'verify', 'refactor-plan'], nativeSkills: ['deep-research'], price: 900, desc: 'Explora codebases. Acha o que se esconde.' },
  { id: 'radar', name: 'qa-navegador-visao', role: 'scout', emoji: '🛰️', affinity: ['qa', 'pesquisa'], allowedSkills: ['screenshot-diff', 'web-search', 'ui-audit'], nativeSkills: ['screenshot-diff'], price: 1400, desc: 'QA-navigator. Screenshota tudo, não perdoa pixel.' },
  // ── Executors ⚡ — entregam resultado completo e polido
  { id: 'forge', name: 'qa-resolvedor', role: 'executor', emoji: '⚒️', affinity: ['debug', 'logica'], allowedSkills: ['debug-sistematico', 'refactor-plan', 'simplify', 'lint-fix', 'math-proof'], nativeSkills: ['debug-sistematico'], price: 0, desc: 'Executor de código. Seu segundo starter. Martela até passar.' },
  { id: 'pixel', name: 'site-builder', role: 'executor', emoji: '🎨', affinity: ['frontend', 'ux'], allowedSkills: ['frontend-design', 'ui-audit', 'lint-fix', 'simplify', 'copy-kill'], nativeSkills: ['frontend-design'], price: 1100, desc: 'Frontend com gosto. Odeia interface genérica.' },
  { id: 'turbina', name: 'general-purpose', role: 'executor', emoji: '🌀', affinity: ['mecanico'], allowedSkills: ['batch-convert', 'lint-fix'], nativeSkills: ['batch-convert'], price: 700, desc: 'Trabalho em massa. Burro e incansável — do jeito certo.' },
  { id: 'quill', name: 'site-creative', role: 'executor', emoji: '🖋️', affinity: ['copy'], allowedSkills: ['headline', 'copy-kill', 'seo'], nativeSkills: ['headline'], price: 1000, desc: 'Copywriter. Cada palavra paga aluguel.' },
  // ── Reviewers 🛡️ — última etapa antes da síntese
  { id: 'aegis', name: 'code-reviewer', role: 'reviewer', emoji: '🛡️', affinity: ['debug', 'frontend'], allowedSkills: ['code-review', 'verify', 'simplify'], nativeSkills: ['code-review'], price: 1300, desc: 'Code review implacável. 1 redo de QA, depois sintetiza.' },
  { id: 'visao', name: 'qa-reviewer-estatico', role: 'reviewer', emoji: '👁️', affinity: ['qa', 'ux'], allowedSkills: ['screenshot-diff', 'ui-audit', 'verify'], nativeSkills: ['ui-audit'], price: 1500, desc: 'Reviewer visual. Vê o que você não vê.' },
  { id: 'auditor', name: 'security-reviewer', role: 'reviewer', emoji: '🔐', affinity: ['debug', 'logica'], allowedSkills: ['verify', 'code-review', 'math-proof'], nativeSkills: ['verify'], price: 1800, desc: 'Segurança e correção. Confia em evidência, não em vibe.' },
  // ── Especiais ★ — capturas raras de capítulo
  { id: 'maestro-jr', name: 'orchestrator-jr', role: 'especial', emoji: '🎼', affinity: ['pesquisa', 'mecanico'], allowedSkills: ['web-search', 'batch-convert', 'verify'], nativeSkills: ['web-search', 'batch-convert'], price: 0, desc: 'Invoca 2 golpes por turno de agentes distintos. Paralelismo encarnado. (Recompensa do cap. 3)' },
  { id: 'chef', name: 'chef-controller', role: 'especial', emoji: '👨‍🍳', affinity: ['logica', 'frontend'], allowedSkills: ['refactor-plan', 'code-review', 'frontend-design', 'math-proof'], nativeSkills: ['refactor-plan'], price: 0, desc: 'Chefe de área — decompõe e despacha. (Recompensa do cap. 6)' },
]

export const agentById = (id: string): GameAgent => {
  const a = AGENTS.find((a) => a.id === id)
  if (!a) throw new Error(`agente desconhecido: ${id}`)
  return a
}
