import type { Domain } from './models'

export interface GameTask {
  id: string
  name: string
  emoji: string
  domain: Domain
  /** task de raciocínio denso — modelo fraco alucina contra ela */
  dense?: boolean
  hp: number
  /** dano por turno no seu budget de tokens */
  attack: number
  attackName: string
  /** baseline de tokens pra nota de eficiência */
  baseline: number
  intro: string
}

export const TASKS: GameTask[] = [
  { id: 'typo-swarm', name: 'Enxame de Typos', emoji: '🐜', domain: 'mecanico', hp: 60, attack: 60, attackName: 'ACÚMULO DE DÍVIDA', baseline: 500, intro: 'Um ENXAME DE TYPOS selvagem apareceu! 200 arquivos, mesmo erro.' },
  { id: 'rename-golem', name: 'Rename em Massa', emoji: '🗂️', domain: 'mecanico', hp: 90, attack: 70, attackName: 'CONFLITO DE IMPORT', baseline: 800, intro: 'RENAME EM MASSA bloqueia o caminho! API mudou de nome no repo inteiro.' },
  { id: 'bug-comum', name: 'Bug Selvagem', emoji: '🐛', domain: 'debug', hp: 110, attack: 90, attackName: 'STACK TRACE CRÍPTICO', baseline: 1500, intro: 'Um BUG SELVAGEM apareceu! Funciona na minha máquina.' },
  { id: 'heisenbug', name: 'Heisenbug', emoji: '👻', domain: 'debug', dense: true, hp: 160, attack: 120, attackName: 'SOME NO LOG', baseline: 4000, intro: 'Um HEISENBUG apareceu! Só quebra quando ninguém olha.' },
  { id: 'landing', name: 'Landing Page', emoji: '🖼️', domain: 'frontend', hp: 130, attack: 80, attackName: 'PIXEL QUEBRADO', baseline: 2500, intro: 'LANDING PAGE precisa nascer! O deploy é hoje.' },
  { id: 'design-generico', name: 'Interface Genérica', emoji: '🫥', domain: 'ux', hp: 120, attack: 85, attackName: 'CARA DE TEMPLATE', baseline: 2500, intro: 'INTERFACE GENÉRICA assombra o produto! Parece feita por IA preguiçosa.' },
  { id: 'copy-fraca', name: 'Copy Sem Alma', emoji: '📄', domain: 'copy', hp: 100, attack: 75, attackName: 'BOUNCE RATE', baseline: 2000, intro: 'COPY SEM ALMA infesta a home! "Soluções inovadoras para o seu negócio."' },
  { id: 'mercado', name: 'Pesquisa de Mercado', emoji: '🗺️', domain: 'pesquisa', hp: 115, attack: 70, attackName: 'FONTE DUVIDOSA', baseline: 1800, intro: 'PESQUISA DE MERCADO exige resposta! 40 fontes, 3 confiáveis.' },
  { id: 'regressao', name: 'Regressão Visual', emoji: '📸', domain: 'qa', hp: 125, attack: 85, attackName: 'DIFF DE 1PX', baseline: 2200, intro: 'REGRESSÃO VISUAL detectada! Algo mudou e ninguém sabe o quê.' },
  { id: 'algoritmo', name: 'Algoritmo Guloso', emoji: '🧮', domain: 'logica', dense: true, hp: 150, attack: 110, attackName: 'CASO DE BORDA', baseline: 3500, intro: 'ALGORITMO GULOSO desafia você! O(n²) onde devia ser O(n log n).' },
  { id: 'refactor-golem', name: 'Refactor Golem', emoji: '🗿', domain: 'logica', dense: true, hp: 220, attack: 140, attackName: 'EFEITO CASCATA', baseline: 8000, intro: 'O REFACTOR GOLEM desperta! 12 módulos acoplados, zero testes.' },
  { id: 'legacy', name: 'Código Legado', emoji: '🏚️', domain: 'debug', dense: true, hp: 260, attack: 150, attackName: 'GAMBIARRA ANCESTRAL', baseline: 9000, intro: 'CÓDIGO LEGADO bloqueia tudo! Comentário: "não mexer, ninguém sabe por quê".' },
  { id: 'hallucination-prime', name: 'Hallucination Prime', emoji: '🌀', domain: 'logica', dense: true, hp: 300, attack: 170, attackName: 'FATO INVENTADO', baseline: 12000, intro: 'HALLUCINATION PRIME se materializa! Ele cita papers que não existem.' },
]

export const taskById = (id: string): GameTask => {
  const t = TASKS.find((t) => t.id === id)
  if (!t) throw new Error(`task desconhecida: ${id}`)
  return t
}

// ── Capítulos — onboarding do produto disfarçado ─────────────────────────────
export type NodeKind = 'battle' | 'boss' | 'catalog' | 'arena' | 'lesson'

export interface MapNode {
  id: string
  kind: NodeKind
  label: string
  taskId?: string
  /** id de agente liberado como recompensa */
  rewardAgent?: string
  lesson?: string
}

export interface Chapter {
  id: number
  title: string
  concept: string
  badge: string
  nodes: MapNode[]
}

