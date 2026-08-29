import { StationGroup } from '../common/StationGroup'

export function MaitriSummerCamp() {
  const containerPositions = [
    [-8, 0, -4], [0, 0, -4], [8, 0, -4],
    [-8, 0, 4],  [0, 0, 4],  [8, 0, 4],
    [-4, 0, 10], [4, 0, 10]
  ]

  return (
    <StationGroup id="MaitriSummerCamp">
      <group position={[0, 1.5, 0]}>
        {containerPositions.map((pos, i) => (
          <mesh key={i} position={pos as [number, number, number]}>
            <boxGeometry args={[6, 3, 2.5]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#43594b" : "#5a6873"} roughness={0.7} />
          </mesh>
        ))}
        {/* Walkways connecting containers */}
        <mesh position={[0, -1.4, 0]}>
          <boxGeometry args={[20, 0.2, 10]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
        </mesh>
      </group>
    </StationGroup>
  )
}
