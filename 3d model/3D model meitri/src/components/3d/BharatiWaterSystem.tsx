import { StationGroup } from './common/StationGroup'
import { Concrete, GlassDark, PanelDarkTrim, PanelWhite, PipeInsul, SteelDark, TankWhite } from './common/materials'
import { FACILITIES, terrainHeight } from '../../lib/stationLayout'

interface Seg {
  from: [number, number]
  to: [number, number]
}

/** Renders an above-ground insulated pipe run on trestle supports. */
function PipeRun({ seg, y, radius }: { seg: Seg; y: number; radius: number }) {
  const [ax, az] = seg.from
  const [bx, bz] = seg.to
  const dx = bx - ax
  const dz = bz - az
  const len = Math.hypot(dx, dz)
  const yaw = Math.atan2(dx, dz)
  const count = Math.max(2, Math.round(len / 4.5))
  const trestles: React.ReactElement[] = []
  for (let i = 0; i <= count; i++) {
    const t = i / count
    const lx = dx * t
    const lz = dz * t
    trestles.push(
      <group key={i} position={[lx, 0, lz]} rotation={[0, yaw, 0]}>
        {[-0.55, 0.55].map((off) => (
          <mesh key={off} position={[off, y / 2, 0]}>
            <boxGeometry args={[0.16, y, 0.16]} />
            <SteelDark />
          </mesh>
        ))}
        <mesh position={[0, y - 0.06, 0]}>
          <boxGeometry args={[1.4, 0.12, 0.3]} />
          <SteelDark />
        </mesh>
      </group>,
    )
  }
  return (
    <group position={[ax, 0, az]}>
      <group rotation={[0, yaw, 0]}>
        <mesh position={[0, y, len / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius, radius, len, 12]} />
          <PipeInsul />
        </mesh>
        {/* Flange rings */}
        {[0.25, 0.75].map((t) => (
          <mesh key={t} position={[0, y, len * t]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[radius + 0.07, radius + 0.07, 0.14, 14]} />
            <SteelDark />
          </mesh>
        ))}
      </group>
      {trestles}
    </group>
  )
}

/**
 * Seawater / fresh-water infrastructure: intake pumphouse, seawater
 * transfer line to the main building, raw-water intake toward the shore,
 * and an elevated fresh-water tank.
 */
export function BharatiWaterSystem() {
  const { x, z } = FACILITIES.waterPump
  return (
    <StationGroup id="BharatiWaterPump" label="Seawater & Water Pump Infrastructure" position={[x, terrainHeight(x, z), z]}>
      {/* Pumphouse */}
      <group name="BharatiPumpHouse">
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[6, 3, 4.5]} />
          <PanelWhite />
        </mesh>
        <mesh position={[0, 3.15, 0]}>
          <boxGeometry args={[6.4, 0.3, 4.9]} />
          <PanelDarkTrim />
        </mesh>
        <mesh position={[3.06, 1.2, 0]}>
          <boxGeometry args={[0.12, 2.2, 1]} />
          <GlassDark />
        </mesh>
        {[-1.2, 1.2].map((pz) => (
          <mesh key={pz} position={[-3.06, 2.1, pz]}>
            <boxGeometry args={[0.1, 0.5, 0.6]} />
            <PanelDarkTrim />
          </mesh>
        ))}
      </group>

      {/* Raw seawater intake running toward the shore */}
      <group name="BharatiSeawaterIntakePipeline">
        <PipeRun seg={{ from: [-3, 0.5], to: [-23, 3] }} y={0.65} radius={0.26} />
        <mesh position={[-23, 0.75, 3]}>
          <boxGeometry args={[1.2, 1.2, 1.2]} />
          <SteelDark />
        </mesh>
      </group>

      {/* Insulated transfer line cleanly connecting all the way into the Bharati Main Building */}
      <group name="BharatiSeawaterTransferPipeline">
        <PipeRun seg={{ from: [3, -1], to: [20, -10] }} y={0.9} radius={0.28} />
        <PipeRun seg={{ from: [20, -10], to: [36, -18] }} y={0.9} radius={0.28} />
        <PipeRun seg={{ from: [36, -18], to: [50, -25] }} y={0.9} radius={0.28} />
        {/* Riser cleanly entering into the main building lower service entry */}
        <mesh position={[50, 1.8, -25]}>
          <cylinderGeometry args={[0.26, 0.26, 2.2, 12]} />
          <PipeInsul />
        </mesh>
      </group>

      {/* Elevated fresh-water tank */}
      <group name="BharatiFreshWaterTank" position={[8, 0, 4.5]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[2.1, 2.3, 0.6, 16]} />
          <Concrete />
        </mesh>
        <mesh position={[0, 2.7, 0]}>
          <cylinderGeometry args={[1.7, 1.7, 4.2, 18]} />
          <TankWhite />
        </mesh>
        <mesh position={[0, 4.9, 0]}>
          <cylinderGeometry args={[1.72, 1.72, 0.25, 18]} />
          <PanelDarkTrim />
        </mesh>
      </group>
    </StationGroup>
  )
}
