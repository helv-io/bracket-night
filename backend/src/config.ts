import dotenv from 'dotenv'

dotenv.config()

export const config = {
  dev: process.env.NODE_ENV !== 'production',
  
  maxPlayers: Math.max(2, parseInt(process.env.MAX_PLAYERS || '10', 10)),
  
  dbFolder: process.env.NODE_ENV === 'production' ? '../config' : './config',
  dbPath: process.env.NODE_ENV === 'production' ? '../config/bracket.db' : './config/bracket.db',
  dataPath: process.env.NODE_ENV === 'production' ? '../data' : './data',
  
  searxngHost: process.env.SEARXNG_HOST || 'google.com',
  
  aiKey: process.env.OPENAI_API_KEY || '',
  aiModel: process.env.OPENAI_MODEL || '',
  aiUrl: process.env.OPENAI_URL || '',
}