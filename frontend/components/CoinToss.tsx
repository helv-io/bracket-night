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

/** Full spin duration (ms). Ease-out bounce via rAF — not CSS animationend. */
const SPIN_MS = 3000
const HOLD_MS = 2800
const HOLD_MS_REDUCED = 1600

/**
 * Continuous metallic cylinder rim: wall panels around the circumference.
 * Single gold material; soft cosine lighting only (no ridge/valley stripes).
 */
const RIM_SEGMENTS = 72

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

/** Ease-out with a soft landing bounce (matches prior CSS cubic feel). */
function spinEase(t: number) {
  // bounce-ish ease-out
  const n1 = 7.5625
  const d1 = 2.75
  if (t < 1 / d1) return n1 * t * t
  if (t < 2 / d1) {
    const x = t - 1.5 / d1
    return n1 * x * x + 0.75
  }
  if (t < 2.5 / d1) {
    const x = t - 2.25 / d1
    return n1 * x * x + 0.9375
  }
  const x = t - 2.625 / d1
  return n1 * x * x + 0.984375
}

function liftForProgress(p: number) {
  // Arc: up, settle, secondary hop, land
  if (p < 0.18) return 40 - (p / 0.18) * 220
  if (p < 0.42) return -180 + ((p - 0.18) / 0.24) * 140
  if (p < 0.68) return -40 - ((p - 0.42) / 0.26) * 80
  if (p < 0.84) return -120 + ((p - 0.68) / 0.16) * 132
  if (p < 0.92) return 12 - ((p - 0.84) / 0.08) * 30
  return -18 + ((p - 0.92) / 0.08) * 18
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
  const [spinStyle, setSpinStyle] = useState<React.CSSProperties>({
    transform: 'translateY(40px) rotateX(12deg) rotateY(0deg) scale(0.9)',
  })
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  const rafRef = useRef(0)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    const update = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const finishToss = () => {
    if (completedRef.current) return
    completedRef.current = true
    setShowResult(true)
    setBurst(true)

    const holdMs = prefersReducedMotion() ? HOLD_MS_REDUCED : HOLD_MS
    window.setTimeout(() => {
      setIsTossing(false)
      setBurst(false)
      onCompleteRef.current?.()
    }, holdMs)
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, contestants[0]?.id, contestants[1]?.id, winner])

  // rAF-driven spin: full ~3s even if CSS animations / reduced-motion interfere
  useEffect(() => {
    if (!isTossing) return

    const reduced = prefersReducedMotion()
    const finalY = winner === 0 ? 2880 : 3060
    const start = performance.now()

    if (reduced) {
      setSpinStyle({
        transform: `translateY(0) rotateX(0deg) rotateY(${winner === 0 ? 0 : 180}deg) scale(1)`,
      })
      const t = window.setTimeout(finishToss, 650)
      return () => window.clearTimeout(t)
    }

    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / SPIN_MS)
      const p = spinEase(raw)
      const y = finalY * p
      const lift = liftForProgress(raw)
      const tilt = 12 * Math.sin(raw * Math.PI) * (1 - raw)
      const scale = 0.9 + 0.14 * Math.sin(raw * Math.PI) * (1 - raw * 0.35)
      setSpinStyle({
        transform: `translateY(${lift.toFixed(1)}px) rotateX(${tilt.toFixed(2)}deg) rotateY(${y.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
      })
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setSpinStyle({
          transform: `translateY(0px) rotateX(0deg) rotateY(${finalY}deg) scale(1)`,
        })
        finishToss()
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTossing, tossKey, winner])

  const winnerContestant = contestants[winner]

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
    const segmentHeight = `calc((3.14159 * var(--coin-size) / ${RIM_SEGMENTS}) + 2.5px)`
    return Array.from({ length: RIM_SEGMENTS }, (_, i) => {
      const angle = i * step
      const light = 0.55 + 0.45 * Math.abs(Math.cos((angle * Math.PI) / 180))
      return (
        <span
          key={i}
          className="coin-rim-segment"
          style={{
            width: 'var(--coin-thickness)',
            height: segmentHeight,
            // Soft lighting only — same gold fill on every panel
            background: `linear-gradient(90deg,
              #4a3008 0%,
              #8a5f18 ${18 * light}%,
              #e8c46a ${40 + 8 * light}%,
              #fff4c4 50%,
              #e8c46a ${60 - 8 * light}%,
              #8a5f18 ${82}%,
              #3d2808 100%)`,
            transform: `rotateZ(${angle}deg) translateX(calc(var(--coin-size) / 2)) rotateY(90deg)`,
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
                className={`coin-container ${showResult ? '' : 'is-spinning'}`}
                style={spinStyle}
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
