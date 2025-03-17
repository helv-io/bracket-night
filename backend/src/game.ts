import { Server, Socket } from 'socket.io'
import { getBracketByCode } from './db'
import { Bracket, Contestant, Matchup, Player, Vote } from './types'
import { config } from './config'

export class Game {
  private io: Server
  private games: Map<string, GameState> = new Map()

  constructor(io: Server) {
    this.io = io
    io.on('connection', (socket: Socket) => this.handleConnection(socket))
  }

  private handleConnection(socket: Socket) {
    socket.on('create_game', () => {
      const gameId = Math.random().toString(36).substring(2, 6).toUpperCase()
      this.games.set(gameId, {
        gameId: gameId,
        bracket: null,
        players: [],
        currentMatchupIndex: 0,
        matchups: [],
        currentVotes: [],
        gameStarted: false
      })
      socket.emit('game_created', { gameId })
      socket.join(gameId)
    })

    socket.on('join', ({ gameId, playerName }) => {
      const game = this.games.get(gameId)
      if (!game || game.players.length >= config.maxPlayers) {
        socket.emit('error', 'Game is full')
        return
      }
      let player = game.players.find(p => p.name === playerName)
      if (player) {
        player.id = socket.id // Update player ID to the new socket ID
      } else {
        if (game.gameStarted) {
          socket.emit('error', 'Game has already started')
          return
        }
        player = { id: socket.id, name: playerName }
        game.players.push(player)
      }
      socket.join(gameId) // Explicitly join the room (good practice)
      const hasVoted = game.currentVotes.some(v => v.playerId === socket.id)
      socket.emit('vote_status', { hasVoted })
      this.io.to(gameId).emit('player_joined', { players: game.players })
      if (game.players.length === 1) {
        socket.emit('enter_bracket_code')
      } else if (game.bracket) {
        // Send the current game state to the newly joined player
        socket.emit('bracket_set', {
          bracket: game.bracket,
          matchups: game.matchups,
          currentMatchupIndex: game.currentMatchupIndex
        })
      }
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
    })

    // Handle vote event
    socket.on('vote', ({ gameId, choice }) => {
      // Retrieve the game game
      const game = this.games.get(gameId)
      
      // Check if game exists, bracket is set, and current matchup is valid
      if (!game || !game.bracket || game.currentMatchupIndex >= game.matchups.length) return
      
      // Prevent duplicate votes from the same player
      if (game.currentVotes.find(v => v.playerId === socket.id)) return
      
      // Record the vote
      game.currentVotes.push({ playerId: socket.id, choice })
      
      // Notify all clients in the game about the vote
      this.io.to(gameId).emit('vote_cast', {
        currentVotes: game.currentVotes,
        players: game.players
      })
      
      // If all players have voted, advance to the next matchup
      if (game.currentVotes.length === game.players.length) {
        this.advanceMatchup(gameId)
      }
    })

    socket.on('start_game', ({ gameId }) => {
      const game = this.games.get(gameId)
      if (!game || game.gameStarted) return
      game.gameStarted = true
      this.io.to(gameId).emit('game_started')
    })
  }

  private createMatchups(contestants: Contestant[]): Matchup[] {
    const shuffledContestants = contestants.sort(() => Math.random() - 0.5)
    const matchups: Matchup[] = []
    // First round: 8 matchups with 16 contestants
    for (let i = 0; i < 8; i++) {
      matchups.push({
        id: i,
        left: shuffledContestants[i * 2],
        right: shuffledContestants[i * 2 + 1],
        winner: null
      })
    }
    // Subsequent rounds: quarter-finals, semi-finals, final
    for (let round = 1; round < 4; round++) {
      for (let i = 0; i < 8 / Math.pow(2, round); i++) {
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
    if (game.currentMatchupIndex < 14) {
      const nextMatchupIndex = 8 + Math.floor(game.currentMatchupIndex / 2)
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
  gameStarted?: boolean
}