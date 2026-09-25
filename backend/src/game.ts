import { randomBytes } from 'crypto'
import { Server, Socket } from 'socket.io'
import { coinTimeoutMs, config } from './config'
import { getBracketByCode } from './db'
import { getDemoBracket } from './demoBracket'
import { Night, Room, secretsEqual } from './room'
import { Bracket } from './types'

const generateGameId = () => randomBytes(4).toString('hex').toUpperCase()

function useRandomRooms(): boolean {
  return process.env.BRACKET_RANDOM_ROOMS === '1' || !config.dev
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function resolveBracket(code: string): Bracket | null {
  return getDemoBracket(code) || getBracketByCode(code)
}

/**
 * Socket.IO adapter. Identity lives on the room (player token + host token).
 * Reconnects rebind the pipe; they never mint a new seat or reset the night.
 */
export class Game {
  private io: Server
  private night = new Night()
  private coinTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(io: Server) {
    this.io = io
    io.on('connection', (socket: Socket) => this.bind(socket))
  }

  shutdown() {
    for (const timer of this.coinTimers.values()) clearTimeout(timer)
    this.coinTimers.clear()
  }

  private bind(socket: Socket) {
    socket.on('create_game', () => this.createGame(socket))
    socket.on('host_attach', (payload: unknown) => this.hostAttach(socket, payload))
    socket.on('join', (payload: unknown) => this.join(socket, payload))
    socket.on('set_bracket', (payload: unknown) => this.setBracket(socket, payload))
    socket.on('start_game', (payload: unknown) => this.startGame(socket, payload))
    socket.on('vote', (payload: unknown) => this.vote(socket, payload))
    socket.on('coin_complete', (payload: unknown) => this.coinComplete(socket, payload))
    socket.on('disconnect', () => this.disconnect(socket))
  }

  private freshId(): string {
    let gameId = generateGameId()
    while (this.night.has(gameId)) gameId = generateGameId()
    return gameId
  }

  private welcomeHost(socket: Socket, room: Room) {
    room.hostSocketId = socket.id
    socket.join(room.gameId)
    const payload = { gameId: room.gameId, hostToken: room.hostToken }
    socket.emit('game_created', payload)
    socket.emit('host_attached', payload)
    if (room.phase === 'coin') this.armCoinTimer(room)
    this.emitState(room)
  }

  private createGame(socket: Socket) {
    const already = this.night.hostedBy(socket.id)
    if (already) {
      this.welcomeHost(socket, already)
      return
    }

    if (!useRandomRooms()) {
      const existing = this.night.get('DEV')
      if (existing) {
        if (existing.hostSocketId && existing.hostSocketId !== socket.id) {
          socket.emit('error', 'Host TV is already connected')
          return
        }
        this.welcomeHost(socket, existing)
        return
      }
    }

    const gameId = useRandomRooms() ? this.freshId() : 'DEV'
    const room = this.night.create(gameId)
    this.welcomeHost(socket, room)
  }

  private hostAttach(socket: Socket, raw: unknown) {
    const body = asRecord(raw)
    const gameId = asString(body?.gameId).trim()
    const hostToken = asString(body?.hostToken).trim()
    const room = gameId ? this.night.get(gameId) : undefined
    if (!room || !hostToken || !secretsEqual(room.hostToken, hostToken)) {
      socket.emit('host_attach_failed', { gameId })
      return
    }
    room.hostSocketId = socket.id
    socket.join(room.gameId)
    socket.emit('host_attached', { gameId: room.gameId, hostToken: room.hostToken })
    if (room.phase === 'coin') this.armCoinTimer(room)
    this.emitState(room)
  }

  private join(socket: Socket, raw: unknown) {
    const body = asRecord(raw)
    const gameId = asString(body?.gameId).trim()
    const room = gameId ? this.night.get(gameId) : undefined
    if (!room) {
      socket.emit('error', 'Game not found')
      return
    }

    const result = room.join({
      token: asString(body?.playerToken),
      name: asString(body?.playerName),
      socketId: socket.id,
      maxPlayers: config.maxPlayers,
    })
    if (!result.ok) {
      socket.emit('error', result.error)
      return
    }

    if (result.displacedSocketId) {
      this.io.to(result.displacedSocketId).emit('session_moved')
    }

    socket.join(room.gameId)
    const self = room.selfView(result.player, result.resumed)
    socket.emit('joined', self)
    socket.emit('vote_status', { hasVoted: self.hasVoted, choice: self.choice })
    if (self.isGameMaster) socket.emit('game_master')
    this.io.to(room.gameId).emit('player_joined', { players: room.toPublic().players })
    this.emitState(room)
  }

  private setBracket(socket: Socket, raw: unknown) {
    const body = asRecord(raw)
    const gameId = asString(body?.gameId).trim()
    const code = asString(body?.code).trim()
    const room = gameId ? this.night.get(gameId) : undefined
    if (!room) return

    const bracket = code ? resolveBracket(code) : null
    if (!bracket) {
      socket.emit('error', 'Invalid bracket code')
      return
    }
    const error = room.setBracket(socket.id, bracket)
    if (error) {
      socket.emit('error', error)
      return
    }
    this.io.to(room.gameId).emit('bracket_set', {
      bracket: room.bracket,
      matchups: room.matchups,
      currentMatchupIndex: room.currentMatchupIndex,
    })
    this.emitState(room)
  }

  private startGame(socket: Socket, raw: unknown) {
    const body = asRecord(raw)
    const gameId = asString(body?.gameId).trim()
    const room = gameId ? this.night.get(gameId) : undefined
    if (!room) return
    const error = room.start(socket.id)
    if (error) {
      socket.emit('error', error)
      return
    }
    this.emitState(room)
    this.emitVoteStatusAll(room)
  }

  private vote(socket: Socket, raw: unknown) {
    const body = asRecord(raw)
    const gameId = asString(body?.gameId).trim()
    const choice = body?.choice
    const room = gameId ? this.night.get(gameId) : undefined
    if (!room || typeof choice !== 'number') return

    const result = room.vote(socket.id, choice)
    if (result.error) {
      socket.emit('error', result.error)
      return
    }

    const player = room.playerBySocket(socket.id)
    if (player) {
      const self = room.selfView(player, false)
      socket.emit('vote_status', { hasVoted: self.hasVoted, choice: self.choice })
    }

    this.io.to(room.gameId).emit('vote_cast', {
      currentVotes: room.toPublic().currentVotes,
      players: room.toPublic().players,
    })

    if (result.resolution === 'coin' && room.coin) {
      this.io.to(room.gameId).emit('coin_toss', room.coin)
      this.armCoinTimer(room)
    } else if (result.resolution === 'advance') {
      this.emitAdvance(room, false)
      this.emitVoteStatusAll(room)
    }
    this.emitState(room)
  }

  private coinComplete(_socket: Socket, raw: unknown) {
    const body = asRecord(raw)
    const gameId = asString(body?.gameId).trim()
    const hostToken = asString(body?.hostToken).trim()
    const room = gameId ? this.night.get(gameId) : undefined
    if (!room || !hostToken || !secretsEqual(room.hostToken, hostToken)) return
    this.finishCoin(room)
  }

  private finishCoin(room: Room) {
    if (!room.completeCoin()) return
    this.clearCoinTimer(room.gameId)
    this.emitAdvance(room, true)
    this.emitVoteStatusAll(room)
    this.emitState(room)
  }

  private disconnect(socket: Socket) {
    const rooms = this.night.roomsTouching(socket.id)
    for (const room of rooms) {
      room.disconnectSocket(socket.id)
      this.io.to(room.gameId).emit('player_joined', { players: room.toPublic().players })
      this.emitState(room)
    }
  }

  private emitState(room: Room) {
    this.io.to(room.gameId).emit('game_state', room.toPublic())
  }

  private emitAdvance(room: Room, wasTie: boolean) {
    this.io.to(room.gameId).emit('matchup_advanced', {
      matchups: room.matchups,
      currentMatchupIndex: room.currentMatchupIndex,
      wasTie,
    })
  }

  private emitVoteStatusAll(room: Room) {
    for (const player of room.players) {
      if (!player.socketId) continue
      const target = this.io.sockets.sockets.get(player.socketId)
      if (!target) continue
      const self = room.selfView(player, false)
      target.emit('vote_status', { hasVoted: self.hasVoted, choice: self.choice })
    }
  }

  private armCoinTimer(room: Room) {
    this.clearCoinTimer(room.gameId)
    const ms = coinTimeoutMs()
    if (ms <= 0) return
    const timer = setTimeout(() => {
      const live = this.night.get(room.gameId)
      if (live) this.finishCoin(live)
    }, ms)
    this.coinTimers.set(room.gameId, timer)
  }

  private clearCoinTimer(gameId: string) {
    const timer = this.coinTimers.get(gameId)
    if (!timer) return
    clearTimeout(timer)
    this.coinTimers.delete(gameId)
  }
}

