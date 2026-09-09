import assert from 'assert'
import { Room } from './room'
import { inlineField, showcaseField } from './showcase'
import { mulberry32 } from './rng'
import { MIN_PLAYERS } from './types'

const names = (n: number) => Array.from({ length: n }, (_, i) => `Fighter ${i + 1}`)

function room(seed = 1, maxPlayers = 16) {
  return new Room({
    roomId: 'TEST',
    hostSocketId: 'host',
    maxPlayers,
    rng: mulberry32(seed),
  })
}

function fillPlayers(r: Room, count: number) {
  for (let i = 0; i < count; i++) {
    const result = r.join(`Player ${i + 1}`, `sock-${i + 1}`)
    assert.ok(!('error' in result), 'join should succeed')
  }
}

function playAll(r: Room, pick: 0 | 1 | 'split' = 0) {
  let guard = 0
  while (r.snapshot().phase !== 'champion') {
    guard += 1
    assert.ok(guard < 80, 'night ran away')
    const snap = r.snapshot()
    if (snap.phase === 'coin' || snap.phase === 'tally') {
      r.acknowledgeCinematic()
      continue
    }
    const players = snap.players
    players.forEach((p, i) => {
      const choice = pick === 'split' ? ((i % 2) as 0 | 1) : pick
      const voted = r.vote(p.id, choice)
      assert.ok(!voted.error, voted.error?.message)
    })
    const after = r.snapshot()
    if (after.phase === 'coin' || after.phase === 'tally') r.acknowledgeCinematic()
  }
}

{
  const r = room()
  fillPlayers(r, 4)
  const set = r.setField(inlineField('Four', 'Night', names(8)))
  assert.strictEqual(set, null)
  assert.strictEqual(r.start(), null)
  playAll(r, 0)
  const snap = r.snapshot()
  assert.strictEqual(snap.phase, 'champion')
  assert.ok(snap.champion, 'single champion')
  assert.strictEqual(snap.matchups.filter(m => !m.winner).length, 0)
}

{
  const r = room(9)
  fillPlayers(r, 16)
  assert.strictEqual(r.setField(inlineField('Sixteen', 'Night', names(16))), null)
  assert.strictEqual(r.start(), null)
  playAll(r, 1)
  assert.ok(r.snapshot().champion)
  assert.strictEqual(r.snapshot().matchups.length, 15)
}

{
  const r = room(2)
  fillPlayers(r, 6)
  assert.strictEqual(r.setField(inlineField('Byes', 'Six', names(6))), null)
  assert.strictEqual(r.start(), null)
  const first = r.snapshot().matchups.filter(m => m.round === 0)
  assert.ok(first.some(m => m.bye && m.winner), 'opening byes auto-advance')
  playAll(r, 0)
  assert.ok(r.snapshot().champion)
}

{
  const r = room(3)
  fillPlayers(r, 4)
  assert.strictEqual(r.setField(inlineField('Twelve', 'Byes', names(12))), null)
  assert.strictEqual(r.start(), null)
  playAll(r, 1)
  assert.ok(r.snapshot().champion)
}

{
  const r = room(7)
  fillPlayers(r, 4)
  assert.strictEqual(r.setField(inlineField('Tie', 'Coin', names(4))), null)
  assert.strictEqual(r.start(), null)
  const players = r.snapshot().players
  r.vote(players[0].id, 0)
  r.vote(players[1].id, 0)
  r.vote(players[2].id, 1)
  r.vote(players[3].id, 1)
  const snap = r.snapshot()
  assert.strictEqual(snap.lastResult?.wasTie, true)
  assert.strictEqual(snap.phase, 'coin')
  assert.ok(snap.lastResult?.winner)
  r.acknowledgeCinematic()
  assert.ok(r.snapshot().phase === 'matchup' || r.snapshot().phase === 'champion')
}

{
  const r = room(4)
  fillPlayers(r, 4)
  assert.strictEqual(r.setField(showcaseField()), null)
  assert.strictEqual(r.start(), null)
  const disconnected = r.disconnect('sock-2')
  assert.ok(disconnected)
  assert.strictEqual(disconnected.connected, false)
  const again = r.join('Player 2', 'sock-2b')
  assert.ok(!('error' in again))
  assert.strictEqual(again.reconnected, true)
  assert.strictEqual(again.player.id, disconnected.id)
  const mid = r.snapshot().players.find(p => p.id === disconnected.id)
  assert.strictEqual(mid?.connected, true)
  playAll(r, 0)
  assert.ok(r.snapshot().champion)
}

{
  const r = room(5)
  fillPlayers(r, 4)
  assert.strictEqual(r.setField(showcaseField()), null)
  assert.strictEqual(r.start(), null)
  const late = r.join('Late', 'sock-late')
  assert.ok('error' in late)
  assert.strictEqual(late.error.code, 'LATE_JOIN')
}

{
  const r = room(6, 4)
  fillPlayers(r, 4)
  const full = r.join('Extra', 'sock-x')
  assert.ok('error' in full)
  assert.strictEqual(full.error.code, 'ROOM_FULL')
}

{
  const r = room()
  fillPlayers(r, 4)
  const started = r.start()
  assert.ok(started)
  assert.strictEqual(started.code, 'NO_FIELD')
}

{
  const r = room()
  r.setField(showcaseField())
  const started = r.start()
  assert.ok(started)
  assert.strictEqual(started.code, 'NOT_ENOUGH_PLAYERS')
  assert.ok(MIN_PLAYERS >= 2)
}

{
  const r = room(8)
  fillPlayers(r, 4)
  r.setField(inlineField('Host', 'Skip', names(4)))
  r.start()
  const p = r.snapshot().players[0]
  r.vote(p.id, 0)
  r.disconnect('sock-2')
  r.disconnect('sock-3')
  r.disconnect('sock-4')
  const forced = r.resolveNow()
  assert.ok(!forced.error)
  assert.ok(r.snapshot().lastResult)
}

{
  const r = room(11)
  const first = r.join('Ada', 's1')
  assert.ok(!('error' in first))
  const id = first.player.id
  r.disconnect('s1')
  const back = r.join('Ada', 's2')
  assert.ok(!('error' in back))
  assert.strictEqual(back.player.id, id)
}

console.log('engine/room.test.ts: ok')
