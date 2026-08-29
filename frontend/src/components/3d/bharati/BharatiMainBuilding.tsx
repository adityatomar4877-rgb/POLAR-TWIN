import { useMemo } from 'react'
import * as THREE from 'three'
import { StationGroup } from '../common/StationGroup'
import { Concrete, SteelGalvanized } from '../common/materials'
import { FACILITIES, terrainHeight } from '../../../lib/3d/stationLayout'

// Bright aluminum skin to prevent rendering black
const MAT_SKIN = new THREE.MeshStandardMaterial({ color: '#c7d3df', roughness: 0.5, metalness: 0.2 })
const MAT_BELLY = new THREE.MeshStandardMaterial({ color: '#3a4045', roughness: 0.7, metalness: 0.1 })
const MAT_GLASS = new THREE.MeshStandardMaterial({ color: '#0d1620', roughness: 0.1, metalness: 0.8 })
const MAT_PANEL = new THREE.MeshStandardMaterial({ color: '#10151c', roughness: 0.9 })
const MAT_RADOME = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.15, metalness: 0.6 })

const LEG_H = 2.8

// Helper to create a 4-sided frustum (pyramid with flat top)
function Frustum({ wBot, lBot, wTop, lTop, h, material, name, openEnds }: { wBot: number, lBot: number, wTop: number, lTop: number, h: number, material: THREE.Material, name?: string, openEnds?: boolean }) {
  const geo = useMemo(() => {
    const pts = [
      [-wBot/2, 0, lBot/2], [wBot/2, 0, lBot/2], [wBot/2, 0, -lBot/2], [-wBot/2, 0, -lBot/2], // bottom
      [-wTop/2, h, lTop/2], [wTop/2, h, lTop/2], [wTop/2, h, -lTop/2], [-wTop/2, h, -lTop/2]  // top
    ]
    const idx = [
      0, 1, 5, 0, 5, 4, // front (positive Z)
      1, 2, 6, 1, 6, 5, // right (positive X)
      2, 3, 7, 2, 7, 6, // back (negative Z)
      3, 0, 4, 3, 4, 7, // left (negative X)
    ]
    if (!openEnds) {
      idx.push(0, 3, 2, 0, 2, 1) // bottom
      idx.push(4, 5, 6, 4, 6, 7) // top
    }
    
    const verts = new Float32Array(pts.flat())
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    geometry.setIndex(idx)
    geometry.computeVertexNormals()
    return geometry
  }, [wBot, lBot, wTop, lTop, h, openEnds])

  return <mesh name={name} geometry={geo} material={material} />
}

function Hull() {
  const mullions = []
  // Ribbon window vertical mullions
  for (let z = -25; z <= 25; z += 2) {
    mullions.push(<mesh key={`mr${z}`} position={[12.05, 4.3, z]}><boxGeometry args={[0.08, 1.4, 0.1]}/><primitive object={MAT_SKIN} attach="material" /></mesh>)
    mullions.push(<mesh key={`ml${z}`} position={[-12.05, 4.3, z]}><boxGeometry args={[0.08, 1.4, 0.1]}/><primitive object={MAT_SKIN} attach="material" /></mesh>)
  }

  return (
    <group name="BharatiHull">
      {/* Sloped Belly (Outward) */}
      <group position={[0, 0, 0]}>
        <Frustum wBot={10} lBot={44} wTop={24} lTop={54} h={3.5} material={MAT_BELLY} name="Belly" />
      </group>
      {/* Aluminum Lip under windows */}
      <group position={[0, 3.5, 0]}>
        <Frustum wBot={24} lBot={54} wTop={24} lTop={54} h={0.2} material={MAT_SKIN} name="Lip" />
      </group>
      {/* Ribbon Window Band (Slightly inward slope) */}
      <group position={[0, 3.7, 0]}>
        <Frustum wBot={24} lBot={54} wTop={23.5} lTop={53.5} h={1.4} material={MAT_GLASS} name="Glazing" />
      </group>
      {/* Upper Roof Slant (Inward) */}
      <group position={[0, 5.1, 0]}>
        <Frustum wBot={23.5} lBot={53.5} wTop={17} lTop={48} h={1.5} material={MAT_SKIN} name="RoofSlant" />
      </group>
      
      <group name="Mullions">{mullions}</group>
    </group>
  )
}

function RoofTier() {
  return (
    <group position={[0, 6.6, 0]}>
      {/* Massive raised central block (frustum) */}
      <Frustum wBot={12} lBot={36} wTop={9} lTop={33} h={1.4} material={MAT_SKIN} name="Penthouse" />
      {/* Solar Panel flat top */}
      <mesh position={[0, 1.45, 0]}>
        <boxGeometry args={[8.8, 0.1, 32.8]} />
        <primitive object={MAT_PANEL} attach="material" />
      </mesh>
    </group>
  )
}

