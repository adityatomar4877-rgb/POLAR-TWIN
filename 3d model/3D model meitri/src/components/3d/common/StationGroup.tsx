import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useStationStore } from '../../../lib/stationStore'

interface StationGroupProps {
  /** Stable programmatic id, e.g. "BharatiMainBuilding". Telemetry binds via this id. */
  id: string
  label?: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  children: ReactNode
}

const HIGHLIGHT_COLOR = '#3d6a94'
const HOVER_INTENSITY = 0.35
const SELECTED_INTENSITY = 0.6

/**
 * Named wrapper for every major station system.
 * - keeps each system a separate group in the scene graph
 * - tags userData.stationId for telemetry binding
 * - enables shadows on all child meshes
 * - hover + click states are driven by the shared station store so the 3D
 *   scene and the dashboard rail stay in bidirectional sync (Phase 3)
 */
export function StationGroup({ id, label, position = [0, 0, 0], rotation, children }: StationGroupProps) {
  const ref = useRef<THREE.Group>(null)
  const hoveredSystemId = useStationStore((s) => s.hoveredSystemId)
  const selectedSystemId = useStationStore((s) => s.selectedSystemId)
  const setHovered = useStationStore((s) => s.setHovered)
  const selectSystem = useStationStore((s) => s.selectSystem)
  const clearSelection = useStationStore((s) => s.clearSelection)
  const hovered = hoveredSystemId === id
  const selected = selectedSystemId === id

  useEffect(() => {
    const g = ref.current
    if (!g) return
    g.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
  }, [])

  useEffect(() => {
    const g = ref.current
    if (!g) return
    const intensity = selected ? SELECTED_INTENSITY : hovered ? HOVER_INTENSITY : 0
    g.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial
          if (std && std.emissive) {
            std.emissive.set(HIGHLIGHT_COLOR)
            std.emissiveIntensity = intensity
          }
        }
      }
    })
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [hovered, selected])

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(id)
  }

  const handleOut = () => {
    setHovered(null)
  }

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (selected) clearSelection()
    else selectSystem(id)
  }

  return (
    <group
      ref={ref}
      name={id}
      position={position}
      rotation={rotation}
      userData={{ stationId: id, label: label ?? id }}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
    >
      {children}
    </group>
  )
}
