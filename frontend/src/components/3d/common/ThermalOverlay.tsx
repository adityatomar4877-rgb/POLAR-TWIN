import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { STATION_SYSTEMS } from '../../../lib/3d/stationSystems'
import { useStationStore } from '../../../lib/3d/stationStore'

interface SavedMaterial {
  color: THREE.Color
  emissive: THREE.Color
  emissiveIntensity: number
}

interface TintTarget {
  material: THREE.MeshStandardMaterial
  color: THREE.Color
  emissive: THREE.Color
  emissiveIntensity: number
}

/** False-colour palette per thermal signature class. */
const HEAT = {
  exhaust: { color: '#ef4444', emissive: '#ef4444', intensity: 0.5 },
  hot: { color: '#f59e0b', emissive: '#f59e0b', intensity: 0.42 },
  warmGlass: { color: '#fbbf24', emissive: '#fbbf24', intensity: 0.55 },
  occupied: { color: '#22d3ee', emissive: '#000000', intensity: 0 },
  mild: { color: '#4ade80', emissive: '#000000', intensity: 0 },
  cold: { color: '#312e81', emissive: '#000000', intensity: 0 },
  hull: { color: '#4c1d95', emissive: '#000000', intensity: 0 },
  frozen: { color: '#1e3a8a', emissive: '#000000', intensity: 0 },
} as const

/** Thermal colour per system (fallback for unclassified meshes). */
const SYSTEM_THERMAL: Record<string, { color: string; emissive: string; intensity: number }> = {
  BharatiMainBuilding: HEAT.occupied,
  BharatiSummerCamp: HEAT.mild,
  BharatiUtilityArea: HEAT.exhaust,
  BharatiFuelFarm: HEAT.frozen,
  BharatiFuelStation: HEAT.frozen,
  BharatiWaterPump: HEAT.cold,
  BharatiContainerModules: HEAT.hull,
  MaitriMainBuilding: HEAT.warmGlass, // Default to leaky walls
  MaitriSummerCamp: HEAT.occupied,
  MaitriUtilityArea: HEAT.exhaust,
  MaitriFuelFarm: HEAT.frozen,
  MaitriFuelStation: HEAT.frozen,
  MaitriLakeWaterPumpHouse: HEAT.cold,
}

/** Sub-structure overrides, matched by named ancestor group. */
const GROUP_THERMAL: Record<string, { color: string; emissive: string; intensity: number }> = {
  BharatiSupportStructure: HEAT.cold,
  BharatiRoof: HEAT.hot,
  BharatiMainBody: HEAT.occupied,
  BharatiMainEntrance: HEAT.mild,
  BharatiFlagpole: HEAT.hull,
  MaitriHull: HEAT.warmGlass, // Poorly insulated 1980s panels
  MaitriRoof: HEAT.hot,       // Significant heat loss through the roof
  MaitriStilts: HEAT.cold,
}

/** Terrain-family thermal tint (multiplies vertex colours down to indigo). */
const TERRAIN_TINT = new THREE.Color('#3c4560')
const SEAICE_TINT = new THREE.Color('#1b2440')

function resolveTarget(material: THREE.MeshStandardMaterial, obj: THREE.Object3D, systemId: string) {
  // Glazing leaks interior heat — warm signature.
  const hex = material.color.getHexString()
  if (hex === '1a242f' || hex === '1a1d21') {
    return { color: new THREE.Color(HEAT.warmGlass.color), emissive: new THREE.Color(HEAT.warmGlass.emissive), emissiveIntensity: HEAT.warmGlass.intensity }
  }
  let node: THREE.Object3D | null = obj
  while (node) {
    const rule = node.name ? GROUP_THERMAL[node.name] : undefined
    if (rule) break
    node = node.parent
  }
  const rule = node?.name ? GROUP_THERMAL[node.name] : SYSTEM_THERMAL[systemId] ?? HEAT.cold
  return {
    color: new THREE.Color(rule.color),
    emissive: new THREE.Color(rule.emissive),
    emissiveIntensity: rule.intensity,
  }
}

function colorClose(a: THREE.Color, b: THREE.Color): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 0.004
}

/**
 * Thermal / infrared inspection mode: drops the environment to cold indigo
 * and re-colours every structure by its false-colour heat signature
 * (generators hot red, habitats cyan-green, cold hulls purple-blue).
 * All transitions are per-frame lerps; originals are restored on exit.
 */
export function ThermalOverlay() {
  const visualMode = useStationStore((s) => s.visualMode)
  const activeStation = useStationStore((s) => s.activeStation)
  const scene = useThree((state) => state.scene)
  const saved = useRef(new Map<THREE.MeshStandardMaterial, SavedMaterial>())
  const targets = useRef<TintTarget[]>([])
  const active = useRef(false)

  useEffect(() => {
    if (visualMode === 'thermal' && !active.current) {
      // Enter: snapshot originals and compute thermal targets.
      active.current = true
      const next: TintTarget[] = []
      const visit = (root: THREE.Object3D, systemId: string, tint?: THREE.Color) => {
        root.traverse((obj) => {
          const mesh = obj as THREE.Mesh
          if (!mesh.isMesh) return
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const raw of mats) {
            const mat = raw as THREE.MeshStandardMaterial
            if (!mat || !('isMeshStandardMaterial' in mat)) continue
            if (!saved.current.has(mat)) {
              saved.current.set(mat, {
                color: mat.color.clone(),
                emissive: mat.emissive.clone(),
                emissiveIntensity: mat.emissiveIntensity,
              })
            }
            const t = tint
              ? { color: tint.clone(), emissive: new THREE.Color('#000000'), emissiveIntensity: 0 }
              : resolveTarget(mat, mesh, systemId)
            next.push({ material: mat, ...t })
          }
        })
      }

      const terrainName = activeStation === 'bharati' ? 'BharatiTerrain' : 'MaitriTerrain'
      const terrain = scene.getObjectByName(terrainName)
      if (terrain) {
        visit(terrain, 'terrain', TERRAIN_TINT)
        const seaIce = scene.getObjectByName('BharatiSeaIce')
        if (seaIce) visit(seaIce, 'seaice', SEAICE_TINT)
      }
      for (const system of STATION_SYSTEMS) {
        const root = scene.getObjectByName(system.id)
        if (root) visit(root, system.id)
      }
      targets.current = next
    } else if (visualMode !== 'thermal' && active.current) {
      // Exit: tween everything back to the snapshot.
      active.current = false
      targets.current = [...saved.current.entries()].map(([material, s]) => ({
        material,
        color: s.color.clone(),
        emissive: s.emissive.clone(),
        emissiveIntensity: s.emissiveIntensity,
      }))
    }
  }, [visualMode, scene])

  useFrame((_, delta) => {
    const list = targets.current
    if (list.length === 0) return
    const k = 1 - Math.exp(-4.2 * delta)
    let settled = true
    for (const t of list) {
      const { material } = t
      if (!colorClose(material.color, t.color)) {
        material.color.lerp(t.color, k)
        settled = false
      } else material.color.copy(t.color)
      if (!colorClose(material.emissive, t.emissive)) {
        material.emissive.lerp(t.emissive, k)
        settled = false
      } else material.emissive.copy(t.emissive)
      if (Math.abs(material.emissiveIntensity - t.emissiveIntensity) > 0.004) {
        material.emissiveIntensity += (t.emissiveIntensity - material.emissiveIntensity) * k
        settled = false
      } else material.emissiveIntensity = t.emissiveIntensity
    }
    if (settled && !active.current) {
      targets.current = []
      saved.current.clear()
    }
  })

  return null
}
