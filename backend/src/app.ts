import fs from 'fs'
import path from 'path'
import http from 'http'
import express from 'express'
import { Server } from 'socket.io'
import rateLimit from 'express-rate-limit'
import { NightRegistry } from '../../engine/src'
import { config } from './config'
import { createBracket, isCodeUnique, getPublicBrackets } from './db'
import { getImageURLs } from './image'
import { Bracket } from './types'
import { AiUnavailableError, getContestants } from './ai'
import { getCorsOrigins, requireApiSecret, sanitizeTopic } from './security'
import { attachRealtime } from './realtime'

export interface NightApp {
  app: express.Express
  server: http.Server
  io: Server
  registry: NightRegistry
}

const ensureFolders = () => {
  if (!fs.existsSync(config.dbFolder)) {
    fs.mkdirSync(config.dbFolder, { recursive: true })
  }
  if (!fs.existsSync(`${config.dataPath}/images`)) {
    fs.mkdirSync(`${config.dataPath}/images`, { recursive: true })
  }
}

export const createNightApp = (opts: { registry?: NightRegistry } = {}): NightApp => {
  ensureFolders()

  const app = express()
  const server = http.createServer(app)
  const corsOrigin = getCorsOrigins()
  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  const registry = opts.registry || new NightRegistry({
    dev: config.useDevJoinCode,
    maxPlayers: config.maxPlayers,
  })

  attachRealtime(io, registry)

  const staticCandidates = [
    path.join(__dirname, '../frontend/dist'),
    path.join(__dirname, '../../frontend/dist'),
    path.join(__dirname, '../frontend/out'),
    path.join(__dirname, '../../frontend/out'),
  ]
  const staticRoot = staticCandidates.find(dir => fs.existsSync(dir)) || staticCandidates[0]

  app.use(express.static(staticRoot, { extensions: ['html'] }))
  app.use('/data', express.static(config.dataPath, { maxAge: '1d' }))
  app.use(express.json())

  app.post('/api/create-bracket', async (req, res) => {
    const bracket: Bracket = req.body
    const count = bracket?.contestants?.length || 0
    if (!bracket.title || !bracket.subtitle || count < 2 || count > 16) {
      res.status(400).json({ error: 'Invalid input: title, subtitle, and 2-16 contestants required' })
      return
    }
    const code = await createBracket(
      bracket.title,
      bracket.subtitle,
      bracket.contestants,
      bracket.isPublic,
      bracket.code
    )
    res.json({ code })
  })

  const expensiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  })

  app.get('/api/ai/:topic', expensiveLimiter, requireApiSecret, async (req, res) => {
    const topic = sanitizeTopic(req.params.topic)
    if (!topic) {
      res.status(400).json({ error: 'Invalid topic: must be 1-100 characters after sanitization' })
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

  app.get('/api/unique/:code', (req, res) => {
    const { code } = req.params
    const isUnique = isCodeUnique(code)
    res.json({ unique: isUnique })
  })

  app.get('/api/public', (_req, res) => {
    res.json(getPublicBrackets())
  })

  app.get('/api/image/:topic', expensiveLimiter, requireApiSecret, async (req, res) => {
    const topic = sanitizeTopic(req.params.topic)
    if (!topic) {
      res.status(400).json({ error: 'Invalid topic: must be 1-100 characters after sanitization' })
      return
    }
    const images = await getImageURLs(topic)
    res.json(images.length ? images : [])
  })

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      version: process.env.npm_package_version || '0.2.0',
      rooms: registry.size(),
      persist: 'memory',
    })
  })

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/data') || req.path.startsWith('/socket.io')) {
      next()
      return
    }
    const index = path.join(staticRoot, 'index.html')
    if (fs.existsSync(index)) {
      res.sendFile(index)
      return
    }
    res.status(404).send('Frontend not built')
  })

  return { app, server, io, registry }
}
