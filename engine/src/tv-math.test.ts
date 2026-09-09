import assert from 'assert'
import { COIN_TOSS_MS, coinTossPose } from './coinToss'
import { layoutBracket, roundLabel } from './bracketLayout'
import { Matchup } from './types'

const start = coinTossPose(0, 0)
assert.strictEqual(start.y, 0)
assert.strictEqual(start.rotX, 0)
assert.strictEqual(start.done, false)

const mid = coinTossPose(COIN_TOSS_MS / 2, 0)
assert.ok(mid.y > 2, 'parabolic peak is off the floor')
assert.ok(mid.rotX > 0)

const leftLand = coinTossPose(COIN_TOSS_MS, 0)
assert.ok(leftLand.done)
assert.ok(Math.abs(leftLand.y) < 1e-9)
assert.ok(Math.abs(leftLand.rotX / Math.PI - 8) < 1e-9, 'left winner lands on even half-turns')

const rightLand = coinTossPose(COIN_TOSS_MS, 1)
assert.ok(Math.abs(rightLand.rotX / Math.PI - 9) < 1e-9, 'right winner lands on odd half-turns')

const contestant = (id: string, name: string): NonNullable<Matchup['left']> => ({
  id,
  name,
  imageUrl: `/${id}.jpg`,
})

const four: Matchup[] = [
  { id: 0, round: 0, left: contestant('a', 'A'), right: contestant('b', 'B'), winner: null, bye: false, feedsTo: 2, feedsSlot: 0 },
  { id: 1, round: 0, left: contestant('c', 'C'), right: contestant('d', 'D'), winner: null, bye: false, feedsTo: 2, feedsSlot: 1 },
  { id: 2, round: 1, left: null, right: null, winner: null, bye: false, feedsTo: null, feedsSlot: null },
]

const layout = layoutBracket(four)
assert.strictEqual(layout.nodes.length, 3)
assert.strictEqual(layout.edges.length, 2)
assert.strictEqual(layout.maxRound, 1)
const final = layout.nodes.find(n => n.id === 2)
assert.ok(final)
assert.ok(final.x > layout.nodes[0].x)
assert.strictEqual(roundLabel(1, 1), 'FINAL')
assert.strictEqual(roundLabel(0, 1), 'SEMIS')

console.log('engine/tv-math.test.ts: ok')
