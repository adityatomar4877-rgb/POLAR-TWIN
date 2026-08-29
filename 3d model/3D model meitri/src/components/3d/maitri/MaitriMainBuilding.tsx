import { useMemo } from 'react'
import * as THREE from 'three'
import { StationGroup } from '../common/StationGroup'

const MAT_EXTERIOR = new THREE.MeshStandardMaterial({ color: '#5b6e61', roughness: 0.85, metalness: 0.1 }) 
const MAT_STEEL = new THREE.MeshStandardMaterial({ color: '#3a2220', roughness: 0.9, metalness: 0.5 }) 
const MAT_ROOF = new THREE.MeshStandardMaterial({ color: '#4a5358', roughness: 0.9 })
const MAT_WINDOW_FRAME = new THREE.MeshStandardMaterial({ color: '#889096', roughness: 0.4, metalness: 0.7 })
const MAT_GLASS = new THREE.MeshStandardMaterial({ color: '#0d1117', roughness: 0.1, metalness: 0.9 })
const MAT_WHITE = new THREE.MeshStandardMaterial({ color: '#e0e0e0', roughness: 0.6 })
const MAT_RADOME = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.7, flatShading: true })
const MAT_ORANGE = new THREE.MeshStandardMaterial({ color: '#d96a2b', roughness: 0.7 })
const MAT_GREEN = new THREE.MeshStandardMaterial({ color: '#138808', roughness: 0.7 })
const MAT_NAVY = new THREE.MeshStandardMaterial({ color: '#000080', roughness: 0.7 })

interface BlockDef {
  x: number
  z: number
  w: number
  d: number
  h: number
}

// Reusable detailed window frame
function WindowFrame({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh material={MAT_WINDOW_FRAME} position={[0, 0, 0]}>
        <boxGeometry args={[1.2, 1.4, 0.1]} />
      </mesh>
      <mesh material={MAT_GLASS} position={[0, 0, 0.02]}>
        <boxGeometry args={[1, 1.2, 0.1]} />
      </mesh>
    </group>
  )
}

