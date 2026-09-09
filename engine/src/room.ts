import {
  Field,
  LastResult,
  Matchup,
  MIN_PLAYERS,
  MAX_PLAYERS_CAP,
  NightError,
  Phase,
  Player,
  RoomSnapshot,
  Vote,
} from './types'
import { buildMatchups, feedWinner, resolveWinnerSide, validateFieldSize } from './bracket'
import { createPlayerId, normalizeName } from './ids'
import { Rng, defaultRng } from './rng'

export interface RoomOptions {
  roomId: string
  hostSocketId: string
  maxPlayers?: number
  rng?: Rng
}

const err = (code: NightError['code'], message: string): NightError => ({ code, message })

export class Room {
  readonly roomId: string
  readonly maxPlayers: number
  hostSocketId: string | null
  private rng: Rng
  private field: Field | null = null
  private matchups: Matchup[] = []
  private currentMatchupIndex = 0
  private players: Player[] = []
  private votes: Vote[] = []
  private started = false
  private phase: Phase = 'lobby'
  private champion: RoomSnapshot['champion'] = null
  private lastResult: LastResult | null = null

  constructor(opts: RoomOptions) {
    this.roomId = opts.roomId
    this.hostSocketId = opts.hostSocketId
    this.maxPlayers = clampMaxPlayers(opts.maxPlayers)
    this.rng = opts.rng || defaultRng
  }

  snapshot(): RoomSnapshot {
    return {
      roomId: this.roomId,
      phase: this.phase,
      hostSocketId: this.hostSocketId,
      field: this.field,
      matchups: this.matchups.map(m => ({ ...m })),
      currentMatchupIndex: this.currentMatchupIndex,
      players: this.players.map(p => ({ ...p })),
      votes: this.votes.map(v => ({ ...v })),
      started: this.started,
      champion: this.champion,
      lastResult: this.lastResult,
      maxPlayers: this.maxPlayers,
      waitingOn: this.waitingOn(),
    }
  }

  isHost(socketId: string): boolean {
    return this.hostSocketId === socketId
  }

  claimHost(socketId: string): void {
    this.hostSocketId = socketId
  }

  join(
    rawName: string,
    socketId: string
  ): { player: Player, reconnected: boolean } | { error: NightError } {
    const name = normalizeName(rawName)
    if (!name) return { error: err('NAME_REQUIRED', 'Enter a display name') }

    const existing = this.players.find(p => normalizeName(p.name).toLowerCase() === name.toLowerCase())
    if (existing) {
      existing.connected = true
      existing.socketId = socketId
      return { player: { ...existing }, reconnected: true }
    }

    if (this.started) {
      return { error: err('LATE_JOIN', 'This night already started. Late join is closed.') }
    }

    if (this.players.length >= this.maxPlayers) {
      return { error: err('ROOM_FULL', `Room is full (${this.maxPlayers} players)`) }
    }

    const player: Player = {
      id: createPlayerId(),
      name,
      connected: true,
      socketId,
    }
    this.players.push(player)
    return { player: { ...player }, reconnected: false }
  }

  disconnect(socketId: string): Player | null {
    const player = this.players.find(p => p.socketId === socketId)
    if (!player) {
      if (this.hostSocketId === socketId) this.hostSocketId = null
      return null
    }
    player.connected = false
    player.socketId = null
    return { ...player }
  }

  setField(field: Field): NightError | null {
    if (this.started) return err('ALREADY_STARTED', 'Cannot change the field after start')
    if (this.field) return err('FIELD_SET', 'Field is already set')
    const sizeError = validateFieldSize(field.contestants.length)
    if (sizeError) return sizeError
    const names = field.contestants.map(c => normalizeName(c.name))
    if (names.some(n => !n)) return err('BAD_FIELD', 'Every contestant needs a name')
    const unique = new Set(names.map(n => n.toLowerCase()))
    if (unique.size !== names.length) return err('BAD_FIELD', 'Contestant names must be unique')

    this.field = {
      ...field,
      contestants: field.contestants.map(c => ({ ...c, name: normalizeName(c.name) })),
    }
    this.matchups = buildMatchups(this.field.contestants, this.rng)
    this.currentMatchupIndex = 0
    this.champion = null
    this.lastResult = null
    this.phase = 'lobby'
    return null
  }

  start(): NightError | null {
    if (this.started) return err('ALREADY_STARTED', 'Night already started')
    if (!this.field) return err('NO_FIELD', 'Load a field before starting')
    if (this.players.length < MIN_PLAYERS) {
      return err('NOT_ENOUGH_PLAYERS', `Need at least ${MIN_PLAYERS} players to start`)
    }
    this.started = true
    this.votes = []
    this.skipByes()
    if (this.phase !== 'champion') this.phase = 'matchup'
    return null
  }

