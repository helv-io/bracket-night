import { io } from 'socket.io-client'

const url = import.meta.env.DEV ? 'http://localhost:3001' : undefined

export const socket = io(url, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
})