function SupportAndCore() {
  const items: React.ReactElement[] = []
  
  const addV = (x: number, z: number, id: string) => {
    const yTop = 0
    const yBot = -LEG_H
    const zSpread = 2.0 
    
    const len = Math.hypot(yTop - yBot, zSpread)
    const angle = Math.atan2(yTop - yBot, zSpread)
    
    items.push(
      <group key={id} position={[x, 0, z]}>
        <mesh position={[0, (yTop+yBot)/2, zSpread/2]} rotation={[angle, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, len, 8]} />
          <SteelGalvanized />
        </mesh>
        <mesh position={[0, (yTop+yBot)/2, -zSpread/2]} rotation={[-angle, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, len, 8]} />
          <SteelGalvanized />
        </mesh>
        <mesh position={[0, -LEG_H, zSpread]}>
          <cylinderGeometry args={[0.6, 0.7, 0.4, 8]} />
          <Concrete />
        </mesh>
        <mesh position={[0, -LEG_H, -zSpread]}>
          <cylinderGeometry args={[0.6, 0.7, 0.4, 8]} />
          <Concrete />
        </mesh>
      </group>
    )
  }

  // V-legs only on the LEFT half (cantilevered side, negative Z)
  for (let z = -15; z <= 0; z += 10) {
    addV(3.5, z, `R${z}`)
    addV(-3.5, z, `L${z}`)
  }

  return (
    <group>
      {items}
      {/* Solid Garage Core on the RIGHT half (positive Z) */}
      <group position={[0, -LEG_H/2, 14]}>
        <mesh>
          <boxGeometry args={[9, LEG_H, 16]} />
          <primitive object={MAT_BELLY} attach="material" />
        </mesh>
        {/* Silver Garage Doors */}
        <mesh position={[0, 0, 8.05]}>
          <boxGeometry args={[6, LEG_H - 0.2, 0.1]} />
          <primitive object={MAT_SKIN} attach="material" />
        </mesh>
      </group>
    </group>
  )
}

function GroundRadome() {
  return (
    <group position={[-25, -LEG_H, 5]}>
      {/* Platform */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[5, 5.5, 2, 16]} />
        <Concrete />
      </mesh>
      {/* Bright white spherical radome */}
      <mesh position={[0, 7, 0]}>
        <sphereGeometry args={[5.5, 32, 32]} />
        <primitive object={MAT_RADOME} attach="material" />
      </mesh>
    </group>
  )
}

function Entrance() {
  const steps = []
  const nSteps = 16
  const startX = 8.5
  const endX = 5
  const startY = -LEG_H
  const endY = 0
  const zPos = -2
  const width = 1.5
  
  for (let i = 0; i < nSteps; i++) {
    const t = i / (nSteps - 1)
    const x = startX + (endX - startX) * t
    const y = startY + (endY - startY) * t
    
    steps.push(
      <mesh key={`st${i}`} position={[x, y, zPos]}>
        <boxGeometry args={[0.3, 0.08, width]} />
        <SteelGalvanized />
      </mesh>
    )
  }

  const dx = endX - startX
  const dy = endY - startY
  const hypot = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx)
  const cx = (startX + endX) / 2
  const cy = (startY + endY) / 2

  return (
    <group position={[0, 0, 0]}>
      {steps}
      {/* Handrails (boxes are X-aligned) */}
      <mesh position={[cx, cy + 0.8, zPos + width/2]} rotation={[0, 0, angle]}>
        <boxGeometry args={[hypot, 0.05, 0.05]} />
        <SteelGalvanized />
      </mesh>
      <mesh position={[cx, cy + 0.8, zPos - width/2]} rotation={[0, 0, angle]}>
        <boxGeometry args={[hypot, 0.05, 0.05]} />
        <SteelGalvanized />
      </mesh>
      {/* Rail vertical supports */}
      <mesh position={[startX, startY + 0.4, zPos + width/2]}>
        <boxGeometry args={[0.05, 0.8, 0.05]} />
        <SteelGalvanized />
      </mesh>
      <mesh position={[endX, endY + 0.4, zPos + width/2]}>
        <boxGeometry args={[0.05, 0.8, 0.05]} />
        <SteelGalvanized />
      </mesh>
      <mesh position={[startX, startY + 0.4, zPos - width/2]}>
        <boxGeometry args={[0.05, 0.8, 0.05]} />
        <SteelGalvanized />
      </mesh>
      <mesh position={[endX, endY + 0.4, zPos - width/2]}>
        <boxGeometry args={[0.05, 0.8, 0.05]} />
        <SteelGalvanized />
      </mesh>
    </group>
  )
}

function Flagpole() {
  return (
    <group name="BharatiFlagpole" position={[15, -LEG_H, -5]}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.35, 0.42, 0.5, 12]} />
        <Concrete />
      </mesh>
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 7, 8]} />
        <SteelGalvanized />
      </mesh>
      {/* Indian Tricolor Flag */}
      <mesh position={[0.78, 7.28, 0]}>
        <boxGeometry args={[1.5, 0.29, 0.03]} />
        <meshStandardMaterial color="#ff9933" roughness={0.85} />
      </mesh>
      <mesh position={[0.78, 6.99, 0]}>
        <boxGeometry args={[1.5, 0.29, 0.03]} />
        <meshStandardMaterial color="#f2f4f6" roughness={0.85} />
      </mesh>
      <mesh position={[0.78, 6.7, 0]}>
        <boxGeometry args={[1.5, 0.29, 0.03]} />
        <meshStandardMaterial color="#138808" roughness={0.85} />
      </mesh>
      {/* Ashoka Chakra (front and back) */}
      <mesh position={[0.78, 6.99, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
        <meshStandardMaterial color="#06038d" roughness={0.6} />
      </mesh>
      <mesh position={[0.78, 6.99, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
        <meshStandardMaterial color="#06038d" roughness={0.6} />
      </mesh>
    </group>
  )
}

export function BharatiMainBuilding() {
  const { x, z } = FACILITIES.mainBuilding
  return (
    <StationGroup 
      id="BharatiMainBuilding" 
      label="Bharati Main Building" 
      position={[x, terrainHeight(x, z) + LEG_H, z]}
      rotation={[0, Math.PI, 0]}
    >
      <SupportAndCore />
      <Hull />
      <RoofTier />
      <Entrance />
      <Flagpole />
      <GroundRadome />
    </StationGroup>
  )
}
