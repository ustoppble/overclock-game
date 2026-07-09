/**
 * Pixel art AUTORADA À MÃO — grids ASCII, técnica de sprite real (silhueta forte,
 * 2-3 tons por matiz, outline escuro). Cada char mapeia numa cor da paleta.
 * '.' = transparente.
 */

export interface AuthoredSprite {
  grid: string[]
  palette: Record<string, string>
}

// ── PLAYER — mascote laranja, 16×18, 4 direções × 2 frames ──────────────────
const P = { o: '#FF6B35', d: '#c2410c', s: '#7c2d12', w: '#ffffff', k: '#1c0a04', b: '#451a03', g: '#fbbf24' }

export const PLAYER: Record<string, AuthoredSprite[]> = {
  down: [{
    palette: P, grid: [
      '....g......g....',
      '...gg.gggg.gg...',
      '...ggoooooogg...',
      '..sooooooooos...',
      '..soowwoowwoos..',
      '..soowkoowkoos..',
      '..sooooooooos...',
      '...soodddoos....',
      '....ssssssss....',
      '...sdddddddds...',
      '..ssdddddddss...',
      '..sd.dddddd.ds..',
      '..sd.dddddd.ds..',
      '.....dd..dd.....',
      '.....dd..dd.....',
      '.....bb..bb.....',
      '....bbb..bbb....',
      '................',
    ],
  }, {
    palette: P, grid: [
      '....g......g....',
      '...gg.gggg.gg...',
      '...ggoooooogg...',
      '..sooooooooos...',
      '..soowwoowwoos..',
      '..soowkoowkoos..',
      '..sooooooooos...',
      '...soodddoos....',
      '....ssssssss....',
      '...sdddddddds...',
      '..ssdddddddss...',
      '..sd.dddddd.ds..',
      '..sd.dddddd.ds..',
      '.....dd.dd......',
      '....bb...dd.....',
      '...bbb...bb.....',
      '.........bbb....',
      '................',
    ],
  }],
  up: [{
    palette: P, grid: [
      '....g......g....',
      '...gg.gggg.gg...',
      '...ggoooooogg...',
      '..sooooooooos...',
      '..soooooooooss..',
      '..soooooooooss..',
      '..sooooooooos...',
      '...soooooooo....',
      '....ssssssss....',
      '...sdddddddds...',
      '..ssdddddddss...',
      '..sd.dddddd.ds..',
      '..sd.dddddd.ds..',
      '.....dd..dd.....',
      '.....dd..dd.....',
      '.....bb..bb.....',
      '....bbb..bbb....',
      '................',
    ],
  }, {
    palette: P, grid: [
      '....g......g....',
      '...gg.gggg.gg...',
      '...ggoooooogg...',
      '..sooooooooos...',
      '..soooooooooss..',
      '..soooooooooss..',
      '..sooooooooos...',
      '...soooooooo....',
      '....ssssssss....',
      '...sdddddddds...',
      '..ssdddddddss...',
      '..sd.dddddd.ds..',
      '..sd.dddddd.ds..',
      '.....dd.dd......',
      '....bb...dd.....',
      '...bbb...bb.....',
      '.........bbb....',
      '................',
    ],
  }],
  side: [{
    palette: P, grid: [
      '.....g...g......',
      '....gg.ggg......',
      '....ggooooog....',
      '...soooooooos...',
      '...soooowwoos...',
      '...soooowkoos...',
      '...sooooooos....',
      '....soodddos....',
      '.....ssssss.....',
      '....sddddddds...',
      '...ssdddddddss..',
      '...sddddddddds..',
      '....sdddddds....',
      '......dddd......',
      '.....dd..dd.....',
      '.....bb..bb.....',
      '....bbb..bbb....',
      '................',
    ],
  }, {
    palette: P, grid: [
      '.....g...g......',
      '....gg.ggg......',
      '....ggooooog....',
      '...soooooooos...',
      '...soooowwoos...',
      '...soooowkoos...',
      '...sooooooos....',
      '....soodddos....',
      '.....ssssss.....',
      '....sddddddds...',
      '...ssdddddddss..',
      '...sddddddddds..',
      '....sdddddds....',
      '......dddd......',
      '....dd...dd.....',
      '...bb....bb.....',
      '..bbb....bbb....',
      '................',
    ],
  }],
}

