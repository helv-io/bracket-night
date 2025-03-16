import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import path from 'path'
import { Game } from './game'
import { createBracket } from './db'
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

// TODO: Make the file path consistent between dev and prod
const fePath = config.dev ? '../../frontend/out' : '../frontend/out'

// Serve frontend static html files.
app.use(express.static(path.join(__dirname, fePath), { extensions: ['html'] }))

// API endpoint to create a new bracket
app.use(express.json())
app.post('/api/create-bracket', (req, res) => {
  const { title, subtitle, contestants }:
    { title: string, subtitle: string, contestants: { name: string, image_url: string }[] } = req.body
  if (!title || !subtitle || !contestants || contestants.length !== 16) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }
  const code = createBracket(title, subtitle, contestants)
  res.json({ code })
})

const port = config.dev ? 3001 : 3000

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
})