import { StationGroup } from '../common/StationGroup'
import { AccentOrange, Concrete, GlassDark, PanelDarkTrim, PanelWhite, SteelDark, SteelGalvanized } from '../common/materials'
import { FACILITIES, terrainHeight } from '../../../lib/3d/stationLayout'

interface CabinProps {
  position: [number, number, number]
  rotation: number
  index: number
  antenna?: boolean
}

function CampCabin({ position, rotation, index, antenna = false }: CabinProps) {
  return (
    <group name={`BharatiSummerCabin0${index}`} position={position} rotation={[0, rotation, 0]}>
      {/* Legs */}
      {[
        [-3.1, -1.2],
        [3.1, -1.2],
        [-3.1, 1.2],
        [3.1, 1.2],
      ].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.45, lz]}>
          <boxGeometry args={[0.25, 0.9, 0.25]} />
          <SteelDark />
        </mesh>
      ))}
      {/* Body */}
      <mesh position={[0, 2.4, 0]}>
        <boxGeometry args={[7.4, 3, 3.3]} />
        <PanelWhite />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 4.05, 0]}>
        <boxGeometry args={[7.8, 0.25, 3.7]} />
        <PanelDarkTrim />
      </mesh>
      {/* Front windows */}
      {[-2.2, -0.7, 2.2].map((wx) => (
        <mesh key={wx} position={[wx, 2.6, 1.68]}>
          <boxGeometry args={[0.9, 1.1, 0.08]} />
          <GlassDark />
        </mesh>
      ))}
      {/* End door */}
      <mesh position={[3.73, 2.15, 0]}>
        <boxGeometry args={[0.08, 1.9, 0.95]} />
        <GlassDark />
      </mesh>
      <mesh position={[3.74, 3.25, 0]}>
        <boxGeometry args={[0.1, 0.18, 1.15]} />
        <AccentOrange />
      </mesh>
      {/* Entry step */}
      <mesh position={[4.15, 0.45, 0]}>
        <boxGeometry args={[1.1, 0.5, 1.3]} />
        <Concrete />
      </mesh>
      {antenna && (
        <mesh position={[-2.8, 5.1, -1]}>
          <cylinderGeometry args={[0.04, 0.04, 2, 6]} />
          <SteelGalvanized />
        </mesh>
      )}
    </group>
  )
}

/** Summer/camp accommodation modules for expedition personnel. */
export function BharatiSummerCamp() {
  const { x, z } = FACILITIES.summerCamp
  return (
    <StationGroup id="BharatiSummerCamp" label="Summer Camp" position={[x, terrainHeight(x, z), z]}>
      <CampCabin index={1} position={[-8, 0, 4]} rotation={0.55} />
      <CampCabin index={2} position={[-2.5, 0, -3.5]} rotation={0.15} />
      <CampCabin index={3} position={[4.5, 0, -4.5]} rotation={-0.12} antenna />
      <CampCabin index={4} position={[11, 0, 2.5]} rotation={-0.5} />

      {/* Common / mess module: low arched shelter */}
      <group name="BharatiCampCommonModule" position={[1.5, 0, 4.5]} rotation={[0, 0.35, 0]}>
        <mesh position={[0, 0.9, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1.6, 1.6, 5, 14, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#c26a2b" roughness={0.65} metalness={0.15} side={2 /* DoubleSide */} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[5.2, 0.12, 3.3]} />
          <Concrete />
        </mesh>
        <mesh position={[2.53, 0.85, 0]}>
          <boxGeometry args={[0.06, 1.7, 0.9]} />
          <GlassDark />
        </mesh>
      </group>
    </StationGroup>
  )
}
