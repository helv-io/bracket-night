const HOST_KEY = 'bn.host.session'

export interface HostSession {
  gameId: string
  hostToken: string
}

export interface PlayerSession {
  token: string
  name: string
}

export function newToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `p${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export function loadHostSession(): HostSession | null {
  try {
    const raw = localStorage.getItem(HOST_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<HostSession>
    if (!parsed.gameId || !parsed.hostToken) return null
    return { gameId: parsed.gameId, hostToken: parsed.hostToken }
  } catch {
    return null
  }
}

export function saveHostSession(session: HostSession) {
  localStorage.setItem(HOST_KEY, JSON.stringify(session))
}

export function clearHostSession() {
  localStorage.removeItem(HOST_KEY)
}

function playerKey(gameId: string) {
  return `bn.player.${gameId}`
}

export function loadPlayerSession(gameId: string): PlayerSession | null {
  if (!gameId) return null
  try {
    const raw = localStorage.getItem(playerKey(gameId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PlayerSession>
    if (!parsed.token || !parsed.name) return null
    return { token: parsed.token, name: parsed.name }
  } catch {
    return null
  }
}

export function savePlayerSession(gameId: string, session: PlayerSession) {
  localStorage.setItem(playerKey(gameId), JSON.stringify(session))
  localStorage.setItem('playerName', session.name)
  localStorage.setItem('gameId', gameId)
}
