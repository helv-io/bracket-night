export type Phase = 'lobby' | 'matchup' | 'tally' | 'coin' | 'champion'

export interface Contestant {
  id: string
  name: string
  imageUrl: string
}

export interface Matchup {
  id: number
  round: number
  left: Contestant | null
  right: Contestant | null
  winner: Contestant | null
  bye: boolean
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

export interface LastResult {
  matchupId: number
  wasTie: boolean
  bye: boolean
  tallies: { left: number, right: number }
  winnerSide: 0 | 1
  winner: Contestant
}

export interface NightState {
  roomId: string
  phase: Phase
  field: {
    title: string
    subtitle: string
    source: string
    code?: string
    contestants: Contestant[]
  } | null
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

export interface NightError {
  code: string
  message: string
}
