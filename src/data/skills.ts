import type { Domain } from './models'

export interface GameSkill {
  id: string
  name: string
  domains: Domain[]
  power: number
  desc: string
}

export const SKILLS: GameSkill[] = [
  { id: 'debug-sistematico', name: 'systematic-debugging', domains: ['debug'], power: 42, desc: 'Reproduz o bug antes de corrigir. Devastador contra código quebrado.' },
  { id: 'code-review', name: 'code-review', domains: ['debug', 'frontend'], power: 36, desc: 'Revisão cirúrgica. Forte contra bugs e frontend malfeito.' },
  { id: 'frontend-design', name: 'frontend-design', domains: ['frontend', 'ux'], power: 38, desc: 'Interfaces com intenção. Forte em frontend e UX.' },
  { id: 'ui-audit', name: 'accessibility-audit', domains: ['ux', 'qa'], power: 34, desc: 'Auditoria visual e de acessibilidade.' },
  { id: 'headline', name: 'headline-matrix', domains: ['copy'], power: 40, desc: 'Headlines que convertem. Só serve pra copy — e aí é brutal.' },
  { id: 'copy-kill', name: 'generic-language-killer', domains: ['copy', 'ux'], power: 32, desc: 'Mata texto genérico. Copy e microcopy de UX.' },
  { id: 'deep-research', name: 'deep-research', domains: ['pesquisa'], power: 44, desc: 'Varredura multi-fonte com verificação adversarial.' },
  { id: 'web-search', name: 'web-search', domains: ['pesquisa', 'qa'], power: 30, desc: 'Busca ampla e rápida.' },
  { id: 'refactor-plan', name: 'writing-plans', domains: ['logica', 'debug'], power: 38, desc: 'Plano antes do código. Essencial em raciocínio denso.' },
  { id: 'math-proof', name: 'ultra-think', domains: ['logica'], power: 45, desc: 'Análise estruturada multi-framework. Lógica pura.' },
  { id: 'batch-convert', name: 'batch-transform', domains: ['mecanico'], power: 40, desc: 'Transformação em massa. Rename, parse, regex — trivial e volumoso.' },
  { id: 'lint-fix', name: 'lint-fix', domains: ['mecanico', 'frontend'], power: 30, desc: 'Correções mecânicas de estilo e build.' },
  { id: 'screenshot-diff', name: 'webapp-testing', domains: ['qa'], power: 42, desc: 'Navega, screenshota, compara. QA visual de verdade.' },
  { id: 'seo', name: 'seo-optimizer', domains: ['copy', 'pesquisa'], power: 28, desc: 'Conteúdo que rankeia.' },
  { id: 'verify', name: 'verification-before-completion', domains: ['qa', 'debug'], power: 34, desc: 'Nada é "pronto" sem evidência.' },
  { id: 'simplify', name: 'code-simplifier', domains: ['frontend', 'logica'], power: 32, desc: '200 linhas que cabem em 50.' },
]

export const skillById = (id: string): GameSkill => {
  const s = SKILLS.find((s) => s.id === id)
  if (!s) throw new Error(`skill desconhecida: ${id}`)
  return s
}
