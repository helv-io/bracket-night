import { randomBytes, timingSafeEqual } from 'crypto'
import {
  Bracket,
  CoinTossState,
  Contestant,
  GamePhase,
  Matchup,
  PlayerSelf,
  PublicGameState,
  Vote,
} from './types'

export interface Seat {
  id: string
  token: string
  name: string
  socketId: string | null
  connected: boolean
}

export type JoinResult =
  | {
      ok: true
      player: Seat
      created: boolean
      resumed: boolean
      displacedSocketId: string | null
    }
  | { ok: false, error: string }

const TOKEN_RE = /^[A-Za-z0-9_-]{8,80}$/

export function newSecret(): string {
  return randomBytes(16).toString('hex')
}

export function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length === 0 || left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function createMatchups(contestants: Contestant[], rng: () => number): Matchup[] {
  const shuffled = contestants.slice()
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const swap = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = swap
  }

  const matchups: Matchup[] = []
  for (let i = 0; i < 8; i++) {
    matchups.push({
      id: i,
      left: shuffled[i * 2],
      right: shuffled[i * 2 + 1],
      winner: null,
    })
  }
  for (let round = 1; round < 4; round++) {
    const count = 8 / Math.pow(2, round)
    for (let i = 0; i < count; i++) {
      matchups.push({
        id: matchups.length,
        left: null,
        right: null,
        winner: null,
      })
    }
  }
  return matchups
}

/**
 * One live night. Player ids and the host key are secrets minted here.
 * Socket ids are only the current pipe and are cleared on disconnect.
 */
export class Room {
  readonly gameId: string
  hostToken: string
  hostSocketId: string | null = null
  bracket: Bracket | null = null
  players: Seat[] = []
  gameMasterId: string | null = null
  currentMatchupIndex = 0
  matchups: Matchup[] = []
  currentVotes: Vote[] = []
  phase: GamePhase = 'lobby'
  coin: CoinTossState | null = null
  isGameStarted = false
  isGameOver = false
  private rng: () => number

  constructor(gameId: string, rng: () => number = Math.random) {
    this.gameId = gameId
    this.hostToken = newSecret()
    this.rng = rng
  }

