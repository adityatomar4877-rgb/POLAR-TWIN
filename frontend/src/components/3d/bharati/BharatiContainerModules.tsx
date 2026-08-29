import { StationGroup } from '../common/StationGroup'
import { SteelDark } from '../common/materials'
import { FACILITIES, terrainHeight } from '../../../lib/3d/stationLayout'

const CONTAINER_COLORS = ['#b7502e', '#2b6cb0', '#7a8288', '#8f3b2e', '#3f6f5f', '#a08a3c', '#55606b']
const CONTAINER_L = 6
const CONTAINER_H = 2.6
const CONTAINER_W = 2.44

interface ContainerProps {
  index: number
  position: [number, number, number]
  rotation?: number
}

/**
 * Containerised modules (workshops, stores, labs). Each remains an
 * individually named object for later interaction/telemetry.
 */
function ContainerModule({ index, position, rotation = 0 }: ContainerProps) {
  const name = `BharatiContainerModule${String(index).padStart(2, '0')}`
  const color = CONTAINER_COLORS[(index - 1) % CONTAINER_COLORS.length]
  return (
    <group name={name} position={position} userData={{ stationId: name }} rotation={[0, rotation, 0]}>
      <mesh position={[0, CONTAINER_H / 2, 0]}>
        <boxGeometry args={[CONTAINER_L, CONTAINER_H, CONTAINER_W]} />
        <meshStandardMaterial color={color} roughness={0.62} metalness={0.28} />
      </mesh>
      {/* Roof cap */}
      <mesh position={[0, CONTAINER_H + 0.05, 0]}>
        <boxGeometry args={[CONTAINER_L + 0.1, 0.1, CONTAINER_W + 0.1]} />
        <SteelDark />
      </mesh>
      {/* Door-end lock rods */}
      {[CONTAINER_W / 2 - 0.35, -(CONTAINER_W / 2 - 0.35)].map((z) => (
        <mesh key={z} position={[CONTAINER_L / 2 + 0.03, CONTAINER_H / 2, z]}>
          <cylinderGeometry args={[0.035, 0.035, CONTAINER_H - 0.3, 6]} />
          <SteelDark />
        </mesh>
      ))}
    </group>
  )
}

/** Row of containerized support modules north of the main building. */
export function BharatiContainerModules() {
  const { x, z } = FACILITIES.containers
  return (
    <StationGroup id="BharatiContainerModules" label="Containerized Modules" position={[x, terrainHeight(x, z), z]}>
      <ContainerModule index={1} position={[-13, 0, -4]} rotation={0.02} />
      <ContainerModule index={2} position={[-6, 0, -4]} rotation={-0.03} />
      <ContainerModule index={3} position={[1, 0, -4]} rotation={0.01} />
      <ContainerModule index={4} position={[8, 0, -4]} rotation={-0.02} />
      {/* Stacked pair */}
      <ContainerModule index={5} position={[15, 0, -4]} rotation={0.03} />
      <ContainerModule index={6} position={[15, CONTAINER_H + 0.12, -4]} rotation={0.01} />
      {/* Rotated unit near the west path */}
      <ContainerModule index={7} position={[-19, 0, 1]} rotation={Math.PI / 2 + 0.02} />
    </StationGroup>
  )
}
