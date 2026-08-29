import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import { useStationStore } from '../../../lib/3d/stationStore'
import { getStationSystem } from '../../../lib/3d/stationSystems'

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
/** How far the facility lifts on hover (world units). */
const LIFT_AMOUNT = 2
/** Exponential damping rate for the lift / settle animation. */
const LIFT_RATE = 7

/** Truncate a string to ~90 chars with ellipsis for the tooltip subtitle. */
function shortInfo(text: string): string {
  if (text.length <= 90) return text
  return text.slice(0, 87).trimEnd() + '…'
}

/**
 * Named wrapper for every major station system.
 * - keeps each system a separate group in the scene graph
 * - tags userData.stationId for telemetry binding
 * - enables shadows on all child meshes
 * - hover lifts the facility gently + shows a floating popup tooltip
 * - hover + click states are driven by the shared station store so the 3D
 *   scene and the dashboard rail stay in bidirectional sync
 */
export function StationGroup({ id, label, position = [0, 0, 0], rotation, children }: StationGroupProps) {
  const ref = useRef<THREE.Group>(null)
  const liftRef = useRef<THREE.Group>(null)
  const hoveredSystemId = useStationStore((s) => s.hoveredSystemId)
  const selectedSystemId = useStationStore((s) => s.selectedSystemId)
  const setHovered = useStationStore((s) => s.setHovered)
  const selectSystem = useStationStore((s) => s.selectSystem)
  const clearSelection = useStationStore((s) => s.clearSelection)
  const hovered = hoveredSystemId === id
  const selected = selectedSystemId === id

  const system = getStationSystem(id)
  const displayLabel = label ?? system?.label ?? id
  const info = system ? shortInfo(system.summary) : ''

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

  // Smooth lift / settle animation. The inner group floats up while hovered
  // and eases back to its rest position when the pointer leaves.
  useFrame((_, delta) => {
    const lift = liftRef.current
    if (!lift) return
    const target = hovered ? LIFT_AMOUNT : 0
    const k = 1 - Math.exp(-LIFT_RATE * delta)
    lift.position.y += (target - lift.position.y) * k
  })

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(id)
  }

  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
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
      userData={{ stationId: id, label: displayLabel }}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
    >
      <group ref={liftRef}>
        {children}
        {/* Floating popup tooltip — name + short info, animates in/out on hover */}
        <Html
          position={[0, 9, 0]}
          center
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          zIndexRange={[100, 0]}
        >
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.88 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.92 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="flex max-w-[220px] flex-col gap-0.5 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur-md"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
                  {displayLabel}
                </span>
                {system && (
                  <span className="text-[8px] font-bold uppercase tracking-widest text-cyan-600">
                    {system.category}
                  </span>
                )}
                {info && (
                  <span className="text-[10px] leading-snug text-slate-500">
                    {info}
                  </span>
                )}
                <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-300">
                  Click to inspect ↗
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Html>
      </group>
    </group>
  )
}
