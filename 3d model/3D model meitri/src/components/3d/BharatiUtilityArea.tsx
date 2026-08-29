import { StationGroup } from './common/StationGroup'
import { AccentOrange, Concrete, PanelDarkTrim, PanelLightGray, PanelWhite, SteelDark, SteelGalvanized, TankWhite } from './common/materials'
import { FACILITIES, terrainHeight } from '../../lib/stationLayout'

/** Diesel generators, heat-recovery skid, comms tower and met equipment. */
export function BharatiUtilityArea() {
  const { x, z } = FACILITIES.utility
  return (
    <StationGroup id="BharatiUtilityArea" label="Utility & Equipment Area" position={[x, terrainHeight(x, z), z]}>
      {/* Generator hall */}
      <group name="BharatiGenerators" position={[-4, 0, -2]}>
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[8, 3.6, 4.5]} />
          <SteelGalvanized />
        </mesh>
        <mesh position={[0, 3.75, 0]}>
          <boxGeometry args={[8.4, 0.3, 4.9]} />
          <PanelDarkTrim />
        </mesh>
        {/* Louvres */}
        {[-0.9, 0, 0.9].map((lx) => (
          <mesh key={lx} position={[lx, 1.6, 2.28]}>
            <boxGeometry args={[1.4, 0.35, 0.06]} />
            <PanelDarkTrim />
          </mesh>
        ))}
        {/* Exhaust stacks */}
        {[-2.8, -1.4].map((sx) => (
          <group key={sx} position={[sx, 5.4, -1.5]}>
            <mesh>
              <cylinderGeometry args={[0.2, 0.2, 3.4, 10]} />
              <SteelDark />
            </mesh>
            <mesh position={[0, 1.75, 0]}>
              <cylinderGeometry args={[0.26, 0.26, 0.15, 10]} />
              <AccentOrange />
            </mesh>
          </group>
        ))}
        {/* Fuel day tank */}
        <mesh position={[5.4, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.85, 0.85, 2.1, 14]} />
          <TankWhite />
        </mesh>
      </group>

      {/* Heat-recovery / heat-exchanger skid */}
      <group name="BharatiHeatRecoverySkid" position={[4.5, 0, 3]}>
        {[
          [-1.7, -1],
          [1.7, -1],
          [-1.7, 1],
          [1.7, 1],
        ].map(([px, pz], i) => (
          <mesh key={i} position={[px, 0.9, pz]}>
            <boxGeometry args={[0.14, 1.8, 0.14]} />
            <SteelDark />
          </mesh>
        ))}
        <mesh position={[0, 1.85, 0]}>
          <boxGeometry args={[3.6, 0.14, 2.2]} />
          <SteelDark />
        </mesh>
        {[-0.55, 0.55].map((pz) => (
          <mesh key={pz} position={[0, 1.3, pz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.34, 0.34, 3.1, 12]} />
            <SteelGalvanized />
          </mesh>
        ))}
      </group>

      {/* Communications tower */}
      <group name="BharatiCommsMast" position={[10, 0, -6]}>
        {[1.05, 0.72, 0.42].map((hw, i) => {
          const yBase = i * 4.34
          return (
            <group key={i} position={[0, yBase, 0]}>
              {[
                [-hw, -hw],
                [hw, -hw],
                [-hw, hw],
                [hw, hw],
              ].map(([px, pz], j) => (
                <mesh key={j} position={[px, 2.17, pz]}>
                  <boxGeometry args={[0.13, 4.34, 0.13]} />
                  <SteelGalvanized />
                </mesh>
              ))}
              <mesh position={[0, 4.3, 0]}>
                <boxGeometry args={[hw * 2 + 0.13, 0.1, hw * 2 + 0.13]} />
                <SteelDark />
              </mesh>
            </group>
          )
        })}
        {/* Microwave dishes */}
        {[
          [5.2, 0.6],
          [8.6, -0.4],
        ].map(([hy, ry], i) => (
          <mesh key={i} position={[0, hy, 0.55]} rotation={[-0.5, ry, 0]}>
            <sphereGeometry args={[1.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
            <PanelWhite />
          </mesh>
        ))}
        {/* Aviation light */}
        <mesh position={[0, 13.25, 0]}>
          <sphereGeometry args={[0.16, 8, 8]} />
          <AccentOrange />
        </mesh>
      </group>

      {/* Radome on equipment cabinet */}
      <group name="BharatiRadome" position={[2, 0, -8]}>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[1.8, 1.8, 1.8]} />
          <PanelLightGray />
        </mesh>
        <mesh position={[0, 3.1, 0]}>
          <sphereGeometry args={[2.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <PanelWhite />
        </mesh>
      </group>

      {/* Weather station mast */}
      <group name="BharatiWeatherStation" position={[-8.5, 0, 5]}>
        <mesh position={[0, 2.5, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 5, 6]} />
          <SteelGalvanized />
        </mesh>
        {[3.2, 3.9, 4.6].map((hy) => (
          <mesh key={hy} position={[0.32, hy, 0]}>
            <sphereGeometry args={[0.11, 8, 8]} />
            <PanelWhite />
          </mesh>
        ))}
        <mesh position={[-0.4, 4.9, 0]}>
          <boxGeometry args={[0.55, 0.09, 0.16]} />
          <PanelDarkTrim />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.8, 0.3, 0.8]} />
          <Concrete />
        </mesh>
      </group>

      {/* Cargo sleds */}
      {[
        [12, 0, 2.5, 0.2],
        [13.6, 0, 5.2, -0.15],
      ].map(([sx, , sz, sr], i) => (
        <group key={i} name={`BharatiCargoSled0${i + 1}`} position={[sx, 0, sz]} rotation={[0, sr, 0]}>
          {[-0.6, 0.6].map((rz) => (
            <mesh key={rz} position={[0, 0.18, rz]}>
              <boxGeometry args={[4.2, 0.22, 0.24]} />
              <SteelDark />
            </mesh>
          ))}
          <mesh position={[0, 0.95, 0]}>
            <boxGeometry args={[3.8, 1.5, 1.7]} />
            <AccentOrange />
          </mesh>
        </group>
      ))}
    </StationGroup>
  )
}
