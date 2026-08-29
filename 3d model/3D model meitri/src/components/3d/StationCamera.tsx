import { useEffect, useRef } from 'react'
import type { ComponentRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStationStore } from '../../lib/stationStore'

/**
 * Professional 3D inspection camera:
 * - orbit / zoom / pan with damping
 * - sensible zoom limits
 * - camera and orbit target are kept above the terrain
 * - manual interaction while inspecting flips the store to 'free' view mode
 */
export function StationCamera() {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const { camera } = useThree()

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const onUserStart = () => {
      const { selectedSystemId, viewMode, setViewMode } = useStationStore.getState()
      if (selectedSystemId && viewMode === 'inspect') setViewMode('free')
    }
    controls.addEventListener('start', onUserStart)
    return () => controls.removeEventListener('start', onUserStart)
  }, [])

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return
    const t = controls.target as THREE.Vector3
    t.y = Math.max(t.y, 0.6)
    t.x = THREE.MathUtils.clamp(t.x, -240, 240)
    t.z = THREE.MathUtils.clamp(t.z, -240, 240)
    if (camera.position.y < 2.2) {
      camera.position.y = 2.2
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, 7, 0]}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      panSpeed={0.7}
      zoomSpeed={0.9}
      minDistance={22}
      maxDistance={430}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI * 0.49}
    />
  )
}
