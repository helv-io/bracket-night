import { Server, Socket } from 'socket.io'
import { getBracketByCode } from './db'
import { Bracket, Contestant, Matchup, Player, Vote } from './types'
import { config } from './config'
import { rateLimit, getClientKey } from './rateLimit'
import {
  CONTESTANTS_PER_BRACKET,
  FIRST_ROUND_MATCHUPS,
  TOTAL_ROUNDS,
  FINAL_MATCHUP_INDEX,
  GAME_OVER_INDEX,
} from './constants'

export class Game {
  private io: Server
  private games: Map<string, GameState> = new Map()

  constructor(io: Server) {
    this.io = io
    io.on('connection', (socket: Socket) => this.handleConnection(socket))
  }

  private handleConnection(socket: Socket) {
    // Generate a stable player identifier (used for vote tracking across reconnects)
    const generateStablePlayerId = () =>
      'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

    socket.on('create_game', (requestedGameId?: string) => {
      const key = getClientKey(socket)
      if (!rateLimit(key + ':create', 5, 60_000)) {
        socket.emit('error', 'Too many game creations. Please wait a minute.')
        return
      }

      let gameId = requestedGameId

      if (gameId && this.games.has(gameId)) {
        socket.emit('game_created', { gameId })
        socket.join(gameId)
        this.emitGameState(gameId)
        return
      }

      gameId = config.dev ? 'DEV' : Math.random().toString(36).substring(2, 6).toUpperCase()
      this.games.set(gameId, {
        gameId: gameId,
        bracket: null,
        players: [],
        currentMatchupIndex: 0,
        matchups: [],
        currentVotes: [],
        isGameStarted: false,
        isGameOver: false
      })
      socket.emit('game_created', { gameId })
      socket.join(gameId)
      this.emitGameState(gameId)
    })

    socket.on('join', ({ gameId, playerName }) => {
      const key = getClientKey(socket)
      if (!rateLimit(key + ':join', 20, 60_000)) {
        socket.emit('error', 'Too many join attempts. Slow down.')
        return
      }

      const game = this.games.get(gameId)
      if (!game || game.players.length >= config.maxPlayers) {
        socket.emit('error', 'Game is full')
        return
      }

      let player = game.players.find(p => p.name === playerName)
      if (player) {
        // Rejoin: keep the stable player.id, just update the current connection
        player.socketId = socket.id
      } else {
        if (game.isGameStarted) {
          socket.emit('error', 'Game has already started')
          return
        }
        // New player gets a stable id that will be used for all vote tracking
        player = {
          id: generateStablePlayerId(),
          name: playerName,
          socketId: socket.id
        }
        game.players.push(player)
      }

      socket.join(gameId)

      // hasVoted must be computed against the *stable* player id, not the transient socket id
      const hasVoted = game.currentVotes.some(v => v.playerId === player!.id)
      socket.emit('vote_status', { hasVoted })

      this.io.to(gameId).emit('player_joined', { players: game.players })

      // Send full current state so the client can fully rehydrate (critical for rejoin)
      socket.emit('game_state', game)

      // First player becomes (or stays) game master
      if (game.players.length === 1) {
        socket.emit('game_master')
      } else if (game.bracket) {
        socket.emit('bracket_set', {
          bracket: game.bracket,
          matchups: game.matchups,
          currentMatchupIndex: game.currentMatchupIndex
        })
      }
      this.emitGameState(gameId)
    })

    socket.on('set_bracket', ({ gameId, code }) => {
      const game = this.games.get(gameId)
      // Prevent setting bracket if the game has already started or if the bracket has already been set
      if (!game || game.bracket) return
      
      // Find the bracket by code and set it
      const bracket = getBracketByCode(code)
      if (!bracket) {
        socket.emit('error', 'Invalid bracket code')
        return
      }
      game.bracket = bracket
      game.matchups = this.createMatchups(bracket.contestants)
      this.io.to(gameId).emit('bracket_set', {
        bracket: game.bracket,
        matchups: game.matchups,
        currentMatchupIndex: game.currentMatchupIndex
      })
      this.emitGameState(gameId) // Emit game state
    })

    // Handle vote event
    socket.on('vote', ({ gameId, choice }) => {
      const key = getClientKey(socket)
      if (!rateLimit(key + ':vote', 10, 30_000)) {
        return // silently drop spam votes
      }

      const game = this.games.get(gameId)
      if (!game || !game.bracket || game.currentMatchupIndex >= game.matchups.length) return

      const player = game.players.find(p => p.socketId === socket.id)
      if (!player) return

      if (game.currentVotes.find(v => v.playerId === player.id)) return

      game.currentVotes.push({ playerId: player.id, choice })

      this.io.to(gameId).emit('vote_cast', {
        currentVotes: game.currentVotes,
        players: game.players
      })
      this.emitGameState(gameId)

      if (game.currentVotes.length === game.players.length) {
        this.advanceMatchup(gameId)
      }
    })

    socket.on('start_game', ({ gameId }) => {
      const game = this.games.get(gameId)
      if (!game) return
      game.isGameStarted = true
      this.emitGameState(gameId)
    })

    // Handle disconnects gracefully for rejoin stability
    socket.on('disconnect', () => {
      // We keep players in the list (they may rejoin by name).
      // Just clear the transient socketId so we don't accidentally think an old connection is still active.
      for (const game of this.games.values()) {
        const p = game.players.find(p => p.socketId === socket.id)
        if (p) {
          p.socketId = undefined
        }
      }
    })
  }

