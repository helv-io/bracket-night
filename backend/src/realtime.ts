import { Server, Socket } from 'socket.io'
import { NightRegistry, Room, Field, showcaseField, NightError } from '../../engine/src'
import { getBracketByCode } from './db'
import { config } from './config'

const toFieldFromCode = (code: string): Field | NightError => {
  if (code.trim().toLowerCase() === 'showcase') return showcaseField()
  const bracket = getBracketByCode(code)
  if (!bracket) {
    return { code: 'BAD_FIELD', message: 'No template with that code' }
  }
  return {
    title: bracket.title,
    subtitle: bracket.subtitle,
    source: 'code',
    code: bracket.code,
    contestants: bracket.contestants.map(c => ({
      id: String(c.id),
      name: c.name,
      imageUrl: c.image_url,
    })),
  }
}

const emitError = (socket: Socket, error: NightError) => {
  socket.emit('night_error', error)
}

const broadcast = (io: Server, room: Room) => {
  io.to(room.roomId).emit('night_state', room.snapshot())
}

const asRoom = (registry: NightRegistry, roomId: unknown): Room | { error: NightError } => {
  if (typeof roomId !== 'string' || !roomId.trim()) {
    return { error: { code: 'UNKNOWN_ROOM', message: 'Missing room code' } }
  }
  return registry.require(roomId.trim().toUpperCase())
}

const canHost = (room: Room, socket: Socket): boolean => {
  if (room.isHost(socket.id)) return true
  // Local/dev nights: any socket may drive host controls (rehearsal + sims).
  return config.dev
}

export const attachRealtime = (io: Server, registry: NightRegistry): void => {
  io.on('connection', (socket: Socket) => {
    socket.on('create_room', () => {
      const room = registry.create(socket.id)
      socket.join(room.roomId)
      socket.emit('room_created', { roomId: room.roomId })
      broadcast(io, room)
    })

    socket.on('join', ({ roomId, name }: { roomId?: string, name?: string }) => {
      const found = asRoom(registry, roomId)
      if ('error' in found) {
        emitError(socket, found.error)
        return
      }
      const result = found.join(name || '', socket.id)
      if ('error' in result) {
        emitError(socket, result.error)
        return
      }
      socket.join(found.roomId)
      socket.emit('joined', {
        player: result.player,
        reconnected: result.reconnected,
        roomId: found.roomId,
      })
      broadcast(io, found)
    })

    socket.on('set_field', ({
      roomId,
      code,
      field,
    }: {
      roomId?: string
      code?: string
      field?: Field
    }) => {
      const found = asRoom(registry, roomId)
      if ('error' in found) {
        emitError(socket, found.error)
        return
      }
      if (!canHost(found, socket)) {
        emitError(socket, { code: 'NOT_HOST', message: 'Only the TV host can set the field' })
        return
      }
      const next = field
        ? field
        : typeof code === 'string'
          ? toFieldFromCode(code)
          : { code: 'BAD_FIELD' as const, message: 'Provide a field or a template code' }
      if ('message' in next && 'code' in next && !('contestants' in next)) {
        emitError(socket, next)
        return
      }
      const error = found.setField(next as Field)
      if (error) {
        emitError(socket, error)
        return
      }
      broadcast(io, found)
    })

    socket.on('start_night', ({ roomId }: { roomId?: string }) => {
      const found = asRoom(registry, roomId)
      if ('error' in found) {
        emitError(socket, found.error)
        return
      }
      if (!canHost(found, socket)) {
        emitError(socket, { code: 'NOT_HOST', message: 'Only the TV host can start' })
        return
      }
      const error = found.start()
      if (error) {
        emitError(socket, error)
        return
      }
      broadcast(io, found)
    })

    socket.on('vote', ({ roomId, playerId, choice }: { roomId?: string, playerId?: string, choice?: number }) => {
      const found = asRoom(registry, roomId)
      if ('error' in found) {
        emitError(socket, found.error)
        return
      }
      const player = found.snapshot().players.find(p => p.id === playerId || p.socketId === socket.id)
      if (!player) {
        emitError(socket, { code: 'UNKNOWN_ROOM', message: 'Join before voting' })
        return
      }
      const result = found.vote(player.id, choice as number)
      if (result.error) {
        emitError(socket, result.error)
        return
      }
      broadcast(io, found)
    })

    socket.on('resolve_now', ({ roomId }: { roomId?: string }) => {
      const found = asRoom(registry, roomId)
      if ('error' in found) {
        emitError(socket, found.error)
        return
      }
      if (!canHost(found, socket)) {
        emitError(socket, { code: 'NOT_HOST', message: 'Only the TV host can force a resolve' })
        return
      }
      const result = found.resolveNow()
      if (result.error) {
        emitError(socket, result.error)
        return
      }
      broadcast(io, found)
    })

    socket.on('ack_cinematic', ({ roomId }: { roomId?: string }) => {
      const found = asRoom(registry, roomId)
      if ('error' in found) return
      if (!canHost(found, socket) && !config.dev) return
      found.acknowledgeCinematic()
      broadcast(io, found)
    })

    socket.on('disconnect', () => {
      for (const room of registry.all()) {
        const player = room.disconnect(socket.id)
        if (player || room.hostSocketId === null) {
          io.to(room.roomId).emit('night_state', room.snapshot())
        }
      }
    })
  })
}
