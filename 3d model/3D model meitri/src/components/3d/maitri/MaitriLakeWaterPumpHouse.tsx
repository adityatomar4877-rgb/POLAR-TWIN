import { StationGroup } from '../common/StationGroup'

export function MaitriLakeWaterPumpHouse() {
  return (
    <StationGroup id="MaitriLakeWaterPumpHouse">
      <group position={[0, 1.5, 0]}>
        <mesh>
          <boxGeometry args={[6, 3, 5]} />
          <meshStandardMaterial color="#4f5963" roughness={0.8} />
        </mesh>
        {/* Roof */}
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[6.4, 0.2, 5.4]} />
          <meshStandardMaterial color="#30353b" roughness={0.9} />
        </mesh>
        {/* Pipe extending leftwards into Lake Priyadarshini */}
        <mesh position={[-6, -1, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.4, 0.4, 16]} />
          <meshStandardMaterial color="#4a6350" roughness={0.6} metalness={0.2} />
        </mesh>
        {/* Pipe elbow dipping into water */}
        <mesh position={[-14, -2.5, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 4]} />
          <meshStandardMaterial color="#4a6350" roughness={0.6} metalness={0.2} />
        </mesh>
      </group>
    </StationGroup>
  )
}
