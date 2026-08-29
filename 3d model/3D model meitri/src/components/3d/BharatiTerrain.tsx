import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { fbm, mulberry32 } from '../../lib/noise'
import { PATHS, PADS, terrainHeight } from '../../lib/stationLayout'

const TERRAIN_SIZE = 270
const TERRAIN_SEGMENTS = 132
const ROCK_COUNT = 320
const DRIFT_COUNT = 170

// Vertex colour palette (linear-ish sRGB values tuned by eye).
const SNOW = new THREE.Color('#eef3f8')
// Dark grey/brown Larsemann-Hills gneiss — exposed bedrock (refit).
const ROCK_LOW = new THREE.Color('#403b35')
const ROCK_HIGH = new THREE.Color('#5c564e')
const GNEISS_STRIPE = new THREE.Color('#332f2a')
const ICE_TINT = new THREE.Color('#d4e4f2')
// Coastal boundary: bare blue ice grading into polar sea water (refit).
const BLUE_ICE = new THREE.Color('#b7d6ec')
const WATER_TINT = new THREE.Color('#3f607e')

interface Placement {
  x: number
  z: number
  y: number
  sx: number
  sy: number
  sz: number
  rx: number
  ry: number
  rz: number
}

function isClearOfPads(x: number, z: number): boolean {
  for (const p of PADS) {
    if (Math.hypot(x - p.x, z - p.z) < p.r + 5) return false
  }
  return true
}

function scatterPlacements(count: number, seed: number, minR: number, maxR: number, baseScale: number): Placement[] {
  const rand = mulberry32(seed)
  const out: Placement[] = []
  let guard = 0
  while (out.length < count && guard < count * 30) {
    guard++
    const a = rand() * Math.PI * 2
    const r = minR + Math.sqrt(rand()) * (maxR - minR)
    const x = Math.cos(a) * r + (rand() - 0.5) * 40
    const z = Math.sin(a) * r * 0.9 + (rand() - 0.5) * 40
    if (!isClearOfPads(x, z)) continue
    // Keep the coastal boundary (open water + fast-ice shelf) clean.
    if (x < -232) continue
    if (x < -148 && z > -212 && z < 218) continue
    const h = terrainHeight(x, z)
    const s = baseScale * (0.45 + rand() * 1.1)
    out.push({
      x,
      z,
      y: h - s * 0.25,
      sx: s * (0.7 + rand() * 0.7),
      sy: s * (0.45 + rand() * 0.55),
      sz: s * (0.7 + rand() * 0.7),
      rx: rand() * Math.PI,
      ry: rand() * Math.PI * 2,
      rz: rand() * Math.PI,
    })
  }
  return out
}

function buildTerrainGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)

  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)))
  }
  geo.computeVertexNormals()

  const normals = geo.attributes.normal as THREE.BufferAttribute
  const c = new THREE.Color()
  const anchor = PADS[0]
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = pos.getY(i)
    // Slope exposure -> bare rock on steeper faces.
    const steep = 1 - normals.getY(i)
    // Ridged noise carves gneiss ridges around the main building foundation,
    // fading out into the snow fields beyond the campus bench.
    const dAnchor = Math.hypot(x - anchor.x, z - anchor.z)
    const ringMask = smooth(26, 44, dAnchor) * (1 - smooth(96, 150, dAnchor))
    const ridgeN = 1 - Math.abs(2 * fbm(x * 0.021 + 130.5, z * 0.021 - 77.3, 3) - 1)
    const crestRock = smooth(0.6, 0.85, ridgeN) * ringMask

    const rockNoise = fbm(x * 0.05 + 50, z * 0.05 - 30, 3)
    const iceNoise = fbm(x * 0.04 - 90, z * 0.04 + 60, 3)
    // Peninsula exposure: steeper slope response and lower scree threshold
    // than a typical ice shelf so bare rock dominates the rocky ground.
    const slopeRock = THREE.MathUtils.clamp(steep * 4.6 - 0.18, 0, 1)
    const screeRock = smooth(0.56, 0.78, rockNoise) * 0.95
    const rockMix = Math.min(1, Math.max(slopeRock, screeRock, crestRock))

    // Foliated gneiss banding across the exposed bedrock.
    const bandNoise = fbm(x * 0.07 + 21.7, z * 0.07 - 63.1, 2)
    c.copy(SNOW).lerp(bandNoise > 0.52 ? ROCK_HIGH : ROCK_LOW, rockMix)
    const stripeNoise = fbm(x * 0.16 - 9.4, z * 0.16 + 31.9, 2)
    c.lerp(GNEISS_STRIPE, smooth(0.46, 0.54, stripeNoise) * rockMix * 0.5)

    const iceMix = smooth(0.78, 0.88, iceNoise) * (1 - rockMix) * 0.6
    c.lerp(ICE_TINT, iceMix)

    // Western coastal boundary: snowfields grade into bare blue ice, then
    // dark water wherever the bed dips below the waterline.
    const coastT = smooth(-150, -235, x)
    c.lerp(BLUE_ICE, coastT * (1 - rockMix) * 0.92)
    c.lerp(WATER_TINT, smooth(-0.35, -1.8, h))

    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** Ribbon mesh following the terrain along an access-path polyline. */
