import assert from 'assert'
import type { AddressInfo } from 'net'
import { io as ioClient, Socket } from 'socket.io-client'
import { createNightApp } from '../../backend/src/app'
import { inlineField } from '../../engine/src/showcase'
import { RoomSnapshot } from '../../engine/src/types'
import { SimCase } from './types'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type Tracker = {
  socket: Socket
  latest: () => RoomSnapshot | null
  next: (ms?: number) => Promise<RoomSnapshot>
  until: (pred: (s: RoomSnapshot) => boolean, ms?: number) => Promise<RoomSnapshot>
  error: (ms?: number) => Promise<{ code: string, message: string }>
}

const track = (socket: Socket): Tracker => {
  let current: RoomSnapshot | null = null
  const stateWaiters: Array<(s: RoomSnapshot) => void> = []
  const errWaiters: Array<(e: { code: string, message: string }) => void> = []
  socket.on('night_state', (state: RoomSnapshot) => {
    current = state
    const pending = stateWaiters.splice(0)
    for (const waiter of pending) waiter(state)
  })
  socket.on('night_error', (error: { code: string, message: string }) => {
    while (errWaiters.length) errWaiters.shift()?.(error)
  })
  return {
    socket,
    latest: () => current,
    next: (ms = 8000) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout night_state')), ms)
        stateWaiters.push(state => {
          clearTimeout(timer)
          resolve(state)
        })
      }),
    until: (pred, ms = 8000) =>
      new Promise<RoomSnapshot>((resolve, reject) => {
        if (current && pred(current)) {
          resolve(current)
          return
        }
        const timer = setTimeout(() => reject(new Error('timeout waitUntil')), ms)
        const watcher = (state: RoomSnapshot) => {
          if (!pred(state)) {
            stateWaiters.push(watcher)
            return
          }
          clearTimeout(timer)
          resolve(state)
        }
        stateWaiters.push(watcher)
        if (current && pred(current)) {
          watcher(current)
        }
      }),
    error: (ms = 8000) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout night_error')), ms)
        errWaiters.push(err => {
          clearTimeout(timer)
          resolve(err)
        })
      }),
  }
}

let baseUrl = ''
let shutdown: (() => Promise<void>) | null = null

export const startLiveServer = async (): Promise<string> => {
  const night = createNightApp()
  await new Promise<void>(resolve => night.server.listen(0, '127.0.0.1', resolve))
  const port = (night.server.address() as AddressInfo).port
  baseUrl = `http://127.0.0.1:${port}`
  shutdown = () =>
    new Promise((resolve, reject) => {
      night.io.close()
      night.server.close(err => (err ? reject(err) : resolve()))
    })
  return baseUrl
}

export const stopLiveServer = async (): Promise<void> => {
  if (shutdown) await shutdown()
  shutdown = null
}

const connect = async (): Promise<Tracker> => {
  const socket = ioClient(baseUrl, { transports: ['websocket'], forceNew: true, reconnection: false })
  const tracker = track(socket)
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout connect')), 8000)
    socket.once('connect', () => {
      clearTimeout(timer)
      resolve()
    })
    socket.once('connect_error', err => {
      clearTimeout(timer)
      reject(err)
    })
  })
  return tracker
}

