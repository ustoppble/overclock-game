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
    id: 'gym-1', name: 'CINEMA SITE', baseline: 4000,
    intro: 'GINÁSIO CINEMA SITE! "Rouba o DNA da referência. Entrega uma produção de cinema." Template de IA não passa desta porta.',
    attack: 80, attackName: 'MUDANÇA DE ESCOPO',
    phases: [
      { id: 'p1', name: 'Roubo do DNA da Referência', domain: 'pesquisa', hp: 70, wave: 1 },
      { id: 'p2', name: 'Copy da Oferta', domain: 'copy', hp: 70, wave: 1 },
      { id: 'p3', name: 'Styleboard — aprova a Alma antes do Build', domain: 'ux', hp: 80, wave: 2 },
      { id: 'p4', name: 'Build Premium', domain: 'frontend', hp: 100, wave: 3 },
      { id: 'p5', name: 'Imagens Próprias (nunca stock)', domain: 'ux', hp: 60, wave: 3 },
      { id: 'p6', name: 'QA em 3 Lentes', domain: 'qa', hp: 70, hidden: true, wave: 4 },
    ],
  },
  {
    id: 'gym-2', name: 'APP FACTORY', baseline: 7000,
    intro: 'GINÁSIO APP FACTORY! "Backend e frontend em paralelo. Contra o contrato, não um contra o outro."',
    attack: 95, attackName: 'SCHEMA DRIFT',
    phases: [
      { id: 'p1', name: 'Contrato de Dados', domain: 'logica', dense: true, hp: 90, wave: 1 },
      { id: 'p2', name: 'Backend Seguro (RLS)', domain: 'logica', hp: 110, wave: 2 },
      { id: 'p3', name: 'Tela: Kanban Denso', domain: 'frontend', hp: 100, wave: 2 },
      { id: 'p4', name: 'Tela: CRUD', domain: 'frontend', hp: 70, wave: 2 },
      { id: 'p5', name: 'Integrador liga Front↔Back', domain: 'debug', hp: 90, wave: 3 },
      { id: 'p6', name: 'Fluxo Quebrado', domain: 'qa', hp: 80, hidden: true, wave: 4 },
    ],
  },
  {
    id: 'gym-3', name: 'SAAS 10K', baseline: 10000,
    intro: 'GINÁSIO SAAS 10K! "O app inteiro do APP FACTORY. E de cima, o cofre." Quem cobra, protege cada tenant.',
    attack: 115, attackName: 'CVE CRÍTICO',
    phases: [
      { id: 'p1', name: 'Multi-tenant de Fábrica', domain: 'logica', dense: true, hp: 120, wave: 1 },
      { id: 'p2', name: 'Auditor: Auth', domain: 'debug', hp: 90, wave: 2 },
      { id: 'p3', name: 'Auditor: Vazamento entre Tenants', domain: 'qa', hp: 90, wave: 2 },
      { id: 'p4', name: 'Auditor: Webhook de Billing', domain: 'logica', hp: 90, wave: 2 },
      { id: 'p5', name: 'Veredito + Fix + Re-audit Cirúrgico', domain: 'debug', hp: 110, wave: 3 },
      { id: 'p6', name: 'CVE Escondido', domain: 'debug', dense: true, hp: 100, hidden: true, wave: 4 },
    ],
  },
  {
    id: 'gym-4', name: 'AUTOPILOT', baseline: 12000,
    intro: 'GINÁSIO AUTOPILOT! "Roda de madrugada. Te acorda só se quebrar." Automação sem alarme é bomba-relógio.',
    attack: 125, attackName: 'FONTE FORA DO AR',
    phases: [
      { id: 'p1', name: 'Scout: Fonte A', domain: 'pesquisa', hp: 90, wave: 1 },
      { id: 'p2', name: 'Scout: Fonte B', domain: 'pesquisa', hp: 90, wave: 1 },
      { id: 'p3', name: 'Script + Cron + Log', domain: 'mecanico', hp: 130, wave: 2 },
      { id: 'p4', name: 'Falha Induzida — o Alarme Dispara?', domain: 'qa', hp: 110, hidden: true, wave: 3 },
      { id: 'p5', name: 'Run das 3h da Manhã', domain: 'qa', hp: 100, wave: 4 },
    ],
  },
  {
    id: 'gym-5', name: 'ARCADE', baseline: 13000,
    intro: 'GINÁSIO ARCADE! "Jogável em uma sessão. Com vídeo do bot jogando pra provar." JUICE não é opcional.',
    attack: 135, attackName: 'NÃO DIVERTE',
    phases: [
      { id: 'p1', name: 'Mecânica em 3 Frases + Style Block', domain: 'ux', dense: true, hp: 120, wave: 1 },
      { id: 'p2', name: 'Build do Jogo (juice!)', domain: 'frontend', dense: true, hp: 150, wave: 2 },
      { id: 'p3', name: 'Asset: Sprites', domain: 'ux', hp: 80, wave: 2 },
      { id: 'p4', name: 'Asset: Sons', domain: 'mecanico', hp: 70, wave: 2 },
      { id: 'p5', name: 'Bot Joga e Grava o Vídeo', domain: 'qa', hp: 100, wave: 3 },
      { id: 'p6', name: 'Decisão nos Primeiros 30s?', domain: 'ux', hp: 110, hidden: true, wave: 4 },
    ],
  },
  {
    id: 'gym-6', name: 'GO-LIVE', baseline: 16000,
    intro: 'GO-LIVE. A elite. As 5 receitas juntas numa entrega só — e Hallucination Prime esperando no fim.',
    attack: 150, attackName: 'FATO INVENTADO',
    phases: [
      { id: 'p1', name: 'Escopo do Go-Live', domain: 'pesquisa', hp: 110, wave: 1 },
      { id: 'p2', name: 'App de Verdade', domain: 'logica', dense: true, hp: 150, wave: 2 },
      { id: 'p3', name: 'Site do Lançamento', domain: 'frontend', hp: 120, wave: 2 },
      { id: 'p4', name: 'Copy do Anúncio', domain: 'copy', hp: 100, wave: 2 },
      { id: 'p5', name: 'Auditoria Final', domain: 'debug', dense: true, hp: 130, wave: 3 },
      { id: 'p6', name: 'Hallucination Prime', domain: 'debug', dense: true, hp: 200, hidden: true, wave: 4 },
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
