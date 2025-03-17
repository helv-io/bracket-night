/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { isMobile } from 'react-device-detect'
import { QRCodeSVG } from 'qrcode.react'
import Confetti from 'react-confetti'
import { socket } from '../lib/socket'
import Bracket from '../components/Bracket'
import { Matchup, Player, Bracket as BracketType, Vote } from '../../backend/src/types'

export default function Home() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [bracket, setBracket] = useState<BracketType | null>(null)
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [currentMatchupIndex, setCurrentMatchupIndex] = useState(0)
  const [players, setPlayers] = useState<Player[]>([])
  const [isGameOver, setIsGameOver] = useState(false)
  const [isGameStarted, setIsGameStarted] = useState(false)
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
        setIsGameStarted(true)
      }
      if (currentVotes.length === players.length) {
        socket.emit('advance_matchup', { sessionId })
      }
    })
    socket.on('matchup_advanced', ({ matchups, currentMatchupIndex }) => {
      setMatchups(matchups)
      setCurrentMatchupIndex(currentMatchupIndex)
      setCurrentVotes([])
      if (currentMatchupIndex === 15) setIsGameOver(true)
    })

    return () => {
      socket.off('session_created')
      socket.off('player_joined')
      socket.off('bracket_set')
      socket.off('vote_cast')
      socket.off('matchup_advanced')
    }
  }, [router, sessionId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* Background Music */}
      <audio src="/background.ogg" autoPlay loop />
      
      <div style={{ textAlign: 'center', margin: '20px 0', position: 'absolute', top: '0px' }}>
        <img src="/bracket-night-gold.svg" alt="Bracket Night Gold" style={{ width: '580px', height: 'auto' }} />
      </div>

      {/* Title and Subtitle Section */}
      <div style={{ textAlign: 'center', margin: '20px 0', position: 'absolute', top: '200px' }}>
        {/* Check if bracket exists */}
        {bracket && (
          <>
            <h1>{bracket.title}</h1>
            <h2>{bracket.subtitle}</h2>
          </>
        )}
      </div>

      {/* Bracket Section */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
        {/* Check if matchups exist */}
        {matchups.length > 0 && (
          <Bracket matchups={matchups} currentMatchupIndex={currentMatchupIndex} />
        )}
      </div>

      {/* QR Code and Session Info Section */}
      <div style={{ textAlign: 'center', margin: '20px 0', position: 'absolute', bottom: '20px' }}>
        {/* Check if game is pending start and sessionId exists */}
        {!isGameStarted && sessionId && (
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
                value={`${window.location.origin}/join?session=${sessionId}`}
                imageSettings={{ src: '/bn-logo-gold.svg', height: 24, width: 24, excavate: true }}
                size={150}
              />
            </div>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff69b4' }}>{sessionId}</span>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {/* Check if players length is zero */}
                {players.length === 0 && (
                <div style={{ padding: '5px', border: '1px solid #ccc', borderRadius: '5px', color: 'gray' }}>
                  It is empty around here
                </div>
                )}
              {players.map(player => (
                <div key={player.id} style={{ padding: '5px', border: '1px solid #ccc', borderRadius: '5px' }}>
                  {player.name}
                </div>
              ))}
            </div>
          </>
        )}
        {/* Check if game has started */}
        {isGameStarted && (
          <div>
            <ul style={{ listStyleType: 'none', paddingLeft: 0, display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
              {/* Map through players and check if they have voted */}
              {players.map(player => {
                const hasVoted = currentVotes.some(vote => vote.playerId === player.id)
                return (
                  <li key={player.id} style={{ textAlign: 'left' }}>
                    {hasVoted ? '✅' : '❎'} {player.name}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
      {/* Show confetti when game is over and a winner is chosen */}
      {isGameOver && <Confetti />}
    </div>
  )
}