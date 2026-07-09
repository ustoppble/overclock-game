/** Monta o Phaser.Game uma vez e troca de cena conforme a tela do React. */
import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { WorldScene } from './WorldScene'
import { BattleScene } from './BattleScene'
import type { BattleParams } from './bridge'

let game: Phaser.Game | null = null

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
      scene: [WorldScene, BattleScene],
    })
    ;(window as unknown as { __game?: Phaser.Game }).__game = game
  } else if (game.canvas && game.canvas.parentElement !== parent) {
    parent.appendChild(game.canvas)
  }
  return game
}

export function PhaserHost({ mode, battleParams }: { mode: 'world' | 'battle'; battleParams?: BattleParams | null }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const g = ensureGame(ref.current)
    const switchScene = () => {
      const world = g.scene.getScene('World')
      const battle = g.scene.getScene('Battle')
      if (mode === 'battle' && battleParams) {
        if (world && g.scene.isActive('World')) g.scene.stop('World')
        if (battle && g.scene.isActive('Battle')) g.scene.stop('Battle')
        g.scene.start('Battle', battleParams)
      } else {
        if (battle && g.scene.isActive('Battle')) g.scene.stop('Battle')
        // sempre (re)inicia o mundo: re-lê posição, forma e COR do clockinho do bridge.ctx
        if (g.scene.isActive('World')) g.scene.getScene('World').scene.restart()
        else g.scene.start('World')
      }
    }
    if (g.isBooted) switchScene()
    else g.events.once('ready', switchScene)
  }, [mode, battleParams])

  return <div ref={ref} className="phaser-host" />
}

/** Para o mundo quando o React assume (menus) — o jogo continua montado. */
export function pausePhaser() {
  if (!game) return
  if (game.scene.isActive('World')) game.scene.pause('World')
}
