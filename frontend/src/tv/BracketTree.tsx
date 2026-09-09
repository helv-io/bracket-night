import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, RoundedBox, Text } from '@react-three/drei'
import { Group } from 'three'
import { NightState } from '../lib/types'
import { layoutBracket, roundLabel } from '../../../engine/src/bracketLayout'
import { useNightTexture } from './textures'

const GOLD = '#e8c46a'

export function BracketSet({
  state,
  focus,
}: {
  state: NightState | null
  focus: boolean
}) {
  const matchups = useMemo(() => state?.matchups || [], [state?.matchups])
  const layout = useMemo(() => layoutBracket(matchups), [matchups])
  const group = useRef<Group>(null)
  const ox = -(layout.minX + layout.maxX) / 2
  const oy = -(layout.minY + layout.maxY) / 2
  const currentId = state?.matchups[state.currentMatchupIndex]?.id
  const visible = matchups.length > 0 && Boolean(state?.started)

  useFrame((_, dt) => {
    if (!group.current) return
    const k = 1 - Math.pow(0.1, dt * 60)
    const tx = focus ? 0 : 0
    const ty = focus ? 2.15 : 4.05
    const tz = focus ? 0.2 : -8.6
    const ts = focus ? 1 : 0.34
    group.current.position.x += (tx - group.current.position.x) * k
    group.current.position.y += (ty - group.current.position.y) * k
    group.current.position.z += (tz - group.current.position.z) * k
    const s = group.current.scale.x + (ts - group.current.scale.x) * k
    group.current.scale.setScalar(s)
  })

  if (!visible) return null

  const width = Math.max(8, layout.maxX - layout.minX + 3.4)
  const height = Math.max(6, layout.maxY - layout.minY + 3.2)
  const rounds = Array.from({ length: layout.maxRound + 1 }, (_, r) => r)

  return (
    <group ref={group} position={[0, 4.05, -8.6]} scale={0.34} visible={visible}>
      <mesh position={[0, 0, -0.18]} receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#080d18" metalness={0.35} roughness={0.55} transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, height / 2 - 0.08, -0.16]}>
        <boxGeometry args={[width, 0.06, 0.04]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, -height / 2 + 0.08, -0.16]}>
        <boxGeometry args={[width, 0.06, 0.04]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.8} />
      </mesh>
      <Text position={[0, height / 2 - 0.55, 0.02]} fontSize={0.42} color={GOLD} anchorX="center">
        THE BRACKET
      </Text>
      {rounds.map(r => (
        <Text
          key={`r-${r}`}
          position={[ox + r * 3.9, height / 2 - 1.05, 0.02]}
          fontSize={0.2}
          color="#ffe9a8"
          anchorX="center"
        >
          {roundLabel(r, layout.maxRound)}
        </Text>
      ))}
      {layout.edges.map(edge => {
        const from = layout.nodes.find(n => n.id === edge.from)
        const lit = Boolean(from?.matchup.winner)
        return (
          <Line
            key={`${edge.from}-${edge.to}`}
            points={edge.points.map(([x, y]) => [ox + x, oy + y, -0.04])}
            color={lit ? GOLD : '#3d4a6a'}
            lineWidth={lit ? 2.4 : 1.4}
            transparent
            opacity={lit ? 0.95 : 0.45}
          />
        )
      })}
      {layout.nodes.map(node => (
        <BracketNode
          key={node.id}
          nodeX={ox + node.x}
          nodeY={oy + node.y}
          matchup={node.matchup}
          live={node.id === currentId && (state?.phase === 'matchup' || state?.phase === 'tally')}
        />
      ))}
    </group>
  )
}

function BracketNode({
  nodeX,
  nodeY,
  matchup,
  live,
}: {
  nodeX: number
  nodeY: number
  matchup: NightState['matchups'][number]
  live: boolean
}) {
  const pulse = useRef<Group>(null)
  useFrame(clock => {
    if (!pulse.current) return
    const s = live ? 1 + Math.sin(clock.clock.elapsedTime * 4) * 0.04 : 1
    pulse.current.scale.setScalar(s)
  })

  return (
    <group ref={pulse} position={[nodeX, nodeY, 0]}>
      <RoundedBox args={[2.05, 1.85, 0.08]} radius={0.06} smoothness={3}>
        <meshStandardMaterial
          color={live ? '#1c243c' : '#12182a'}
          emissive={live ? GOLD : matchup.winner ? '#3a2a10' : '#000'}
          emissiveIntensity={live ? 0.35 : matchup.winner ? 0.18 : 0}
          metalness={0.25}
          roughness={0.45}
        />
      </RoundedBox>
      <SlotFace contestant={matchup.left} position={[-0.48, 0.12, 0.06]} winner={matchup.winner?.id === matchup.left?.id} />
      <SlotFace contestant={matchup.right} position={[0.48, 0.12, 0.06]} winner={matchup.winner?.id === matchup.right?.id} />
      <Text position={[0, -0.72, 0.06]} fontSize={0.14} color={matchup.winner ? GOLD : '#9aa3b8'} anchorX="center" maxWidth={1.9}>
        {matchup.bye ? 'BYE' : matchup.winner ? matchup.winner.name : live ? 'LIVE' : 'TBD'}
      </Text>
    </group>
  )
}

function SlotFace({
  contestant,
  position,
  winner,
}: {
  contestant: { name: string, imageUrl: string } | null
  position: [number, number, number]
  winner: boolean
}) {
  const texture = useNightTexture(contestant?.imageUrl, contestant?.name || '?')
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[0.82, 0.82]} />
        <meshStandardMaterial
          map={texture || undefined}
          color={texture ? '#ffffff' : '#2a3148'}
          emissive={winner ? GOLD : '#000'}
          emissiveIntensity={winner ? 0.22 : 0}
        />
      </mesh>
      <Text position={[0, -0.52, 0.01]} fontSize={0.1} color={winner ? GOLD : '#f2efe6'} anchorX="center" maxWidth={0.9}>
        {contestant?.name || 'TBD'}
      </Text>
    </group>
  )
}