function buildPathGeometry(points: [number, number][], width: number): THREE.BufferGeometry {
  // Resample the polyline into ~2 m steps.
  const centers: [number, number][] = []
  for (let s = 0; s < points.length - 1; s++) {
    const [ax, az] = points[s]
    const [bx, bz] = points[s + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const steps = Math.max(1, Math.round(len / 2))
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      centers.push([ax + (bx - ax) * t, az + (bz - az) * t])
    }
  }
  centers.push(points[points.length - 1])

  const verts: number[] = []
  const idx: number[] = []
  for (let i = 0; i < centers.length; i++) {
    const [cx, cz] = centers[i]
    const prev = centers[Math.max(0, i - 1)]
    const next = centers[Math.min(centers.length - 1, i + 1)]
    let dx = next[0] - prev[0]
    let dz = next[1] - prev[1]
    const dl = Math.hypot(dx, dz) || 1
    dx /= dl
    dz /= dl
    const px = -dz
    const pz = dx
    const hw = width / 2
    const yL = terrainHeight(cx + px * hw, cz + pz * hw) + 0.09
    const yR = terrainHeight(cx - px * hw, cz - pz * hw) + 0.09
    verts.push(cx + px * hw, yL, cz + pz * hw)
    verts.push(cx - px * hw, yR, cz - pz * hw)
    if (i > 0) {
      const a = (i - 1) * 2
      // Winding chosen so ribbon normals face +Y (upward).
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/**
 * Wavy-edged fast-ice shelf hugging the western shoreline. Runs north-south
 * with a noise-perturbed centreline so the ice/water boundary reads as a
 * natural coast rather than a straight cut.
 */
function buildFastIceGeometry(): THREE.BufferGeometry {
  const verts: number[] = []
  const idx: number[] = []
  const zStart = -135
  const zEnd = 135
  const rows = 72
  for (let i = 0; i <= rows; i++) {
    const t = i / rows
    const z = zStart + t * (zEnd - zStart)
    const xc = -125 + (fbm(z * 0.021 + 4.2, 8.7, 3) - 0.5) * 20
    const innerX = xc + 15 + (fbm(z * 0.05, 2.2, 2) - 0.5) * 6
    const outerX = xc - 15 + (fbm(z * 0.047, 9.1, 2) - 0.5) * 8
    verts.push(innerX, 0.34, z)
    verts.push(outerX, 0.34, z)
    if (i > 0) {
      const a = (i - 1) * 2
      // Winding chosen so ribbon normals face +Y (upward).
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/**
 * Antarctic terrain: Larsemann-Hills-style rocky peninsula — dark gneiss
 * ridges exposed around the station foundations, snow drifts in the lee,
 * blue-ice patches, and a western coastal boundary where the land grades
 * into bare sea ice and open polar water.
 */
export function BharatiTerrain() {
  const terrainGeo = useMemo(() => buildTerrainGeometry(), [])

  const rockGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), [])
  const rockMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#57524a', roughness: 1, metalness: 0, flatShading: true }),
    [],
  )
  const driftGeo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), [])
  const driftMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#f2f6fa', roughness: 0.97, metalness: 0 }),
    [],
  )

  const rocks = useMemo(() => scatterPlacements(ROCK_COUNT, 1337, 56, 130, 1.9), [])
  const drifts = useMemo(() => scatterPlacements(DRIFT_COUNT, 90210, 58, 125, 2.6), [])

  const rocksRef = useRef<THREE.InstancedMesh>(null)
  const driftsRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    const apply = (mesh: THREE.InstancedMesh | null, list: Placement[], sink: number) => {
      if (!mesh) return
      list.forEach((p, i) => {
        dummy.position.set(p.x, p.y + sink, p.z)
        dummy.rotation.set(p.rx, p.ry, p.rz)
        dummy.scale.set(p.sx, p.sy, p.sz)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    apply(rocksRef.current, rocks, 0)
    apply(driftsRef.current, drifts, 0.15)
  }, [rocks, drifts])

  const pathGeos = useMemo(() => PATHS.map((pts) => buildPathGeometry(pts, 3.4)), [])
  const fastIceGeo = useMemo(() => buildFastIceGeometry(), [])

  return (
    <group name="BharatiTerrain" userData={{ stationId: 'BharatiTerrain' }}>
      {/* Height-mapped ground with vertex-coloured gneiss / snow / blue ice */}
      <mesh name="BharatiGround" geometry={terrainGeo} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.96} metalness={0} />
      </mesh>

      {/* Compacted-snow access paths */}
      <group name="BharatiAccessPaths">
        {pathGeos.map((g, i) => (
          <mesh key={i} geometry={g} receiveShadow>
            <meshStandardMaterial color="#a7b3bf" roughness={0.98} metalness={0} />
          </mesh>
        ))}
      </group>

      {/* Scattered boulders (instanced) */}
      <instancedMesh
        ref={rocksRef}
        name="BharatiScatterRocks"
        args={[rockGeo, rockMat, rocks.length]}
        castShadow
        receiveShadow
      />

      {/* Snow drifts (instanced) */}
      <instancedMesh
        ref={driftsRef}
        name="BharatiScatterDrifts"
        args={[driftGeo, driftMat, drifts.length]}
        castShadow
        receiveShadow
      />

      {/* Open polar water along the western boundary */}
      <mesh name="BharatiCoastalWater" position={[-165, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[70, 270]} />
        <meshStandardMaterial color="#33566f" roughness={0.22} metalness={0.08} />
      </mesh>

      {/* Wavy fast-ice shelf between the shore and the open water */}
      <mesh name="BharatiSeaIce" geometry={fastIceGeo} receiveShadow>
        <meshStandardMaterial color="#cfe3f2" roughness={0.32} metalness={0} />
      </mesh>
    </group>
  )
}