// Reusable HVAC roof unit
function HvacUnit({ position, rotation = [0, 0, 0] }: { position: [number, number, number], rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh material={MAT_WHITE} position={[0, 0.5, 0]}>
        <boxGeometry args={[1.5, 1, 2]} />
      </mesh>
      <mesh material={MAT_STEEL} position={[0, 1.05, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
      </mesh>
      <mesh material={MAT_STEEL} position={[0, 1.05, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
      </mesh>
    </group>
  )
}

export function MaitriMainBuilding() {
  const { stilts, braces, stiltsGeo, blocks } = useMemo(() => {
    const elevation = 2.5 // Ground to floor

    const blocks: BlockDef[] = [
      { x: 0, z: 0, w: 40, d: 12, h: 5 }, // Main spine
      { x: -10, z: -12, w: 12, d: 16, h: 5 }, // Rear left wing
      { x: 15, z: -12, w: 12, d: 16, h: 5 }, // Rear right wing
      { x: 0, z: 6, w: 10, d: 4, h: 5 }, // Entrance protrusion
    ]

    // Generate Stilts & Cross-Bracing
    const stiltPositions: [number, number, number][] = []
    const bracePositions: { pos: [number, number, number], rot: [number, number, number], len: number }[] = []
    
    const addStilts = (xCenter: number, zCenter: number, w: number, d: number) => {
      const cols = Math.max(2, Math.floor(w / 4))
      const rows = Math.max(2, Math.floor(d / 4))
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = xCenter - w / 2 + 2 + (c / (cols - 1)) * (w - 4)
          const z = zCenter - d / 2 + 2 + (r / (rows - 1)) * (d - 4)
          stiltPositions.push([x, elevation / 2, z])
          
          // Add diagonal cross-braces between adjacent stilts in X direction
          if (c < cols - 1) {
            const nx = xCenter - w / 2 + 2 + ((c + 1) / (cols - 1)) * (w - 4)
            const dx = nx - x
            const len = Math.hypot(dx, elevation)
            const angle = Math.atan2(elevation, dx)
            bracePositions.push({ pos: [x + dx/2, elevation/2, z], rot: [0, 0, angle], len })
            bracePositions.push({ pos: [x + dx/2, elevation/2, z], rot: [0, 0, -angle], len })
          }
        }
      }
    }
    blocks.forEach(b => addStilts(b.x, b.z, b.w, b.d))
    addStilts(-30, 0, 10, 10) // Radome platform stilts

    const stiltsGeom = new THREE.CylinderGeometry(0.15, 0.15, elevation)
    
    return { stilts: stiltPositions, braces: bracePositions, stiltsGeo: stiltsGeom, blocks, e: elevation }
  }, [])

  return (
    <StationGroup id="MaitriMainBuilding">
      {/* Structural Blocks */}
      {blocks.map((b, i) => (
        <group key={`block-${i}`} position={[b.x, 2.5 + b.h / 2, b.z]}>
          <mesh name={`MaitriHull-${i}`}>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <primitive object={MAT_EXTERIOR} attach="material" />
          </mesh>
          {/* Roof */}
          <mesh name={`MaitriRoof-${i}`} position={[0, b.h / 2 + 0.1, 0]}>
            <boxGeometry args={[b.w, 0.2, b.d]} />
            <primitive object={MAT_ROOF} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Roof Clutter (HVACs, Pipes) */}
      <HvacUnit position={[-12, 7.7, 0]} />
      <HvacUnit position={[12, 7.7, 0]} />
      <HvacUnit position={[-10, 7.7, -15]} rotation={[0, Math.PI/2, 0]} />
      <HvacUnit position={[15, 7.7, -15]} rotation={[0, Math.PI/2, 0]} />
      {/* Main Roof Pipe */}
      <mesh position={[0, 7.8, -2]} rotation={[0, 0, Math.PI/2]} material={MAT_STEEL}>
        <cylinderGeometry args={[0.15, 0.15, 36]} />
      </mesh>

      {/* Radome & Platform (Left side) */}
      <group position={[-30, 2.5, 0]}>
        {/* Platform Deck */}
        <mesh position={[0, 0.2, 0]} material={MAT_STEEL}>
          <boxGeometry args={[10, 0.4, 10]} />
        </mesh>
        {/* Safety Railings */}
        <mesh position={[0, 1.2, 4.9]} material={MAT_STEEL} rotation={[0, 0, Math.PI/2]}>
           <cylinderGeometry args={[0.05, 0.05, 10]} />
        </mesh>
        <mesh position={[0, 1.2, -4.9]} material={MAT_STEEL} rotation={[0, 0, Math.PI/2]}>
           <cylinderGeometry args={[0.05, 0.05, 10]} />
        </mesh>
        {/* Geodesic Radome */}
        <mesh position={[0, 3.5, 0]} material={MAT_RADOME}>
          <icosahedronGeometry args={[3.2, 3]} />
        </mesh>
        {/* Radome Mounting Ring */}
        <mesh position={[0, 0.6, 0]} material={MAT_WHITE} rotation={[Math.PI/2, 0, 0]}>
          <torusGeometry args={[2.5, 0.2, 16, 32]} />
        </mesh>
        {/* Walkway connecting radome to main spine */}
        <mesh position={[10, 0.2, 0]} material={MAT_STEEL}>
          <boxGeometry args={[10, 0.2, 2]} />
        </mesh>
      </group>

      {/* Stilts & Foundations */}
      <group name="MaitriStilts">
        {stilts.map((pos, i) => (
          <group key={`stilt-${i}`} position={pos}>
            <mesh geometry={stiltsGeo} material={MAT_STEEL} />
            <mesh position={[0, -1.2, 0]} material={MAT_WHITE}>
              <boxGeometry args={[0.6, 0.4, 0.6]} />
            </mesh>
          </group>
        ))}
        {braces.map((brace, i) => (
          <mesh key={`brace-${i}`} position={brace.pos} rotation={brace.rot} material={MAT_STEEL}>
            <cylinderGeometry args={[0.08, 0.08, brace.len]} />
          </mesh>
        ))}
      </group>

      {/* Front Entrance Details */}
      <group position={[0, 2.5 + 2.5, 8]}>
        {/* Entrance door */}
        <mesh position={[0, -1, 0.05]} material={MAT_WHITE}>
          <boxGeometry args={[2, 2.5, 0.1]} />
        </mesh>
        {/* Indian Tricolor representation on the entrance facade */}
        <mesh position={[0, 1.2, 0.05]} material={MAT_ORANGE}>
          <boxGeometry args={[4, 0.4, 0.1]} />
        </mesh>
        <mesh position={[0, 0.8, 0.05]} material={MAT_WHITE}>
          <boxGeometry args={[4, 0.4, 0.1]} />
        </mesh>
        <mesh position={[0, 0.4, 0.05]} material={MAT_GREEN}>
          <boxGeometry args={[4, 0.4, 0.1]} />
        </mesh>
        {/* Ashoka Chakra */}
        <mesh position={[0, 0.8, 0.05]} rotation={[Math.PI / 2, 0, 0]} material={MAT_NAVY}>
          <cylinderGeometry args={[0.15, 0.15, 0.12, 16]} />
        </mesh>
      </group>

      {/* Front Staircase */}
      <group>
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh 
            key={`step-${i}`} 
            position={[0, 2.5 - (i + 1) * 0.25, 9 + i * 0.3 + 0.15]} 
            material={MAT_STEEL}
          >
            <boxGeometry args={[2.5, 0.05, 0.3]} />
          </mesh>
        ))}
      </group>
      {/* Front Staircase Landing */}
      <mesh position={[0, 2.5, 8.5]} material={MAT_STEEL}>
        <boxGeometry args={[3, 0.2, 1]} />
      </mesh>

      {/* Detailed Windows along the main spine front facade */}
      {Array.from({ length: 8 }).map((_, i) => (
        <WindowFrame key={`win-front-left-${i}`} position={[-18 + i * 2, 2.5 + 2.5, 6.05]} rotation={[0, 0, 0]} />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <WindowFrame key={`win-front-right-${i}`} position={[6 + i * 2, 2.5 + 2.5, 6.05]} rotation={[0, 0, 0]} />
      ))}
      
      {/* Detailed Windows along the rear wings */}
      {Array.from({ length: 6 }).map((_, i) => (
        <WindowFrame key={`win-rear-left-${i}`} position={[-16.05, 2.5 + 2.5, -6 - i * 2]} rotation={[0, -Math.PI / 2, 0]} />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <WindowFrame key={`win-rear-right-${i}`} position={[21.05, 2.5 + 2.5, -6 - i * 2]} rotation={[0, Math.PI / 2, 0]} />
      ))}

    </StationGroup>
  )
}
