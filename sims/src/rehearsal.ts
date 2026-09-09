/**
 * Drive the local DEV TV: join bots, load showcase, play through.
 * Start `npm run dev` first, then `npm run rehearsal`.
 */
import { io, Socket } from 'socket.io-client'

const url = process.env.NIGHT_URL || 'http://127.0.0.1:3001'
const roomId = process.env.NIGHT_ROOM || 'DEV'
const bots = Number(process.env.NIGHT_BOTS || 4)

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type State = {
  phase: string
  waitingOn: string[]
  votes: { playerId: string }[]
  champion?: { name: string }
  field?: { code?: string } | null
  started?: boolean
}

const connect = async (): Promise<Socket> => {
  const socket = io(url, { transports: ['websocket'], reconnection: false })
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
  return socket
}

const track = (socket: Socket) => {
  let current: State | null = null
  const waiters: Array<(s: State) => void> = []
  socket.on('night_state', (state: State) => {
    current = state
    const pending = waiters.splice(0)
    pending.forEach(w => w(state))
  })
  const until = (pred: (s: State) => boolean, ms = 15000) =>
    new Promise<State>((resolve, reject) => {
      if (current && pred(current)) {
        resolve(current)
        return
      }
      const timer = setTimeout(() => reject(new Error('timeout night_state')), ms)
      const watcher = (state: State) => {
        if (!pred(state)) {
          waiters.push(watcher)
          return
        }
        clearTimeout(timer)
        resolve(state)
      }
      waiters.push(watcher)
      if (current && pred(current)) watcher(current)
    })
  return { until, latest: () => current }
}

const main = async () => {
  const hostSocket = await connect()
  const host = track(hostSocket)
  hostSocket.emit('create_room')
  await host.until(s => Boolean(s))

  const players: { socket: Socket, id: string }[] = []
  for (let i = 0; i < bots; i++) {
    const socket = await connect()
    const joined = new Promise<{ player: { id: string } }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout joined')), 8000)
      socket.once('joined', (data: { player: { id: string } }) => {
        clearTimeout(timer)
        resolve(data)
      })
    })
    socket.emit('join', { roomId, name: `Rehearsal ${i + 1}` })
    const data = await joined
    players.push({ socket, id: data.player.id })
  }

  hostSocket.emit('set_field', { roomId, code: 'showcase' })
  await host.until(s => s.field?.code === 'showcase' || Boolean(s.started)).catch(() => undefined)
  await wait(400)
  hostSocket.emit('start_night', { roomId })
  let state = await host.until(s => Boolean(s.started) || s.phase === 'matchup' || s.phase === 'champion')

  for (let round = 0; round < 60 && state.phase !== 'champion'; round++) {
    if (state.phase === 'coin' || state.phase === 'tally') {
      await wait(state.phase === 'coin' ? 2800 : 1200)
      hostSocket.emit('ack_cinematic', { roomId })
      state = await host.until(s => s.phase === 'matchup' || s.phase === 'champion' || s.phase === 'lobby')
      continue
    }
    if (state.phase === 'matchup') {
      await wait(1400)
      const pending = state.waitingOn || []
      const before = (state.votes || []).length
      pending.forEach((playerId, i) => {
        const player = players.find(p => p.id === playerId)
        player?.socket.emit('vote', { roomId, playerId, choice: (i % 2) as 0 | 1 })
      })
      state = await host.until(s =>
        s.phase !== 'matchup' || (s.votes || []).length !== before
      )
      continue
    }
    state = await host.until(s => s.phase !== state.phase)
  }

  console.log(`champion: ${state.champion?.name || 'unknown'} phase=${state.phase}`)
  players.forEach(p => p.socket.disconnect())
  hostSocket.disconnect()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
