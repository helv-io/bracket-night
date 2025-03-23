import React, { useState } from 'react'
import '../styles/cointoss.css'

interface CoinTossProps {
  headsImage: string
  tailsImage: string
}

export default function CoinToss({ headsImage, tailsImage }: CoinTossProps) {
  const [isTossing, setIsTossing] = useState<boolean>(false)
  const [winner, setWinner] = useState<'heads' | 'tails' | null>(null)
  const [tossKey, setTossKey] = useState<number>(0)

  const startToss = () => {
    const randomWinner = Math.random() < 0.5 ? 'heads' : 'tails'
    setWinner(randomWinner)
    setTossKey((prev) => prev + 1)
    setIsTossing(true)
  }

  const handleAnimationEnd = () => {
    
  }

  return (
    <div>
      <button
        onClick={startToss}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
      >
        Toss Coin
      </button>

      {isTossing && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setIsTossing(false)}
        >
          <div
            key={tossKey}
            className={`coin-container ${
              winner === 'heads' ? 'animate-spinToHeads' : 'animate-spinToTails'
            }`}
            onClick={(e) => e.stopPropagation()}
            onAnimationEnd={handleAnimationEnd}
          >
            <div
              className="coin-side heads"
              style={{ backgroundImage: `url(${headsImage})` }}
            ></div>
            <div
              className="coin-side tails"
              style={{ backgroundImage: `url(${tailsImage})` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  )
}