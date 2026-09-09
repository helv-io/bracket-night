import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

function GoldRing({ radius, tube, y }: { radius: number; tube: number; y: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <torusGeometry args={[radius, tube, 16, 80]} />
      <meshStandardMaterial
        color="#e8c46a"
        metalness={0.85}
        roughness={0.28}
        emissive="#5a3d10"
        emissiveIntensity={0.25}
      />
    </mesh>
  )
}

export default function Stadium() {
  const wash = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    if (!wash.current) return
    wash.current.intensity = 1.15 + Math.sin(clock.elapsedTime * 0.7) * 0.18
  })

  return (
    <group>
      <color attach="background" args={['#070b16']} />
      <fog attach="fog" args={['#070b16', 12, 34]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[16, 72]} />
        <meshStandardMaterial color="#0c1224" metalness={0.35} roughness={0.7} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[4.6, 4.72, 80]} />
        <meshStandardMaterial
          color="#e8c46a"
          metalness={0.8}
          roughness={0.25}
          emissive="#e8c46a"
          emissiveIntensity={0.2}
        />
      </mesh>

      <GoldRing radius={7.2} tube={0.045} y={0.02} />
      <GoldRing radius={10.4} tube={0.03} y={0.02} />

      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}-${z}`} position={[x * 7.4, 1.15, z * 6.2]}>
            <boxGeometry args={[0.35, 2.3, 0.35]} />
            <meshStandardMaterial color="#141c34" metalness={0.4} roughness={0.55} />
          </mesh>
        ))
      )}

      <Sparkles count={80} scale={[14, 6, 10]} size={3} speed={0.35} opacity={0.45} color="#ffe9a8" />

      <ambientLight intensity={0.28} color="#8aa0d8" />
      <spotLight
        position={[0, 10, 4]}
        angle={0.55}
        penumbra={0.55}
        intensity={48}
        color="#fff4d2"
        castShadow
      />
      <spotLight position={[-6, 6, -2]} angle={0.5} penumbra={0.7} intensity={18} color="#5d7cff" />
      <spotLight position={[6, 5, 3]} angle={0.4} penumbra={0.8} intensity={14} color="#e8c46a" />
      <pointLight ref={wash} position={[0, 3.2, 1]} intensity={1.2} color="#ffe9a8" />
    </group>
  )
}
