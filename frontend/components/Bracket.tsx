/* eslint-disable @next/next/no-img-element */
import { Matchup } from '../../backend/src/types'
import { GAME_OVER_INDEX } from '../../backend/src/constants'
import React, { useRef, useEffect, useState } from 'react'

interface BracketProps {
  matchups: Matchup[]
  currentMatchupIndex: number
}

const MatchupComponent = ({ matchup, isCurrent }: { matchup: Matchup, isCurrent: boolean }) => {
  const leftWon = matchup.winner?.id === matchup.left?.id
  const rightWon = matchup.winner?.id === matchup.right?.id
  const hasWinner = leftWon || rightWon

  return (
    <div
      className={`p-3 rounded-xl text-center w-[210px] flex flex-col justify-between h-[158px] shadow-lg transition-all duration-300 bg-[var(--card-bg)] border border-white/5
        ${isCurrent ? 'ring-4 ring-[var(--active)] ring-offset-2 ring-offset-[var(--background)]' : ''}
      `}
    >
      {/* Left contestant */}
      <div className="flex items-center w-full gap-2.5">
        {matchup.left?.image_url ? (
          <img
            src={matchup.left.image_url}
            alt={matchup.left.name}
            className={`w-12 h-12 rounded-full object-cover flex-shrink-0 transition-all duration-300
              ${leftWon ? 'ring-3 ring-[var(--winner-highlight)] ring-offset-2 ring-offset-[var(--card-bg)]' : 'opacity-90'}
              ${isCurrent && !hasWinner ? 'ring-2 ring-[var(--active)]' : ''}
            `}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/bn-logo-gold.svg'
            }}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-2xl flex-shrink-0">❓</div>
        )}
        <div
          className={`flex-1 text-left text-[13px] leading-tight font-medium transition-colors duration-300 truncate
            ${leftWon ? 'text-[var(--winner-highlight)] font-semibold' : hasWinner ? 'text-gray-400' : 'text-[var(--text)]'}
            ${isCurrent && !hasWinner ? 'font-semibold' : ''}
          `}
          title={matchup.left?.name}
        >
          {matchup.left?.name || 'TBD'}
        </div>
        {leftWon && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--winner-highlight)]/20 text-[var(--winner-highlight)] font-bold tracking-wider flex-shrink-0">WIN</span>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center justify-center py-0.5">
        <div className="h-px w-8 bg-white/15" />
        <span className="px-2 text-[10px] font-mono text-[var(--accent)]/70">VS</span>
        <div className="h-px w-8 bg-white/15" />
      </div>

      {/* Right contestant */}
      <div className="flex items-center w-full gap-2.5">
        <div
          className={`flex-1 text-right text-[13px] leading-tight font-medium transition-colors duration-300 truncate
            ${rightWon ? 'text-[var(--winner-highlight)] font-semibold' : hasWinner ? 'text-gray-400' : 'text-[var(--text)]'}
            ${isCurrent && !hasWinner ? 'font-semibold' : ''}
          `}
          title={matchup.right?.name}
        >
          {matchup.right?.name || 'TBD'}
        </div>
        {rightWon && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--winner-highlight)]/20 text-[var(--winner-highlight)] font-bold tracking-wider flex-shrink-0">WIN</span>
        )}
        {matchup.right?.image_url ? (
          <img
            src={matchup.right.image_url}
            alt={matchup.right.name}
            className={`w-12 h-12 rounded-full object-cover flex-shrink-0 transition-all duration-300 order-last
              ${rightWon ? 'ring-3 ring-[var(--winner-highlight)] ring-offset-2 ring-offset-[var(--card-bg)]' : 'opacity-90'}
              ${isCurrent && !hasWinner ? 'ring-2 ring-[var(--active)]' : ''}
            `}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/bn-logo-gold.svg'
            }}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-2xl flex-shrink-0 order-last">❔</div>
        )}
      </div>
    </div>
  )
}

