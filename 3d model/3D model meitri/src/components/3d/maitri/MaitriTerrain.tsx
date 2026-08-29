import { useMemo } from 'react'
import * as THREE from 'three'
import { maitriTerrainHeight } from '../../../lib/maitriLayout'

export function MaitriTerrain() {
  const geometry = useMemo(() => {
    const w = 400
    const segs = 256
    const geo = new THREE.PlaneGeometry(w, w, segs, segs)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      pos.setY(i, maitriTerrainHeight(x, z))
    }
    geo.computeVertexNormals()
    
    // Add vertex colors for snow vs rock based on height and slope
    const colors = []
    const normals = geo.attributes.normal
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const ny = normals.getY(i)
      const y = pos.getY(i)
      const slope = THREE.MathUtils.smoothstep(ny, 0.7, 0.98)
      
      const rockColor = new THREE.Color('#786251') // brown dirt/rock matching photo
      const snowColor = new THREE.Color('#eef3f8') // snow
      const wetShoreColor = new THREE.Color('#46382e') // damp shore rock

      const isSnow = (slope > 0.8 && y > 5 && Math.random() > 0.8) ? 1 : 0
      
      const baseCol = rockColor.clone()
      // If near lake basin, blend damp shoreline tones
      const dLake = Math.hypot(x + 95, z + 60)
      if (dLake < 75 && y < -1.0) {
        baseCol.lerp(wetShoreColor, 0.65)
      }
      
      const mixAmt = isSnow * 0.8 + (Math.random() * 0.1)
      const finalColor = baseCol.lerp(snowColor, mixAmt)
      
      colors.push(finalColor.r, finalColor.g, finalColor.b)
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    
    return geo
  }, [])

  return (
    <group name="MaitriTerrainGroup">
      {/* Main terrain mesh */}
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* Lake Priyadarshini - Glacial lake surface naturally contained by the basin */}
      <mesh position={[-95, -3.2, -60]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[180, 160, 32, 32]} />
        <meshStandardMaterial 
          color="#184160" 
          roughness={0.3} 
          metalness={0.1} 
          transparent={true} 
          opacity={0.94} 
        />
      </mesh>
    </group>
  )
}
