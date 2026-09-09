import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Contestant } from '../../../backend/src/types'
import { useContestantTexture } from './textures'

const SPIN_S = 3.2
const HOLD_S = 2.8
const SPIN_S_REDUCED = 0.9
const HOLD_S_REDUCED = 1.2

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function GoldCoin({
  contestants,
  winner,
  onComplete,
}: {
  contestants: [Contestant, Contestant]
  winner: 0 | 1
  onComplete: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const started = useRef(0)
  const finished = useRef(false)
  const landedRef = useRef(false)
  const [landed, setLanded] = useState(false)
  const reduced = useMemo(() => prefersReducedMotion(), [])
  const spinS = reduced ? SPIN_S_REDUCED : SPIN_S
  const holdS = reduced ? HOLD_S_REDUCED : HOLD_S
  const faceA = useContestantTexture(contestants[0])
  const faceB = useContestantTexture(contestants[1])
  const winnerName = contestants[winner].name
  const faceAId = contestants[0].id
  const faceBId = contestants[1].id

  useEffect(() => {
    started.current = 0
    finished.current = false
    landedRef.current = false
    setLanded(false)
  }, [faceAId, faceBId, winner])

  useFrame(({ clock }, dt) => {
    if (!group.current) return
    if (!started.current) started.current = clock.elapsedTime
    const t = clock.elapsedTime - started.current
    const spinT = Math.min(1, t / spinS)
    const ease = 1 - Math.pow(1 - spinT, 3)
    const loft = Math.sin(Math.min(1, spinT) * Math.PI) * 2.35
    const spins = reduced ? 2 : 8
    const endX = winner === 0 ? spins * Math.PI * 2 : spins * Math.PI * 2 + Math.PI
    group.current.position.y = 1.35 + loft
    group.current.rotation.x = endX * ease
    group.current.rotation.z = Math.sin(t * 3.1) * 0.12 * (1 - ease)
    group.current.rotation.y += dt * 0.25

    if (!landedRef.current && t >= spinS) {
      landedRef.current = true
      setLanded(true)
    }
    if (!finished.current && t >= spinS + holdS) {
      finished.current = true
      onComplete()
    }
  })

  return (
    <group>
      <pointLight position={[0, 3.4, 1.2]} intensity={8} color="#ffe9a8" />
      <Text position={[0, 3.15, 0]} fontSize={0.28} color="#ffe9a8" anchorX="center">
        {landed ? 'Decided' : 'Tiebreaker'}
      </Text>
      <group ref={group} position={[0, 1.35, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[1.05, 1.05, 0.28, 64]} />
          <meshStandardMaterial
            color="#e8c46a"
            metalness={0.92}
            roughness={0.18}
            emissive="#5a3d10"
            emissiveIntensity={0.2}
          />
        </mesh>
        <mesh position={[0, 0, 0.145]}>
          <circleGeometry args={[0.98, 64]} />
          <meshStandardMaterial map={faceA} color="#fff4d2" metalness={0.2} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0, -0.145]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[0.98, 64]} />
          <meshStandardMaterial map={faceB} color="#fff4d2" metalness={0.2} roughness={0.45} />
        </mesh>
      </group>
      {landed && (
        <Text position={[0, 0.28, 0]} fontSize={0.2} color="#5dffa8" anchorX="center">
          {winnerName} advances
        </Text>
      )}
    </group>
  )
}
