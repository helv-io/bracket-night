import { Server, Socket } from 'socket.io'
import { getBracketByCode } from './db'
import { Bracket, Contestant, Matchup, Player, Vote } from './types'
import { config } from './config'

export class Game {
  private io: Server
  private sessions: Map<string, GameState> = new Map()

  constructor(io: Server) {
    this.io = io
    io.on('connection', (socket: Socket) => this.handleConnection(socket))
  }

  private handleConnection(socket: Socket) {
    socket.on('create_session', () => {
      const sessionId = Math.random().toString(36).substring(2, 6).toUpperCase()
      this.sessions.set(sessionId, {
        sessionId,
        bracket: null,
        players: [],
        currentMatchupIndex: 0,
        matchups: [],
        currentVotes: [],
        isGameStarted: false
      })
      socket.emit('session_created', { sessionId })
      socket.join(sessionId)
    })

    socket.on('join', ({ sessionId, playerName }) => {
      const session = this.sessions.get(sessionId)
      if (!session || session.players.length >= config.maxPlayers) {
        socket.emit('error', 'Game is full')
        return
      }
      let player = session.players.find(p => p.name === playerName)
      if (player) {
        player.id = socket.id // Update player ID to the new socket ID
      } else {
        if (session.isGameStarted) {
          socket.emit('error', 'Game has already started')
          return
        }
        player = { id: socket.id, name: playerName }
        session.players.push(player)
      }
      socket.join(sessionId) // Explicitly join the room (good practice)
      const hasVoted = session.currentVotes.some(v => v.playerId === socket.id)
      socket.emit('vote_status', { hasVoted })
      this.io.to(sessionId).emit('player_joined', { players: session.players })
      if (session.players.length === 1) {
        socket.emit('enter_bracket_code')
      } else if (session.bracket) {
        // Send the current game state to the newly joined player
        socket.emit('bracket_set', {
          bracket: session.bracket,
          matchups: session.matchups,
          currentMatchupIndex: session.currentMatchupIndex
        })
      }
    })

    socket.on('set_bracket', ({ sessionId, code }) => {
      const session = this.sessions.get(sessionId)
      // Prevent setting bracket if the game has already started or if the bracket has already been set
      if (!session || session.bracket) return
      
      // Find the bracket by code and set it
      const bracket = getBracketByCode(code)
      if (!bracket) {
        socket.emit('error', 'Invalid bracket code')
        return
      }
      console.log(bracket)
      session.bracket = bracket
      session.matchups = this.createMatchups(bracket.contestants)
      this.io.to(sessionId).emit('bracket_set', {
        bracket: session.bracket,
        matchups: session.matchups,
        currentMatchupIndex: session.currentMatchupIndex
      })
    })

    socket.on('vote', ({ sessionId, choice }) => {
      const session = this.sessions.get(sessionId)
      if (!session || !session.bracket || session.currentMatchupIndex >= session.matchups.length) return
      if (session.currentVotes.find(v => v.playerId === socket.id)) return
      session.currentVotes.push({ playerId: socket.id, choice })
      session.isGameStarted = true
      this.io.to(sessionId).emit('vote_cast', {
        currentVotes: session.currentVotes,
        players: session.players
      })
      if (session.currentVotes.length === session.players.length) {
        this.advanceMatchup(sessionId)
      }
    })

    socket.on('start_game', ({ sessionId }) => {
      const session = this.sessions.get(sessionId)
      if (!session || session.gameStarted) return
      session.gameStarted = true
      this.io.to(sessionId).emit('game_started')
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

  private advanceMatchup(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    const currentMatchup = session.matchups[session.currentMatchupIndex]
    const leftVotes = session.currentVotes.filter(v => v.choice === 0).length
    const rightVotes = session.currentVotes.filter(v => v.choice === 1).length
    
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
    if (session.currentMatchupIndex < 14) {
      const nextMatchupIndex = 8 + Math.floor(session.currentMatchupIndex / 2)
      const nextMatchup = session.matchups[nextMatchupIndex]
      if (session.currentMatchupIndex % 2 === 0) {
        nextMatchup.left = winner
      } else {
        nextMatchup.right = winner
      }
    }

    session.currentVotes = []
    session.currentMatchupIndex++
    this.io.to(sessionId).emit('matchup_advanced', {
      matchups: session.matchups,
      currentMatchupIndex: session.currentMatchupIndex
    })
  }
}

interface GameState {
  sessionId: string
  bracket: Bracket | null
  players: Player[]
  currentMatchupIndex: number
  matchups: Matchup[]
  currentVotes: Vote[]
  isGameStarted: boolean
  gameStarted?: boolean
}