// Single source of truth for the Bharati station campus layout:
// facility anchor positions, terrain height field and access path routes.
// Every structure samples terrainHeight() at its own anchor so all
// buildings sit correctly on the ground.
//
// NOTE ON DIMENSIONS: the main building's ~30 m x 50 m footprint follows
// publicly documented figures for Bharati. All other dimensions are
// visually plausible approximations, not surveyed engineering values.

import { fbm, lerp, smoothstep } from './noise'

/** Low polar sun (southern-hemisphere summer afternoon feel). */
export const SUN_POSITION: [number, number, number] = [120, 88, 95]

export const FACILITIES = {
  mainBuilding: { x: 0, z: 0 },
  fuelFarm: { x: -52, z: -6 },
  fuelStation: { x: -32, z: 9 },
  waterPump: { x: -60, z: 28 },
  summerCamp: { x: 57, z: 13 },
  containers: { x: 0, z: -30 },
  utility: { x: 39, z: -35 },
} as const

interface Pad {
  x: number
  z: number
  r: number
  h: number
}

/** Locally flattened pads under each facility cluster. */
export const PADS: Pad[] = [
  { ...FACILITIES.mainBuilding, r: 54, h: 1.2 },
  { ...FACILITIES.fuelFarm, r: 21, h: 1.35 },
  { ...FACILITIES.fuelStation, r: 11, h: 1.25 },
  { ...FACILITIES.waterPump, r: 14, h: 0.9 },
  { ...FACILITIES.summerCamp, r: 22, h: 1.55 },
  { ...FACILITIES.containers, r: 27, h: 1.2 },
  { ...FACILITIES.utility, r: 19, h: 1.3 },
]

function baseHeight(x: number, z: number): number {
  // Rolling rocky terrain, a few metres of relief.
  let h = (fbm(x * 0.008 + 11.3, z * 0.008 - 4.7, 4) - 0.5) * 16
  h += (fbm(x * 0.03 - 7.1, z * 0.03 + 2.3, 3) - 0.5) * 3.2
  // Coastal dip toward the west (sea ice sits beyond the shoreline).
  h -= smoothstep(-150, -250, x) * 5
  // Gentle rim hills near the far edges of the map.
  const d = Math.hypot(x, z)
  h += smoothstep(190, 255, d) * 12
  return h
}

/**
 * World terrain height at (x, z). The station campus blends into a nearly
 * flat bench; outlying pads are individually levelled; beyond them the
 * terrain becomes rolling rock and snow.
 */
export function terrainHeight(x: number, z: number): number {
  const d = Math.hypot(x, z)
  const campusBlend = smoothstep(70, 150, d)
  let h = lerp(PADS[0].h, baseHeight(x, z), campusBlend)
  for (let i = 1; i < PADS.length; i++) {
    const p = PADS[i]
    const dp = Math.hypot(x - p.x, z - p.z)
    const w = 1 - smoothstep(p.r * 0.55, p.r, dp)
    if (w > 0) h = lerp(h, p.h, w)
  }
  return h
}

/** Access routes between major structures (world XZ polylines). */
export const PATHS: [number, number][][] = [
  // Main entrance -> fuel station
  [[3, 12], [-12, 14], [-30, 13]],
  // Fuel station -> fuel farm
  [[-30, 13], [-44, 3], [-49, -3]],
  // Main entrance -> summer camp
  [[4, 12], [20, 16], [36, 15], [51, 14]],
  // West side -> container rows -> utility area
  [[-24, 4], [-23, -14], [-14, -27], [2, -28], [18, -29], [33, -33]],
  // Fuel station -> seawater pump house
  [[-32, 13], [-46, 20], [-57, 26]],
]
