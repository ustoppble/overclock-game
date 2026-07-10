/**
 * O mundo: a "IDE-terra" do Overclock. Tilemap ASCII autorado à mão.
 * Legenda:
 *  # muro/void  . caminho  , grama deco  g MATO ALTO (encontros)  T árvore
 *  w água  C porta Catálogo  A porta Arena  1-6 portas de ginásio
 *  a b c   NPCs (diálogo)  x y   treinadores-tutorial  S spawn
 */
export const MAP_W = 46
export const MAP_H = 32

export const WORLD = [
  '##############################################',
  '#TTTTTTTTT,,,,ggggggggggggg,,,,TTTTTTTTTTTTTT#',
  '#TggggggT,,,gggggggggggggggg,,,,,,,,,,,,,,,,T#',
  '#TgggggT,,,ggggggggggggggggggg,,,####,,,####T#',
  '#Tggggg,,,,ggggggggggggggggggg,,,#44#,,,#55#T#',
  '#Tggggg,,,,,,gggggggggggggg,,,,,,#4.#,,,#5.#T#',
  '#Tggggg,,,,,,,,,....,,,,,,,,,,,,,,.,,,,,,.,,T#',
  '#Tggggg,,,,,,,,,,..,,,,,,,,,,,,,,,.,,,,,,.,,T#',
  '#Tggg,,,......a...........,........,,,,,,.,,T#',
  '#TTTT,,,.,,,,,,,,,..,,,,,,,.,,,,,,,,,,,,,.,,T#',
  '#T,,,,,,.,,,,,,,,,..,,,,,,,.,,,,,,,......,,,T#',
  '#T,####,.,,,,,####..####,,,.,,,####,.,,,,,,,T#',
  '#T,#33#,.,,,,,#CC#..#AA#,,,.,,,#66#,.,,,,,,,T#',
  '#T,#3.#,.,,,,,#C.#..#A.#,,,.,,,#6.#,.,,,,,,,T#',
  '#T,,.,,,.,,,,,,.,,,,,.,,,,,.,,,,.,,,.,,,,,,,T#',
  '#T,,.....,,,,,,.,,,,,.,,,,,.,,,,.,,,.,,,,,,,T#',
  '#T,,,,,,,,,,,,,......b......,,,,....,,,,,,,,T#',
  '#T,,,,,,,,,,,,,.,,,,,,,,,,,.,,,,,,,,,,,,,,,,T#',
  '#TTTTT,,,,,,,,,.,,,,S,,,,,,.,,,,,wwww,,,,,,,T#',
  '#Tggggg,,,,,,,,......x......,,,,wwwwww,,,,,,T#',
  '#Tggggggg,,,,,,.,,,,,,,,,,,.,,,,wwwwww,,,,,,T#',
  '#Tggggggggg,,,,.,,,,,,,,,,,.,,,,,wwww,,,,,,,T#',
  '#Tggggggggggg,,.,,,,####,,,.,,,,,,,,,,,,,,,,T#',
  '#Tggggggggggg,,.,,,,#11#,,,.,,,,,,,gggggggggT#',
  '#Tggggggggggg,,.,,,,#1.#,,,.,,,,,gggggggggggT#',
  '#Tggggggggg,,,,.,,,,,.,,,,,.,,,ggggggggggggnT#',
  '#Tggggggg,,,,,,.......,,,,,.,,gggggggggggggnT#',
  '#TTggggg,,,,,,,,,,,,.,,,,,,.,ggggggggggggggnT#',
  '#TTTggg,,,,,####,,,,.,,,,,,y,,gggggggggggggnT#',
  '#TTTTggc,,,,#22#,,,,.,,,,,,,,,,,ggggggggggggT#',
  '#TTTTTT,,,,,#2.#,,,,.,,,,,,,,,,,,,,,,,,,,,,,T#',
  '##############################################',
]

export type TileKind = 'wall' | 'path' | 'grass' | 'tallgrass' | 'tree' | 'water' | 'door' | 'npc' | 'spawn'

export interface Trigger {
  kind: 'gym' | 'catalog' | 'arena' | 'npc' | 'trainer'
  id: string
  x: number
  y: number
}

export function tileAt(x: number, y: number): string {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return '#'
  return WORLD[y][x] ?? '#'
}

export function isSolid(ch: string): boolean {
  return ch === '#' || ch === 'T' || ch === 'w' || /[1-6]/.test(ch) === false && ch === '#'
}

