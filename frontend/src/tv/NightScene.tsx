import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox, Sparkles, Text } from '@react-three/drei'
import { Group, SRGBColorSpace, Texture, Vector3 } from 'three'
import QRCode from 'qrcode'
import { NightState } from '../lib/types'
import { BracketSet } from './BracketTree'
import { coinTossPose } from '../../../engine/src/coinToss'
import { useNightTexture } from './textures'

const GOLD = '#e8c46a'
const NAVY = '#0b1020'

export type TvView = 'arena' | 'bracket'

export function ArenaRig({
  state,
  joinUrl,
  tvView,
}: {
  state: NightState | null
  joinUrl: string
  tvView: TvView
}) {
  const focusBracket = tvView === 'bracket'
  return (
    <>
      <color attach="background" args={[NAVY]} />
      <fog attach="fog" args={['#070b16', 18, 52]} />
      <ambientLight intensity={0.35} />
      <spotLight position={[0, 16, 8]} angle={0.55} penumbra={0.5} intensity={3.2} color="#fff1c8" castShadow />
      <spotLight position={[-10, 8, -6]} angle={0.4} intensity={1.4} color="#6ecbff" />
      <spotLight position={[10, 8, -6]} angle={0.4} intensity={1.4} color="#ff6f61" />
      <hemisphereLight args={['#9eb6ff', '#1a1208', 0.35]} />

      <Floor />
      <Ring />
      <Sparkles count={80} scale={[24, 8, 24]} size={3} speed={0.3} color={GOLD} opacity={0.45} />

      <CameraDirector state={state} tvView={tvView} />
      <LobbySet state={state} joinUrl={joinUrl} />
      {!focusBracket && <MatchupSet state={state} />}
      <CoinSet state={state} />
      {!focusBracket && <ChampionSet state={state} />}
      <BracketSet state={state} focus={focusBracket} />
    </>
  )
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[18, 64]} />
      <meshStandardMaterial color="#0a1020" metalness={0.55} roughness={0.35} />
    </mesh>
  )
}

function Ring() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
      <torusGeometry args={[7.4, 0.06, 16, 80]} />
      <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1.6} metalness={0.8} roughness={0.2} />
    </mesh>
  )
}

function CameraDirector({ state, tvView }: { state: NightState | null, tvView: TvView }) {
  const { camera } = useThree()
  const target = useRef(new Vector3(0, 2.2, 0))
  const goal = useRef(new Vector3(0, 5.4, 12))

  useEffect(() => {
    const phase = state?.phase || 'lobby'
    if (tvView === 'bracket' && phase !== 'coin') {
      const n = state?.matchups.length || 7
      goal.current.set(0, 3.5, n > 8 ? 16.2 : 12.4)
      target.current.set(0, 2.15, 0)
      return
    }
    if (phase === 'lobby') {
      goal.current.set(0, 5.4, 12)
      target.current.set(0, 2.2, 0)
    } else if (phase === 'champion') {
      goal.current.set(0, 3.2, 7.2)
      target.current.set(0, 2.4, 0)
    } else if (phase === 'coin') {
      goal.current.set(0, 3.4, 7.6)
      target.current.set(0, 2.4, 0)
    } else {
      goal.current.set(0, 3.4, 9.2)
      target.current.set(0, 1.8, 0)
    }
  }, [state?.phase, state?.matchups.length, tvView])

  useFrame((_, dt) => {
    camera.position.lerp(goal.current, 1 - Math.pow(0.08, dt * 60))
    camera.lookAt(target.current)
  })

  return null
}

