import { StationGroup } from '../common/StationGroup'
import { AccentOrange, Concrete, SteelDark, SteelGalvanized, TankWhite } from '../common/materials'
import { FACILITIES, terrainHeight } from '../../../lib/3d/stationLayout'

const TANKS: [number, number][] = [
  [-5, -3],
  [1, -3],
  [-5, 3],
  [1, 3],
]

function FuelTank({ index, x, z }: { index: number; x: number; z: number }) {
  return (
    <group name={`BharatiFuelTank0${index}`} position={[x, 1.9, z]} rotation={[0, Math.PI / 2, 0]}>
      {/* Horizontal capsule tank (axis along local X after group rotation) */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[1.5, 6.6, 6, 18]} />
        <TankWhite />
      </mesh>
      {/* Identification band */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.53, 1.53, 0.55, 24, 1, true]} />
        <AccentOrange />
      </mesh>
      {/* Saddle supports */}
      {[-2.4, 2.4].map((sx) => (
        <mesh key={sx} position={[sx, -1.55, 0]}>
          <boxGeometry args={[0.9, 0.8, 3.2]} />
          <Concrete />
        </mesh>
      ))}
      {/* Manifold stub + valve */}
      <mesh position={[3.9, -0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.11, 0.11, 1.6, 8]} />
        <SteelDark />
      </mesh>
      <mesh position={[4.75, -0.7, 0]}>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
        <AccentOrange />
      </mesh>
    </group>
  )
}

/**
 * Fuel farm: bunded storage area with four horizontal tanks, transfer
 * manifold and containment walls.
 */
export function BharatiFuelFarm() {
  const { x, z } = FACILITIES.fuelFarm
  return (
    <StationGroup id="BharatiFuelFarm" label="Fuel Farm" position={[x, terrainHeight(x, z), z]}>
      {/* Bund floor + containment walls (26 m x 14 m) */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[25, 13]} />
        <meshStandardMaterial color="#7c776e" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.5, 6.6]}>
        <boxGeometry args={[26, 1, 0.5]} />
        <Concrete />
      </mesh>
      <mesh position={[0, 0.5, -6.6]}>
        <boxGeometry args={[26, 1, 0.5]} />
        <Concrete />
      </mesh>
      <mesh position={[12.9, 0.5, 0]}>
        <boxGeometry args={[0.5, 1, 13]} />
        <Concrete />
      </mesh>
      <mesh position={[-12.9, 0.5, 0]}>
        <boxGeometry args={[0.5, 1, 13]} />
        <Concrete />
      </mesh>

      {TANKS.map(([tx, tz], i) => (
        <FuelTank key={i} index={i + 1} x={tx} z={tz} />
      ))}

      {/* Transfer header running to the east gate */}
      <mesh position={[9.5, 1.15, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 8, 10]} />
        <SteelDark />
      </mesh>
      <mesh position={[13.2, 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.14, 0.14, 1.4, 8]} />
        <SteelDark />
      </mesh>

      {/* Gauge / valve cabinet and light pole */}
      <mesh position={[-10.5, 0.85, 5.2]}>
        <boxGeometry args={[1.1, 1.5, 0.7]} />
        <SteelGalvanized />
      </mesh>
      <mesh position={[10.5, 2.5, 5.5]}>
        <cylinderGeometry args={[0.07, 0.09, 5, 8]} />
        <SteelGalvanized />
      </mesh>
      <mesh position={[10.5, 5.05, 5.5]}>
        <boxGeometry args={[0.5, 0.22, 0.3]} />
        <SteelDark />
      </mesh>

      {/* Access ladder on tank row */}
      <group position={[-8.2, 0, -3]}>
        <mesh position={[0, 1.9, 1.62]}>
          <boxGeometry args={[0.6, 3.6, 0.08]} />
          <SteelDark />
        </mesh>
        {[0.6, 1.4, 2.2, 3.0].map((y) => (
          <mesh key={y} position={[0, y, 1.72]}>
            <boxGeometry args={[0.5, 0.06, 0.14]} />
            <SteelDark />
          </mesh>
        ))}
      </group>
    </StationGroup>
  )
}