const Bracket = ({ matchups, currentMatchupIndex }: BracketProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // On large screens (QHD, 1440p+, typical host/TV/projector setups), always show the
  // entire original matchup bracket with connecting lines. The compact list is only for
  // genuinely small windows.
  const [viewport, setViewport] = useState(() =>
    typeof window !== 'undefined'
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 0, h: 0 }
  )
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // Track viewport (this is the reliable signal for "large screen" intent)
  useEffect(() => {
    const updateViewport = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  // Track actual rendered container size (used for canvas lines + as secondary signal)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight
      })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  // Full original bracket (with lines + vertical layout) only on truly large screens.
  // Anything under 1600px wide OR under 900px tall is treated as "small screen"
  // and gets the focused current + summary view.
  const isFullBracket =
    (viewport.w >= 1600 && viewport.h >= 900) ||   // large dedicated display
    containerSize.width >= 1100 ||
    (containerSize.width >= 1280 && containerSize.height >= 580)

  // When showing the full bracket (only on >=1600x900 viewport), give the container
  // an explicit tall height so the original % top positioning spreads the cards vertically.
  let bracketContainerHeight: string | number = '100%'
  if (isFullBracket) {
    const minForVerticalLayout = 820 // enough room for 8 stacked positions + card heights + breathing room
    bracketContainerHeight = Math.max(minForVerticalLayout, Math.floor(viewport.h * 0.78)) + 'px'
  }

  // Robust current check: only a real matchup can be current; GAME_OVER (15) has none
  const isCurrentMatchup = (m: Matchup) => currentMatchupIndex < 15 && m.id === currentMatchupIndex

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

      // Same as --active from css
      ctx.strokeStyle = '#dbfd1c'
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
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: bracketContainerHeight,
        margin: '0 auto',
        paddingLeft: '8px',
        paddingRight: '8px',
        background: 'var(--background)',
        boxSizing: 'border-box'
      }}
    >
      {isFullBracket ? (
        <>
          <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />
          {/* Round 1 Left */}
          {matchups.slice(0, 4).map((matchup, index) => (
            <div
              key={matchup.id}
              data-matchup-id={matchup.id}
              style={{
                position: 'absolute',
                left: '12px',
                top: `${(2 * index + 1) / 8 * 100}%`,
                transform: 'translateY(-50%)',
                zIndex: 1
              }}
            >
              <MatchupComponent matchup={matchup} isCurrent={isCurrentMatchup(matchup)} />
            </div>
          ))}
          {/* Round 1 Right */}
          {matchups.slice(4, 8).map((matchup, index) => (
            <div
              key={matchup.id}
              data-matchup-id={matchup.id}
              style={{
                position: 'absolute',
                right: '12px',
                top: `${(2 * index + 1) / 8 * 100}%`,
                transform: 'translateY(-50%)',
                zIndex: 1
              }}
            >
              <MatchupComponent matchup={matchup} isCurrent={isCurrentMatchup(matchup)} />
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
              <MatchupComponent matchup={matchup} isCurrent={isCurrentMatchup(matchup)} />
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
              <MatchupComponent matchup={matchup} isCurrent={isCurrentMatchup(matchup)} />
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
              <MatchupComponent matchup={matchup} isCurrent={isCurrentMatchup(matchup)} />
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
              <MatchupComponent matchup={matchup} isCurrent={isCurrentMatchup(matchup)} />
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
              <MatchupComponent matchup={matchup} isCurrent={isCurrentMatchup(matchup)} />
            </div>
          ))}
        </>
      ) : (
        // Compact focused view: large current + progress + completed summary (per approved plan)
        <div className="flex flex-col h-full w-full p-3 overflow-hidden text-[var(--text)]" style={{ background: 'var(--background)' }}>
          {(() => {
            const currentIdx = currentMatchupIndex
            const isOver = currentIdx >= matchups.length || currentIdx === GAME_OVER_INDEX
            const currentM = !isOver && currentIdx < matchups.length ? matchups[currentIdx] : null
            const completed = matchups.slice(0, Math.min(currentIdx, matchups.length)).filter(m => m.winner)

            const getRoundLabel = (idx: number) => {
              if (idx < 8) return 'Round 1'
              if (idx < 12) return 'Quarter-Finals'
              if (idx < 14) return 'Semi-Finals'
              return 'Final'
            }

            const progressText = isOver
              ? 'Complete — Champion crowned'
              : `${getRoundLabel(currentIdx)} • ${currentIdx + 1} / ${matchups.length} matches`

            return (
              <>
                {/* Progress indicator */}
                <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-widest opacity-75">
                  <span className="font-bold text-[var(--accent)]">PROGRESS</span>
                  <span className="flex-1 h-px bg-[var(--card-bg)]" />
                  <span>{progressText}</span>
                </div>

                {/* Hero: Current matchup (large, readable) */}
                {currentM ? (
                  <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-3 min-h-0 py-1">
                    {/* Left contestant - large */}
                    <div className="flex-1 flex flex-col items-center text-center min-w-0">
                      {currentM.left?.image_url ? (
                        <img
                          src={currentM.left.image_url}
                          alt={currentM.left.name}
                          className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover border-4 border-[var(--accent)] shadow-lg"
                        />
                      ) : (
                        <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-[var(--card-bg)] flex items-center justify-center text-6xl border-4 border-[var(--accent)]">❓</div>
                      )}
                      <div className="mt-2 font-bold text-lg md:text-2xl leading-tight break-words px-1">{currentM.left?.name || 'TBD'}</div>
                    </div>

                    <div className="text-[var(--accent)] text-3xl font-bold px-2">VS</div>

                    {/* Right contestant - large */}
                    <div className="flex-1 flex flex-col items-center text-center min-w-0">
                      {currentM.right?.image_url ? (
                        <img
                          src={currentM.right.image_url}
                          alt={currentM.right.name}
                          className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover border-4 border-[var(--accent)] shadow-lg"
                        />
                      ) : (
                        <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-[var(--card-bg)] flex items-center justify-center text-6xl border-4 border-[var(--accent)]">❓</div>
                      )}
                      <div className="mt-2 font-bold text-lg md:text-2xl leading-tight break-words px-1">{currentM.right?.name || 'TBD'}</div>
                    </div>
                  </div>
                ) : isOver && matchups.length > 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="text-[var(--winner-highlight)] text-sm tracking-[3px] mb-1">CHAMPION</div>
                    {matchups[14]?.winner?.image_url ? (
                      <img src={matchups[14].winner.image_url} alt="Champion" className="w-32 h-32 rounded-full object-cover border-4 border-[var(--winner-highlight)] shadow-xl" />
                    ) : null}
                    <div className="mt-2 text-2xl font-bold text-[var(--winner-highlight)]">{matchups[14]?.winner?.name || '—'}</div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center opacity-60">Waiting for bracket...</div>
                )}

                {/* Completed summary — nicer visual rows so it doesn't feel like "just a list" */}
                {completed.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[var(--card-bg)]">
                    <div className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Completed • {completed.length} advances</div>
                    <div className="max-h-[110px] overflow-y-auto pr-1 text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-1">
                      {completed.map((m, i) => {
                        const loser = m.winner?.id === m.left?.id ? m.right : m.left
                        return (
                          <div key={i} className="flex items-center gap-2 bg-[var(--card-bg)]/60 rounded px-2 py-1 truncate">
                            {m.winner?.image_url ? (
                              <img src={m.winner.image_url} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
                            ) : null}
                            <span className="text-[var(--winner-highlight)] font-semibold truncate text-[13px]">{m.winner?.name}</span>
                            <span className="text-[var(--accent)]/60 text-[10px] flex-shrink-0">beat</span>
                            {loser?.image_url ? (
                              <img src={loser.image_url} alt="" className="w-4 h-4 rounded-full flex-shrink-0 opacity-70" />
                            ) : null}
                            <span className="text-gray-400 truncate text-[12px]">{loser?.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* Tiny diagnostic readout (bottom-right of bracket area) */}
      <div
        className="absolute bottom-1 right-1 z-50 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white font-mono pointer-events-none select-none"
        title="viewport / container / mode"
      >
        vp:{viewport.w}×{viewport.h} cont:{containerSize.width}×{containerSize.height} {isFullBracket ? 'FULL' : 'compact'}
      </div>
    </div>
  )
}

export default Bracket