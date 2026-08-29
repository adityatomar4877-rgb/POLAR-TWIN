import { StationGroup } from '../common/StationGroup'
import { AccentOrange, Concrete, GlassDark, PanelWhite, SteelDark } from '../common/materials'
import { FACILITIES, terrainHeight } from '../../../lib/3d/stationLayout'

/** Vehicle/equipment refuelling point between the main campus and the fuel farm. */
export function BharatiFuelStation() {
  const { x, z } = FACILITIES.fuelStation
  return (
    <StationGroup id="BharatiFuelStation" label="Fuel Station" position={[x, terrainHeight(x, z), z]}>
      {/* Slab */}
      <mesh position={[0, 0.125, 0]}>
        <boxGeometry args={[6, 0.25, 5]} />
        <Concrete />
      </mesh>
      {/* Canopy posts + roof */}
      {[
        [-2.3, -1.8],
        [2.3, -1.8],
        [-2.3, 1.8],
        [2.3, 1.8],
      ].map(([px, pz], i) => (
        <mesh key={i} position={[px, 1.68, pz]}>
          <boxGeometry args={[0.18, 3.1, 0.18]} />
          <SteelDark />
        </mesh>
      ))}
      <mesh position={[0, 3.35, 0]}>
        <boxGeometry args={[5.4, 0.25, 4.4]} />
        <PanelWhite />
      </mesh>
      <mesh position={[0, 3.33, 2.24]}>
        <boxGeometry args={[5.4, 0.3, 0.08]} />
        <AccentOrange />
      </mesh>
      {/* Dispenser unit */}
      <mesh position={[0, 0.95, -0.6]}>
        <boxGeometry args={[0.95, 1.35, 0.6]} />
        <AccentOrange />
      </mesh>
      <mesh position={[0, 1.28, -0.28]}>
        <boxGeometry args={[0.6, 0.42, 0.05]} />
        <GlassDark />
      </mesh>
      {/* Bollards */}
      {[-2.2, 0, 2.2].map((bx) => (
        <mesh key={bx} position={[bx, 0.83, 1.9]}>
          <cylinderGeometry args={[0.09, 0.09, 0.9, 8]} />
          <AccentOrange />
        </mesh>
      ))}
    </StationGroup>
  )
}
