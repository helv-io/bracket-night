import React, { useState } from 'react'
import { Contestant } from '../../backend/src/types'

interface CoinTossProps {
  contestants: Contestant[]
  leftOrRight: 0 | 1
}

export default function CoinToss({ contestants, leftOrRight }: CoinTossProps) {
  const [isTossing, setIsTossing] = useState<boolean>(false)
  const [winner, setWinner] = useState<0 | 1>(0)
  const [tossKey, setTossKey] = useState<number>(0)
  const [showResult, setShowResult] = useState<boolean>(false)

  const startToss = () => {
    setShowResult(false)
    setWinner(leftOrRight)
    setTossKey((prev) => prev + 1)
    setIsTossing(true)
  }

  const handleAnimationEnd = async () => {
    // Show result after animation
    setShowResult(true)
    
    // Wait 3s
    await new Promise((resolve) => setTimeout(resolve, 3000))
    
    // Reset
    setIsTossing(false)
  }

  return (
    <div>
      <button
        onClick={startToss}
        className="px-4 py-2 bg-[var(--accent)] text-[var(--text)] rounded hover:opacity-80 transition"
      >
        Toss Coin
      </button>

      {isTossing && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50" style={{ zIndex: 1000 }}>
          <div
            className="flex flex-col items-center bg-[var(--card-bg)] p-8 rounded-lg shadow-xl"
            // onClick={(e) => e.stopPropagation()}
          >
            <div
              key={tossKey}
              className={`coin-container ${
                winner === 0 ? 'animate-spinToHeads' : 'animate-spinToTails'
              }`}
              onAnimationEnd={handleAnimationEnd}
            >
              <div className="coin-side heads">
                <div
                  className="coin-image"
                  style={{ backgroundImage: `url(${contestants[0].image_url})` }}
                ></div>
              </div>
              <div className="coin-side tails">
                <div
                  className="coin-image"
                  style={{ backgroundImage: `url(${contestants[1].image_url})` }}
                ></div>
              </div>
            </div>
            <p className="mt-4 text-2xl text-[var(--winner-highlight)] font-bold">
              {!showResult ? '🤞 🤞 🤞 🤞 🤞' : `${contestants[leftOrRight].name} wins!`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}