function LobbySet({ state, joinUrl }: { state: NightState | null, joinUrl: string }) {
  const visible = !state || state.phase === 'lobby'
  const qr = useQrTexture(joinUrl)
  const players = state?.players || []

  return (
    <group visible={visible}>
      <Text position={[0, 5.85, -1.4]} fontSize={0.58} color={GOLD} anchorX="center">
        BRACKET NIGHT
      </Text>
      <Text position={[0, 5.28, -1.4]} fontSize={0.22} color="#f2efe6" anchorX="center">
        {state?.field?.title || 'Scan in. The house is listening.'}
      </Text>
      <Text position={[0, 1.72, 0.35]} fontSize={0.48} color="#ffe9a8" anchorX="center">
        {state?.roomId || '····'}
      </Text>
      {qr && (
        <mesh position={[0, 0.42, 0.5]}>
          <planeGeometry args={[1.2, 1.2]} />
          <meshBasicMaterial map={qr} />
        </mesh>
      )}
      {players.map((player, i) => {
        const angle = (i / Math.max(players.length, 1)) * Math.PI * 2 - Math.PI / 2
        const r = 5.2
        return (
          <group key={player.id} position={[Math.cos(angle) * r, 1.1, Math.sin(angle) * r]}>
            <mesh>
              <sphereGeometry args={[0.28, 24, 24]} />
              <meshStandardMaterial
                color={player.connected ? GOLD : '#445'}
                emissive={player.connected ? GOLD : '#000'}
                emissiveIntensity={0.6}
              />
            </mesh>
            <Text position={[0, 0.55, 0]} fontSize={0.18} color="#fff" anchorX="center">
              {player.name}
            </Text>
          </group>
        )
      })}
      <FieldPreview state={state} />
    </group>
  )
}

function FieldPreview({ state }: { state: NightState | null }) {
  const contestants = state?.field?.contestants || []
  if (!contestants.length || state?.phase !== 'lobby') return null
  const cols = Math.min(4, contestants.length)
  const rows = Math.ceil(contestants.length / cols)
  return (
    <group>
      {contestants.map((contestant, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = (col - (cols - 1) / 2) * 1.55
        const y = 4.15 - row * 1.48
        return (
          <group key={contestant.id} position={[x, y, -3.15]}>
            <LobbyPhoto contestant={contestant} />
          </group>
        )
      })}
      <Text position={[0, 4.15 + (rows > 1 ? 0.92 : 0.85), -3.1]} fontSize={0.18} color="#9aa3b8" anchorX="center">
        {`${contestants.length} in the house`}
      </Text>
    </group>
  )
}

