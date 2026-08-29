import * as THREE from 'three'

export interface SystemBounds {
  center: THREE.Vector3
  radius: number
}

/**
 * World-space bounding sphere of a station system group. Used by the camera
 * glide (framing distance) and the selection ring (footprint radius).
 */
export function measureSystemBounds(scene: THREE.Object3D, systemId: string): SystemBounds | null {
  const root = scene.getObjectByName(systemId)
  if (!root) return null
  const box = new THREE.Box3().setFromObject(root)
  if (box.isEmpty()) return null
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  return { center: sphere.center.clone(), radius: sphere.radius }
}