export const CHAPTERS: Chapter[] = [
  {
    id: 1, title: 'Modo Livre', concept: 'Pane, modelo, custo de token', badge: '🅛',
    nodes: [
      { id: 'c1-l', kind: 'lesson', label: 'Boas-vindas', lesson: 'Você é o ORQUESTRADOR. No Overclock, cada agente vive num PANE. Você nunca executa o trabalho — você escolhe QUEM executa e COMO. Isso se chama montar o HARNESS: agente + modelo + effort + skills. Tokens são sua vida: gaste bem.' },
      { id: 'c1-t1', kind: 'battle', label: 'Tutorial 1 — bazuca no mosquito', taskId: 'typo-swarm' },
      { id: 'c1-t2', kind: 'battle', label: 'Tutorial 2 — faca no golem', taskId: 'algoritmo' },
      { id: 'c1-b1', kind: 'battle', label: 'Missão: Bug Selvagem', taskId: 'bug-comum' },
      { id: 'c1-boss', kind: 'boss', label: 'Desafio: Rename em Massa', taskId: 'rename-golem' },
    ],
  },
  {
    id: 2, title: 'Primeiro Worker', concept: 'pane_spawn, delegar, delegation gate', badge: '🅦',
    nodes: [
      { id: 'c2-l', kind: 'lesson', label: 'Delegation Gate', lesson: 'No Overclock o orquestrador tem DELEGATION GATE: sem Edit, sem Write, sem Bash. Ele delega via pane_spawn e agent_invoke. No jogo é igual — você não ataca; você despacha. Task grande demais pra um agente? Invoque outro no meio da luta (custa 1 turno).' },
      { id: 'c2-cat', kind: 'catalog', label: 'Catálogo — instale agentes' },
      { id: 'c2-b1', kind: 'battle', label: 'Missão: Copy Sem Alma', taskId: 'copy-fraca' },
      { id: 'c2-b2', kind: 'battle', label: 'Missão: Pesquisa de Mercado', taskId: 'mercado' },
      { id: 'c2-boss', kind: 'boss', label: 'Desafio: Landing Page', taskId: 'landing' },
    ],
  },
  {
    id: 3, title: 'Squad', concept: 'scout → executor → reviewer, rotação (429)', badge: '🅢',
    nodes: [
      { id: 'c3-l', kind: 'lesson', label: 'Roles', lesson: 'Um SQUAD tem roles: SCOUT pesquisa antes, EXECUTOR entrega completo, REVIEWER valida no fim. E atenção ao RATE LIMIT: usar o mesmo agente sem parar = 429, ele pula turno. Rotacione. O produto real funciona igual — workers invocados sob demanda.' },
      { id: 'c3-b1', kind: 'battle', label: 'Missão: Regressão Visual', taskId: 'regressao' },
      { id: 'c3-b2', kind: 'battle', label: 'Missão: Interface Genérica', taskId: 'design-generico' },
      { id: 'c3-boss', kind: 'boss', label: 'Desafio: Heisenbug', taskId: 'heisenbug', rewardAgent: 'maestro-jr' },
    ],
  },
  {
    id: 4, title: 'Harness Fino', concept: 'Modelo/effort certo por tipo — benchmarks reais', badge: '🅗',
    nodes: [
      { id: 'c4-l', kind: 'lesson', label: 'A Matriz', lesson: 'O coração do Overclock: o HARNESS é escolhido pelo TIPO da task, não fixo por agente. Mecânico → modelo veloz/barato. Denso → modelo forte, effort high. Os stats deste jogo vêm de arenas REAIS (LMArena, WebDev, Design, Vision, Math). Sonnet resolve 90%. Fable é pro que sobra.' },
      { id: 'c4-cat', kind: 'catalog', label: 'Catálogo — tiers de modelo' },
      { id: 'c4-b1', kind: 'battle', label: 'Missão: Algoritmo Guloso', taskId: 'algoritmo' },
      { id: 'c4-b2', kind: 'battle', label: 'Missão: Enxame de Typos', taskId: 'typo-swarm' },
      { id: 'c4-boss', kind: 'boss', label: 'Desafio: Refactor Golem', taskId: 'refactor-golem' },
    ],
  },
  {
    id: 5, title: 'Receitas', concept: 'Harness salvo, 1 clique', badge: '🅡',
    nodes: [
      { id: 'c5-l', kind: 'lesson', label: 'Receitas', lesson: 'Harness que funcionou vira RECEITA: formação pronta pra objetivo recorrente. No jogo: depois de vencer com nota S ou A, salve o loadout na tela de PREP. No app real: cardápio de receitas + intake autofill do modo Agêntico.' },
      { id: 'c5-arena', kind: 'arena', label: 'Arena — agentes se desafiam' },
      { id: 'c5-b1', kind: 'battle', label: 'Missão: Regressão Visual II', taskId: 'regressao' },
      { id: 'c5-boss', kind: 'boss', label: 'Desafio: Código Legado', taskId: 'legacy' },
    ],
  },
  {
    id: 6, title: 'Modo Agêntico', concept: 'Chefes, Cadeia vs Torre de Controle', badge: '🅐',
    nodes: [
      { id: 'c6-l', kind: 'lesson', label: 'Chefes', lesson: 'No modo AGÊNTICO você invoca CHEFES de área — scout, builder, reviewer (estilo Cadeia) ou controller (Torre de Controle). Chefes decompõem e despacham workers. É o nível final de orquestração.' },
      { id: 'c6-b1', kind: 'battle', label: 'Missão: Heisenbug II', taskId: 'heisenbug' },
      { id: 'c6-boss', kind: 'boss', label: 'A RELEASE: Hallucination Prime', taskId: 'hallucination-prime', rewardAgent: 'chef' },
    ],
  },
]
