import { randomBytes } from 'crypto'

/** 8-char hex join codes. QR and URL accept any length. */
export const createRoomId = (): string => randomBytes(4).toString('hex').toUpperCase()

export const createPlayerId = (): string => randomBytes(8).toString('hex')

export const createContestantId = (index: number): string =>
  `c${index.toString(16).padStart(4, '0')}`

export const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ')
