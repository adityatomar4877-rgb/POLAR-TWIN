import { StationGroup } from '../common/StationGroup'

export function MaitriFuelStation() {
  return (
    <StationGroup id="MaitriFuelStation">
      <group position={[0, 1, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[4, 2, 2]} />
          <meshStandardMaterial color="#cc4444" roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.5, 2]}>
          <boxGeometry args={[6, 0.2, 4]} />
          <meshStandardMaterial color="#222" roughness={0.9} />
        </mesh>
        {/* Small pump stand */}
        <mesh position={[-1.5, 0.5, 1.5]}>
          <boxGeometry args={[0.8, 1.5, 0.8]} />
          <meshStandardMaterial color="#888" metalness={0.4} />
        </mesh>
      </group>
    </StationGroup>
  )
}
