/**
 * Engine unit tests: bracket fill, votes, ties, byes, reconnect.
 * Run via: npm test -w backend
 */
import assert from 'assert'
import { Bracket, Contestant } from './types'
import {
  applyBracket,
  castVote,
  championOf,
  countByes,
  createEmptyGame,
  createMatchups,
  disconnectBySocket,
  isByeMatchup,
  joinGame,
  mulberry32,
  nextPowerOfTwo,
  resolveWinner,
  startGame,
} from './engine'

function fakeContestants(n: number): Contestant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    bracket_id: 1,
    name: `C${i + 1}`,
    image_url: '',
  }))
}

function fakeBracket(n: number): Bracket {
  return {
    id: 1,
    code: 'test',
    title: 'Test',
    subtitle: 'Unit',
    contestants: fakeContestants(n),
    isPublic: false,
  }
}

assert.strictEqual(nextPowerOfTwo(2), 2)
assert.strictEqual(nextPowerOfTwo(3), 4)
assert.strictEqual(nextPowerOfTwo(6), 8)
assert.strictEqual(nextPowerOfTwo(8), 8)
assert.strictEqual(nextPowerOfTwo(12), 16)
assert.strictEqual(nextPowerOfTwo(16), 16)

{
  const rng = mulberry32(1)
  const m16 = createMatchups(fakeContestants(16), rng)
  assert.strictEqual(m16.length, 15, '16 contestants → 15 matchups')
  assert.strictEqual(countByes(m16), 0)
}

{
  const rng = mulberry32(2)
  const m6 = createMatchups(fakeContestants(6), rng)
  assert.strictEqual(m6.length, 7, '6 contestants pad to field 8 → 7 matchups')
  assert.strictEqual(countByes(m6), 2, 'two byes in round 1')
  const firstRound = m6.slice(0, 4)
  const byePairs = firstRound.filter(isByeMatchup)
  assert.strictEqual(byePairs.length, 2)
  for (const m of firstRound) {
    const sides = [m.left, m.right].filter(Boolean).length
    assert.ok(sides >= 1, 'no empty-vs-empty in round 1')
  }
}

{
  const resolved = resolveWinner(
    fakeContestants(2)[0],
    fakeContestants(2)[1],
    { left: 2, right: 2 },
    () => 0.1
  )
  assert.strictEqual(resolved.wasTie, true)
  assert.strictEqual(resolved.winner.id, 1)
}

{
  const state = createEmptyGame('T1')
  const a = joinGame(state, 'Ada', 's1', 16)
  const b = joinGame(state, 'Bea', 's2', 16)
  assert.ok(a.ok && b.ok)
  assert.strictEqual(a.isGameMaster, true)
  assert.strictEqual(b.isGameMaster, false)
  const applied = applyBracket(state, fakeBracket(4), mulberry32(9))
  assert.ok(applied.ok)
  const started = startGame(state)
  assert.ok(started.ok)

  const late = joinGame(state, 'Cara', 's3', 16)
  assert.ok(!late.ok)
  assert.strictEqual(late.code, 'STARTED')

  disconnectBySocket(state, 's2')
  const back = joinGame(state, 'Bea', 's2b', 16)
  assert.ok(back.ok && back.isReconnect)
  assert.strictEqual(back.player.id, b.ok ? b.player.id : '')
}

{
  const state = createEmptyGame('T2')
  joinGame(state, 'Ada', 's1', 4)
  joinGame(state, 'Bea', 's2', 4)
  joinGame(state, 'Cara', 's3', 4)
  joinGame(state, 'Dee', 's4', 4)
  const full = joinGame(state, 'Eve', 's5', 4)
  assert.ok(!full.ok)
  assert.strictEqual(full.code, 'FULL')
}

{
  const state = createEmptyGame('T3')
  const a = joinGame(state, 'Ada', 's1', 16)
  const b = joinGame(state, 'Bea', 's2', 16)
  assert.ok(a.ok && b.ok)
  applyBracket(state, fakeBracket(2), mulberry32(3))
  startGame(state)
  const v1 = castVote(state, a.player.id, 0)
  assert.ok(v1.ok && !v1.allIn)
  const dup = castVote(state, a.player.id, 1)
  assert.ok(!dup.ok)
  assert.strictEqual(dup.code, 'DUP_VOTE')
  const v2 = castVote(state, b.player.id, 0)
  assert.ok(v2.ok && v2.allIn)
  assert.ok(state.isGameOver)
  assert.ok(championOf(state))
  assert.strictEqual(championOf(state)?.id, 1)
}

{
  const state = createEmptyGame('T4')
  const a = joinGame(state, 'Ada', 's1', 16)
  const b = joinGame(state, 'Bea', 's2', 16)
  assert.ok(a.ok && b.ok)
  applyBracket(state, fakeBracket(2), () => 0)
  startGame(state)
  castVote(state, a.player.id, 0)
  const last = castVote(state, b.player.id, 1)
  assert.ok(last.ok)
  assert.strictEqual(last.advances[0]?.wasTie, true)
}

console.log('engine.test.ts: ok')
