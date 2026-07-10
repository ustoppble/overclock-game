/**
 * Presença multiplayer do mundo aberto — segura o WorldClient enquanto a tela
 * 'world' está ativa e faz a ponte React ⇄ WorldScene via bridge (eventos w:*).
 * O wmatch devolve um code de sala duo → onMatch leva pro fluxo PvP existente.
 */
import { useEffect, useRef } from 'react'
import { WorldClient, type Dir, type WorldEvent, type WorldPlayer } from '../engine/worldLive'
import { bridge } from '../phaser/bridge'

interface Opts {
  active: boolean
  name: string
  skin: string | null
  form: string
  hasSquad: boolean
  pos: { x: number; y: number }
  onMatch: (code: string) => void
}

export function useWorldLive({ active, name, skin, form, hasSquad, pos, onMatch }: Opts) {
  const onMatchRef = useRef(onMatch)
  onMatchRef.current = onMatch
  const formRef = useRef(form)
  formRef.current = form

  useEffect(() => {
    if (!active) return
    let disposed = false
    const players = new Map<string, WorldPlayer>()

    const client = new WorldClient((e: WorldEvent) => {
      if (disposed) return
      if (e.t === 'open') client.join({ name, x: pos.x, y: pos.y, skin, form: formRef.current, hasSquad })
      else if (e.t === 'wstate') {
        players.clear()
        e.players.forEach((p) => players.set(p.id, p))
        bridge.emit('w:snapshot', e.players)
      }
      else if (e.t === 'wenter') { players.set(e.player.id, e.player); bridge.emit('w:enter', e.player) }
      else if (e.t === 'wmove') {
        const p = players.get(e.id)
        if (p) { p.x = e.x; p.y = e.y; p.dir = e.dir; p.form = e.form }
        bridge.emit('w:move', e)
      }
      else if (e.t === 'wleave') { players.delete(e.id); bridge.emit('w:leave', { id: e.id }) }
      else if (e.t === 'wchallenged') bridge.emit('w:challenged', { id: e.from.id, name: e.from.name })
      else if (e.t === 'wdeclined') bridge.emit('w:toast', '✖ desafio recusado (ou expirou)')
      else if (e.t === 'wmatch') onMatchRef.current(e.code)
      else if (e.t === 'err') bridge.emit('w:toast', `⚠ ${e.msg}`)
    })
    client.connect()

    const offs = [
      // cena re-criada (scene.restart) pede o estado de novo
      bridge.on('w:scene-ready', () => bridge.emit('w:snapshot', [...players.values()])),
      bridge.on('move', (p) => {
        const m = p as { x: number; y: number; dir?: Dir }
        client.move(m.x, m.y, m.dir ?? 'down', formRef.current)
      }),
      bridge.on('w:challenge', (id) => client.challenge(id as string)),
      bridge.on('w:answer', (p) => {
        const a = p as { id: string; accept: boolean }
        if (a.accept) client.accept(a.id)
        else client.decline(a.id)
      }),
    ]

    return () => {
      disposed = true
      offs.forEach((off) => off())
      client.close()
    }
    // reconecta só quando entra/sai da tela world — nome/skin/squad são fixos na sessão de mundo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
