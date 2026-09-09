/** Toss duration. Host ack must wait longer than this so the land is visible. */
export const COIN_TOSS_MS = 3200
export const COIN_HOLD_MS = 1400
export const COIN_ACK_MS = COIN_TOSS_MS + COIN_HOLD_MS

export interface CoinPose {
  y: number
  rotX: number
  wobble: number
  done: boolean
}

const START_Y = 0
const PEAK = 2.65

/**
 * End-over-end flip around X. Faces live on the cylinder caps (±Y), so Y-spin
 * never swaps them. Even half-turns keep left (top) toward camera; odd half-turns
 * land the right face up.
 */
export const coinTossPose = (elapsedMs: number, winnerSide: 0 | 1): CoinPose => {
  const t = Math.min(1, Math.max(0, elapsedMs / COIN_TOSS_MS))
  const eased = 1 - Math.pow(1 - t, 3)
  const halfTurns = winnerSide === 0 ? 6 : 7
  return {
    y: START_Y + PEAK * 4 * t * (1 - t),
    rotX: eased * halfTurns * Math.PI,
    wobble: Math.sin(t * Math.PI * 4) * 0.22 * (1 - t),
    done: t >= 1,
  }
}
