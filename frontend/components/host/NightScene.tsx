import { ContactShadows, Float, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Bracket, Matchup, Player, Vote } from '../../../backend/src/types'
import { HostPhase, TallyView, TossView, matchupLabel, votesForPlayer } from '../../lib/nightView'
import GoldCoin from './GoldCoin'
import { Plaque, PlayerChip, VoteBar } from './Plaques'
import Stadium from './Stadium'
import { useTextureFromCanvas } from './textures'

function CameraRig({ phase }: { phase: HostPhase }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(0, 1.1, 0))
  const desired = useMemo(() => {
    switch (phase) {
      case 'lobby':
        return { pos: new THREE.Vector3(0, 2.85, 9.4), look: new THREE.Vector3(0, 1.15, 0) }
      case 'matchup':
      case 'tally':
        return { pos: new THREE.Vector3(0, 1.72, 6.5), look: new THREE.Vector3(0, 0.95, 0) }
      case 'coin':
        return { pos: new THREE.Vector3(0.2, 1.6, 5.15), look: new THREE.Vector3(0, 1.3, 0) }
      case 'champion':
        return { pos: new THREE.Vector3(0, 2.05, 6.9), look: new THREE.Vector3(0, 1.15, 0) }
      default:
        return { pos: new THREE.Vector3(0, 2.6, 8.5), look: new THREE.Vector3(0, 1.1, 0) }
    }
  }, [phase])

  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.12, dt)
    camera.position.lerp(desired.pos, k)
    look.current.lerp(desired.look, k)
    camera.lookAt(look.current)
  })
  return null
}

function LobbyRig({
  gameId,
  players,
  qrCanvas,
  bracket,
}: {
  gameId: string | null
  players: Player[]
  qrCanvas: HTMLCanvasElement | null
  bracket: Bracket | null
}) {
  const qrTex = useTextureFromCanvas(qrCanvas)
  const arc = players.slice(0, 16)

  return (
    <group>
      <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.18}>
        <Text position={[0, 3.35, 0]} fontSize={0.42} color="#ffe9a8" anchorX="center">
          BRACKET NIGHT
        </Text>
        <Text position={[0, 2.88, 0]} fontSize={0.16} color="#9aa3b8" anchorX="center">
          {bracket ? `${bracket.title}` : 'Scan in. The room decides.'}
        </Text>
      </Float>

      <Text position={[0, 2.35, 0.2]} fontSize={0.62} color="#e8c46a" anchorX="center" letterSpacing={0.12}>
        {gameId || '····'}
      </Text>
      <Text position={[0, 1.92, 0.2]} fontSize={0.12} color="#9aa3b8" anchorX="center">
        Join code  ·  phones only
      </Text>

      <group position={[0, 1.05, 0.4]}>
        <mesh>
          <boxGeometry args={[1.85, 1.85, 0.08]} />
          <meshStandardMaterial color="#f4f1e8" metalness={0.1} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.045]}>
          <planeGeometry args={[1.7, 1.7]} />
          <meshStandardMaterial map={qrTex} color={qrTex ? '#ffffff' : '#111'} />
        </mesh>
      </group>

      {arc.map((player, i) => {
        const t = arc.length === 1 ? 0 : (i / (arc.length - 1) - 0.5) * Math.PI * 0.7
        const r = 3.6
        return (
          <PlayerChip
            key={player.id}
            name={player.name}
            voted={false}
            connected={player.connected}
            position={[Math.sin(t) * r, 0.2, 2.1 + Math.cos(t) * 0.4]}
          />
        )
      })}

      {players.length === 0 && (
        <Text position={[0, 0.22, 2.2]} fontSize={0.14} color="#9aa3b8" anchorX="center">
          Waiting for the first phone
        </Text>
      )}
    </group>
  )
}

