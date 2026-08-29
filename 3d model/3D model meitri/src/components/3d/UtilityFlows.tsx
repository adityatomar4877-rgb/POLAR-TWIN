import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { terrainHeight as bharatiTerrainHeight } from '../../lib/stationLayout'
import { maitriTerrainHeight } from '../../lib/maitriLayout'
import { effectiveStatusOf, useStationStore } from '../../lib/stationStore'
import { STATUS_COLOR } from './StatusBeacons'

interface FlowDef {
  id: string
  label: string
  /** Systems whose status drives this conduit's health. */
  systems: string[]
  /** Ground polyline (world XZ), first point = source. */
  points: [number, number][]
  color: string
  /** Nominal transport speed, metres per second. */
  speed: number
}

const FLOWS: FlowDef[] = [
  {
    id: 'fuel-supply',
    label: 'Fuel Supply Line',
    systems: ['BharatiFuelFarm', 'BharatiFuelStation', 'BharatiUtilityArea'],
    points: [
      [-52, -6],
      [-38, 4],
      [-32, 9],
      [-18, -4],
      [4, -16],
      [26, -28],
      [39, -35],
    ],
    color: '#f97316',
    speed: 9,
  },
  {
    id: 'water-intake',
    label: 'Seawater / Fresh Water Intake',
    systems: ['BharatiWaterPump', 'BharatiMainBuilding'],
    points: [
      [-57, 27],
      [-40, 18],
      [-24, 10],
      [-10, 3],
      [0, 0],
    ],
    color: '#38bdf8',
    speed: 7,
  },
  {
    id: 'power-camp',
    label: 'Power Grid — Summer Camp',
    systems: ['BharatiUtilityArea', 'BharatiSummerCamp'],
    points: [
      [39, -35],
      [47, -20],
      [51, -4],
      [55, 8],
      [57, 13],
    ],
    color: '#facc15',
    speed: 12,
  },
  {
    id: 'power-labs',
    label: 'Power Grid — Container Labs',
    systems: ['BharatiUtilityArea', 'BharatiContainerModules'],
    points: [
      [39, -35],
      [26, -33],
      [12, -31],
      [0, -30],
    ],
    color: '#facc15',
    speed: 12,
  },
  {
    id: 'maitri-fuel',
    label: 'Maitri Fuel Supply',
    systems: ['MaitriFuelFarm', 'MaitriFuelStation', 'MaitriMainBuilding', 'MaitriUtilityArea'],
    points: [
      [-40, 20],
      [-25, 15],
      [-15, 6],
      [-8, -6],
      [-8, -25],
      [-10, -40],
    ],
    color: '#f97316',
    speed: 9,
  },
  {
    id: 'maitri-water',
    label: 'Lake Priyadarshini Intake',
    systems: ['MaitriLakeWaterPumpHouse', 'MaitriMainBuilding'],
    points: [
      [-80, -40],
      [-60, -28],
      [-40, -16],
      [-22, -8],
      [-10, -3],
      [0, 0],
    ],
    color: '#38bdf8',
    speed: 7,
  },
  {
    id: 'maitri-power-camp',
    label: 'Maitri Power Grid — Summer Camp',
    systems: ['MaitriUtilityArea', 'MaitriMainBuilding', 'MaitriSummerCamp'],
    points: [
      [-10, -40],
      [-5, -20],
      [0, 0],
      [18, 12],
      [35, 25],
    ],
    color: '#facc15',
    speed: 12,
  },
  {
    id: 'maitri-power-pump',
    label: 'Maitri Power Grid — Water Pump House',
    systems: ['MaitriUtilityArea', 'MaitriLakeWaterPumpHouse'],
    points: [
      [-10, -40],
      [-32, -42],
      [-58, -42],
      [-80, -40],
    ],
    color: '#facc15',
    speed: 12,
  },
  {
    id: 'maitri-power-fuel',
    label: 'Maitri Power Grid — Fuel Station',
    systems: ['MaitriMainBuilding', 'MaitriFuelStation', 'MaitriFuelFarm'],
    points: [
      [0, 0],
      [-12, 8],
      [-25, 15],
      [-40, 20],
    ],
    color: '#facc15',
    speed: 12,
  },
]

const HAZARD_COLOR = STATUS_COLOR.critical
const TUBE_RADIUS = 0.13
const PARTICLE_RADIUS = 0.3
const FADE_IN_SECONDS = 0.6

interface ConduitRuntime {
  def: FlowDef
  curve: THREE.CatmullRomCurve3
  length: number
  particles: number
}

