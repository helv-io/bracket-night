export interface Bracket {
  id: number
  code: string
  title: string
  subtitle: string
  contestants: Contestant[]
  isPublic: boolean
}

export interface Contestant {
  id: number
  bracket_id: number
  name: string
  image_url: string
}

export interface Matchup {
  id: number
  left: Contestant | null
  right: Contestant | null
  winner: Contestant | null
}

/** Host TV / engine phase. Additive on game_state (old clients ignore it). */
export type NightPhase = 'lobby' | 'matchup' | 'tally' | 'coin' | 'champion'

export interface Player {
  /** Stable id for the night (votes + reconnect). Not the Socket.IO id. */
  id: string
  name: string
  /** Current connection id. Empty string when disconnected. */
  socketId: string
  connected: boolean
}

export interface VoteTallies {
  left: number
  right: number
}

export interface MatchupAdvance {
  matchups: Matchup[]
  currentMatchupIndex: number
  wasTie: boolean
  bye: boolean
  tallies: VoteTallies
}

export interface GameState {
  gameId: string
  bracket: Bracket | null
  players: Player[]
  currentMatchupIndex: number
  matchups: Matchup[]
  currentVotes: Vote[]
  isGameStarted: boolean
  isGameOver: boolean
  phase: NightPhase
  lastAdvance: MatchupAdvance | null
}

export interface Vote {
  playerId: string
  choice: number // 0 for left, 1 for right
}

export interface SearXNG {
  query: string
  number_of_results: number
  results: SearXNGResult[]
  answers: any[]
  corrections: any[]
  infoboxes: any[]
  suggestions: string[]
  unresponsive_engines: string[][]
}

export interface SearXNGResult {
  template: string
  url: string
  thumbnail_src?: string
  img_src: string
  content: string
  title: string
  source?: string
  resolution?: string
  img_format?: string
  engine: string
  parsed_url: string[]
  thumbnail?: string
  priority: string
  engines: string[]
  positions: number[]
  score: number
  category: string
  filesize?: string
  author?: string
  publishedDate?: string
}

export interface PublicBracket {
  code: string
  title: string
  subtitle: string
}