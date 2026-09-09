import { randomBytes } from 'crypto'
import { Server, Socket } from 'socket.io'
import { getBracketByCode } from './db'
import { config } from './config'
import { GameState, MatchupAdvance } from './types'
import {
  applyBracket,
  castVote,
  createEmptyGame,
  disconnectBySocket,
  findGameForSocket,
  joinGame,
  playerBySocket,
  startGame,
} from './engine'
import { SHOWCASE_CODE, getShowcaseBracket } from './showcase'

/** 8-char hex join codes (QR/URL accept any length; avoids short guessable IDs). */
const generateGameId = () => randomBytes(4).toString('hex').toUpperCase()

export class Game {
  private io: Server
  // Live rooms are in-process only; process restarts wipe active games.
  private games: Map<string, GameState> = new Map()

  constructor(io: Server) {
    this.io = io
    io.on('connection', (socket: Socket) => this.handleConnection(socket))
  }

  private handleConnection(socket: Socket) {
    socket.on('create_game', () => {
      let gameId = config.dev ? 'DEV' : generateGameId()
      // Extremely unlikely collision; regenerate rather than clobber a live room.
      while (!config.dev && this.games.has(gameId)) {
        gameId = generateGameId()
      }
      this.games.set(gameId, createEmptyGame(gameId))
      socket.emit('game_created', { gameId })
      socket.join(gameId)
      this.emitGameState(gameId)
    })

    socket.on('join', ({ gameId, playerName }) => {
      const game = this.games.get(gameId)
      if (!game) {
        socket.emit('error', 'No room with that code. Check the TV and try again.')
        return
      }
      const result = joinGame(game, String(playerName || ''), socket.id, config.maxPlayers)
      if (!result.ok) {
        socket.emit('error', result.error)
        return
      }
      socket.join(gameId)
      socket.emit('joined', {
        playerId: result.player.id,
        playerName: result.player.name,
        isReconnect: result.isReconnect,
      })
      socket.emit('vote_status', { hasVoted: result.hasVoted, playerId: result.player.id })
      this.io.to(gameId).emit('player_joined', { players: game.players })
      socket.emit('game_state', game)
      if (result.isGameMaster) {
        socket.emit('game_master')
      } else if (game.bracket) {
        socket.emit('bracket_set', {
          bracket: game.bracket,
          matchups: game.matchups,
          currentMatchupIndex: game.currentMatchupIndex,
        })
      }
      this.emitGameState(gameId)
    })

    socket.on('set_bracket', ({ gameId, code }) => {
      const game = this.games.get(gameId)
      if (!game) {
        socket.emit('error', 'No room with that code. Check the TV and try again.')
        return
      }
      const normalized = String(code || '').trim().toLowerCase()
      const bracket = normalized === SHOWCASE_CODE
        ? getShowcaseBracket()
        : getBracketByCode(normalized)
      if (!bracket) {
        socket.emit('error', 'Invalid bracket code')
        return
      }
      const result = applyBracket(game, bracket)
      if (!result.ok) {
        socket.emit('error', result.error)
        return
      }
      this.io.to(gameId).emit('bracket_set', {
        bracket: game.bracket,
        matchups: game.matchups,
        currentMatchupIndex: game.currentMatchupIndex,
      })
      this.emitGameState(gameId)
    })

    socket.on('vote', ({ gameId, choice }) => {
      const game = this.games.get(gameId)
      if (!game) return
      const player = playerBySocket(game, socket.id)
      if (!player) return
      const result = castVote(game, player.id, Number(choice))
      if (!result.ok) return

      this.io.to(gameId).emit('vote_cast', {
        currentVotes: game.currentVotes,
        players: game.players,
      })
      this.emitGameState(gameId)

      if (result.allIn) {
        this.emitAdvances(gameId, result.advances)
      }
    })

    socket.on('start_game', ({ gameId }) => {
      const game = this.games.get(gameId)
      if (!game) return
      const result = startGame(game)
      if (!result.ok) {
        socket.emit('error', result.error)
        return
      }
      this.emitGameState(gameId)
      if (result.advances.length > 0) {
        this.emitAdvances(gameId, result.advances)
      }
    })

    socket.on('disconnect', () => {
      const game = findGameForSocket(this.games, socket.id)
      if (!game) return
      disconnectBySocket(game, socket.id)
      this.io.to(game.gameId).emit('players_update', game.players)
      this.emitGameState(game.gameId)
    })
  }

  private emitAdvances(gameId: string, advances: MatchupAdvance[]) {
    const game = this.games.get(gameId)
    if (!game) return
    for (const advance of advances) {
      this.io.to(gameId).emit('matchup_advanced', {
        matchups: advance.matchups,
        currentMatchupIndex: advance.currentMatchupIndex,
        wasTie: advance.wasTie,
        bye: advance.bye,
        tallies: advance.tallies,
      })
    }
    this.emitGameState(gameId)
  }

  private emitGameState(gameId: string) {
    const game = this.games.get(gameId)
    game && this.io.to(gameId).emit('game_state', game)
  }
}
