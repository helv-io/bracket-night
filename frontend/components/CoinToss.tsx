/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import Confetti from 'react-confetti'
import { Contestant } from '../../backend/src/types'

export interface CoinTossProps {
  contestants: [Contestant, Contestant]
  /** 0 = left/heads (Face A), 1 = right/tails (Face B) */
  winner: 0 | 1
  /** Auto-start the cinematic toss when mounted / when key changes */
  autoStart?: boolean
  /** Show the host manual trigger button */
  showTrigger?: boolean
  onComplete?: () => void
}

/**
 * Continuous metallic cylinder rim: thin wall panels around the
 * circumference (rotateZ + rotateY(90°) + translateZ(radius)).
 * NOT stacked discs along Z.
 */
const RIM_SEGMENTS = 48

const SPARKS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${6 + ((i * 17) % 88)}%`,
  top: `${10 + ((i * 29) % 70)}%`,
  delay: `${(i % 9) * 0.18}s`,
  size: 3 + (i % 5),
}))

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function CoinToss({
  contestants,
  winner,
  autoStart = false,
  showTrigger = false,
  onComplete,
}: CoinTossProps) {
  const [isTossing, setIsTossing] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [tossKey, setTossKey] = useState(0)
  const [burst, setBurst] = useState(false)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    const update = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const startToss = () => {
    completedRef.current = false
    setShowResult(false)
    setBurst(false)
    setTossKey((prev) => prev + 1)
    setIsTossing(true)
  }

  useEffect(() => {
    if (autoStart && contestants[0] && contestants[1]) {
      startToss()
    }
    // Only re-trigger when autoStart flips on or contestant pair / winner changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, contestants[0]?.id, contestants[1]?.id, winner])

  const winnerContestant = contestants[winner]

  const handleAnimationEnd = () => {
    if (completedRef.current) return
    completedRef.current = true
    setShowResult(true)
    setBurst(true)

    const holdMs = prefersReducedMotion() ? 1600 : 2800
    window.setTimeout(() => {
      setIsTossing(false)
      setBurst(false)
      onCompleteRef.current?.()
    }, holdMs)
  }

  // Reduced-motion path: skip long spin, reveal quickly
  useEffect(() => {
    if (!isTossing || !prefersReducedMotion()) return
    const t = window.setTimeout(handleAnimationEnd, 650)
    return () => window.clearTimeout(t)
  }, [isTossing, tossKey])

  const sparkNodes = useMemo(
    () =>
      SPARKS.map((s) => (
        <span
          key={s.id}
          className="coin-spark"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
          }}
        />
      )),
    []
  )

  const rimNodes = useMemo(() => {
    const step = 360 / RIM_SEGMENTS
    // Chord width with slight overlap so the cylinder reads solid edge-on
    const segmentWidth = `calc((3.14159 * var(--coin-size) / ${RIM_SEGMENTS}) + 1.5px)`
    return Array.from({ length: RIM_SEGMENTS }, (_, i) => {
      const angle = i * step
      const ridge = i % 2 === 0
      return (
        <span
          key={i}
          className={`coin-rim-segment ${ridge ? 'is-ridge' : 'is-valley'}`}
          style={{
            width: segmentWidth,
            height: 'var(--coin-thickness)',
            transform: `rotateZ(${angle}deg) rotateY(90deg) translateZ(calc(var(--coin-size) / 2 - 0.5px))`,
          }}
        />
      )
    })
  }, [])

  if (!contestants[0] || !contestants[1]) return null

  return (
    <>
      {showTrigger && !isTossing && (
        <button type="button" className="coin-toss-trigger" onClick={startToss}>
          Toss Coin
        </button>
      )}

      {isTossing && (
        <div className="coin-toss-overlay animate-coinFadeIn" role="dialog" aria-label="Coin toss">
          <div className="coin-toss-vignette" />
          <div className="coin-toss-spotlight" />
          <div className="coin-toss-particles">{sparkNodes}</div>
          <div className={`coin-burst ${burst ? 'is-on' : ''}`} />

          {showResult && windowSize.width > 0 && (
            <Confetti
              width={windowSize.width}
              height={windowSize.height}
              numberOfPieces={160}
              recycle={false}
              colors={['#e8c46a', '#ffe9a8', '#ff6f61', '#5dffa8', '#ffffff']}
            />
          )}

          <div className="coin-toss-stage">
            <div className="coin-toss-kicker">
              {showResult ? 'Decided!' : 'Tiebreaker'}
            </div>

            {!showResult && (
              <div className="coin-matchup">
                <div className="coin-matchup-side">
                  <img
                    className="coin-matchup-photo"
                    src={contestants[0].image_url}
                    alt=""
                  />
                  <div className="coin-matchup-meta">
                    <span className="coin-matchup-face">Face A</span>
                    <span className="coin-matchup-name">{contestants[0].name}</span>
                  </div>
                </div>
                <div className="coin-matchup-vs">vs</div>
                <div className="coin-matchup-side">
                  <img
                    className="coin-matchup-photo"
                    src={contestants[1].image_url}
                    alt=""
                  />
                  <div className="coin-matchup-meta">
                    <span className="coin-matchup-face">Face B</span>
                    <span className="coin-matchup-name">{contestants[1].name}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="coin-scene">
              <div className="coin-shadow" />
              <div
                key={tossKey}
                className={`coin-container ${
                  winner === 0 ? 'animate-spinToHeads' : 'animate-spinToTails'
                } ${showResult ? '' : 'is-spinning'}`}
                onAnimationEnd={handleAnimationEnd}
              >
                <div className="coin-rim" aria-hidden>
                  {rimNodes}
                </div>
                <div className="coin-side heads">
                  <div
                    className="coin-face"
                    role="img"
                    aria-label={`Face A — ${contestants[0].name}`}
                  />
                  <div className="coin-glint" />
                </div>
                <div className="coin-side tails">
                  <div
                    className="coin-face"
                    role="img"
                    aria-label={`Face B — ${contestants[1].name}`}
                  />
                  <div className="coin-glint" />
                </div>
              </div>
            </div>

            <div className="coin-status">
              {!showResult ? (
                <div className="coin-status-line">In the air…</div>
              ) : (
                <>
                  <img
                    className="coin-winner-photo"
                    src={winnerContestant.image_url}
                    alt={winnerContestant.name}
                  />
                  <div className="coin-status-line is-winner">{winnerContestant.name} wins!</div>
                  <div className="coin-winner-face">
                    Face {winner === 0 ? 'A' : 'B'}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Compact mobile notice while the host TV runs the toss */
export function CoinTossMobileNotice({ winnerName }: { winnerName?: string }) {
  return (
    <div className="coin-toss-mobile">
      <h3>Tie!</h3>
      <p>
        {winnerName
          ? `Coin toss on the big screen — ${winnerName} advances!`
          : 'Coin toss on the big screen… watch the host TV!'}
      </p>
    </div>
  )
}