  vote(playerId: string, choice: number): { error?: NightError, advanced?: boolean } {
    if (!this.started) return { error: err('NOT_STARTED', 'Voting has not opened') }
    if (this.phase === 'champion') return { error: err('NO_MATCHUP', 'The night is over') }
    if (this.phase === 'coin' || this.phase === 'tally') {
      return { error: err('NO_MATCHUP', 'Wait for the next matchup') }
    }
    const player = this.players.find(p => p.id === playerId)
    if (!player) return { error: err('UNKNOWN_ROOM', 'You are not in this room') }
    if (choice !== 0 && choice !== 1) return { error: err('BAD_CHOICE', 'Vote 0 (left) or 1 (right)') }

    const current = this.matchups[this.currentMatchupIndex]
    if (!current || !current.left || !current.right) {
      return { error: err('NO_MATCHUP', 'No live matchup') }
    }
    if (this.votes.some(v => v.playerId === playerId)) {
      return { error: err('ALREADY_VOTED', 'You already voted this matchup') }
    }

    this.votes.push({ playerId, choice: choice as 0 | 1 })
    this.phase = 'matchup'

    if (this.allRequiredVoted()) {
      this.resolveCurrent('votes')
      return { advanced: true }
    }
    return {}
  }

  /** Host skips players who have not voted (disconnects, stalls). */
  resolveNow(): { error?: NightError, advanced?: boolean } {
    if (!this.started) return { error: err('NOT_STARTED', 'Night has not started') }
    if (this.phase === 'champion') return { error: err('NO_MATCHUP', 'The night is over') }
    const current = this.matchups[this.currentMatchupIndex]
    if (!current || current.winner) return { error: err('NO_MATCHUP', 'Nothing to resolve') }
    this.resolveCurrent('host')
    return { advanced: true }
  }

  waitingOn(): string[] {
    if (!this.started || this.phase === 'champion' || this.phase === 'coin') return []
    const current = this.matchups[this.currentMatchupIndex]
    if (!current || !current.left || !current.right || current.winner) return []
    const voted = new Set(this.votes.map(v => v.playerId))
    return this.players.filter(p => !voted.has(p.id)).map(p => p.id)
  }

  private allRequiredVoted(): boolean {
    if (this.players.length === 0) return false
    const voted = new Set(this.votes.map(v => v.playerId))
    return this.players.every(p => voted.has(p.id))
  }

  /** Resolve every ready bye, then park the playhead on the next real fight. */
  private skipByes(): void {
    let progressed = true
    while (progressed) {
      progressed = false
      for (const matchup of this.matchups) {
        if (matchup.winner) continue
        const readyBye = matchup.bye && ((matchup.left && !matchup.right) || (!matchup.left && matchup.right))
        if (readyBye) {
          this.resolveBye(matchup.id)
          progressed = true
        }
      }
    }

    const next = this.matchups.findIndex(m => !m.winner && Boolean(m.left && m.right))
    if (next === -1) {
      this.currentMatchupIndex = this.matchups.length
      this.finishIfComplete()
      return
    }
    this.currentMatchupIndex = next
    this.votes = []
  }

  private resolveBye(matchupId: number): void {
    const matchup = this.matchups[matchupId]
    const winner = matchup.left || matchup.right
    if (!winner) return
    matchup.winner = winner
    matchup.bye = true
    const winnerSide: 0 | 1 = matchup.left && matchup.left.id === winner.id ? 0 : 1
    this.lastResult = {
      matchupId,
      wasTie: false,
      bye: true,
      tallies: { left: 0, right: 0 },
      winnerSide,
      winner,
    }
    feedWinner(this.matchups, matchupId, winner)
  }

  private resolveCurrent(_source: 'votes' | 'host'): void {
    const index = this.currentMatchupIndex
    const matchup = this.matchups[index]
    if (!matchup.left || !matchup.right) {
      this.resolveBye(index)
      this.skipByes()
      if (this.phase !== 'champion') this.phase = 'matchup'
      return
    }

    const leftVotes = this.votes.filter(v => v.choice === 0).length
    const rightVotes = this.votes.filter(v => v.choice === 1).length
    const { side, wasTie } = resolveWinnerSide(leftVotes, rightVotes, this.rng)
    const winner = side === 0 ? matchup.left : matchup.right
    matchup.winner = winner
    matchup.bye = false

    this.lastResult = {
      matchupId: matchup.id,
      wasTie,
      bye: false,
      tallies: { left: leftVotes, right: rightVotes },
      winnerSide: side,
      winner,
    }

    feedWinner(this.matchups, index, winner)
    this.currentMatchupIndex = index + 1
    this.votes = []

    this.skipByes()
    if (this.currentMatchupIndex >= this.matchups.length) {
      this.finishIfComplete()
      return
    }
    this.phase = wasTie ? 'coin' : 'tally'
  }

  /**
   * After the TV cinematic, move from coin/tally into the next matchup (or stay champion).
   * Server state already has the winner. This is a presentation beat only.
   */
  acknowledgeCinematic(): void {
    if (this.phase === 'champion') return
    if (this.phase === 'coin' || this.phase === 'tally') {
      if (this.currentMatchupIndex >= this.matchups.length) {
        this.finishIfComplete()
        return
      }
      const current = this.matchups[this.currentMatchupIndex]
      if (current && current.left && current.right && !current.winner) {
        this.phase = 'matchup'
      }
    }
  }

  private finishIfComplete(): void {
    if (this.currentMatchupIndex < this.matchups.length) return
    const final = this.matchups[this.matchups.length - 1]
    this.champion = final.winner
    this.phase = 'champion'
    this.started = true
  }
}

const clampMaxPlayers = (value: number | undefined): number => {
  const n = Number.isFinite(value) ? Math.floor(value as number) : MAX_PLAYERS_CAP
  return Math.min(MAX_PLAYERS_CAP, Math.max(MIN_PLAYERS, n))
}
