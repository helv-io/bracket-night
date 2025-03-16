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
        width: '150px',
      }}
    >
      <div>{matchup.left?.name || 'TBD'}</div>
      <div>vs</div>
      <div>{matchup.right?.name || 'TBD'}</div>
      {matchup.winner && (
        <div style={{ color: 'var(--winner-highlight)' }}>
          Winner: {matchup.winner.name}
        </div>
      )}
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
    <div style={{ position: 'relative', height: '880px', width: '100%' }}>
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