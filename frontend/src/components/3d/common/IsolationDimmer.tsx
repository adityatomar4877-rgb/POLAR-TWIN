import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { STATION_SYSTEMS } from '../../../lib/3d/stationSystems'
import { useStationStore } from '../../../lib/3d/stationStore'

const DIM_OPACITY = 0.22
const FADE_RATE = 7

interface DimEntry {
  material: THREE.MeshStandardMaterial
  target: number
}

/**
 * Isolation focus: while a facility is selected, every other station system
 * fades to a subdued opacity so the inspected structure reads clearly.
 * Materials are per-mesh instances (see materials.tsx), so fading one system
 * never bleeds into another. Terrain and sky are untouched.
 */
export function IsolationDimmer() {
  const selectedSystemId = useStationStore((s) => s.selectedSystemId)
  const scene = useThree((state) => state.scene)
  const entries = useRef<DimEntry[]>([])

  useEffect(() => {
    const next: DimEntry[] = []
    for (const system of STATION_SYSTEMS) {
      const root = scene.getObjectByName(system.id)
      if (!root) continue
      const active = selectedSystemId === null || system.id === selectedSystemId
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (!mesh.isMesh) return
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const raw of mats) {
          const mat = raw as THREE.MeshStandardMaterial
          if (!mat || !('isMeshStandardMaterial' in mat)) continue
          if (!mat.transparent && mat.opacity === 1) mat.transparent = true
          next.push({ material: mat, target: active ? 1 : DIM_OPACITY })
        }
      })
    }
    entries.current = next
  }, [selectedSystemId, scene])

  useFrame((_, delta) => {
    const list = entries.current
    if (list.length === 0) return
    const k = 1 - Math.exp(-FADE_RATE * delta)
    let settled = true
    for (const entry of list) {
      const { material, target } = entry
      if (Math.abs(material.opacity - target) > 0.004) {
        material.opacity += (target - material.opacity) * k
        settled = false
      } else if (material.opacity !== target) {
        material.opacity = target
      }
      // Fully restore blending state once back at full strength.
      if (target === 1 && material.opacity === 1 && material.transparent) {
        material.transparent = false
        material.needsUpdate = true
      }
    }
    if (settled && selectedSystemId === null) entries.current = []
  })

  return null
}
