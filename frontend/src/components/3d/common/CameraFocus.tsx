import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { terrainHeight } from '../../../lib/3d/stationLayout'
import { maitriTerrainHeight } from '../../../lib/3d/maitriLayout'
import { getStationSystem } from '../../../lib/3d/stationSystems'
import { useStationStore } from '../../../lib/3d/stationStore'
import { measureSystemBounds } from '../../../lib/3d/systemBounds'

interface ControlLike {
  target: THREE.Vector3
  update: () => void
}

/** Default campus overview framing for Bharati and Maitri. */
export const DEFAULT_CAMERA_POSITION = new THREE.Vector3(108, 64, 132)
export const MAITRI_DEFAULT_CAMERA_POSITION = new THREE.Vector3(110, 30, 130)
export const DEFAULT_TARGET = new THREE.Vector3(0, 7, 0)

const FOV_RAD = (45 * Math.PI) / 180
/** Extra margin so structures never touch the viewport edge. */
const FRAMING_PADDING = 1.22
const MIN_DISTANCE = 30
const MAX_DISTANCE = 175
/** Exponential damping rate for the cinematic glide. */
const GLIDE_RATE = 3.4
const SNAP_EPSILON = 0.06
/** Kept elevation band on the approach direction = polar-angle safety. */
const MIN_ELEVATION = 0.26
const MAX_ELEVATION = 0.74

interface GlideGoal {
  pos: THREE.Vector3
  target: THREE.Vector3
}

/**
 * Cinematic inspection camera:
 * - glides both orbit target AND position to frame the selected facility,
 *   with distance derived from the structure's bounding sphere so large
 *   buildings and small pump houses are framed at appropriate zoom levels
 * - glides home to the default overview when the selection clears
 * - preserves the user's heading; clamps the approach elevation so the
 *   camera never dives below the polar limits or clips into terrain
 */
export function CameraFocus() {
  const selectedSystemId = useStationStore((s) => s.selectedSystemId)
  const activeStation = useStationStore((s) => s.activeStation)
  const controls = useThree((state) => state.controls) as unknown as ControlLike | null
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const glide = useRef<GlideGoal | null>(null)
  const hasFramed = useRef(false)

  useEffect(() => {
    const defaultPos = activeStation === 'maitri' ? MAITRI_DEFAULT_CAMERA_POSITION : DEFAULT_CAMERA_POSITION
    if (!selectedSystemId) {
      if (hasFramed.current) {
        glide.current = { pos: defaultPos.clone(), target: DEFAULT_TARGET.clone() }
        hasFramed.current = false
      }
      return
    }

    const system = getStationSystem(selectedSystemId)
    if (!system) return

    const heightFn = activeStation === 'maitri' ? maitriTerrainHeight : terrainHeight
    let center: THREE.Vector3
    let radius: number
    const bounds = measureSystemBounds(scene, selectedSystemId)
    if (bounds) {
      center = bounds.center
      radius = Math.max(bounds.radius, 8)
    } else {
      const { x, z } = system.anchor
      center = new THREE.Vector3(x, heightFn(x, z) + 5, z)
      radius = 16
    }

    // Keep the user's current viewing heading, softened into a pleasing band.
    const dir = camera.position.clone().sub(controls ? controls.target : DEFAULT_TARGET)
    if (dir.lengthSq() < 1e-4) dir.set(0.62, 0.5, 0.6)
    dir.normalize()
    dir.y = THREE.MathUtils.clamp(dir.y, MIN_ELEVATION, MAX_ELEVATION)
    dir.normalize()

    const halfFov = FOV_RAD / 2
    const distance = THREE.MathUtils.clamp(
      (radius / Math.sin(halfFov)) * FRAMING_PADDING,
      MIN_DISTANCE,
      MAX_DISTANCE,
    )
    const pos = center.clone().add(dir.multiplyScalar(distance))
    pos.y = Math.max(pos.y, heightFn(pos.x, pos.z) + 3.5, 2.4)

    glide.current = { pos, target: center.clone() }
    hasFramed.current = true
  }, [selectedSystemId, activeStation, scene, camera, controls])

  useFrame((_, delta) => {
    const goal = glide.current
    if (!goal || !controls) return
    const k = 1 - Math.exp(-GLIDE_RATE * delta)
    camera.position.lerp(goal.pos, k)
    controls.target.lerp(goal.target, k)
    controls.update()
    if (
      camera.position.distanceTo(goal.pos) < SNAP_EPSILON &&
      controls.target.distanceTo(goal.target) < SNAP_EPSILON
    ) {
      camera.position.copy(goal.pos)
      controls.target.copy(goal.target)
      controls.update()
      glide.current = null
    }
  })

  return null
}
