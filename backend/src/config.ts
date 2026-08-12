import dotenv from 'dotenv'

dotenv.config()

export const config = {
  dev: process.env.NODE_ENV !== 'production',

  maxPlayers: Math.max(2, parseInt(process.env.MAX_PLAYERS || '10', 10)),

  dbFolder: process.env.DB_FOLDER
    || (process.env.NODE_ENV === 'production' ? '../config' : './config'),
  dbPath: process.env.DB_PATH
    || (process.env.NODE_ENV === 'production' ? '../config/bracket.db' : './config/bracket.db'),
  dataPath: process.env.DATA_PATH
    || (process.env.NODE_ENV === 'production' ? '../data' : './data'),

  searxngHost: process.env.SEARXNG_HOST || '',
  imgProxyHost: process.env.IMGPROXY_HOST || '',
  imgProxyKey: process.env.IMGPROXY_KEY || '',
  imgProxySalt: process.env.IMGPROXY_SALT || '',

  aiKey: process.env.OPENAI_API_KEY || '',
  aiModel: process.env.OPENAI_MODEL || '',
  aiUrl: process.env.OPENAI_URL || '',

  // Optional shared secret for expensive AI / image search routes.
  // Prefer API_SECRET; BRACKET_API_SECRET is an alias.
  apiSecret: process.env.API_SECRET || process.env.BRACKET_API_SECRET || '',

  // Comma-separated allowlist for Socket.IO CORS (e.g. https://brackets.example.com).
  // FRONTEND_ORIGIN is an alias for CORS_ORIGIN.
  corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_ORIGIN || '',
}
