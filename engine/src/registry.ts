import { NightError, RoomSnapshot } from './types'
import { createRoomId } from './ids'
import { Room, RoomOptions } from './room'
import { Rng } from './rng'

export interface RegistryOptions {
  dev?: boolean
  maxPlayers?: number
  rngFactory?: () => Rng
}

/**
 * In-process room map. A process restart wipes every live night.
 */
export class NightRegistry {
  private rooms = new Map<string, Room>()
  private dev: boolean
  private maxPlayers: number
  private rngFactory?: () => Rng

  constructor(opts: RegistryOptions = {}) {
    this.dev = Boolean(opts.dev)
    this.maxPlayers = opts.maxPlayers ?? 16
    this.rngFactory = opts.rngFactory
  }

  create(hostSocketId: string, requestedId?: string): Room {
    let roomId = this.dev ? 'DEV' : (requestedId || createRoomId())
    if (this.dev) {
      const existing = this.rooms.get('DEV')
      if (existing) {
        existing.claimHost(hostSocketId)
        return existing
      }
      roomId = 'DEV'
    } else {
      while (this.rooms.has(roomId)) {
        roomId = createRoomId()
      }
    }

    const room = new Room({
      roomId,
      hostSocketId,
      maxPlayers: this.maxPlayers,
      rng: this.rngFactory ? this.rngFactory() : undefined,
    })
    this.rooms.set(roomId, room)
    return room
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  require(roomId: string): Room | { error: NightError } {
    const room = this.rooms.get(roomId)
    if (!room) {
      return {
        error: {
          code: 'UNKNOWN_ROOM',
          message: 'No night with that code. Codes die when the server restarts.',
        },
      }
    }
    return room
  }

  snapshot(roomId: string): RoomSnapshot | null {
    return this.rooms.get(roomId)?.snapshot() ?? null
  }

  forget(roomId: string): void {
    this.rooms.delete(roomId)
  }

  size(): number {
    return this.rooms.size
  }

  all(): Room[] {
    return [...this.rooms.values()]
  }

  createOptions(): Omit<RoomOptions, 'roomId' | 'hostSocketId'> {
    return { maxPlayers: this.maxPlayers }
  }
}
