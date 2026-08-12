// Core imports for fs
import fs from 'fs'
import { config } from './config'

// Create the db and data directories if they don't exist
if (!fs.existsSync(config.dbFolder))
  fs.mkdirSync(config.dbFolder, { recursive: true })
if (!fs.existsSync(`${config.dataPath}/images`))
  fs.mkdirSync(`${config.dataPath}/images`, { recursive: true })

// External imports
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import path from 'path'
import rateLimit from 'express-rate-limit'

// Local imports
import { Game } from './game'
import { getImageURLs } from './image'
import { Bracket } from './types'
import { createBracket, isCodeUnique, getPublicBrackets } from './db'
import { AiUnavailableError, getContestants } from './ai'
import { getCorsOrigins, requireApiSecret, sanitizeTopic } from './security'

const app = express()
const server = http.createServer(app)
const corsOrigin = getCorsOrigins()
const io = new Server(server,
  {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    }
  }
)

// Initialize game logic
new Game(io)

// Serve frontend static html files.
app.use(express.static(path.join(__dirname, '../frontend/out'), { extensions: ['html'] }))

// Serve data files statically
app.use('/data', express.static(config.dataPath, { maxAge: '1d' }))

// API endpoint to create a new bracket
app.use(express.json())
app.post('/api/create-bracket', async (req, res) => {
  const bracket: Bracket = req.body
  if (!bracket.title || !bracket.subtitle || !bracket.contestants || bracket.contestants.length !== 16) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  const code = await createBracket(bracket.title, bracket.subtitle, bracket.contestants, bracket.isPublic, bracket.code)
  res.json({ code })
})

// Strict rate limit for expensive AI + image-search routes
const expensiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
})

// API endpoint for AI
app.get('/api/ai/:topic', expensiveLimiter, requireApiSecret, async (req, res) => {
  const topic = sanitizeTopic(req.params.topic)
  if (!topic) {
    res.status(400).json({ error: 'Invalid topic: must be 1–100 characters after sanitization' })
    return
  }

  try {
    const contestants = await getContestants(topic)
    res.json(contestants)
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      res.status(err.status).json({ error: err.message })
      return
    }
    console.error('AI request failed:', err)
    res.status(502).json({ error: 'AI request failed' })
  }
})

// API endpoint to check if a bracket code is unique
app.get('/api/unique/:code', (req, res) => {
  const { code } = req.params
  const isUnique = isCodeUnique(code)
  res.json({ unique: isUnique })
})

// API endpoint to get all public brackets
app.get('/api/public', (_req, res) => {
  const publicBrackets = getPublicBrackets()
  res.json(publicBrackets)
})

// Get image URL from a search query
app.get('/api/image/:topic', expensiveLimiter, requireApiSecret, async (req, res) => {
  const topic = sanitizeTopic(req.params.topic)
  if (!topic) {
    res.status(400).json({ error: 'Invalid topic: must be 1–100 characters after sanitization' })
    return
  }

  const images = await getImageURLs(topic)

  // Return the image URL or empty list if not found
  res.json(images.length ? images : [])
})

const port = config.dev ? 3001 : 3000

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
