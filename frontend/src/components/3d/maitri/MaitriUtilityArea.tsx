import { StationGroup } from '../common/StationGroup'

export function MaitriUtilityArea() {
  return (
    <StationGroup id="MaitriUtilityArea">
      <group position={[0, 1.5, 0]}>
        {/* Storage modules */}
        <mesh position={[-5, 0, 0]}>
          <boxGeometry args={[8, 3, 6]} />
          <meshStandardMaterial color="#515c61" roughness={0.8} />
        </mesh>
        <mesh position={[5, -0.5, 2]}>
          <boxGeometry args={[6, 2, 4]} />
          <meshStandardMaterial color="#66615b" roughness={0.8} />
        </mesh>
        {/* Small comms dish */}
        <mesh position={[-5, 2.5, 0]} rotation={[-Math.PI / 4, Math.PI / 4, 0]}>
          <cylinderGeometry args={[1.5, 0.1, 0.5, 16]} />
          <meshStandardMaterial color="#eeeeee" roughness={0.4} />
        </mesh>
        <mesh position={[-5, 1.5, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 2]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>
    </StationGroup>
  )
}
