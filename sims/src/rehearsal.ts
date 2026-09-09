/**
 * Drive the local DEV TV: join bots, load showcase, play through.
 * Start `npm run dev` first, then `npm run rehearsal`.
 */
import { io } from 'socket.io-client'

const url = process.env.NIGHT_URL || 'http://127.0.0.1:3001'
const roomId = process.env.NIGHT_ROOM || 'DEV'
const bots = Number(process.env.NIGHT_BOTS || 4)

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const once = <T>(socket: ReturnType<typeof io>, event: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${event}`)), 8000)
    socket.once(event, (data: T) => {
      clearTimeout(timer)
      resolve(data)
    })
  })

const main = async () => {
  const host = io(url, { transports: ['websocket'] })
  host.emit('create_room')
  await once(host, 'room_created').catch(() => undefined)
  await once(host, 'night_state').catch(() => undefined)

  const players = []
  for (let i = 0; i < bots; i++) {
    const socket = io(url, { transports: ['websocket'] })
    socket.emit('join', { roomId, name: `Rehearsal ${i + 1}` })
    const joined = await once<{ player: { id: string } }>(socket, 'joined')
    players.push({ socket, id: joined.player.id })
  }

  host.emit('set_field', { roomId, code: 'showcase' })
  await once(host, 'night_state')
  await wait(800)
  host.emit('start_night', { roomId })

  for (let round = 0; round < 40; round++) {
    const state = await once<{
      phase: string
      waitingOn: string[]
      champion?: { name: string }
    }>(host, 'night_state')
    if (state.phase === 'champion') {
      console.log(`champion: ${state.champion?.name}`)
      break
    }
    if (state.phase === 'coin' || state.phase === 'tally') {
      await wait(state.phase === 'coin' ? 3200 : 1600)
      host.emit('ack_cinematic', { roomId })
      continue
    }
    if (state.phase === 'matchup') {
      await wait(400)
      for (const player of players) {
        if (state.waitingOn.includes(player.id)) {
          player.socket.emit('vote', { roomId, playerId: player.id, choice: round % 2 })
        }
      }
    }
  }

  players.forEach(p => p.socket.disconnect())
  host.disconnect()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
