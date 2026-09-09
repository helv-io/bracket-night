export type Phase =
  | 'lobby'
  | 'matchup'
  | 'tally'
  | 'coin'
  | 'champion'

export type ErrorCode =
  | 'UNKNOWN_ROOM'
  | 'ROOM_FULL'
  | 'LATE_JOIN'
  | 'NAME_REQUIRED'
  | 'NO_FIELD'
  | 'NOT_ENOUGH_PLAYERS'
  | 'ALREADY_STARTED'
  | 'NOT_STARTED'
  | 'ALREADY_VOTED'
  | 'BAD_CHOICE'
  | 'NOT_HOST'
  | 'NO_MATCHUP'
  | 'FIELD_SET'
  | 'BAD_FIELD'

export interface NightError {
  code: ErrorCode
  message: string
}

export interface Contestant {
  id: string
  name: string
  imageUrl: string
}

export interface Field {
  title: string
  subtitle: string
  contestants: Contestant[]
  source: 'showcase' | 'code' | 'inline'
  code?: string
}

export interface Matchup {
  id: number
  round: number
  left: Contestant | null
  right: Contestant | null
  winner: Contestant | null
  bye: boolean
  feedsTo: number | null
  feedsSlot: 0 | 1 | null
}

export interface Player {
  id: string
  name: string
  connected: boolean
  socketId: string | null
}

export interface Vote {
  playerId: string
  choice: 0 | 1
}

export interface Tallies {
  left: number
  right: number
}

export interface LastResult {
  matchupId: number
  wasTie: boolean
  bye: boolean
  tallies: Tallies
  winnerSide: 0 | 1
  winner: Contestant
}

export interface RoomSnapshot {
  roomId: string
  phase: Phase
  hostSocketId: string | null
  field: Field | null
  matchups: Matchup[]
  currentMatchupIndex: number
  players: Player[]
  votes: Vote[]
  started: boolean
  champion: Contestant | null
  lastResult: LastResult | null
  maxPlayers: number
  waitingOn: string[]
}

export const MIN_PLAYERS = 2
export const MAX_PLAYERS_CAP = 16
export const MIN_CONTESTANTS = 2
export const MAX_CONTESTANTS = 16
