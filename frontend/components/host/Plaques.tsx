import { Text } from '@react-three/drei'
import { Contestant } from '../../../backend/src/types'
import { useContestantTexture } from './textures'

export function Plaque({
  contestant,
  position,
  hot,
  scale = 1,
}: {
  contestant: Contestant | null
  position: [number, number, number]
  hot?: boolean
  scale?: number
}) {
  const texture = useContestantTexture(contestant)
  const name = contestant?.name || 'TBD'

  return (
    <group position={position} scale={scale}>
      <mesh castShadow>
        <boxGeometry args={[2.25, 2.95, 0.16]} />
        <meshStandardMaterial
          color={hot ? '#2a1f0c' : '#151c33'}
          metalness={0.45}
          roughness={0.42}
          emissive={hot ? '#e8c46a' : '#0b1020'}
          emissiveIntensity={hot ? 0.18 : 0.04}
        />
      </mesh>
      <mesh position={[0, 0.22, 0.09]}>
        <planeGeometry args={[1.95, 1.95]} />
        <meshStandardMaterial
          map={texture}
          color={texture ? '#ffffff' : '#1a2240'}
          roughness={0.55}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0, 0, 0.085]}>
        <ringGeometry args={[1.02, 1.08, 40]} />
        <meshStandardMaterial
          color="#e8c46a"
          metalness={0.85}
          roughness={0.25}
          emissive="#e8c46a"
          emissiveIntensity={hot ? 0.45 : 0.15}
        />
      </mesh>
      <Text
        position={[0, -1.22, 0.1]}
        fontSize={0.2}
        color="#ffe9a8"
        anchorX="center"
        anchorY="middle"
        maxWidth={2}
      >
        {name}
      </Text>
    </group>
  )
}

export function VoteBar({
  position,
  fill,
  color,
}: {
  position: [number, number, number]
  fill: number
  color: string
}) {
  const width = 2.2
  const clamped = Math.max(0, Math.min(1, fill))
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[width, 0.12, 0.08]} />
        <meshStandardMaterial color="#10162a" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[-(width * (1 - clamped)) / 2, 0, 0.02]} scale={[clamped || 0.001, 1, 1]}>
        <boxGeometry args={[width, 0.1, 0.1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>
    </group>
  )
}

export function PlayerChip({
  name,
  voted,
  connected,
  position,
}: {
  name: string
  voted: boolean
  connected: boolean
  position: [number, number, number]
}) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.22, 0.22, 0.08, 24]} />
        <meshStandardMaterial
          color={voted ? '#5dffa8' : connected ? '#e8c46a' : '#4a5168'}
          emissive={voted ? '#5dffa8' : connected ? '#e8c46a' : '#111'}
          emissiveIntensity={voted ? 0.4 : connected ? 0.18 : 0.02}
          metalness={0.55}
          roughness={0.35}
        />
      </mesh>
      <Text position={[0, 0.28, 0]} fontSize={0.12} color="#f2efe6" anchorX="center" maxWidth={1.4}>
        {name}
      </Text>
    </group>
  )
}
