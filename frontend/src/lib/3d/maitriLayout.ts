import { fbm, lerp, smoothstep } from './noise'

// Maitri is located at Schirmacher Oasis
// Coordinates: 70°45'52" S 11°44'03" E

export const MAITRI_SUN_POSITION: [number, number, number] = [140, 60, 80] // Different angle for distinct lighting

export const MAITRI_FACILITIES = {
  mainBuilding: { x: 0, z: 0 },
  fuelFarm: { x: -40, z: 20 },
  fuelStation: { x: -25, z: 15 },
  waterPumpHouse: { x: -80, z: -40 }, // Moved to NW lake edge
  summerCamp: { x: 35, z: 25 },
  utilityArea: { x: -10, z: -40 },
} as const

interface Pad {
  x: number
  z: number
  r: number
  h: number
}

// Maitri is on rocky terrain. We'll make it bumpier and higher variance than Bharati.
export const MAITRI_PADS: Pad[] = [
  { ...MAITRI_FACILITIES.mainBuilding, r: 60, h: 2.0 },
  { ...MAITRI_FACILITIES.fuelFarm, r: 25, h: 1.5 },
  { ...MAITRI_FACILITIES.fuelStation, r: 12, h: 1.8 },
  { ...MAITRI_FACILITIES.waterPumpHouse, r: 15, h: -2.5 }, // Down towards the lake
  { ...MAITRI_FACILITIES.summerCamp, r: 35, h: 2.5 },
  { ...MAITRI_FACILITIES.utilityArea, r: 20, h: 1.5 },
]

function maitriBaseHeight(x: number, z: number): number {
  // Rough, rocky Schirmacher Oasis terrain
  let h = (fbm(x * 0.015 + 3.1, z * 0.015 - 8.4, 5) - 0.5) * 22
  h += (fbm(x * 0.04 - 1.1, z * 0.04 + 7.3, 4) - 0.5) * 6.5
  // Carve realistic organic basin for Lake Priyadarshini (Northwest)
  const lx = x + 95
  const lz = z + 60
  const noiseOffset = (fbm(x * 0.03 + 2.1, z * 0.03 - 4.5, 3) - 0.5) * 16
  const lakeDist = Math.hypot(lx * 0.85, lz * 1.15) + noiseOffset
  
  // Basin depression: deepest in the center, smoothly rising up to the natural shoreline
  const basinDepth = (1.0 - smoothstep(10, 65, lakeDist)) * 11
  h -= basinDepth

  // Natural surrounding shore embankment
  const shoreRim = (1.0 - smoothstep(45, 80, Math.abs(lakeDist - 65))) * 3.0
  h += shoreRim
  
  // Surrounding rocky ridges
  const d = Math.hypot(x, z)
  h += smoothstep(120, 300, d) * 25
  return h
}

export function maitriTerrainHeight(x: number, z: number): number {
  const d = Math.hypot(x, z)
  const campusBlend = smoothstep(50, 120, d)
  let h = lerp(MAITRI_PADS[0].h, maitriBaseHeight(x, z), campusBlend)
  for (let i = 1; i < MAITRI_PADS.length; i++) {
    const p = MAITRI_PADS[i]
    const dp = Math.hypot(x - p.x, z - p.z)
    const w = 1 - smoothstep(p.r * 0.4, p.r, dp)
    if (w > 0) h = lerp(h, p.h, w)
  }
  return h
}
