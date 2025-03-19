/* eslint-disable @next/next/no-img-element */
import { Matchup } from '../../backend/src/types'
import React, { useRef, useEffect } from 'react'

interface BracketProps {
  matchups: Matchup[]
  currentMatchupIndex: number
}

const MatchupComponent = ({ matchup, isCurrent }: { matchup: Matchup, isCurrent: boolean }) => {
  return (
    <div
      className={`p-2 rounded-lg text-center w-[180px] flex flex-col items-center justify-between h-[140px] shadow-md transition-all duration-300 bg-[var(--card-bg)] ${
        isCurrent ? 'ring-4 ring-[var(--accent)]' : ''
      }`}
    >
      <div className="flex items-center w-full">
        {matchup.left?.image_url ? (
          <img
            src={matchup.left.image_url}
            alt={matchup.left.name}
            className={`w-8 h-8 rounded-full mr-2 transition-opacity duration-300 ${
              matchup.winner?.id === matchup.left?.id
                ? 'opacity-100 border-2 border-[var(--winner-highlight)]'
                : 'opacity-100'
            }`}
          />
        ) : (
          <div className="w-8 h-8 mr-2 text-2xl text-[var(--text)] opacity-100">❓</div>
        )}
        <div
          className={`flex-1 text-left transition-colors duration-300 ${
            matchup.winner?.id === matchup.left?.id
              ? 'text-[var(--winner-highlight)] font-bold'
              : 'text-gray-400'
          }`}
        >
          {matchup.left?.name || ''}
        </div>
      </div>
      <div className="text-[var(--accent)] font-bold text-lg">🆚</div>
      <div className="flex items-center w-full">
        <div
          className={`flex-1 text-right transition-colors duration-300 ${
            matchup.winner?.id === matchup.right?.id
              ? 'text-[var(--winner-highlight)] font-bold'
              : 'text-gray-400'
          }`}
        >
          {matchup.right?.name || ''}
        </div>
        {matchup.right?.image_url ? (
          <img
            src={matchup.right.image_url}
            alt={matchup.right.name}
            className={`w-8 h-8 rounded-full ml-2 transition-opacity duration-300 ${
              matchup.winner?.id === matchup.right?.id
                ? 'opacity-100 border-2 border-[var(--winner-highlight)]'
                : 'opacity-100'
            }`}
          />
        ) : (
          <div className="w-8 h-8 ml-2 text-2xl text-[var(--text)] opacity-100">❔</div>
        )}
      </div>
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

      canvas.width = container.clientWidth
      canvas.height = container.clientHeight

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = '#D4AF37' // Golden color
      ctx.lineWidth = 5

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
        const fromElement = container.querySelector(`[data-matchup-id="${matchups[fromIndex].id}"]`) as HTMLElement
        const toElement = container.querySelector(`[data-matchup-id="${matchups[toIndex].id}"]`) as HTMLElement
        if (!fromElement || !toElement) return

        const fromPos = getPosition(fromElement, fromSide)
        const toPos = getPosition(toElement, toSide)

        const dx = toPos.x - fromPos.x
        const d = 0.2 * Math.abs(dx)
        let cp1x, cp1y, cp2x, cp2y

        if (dx > 0) { // Left to right
          cp1x = fromPos.x + d
          cp1y = fromPos.y
          cp2x = toPos.x - d
          cp2y = toPos.y
        } else { // Right to left
          cp1x = fromPos.x - d
          cp1y = fromPos.y
          cp2x = toPos.x + d
          cp2y = toPos.y
        }

        ctx.beginPath()
        ctx.moveTo(fromPos.x, fromPos.y)
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, toPos.x, toPos.y)
        ctx.stroke()
      }

      // Left-side connections
      drawConnection(0, 8, true)
      drawConnection(1, 8, true)
      drawConnection(2, 9, true)
      drawConnection(3, 9, true)
      drawConnection(8, 12, true)
      drawConnection(9, 12, true)
      drawConnection(12, 14, true)

      // Right-side connections
      drawConnection(4, 10, false)
      drawConnection(5, 10, false)
      drawConnection(6, 11, false)
      drawConnection(7, 11, false)
      drawConnection(10, 13, false)
      drawConnection(11, 13, false)
      drawConnection(13, 14, false)
    }

    drawLines()
    window.addEventListener('resize', drawLines)
    return () => window.removeEventListener('resize', drawLines)
  }, [matchups, currentMatchupIndex])

  return (
    <div ref={containerRef} style={{ position: 'relative', height: '100vh', width: '95%', margin: '0 auto' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />
      {/* Round 1 Left */}
      {matchups.slice(0, 4).map((matchup, index) => (
        <div
          key={matchup.id}
          data-matchup-id={matchup.id}
          style={{
            position: 'absolute',
            left: '0%',
            top: `${(2 * index + 1) / 8 * 100}%`,
            transform: 'translateY(-50%)',
            zIndex: 1
          }}
        >
          <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
        </div>
      ))}
      {/* Round 1 Right */}
      {matchups.slice(4, 8).map((matchup, index) => (
        <div
          key={matchup.id}
          data-matchup-id={matchup.id}
          style={{
            position: 'absolute',
            left: '90%',
            top: `${(2 * index + 1) / 8 * 100}%`,
            transform: 'translateY(-50%)',
            zIndex: 1
          }}
        >
          <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
        </div>
      ))}
      {/* Quarter-Finals Left */}
      {matchups.slice(8, 10).map((matchup, index) => (
        <div
          key={matchup.id}
          data-matchup-id={matchup.id}
          style={{
            position: 'absolute',
            left: '15%',
            top: `${(4 * index + 2) / 8 * 100}%`,
            transform: 'translateY(-50%)',
            zIndex: 1
          }}
        >
          <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
        </div>
      ))}
      {/* Quarter-Finals Right */}
      {matchups.slice(10, 12).map((matchup, index) => (
        <div
          key={matchup.id}
          data-matchup-id={matchup.id}
          style={{
            position: 'absolute',
            left: '75%',
            top: `${(4 * index + 2) / 8 * 100}%`,
            transform: 'translateY(-50%)',
            zIndex: 1
          }}
        >
          <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
        </div>
      ))}
      {/* Semi-Finals Left */}
      {matchups.slice(12, 13).map((matchup) => (
        <div
          key={matchup.id}
          data-matchup-id={matchup.id}
          style={{
            position: 'absolute',
            left: '30%',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1
          }}
        >
          <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
        </div>
      ))}
      {/* Semi-Finals Right */}
      {matchups.slice(13, 14).map((matchup) => (
        <div
          key={matchup.id}
          data-matchup-id={matchup.id}
          style={{
            position: 'absolute',
            left: '60%',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1
          }}
        >
          <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
        </div>
      ))}
      {/* Final */}
      {matchups.slice(14, 15).map((matchup) => (
        <div
          key={matchup.id}
          data-matchup-id={matchup.id}
          style={{
            position: 'absolute',
            left: '45%',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1
          }}
        >
          <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
        </div>
      ))}
    </div>
  )
}

export default Bracket