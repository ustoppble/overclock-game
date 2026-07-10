/** Monta o Phaser.Game uma vez e troca de cena conforme a tela do React. */
import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { WorldScene } from './WorldScene'
import { BattleScene } from './BattleScene'
import { PvpArenaScene, type PvpArenaParams } from './PvpArenaScene'
import type { BattleParams } from './bridge'

let game: Phaser.Game | null = null

function bindScaleParent(gameInstance: Phaser.Game, parent: HTMLElement) {
  if (gameInstance.canvas && gameInstance.canvas.parentElement !== parent) {
    parent.appendChild(gameInstance.canvas)
  }

  if (!gameInstance.isBooted || !gameInstance.canvas || !parent.isConnected) return

  const bounds = parent.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0) return

  // O Phaser guarda a referência do primeiro parent recebido. Como cada tela
  // React monta um PhaserHost novo, mover apenas o canvas deixa o ScaleManager
  // medindo o host antigo (0x0 depois do unmount).
  gameInstance.scale.parent = parent
  gameInstance.scale.parentIsWindow = false
  gameInstance.scale.getParentBounds()
  gameInstance.scale.refresh()
}

function ensureGame(parent: HTMLElement): Phaser.Game {
  if (game && !game.isBooted) { game.destroy(true); game = null }
  if (!game) {
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: 918,
      height: 560,
      backgroundColor: '#0a0810',
      pixelArt: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [WorldScene, BattleScene, PvpArenaScene],
    })
    ;(window as unknown as { __game?: Phaser.Game }).__game = game
  } else {
    bindScaleParent(game, parent)
  }
  return game
}

interface PhaserHostProps {
  mode: 'world' | 'battle' | 'pvp'
  battleParams?: BattleParams | null
  pvpParams?: PvpArenaParams | null
}

export function PhaserHost({ mode, battleParams, pvpParams }: PhaserHostProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const parent = ref.current
    const g = ensureGame(parent)
    let resizeFrame = 0

    const refreshScale = () => bindScaleParent(g, parent)
    const queueScaleRefresh = () => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(refreshScale)
    }

    const resizeObserver = new ResizeObserver(queueScaleRefresh)
    resizeObserver.observe(parent)

    const switchScene = () => {
      refreshScale()
      const world = g.scene.getScene('World')
      const battle = g.scene.getScene('Battle')
      const pvp = g.scene.getScene('PvpArena')
      if (mode === 'pvp' && pvpParams) {
        if (world && g.scene.isActive('World')) g.scene.stop('World')
        if (battle && g.scene.isActive('Battle')) g.scene.stop('Battle')
        if (pvp && g.scene.isActive('PvpArena')) g.scene.stop('PvpArena')
        g.scene.start('PvpArena', pvpParams)
      } else if (mode === 'battle' && battleParams) {
        if (world && g.scene.isActive('World')) g.scene.stop('World')
        if (pvp && g.scene.isActive('PvpArena')) g.scene.stop('PvpArena')
        if (battle && g.scene.isActive('Battle')) g.scene.stop('Battle')
        g.scene.start('Battle', battleParams)
      } else {
        if (battle && g.scene.isActive('Battle')) g.scene.stop('Battle')
        if (pvp && g.scene.isActive('PvpArena')) g.scene.stop('PvpArena')
        // sempre (re)inicia o mundo: re-lê posição, forma e COR do clockinho do bridge.ctx
        if (g.scene.isActive('World')) g.scene.getScene('World').scene.restart()
        else g.scene.start('World')
      }
      queueScaleRefresh()
    }
    if (g.isBooted) switchScene()
    else g.events.once('ready', switchScene)
    return () => {
      cancelAnimationFrame(resizeFrame)
      resizeObserver.disconnect()
      g.events.off('ready', switchScene)
      if (mode === 'pvp' && g.isBooted && g.scene.isActive('PvpArena')) g.scene.stop('PvpArena')
    }
  }, [mode, battleParams, pvpParams])

  return <div ref={ref} className="phaser-host" />
}

/** Para o mundo quando o React assume (menus) — o jogo continua montado. */
export function pausePhaser() {
  if (!game) return
  if (game.scene.isActive('World')) game.scene.pause('World')
}
