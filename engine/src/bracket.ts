import {
  Contestant,
  Matchup,
  MIN_CONTESTANTS,
  MAX_CONTESTANTS,
  NightError,
} from './types'
import { Rng, defaultRng, shuffle } from './rng'

export const nextPowerOfTwo = (n: number): number => {
  let p = 2
  while (p < n) p *= 2
  return p
}

export const validateFieldSize = (count: number): NightError | null => {
  if (!Number.isInteger(count) || count < MIN_CONTESTANTS || count > MAX_CONTESTANTS) {
    return {
      code: 'BAD_FIELD',
      message: `Field must have ${MIN_CONTESTANTS} to ${MAX_CONTESTANTS} contestants`,
    }
  }
  return null
}

/**
 * Shuffle, pad to the next power of two, pair real-vs-real first, then real-vs-empty byes.
 * Never builds empty-vs-empty. Byes auto-advance when the room reaches them.
 */
export const buildMatchups = (
  contestants: Contestant[],
  rng: Rng = defaultRng
): Matchup[] => {
  const sizeError = validateFieldSize(contestants.length)
  if (sizeError) {
    throw new Error(sizeError.message)
  }

  const shuffled = shuffle(contestants, rng)
  const size = nextPowerOfTwo(shuffled.length)
  const byeCount = size - shuffled.length
  const realVsReal = (shuffled.length - byeCount) / 2

  const firstRound: Array<[Contestant | null, Contestant | null]> = []
  let idx = 0
  for (let i = 0; i < realVsReal; i++) {
    firstRound.push([shuffled[idx], shuffled[idx + 1]])
    idx += 2
  }
  for (let i = 0; i < byeCount; i++) {
    firstRound.push([shuffled[idx], null])
    idx += 1
  }

  const rounds = Math.round(Math.log2(size))
  const matchups: Matchup[] = []
  const roundOffsets: number[] = [0]
  let prevCount = firstRound.length

  firstRound.forEach(([left, right], i) => {
    matchups.push({
      id: i,
      round: 0,
      left,
      right,
      winner: null,
      bye: left === null || right === null,
      feedsTo: null,
      feedsSlot: null,
    })
  })

  for (let r = 1; r < rounds; r++) {
    roundOffsets[r] = matchups.length
    const count = prevCount / 2
    for (let i = 0; i < count; i++) {
      matchups.push({
        id: matchups.length,
        round: r,
        left: null,
        right: null,
        winner: null,
        bye: false,
        feedsTo: null,
        feedsSlot: null,
      })
    }
    prevCount = count
  }

  for (let r = 0; r < rounds - 1; r++) {
    const start = roundOffsets[r]
    const count = r === 0 ? firstRound.length : (roundOffsets[r + 1] - start)
    const nextStart = roundOffsets[r + 1]
    for (let k = 0; k < count; k++) {
      const m = matchups[start + k]
      m.feedsTo = nextStart + Math.floor(k / 2)
      m.feedsSlot = (k % 2 === 0 ? 0 : 1)
    }
  }

  return matchups
}

export const feedWinner = (matchups: Matchup[], fromIndex: number, winner: Contestant): void => {
  const from = matchups[fromIndex]
  if (from.feedsTo === null || from.feedsSlot === null) return
  const next = matchups[from.feedsTo]
  if (from.feedsSlot === 0) next.left = winner
  else next.right = winner
}

export const resolveWinnerSide = (
  leftVotes: number,
  rightVotes: number,
  rng: Rng = defaultRng
): { side: 0 | 1, wasTie: boolean } => {
  if (leftVotes > rightVotes) return { side: 0, wasTie: false }
  if (rightVotes > leftVotes) return { side: 1, wasTie: false }
  return { side: rng() < 0.5 ? 0 : 1, wasTie: true }
}