// ── CRIATURAS por domínio (16×16) — 1 identidade por tipo de task ────────────
export const ENEMIES: Record<string, AuthoredSprite> = {
  // 🐛 BUG — besouro verde de olhos vermelhos
  debug: {
    palette: { g: '#4ade80', d: '#15803d', k: '#052e16', r: '#ef4444', w: '#fff', a: '#86efac' },
    grid: [
      '....k......k....',
      '.....k....k.....',
      '..k...kkkk...k..',
      '...k.kggggk.k...',
      '....kgaggagk....',
      '...kgggggggk....',
      '..kgrkggggrkgk..',
      '..kgrrgggrrggk..',
      '..kggggggggggk..',
      '.kgdgdgdgdgdgdk.',
      '.kgddddddddddk..',
      '..kddddddddk....',
      '...kddddddk.....',
      '..k..kkkk..k....',
      '.k..k....k..k...',
      'k...........k...',
    ],
  },
  // 🔧 GEAR-MITE — engrenagem viva cinza/dourada
  mecanico: {
    palette: { g: '#8a929e', d: '#4b5563', k: '#111827', y: '#fbbf24', w: '#fff' },
    grid: [
      '....k..kk..k....',
      '...kgk.gg.kgk...',
      '..kgggkggkgggk..',
      '.k.kggggggggk.k.',
      'kgkgggggggggkgk.',
      '.kggkwwggwwkgg..',
      '.kggkwkggwkkgg..',
      'kggggggggggggggk',
      '.kggggyyyygggg..',
      '.kggggydddgggk..',
      'kgkggggggggkgk..',
      '.k.kggggggkk.k..',
      '..kgggkggkggk...',
      '...kgk.gg.kgk...',
      '....k..kk..k....',
      '................',
    ],
  },
  // ⚛️ PIXEL-IMP — imp azul com chifres de bracket < >
  frontend: {
    palette: { b: '#60a5fa', d: '#1d4ed8', k: '#0c1e46', c: '#22d3ee', w: '#fff' },
    grid: [
      '..c..........c..',
      '.cc..........cc.',
      'cc....kkkk....cc',
      '.c..kkbbbbkk..c.',
      '...kbbbbbbbbk...',
      '..kbbwwbbwwbbk..',
      '..kbbwkbbwkbbk..',
      '..kbbbbbbbbbbk..',
      '...kbbccccbbk...',
      '....kbbbbbbk....',
      '...kddddddddk...',
      '..kdd.dddd.ddk..',
      '..kd..dddd..dk..',
      '......dddd......',
      '.....dd..dd.....',
      '....kk....kk....',
    ],
  },
  // 🎨 TEMPLATE-GHOST — fantasma roxo de cara genérica (sem rosto)
  ux: {
    palette: { p: '#c084fc', d: '#7e22ce', k: '#2e1065', w: '#f3e8ff', r: '#f472b6' },
    grid: [
      '.....kkkkkk.....',
      '...kkppppppkk...',
      '..kppppppppppk..',
      '..kpwwppppwwpk..',
      '.kppwwppppwwppk.',
      '.kpppppppppppk..',
      '.kpppkkkkppppk..',
      '.kppppppppppppk.',
      '.kpdppppppppdpk.',
      '.kpdppppppppdk..',
      '.kppdppppppdppk.',
      '.kppppppppppppk.',
      '..kpp.kpp.kppk..',
      '..kp...pp...pk..',
      '...k...kk...k...',
      '................',
    ],
  },
  // ✍️ QUILL-WISP — pássaro de pergaminho
  copy: {
    palette: { y: '#fbbf24', d: '#b45309', k: '#451a03', w: '#fef3c7', b: '#000' },
    grid: [
      '......kkk.......',
      '.....kyyyk......',
      '....kyywbyk.....',
      '....kyyyyyk.....',
      '..kkkyyyyykkk...',
      '.kwwwyyyyywwwk..',
      'kwwwwyyyyywwwwk.',
      '.kwwyyyyyyywwk..',
      '..kyyyyyyyyyk...',
      '...kyydddyyk....',
      '....kydddyk.....',
      '.....kdddk......',
      '....kkdddkk.....',
      '...k..ddd..k....',
      '......kkk.......',
      '................',
    ],
  },
  // 🔍 OLHO-QA — olho flutuante que tudo vê
  qa: {
    palette: { t: '#2dd4bf', d: '#0f766e', k: '#042f2e', w: '#f0fdfa', b: '#000' },
    grid: [
      '.....kkkkkk.....',
      '...kkttttttkk...',
      '..kttttttttttk..',
      '.ktttwwwwwwtttk.',
      '.kttwwwwwwwwttk.',
      'kttwwwkkkkwwwttk',
      'kttwwkbbbbkwwttk',
      'kttwwkbbbbkwwttk',
      'kttwwwkkkkwwwttk',
      '.kttwwwwwwwwttk.',
      '.ktttwwwwwwtttk.',
      '..kttttttttttk..',
      '...kkttttttkk...',
      '.....kkkkkk.....',
      '...k...kk...k...',
      '..k....kk....k..',
    ],
  },
  // 🧮 CRISTAL — golem de cristal vermelho (denso)
  logica: {
    palette: { r: '#f87171', d: '#991b1b', k: '#450a0a', w: '#fecaca', b: '#000' },
    grid: [
      '.......kk.......',
      '......krrk......',
      '.....krwwrk.....',
      '....krrwwrrk....',
      '...krrrrrrrrk...',
      '..krrwrrrrwrrk..',
      '..krrrrrrrrrrk..',
      '.krrkbbrrbbkrrk.',
      '.krrrbbrrbbrrrk.',
      '.krrrrrrrrrrrrk.',
      '..krdrrddrrdrk..',
      '..kddrrddrrddk..',
      '...kdddddddk....',
      '....kddkddk.....',
      '...kk..kk..kk...',
      '................',
    ],
  },
  // 🔎 SONAR-MOTH — mariposa verde de antenas longas
  pesquisa: {
    palette: { g: '#a3e635', d: '#3f6212', k: '#1a2e05', w: '#ecfccb', b: '#000' },
    grid: [
      'k......kk......k',
      '.k....k..k....k.',
      '..k..k....k..k..',
      '...kk......kk...',
      '..kggk....kggk..',
      '.kggggkkkkggggk.',
      'kggwggkddkggwggk',
      'kgwbwgkddkgwbwgk',
      'kggwggkddkggwggk',
      'kggggkkddkkggggk',
      '.kggk.kddk.kggk.',
      '..kk..kddk..kk..',
      '......kddk......',
      '.......kk.......',
      '................',
      '................',
    ],
  },
}