export function walkable(ch: string): boolean {
  // portas (dígitos, C, A) são "andáveis" — pisar nelas dispara o trigger
  return ch === '.' || ch === ',' || ch === 'g' || ch === 'S' || ch === 'x' || ch === 'y' ||
    ch === 'a' || ch === 'b' || ch === 'c' || ch === 'n' || /[1-6]/.test(ch) || ch === 'C' || ch === 'A'
}

export function findSpawn(): { x: number; y: number } {
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (WORLD[y][x] === 'S') return { x, y }
  return { x: 20, y: 18 }
}

/** Zonas de encontro por região do mapa — pool de tasks por área. */
export function encounterPool(x: number, y: number): string[] {
  if (x < 12 && y < 10) return ['typo-swarm', 'bug-comum', 'mercado'] // campos NO — fáceis
  if (y < 8) return ['typo-swarm', 'copy-fraca', 'mercado', 'bug-comum'] // rota norte
  if (x < 15 && y >= 19) return ['heisenbug', 'algoritmo', 'refactor-golem'] // Floresta Legacy (SO) — denso!
  if (x >= 29 && y >= 23) return ['regressao', 'design-generico', 'landing', 'legacy'] // brejo SE
  return ['bug-comum', 'copy-fraca', 'regressao']
}

export const ENCOUNTER_RATE = 0.14

export interface NpcDef { ch: string; name: string; lines: string[] }
export const NPCS: Record<string, NpcDef> = {
  a: {
    ch: 'a', name: 'Veterana do Terminal',
    lines: [
      'Bem-vindo à Terminal City, orquestrador.',
      'Regra número 1: você NUNCA luta. Você monta o HARNESS — agente + modelo + effort + skills — e DESPACHA.',
      'O mato alto está cheio de tasks selvagens. Tipo errado de harness = tokens queimados à toa.',
    ],
  },
  b: {
    ch: 'b', name: 'Mestre das Receitas',
    lines: [
      'Harness que venceu com nota S merece virar RECEITA.',
      'No Overclock de verdade, receitas alimentam o modo Agêntico — formações prontas, 1 clique.',
      'A oeste fica a Floresta Legacy. Tasks DENSAS. Não entre com modelo fraco: elas fazem você ALUCINAR.',
    ],
  },
  c: {
    ch: 'c', name: 'Eremita do Legado',
    lines: [
      '...este código... ninguém sabe por que funciona...',
      'Mandei um haiku·low refatorar isso. Ele alucinou por 3 dias. Inventou uma API inteira.',
      'Task densa pede reasoning alto. Opus. Fable se tiver coragem no bolso. Aprenda comigo, não com a falência.',
    ],
  },
  n: {
    ch: 'n', name: 'Placa enferrujada',
    lines: ['⚠ BREJO DA REGRESSÃO — aqui o pixel quebra sozinho. Leve um reviewer com Vision. Gemini enxerga o que você não vê.'],
  },
}

export const TRAINERS: Record<string, { name: string; taskId: string; intro: string }> = {
  x: { name: 'Instrutor Fable', taskId: 'typo-swarm', intro: 'Ei, novato! Toma meu FABLE·high emprestado contra este enxame de typos. Sente o PODER... e depois olha a CONTA.' },
  y: { name: 'Instrutora Haiku', taskId: 'algoritmo', intro: 'Agora o contrário: HAIKU·low contra um algoritmo DENSO. Vai. Quero que você VEJA a alucinação de perto.' },
}

/** Ginásios: porta n exige n-1 insígnias. Boss = último desafio do capítulo n. */
export const GYM_BOSSES: Record<string, { chapter: number; taskId: string; leader: string }> = {
  '1': { chapter: 1, taskId: 'rename-golem', leader: 'oc-magpie, a gralha — GINÁSIO CINEMA SITE' },
  '2': { chapter: 2, taskId: 'landing', leader: 'oc-mason, o pedreiro-mestre — GINÁSIO APP FACTORY' },
  '3': { chapter: 3, taskId: 'heisenbug', leader: 'oc-bloodhound, o farejador — GINÁSIO SAAS 10K' },
  '4': { chapter: 4, taskId: 'refactor-golem', leader: 'oc-marauder, o scout — GINÁSIO AUTOPILOT' },
  '5': { chapter: 5, taskId: 'legacy', leader: 'oc-arcade, o mestre do juice — GINÁSIO ARCADE' },
  '6': { chapter: 6, taskId: 'hallucination-prime', leader: 'oc-inquisitor — GO-LIVE, a elite' },
}
