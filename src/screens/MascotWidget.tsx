/** Mascote do jogo — mesmo SpriteRenderer do app, forma dirigida pelo XP + cor custom. */
import { SpriteRenderer, FORMS_INFO } from '../mascot/SpriteRenderer'
import type { AnimationState, FormId } from '../mascot/types'

const RAGE_BY_FORM: Record<FormId, number> = { base: 120, boost: 320, turbo: 560, overdrive: 800, redline: 1000 }

function shade(hex: string, f = 0.55): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function MascotWidget({ form, animation, size = 96, color = null }: { form: FormId; animation: AnimationState; size?: number; color?: string | null }) {
  const base = FORMS_INFO[form]
  const info = color ? { ...base, primaryColor: color, secondaryColor: shade(color) } : base
  return (
    <div className="mascot-box" style={{ width: size, height: size }} title={`Overclock — ${info.namePT}`}>
      {/* key força re-render quando a cor muda (SpriteRenderer só reage a form.id) */}
      <SpriteRenderer key={color ?? 'std'} compact form={info} animation={animation} rageLevel={RAGE_BY_FORM[form]} isMuted={false} />
    </div>
  )
}