// ── ROBÔS por role (16×16) — agentes do catálogo ────────────────────────────
export const ROLE_BOTS: Record<string, AuthoredSprite> = {
  // 📡 SCOUT — drone com antena parabólica
  scout: {
    palette: { b: '#38bdf8', d: '#0369a1', k: '#082f49', w: '#e0f2fe', a: '#fbbf24' },
    grid: [
      '......aaa.......',
      '.....a...a......',
      '......aaa.......',
      '.......a........',
      '....kkkakkk.....',
      '...kbbbbbbbk....',
      '..kbbwwbwwbbk...',
      '..kbbwkbwkbbk...',
      '..kbbbbbbbbbk...',
      '...kbdddddbk....',
      '....kkkkkkk.....',
      '...kd.....dk....',
      '..kdd.....ddk...',
      '....k.....k.....',
      '...kk.....kk....',
      '................',
    ],
  },
  // ⚒️ EXECUTOR — robô-forja parrudo
  executor: {
    palette: { o: '#fb923c', d: '#c2410c', k: '#431407', w: '#ffedd5', g: '#57534e' },
    grid: [
      '....kkkkkkkk....',
      '...kooooooook...',
      '..koowwoowwook..',
      '..koowkoowkook..',
      '..kooooooooook..',
      '...koodddooook..',
      '..kkkkkkkkkkkk..',
      '.kgoooooooooogk.',
      'kggkoooooooookgk',
      'kgg.kododdok.ggk',
      'kkk.koddddok.kkk',
      '....kooooook....',
      '.....kk..kk.....',
      '....koo..ook....',
      '....kkk..kkk....',
      '................',
    ],
  },
  // 🛡️ REVIEWER — sentinela com escudo
  reviewer: {
    palette: { p: '#a78bfa', d: '#6d28d9', k: '#2e1065', w: '#ede9fe', s: '#fbbf24' },
    grid: [
      '.....kkkkkk.....',
      '....kppppppk....',
      '...kppwwpwwpk...',
      '...kppwkpwkpk...',
      '...kppppppppk...',
      '....kpddddpk....',
      '..kkkkkkkkkkkk..',
      '.kspppppppppp.k.',
      'kssspppppppppsk.',
      'ksssspppppppssk.',
      'kssspdppppdpssk.',
      '.ksspddppddpsk..',
      '..kspppppppsk...',
      '...kpp....ppk...',
      '...kkk....kkk...',
      '................',
    ],
  },
  // ★ ESPECIAL — maestro de batuta
  especial: {
    palette: { r: '#f43f5e', d: '#9f1239', k: '#4c0519', w: '#ffe4e6', g: '#fbbf24' },
    grid: [
      '..........g.....',
      '.........g......',
      '....kkkkg.......',
      '...krrrrk.......',
      '..krrwwrwwk.....',
      '..krrwkrwkk.....',
      '..krrrrrrrk.....',
      '...krdddrk......',
      '..kkkkkkkkkk....',
      '.kdrrrrrrrrdk...',
      'kd.krrrrrrk.dk..',
      'k..krrrrrrk..k..',
      '...kdrrrrdk.....',
      '....kd..dk......',
      '...kkk..kkk.....',
      '................',
    ],
  },
}

/** Desenha grid ASCII no canvas com escala inteira + shading opcional. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: AuthoredSprite,
  x: number, y: number, size: number,
  opts: { flip?: boolean; tint?: string } = {},
) {
  const rows = sprite.grid.length
  const cols = sprite.grid[0]?.length ?? 16
  const px = size / Math.max(rows, cols)
  ctx.save()
  if (opts.flip) { ctx.translate(x + size, y); ctx.scale(-1, 1); x = 0; y = 0 }
  for (let r = 0; r < rows; r++) {
    const row = sprite.grid[r]
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (ch === '.') continue
      const color = opts.tint && (ch === 'w' || ch === 'a' || ch === 'g') ? opts.tint : sprite.palette[ch]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(Math.round(x + c * px), Math.round(y + r * px), Math.ceil(px), Math.ceil(px))
    }
  }
  ctx.restore()
}