  toPublic(): PublicGameState {
    return {
      gameId: this.gameId,
      bracket: this.bracket,
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        connected: player.connected,
      })),
      currentMatchupIndex: this.currentMatchupIndex,
      matchups: this.matchups,
      currentVotes: this.currentVotes.map((vote) => ({
        playerId: vote.playerId,
        choice: vote.choice,
      })),
      isGameStarted: this.isGameStarted,
      isGameOver: this.isGameOver,
      phase: this.phase,
      coin: this.coin,
      gameMasterId: this.gameMasterId,
    }
  }

  selfView(player: Seat, resumed: boolean): PlayerSelf {
    const vote = this.currentVotes.find((item) => item.playerId === player.id)
    return {
      playerId: player.id,
      playerToken: player.token,
      name: player.name,
      isGameMaster: player.id === this.gameMasterId,
      hasVoted: Boolean(vote),
      choice: vote ? vote.choice : null,
      resumed,
    }
  }

  join(opts: {
    token?: string | null
    name: string
    socketId: string
    maxPlayers: number
  }): JoinResult {
    const name = opts.name.trim().replace(/\s+/g, ' ').slice(0, 20)
    if (!name) return { ok: false, error: 'Enter a name to join' }

    let token = (opts.token || '').trim()
    if (token && !TOKEN_RE.test(token)) return { ok: false, error: 'Invalid player token' }
    if (!token) token = newSecret()

    const existing = this.players.find((player) => player.token === token)
    if (existing) {
      const displaced =
        existing.socketId && existing.socketId !== opts.socketId ? existing.socketId : null
      existing.socketId = opts.socketId
      existing.connected = true
      return {
        ok: true,
        player: existing,
        created: false,
        resumed: true,
        displacedSocketId: displaced,
      }
    }

    if (this.isGameStarted) return { ok: false, error: 'Game has already started' }
    if (this.players.length >= opts.maxPlayers) return { ok: false, error: 'Game is full' }

    const nameTaken = this.players.some((player) => player.name.toLowerCase() === name.toLowerCase())
    if (nameTaken) return { ok: false, error: 'That name is already taken' }

    const player: Seat = {
      id: newSecret(),
      token,
      name,
      socketId: opts.socketId,
      connected: true,
    }
    this.players.push(player)
    if (!this.gameMasterId) this.gameMasterId = player.id
    return { ok: true, player, created: true, resumed: false, displacedSocketId: null }
  }

  playerBySocket(socketId: string): Seat | undefined {
    return this.players.find((player) => player.socketId === socketId)
  }

  /** Drop the pipe only. The seat, vote, bracket, and coin stay. */
  disconnectSocket(socketId: string): boolean {
    let changed = false
    if (this.hostSocketId === socketId) {
      this.hostSocketId = null
      changed = true
    }
    for (const player of this.players) {
      if (player.socketId === socketId) {
        player.socketId = null
        player.connected = false
        changed = true
      }
    }
    return changed
  }

  setBracket(socketId: string, bracket: Bracket): string | null {
    const player = this.playerBySocket(socketId)
    if (!player || player.id !== this.gameMasterId) return 'Only the game master can set the bracket'
    if (this.isGameStarted || this.bracket) return 'Bracket is already set'
    if (!bracket.contestants || bracket.contestants.length !== 16) return 'Bracket needs 16 contestants'
    this.bracket = {
      ...bracket,
      contestants: bracket.contestants.map((contestant) => ({ ...contestant })),
    }
    this.matchups = createMatchups(this.bracket.contestants, this.rng)
    return null
  }

  start(socketId: string): string | null {
    const player = this.playerBySocket(socketId)
    if (!player || player.id !== this.gameMasterId) return 'Only the game master can start'
    if (!this.bracket) return 'Set a bracket first'
    if (this.isGameStarted) return null
    this.isGameStarted = true
    this.phase = 'voting'
    return null
  }

  vote(socketId: string, choice: number): { error?: string, resolution: 'coin' | 'advance' | null } {
    const player = this.playerBySocket(socketId)
    if (!player) return { error: 'Join the room first', resolution: null }
    if (!this.isGameStarted || this.phase !== 'voting') return { error: 'Voting is closed', resolution: null }
    if (choice !== 0 && choice !== 1) return { error: 'Invalid choice', resolution: null }

    const matchup = this.matchups[this.currentMatchupIndex]
    if (!matchup?.left || !matchup.right) return { error: 'Matchup is not ready', resolution: null }
    if (this.currentVotes.some((vote) => vote.playerId === player.id)) return { resolution: null }

    this.currentVotes.push({ playerId: player.id, choice })
    if (this.currentVotes.length < this.players.length) return { resolution: null }
    return { resolution: this.resolveVotes() }
  }

  private resolveVotes(): 'coin' | 'advance' {
    const matchup = this.matchups[this.currentMatchupIndex]
    const leftVotes = this.currentVotes.filter((vote) => vote.choice === 0).length
    const rightVotes = this.currentVotes.filter((vote) => vote.choice === 1).length
    if (leftVotes === rightVotes) {
      const winnerSide: 0 | 1 = this.rng() < 0.5 ? 0 : 1
      const winner = winnerSide === 0 ? matchup.left! : matchup.right!
      this.phase = 'coin'
      this.coin = {
        matchupIndex: this.currentMatchupIndex,
        left: matchup.left!,
        right: matchup.right!,
        winnerSide,
        winner,
        startedAt: Date.now(),
      }
      return 'coin'
    }
    this.applyWinner(leftVotes > rightVotes ? matchup.left! : matchup.right!)
    return 'advance'
  }

  /** Idempotent. Places the already-chosen toss winner and opens the next matchup. */
  completeCoin(): boolean {
    if (this.phase !== 'coin' || !this.coin) return false
    const winner = this.coin.winner
    this.coin = null
    this.applyWinner(winner)
    return true
  }

  private applyWinner(winner: Contestant) {
    const index = this.currentMatchupIndex
    const matchup = this.matchups[index]
    matchup.winner = winner
    if (index < 14) {
      const next = this.matchups[8 + Math.floor(index / 2)]
      if (index % 2 === 0) next.left = winner
      else next.right = winner
    }
    this.currentVotes = []
    this.currentMatchupIndex = index + 1
    if (this.currentMatchupIndex >= 15) {
      this.isGameOver = true
      this.phase = 'champion'
    } else {
      this.phase = 'voting'
    }
  }
}

export class Night {
  private rooms = new Map<string, Room>()

  create(gameId: string, rng?: () => number): Room {
    const room = new Room(gameId, rng)
    this.rooms.set(gameId, room)
    return room
  }

  get(gameId: string): Room | undefined {
    return this.rooms.get(gameId)
  }

  has(gameId: string): boolean {
    return this.rooms.has(gameId)
  }

  hostedBy(socketId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.hostSocketId === socketId) return room
    }
    return undefined
  }

  /** Rooms whose host pipe or a player pipe is this socket. Snapshot before mutating. */
  roomsTouching(socketId: string): Room[] {
    const found: Room[] = []
    for (const room of this.rooms.values()) {
      if (room.hostSocketId === socketId || room.players.some((player) => player.socketId === socketId)) {
        found.push(room)
      }
    }
    return found
  }
}