  private emitGameState(gameId: string) {
    const game = this.games.get(gameId)
    game && this.io.to(gameId).emit('game_state', game)
  }

  private createMatchups(contestants: Contestant[]): Matchup[] {
    const shuffledContestants = contestants.sort(() => Math.random() - 0.5)
    const matchups: Matchup[] = []
    // First round
    for (let i = 0; i < FIRST_ROUND_MATCHUPS; i++) {
      matchups.push({
        id: i,
        left: shuffledContestants[i * 2],
        right: shuffledContestants[i * 2 + 1],
        winner: null
      })
    }
    // Subsequent rounds: quarter-finals, semi-finals, final
    for (let round = 1; round < TOTAL_ROUNDS; round++) {
      for (let i = 0; i < FIRST_ROUND_MATCHUPS / Math.pow(2, round); i++) {
        matchups.push({
          id: matchups.length,
          left: null,
          right: null,
          winner: null
        })
      }
    }
    return matchups
  }

  private advanceMatchup(gameId: string) {
    const game = this.games.get(gameId)
    if (!game) return
    const currentMatchup = game.matchups[game.currentMatchupIndex]
    const leftVotes = game.currentVotes.filter(v => v.choice === 0).length
    const rightVotes = game.currentVotes.filter(v => v.choice === 1).length
    
    // Randomly select a winner if there's a tie
    const winner = leftVotes > rightVotes
      ? currentMatchup.left
      : rightVotes > leftVotes
        ? currentMatchup.right
        : Math.random() < 0.5
          ? currentMatchup.left
          : currentMatchup.right
    currentMatchup.winner = winner

    // Update next matchup if not final round
    if (game.currentMatchupIndex < FINAL_MATCHUP_INDEX) {
      const nextMatchupIndex = FIRST_ROUND_MATCHUPS + Math.floor(game.currentMatchupIndex / 2)
      const nextMatchup = game.matchups[nextMatchupIndex]
      if (game.currentMatchupIndex % 2 === 0) {
        nextMatchup.left = winner
      } else {
        nextMatchup.right = winner
      }
    }

    game.currentVotes = []
    game.currentMatchupIndex++
    this.io.to(gameId).emit('matchup_advanced', {
      matchups: game.matchups,
      currentMatchupIndex: game.currentMatchupIndex
    })
  }
}

interface GameState {
  gameId: string
  bracket: Bracket | null
  players: Player[]
  currentMatchupIndex: number
  matchups: Matchup[]
  currentVotes: Vote[]
  isGameStarted: boolean
  isGameOver: boolean
}