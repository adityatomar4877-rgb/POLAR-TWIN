import { useMemo } from 'react'
import * as THREE from 'three'
import { valueNoise, smoothstep } from '../../../lib/3d/noise'

function ridgedNoise(x: number, y: number, octaves = 6): number {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let weight = 1.0
  for (let i = 0; i < octaves; i++) {
    let n = valueNoise(x * freq, y * freq) * 2 - 1
    n = 1.0 - Math.abs(n)
    n = n * n
    n *= weight
    weight = Math.max(0.1, Math.min(1.0, n * 2.5))
    sum += n * amp
    amp *= 0.5
    freq *= 2.07
  }
  return sum
}

export function MaitriMountains() {
  const geometry = useMemo(() => {
    const size = 1200
    const segs = 256
    const geo = new THREE.PlaneGeometry(size, size, segs, segs)
    geo.rotateX(-Math.PI / 2)
    
    // Center the mountain mesh behind the station
    geo.translate(-200, 0, -200)
    
    const pos = geo.attributes.position
    
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      
      // Peak 1: Left side, strictly in the background (behind the station), attached to the edge of the lake
      const d1 = Math.hypot(x + 250, z + 300)
      // Peak 2: Right side, strictly in the background
      const d2 = Math.hypot(x - 250, z + 350)
      
      // Warp the distances with noise so the mountain bases aren't perfectly circular
      const warp = (valueNoise(x * 0.003, z * 0.003) - 0.5) * 150
      
      // Calculate masks. Max radius is 300 so Peak 1 gently touches the lake shore at [-100, -60] but leaves the lake visible
      const m1 = 1.0 - smoothstep(50, 300, d1 + warp)
      const m2 = 1.0 - smoothstep(50, 300, d2 + warp)
      
      // Combine masks
      const finalMask = Math.max(m1, m2)
      
      // High frequency ridged noise for jagged peaks
      const detail = ridgedNoise(x * 0.006, z * 0.006, 7)
      
      // Low frequency rolling noise for foothills
      const secondary = (valueNoise(x * 0.015, z * 0.015) - 0.5) * 20
      
      // Apply height
      let h = (detail * 140 + secondary) * finalMask
      
      // Sink the base below the Maitri terrain (-15 to 0) so they blend perfectly
      h -= 25
      
      pos.setY(i, h)
    }
    
    geo.computeVertexNormals()
    
    // Calculate realistic snow and rock vertex colors
    const colors = []
    const normals = geo.attributes.normal
    for (let i = 0; i < pos.count; i++) {
      const ny = normals.getY(i)
      const y = pos.getY(i)
      
      let slope = ny
      // Add tiny organic variance to the slope calculation
      slope += (valueNoise(pos.getX(i) * 0.1, pos.getZ(i) * 0.1) - 0.5) * 0.1
      
      // Snow accumulates on flatter surfaces. 
      // At higher altitudes, snow sticks to slightly steeper faces.
      const snowThreshold = 0.72 - Math.max(0, y) / 2000
      
      // Rock is dark grey/black, snow is off-white/blue
      const rockColor = new THREE.Color('#1f2126')
      const snowColor = new THREE.Color('#e0e8f2')
      
      // Smoothly blend between rock and snow based on slope
      const blend = smoothstep(snowThreshold - 0.06, snowThreshold + 0.06, slope)
      // Add slight random noise to the snow boundary
      const mixAmt = blend * 0.85 + (Math.random() * 0.15)
      
      const finalColor = rockColor.clone().lerp(snowColor, Math.max(0, Math.min(1, mixAmt)))
      colors.push(finalColor.r, finalColor.g, finalColor.b)
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    
    return geo
  }, [])

  return (
    <group name="MaitriMountainsGroup">
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.9}
          metalness={0.0}
        />
      </mesh>
    </group>
  )
}
