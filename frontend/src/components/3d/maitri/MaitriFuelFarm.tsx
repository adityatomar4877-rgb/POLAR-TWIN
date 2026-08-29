import { StationGroup } from '../common/StationGroup'

export function MaitriFuelFarm() {
  return (
    <StationGroup id="MaitriFuelFarm">
      <group position={[0, 1.5, 0]}>
        <mesh position={[-6, 0, -4]}>
          <cylinderGeometry args={[4, 4, 3, 16]} />
          <meshStandardMaterial color="#8a3033" roughness={0.6} />
        </mesh>
        <mesh position={[6, 0, -4]}>
          <cylinderGeometry args={[4, 4, 3, 16]} />
          <meshStandardMaterial color="#8a3033" roughness={0.6} />
        </mesh>
        <mesh position={[-6, 0, 6]}>
          <cylinderGeometry args={[4, 4, 3, 16]} />
          <meshStandardMaterial color="#8a3033" roughness={0.6} />
        </mesh>
        <mesh position={[6, 0, 6]}>
          <cylinderGeometry args={[4, 4, 3, 16]} />
          <meshStandardMaterial color="#8a3033" roughness={0.6} />
        </mesh>
        {/* Containment wall */}
        <mesh position={[0, -1, 0]}>
          <boxGeometry args={[22, 1, 20]} />
          <meshStandardMaterial color="#333333" roughness={0.9} />
        </mesh>
        {/* Piping */}
        <mesh position={[0, 1, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.2, 0.2, 12]} />
          <meshStandardMaterial color="#b0b0b0" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>
    </StationGroup>
  )
}
