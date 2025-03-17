/* eslint-disable @next/next/no-img-element */
import { Matchup } from '../../backend/src/types'

interface BracketProps {
  matchups: Matchup[]
  currentMatchupIndex: number
}

function MatchupComponent({ matchup, isCurrent }: { matchup: Matchup, isCurrent: boolean }) {
  return (
    <div
      style={{
      background: isCurrent ? 'var(--accent)' : 'var(--card-bg)',
      padding: '10px',
      borderRadius: '5px',
      textAlign: 'center',
      width: '170px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      height: '100px',
      justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      {matchup.left?.image_url ? (
        <img
        src={matchup.left.image_url}
        alt={matchup.left.name}
        style={{
          width: '30px',
          height: '30px',
          marginRight: '10px',
          opacity: matchup.winner?.id === matchup.left?.id ? 1 : 0.5,
        }}
        />
      ) : (
        <div style={{ width: '30px', height: '30px', marginRight: '10px' }}>❓</div>
      )}
      <div style={{ flex: 1, textAlign: 'left', color: matchup.winner?.id === matchup.left?.id ? 'lightgreen' : 'gray', fontWeight: matchup.winner?.id === matchup.left?.id ? 'bold' : 'normal' }}>
        {matchup.left?.name || ''}
      </div>
      </div>
      <div style={{ textAlign: 'center' }}>vs</div>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <div style={{ flex: 1, textAlign: 'right', color: matchup.winner?.id === matchup.right?.id ? 'lightgreen' : 'gray', fontWeight: matchup.winner?.id === matchup.right?.id ? 'bold' : 'normal' }}>
        {matchup.right?.name || ''}
      </div>
      {matchup.right?.image_url ? (
        <img
        src={matchup.right.image_url}
        alt={matchup.right.name}
        style={{
          width: '30px',
          height: '30px',
          marginLeft: '10px',
          opacity: matchup.winner?.id === matchup.right?.id ? 1 : 0.5,
        }}
        />
      ) : (
        <div style={{ width: '30px', height: '30px', marginLeft: '10px' }}>❔</div>
      )}
      </div>
    </div>
  )
}

export default function Bracket({ matchups, currentMatchupIndex }: BracketProps) {
  // Group matchups by round and side
  const round1Left = matchups.slice(0, 4)
  const round1Right = matchups.slice(4, 8)
  const quarterLeft = matchups.slice(8, 10)
  const quarterRight = matchups.slice(10, 12)
  const semiLeft = [matchups[12]]
  const semiRight = [matchups[13]]
  const final = [matchups[14]]

  return (
    <div style={{ position: 'relative', height: '100vh', width: '95%' }}>
      {/* Round 1 Left */}
      <div style={{ position: 'absolute', left: '0%', width: '10%', height: '100%' }}>
        {round1Left.map((matchup, index) => (
          <div
            key={matchup.id}
            style={{
              position: 'absolute',
              top: `${(2 * index + 1) / 8 * 100}%`,
              transform: 'translateY(-50%)',
              width: '100%',
            }}
          >
            <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
          </div>
        ))}
      </div>

      {/* Quarter-Finals Left */}
      <div style={{ position: 'absolute', left: '15%', width: '10%', height: '100%' }}>
        {quarterLeft.map((matchup, index) => (
          <div
            key={matchup.id}
            style={{
              position: 'absolute',
              top: `${(4 * index + 2) / 8 * 100}%`,
              transform: 'translateY(-50%)',
              width: '100%',
            }}
          >
            <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
          </div>
        ))}
      </div>

      {/* Semi-Finals Left */}
      <div style={{ position: 'absolute', left: '30%', width: '10%', height: '100%' }}>
        {semiLeft.map((matchup) => (
          <div
            key={matchup.id}
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '100%',
            }}
          >
            <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
          </div>
        ))}
      </div>

      {/* Final */}
      <div style={{ position: 'absolute', left: '45%', width: '10%', height: '100%' }}>
        {final.map((matchup) => (
          <div
            key={matchup.id}
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '100%',
            }}
          >
            <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
          </div>
        ))}
      </div>

      {/* Semi-Finals Right */}
      <div style={{ position: 'absolute', left: '60%', width: '10%', height: '100%' }}>
        {semiRight.map((matchup) => (
          <div
            key={matchup.id}
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '100%',
            }}
          >
            <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
          </div>
        ))}
      </div>

      {/* Quarter-Finals Right */}
      <div style={{ position: 'absolute', left: '75%', width: '10%', height: '100%' }}>
        {quarterRight.map((matchup, index) => (
          <div
            key={matchup.id}
            style={{
              position: 'absolute',
              top: `${(4 * index + 2) / 8 * 100}%`,
              transform: 'translateY(-50%)',
              width: '100%',
            }}
          >
            <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
          </div>
        ))}
      </div>

      {/* Round 1 Right */}
      <div style={{ position: 'absolute', left: '90%', width: '10%', height: '100%' }}>
        {round1Right.map((matchup, index) => (
          <div
            key={matchup.id}
            style={{
              position: 'absolute',
              top: `${(2 * index + 1) / 8 * 100}%`,
              transform: 'translateY(-50%)',
              width: '100%',
            }}
          >
            <MatchupComponent matchup={matchup} isCurrent={matchup.id === currentMatchupIndex} />
          </div>
        ))}
      </div>
    </div>
  )
}