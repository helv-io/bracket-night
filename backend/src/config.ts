import dotenv from 'dotenv'

dotenv.config()

export const config = {
  publicHost: process.env.PUBLIC_HOST || 'http://192.168.2.88:3000',
  dbPath: './bracket.db'
}