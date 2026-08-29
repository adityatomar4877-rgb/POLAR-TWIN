import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useStationStore } from '../../../lib/3d/stationStore'

const COUNT = 1600
const BOUNDS = { x: 280, y: 64, z: 280 }
const CENTER_Y = 26

/**
 * High-speed drifting snow for blizzard / whiteout conditions.
 * A single Points cloud with per-flake wind velocity, wrapped around the
 * campus volume; fades in/out with the weather preset.
 */
export function BlizzardParticles() {
  const weather = useStationStore((s) => s.weather)
  const pointsRef = useRef<THREE.Points>(null)
  const opacity = useRef(0)

  const { geometry, material, velocities } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const vels = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * BOUNDS.x
      positions[i * 3 + 1] = CENTER_Y + (Math.random() - 0.5) * BOUNDS.y
      positions[i * 3 + 2] = (Math.random() - 0.5) * BOUNDS.z
      vels[i * 3] = 15 + Math.random() * 11 // katabatic wind along +X
      vels[i * 3 + 1] = -1.2 - Math.random() * 2.6
      vels[i * 3 + 2] = -3 + Math.random() * 6
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    return { geometry: geo, material: mat, velocities: vels }
  }, [])

  useFrame((_, delta) => {
    const target = weather === 'blizzard' ? 0.85 : 0
    // Asymmetric fade so the storm rolls in fast, clears gently.
    const k = 1 - Math.exp((target > opacity.current ? -6 : -1.6) * delta)
    opacity.current += (target - opacity.current) * k
    material.opacity = opacity.current

    const points = pointsRef.current
    if (!points) return
    points.visible = opacity.current > 0.015
    if (!points.visible) return

    const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const dt = Math.min(delta, 0.05)
    const drift = Math.sin(performance.now() * 0.0006) * 2.4
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3
      arr[ix] += (velocities[ix] + drift) * dt
      arr[ix + 1] += velocities[ix + 1] * dt
      arr[ix + 2] += velocities[ix + 2] * dt
      if (arr[ix] > BOUNDS.x / 2) arr[ix] -= BOUNDS.x
      if (arr[ix + 1] < CENTER_Y - BOUNDS.y / 2) arr[ix + 1] += BOUNDS.y
      if (arr[ix + 2] > BOUNDS.z / 2) arr[ix + 2] -= BOUNDS.z
      else if (arr[ix + 2] < -BOUNDS.z / 2) arr[ix + 2] += BOUNDS.z
    }
    attr.needsUpdate = true
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}
