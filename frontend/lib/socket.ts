import io from 'socket.io-client'
import { apiUrl } from './config'

export const socket = io(apiUrl)