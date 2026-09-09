import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Bracket, Matchup, Player, Vote } from '../../../backend/src/types'
import { HostPhase, TallyView, TossView } from '../../lib/nightView'
import NightScene from './NightScene'

export type HostNightProps = {
  phase: HostPhase
  gameId: string | null
  joinUrl: string
  bracket: Bracket | null
  matchups: Matchup[]
  currentMatchupIndex: number
  players: Player[]
  currentVotes: Vote[]
  tally: TallyView | null
  toss: TossView | null
  onTossComplete: () => void
}

export default function HostNight(props: HostNightProps) {
  const qrWrap = useRef<HTMLDivElement>(null)
  const [qrCanvas, setQrCanvas] = useState<HTMLCanvasElement | null>(null)
  const [webgl, setWebgl] = useState(true)

  useEffect(() => {
    try {
      const probe = document.createElement('canvas')
      const gl = probe.getContext('webgl2') || probe.getContext('webgl')
      if (!gl) setWebgl(false)
    } catch {
      setWebgl(false)
    }
  }, [])

  useEffect(() => {
    const canvas = qrWrap.current?.querySelector('canvas') || null
    setQrCanvas(canvas)
  }, [props.joinUrl])

  if (!webgl) {
    return (
      <div className="host-webgl-fallback">
        <p>Bracket Night&apos;s host TV needs WebGL.</p>
        <p>Join on your phone at {props.joinUrl || 'the QR on a working display'}.</p>
      </div>
    )
  }

  return (
    <div className="bn-host3d">
      <div ref={qrWrap} className="host-qr-offscreen" aria-hidden>
        {props.joinUrl && (
          <QRCodeCanvas
            value={props.joinUrl}
            size={512}
            includeMargin
            bgColor="#ffffff"
            fgColor="#0b1020"
          />
        )}
      </div>
      <Canvas
        camera={{ position: [0, 2.8, 9.4], fov: 40, near: 0.1, far: 60 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: false }}
        shadows
      >
        <Suspense fallback={null}>
          <NightScene {...props} qrCanvas={qrCanvas} />
        </Suspense>
      </Canvas>
    </div>
  )
}
