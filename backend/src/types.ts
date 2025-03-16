export interface Bracket {
  id: number
  title: string
  subtitle: string
  contestants: Contestant[]
}

export interface Contestant {
  id: number
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
  id: string
  name: string
}

export interface Vote {
  playerId: string
  choice: number // 0 for left, 1 for right
}