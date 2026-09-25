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

/** Public seat. `id` is stable for the night and is never a socket id. */
export interface Player {
  id: string
  name: string
  connected: boolean
}

export interface Vote {
  playerId: string
  choice: number // 0 for left, 1 for right
}

export type GamePhase = 'lobby' | 'voting' | 'coin' | 'champion'

/** Server-owned tie. The bracket does not advance until the toss resolves. */
export interface CoinTossState {
  matchupIndex: number
  left: Contestant
  right: Contestant
  winnerSide: 0 | 1
  winner: Contestant
  startedAt: number
}

/** Broadcast view. Must not include host or player secrets. */
export interface PublicGameState {
  gameId: string
  bracket: Bracket | null
  players: Player[]
  currentMatchupIndex: number
  matchups: Matchup[]
  currentVotes: Vote[]
  isGameStarted: boolean
  isGameOver: boolean
  phase: GamePhase
  coin: CoinTossState | null
  gameMasterId: string | null
}

/** Sent only to the joining socket. */
export interface PlayerSelf {
  playerId: string
  playerToken: string
  name: string
  isGameMaster: boolean
  hasVoted: boolean
  choice: number | null
  resumed: boolean
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