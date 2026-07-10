/**
 * Mundo aberto AO VIVO — presença + desafio 1x1 via WebSocket.
 * Mesmo relay do PvP (canal w*): o servidor guarda posição de todo mundo,
 * repassa movimento e pareia desafios numa sala "duo" que reusa o protocolo
 * de duelo existente (o wmatch devolve um code pro fluxo de join do PvpLive).
 */
import { wsUrl } from './pvpLive'

export type Dir = 'up' | 'down' | 'left' | 'right'

export interface WorldPlayer {
  id: string
  name: string
  x: number
  y: number
  dir: Dir
  skin: string | null
  form: string
  hasSquad: boolean
}

export type WorldEvent =
  | { t: 'open' }
  | { t: 'closed' }
  | { t: 'wstate'; you: string; players: WorldPlayer[] }
  | { t: 'wenter'; player: WorldPlayer }
  | { t: 'wmove'; id: string; x: number; y: number; dir: Dir; form: string }
  | { t: 'wleave'; id: string }
  | { t: 'wchallenged'; from: { id: string; name: string } }
  | { t: 'wchallenge-sent'; to: string }
  | { t: 'wdeclined'; id?: string }
  | { t: 'wmatch'; code: string }
  | { t: 'err'; msg: string }

export interface WorldJoinInfo {
  name: string
  x: number
  y: number
  skin: string | null
  form: string
  hasSquad: boolean
}

export class WorldClient {
  private ws: WebSocket | null = null
  private handler: (e: WorldEvent) => void

  constructor(handler: (e: WorldEvent) => void) {
    this.handler = handler
  }

  connect() {
    this.ws = new WebSocket(wsUrl())
    this.ws.onopen = () => this.handler({ t: 'open' })
    this.ws.onclose = () => this.handler({ t: 'closed' })
    this.ws.onerror = () => { /* onclose cobre */ }
    this.ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data as string)
        if (m.t === 'wstate') this.handler({ t: 'wstate', you: m.you, players: m.players })
        else if (m.t === 'wenter') this.handler({ t: 'wenter', player: m.player })
        else if (m.t === 'wmove') this.handler({ t: 'wmove', id: m.id, x: m.x, y: m.y, dir: m.dir, form: m.form })
        else if (m.t === 'wleave') this.handler({ t: 'wleave', id: m.id })
        else if (m.t === 'wchallenged') this.handler({ t: 'wchallenged', from: m.from })
        else if (m.t === 'wchallenge-sent') this.handler({ t: 'wchallenge-sent', to: m.to })
        else if (m.t === 'wdeclined') this.handler({ t: 'wdeclined', id: m.id })
        else if (m.t === 'wmatch') this.handler({ t: 'wmatch', code: m.code })
        else if (m.t === 'err') this.handler({ t: 'err', msg: m.msg })
      } catch { /* ignora frame inválido */ }
    }
  }

  private send(obj: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj))
  }
  join(info: WorldJoinInfo) { this.send({ t: 'wjoin', ...info }) }
  move(x: number, y: number, dir: Dir, form: string) { this.send({ t: 'wmove', x, y, dir, form }) }
  challenge(to: string) { this.send({ t: 'wchallenge', to }) }
  accept(to: string) { this.send({ t: 'waccept', to }) }
  decline(to: string) { this.send({ t: 'wdecline', to }) }
  close() { this.ws?.close(); this.ws = null }
}
