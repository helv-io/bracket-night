import dotenv from 'dotenv'

dotenv.config()

export const config = {
  dev: process.env.NODE_ENV !== 'production',
  publicURL: process.env.PUBLIC_URL || 'http://localhost:3000',
  dbPath: process.env.NODE_ENV === 'production' ? '../config/bracket.db' : './config/bracket.db'
}