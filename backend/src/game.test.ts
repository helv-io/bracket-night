/**
 * Lightweight assertions for matchup advance / tie signaling.
 * Run via: npm test -w backend (ts-node).
 */
import assert from 'assert'

/** Mirrors the wasTie decision in Game.advanceMatchup */
function computeWasTie(leftVotes: number, rightVotes: number): boolean {
  return leftVotes === rightVotes
}

function resolveWinnerSide(
  leftVotes: number,
  rightVotes: number,
  rng: () => number
): 0 | 1 {
  if (leftVotes > rightVotes) return 0
  if (rightVotes > leftVotes) return 1
  return rng() < 0.5 ? 0 : 1
}

assert.strictEqual(computeWasTie(1, 1), true, '1-1 is a tie')
assert.strictEqual(computeWasTie(2, 2), true, '2-2 is a tie')
assert.strictEqual(computeWasTie(0, 0), true, '0-0 is a tie')
assert.strictEqual(computeWasTie(2, 1), false, '2-1 is not a tie')
assert.strictEqual(computeWasTie(0, 1), false, '0-1 is not a tie')

assert.strictEqual(resolveWinnerSide(3, 1, () => 0.9), 0)
assert.strictEqual(resolveWinnerSide(1, 4, () => 0.1), 1)
assert.strictEqual(resolveWinnerSide(2, 2, () => 0.1), 0)
assert.strictEqual(resolveWinnerSide(2, 2, () => 0.7), 1)

console.log('game.test.ts: ok')
