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

function pathToCurrent(currentMatchupIndex: number): Set<string> {
  const active = new Set<string>()
  // Emphasize inbound edges into the current matchup (and recent completed feeder)
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
        const dx = toPos.x - fromPos.x
        const d = 0.2 * Math.abs(dx)
        const cp1x = dx > 0 ? fromPos.x + d : fromPos.x - d
        const cp2x = dx > 0 ? toPos.x - d : toPos.x + d
        const key = `${fromIndex}-${toIndex}`
        const completed = Boolean(matchups[fromIndex]?.winner)
        const isActive = activePaths.has(key)

        const stroke = (color: string, widthPx: number, blur = 0) => {
          ctx.save()
          ctx.strokeStyle = color
          ctx.lineWidth = widthPx
          ctx.lineCap = 'round'
          if (blur) {
            ctx.shadowColor = color
            ctx.shadowBlur = blur
          }
          ctx.beginPath()
          ctx.moveTo(fromPos.x, fromPos.y)
          ctx.bezierCurveTo(cp1x, fromPos.y, cp2x, toPos.y, toPos.x, toPos.y)
          ctx.stroke()
          ctx.restore()
        }

        if (isActive) {
          stroke('rgba(255, 229, 102, 0.25)', 10, 16)
          stroke('rgba(255, 229, 102, 0.95)', 3.5, 8)
        } else if (completed) {
          stroke('rgba(232, 196, 106, 0.18)', 4, 0)
          stroke('rgba(232, 196, 106, 0.42)', 2, 4)
        } else {
          stroke('rgba(232, 196, 106, 0.12)', 3, 0)
          stroke('rgba(232, 196, 106, 0.28)', 1.5, 2)
        }
      }

      for (const c of CONNECTIONS) {
        drawConnection(c.from, c.to, c.leftSide)
      }
    }

    drawLines()
    window.addEventListener('resize', drawLines)
    return () => window.removeEventListener('resize', drawLines)
  }, [matchups, currentMatchupIndex])

  const place = (
    items: Matchup[],
    left: string,
    topForIndex: (index: number) => string
  ) =>
    items.map((matchup, index) => (
      <div
        key={matchup.id}
        data-matchup-id={matchup.id}
        style={{
          position: 'absolute',
          left,
          top: topForIndex(index),
          transform: 'translateY(-50%)',
          zIndex: 1,
        }}
      >
        <MatchupComponent
          matchup={matchup}
          isCurrent={matchup.id === currentMatchupIndex}
        />
      </div>
    ))

  return (
    <div ref={containerRef} className="bracket-stage">
      <canvas ref={canvasRef} className="bracket-canvas" />

      <div className="bracket-round-label" style={{ left: '1%', top: '2%' }}>
        Round of 16
      </div>
      <div className="bracket-round-label" style={{ right: '1%', top: '2%' }}>
        Round of 16
      </div>
      <div className="bracket-round-label" style={{ left: '16%', top: '8%' }}>
        QF
      </div>
      <div className="bracket-round-label" style={{ right: '16%', top: '8%' }}>
        QF
      </div>
      <div className="bracket-round-label" style={{ left: '31%', top: '18%' }}>
        SF
      </div>
      <div className="bracket-round-label" style={{ right: '31%', top: '18%' }}>
        SF
      </div>
      <div className="bracket-round-label" style={{ left: '46%', top: '22%' }}>
        Finals
      </div>

      {place(matchups.slice(0, 4), '0%', (i) => `${((2 * i + 1) / 8) * 100}%`)}
      {place(matchups.slice(4, 8), '90%', (i) => `${((2 * i + 1) / 8) * 100}%`)}
      {place(matchups.slice(8, 10), '15%', (i) => `${((4 * i + 2) / 8) * 100}%`)}
      {place(matchups.slice(10, 12), '75%', (i) => `${((4 * i + 2) / 8) * 100}%`)}
      {place(matchups.slice(12, 13), '30%', () => '50%')}
      {place(matchups.slice(13, 14), '60%', () => '50%')}
      {place(matchups.slice(14, 15), '45%', () => '50%')}
    </div>
  )
}

export default Bracket
