import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { STATION_SYSTEMS } from '../../lib/stationSystems'
import { selectEffectiveStatus, useStationStore } from '../../lib/stationStore'
import { terrainHeight } from '../../lib/stationLayout'
import { maitriTerrainHeight } from '../../lib/maitriLayout'
import { measureSystemBounds } from '../../lib/systemBounds'
import type { SystemStatus } from '../../lib/stationSystems'

/** Operational colour language shared by beacons, pulses and flows. */
export const STATUS_COLOR: Record<SystemStatus, string> = {
  nominal: '#10b981',
  elevated: '#f59e0b',
  critical: '#ef4444',
  maintenance: '#64748b',
}

interface Anchor {
  id: string
  x: number
  badgeY: number
  z: number
  groundY: number
  radius: number
}

function useBeaconAnchors(): Anchor[] {
  const scene = useThree((state) => state.scene)
  const [anchors, setAnchors] = useState<Anchor[]>([])

  const activeStation = useStationStore((s) => s.activeStation)

  useEffect(() => {
    const list: Anchor[] = []
    const heightFn = activeStation === 'maitri' ? maitriTerrainHeight : terrainHeight
    for (const system of STATION_SYSTEMS) {
      if (!system.id.toLowerCase().startsWith(activeStation)) continue

      const bounds = measureSystemBounds(scene, system.id)
      const { x, z } = system.anchor
      const groundY = heightFn(x, z)
      const radius = bounds ? Math.max(bounds.radius, 9) : 16
      const badgeY = bounds ? bounds.center.y + radius * 0.55 + 5 : groundY + 18
      list.push({ id: system.id, x, badgeY, z, groundY, radius })
    }
    setAnchors(list)
  }, [scene, activeStation])

  return anchors
}

/** Expanding, fading ground ring used for warning/critical attention pulses. */
function GroundPulse({
  x,
  y,
  z,
  radius,
  color,
  rate,
  offset,
}: {
  x: number
  y: number
  z: number
  radius: number
  color: string
  rate: number
  offset: number
}) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const phase = (clock.getElapsedTime() * rate + offset) % 1
    const s = radius * (1 + phase * 1.15)
    mesh.scale.set(s, s, 1)
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.opacity = (1 - phase) * 0.5
  })
  return (
    <mesh ref={ref} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.86, 1, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** Camera-facing floating status badge above one facility. */
function StatusBadge({ anchor }: { anchor: Anchor }) {
  const status = useStationStore(selectEffectiveStatus(anchor.id))
  const group = useRef<THREE.Group>(null)
  const halo = useRef<THREE.Mesh>(null)
  const color = STATUS_COLOR[status]
  const alarmed = status === 'elevated' || status === 'critical'

  useFrame(({ camera, clock }) => {
    const g = group.current
    if (!g) return
    g.quaternion.copy(camera.quaternion)
    const t = clock.getElapsedTime()
    const rate = status === 'critical' ? 5.2 : 2.1
    const bob = Math.sin(t * 1.4 + anchor.x) * 0.18
    g.position.y = anchor.badgeY + bob
    const core = g.children[0] as THREE.Mesh
    core.scale.setScalar(1 + Math.sin(t * rate) * (status === 'critical' ? 0.09 : 0.045))
    if (halo.current) {
      const phase = (t * (status === 'critical' ? 0.9 : 0.45)) % 1
      const s = 1 + phase * 1.6
      halo.current.scale.setScalar(s)
      ;(halo.current.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.55
    }
  })

  return (
    <group ref={group} position={[anchor.x, anchor.badgeY, anchor.z]} name={`Beacon:${anchor.id}`}>
      {/* Status disc */}
      <mesh>
        <circleGeometry args={[1.15, 28]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* White rim */}
      <mesh position={[0, 0, -0.02]}>
        <ringGeometry args={[1.2, 1.5, 28]} />
        <meshBasicMaterial color="#f1f5f9" />
      </mesh>
      {/* Expanding halo for alarmed states */}
      {alarmed && (
        <mesh ref={halo}>
          <ringGeometry args={[1.55, 1.8, 28]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
        </mesh>
      )}
      {/* Maintenance tick marks */}
      {status === 'maintenance' && (
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <ringGeometry args={[0.55, 0.8, 4, 1]} />
          <meshBasicMaterial color="#e2e8f0" />
        </mesh>
      )}
      {/* Pointer spike down toward the facility */}
      <mesh position={[0, -1.7, 0]}>
        <coneGeometry args={[0.28, 0.9, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

/** Ground pulse rings under facilities in warning / critical state. */
function SystemGroundPulse({ anchor }: { anchor: Anchor }) {
  const status = useStationStore(selectEffectiveStatus(anchor.id))
  if (status !== 'elevated' && status !== 'critical') return null
  const color = STATUS_COLOR[status]
  const rate = status === 'critical' ? 0.75 : 0.4
  return (
    <group name={`GroundPulse:${anchor.id}`}>
      <GroundPulse x={anchor.x} y={anchor.groundY + 0.28} z={anchor.z} radius={anchor.radius} color={color} rate={rate} offset={0} />
      {status === 'critical' && (
        <GroundPulse x={anchor.x} y={anchor.groundY + 0.28} z={anchor.z} radius={anchor.radius} color={color} rate={rate} offset={0.5} />
      )}
    </group>
  )
}

/** Floating billboard badges + ground pulse rings for all station systems. */
export function StatusBeacons() {
  const anchors = useBeaconAnchors()
  const visualMode = useStationStore((s) => s.visualMode)
  const visible = visualMode !== 'thermal'

  if (!visible) return null

  return (
    <group name="StatusBeacons">
      {anchors.map((a) => (
        <StatusBadge key={a.id} anchor={a} />
      ))}
      {anchors.map((a) => (
        <SystemGroundPulse key={`pulse-${a.id}`} anchor={a} />
      ))}
    </group>
  )
}
