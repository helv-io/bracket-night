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

export interface Player {
  id: string        // stable player identifier (never changes during the game)
  name: string
  socketId?: string // current socket connection id (updated on reconnect/rejoin)
}

export interface Vote {
  playerId: string
  choice: number // 0 for left, 1 for right
}

export interface SearXNG {
  query: string
  number_of_results: number
  results: SearXNGResult[]
  answers: unknown[]
  corrections: unknown[]
  infoboxes: unknown[]
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