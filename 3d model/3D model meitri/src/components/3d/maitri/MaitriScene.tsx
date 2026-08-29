import { Suspense, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sky, Stars } from '@react-three/drei'
import { MAITRI_SUN_POSITION } from '../../../lib/maitriLayout'
import { useStationStore } from '../../../lib/stationStore'
import { StationLighting } from '../StationLighting'
import { StationCamera } from '../StationCamera'
import { CameraFocus } from '../CameraFocus'
import { SelectionRing } from '../SelectionRing'
import { IsolationDimmer } from '../IsolationDimmer'
import { StatusBeacons } from '../StatusBeacons'
import { UtilityFlows } from '../UtilityFlows'
import { ThermalOverlay } from '../ThermalOverlay'
import { BlizzardParticles } from '../BlizzardParticles'
import { MaitriTerrain } from './MaitriTerrain'
import { MaitriStation } from './MaitriStation'
import { MaitriMountains } from './MaitriMountains'

interface AtmospherePreset {
  bg: string
  fog: string
  near: number
  far: number
}

const ATMOS: Record<'standard' | 'thermal' | 'night' | 'blizzard' | 'blizzardNight', AtmospherePreset> = {
  standard: { bg: '#cfe0ef', fog: '#d5e3f0', near: 230, far: 800 },
  thermal: { bg: '#0a1128', fog: '#0d1530', near: 260, far: 950 },
  night: { bg: '#0b1026', fog: '#101830', near: 240, far: 880 },
  blizzard: { bg: '#e3ebf3', fog: '#e3ebf3', near: 26, far: 150 },
  blizzardNight: { bg: '#8b98ab', fog: '#93a0b2', near: 22, far: 120 },
}

function SceneAtmosphere() {
  const visualMode = useStationStore((s) => s.visualMode)
  const weather = useStationStore((s) => s.weather)
  const scene = useThree((state) => state.scene)
  const bg = useRef(new THREE.Color('#cfe0ef'))
  const fogColor = useRef(new THREE.Color('#d5e3f0'))
  const init = useRef(false)

  useFrame((_, delta) => {
    const key =
      weather === 'blizzard'
        ? visualMode === 'night'
          ? 'blizzardNight'
          : 'blizzard'
        : visualMode === 'thermal'
          ? 'thermal'
          : visualMode === 'night'
            ? 'night'
            : 'standard'
    const preset = ATMOS[key]

    if (!init.current) {
      scene.background = bg.current
      scene.fog = new THREE.Fog(preset.fog, preset.near, preset.far)
      init.current = true
    }
    const k = 1 - Math.exp(-2.6 * delta)
    bg.current.lerp(new THREE.Color(preset.bg), k)
    const fog = scene.fog as THREE.Fog
    fogColor.current.lerp(new THREE.Color(preset.fog), k)
    fog.color.copy(fogColor.current)
    fog.near += (preset.near - fog.near) * k
    fog.far += (preset.far - fog.far) * k
  })

  return null
}

function useSkySun(): [number, number, number] {
  const visualMode = useStationStore((s) => s.visualMode)
  if (visualMode === 'night') return [-90, -26, 70]
  if (visualMode === 'thermal') return [-40, 14, 80]
  return MAITRI_SUN_POSITION
}

const MISS_CLICK_SLOP = 6

export function MaitriScene() {
  const pressPos = useRef<{ x: number; y: number } | null>(null)
  const clearSelection = useStationStore((s) => s.clearSelection)
  const visualMode = useStationStore((s) => s.visualMode)
  const weather = useStationStore((s) => s.weather)
  const skySun = useSkySun()

  return (
    <div
      className="scene-wrap"
      onPointerDownCapture={(e) => {
        pressPos.current = { x: e.clientX, y: e.clientY }
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        // Set initial camera view to best show off the long Maitri building with its stilts
        camera={{ position: [110, 30, 130], fov: 45, near: 0.5, far: 2600 }}
        onPointerMissed={(e) => {
          const p = pressPos.current
          if (!p) return
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) <= MISS_CLICK_SLOP) {
            clearSelection()
          }
        }}
      >
        <Suspense fallback={null}>
          <Sky
            distance={450000}
            sunPosition={skySun}
            turbidity={weather === 'blizzard' ? 8 : 3.2}
            rayleigh={visualMode === 'night' ? 0.4 : 0.9}
            mieCoefficient={0.004}
            mieDirectionalG={0.85}
          />
          {visualMode === 'night' && weather === 'clear' && (
            <Stars radius={320} depth={60} count={2600} factor={5} saturation={0} fade speed={0.6} />
          )}
          <SceneAtmosphere />
          <StationLighting />
          <MaitriTerrain />
          <MaitriMountains />
          <MaitriStation />
          <StationCamera />
          <CameraFocus />
          <SelectionRing />
          <IsolationDimmer />
          <StatusBeacons />
          <UtilityFlows />
          <ThermalOverlay />
          <BlizzardParticles />
        </Suspense>
      </Canvas>
    </div>
  )
}
