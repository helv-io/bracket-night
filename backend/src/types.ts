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
  name: string
  image_url: string
  internal_url: string
}

export interface Matchup {
  id: number
  left: Contestant | null
  right: Contestant | null
  winner: Contestant | null
}

export interface Player {
  id: string
  name: string
}

export interface Vote {
  playerId: string
  choice: number // 0 for left, 1 for right
}