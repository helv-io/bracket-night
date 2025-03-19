import dotenv from 'dotenv'

dotenv.config()

export const config = {
  maxPlayers: Math.max(2, parseInt(process.env.MAX_PLAYERS || '10', 10)),
  dev: process.env.NODE_ENV !== 'production',
  dbPath: process.env.NODE_ENV === 'production' ? '../config/bracket.db' : './config/bracket.db',
  dataPath: process.env.NODE_ENV === 'production' ? '../data/' : './data/',
  searxngHost: process.env.SEARXNG_HOST || 'google.com'
}