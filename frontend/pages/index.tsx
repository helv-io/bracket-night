import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { isMobile } from 'react-device-detect'
import { QRCodeSVG } from 'qrcode.react'
import Confetti from 'react-confetti'
import { socket } from '../lib/socket'
import Bracket from '../components/Bracket'
import { Matchup, Player, Bracket as BracketType, Vote } from '../../backend/src/types'
import { config } from '../../backend/src/config'

export default function Home() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [bracket, setBracket] = useState<BracketType | null>(null)
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [currentMatchupIndex, setCurrentMatchupIndex] = useState(0)
  const [players, setPlayers] = useState<Player[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [hasVotingStarted, setHasVotingStarted] = useState(false)
  const [currentVotes, setCurrentVotes] = useState<Vote[]>([])

  useEffect(() => {
    if (isMobile) {
      router.push('/new')
      return
    }

    socket.emit('create_session')
    socket.on('session_created', ({ sessionId }) => setSessionId(sessionId))
    socket.on('player_joined', ({ players }) => setPlayers(players))
    socket.on('bracket_set', ({ bracket, matchups, currentMatchupIndex }) => {
      setBracket(bracket)
      setMatchups(matchups)
      setCurrentMatchupIndex(currentMatchupIndex)
    })
    socket.on('vote_cast', ({ currentVotes, players }) => {
      setCurrentVotes(currentVotes)
      setPlayers(players)
      if (currentVotes.length > 0) {
        setHasVotingStarted(true)
      }
    })
    socket.on('matchup_advanced', ({ matchups, currentMatchupIndex }) => {
      setMatchups(matchups)
      setCurrentMatchupIndex(currentMatchupIndex)
      setCurrentVotes([])
      if (currentMatchupIndex === 15) setShowConfetti(true)
    })

    return () => {
      socket.off('session_created')
      socket.off('player_joined')
      socket.off('bracket_set')
      socket.off('vote_cast')
      socket.off('matchup_advanced')
    }
  }, [router])

  return (
    <div>
      {/* Title and Subtitle Section */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {bracket && (
          <>
            <h1>{bracket.title}</h1>
            <h2>{bracket.subtitle}</h2>
          </>
        )}
      </div>

      {/* Bracket Section */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {matchups.length > 0 && (
          <Bracket matchups={matchups} currentMatchupIndex={currentMatchupIndex} />
        )}
      </div>

      {/* QR Code and Session Info Section */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {!hasVotingStarted && sessionId && (
          <>
            <div
              style={{
                border: '2px dashed #ff69b4',
                padding: '10px',
                backgroundColor: 'white',
                borderRadius: '10px',
              }}
            >
              <QRCodeSVG
                value={`${config.publicHost}/join?session=${sessionId}`}
                size={150}
              />
            </div>
            <p>Scan to join: {sessionId}</p>
            <p>Players: {players.length}/10</p>
          </>
        )}
        {hasVotingStarted && (
          <div>
            <h3>Players:</h3>
            <ul>
              {players.map(player => {
                const hasVoted = currentVotes.some(vote => vote.playerId === player.id)
                return (
                  <li key={player.id}>
                    {hasVoted ? '✔️' : '❌'} {player.name}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Confetti */}
      {showConfetti && <Confetti />}
    </div>
  )
}