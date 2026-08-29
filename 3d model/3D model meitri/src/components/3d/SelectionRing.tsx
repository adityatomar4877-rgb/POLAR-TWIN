import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { terrainHeight } from '../../lib/stationLayout'
import { maitriTerrainHeight } from '../../lib/maitriLayout'
import { getStationSystem } from '../../lib/stationSystems'
import { useStationStore } from '../../lib/stationStore'
import { measureSystemBounds } from '../../lib/systemBounds'

interface RingParams {
  x: number
  y: number
  z: number
  r: number
}

function SelectionRingMesh({ x, y, z, r }: RingParams) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.getElapsedTime()
    mesh.scale.setScalar(1 + Math.sin(t * 2.3) * 0.022)
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.opacity = 0.78 + Math.sin(t * 2.3) * 0.12
  })

  return (
    <mesh ref={ref} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
      <torusGeometry args={[r, Math.max(0.28, r * 0.016), 8, 96]} />
      <meshBasicMaterial color="#ff7a2e" transparent opacity={0.85} depthWrite={false} />
    </mesh>
  )
}

/** Pulsing accent ring on the ground around the selected facility footprint. */
export function SelectionRing() {
  const selectedSystemId = useStationStore((s) => s.selectedSystemId)
  const activeStation = useStationStore((s) => s.activeStation)
  const scene = useThree((state) => state.scene)
  const [params, setParams] = useState<RingParams | null>(null)

  useEffect(() => {
    if (!selectedSystemId) {
      setParams(null)
      return
    }
    const system = getStationSystem(selectedSystemId)
    if (!system) {
      setParams(null)
      return
    }
    const bounds = measureSystemBounds(scene, selectedSystemId)
    const r = bounds ? Math.max(bounds.radius * 1.12, 10) : 18
    const heightFn = activeStation === 'maitri' ? maitriTerrainHeight : terrainHeight
    setParams({
      x: system.anchor.x,
      z: system.anchor.z,
      y: heightFn(system.anchor.x, system.anchor.z) + 0.35,
      r,
    })
  }, [selectedSystemId, activeStation, scene])

  if (!params || !selectedSystemId) return null
  // Keyed by id so the geometry rebuilds when the footprint changes.
  return <SelectionRingMesh key={selectedSystemId} {...params} />
}
