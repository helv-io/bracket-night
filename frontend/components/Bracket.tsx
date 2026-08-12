/* eslint-disable @next/next/no-img-element */
import { Matchup } from '../../backend/src/types'
import React, { useRef, useEffect } from 'react'

interface BracketProps {
  matchups: Matchup[]
  currentMatchupIndex: number
}

const CONNECTIONS: Array<{ from: number; to: number; leftSide: boolean }> = [
  { from: 0, to: 8, leftSide: true },
  { from: 1, to: 8, leftSide: true },
  { from: 2, to: 9, leftSide: true },
  { from: 3, to: 9, leftSide: true },
  { from: 8, to: 12, leftSide: true },
  { from: 9, to: 12, leftSide: true },
  { from: 12, to: 14, leftSide: true },
  { from: 4, to: 10, leftSide: false },
  { from: 5, to: 10, leftSide: false },
  { from: 6, to: 11, leftSide: false },
  { from: 7, to: 11, leftSide: false },
  { from: 10, to: 13, leftSide: false },
  { from: 11, to: 13, leftSide: false },
  { from: 13, to: 14, leftSide: false },
]

/** Seven equal columns: R16 · QF · SF · Finals · SF · QF · R16 */
const ROUND_LABELS = [
  'Round of 16',
  'QF',
  'SF',
  'Finals',
  'SF',
  'QF',
  'Round of 16',
] as const

function pathToCurrent(currentMatchupIndex: number): Set<string> {
  const active = new Set<string>()
  for (const c of CONNECTIONS) {
    if (c.to === currentMatchupIndex || c.from === currentMatchupIndex) {
      active.add(`${c.from}-${c.to}`)
    }
  }
  return active
}

