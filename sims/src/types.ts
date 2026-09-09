export type Layer = 'engine' | 'socket'

export interface SimCase {
  id: string
  title: string
  layer: Layer
  run: () => Promise<void> | void
}

export interface SimResult {
  id: string
  title: string
  layer: Layer
  ok: boolean
  ms: number
  error?: string
}
