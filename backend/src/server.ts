import fs from 'fs'
import { config } from './config'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import path from 'path'
import { Game } from './game'
import { getImageURL } from './image'
import { Bracket } from 'types'

// Create the db and data directories if they don't exist
if (!fs.existsSync(config.dbFolder))
  fs.mkdirSync(config.dbFolder, { recursive: true })
if (!fs.existsSync(`${config.dataPath}/images`))
  fs.mkdirSync(`${config.dataPath}/images`, { recursive: true })

import { createBracket, isCodeUnique, getPublicBrackets } from './db'

const app = express()
const server = http.createServer(app)
const io = new Server(server,
  {
    cors: {
      origin: config.dev ? '*' : '',
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
app.use('/data', express.static(config.dataPath))

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
app.get('/api/image/:topic', async (req, res) => {
  
  // Get image URL
  const images = await getImageURL(req.params.topic)
  
  // Return the image URL or 404 if not found
  if(images.length) {
    res.json(images)
  } else {
    res.json([ ])
  }
})

const port = config.dev ? 3001 : 3000

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
})