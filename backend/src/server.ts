import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import path from 'path'
import { Game } from './game'
import { createBracket, isBracketCodeUnique, getPublicBrackets } from './db'
import { config } from './config'

const app = express()
const server = http.createServer(app)
const io = new Server(server,
  {
    cors: {
      origin: config.dev ? '*' : config.publicURL,
      methods: ['GET', 'POST'],
      credentials: true
    }
  }
)

// Initialize game logic
new Game(io)

// Serve frontend static html files.
app.use(express.static(path.join(__dirname, '../frontend/out'), { extensions: ['html'] }))

// API endpoint to create a new bracket
app.use(express.json())
app.post('/api/create-bracket', (req, res) => {
  const { title, subtitle, contestants, bracketCode, isPublic }:
    { title: string, subtitle: string, contestants: { name: string, image_url: string }[], bracketCode?: string, isPublic: boolean } = req.body
  if (!title || !subtitle || !contestants || contestants.length !== 16 || isPublic === undefined) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  const code = createBracket(title, subtitle, contestants, isPublic, bracketCode)
  res.json({ code })
})

// API endpoint to check if a bracket code is unique
app.get('/api/unique/:code', (req, res) => {
  const { code } = req.params
  const isUnique = isBracketCodeUnique(code)
  res.json({ unique: isUnique })
})

// API endpoint to get all public brackets
app.get('/api/public', (req, res) => {
  const publicBrackets = getPublicBrackets()
  res.json(publicBrackets)
})

const port = config.dev ? 3001 : 3000

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
})