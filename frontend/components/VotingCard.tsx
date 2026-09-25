/* eslint-disable @next/next/no-img-element */
import { Matchup } from '../../backend/src/types'

interface VotingCardProps {
  matchup: Matchup
  hasVoted: boolean
  yourChoice: number | null
  round: string
  lockedCount: number
  playerCount: number
  onVote: (choice: number) => void
}

const VotingCard = ({
  matchup,
  hasVoted,
  yourChoice,
  round,
  lockedCount,
  playerCount,
  onVote,
}: VotingCardProps) => {
  const renderChoice = (side: 0 | 1) => {
    const contestant = side === 0 ? matchup.left : matchup.right
    const isMine = yourChoice === side
    const disabled = hasVoted || !contestant

    return (
      <button
        type="button"
        onClick={() => onVote(side)}
        onMouseDown={(e) => e.currentTarget.blur()}
        disabled={disabled}
        className={[
          'vote-choice',
          disabled ? 'is-disabled' : '',
          hasVoted ? 'has-voted' : '',
          isMine ? 'is-picked' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={contestant ? `Vote for ${contestant.name}` : 'Unavailable'}
        aria-pressed={isMine}
      >
        <div className="vote-choice-frame">
          {contestant?.image_url ? (
            <img src={contestant.image_url} alt={contestant.name} className="vote-choice-img" />
          ) : (
            <div className="vote-choice-fallback">?</div>
          )}
        </div>
        <span className="vote-choice-name">{contestant?.name || 'TBD'}</span>
        <span className="vote-choice-cta">
          {isMine ? 'Your pick' : hasVoted ? 'Locked' : 'Tap to vote'}
        </span>
      </button>
    )
  }

  return (
    <div className="bn-card vote-card">
      <div className="vote-card-header">
        <p className="bn-display vote-eyebrow">{round}</p>
        <h3 className="vote-title">
          <span>{matchup.left?.name || 'TBD'}</span>
          <span className="vote-vs">VS</span>
          <span>{matchup.right?.name || 'TBD'}</span>
        </h3>
        <p className="vote-progress">
          {lockedCount}/{playerCount} locked in
        </p>
      </div>

      <div className="vote-choices">
        {renderChoice(0)}
        {renderChoice(1)}
      </div>

      {hasVoted && (
        <div className="vote-waiting">
          <p>Locked in. The room is still voting.</p>
          <div className="vote-spinner" aria-hidden />
        </div>
      )}
    </div>
  )
}

export default VotingCard
