import assert from 'assert'
import { Room } from '../../engine/src/room'
import { inlineField, showcaseField } from '../../engine/src/showcase'
import { mulberry32 } from '../../engine/src/rng'
import { SimCase } from './types'

const names = (n: number) => Array.from({ length: n }, (_, i) => `Sim ${i + 1}`)

const makeRoom = (seed: number, max = 16) =>
  new Room({ roomId: `E${seed}`, hostSocketId: 'host', maxPlayers: max, rng: mulberry32(seed) })

const joinMany = (room: Room, n: number) => {
  for (let i = 0; i < n; i++) {
    const result = room.join(`Bot ${i + 1}`, `s${i + 1}`)
    assert.ok(!('error' in result), JSON.stringify(result))
  }
}

const playToChampion = (room: Room, pick: 0 | 1 | 'split' = 0) => {
  let guard = 0
  while (room.snapshot().phase !== 'champion') {
    guard += 1
    assert.ok(guard < 100, 'engine night ran away')
    const snap = room.snapshot()
    if (snap.phase === 'coin' || snap.phase === 'tally') {
      room.acknowledgeCinematic()
      continue
    }
    for (let i = 0; i < snap.players.length; i++) {
      const choice = pick === 'split' ? ((i % 2) as 0 | 1) : pick
      const result = room.vote(snap.players[i].id, choice)
      assert.ok(!result.error, result.error?.message)
    }
    if (room.snapshot().phase === 'coin' || room.snapshot().phase === 'tally') {
      room.acknowledgeCinematic()
    }
  }
}

export const engineCases: SimCase[] = [
  {
    id: 'engine-4p-8c',
    title: '4 players / 8 contestants to a single champion',
    layer: 'engine',
    run: () => {
      const room = makeRoom(10)
      joinMany(room, 4)
      assert.strictEqual(room.setField(inlineField('Four', 'Engine', names(8))), null)
      assert.strictEqual(room.start(), null)
      playToChampion(room, 0)
      assert.ok(room.snapshot().champion)
    },
  },
  {
    id: 'engine-16p-16c',
    title: '16 players / 16 contestants full night',
    layer: 'engine',
    run: () => {
      const room = makeRoom(11)
      joinMany(room, 16)
      assert.strictEqual(room.setField(inlineField('Sixteen', 'Engine', names(16))), null)
      assert.strictEqual(room.start(), null)
      playToChampion(room, 1)
      assert.strictEqual(room.snapshot().matchups.length, 15)
      assert.ok(room.snapshot().champion)
    },
  },
  {
    id: 'engine-byes-6',
    title: '6 contestants pad to 8 with real-vs-empty byes',
    layer: 'engine',
    run: () => {
      const room = makeRoom(12)
      joinMany(room, 4)
      assert.strictEqual(room.setField(inlineField('Six', 'Byes', names(6))), null)
      assert.strictEqual(room.start(), null)
      const first = room.snapshot().matchups.filter(m => m.round === 0)
      assert.ok(first.every(m => m.left || m.right))
      assert.ok(first.some(m => m.bye))
      playToChampion(room, 0)
    },
  },
  {
    id: 'engine-byes-12',
    title: '12 contestants pad to 16 with byes',
    layer: 'engine',
    run: () => {
      const room = makeRoom(13)
      joinMany(room, 8)
      assert.strictEqual(room.setField(inlineField('Twelve', 'Byes', names(12))), null)
      assert.strictEqual(room.start(), null)
      playToChampion(room, 1)
      assert.ok(room.snapshot().champion)
    },
  },
  {
    id: 'engine-tie-coin',
    title: 'Even split emits wasTie and coin phase',
    layer: 'engine',
    run: () => {
      const room = makeRoom(14)
      joinMany(room, 4)
      assert.strictEqual(room.setField(inlineField('Tie', 'Coin', names(4))), null)
      assert.strictEqual(room.start(), null)
      const players = room.snapshot().players
      room.vote(players[0].id, 0)
      room.vote(players[1].id, 0)
      room.vote(players[2].id, 1)
      room.vote(players[3].id, 1)
      const snap = room.snapshot()
      assert.strictEqual(snap.lastResult?.wasTie, true)
      assert.strictEqual(snap.phase, 'coin')
    },
  },
  {
    id: 'engine-disconnect-reconnect',
    title: 'Disconnect keeps player id; reconnect by name; vote still locks',
    layer: 'engine',
    run: () => {
      const room = makeRoom(15)
      joinMany(room, 4)
      room.setField(showcaseField())
      room.start()
      const before = room.snapshot().players[1]
      room.vote(before.id, 0)
      room.disconnect('s2')
      const back = room.join('Bot 2', 's2-new')
      assert.ok(!('error' in back))
      assert.strictEqual(back.reconnected, true)
      assert.strictEqual(back.player.id, before.id)
      const again = room.vote(before.id, 1)
      assert.strictEqual(again.error?.code, 'ALREADY_VOTED')
    },
  },
  {
    id: 'engine-late-join',
    title: 'Late join rejected after start',
    layer: 'engine',
    run: () => {
      const room = makeRoom(16)
      joinMany(room, 4)
      room.setField(showcaseField())
      room.start()
      const late = room.join('Late', 'late')
      assert.ok('error' in late)
      assert.strictEqual(late.error.code, 'LATE_JOIN')
    },
  },
  {
    id: 'engine-room-full',
    title: 'Room full at 16',
    layer: 'engine',
    run: () => {
      const room = makeRoom(17, 16)
      joinMany(room, 16)
      const extra = room.join('Overflow', 'x')
      assert.ok('error' in extra)
      assert.strictEqual(extra.error.code, 'ROOM_FULL')
    },
  },
  {
    id: 'engine-host-no-field',
    title: 'Host cannot start without a field',
    layer: 'engine',
    run: () => {
      const room = makeRoom(18)
      joinMany(room, 4)
      const start = room.start()
      assert.ok(start)
      assert.strictEqual(start.code, 'NO_FIELD')
    },
  },
  {
    id: 'engine-host-resolve',
    title: 'Host resolve_now skips disconnected voters',
    layer: 'engine',
    run: () => {
      const room = makeRoom(19)
      joinMany(room, 4)
      room.setField(inlineField('Force', 'Resolve', names(4)))
      room.start()
      room.vote(room.snapshot().players[0].id, 0)
      room.disconnect('s2')
      room.disconnect('s3')
      room.disconnect('s4')
      const forced = room.resolveNow()
      assert.ok(!forced.error)
      assert.ok(room.snapshot().lastResult)
    },
  },
  {
    id: 'engine-showcase',
    title: 'House showcase field (8) to champion',
    layer: 'engine',
    run: () => {
      const room = makeRoom(20)
      joinMany(room, 5)
      assert.strictEqual(room.setField(showcaseField()), null)
      assert.strictEqual(room.snapshot().field?.code, 'showcase')
      assert.strictEqual(room.start(), null)
      playToChampion(room, 0)
      assert.ok(room.snapshot().champion)
    },
  },
]