function LobbyPhoto({ contestant }: { contestant: { name: string, imageUrl: string } }) {
  const texture = useNightTexture(contestant.imageUrl, contestant.name)
  return (
    <group>
      <RoundedBox args={[1.18, 1.38, 0.07]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color="#151b2e" metalness={0.3} roughness={0.4} />
      </RoundedBox>
      {texture && (
        <mesh position={[0, 0.1, 0.045]}>
          <planeGeometry args={[1.02, 1.02]} />
          <meshBasicMaterial map={texture} />
        </mesh>
      )}
      <Text position={[0, -0.54, 0.05]} fontSize={0.1} color="#ffe9a8" anchorX="center" maxWidth={1.1}>
        {contestant.name}
      </Text>
    </group>
  )
}

function MatchupSet({ state }: { state: NightState | null }) {
  const phase = state?.phase
  const live = phase === 'matchup' || phase === 'tally'
  const current = state?.matchups[state.currentMatchupIndex]
  const left = current?.left
  const right = current?.right
  const votes = state?.votes || []
  const leftN = votes.filter(v => v.choice === 0).length
  const rightN = votes.filter(v => v.choice === 1).length
  const total = Math.max(state?.players.length || 1, 1)
  const tally = state?.lastResult?.tallies
  const showLeft = phase === 'tally' && tally ? tally.left : leftN
  const showRight = phase === 'tally' && tally ? tally.right : rightN

  if (!live || !left || !right) return null

  return (
    <group>
      <FighterCard contestant={left} position={[-2.35, 1.7, 0]} intensity={showLeft / total} />
      <FighterCard contestant={right} position={[2.35, 1.7, 0]} intensity={showRight / total} />
      <Text position={[0, 3.35, 0]} fontSize={0.7} color={GOLD} anchorX="center">
        VS
      </Text>
      <Text position={[0, 0.45, 0]} fontSize={0.22} color="#f2efe6" anchorX="center">
        {`${showLeft}  -  ${showRight}`}
      </Text>
    </group>
  )
}

function FighterCard({
  contestant,
  position,
  intensity,
}: {
  contestant: { name: string, imageUrl: string }
  position: [number, number, number]
  intensity: number
}) {
  const texture = useNightTexture(contestant.imageUrl, contestant.name)
  const group = useRef<Group>(null)
  useFrame(clock => {
    if (!group.current) return
    group.current.position.y = position[1] + Math.sin(clock.clock.elapsedTime * 1.4 + position[0]) * 0.06
  })
  return (
    <group ref={group} position={position}>
      <RoundedBox args={[2.2, 2.8, 0.12]} radius={0.08} smoothness={4} castShadow>
        <meshStandardMaterial color="#151b2e" metalness={0.3} roughness={0.4} />
      </RoundedBox>
      {texture && (
        <mesh position={[0, 0.15, 0.08]}>
          <planeGeometry args={[1.9, 1.9]} />
          <meshBasicMaterial map={texture} />
        </mesh>
      )}
      <Text position={[0, -1.15, 0.1]} fontSize={0.2} color="#ffe9a8" anchorX="center" maxWidth={2}>
        {contestant.name}
      </Text>
      <mesh position={[0, -1.45, 0.1]}>
        <boxGeometry args={[Math.max(0.08, intensity * 1.8), 0.08, 0.08]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1.4} />
      </mesh>
    </group>
  )
}

function CoinSet({ state }: { state: NightState | null }) {
  const result = state?.lastResult
  const matchup = result ? state?.matchups.find(m => m.id === result.matchupId) : null
  const left = matchup?.left
  const right = matchup?.right
  const leftTex = useNightTexture(left?.imageUrl, left?.name || 'A')
  const rightTex = useNightTexture(right?.imageUrl, right?.name || 'B')
  const coin = useRef<Group>(null)
  const startedAt = useRef<number | null>(null)
  const [landed, setLanded] = useState(false)
  const active = state?.phase === 'coin' && Boolean(result && left && right)
  const tossKey = `${result?.matchupId}:${result?.winnerSide}`

  useEffect(() => {
    if (!active) {
      startedAt.current = null
      setLanded(false)
      return
    }
    startedAt.current = performance.now()
    setLanded(false)
  }, [active, tossKey])

  useFrame(() => {
    if (!coin.current || !active || !result) return
    if (startedAt.current == null) startedAt.current = performance.now()
    const pose = coinTossPose(performance.now() - startedAt.current, result.winnerSide)
    coin.current.position.y = pose.y
    coin.current.rotation.x = pose.rotX
    coin.current.rotation.z = pose.wobble
    coin.current.rotation.y = 0
    if (pose.done && !landed) setLanded(true)
  })

  if (!active || !result || !left || !right) return null

  return (
    <group>
      <spotLight position={[0, 6.2, 3.2]} angle={0.5} intensity={3.4} color="#fff1c8" />
      <Text position={[0, 4.2, 0]} fontSize={0.36} color={GOLD} anchorX="center">
        TIE. THE COIN DECIDES.
      </Text>
      <group position={[0, 1.6, 0.25]} rotation={[-0.42, 0, 0]}>
        <group ref={coin}>
          <mesh castShadow>
            <cylinderGeometry args={[1.15, 1.15, 0.16, 48]} />
            <meshStandardMaterial
              color={GOLD}
              metalness={0.85}
              roughness={0.18}
              emissive="#5a3d10"
              emissiveIntensity={0.35}
            />
          </mesh>
          {leftTex && (
            <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.92, 40]} />
              <meshBasicMaterial map={leftTex} />
            </mesh>
          )}
          {rightTex && (
            <mesh position={[0, -0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.92, 40]} />
              <meshBasicMaterial map={rightTex} />
            </mesh>
          )}
        </group>
      </group>
      <Text position={[0, 0.32, 0]} fontSize={0.22} color="#fff" anchorX="center">
        {landed ? result.winner.name : 'In the air'}
      </Text>
    </group>
  )
}

function ChampionSet({ state }: { state: NightState | null }) {
  const champ = state?.champion
  if (state?.phase !== 'champion' || !champ) return null
  return (
    <group>
      <Text position={[0, 4.3, 0]} fontSize={0.62} color={GOLD} anchorX="center">
        CHAMPION
      </Text>
      <FighterCard contestant={champ} position={[0, 1.8, 0]} intensity={1} />
      <Sparkles count={120} scale={[8, 6, 8]} size={5} speed={0.6} color={GOLD} />
    </group>
  )
}

function useQrTexture(value: string): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    if (!value) return
    let cancelled = false
    QRCode.toDataURL(value, { width: 512, margin: 1, color: { dark: '#1a1408', light: '#fff8e6' } })
      .then(url => {
        if (cancelled) return
        const img = new Image()
        img.onload = () => {
          const tex = new Texture(img)
          tex.colorSpace = SRGBColorSpace
          tex.needsUpdate = true
          setTexture(tex)
        }
        img.src = url
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [value])

  return texture
}