function MatchupRig({
  matchups,
  currentMatchupIndex,
  players,
  currentVotes,
  phase,
  tally,
}: {
  matchups: Matchup[]
  currentMatchupIndex: number
  players: Player[]
  currentVotes: Vote[]
  phase: HostPhase
  tally: TallyView | null
}) {
  const matchup = matchups[currentMatchupIndex]
  const left = matchup?.left || null
  const right = matchup?.right || null
  const total = Math.max(1, (tally?.left || 0) + (tally?.right || 0))
  const showTally = phase === 'tally' && tally

  return (
    <group>
      <Text position={[0, 2.85, 0]} fontSize={0.2} color="#9aa3b8" anchorX="center">
        {matchupLabel(currentMatchupIndex, matchups.length)}
      </Text>
      <Plaque contestant={left} position={[-2.15, 1.35, 0]} hot={Boolean(showTally && tally && tally.left >= tally.right)} />
      <Text position={[0, 1.45, 0.2]} fontSize={0.28} color="#ff6f61" anchorX="center">
        VS
      </Text>
      <Plaque contestant={right} position={[2.15, 1.35, 0]} hot={Boolean(showTally && tally && tally.right >= tally.left)} />

      {showTally && tally && (
        <>
          <VoteBar position={[-2.15, 0.28, 0.4]} fill={tally.left / total} color="#5dffa8" />
          <VoteBar position={[2.15, 0.28, 0.4]} fill={tally.right / total} color="#ff6f61" />
          <Text position={[0, 2.5, 0]} fontSize={0.22} color="#ffe9a8" anchorX="center">
            {tally.left}  -  {tally.right}
          </Text>
        </>
      )}

      {phase === 'matchup' && (
        <Text position={[0, 2.5, 0]} fontSize={0.16} color="#c5cbe0" anchorX="center">
          {currentVotes.length} of {players.length} locked in
        </Text>
      )}

      {players.map((player, i) => {
        const spread = Math.min(14, players.length)
        const x = (i - (spread - 1) / 2) * 0.55
        return (
          <PlayerChip
            key={player.id}
            name={player.name}
            voted={votesForPlayer(currentVotes, player.id)}
            connected={player.connected}
            position={[x, 0.12, 2.35]}
          />
        )
      })}
    </group>
  )
}

function ChampionRig({ matchups }: { matchups: Matchup[] }) {
  const champ = matchups[matchups.length - 1]?.winner || null
  return (
    <group>
      <Text position={[0, 3.05, 0]} fontSize={0.42} color="#5dffa8" anchorX="center">
        CHAMPION
      </Text>
      <Plaque contestant={champ} position={[0, 1.35, 0]} hot scale={1.15} />
      <Text position={[0, 0.18, 0.4]} fontSize={0.2} color="#ffe9a8" anchorX="center">
        {champ?.name || 'The room has spoken'}
      </Text>
    </group>
  )
}

export default function NightScene({
  phase,
  gameId,
  bracket,
  matchups,
  currentMatchupIndex,
  players,
  currentVotes,
  tally,
  toss,
  qrCanvas,
  onTossComplete,
}: {
  phase: HostPhase
  gameId: string | null
  joinUrl?: string
  bracket: Bracket | null
  matchups: Matchup[]
  currentMatchupIndex: number
  players: Player[]
  currentVotes: Vote[]
  tally: TallyView | null
  toss: TossView | null
  qrCanvas: HTMLCanvasElement | null
  onTossComplete: () => void
}) {
  return (
    <>
      <Stadium />
      <ContactShadows position={[0, 0.02, 0]} opacity={0.42} scale={18} blur={2.2} far={6} />
      <CameraRig phase={phase} />

      {(phase === 'lobby') && (
        <LobbyRig
          gameId={gameId}
          players={players}
          qrCanvas={qrCanvas}
          bracket={bracket}
        />
      )}

      {(phase === 'matchup' || phase === 'tally') && (
        <MatchupRig
          matchups={matchups}
          currentMatchupIndex={currentMatchupIndex}
          players={players}
          currentVotes={currentVotes}
          phase={phase}
          tally={tally}
        />
      )}

      {phase === 'coin' && toss && (
        <GoldCoin
          contestants={toss.contestants}
          winner={toss.winner}
          onComplete={onTossComplete}
        />
      )}

      {phase === 'champion' && <ChampionRig matchups={matchups} />}
    </>
  )
}
