/**
 * Seeded night-sky layout for the host TV backdrop.
 * Coordinates live in one repeating tile so every aspect ratio
 * shows the same density — the canvas just reveals more or less of it.
 */

export const TILE_W = 1680
export const TILE_H = 980

/** CSS pixels per second. Near layer moves faster than the dust. */
export const SKY_DRIFT = {
  farX: 3.6,
  farY: 0.9,
  nearX: 7.4,
  nearY: 1.8,
} as const

const MARGIN = 48

export type StarTint = 'white' | 'cool' | 'warm'

export interface FieldStar {
  x: number
  y: number
  /** Core radius in CSS pixels. The sprite halo is larger. */
  r: number
  a: number
  tint: StarTint
  /** 0 = steady. Added as a sine amplitude around the base alpha. */
  twinkle: number
  phase: number
  /** Radians per second. */
  speed: number
}

export interface FieldEdge {
  x1: number
  y1: number
  x2: number
  y2: number
  a: number
  width: number
  warm: boolean
}

export interface StarLayer {
  stars: FieldStar[]
  edges: FieldEdge[]
}

export interface ConstellationField {
  far: StarLayer
  near: StarLayer
}

export interface GoldStar {
  /** Offset as a fraction of the cluster reach, roughly -1..1. */
  ux: number
  uy: number
  r: number
  a: number
  tint: StarTint
  twinkle: number
  phase: number
  speed: number
}

export interface GoldEdge {
  a: number
  b: number
  alpha: number
}

export interface GoldCluster {
  stars: GoldStar[]
  edges: GoldEdge[]
}

interface Rng {
  (): number
}

function mulberry32(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Figure {
  pts: ReadonlyArray<readonly [number, number]>
  edges: ReadonlyArray<readonly [number, number]>
}

/** Unit-space figures. Edges are index pairs so branches stay intentional. */
const FIGURES: ReadonlyArray<Figure> = [
  {
    pts: [
      [0.04, 0.58],
      [0.22, 0.22],
      [0.4, 0.46],
      [0.58, 0.14],
      [0.76, 0.34],
      [0.96, 0.2],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ],
  },
  {
    pts: [
      [0.16, 0.06],
      [0.1, 0.38],
      [0.34, 0.56],
      [0.62, 0.36],
      [0.9, 0.62],
      [0.7, 0.9],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 5],
    ],
  },
  {
    pts: [
      [0.02, 0.42],
      [0.2, 0.16],
      [0.38, 0.5],
      [0.56, 0.24],
      [0.74, 0.58],
      [0.94, 0.36],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ],
  },
  {
    pts: [
      [0.12, 0.72],
      [0.28, 0.3],
      [0.56, 0.14],
      [0.86, 0.4],
      [0.68, 0.78],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [1, 4],
    ],
  },
  {
    pts: [
      [0.18, 0.22],
      [0.5, 0.06],
      [0.74, 0.4],
      [0.38, 0.5],
      [0.62, 0.86],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4],
    ],
  },
]

function inside(x: number, y: number): boolean {
  return x >= MARGIN && y >= MARGIN && x <= TILE_W - MARGIN && y <= TILE_H - MARGIN
}

function stampFigure(
  layer: StarLayer,
  fig: Figure,
  cx: number,
  cy: number,
  scale: number,
  rot: number,
  lineAlpha: number,
  rng: Rng,
): void {
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  let placed: Array<{ x: number; y: number }> | null = null
  let s = scale

  for (let attempt = 0; attempt < 7; attempt++) {
    const pts = fig.pts.map(([u, v]) => {
      const px = (u - 0.5) * s
      const py = (v - 0.5) * s
      return {
        x: cx + px * cos - py * sin,
        y: cy + px * sin + py * cos,
      }
    })
    if (pts.every((p) => inside(p.x, p.y))) {
      placed = pts
      break
    }
    s *= 0.86
  }

  if (!placed) return

  placed.forEach((p, i) => {
    const anchor = i === 0
    layer.stars.push({
      x: p.x,
      y: p.y,
      r: anchor ? 2.05 + rng() * 0.25 : 1.25 + rng() * 0.55,
      a: anchor ? 0.96 : 0.78 + rng() * 0.18,
      tint: anchor ? 'white' : rng() > 0.62 ? 'white' : 'cool',
      twinkle: anchor ? 0.16 : 0.08 + rng() * 0.06,
      phase: rng() * Math.PI * 2,
      speed: 0.28 + rng() * 0.45,
    })
  })

  for (const [a, b] of fig.edges) {
    const p = placed[a]
    const q = placed[b]
    if (!p || !q) continue
    layer.edges.push({
      x1: p.x,
      y1: p.y,
      x2: q.x,
      y2: q.y,
      a: lineAlpha,
      width: 1.05,
      warm: false,
    })
  }
}

function toroidalFar(stars: FieldStar[], x: number, y: number, minD: number): boolean {
  const min2 = minD * minD
  for (const s of stars) {
    let dx = Math.abs(s.x - x)
    let dy = Math.abs(s.y - y)
    if (dx > TILE_W / 2) dx = TILE_W - dx
    if (dy > TILE_H / 2) dy = TILE_H - dy
    if (dx * dx + dy * dy < min2) return false
  }
  return true
}