const MatchupComponent = ({
  matchup,
  isCurrent,
}: {
  matchup: Matchup
  isCurrent: boolean
}) => {
  const isComplete = Boolean(matchup.winner)
  const isPending = !matchup.left && !matchup.right

  const renderSide = (side: 'left' | 'right') => {
    const contestant = side === 'left' ? matchup.left : matchup.right
    const isWinner = Boolean(contestant && matchup.winner?.id === contestant.id)
    const nameClass = [
      'matchup-name',
      isCurrent || isWinner ? 'is-strong' : '',
      isWinner ? 'is-winner' : '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={`matchup-row ${side === 'right' ? 'is-right' : ''}`}>
        {contestant?.image_url ? (
          <img
            src={contestant.image_url}
            alt={contestant.name}
            className={[
              'matchup-avatar',
              isCurrent ? 'is-current' : '',
              isWinner ? 'is-winner' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ) : (
          <div className="matchup-avatar-placeholder">?</div>
        )}
        <div className={nameClass}>{contestant?.name || 'TBD'}</div>
      </div>
    )
  }

  return (
    <div
      className={[
        'matchup-card',
        isCurrent ? 'is-current' : '',
        isComplete ? 'is-complete' : '',
        isPending ? 'is-pending' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {renderSide('left')}
      <div className="matchup-vs">VS</div>
      {renderSide('right')}
    </div>
  )
}

type Slot = { matchup: Matchup; top: string }

const Bracket = ({ matchups, currentMatchupIndex }: BracketProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const drawLines = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const width = container.clientWidth
      const height = container.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const activePaths = pathToCurrent(currentMatchupIndex)

      const getPosition = (element: HTMLElement, side: 'left' | 'right' | 'center') => {
        const rect = element.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        let x
        if (side === 'left') {
          x = rect.left - containerRect.left
        } else if (side === 'right') {
          x = rect.right - containerRect.left
        } else {
          x = rect.left - containerRect.left + rect.width / 2
        }
        const y = rect.top - containerRect.top + rect.height / 2
        return { x, y }
      }

      /** Orthogonal elbow: out → vertical spine → into target (square turns). */
      const strokeElbow = (
        fromPos: { x: number; y: number },
        toPos: { x: number; y: number },
        color: string,
        widthPx: number,
        blur = 0
      ) => {
        const midX = fromPos.x + (toPos.x - fromPos.x) * 0.55
        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = widthPx
        ctx.lineCap = 'square'
        ctx.lineJoin = 'miter'
        ctx.miterLimit = 2.5
        if (blur) {
          ctx.shadowColor = color
          ctx.shadowBlur = blur
        }
        ctx.beginPath()
        ctx.moveTo(fromPos.x, fromPos.y)
        ctx.lineTo(midX, fromPos.y)
        ctx.lineTo(midX, toPos.y)
        ctx.lineTo(toPos.x, toPos.y)
        ctx.stroke()
        ctx.restore()
      }

      const drawConnection = (fromIndex: number, toIndex: number, isLeftSide: boolean) => {
        const fromSide = isLeftSide ? 'right' : 'left'
        const toSide = isLeftSide ? 'left' : 'right'
        const fromElement = container.querySelector(
          `[data-matchup-id="${matchups[fromIndex].id}"]`
        ) as HTMLElement
        const toElement = container.querySelector(
          `[data-matchup-id="${matchups[toIndex].id}"]`
        ) as HTMLElement
        if (!fromElement || !toElement) return

        const fromPos = getPosition(fromElement, fromSide)
        const toPos = getPosition(toElement, toSide)
        const key = `${fromIndex}-${toIndex}`
        const completed = Boolean(matchups[fromIndex]?.winner)
        const isActive = activePaths.has(key)

        if (isActive) {
          strokeElbow(fromPos, toPos, 'rgba(255, 220, 80, 0.55)', 18, 36)
          strokeElbow(fromPos, toPos, 'rgba(255, 236, 140, 1)', 8, 20)
          strokeElbow(fromPos, toPos, '#fff8d0', 3.5, 10)
        } else if (completed) {
          strokeElbow(fromPos, toPos, 'rgba(255, 214, 102, 0.5)', 9, 18)
          strokeElbow(fromPos, toPos, 'rgba(255, 230, 140, 1)', 4, 12)
        } else {
          strokeElbow(fromPos, toPos, 'rgba(255, 214, 102, 0.42)', 7, 16)
          strokeElbow(fromPos, toPos, 'rgba(255, 232, 150, 0.95)', 3.25, 10)
        }
      }

      for (const c of CONNECTIONS) {
        drawConnection(c.from, c.to, c.leftSide)
      }
    }

    drawLines()
    const raf = window.requestAnimationFrame(drawLines)
    window.addEventListener('resize', drawLines)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', drawLines)
    }
  }, [matchups, currentMatchupIndex])

  const columns: Slot[][] = [
    // 0 — Round of 16 left
    matchups.slice(0, 4).map((matchup, i) => ({
      matchup,
      top: `${((2 * i + 1) / 8) * 100}%`,
    })),
    // 1 — QF left
    matchups.slice(8, 10).map((matchup, i) => ({
      matchup,
      top: `${((4 * i + 2) / 8) * 100}%`,
    })),
    // 2 — SF left
    matchups.slice(12, 13).map((matchup) => ({ matchup, top: '50%' })),
    // 3 — Finals
    matchups.slice(14, 15).map((matchup) => ({ matchup, top: '50%' })),
    // 4 — SF right
    matchups.slice(13, 14).map((matchup) => ({ matchup, top: '50%' })),
    // 5 — QF right
    matchups.slice(10, 12).map((matchup, i) => ({
      matchup,
      top: `${((4 * i + 2) / 8) * 100}%`,
    })),
    // 6 — Round of 16 right
    matchups.slice(4, 8).map((matchup, i) => ({
      matchup,
      top: `${((2 * i + 1) / 8) * 100}%`,
    })),
  ]

  return (
    <div ref={containerRef} className="bracket-stage">
      <canvas ref={canvasRef} className="bracket-canvas" />

      <div className="bracket-round-row" aria-hidden>
        {ROUND_LABELS.map((label, i) => (
          <div key={`${label}-${i}`} className="bracket-round-label">
            {label}
          </div>
        ))}
      </div>

      <div className="bracket-field">
        {columns.map((slots, colIndex) => (
          <div key={colIndex} className="bracket-column">
            {slots.map(({ matchup, top }) => (
              <div
                key={matchup.id}
                data-matchup-id={matchup.id}
                className="bracket-slot"
                style={{ top }}
              >
                <MatchupComponent
                  matchup={matchup}
                  isCurrent={matchup.id === currentMatchupIndex}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Bracket
