import { Matchup } from './types'

export interface LayoutNode {
  id: number
  round: number
  x: number
  y: number
  matchup: Matchup
}

export interface LayoutEdge {
  from: number
  to: number
  points: [number, number][]
}

export interface BracketLayout {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  minX: number
  maxX: number
  minY: number
  maxY: number
  maxRound: number
}

export const layoutBracket = (
  matchups: Matchup[],
  colGap = 3.9,
  rowGap = 2.45
): BracketLayout => {
  const nodes: LayoutNode[] = []
  const byId = new Map<number, LayoutNode>()
  const r0 = matchups.filter(m => m.round === 0).sort((a, b) => a.id - b.id)

  r0.forEach((m, i) => {
    const node: LayoutNode = {
      id: m.id,
      round: 0,
      x: 0,
      y: (i - (r0.length - 1) / 2) * rowGap,
      matchup: m,
    }
    nodes.push(node)
    byId.set(m.id, node)
  })

  const maxRound = matchups.reduce((max, m) => Math.max(max, m.round), 0)
  for (let r = 1; r <= maxRound; r++) {
    const list = matchups.filter(m => m.round === r).sort((a, b) => a.id - b.id)
    for (const m of list) {
      const feeders = matchups.filter(f => f.feedsTo === m.id)
      const ys = feeders.map(f => byId.get(f.id)?.y ?? 0)
      const y = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0
      const node: LayoutNode = {
        id: m.id,
        round: r,
        x: r * colGap,
        y,
        matchup: m,
      }
      nodes.push(node)
      byId.set(m.id, node)
    }
  }

  const edges: LayoutEdge[] = []
  for (const m of matchups) {
    if (m.feedsTo == null) continue
    const from = byId.get(m.id)
    const to = byId.get(m.feedsTo)
    if (!from || !to) continue
    const midX = (from.x + to.x) / 2
    edges.push({
      from: from.id,
      to: to.id,
      points: [
        [from.x + 0.95, from.y],
        [midX, from.y],
        [midX, to.y],
        [to.x - 0.95, to.y],
      ],
    })
  }

  const xs = nodes.map(n => n.x)
  const ys = nodes.map(n => n.y)
  return {
    nodes,
    edges,
    minX: xs.length ? Math.min(...xs) : 0,
    maxX: xs.length ? Math.max(...xs) : 0,
    minY: ys.length ? Math.min(...ys) : 0,
    maxY: ys.length ? Math.max(...ys) : 0,
    maxRound,
  }
}

export const roundLabel = (round: number, maxRound: number): string => {
  const remain = maxRound - round
  if (remain === 0) return 'FINAL'
  if (remain === 1) return 'SEMIS'
  if (remain === 2) return 'QUARTERS'
  return `R${round + 1}`
}