function scatterDust(layer: StarLayer, rng: Rng, count: number, avoid: FieldStar[]): void {
  const pool = avoid.concat(layer.stars)
  let made = 0
  let tries = 0
  while (made < count && tries < count * 40) {
    tries++
    const x = MARGIN + rng() * (TILE_W - MARGIN * 2)
    const y = MARGIN + rng() * (TILE_H - MARGIN * 2)
    if (!toroidalFar(pool, x, y, 62)) continue
    const roll = rng()
    const tiny = roll < 0.58
    const bright = roll > 0.9
    const star: FieldStar = {
      x,
      y,
      r: tiny ? 0.45 + rng() * 0.35 : bright ? 1.55 + rng() * 0.7 : 0.95 + rng() * 0.4,
      a: tiny ? 0.28 + rng() * 0.22 : bright ? 0.82 + rng() * 0.18 : 0.5 + rng() * 0.28,
      tint: rng() > 0.82 ? 'white' : 'cool',
      twinkle: bright ? 0.14 : tiny ? 0.04 : 0.08,
      phase: rng() * Math.PI * 2,
      speed: 0.22 + rng() * 0.4,
    }
    layer.stars.push(star)
    pool.push(star)
    made++
  }
}

function weave(layer: StarLayer, from: number): void {
  const degree = new Array(layer.stars.length).fill(0)
  for (let i = from; i < layer.stars.length; i++) {
    if (degree[i] >= 2) continue
    let best = -1
    let bestD = 210
    const a = layer.stars[i]
    if (!a) continue
    for (let j = i + 1; j < layer.stars.length; j++) {
      if (degree[j] >= 2) continue
      const b = layer.stars[j]
      if (!b) continue
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d > 46 && d < bestD) {
        bestD = d
        best = j
      }
    }
    if (best < 0) continue
    const b = layer.stars[best]
    if (!b) continue
    degree[i]++
    degree[best]++
    const fade = 1 - (bestD - 46) / (210 - 46)
    layer.edges.push({
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      a: 0.045 + fade * 0.045,
      width: 0.65,
      warm: false,
    })
  }
}

function stampBinary(
  layer: StarLayer,
  x: number,
  y: number,
  len: number,
  rot: number,
  rng: Rng,
): void {
  const x2 = x + Math.cos(rot) * len
  const y2 = y + Math.sin(rot) * len
  if (!inside(x, y) || !inside(x2, y2)) return
  const pair: FieldStar[] = [
    {
      x,
      y,
      r: 1.35 + rng() * 0.3,
      a: 0.88,
      tint: 'white',
      twinkle: 0.1,
      phase: rng() * Math.PI * 2,
      speed: 0.4,
    },
    {
      x: x2,
      y: y2,
      r: 1.05 + rng() * 0.3,
      a: 0.74,
      tint: 'cool',
      twinkle: 0.08,
      phase: rng() * Math.PI * 2,
      speed: 0.33,
    },
  ]
  layer.stars.push(...pair)
  layer.edges.push({
    x1: x,
    y1: y,
    x2,
    y2,
    a: 0.2,
    width: 1,
    warm: false,
  })
}

export function buildConstellationField(): ConstellationField {
  const rng = mulberry32(0x5a17c0de)
  const far: StarLayer = { stars: [], edges: [] }
  const near: StarLayer = { stars: [], edges: [] }

  // Distant, fainter figure — sits on the slow layer.
  const distant = FIGURES[2]
  if (distant) {
    stampFigure(far, distant, 860, 500, 500, 0.06, 0.12, rng)
  }

  const foreground: Array<[number, number, number, number, number, number]> = [
    [0, 400, 250, 340, -0.22, 0.3],
    [1, 1220, 270, 320, 0.38, 0.24],
    [3, 460, 730, 280, 0.28, 0.26],
    [4, 1180, 730, 250, -0.42, 0.22],
    [1, 780, 250, 260, 0.7, 0.16],
  ]
  for (const [figIndex, cx, cy, scale, rot, alpha] of foreground) {
    const fig = FIGURES[figIndex]
    if (!fig) continue
    stampFigure(near, fig, cx, cy, scale, rot + (rng() - 0.5) * 0.05, alpha, rng)
  }

  stampBinary(near, 210, 520, 78, 0.55, rng)
  stampBinary(near, 1480, 560, 86, -0.7, rng)
  stampBinary(far, 250, 860, 70, 0.3, rng)

  const dustStart = far.stars.length
  scatterDust(far, rng, 46, near.stars)
  weave(far, dustStart)

  return { far, near }
}

export function buildGoldCluster(): GoldCluster {
  const rng = mulberry32(0x601dc0de)
  const stars: GoldStar[] = []

  const push = (ux: number, uy: number, r: number, a: number, tint: StarTint, twinkle: number) => {
    stars.push({
      ux,
      uy,
      r,
      a,
      tint,
      twinkle,
      phase: rng() * Math.PI * 2,
      speed: 0.25 + rng() * 0.35,
    })
  }

  push(0.02, -0.04, 2.4, 1, 'warm', 0.12)
  push(-0.22, 0.12, 1.7, 0.9, 'warm', 0.1)
  push(0.28, 0.16, 1.55, 0.86, 'white', 0.1)
  push(0.08, -0.34, 1.35, 0.8, 'warm', 0.08)
  push(-0.38, -0.18, 1.2, 0.72, 'warm', 0.08)
  push(0.42, -0.12, 1.15, 0.7, 'white', 0.06)

  for (let i = 0; i < 12; i++) {
    const ang = rng() * Math.PI * 2
    const rad = 0.25 + rng() * 0.72
    push(
      Math.cos(ang) * rad,
      Math.sin(ang) * rad,
      0.45 + rng() * 0.7,
      0.35 + rng() * 0.4,
      rng() > 0.35 ? 'warm' : 'white',
      0.05,
    )
  }

  return {
    stars,
    edges: [
      { a: 0, b: 1, alpha: 0.34 },
      { a: 0, b: 2, alpha: 0.3 },
      { a: 0, b: 3, alpha: 0.26 },
      { a: 1, b: 4, alpha: 0.22 },
      { a: 2, b: 5, alpha: 0.2 },
    ],
  }
}