const createHost = async () => {
  const host = await connect()
  const created = new Promise<{ roomId: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout room_created')), 8000)
    host.socket.once('room_created', (data: { roomId: string }) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
  host.socket.emit('create_room')
  const { roomId } = await created
  if (!host.latest()) await host.next()
  return { host, roomId }
}

const joinBot = async (roomId: string, name: string) => {
  const bot = await connect()
  const joined = new Promise<{ player: { id: string, name: string }, reconnected: boolean }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout joined')), 8000)
    bot.socket.once('joined', (data: { player: { id: string, name: string }, reconnected: boolean }) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
  const failed = bot.error()
  bot.socket.emit('join', { roomId, name })
  const result = await Promise.race([
    joined.then(data => ({ ok: true as const, data })),
    failed.then(error => ({ ok: false as const, error })),
  ])
  if (!result.ok) {
    bot.socket.disconnect()
    return result
  }
  return {
    ok: true as const,
    tracker: bot,
    player: result.data.player,
    reconnected: result.data.reconnected,
  }
}

const setInline = (host: Tracker, roomId: string, count: number, title = 'Live') => {
  host.socket.emit('set_field', {
    roomId,
    field: inlineField(title, 'Socket', Array.from({ length: count }, (_, i) => `Live ${i + 1}`)),
  })
}

const playToChampion = async (
  host: Tracker,
  roomId: string,
  bots: { tracker: Tracker, player: { id: string } }[]
) => {
  let snap = host.latest()
  let guard = 0
  while (!snap || snap.phase !== 'champion') {
    guard += 1
    assert.ok(guard < 200, 'socket night ran away')
    if (!snap) {
      snap = await host.next()
      continue
    }
    if (snap.phase === 'coin' || snap.phase === 'tally') {
      host.socket.emit('ack_cinematic', { roomId })
      snap = await host.next()
      continue
    }
    if (snap.phase === 'matchup') {
      const pending = snap.waitingOn.slice()
      const votesBefore = snap.votes.length
      if (pending.length === 0) {
        snap = await host.until(s => s.phase !== 'matchup' || s.votes.length !== votesBefore)
        continue
      }
      for (const playerId of pending) {
        const bot = bots.find(b => b.player.id === playerId)
        assert.ok(bot, `missing bot ${playerId}`)
        bot.tracker.socket.emit('vote', { roomId, playerId, choice: 0 })
      }
      snap = await host.until(s => s.phase !== 'matchup' || s.votes.length !== votesBefore)
      continue
    }
    snap = await host.until(s => s !== snap)
  }
  return snap
}

export const socketCases: SimCase[] = [
  {
    id: 'socket-4p-showcase',
    title: 'Live Socket.IO: 4 bots, showcase, champion',
    layer: 'socket',
    run: async () => {
      const { host, roomId } = await createHost()
      const bots = []
      for (let i = 0; i < 4; i++) {
        const bot = await joinBot(roomId, `Live ${i + 1}`)
        assert.ok(bot.ok, bot.ok ? '' : bot.error.message)
        if (bot.ok) bots.push(bot)
      }
      host.socket.emit('set_field', { roomId, code: 'showcase' })
      let snap = await host.until(s => s.field?.code === 'showcase')
      assert.strictEqual(snap.field?.code, 'showcase')
      host.socket.emit('start_night', { roomId })
      await host.until(s => s.started)
      snap = await playToChampion(host, roomId, bots)
      assert.strictEqual(snap.phase, 'champion')
      assert.ok(snap.champion)
      bots.forEach(b => b.ok && b.tracker.socket.disconnect())
      host.socket.disconnect()
    },
  },
  {
    id: 'socket-unknown-room',
    title: 'Live Socket.IO: unknown room is a clear reject',
    layer: 'socket',
    run: async () => {
      const socket = await connect()
      const err = socket.error()
      socket.socket.emit('join', { roomId: 'NOPE1234', name: 'Ghost' })
      const error = await err
      assert.strictEqual(error.code, 'UNKNOWN_ROOM')
      socket.socket.disconnect()
    },
  },
  {
    id: 'socket-late-join',
    title: 'Live Socket.IO: late join rejected after start',
    layer: 'socket',
    run: async () => {
      const { host, roomId } = await createHost()
      const bots = []
      for (let i = 0; i < 4; i++) {
        const bot = await joinBot(roomId, `LateBot ${i + 1}`)
        assert.ok(bot.ok)
        if (bot.ok) bots.push(bot)
      }
      setInline(host, roomId, 4)
      await host.until(s => Boolean(s.field))
      host.socket.emit('start_night', { roomId })
      await host.until(s => s.started)
      const late = await joinBot(roomId, 'Too Late')
      assert.strictEqual(late.ok, false)
      if (!late.ok) assert.strictEqual(late.error.code, 'LATE_JOIN')
      bots.forEach(b => b.ok && b.tracker.socket.disconnect())
      host.socket.disconnect()
    },
  },
  {
    id: 'socket-reconnect',
    title: 'Live Socket.IO: disconnect and reconnect by name',
    layer: 'socket',
    run: async () => {
      const { host, roomId } = await createHost()
      const first = await joinBot(roomId, 'Replay')
      assert.ok(first.ok)
      if (!first.ok) return
      const id = first.player.id
      first.tracker.socket.disconnect()
      await wait(50)
      const again = await joinBot(roomId, 'Replay')
      assert.ok(again.ok)
      if (again.ok) {
        assert.strictEqual(again.reconnected, true)
        assert.strictEqual(again.player.id, id)
        again.tracker.socket.disconnect()
      }
      host.socket.disconnect()
    },
  },
  {
    id: 'socket-tie-coin',
    title: 'Live Socket.IO: even split -> coin phase',
    layer: 'socket',
    run: async () => {
      const { host, roomId } = await createHost()
      const bots = []
      for (let i = 0; i < 4; i++) {
        const bot = await joinBot(roomId, `Coin ${i + 1}`)
        assert.ok(bot.ok)
        if (bot.ok) bots.push(bot)
      }
      setInline(host, roomId, 4, 'Coin Night')
      await host.until(s => Boolean(s.field))
      host.socket.emit('start_night', { roomId })
      let snap = await host.until(s => s.phase === 'matchup')
      assert.strictEqual(snap.phase, 'matchup')
      const choices: Array<0 | 1> = [0, 0, 1, 1]
      bots.forEach((bot, i) => {
        if (bot.ok) bot.tracker.socket.emit('vote', { roomId, playerId: bot.player.id, choice: choices[i] })
      })
      snap = await host.until(s => s.phase === 'coin')
      assert.strictEqual(snap.phase, 'coin')
      assert.strictEqual(snap.lastResult?.wasTie, true)
      bots.forEach(b => b.ok && b.tracker.socket.disconnect())
      host.socket.disconnect()
    },
  },
  {
    id: 'socket-host-resolve',
    title: 'Live Socket.IO: host resolve_now after disconnects',
    layer: 'socket',
    run: async () => {
      const { host, roomId } = await createHost()
      const bots = []
      for (let i = 0; i < 4; i++) {
        const bot = await joinBot(roomId, `Skip ${i + 1}`)
        assert.ok(bot.ok)
        if (bot.ok) bots.push(bot)
      }
      setInline(host, roomId, 4)
      await host.until(s => Boolean(s.field))
      host.socket.emit('start_night', { roomId })
      await host.until(s => s.started && s.phase === 'matchup')
      if (bots[0].ok) {
        bots[0].tracker.socket.emit('vote', { roomId, playerId: bots[0].player.id, choice: 1 })
        await host.until(s => s.votes.length >= 1)
      }
      bots.slice(1).forEach(b => b.ok && b.tracker.socket.disconnect())
      await wait(40)
      host.socket.emit('resolve_now', { roomId })
      const snap = await host.until(s => Boolean(s.lastResult))
      assert.ok(snap.lastResult)
      bots[0].ok && bots[0].tracker.socket.disconnect()
      host.socket.disconnect()
    },
  },
  {
    id: 'socket-16p',
    title: 'Live Socket.IO: 16 bots / 16 contestants to champion',
    layer: 'socket',
    run: async () => {
      const { host, roomId } = await createHost()
      const bots = []
      for (let i = 0; i < 16; i++) {
        const bot = await joinBot(roomId, `Crowd ${i + 1}`)
        assert.ok(bot.ok, `join ${i}`)
        if (bot.ok) bots.push(bot)
      }
      const full = await joinBot(roomId, 'Overflow')
      assert.strictEqual(full.ok, false)
      if (!full.ok) assert.strictEqual(full.error.code, 'ROOM_FULL')
      setInline(host, roomId, 16, 'Crowd')
      await host.until(s => Boolean(s.field) && s.field?.contestants.length === 16)
      host.socket.emit('start_night', { roomId })
      await host.until(s => s.started)
      const snap = await playToChampion(host, roomId, bots)
      assert.strictEqual(snap.phase, 'champion')
      bots.forEach(b => b.ok && b.tracker.socket.disconnect())
      host.socket.disconnect()
    },
  },
]
