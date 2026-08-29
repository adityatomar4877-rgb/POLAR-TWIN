import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { SUN_POSITION } from '../../../lib/3d/stationLayout'
import { MAITRI_SUN_POSITION } from '../../../lib/3d/maitriLayout'
import { useStationStore, type VisualMode, type Weather } from '../../../lib/3d/stationStore'

interface LightingPreset {
  hemiSky: string
  hemiGround: string
  hemiIntensity: number
  dirIntensity: number
  dirColor: string
  ambient: number
  /** Glazing emissive strength (warm interior glow). */
  windows: number
  /** Floodlight intensity multiplier 0..1. */
  floods: number
}

const PRESETS: Record<'standard' | 'night' | 'thermal' | 'blizzard' | 'blizzardNight', LightingPreset> = {
  // Polar day: crisp low sun, bright sky bounce, soft shadows.
  standard: {
    hemiSky: '#bcd7ee',
    hemiGround: '#e6ecf2',
    hemiIntensity: 0.65,
    dirIntensity: 2.6,
    dirColor: '#fff2df',
    ambient: 0.18,
    windows: 0,
    floods: 0,
  },
  // Polar night: blue twilight, LED floods and warm windows take over.
  night: {
    hemiSky: '#22345a',
    hemiGround: '#0b1020',
    hemiIntensity: 0.24,
    dirIntensity: 0.3,
    dirColor: '#8fb0e8',
    ambient: 0.1,
    windows: 0.75,
    floods: 1,
  },
  // Thermal IR: flat cold ambient so false-colour materials read cleanly.
  thermal: {
    hemiSky: '#334155',
    hemiGround: '#0f172a',
    hemiIntensity: 0.5,
    dirIntensity: 0.5,
    dirColor: '#93c5fd',
    ambient: 0.22,
    windows: 0,
    floods: 0,
  },
  // Whiteout: dense bright scatter, sun diffused away.
  blizzard: {
    hemiSky: '#eef2f7',
    hemiGround: '#dfe6ee',
    hemiIntensity: 1.05,
    dirIntensity: 0.5,
    dirColor: '#f8fafc',
    ambient: 0.35,
    windows: 0.15,
    floods: 0,
  },
  blizzardNight: {
    hemiSky: '#4b5a72',
    hemiGround: '#1a2233',
    hemiIntensity: 0.5,
    dirIntensity: 0.22,
    dirColor: '#9db4d8',
    ambient: 0.16,
    windows: 0.75,
    floods: 1,
  },
}

function resolvePreset(visualMode: VisualMode, weather: Weather): LightingPreset {
  if (weather === 'blizzard') {
    return visualMode === 'night' ? PRESETS.blizzardNight : PRESETS.blizzard
  }
  if (visualMode === 'night') return PRESETS.night
  if (visualMode === 'thermal') return PRESETS.thermal
  return PRESETS.standard
}

const FLOOD_DEFS: { pos: [number, number, number]; target: [number, number, number] }[] = [
  { pos: [26, 16, 26], target: [0, 6, 0] },
  { pos: [-44, 12, 4], target: [-52, 3, -6] },
]

const MAITRI_FLOOD_DEFS: { pos: [number, number, number]; target: [number, number, number] }[] = [
  { pos: [0, 16, 36], target: [0, 5, 0] },
  { pos: [-40, 16, -16], target: [-30, 5, -10] },
]

/**
 * Dynamic lighting rig for Antarctic extremes:
 * polar day, polar night (floodlights + warm windows), thermal IR flat-light
 * and blizzard whiteout — all smoothly interpolated between presets.
 */
export function StationLighting() {
  const visualMode = useStationStore((s) => s.visualMode)
  const weather = useStationStore((s) => s.weather)
  const activeStation = useStationStore((s) => s.activeStation)
  const scene = useThree((state) => state.scene)

  const dirRef = useRef<THREE.DirectionalLight>(null)
  const hemiRef = useRef<THREE.HemisphereLight>(null)
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const floodRefs = useRef<(THREE.SpotLight | null)[]>([])
  const windowMats = useRef<THREE.MeshStandardMaterial[]>([])
  const windowGlow = useRef(0)

  const currentFloods = activeStation === 'maitri' ? MAITRI_FLOOD_DEFS : FLOOD_DEFS
  const floodTargets = useMemo(() => currentFloods.map((f) => new THREE.Vector3(...f.target)), [currentFloods])

  // Collect glazing materials once for the night window-glow effect.
  useEffect(() => {
    const found: THREE.MeshStandardMaterial[] = []
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const raw of mats) {
        const mat = raw as THREE.MeshStandardMaterial
        if (mat && 'isMeshStandardMaterial' in mat) {
          const hex = mat.color.getHexString()
          if (hex === '1a242f' || hex === '1a1d21') {
            found.push(mat)
          }
        }
      }
    })
    windowMats.current = found
  }, [scene])

  useFrame((_, delta) => {
    const preset = resolvePreset(visualMode, weather)
    const k = 1 - Math.exp(-3.2 * delta)

    const dir = dirRef.current
    if (dir) {
      dir.intensity += (preset.dirIntensity - dir.intensity) * k
      dir.color.lerp(new THREE.Color(preset.dirColor), k)
    }
    const hemi = hemiRef.current
    if (hemi) {
      hemi.intensity += (preset.hemiIntensity - hemi.intensity) * k
      hemi.color.lerp(new THREE.Color(preset.hemiSky), k)
      hemi.groundColor.lerp(new THREE.Color(preset.hemiGround), k)
    }
    const amb = ambientRef.current
    if (amb) amb.intensity += (preset.ambient - amb.intensity) * k

    windowGlow.current += (preset.windows - windowGlow.current) * k
    for (const mat of windowMats.current) {
      mat.emissive.set('#ffca8a')
      mat.emissiveIntensity = windowGlow.current
    }

    floodRefs.current.forEach((spot, i) => {
      if (!spot) return
      spot.intensity += (preset.floods * 900 - spot.intensity) * k
      spot.target.position.copy(floodTargets[i])
      spot.target.updateMatrixWorld()
    })
  })

  return (
    <group name="StationLighting">
      {/* Low polar sun / moon */}
      <directionalLight
        ref={dirRef}
        position={activeStation === 'maitri' ? MAITRI_SUN_POSITION : SUN_POSITION}
        intensity={2.6}
        color="#fff2df"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={20}
        shadow-camera-far={700}
        shadow-camera-left={-185}
        shadow-camera-right={185}
        shadow-camera-top={185}
        shadow-camera-bottom={-185}
        shadow-bias={-0.00015}
        shadow-normalBias={0.15}
      />
      {/* Sky / snow bounce */}
      <hemisphereLight ref={hemiRef} args={['#bcd7ee', '#e6ecf2', 0.65]} />
      <ambientLight ref={ambientRef} intensity={0.18} />

      {/* Exterior LED floodlights (polar night) */}
      {currentFloods.map((f, i) => (
        <spotLight
          key={i}
          ref={(el) => {
            floodRefs.current[i] = el
          }}
          position={f.pos}
          angle={0.55}
          penumbra={0.65}
          distance={160}
          decay={1.4}
          color="#dfe9ff"
          intensity={0}
        />
      ))}
    </group>
  )
}
