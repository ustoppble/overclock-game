/** Missões multi-fase (bosses de ginásio) — o inimigo é uma ENTREGA complexa. */
import type { Domain } from './models'

export interface MissionPhase {
  id: string
  name: string
  domain: Domain
  dense?: boolean
  hp: number
  /** invisível até um scout revelar */
  hidden?: boolean
  /** ONDA de dependência: fases da mesma onda são paralelizáveis; onda futura = fora de sequência */
  wave: number
}

export interface SquadMission {
  id: string
  name: string
  intro: string
  attack: number
  attackName: string
  baseline: number
  phases: MissionPhase[]
}

export const MISSIONS: SquadMission[] = [
  {
    id: 'gym-1', name: 'Onda de Débito Técnico', baseline: 2500,
    intro: 'GINÁSIO MECÂNICO! Uma onda de trabalho braçal — vence quem gasta POUCO.',
    attack: 70, attackName: 'ACÚMULO',
    phases: [
      { id: 'p1', name: 'Typos em Massa', domain: 'mecanico', hp: 70, wave: 1 },
      { id: 'p2', name: 'Imports Quebrados', domain: 'mecanico', hp: 80, wave: 1 },
      { id: 'p3', name: 'Lint Furioso', domain: 'frontend', hp: 60, wave: 2 },
    ],
  },
  {
    id: 'gym-2', name: 'Landing Page Premium', baseline: 6000,
    intro: 'O cliente quer AWWWARDS. Briefing nebuloso, deploy é hoje.',
    attack: 90, attackName: 'MUDANÇA DE ESCOPO',
    phases: [
      { id: 'p1', name: 'Briefing Nebuloso', domain: 'pesquisa', hp: 70, wave: 1 },
      { id: 'p2', name: 'Direção Visual', domain: 'ux', hp: 90, wave: 2 },
      { id: 'p3', name: 'Copy da Hero', domain: 'copy', hp: 80, wave: 2 },
      { id: 'p4', name: 'Build do Front', domain: 'frontend', hp: 110, wave: 3 },
      { id: 'p5', name: 'Bugs Escondidos', domain: 'qa', hp: 70, hidden: true, wave: 4 },
    ],
  },
  {
    id: 'gym-3', name: 'Caçada ao Heisenbug', baseline: 8000,
    intro: 'GINÁSIO RATE LIMIT! O bug some quando você olha. E o líder pune agente repetido.',
    attack: 110, attackName: '429 DO LÍDER',
    phases: [
      { id: 'p1', name: 'Reproduzir o Bug', domain: 'pesquisa', hp: 90, wave: 1 },
      { id: 'p2', name: 'Isolar a Causa', domain: 'debug', dense: true, hp: 130, wave: 2 },
      { id: 'p3', name: 'Corrigir sem Quebrar', domain: 'debug', hp: 100, wave: 3 },
      { id: 'p4', name: 'Regressão Fantasma', domain: 'qa', hp: 80, hidden: true, wave: 4 },
    ],
  },
  {
    id: 'gym-4', name: 'O Grande Refactor', baseline: 12000,
    intro: 'GINÁSIO REFACTOR! 12 módulos acoplados. Modelo fraco ALUCINA aqui dentro.',
    attack: 130, attackName: 'EFEITO CASCATA',
    phases: [
      { id: 'p1', name: 'Mapear Acoplamento', domain: 'pesquisa', hp: 100, wave: 1 },
      { id: 'p2', name: 'Plano de Ataque', domain: 'logica', dense: true, hp: 140, wave: 2 },
      { id: 'p3', name: 'Executar a Cirurgia', domain: 'debug', dense: true, hp: 160, wave: 3 },
      { id: 'p4', name: 'Provar que Funciona', domain: 'qa', hp: 90, wave: 4 },
    ],
  },
  {
    id: 'gym-5', name: 'Sprint de 3 Entregas', baseline: 11000,
    intro: 'GINÁSIO DAS RECEITAS! 3 entregas encadeadas, 1 squad só. Receita salva = vida.',
    attack: 100, attackName: 'DEADLINE',
    phases: [
      { id: 'p1', name: 'Relatório Executivo', domain: 'copy', hp: 90, wave: 1 },
      { id: 'p2', name: 'Dashboard de Métricas', domain: 'frontend', hp: 120, wave: 1 },
      { id: 'p3', name: 'Auditoria de Segurança', domain: 'logica', dense: true, hp: 130, wave: 1 },
      { id: 'p4', name: 'Review Final', domain: 'qa', hp: 80, hidden: true, wave: 2 },
    ],
  },
  {
    id: 'gym-6', name: 'A RELEASE', baseline: 16000,
    intro: 'A ELITE. Hallucination Prime lidera a release final. Tudo que você aprendeu, junto.',
    attack: 150, attackName: 'FATO INVENTADO',
    phases: [
      { id: 'p1', name: 'Escopo da Release', domain: 'pesquisa', hp: 110, wave: 1 },
      { id: 'p2', name: 'Feature Crítica', domain: 'logica', dense: true, hp: 170, wave: 2 },
      { id: 'p3', name: 'Site do Lançamento', domain: 'ux', hp: 120, wave: 2 },
      { id: 'p4', name: 'Copy do Anúncio', domain: 'copy', hp: 100, wave: 2 },
      { id: 'p5', name: 'Hallucination Prime', domain: 'debug', dense: true, hp: 200, hidden: true, wave: 3 },
    ],
  },
]

export const missionById = (id: string): SquadMission => {
  const m = MISSIONS.find((m) => m.id === id)
  if (!m) throw new Error(`missão desconhecida: ${id}`)
  return m
}

/** Task selvagem vira missão de 1 fase — UM sistema de batalha só (estilo Chrono Trigger). */
import { taskById } from './tasks'
export function taskAsMission(taskId: string): SquadMission {
  const t = taskById(taskId)
  return {
    id: `wild-${t.id}`, name: t.name, intro: t.intro,
    attack: t.attack, attackName: t.attackName, baseline: t.baseline,
    phases: [{ id: 'p1', name: t.name, domain: t.domain, dense: t.dense, hp: t.hp, wave: 1 }],
  }
}
