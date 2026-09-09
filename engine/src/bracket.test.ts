import assert from 'assert'
import { buildMatchups, nextPowerOfTwo, resolveWinnerSide } from './bracket'
import { inlineField } from './showcase'
import { mulberry32 } from './rng'

const names = (n: number) => Array.from({ length: n }, (_, i) => `Fighter ${i + 1}`)

function field(n: number) {
  return inlineField('Test', 'Unit', names(n)).contestants
}

assert.strictEqual(nextPowerOfTwo(2), 2)
assert.strictEqual(nextPowerOfTwo(3), 4)
assert.strictEqual(nextPowerOfTwo(6), 8)
assert.strictEqual(nextPowerOfTwo(8), 8)
assert.strictEqual(nextPowerOfTwo(12), 16)
assert.strictEqual(nextPowerOfTwo(16), 16)

{
  const m = buildMatchups(field(16), mulberry32(1))
  assert.strictEqual(m.length, 15, '16 fighters -> 15 matchups')
  assert.strictEqual(m.filter(x => x.round === 0).length, 8)
  assert.ok(m.slice(0, 8).every(x => x.left && x.right && !x.bye), 'no byes on a full 16')
}

{
  const m = buildMatchups(field(8), mulberry32(2))
  assert.strictEqual(m.length, 7, '8 fighters -> 7 matchups')
  assert.ok(m.slice(0, 4).every(x => x.left && x.right && !x.bye))
}

{
  const m = buildMatchups(field(6), mulberry32(3))
  const first = m.filter(x => x.round === 0)
  assert.strictEqual(first.length, 4)
  const byes = first.filter(x => x.bye)
  const real = first.filter(x => !x.bye)
  assert.strictEqual(byes.length, 2)
  assert.strictEqual(real.length, 2)
  assert.ok(byes.every(x => (x.left && !x.right) || (!x.left && x.right)))
  assert.ok(first.every(x => x.left || x.right), 'no empty-vs-empty')
}

{
  const m = buildMatchups(field(12), mulberry32(4))
  const first = m.filter(x => x.round === 0)
  assert.strictEqual(first.length, 8)
  assert.strictEqual(first.filter(x => x.bye).length, 4)
  assert.ok(first.every(x => x.left || x.right), '12-pad-16 has no empty-vs-empty')
}

{
  const m = buildMatchups(field(4), mulberry32(5))
  assert.strictEqual(m.length, 3)
  assert.strictEqual(m[0].feedsTo, 2)
  assert.strictEqual(m[1].feedsTo, 2)
  assert.strictEqual(m[2].feedsTo, null)
}

assert.deepStrictEqual(resolveWinnerSide(3, 1, () => 0.9), { side: 0, wasTie: false })
assert.deepStrictEqual(resolveWinnerSide(1, 4, () => 0.1), { side: 1, wasTie: false })
assert.deepStrictEqual(resolveWinnerSide(2, 2, () => 0.1), { side: 0, wasTie: true })
assert.deepStrictEqual(resolveWinnerSide(0, 0, () => 0.7), { side: 1, wasTie: true })

console.log('engine/bracket.test.ts: ok')