function buildRuntime(def: FlowDef, activeStation: string): ConduitRuntime {
  const heightFn = activeStation === 'maitri' ? maitriTerrainHeight : bharatiTerrainHeight
  const pts = def.points.map(([x, z]) => new THREE.Vector3(x, heightFn(x, z) + 1.15, z))
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35)
  const length = curve.getLength()
  return { def, curve, length, particles: THREE.MathUtils.clamp(Math.round(length / 7), 4, 26) }
}

/** One animated utility conduit: faint tube + instanced glowing flow particles. */
function FlowConduit({ runtime }: { runtime: ConduitRuntime }) {
  const { def, curve, length, particles } = runtime
  const statusOverrides = useStationStore((s) => s.statusOverrides)
  const alerts = useStationStore((s) => s.alerts)
  const tubeRef = useRef<THREE.Mesh>(null)
  const instancedRef = useRef<THREE.InstancedMesh>(null)
  const born = useRef<number | null>(null)
  const offset = useRef(0)

  // Effective health of the conduit from its upstream/downstream systems.
  let worst: 'ok' | 'warning' | 'critical' = 'ok'
  for (const id of def.systems) {
    const st = effectiveStatusOf({ statusOverrides, alerts }, id)
    if (st === 'critical') {
      worst = 'critical'
      break
    }
    if (st === 'elevated') worst = 'warning'
  }
  const baseColor = new THREE.Color(def.color)
  const activeColor = worst === 'critical' ? new THREE.Color(HAZARD_COLOR) : baseColor
  const speedFactor = worst === 'critical' ? 0.35 : worst === 'warning' ? 0.7 : 1

  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 80, TUBE_RADIUS, 6, false), [curve])
  const particleGeometry = useMemo(() => {
    const geo = new THREE.ConeGeometry(PARTICLE_RADIUS * 1.2, PARTICLE_RADIUS * 3.5, 8)
    geo.rotateX(Math.PI / 2) // Orient cone so it points along +Z
    return geo
  }, [])
  const tubeMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0, depthWrite: false }),
    [baseColor],
  )
  const particleMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: activeColor, transparent: true, opacity: 0 }),
    [activeColor],
  )

  useEffect(() => {
    particleMaterial.color.copy(activeColor)
  }, [activeColor, particleMaterial])

  useEffect(() => () => {
    geometry.dispose()
    particleGeometry.dispose()
    tubeMaterial.dispose()
    particleMaterial.dispose()
  }, [geometry, particleGeometry, tubeMaterial, particleMaterial])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tempTangent = useMemo(() => new THREE.Vector3(), [])
  const fwd = useMemo(() => new THREE.Vector3(0, 0, 1), []) // Cone now points +Z after rotateX

  useFrame(({ clock }, delta) => {
    if (born.current === null) born.current = clock.getElapsedTime()
    const age = clock.getElapsedTime() - born.current
    const fadeIn = THREE.MathUtils.clamp(age / FADE_IN_SECONDS, 0, 1)

    const pulse = worst === 'critical' ? 0.72 + Math.sin(clock.getElapsedTime() * 6) * 0.2 : 1
    tubeMaterial.opacity = 0.3 * fadeIn * pulse
    tubeMaterial.color.lerp(activeColor, 0.1)
    particleMaterial.opacity = 0.95 * fadeIn

    offset.current = (offset.current + ((def.speed * speedFactor) / length) * delta) % 1
    const inst = instancedRef.current
    if (!inst) return
    for (let i = 0; i < particles; i++) {
      const t = (offset.current + i / particles) % 1
      const p = curve.getPointAt(t)
      curve.getTangent(t, tempTangent)
      dummy.position.copy(p)
      dummy.quaternion.setFromUnitVectors(fwd, tempTangent)
      const scale = 0.75 + Math.sin((t - offset.current) * Math.PI * 2) * 0.25
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    }
    inst.instanceMatrix.needsUpdate = true
  })

  return (
    <group name={`Flow:${def.id}`}>
      <mesh ref={tubeRef} geometry={geometry} material={tubeMaterial} />
      <instancedMesh ref={instancedRef} args={[particleGeometry, particleMaterial, particles]} frustumCulled={false} />
    </group>
  )
}

/** Animated pipeline & grid conduits between station facilities. */
export function UtilityFlows() {
  const visualMode = useStationStore((s) => s.visualMode)
  const activeStation = useStationStore((s) => s.activeStation)
  
  const runtimes = useMemo(() => {
    return FLOWS
      .filter((f) => f.id.startsWith(activeStation === 'bharati' ? 'fuel' : 'nonexistent') || f.systems.some(sys => sys.toLowerCase().startsWith(activeStation)))
      .map((f) => buildRuntime(f, activeStation))
  }, [activeStation])
  
  if (visualMode !== 'utilities') return null
  return (
    <group name="UtilityFlows">
      {runtimes.map((rt) => (
        <FlowConduit key={rt.def.id} runtime={rt} />
      ))}
    </group>
  )
}
