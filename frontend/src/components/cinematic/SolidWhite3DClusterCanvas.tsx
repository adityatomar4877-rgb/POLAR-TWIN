import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Props {
  scrollProgress: number; // 0 to 1
}

export default function SolidWhite3DClusterCanvas({ scrollProgress }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(scrollProgress);
  scrollRef.current = scrollProgress;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 11);

    // 2. WebGL Renderer with Anti-Aliasing and Alpha Transparency
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 3. Studio Lighting for Solid White Porcelain Aesthetic
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(7, 9, 8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe2e8f0, 1.6);
    fillLight.position.set(-8, -5, 5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 2.4);
    rimLight.position.set(0, -8, -6);
    scene.add(rimLight);

    const topSoftGlint = new THREE.DirectionalLight(0xffffff, 1.8);
    topSoftGlint.position.set(0, 10, 0);
    scene.add(topSoftGlint);

    // 4. Solid Pure-White Porcelain Material (No sharp facets, ultra-smooth specular gloss)
    const whiteMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffffff),
      roughness: 0.16,
      metalness: 0.04,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      reflectivity: 0.95,
    });

    // 5. Build Smooth 3D Geometries with ZERO Sharp Edges
    // A) Ultra-Smooth Sphere
    const sphereGeo = new THREE.SphereGeometry(1.05, 64, 64);
    const sphereMesh = new THREE.Mesh(sphereGeo, whiteMaterial);

    // B) Smooth Donut / Torus
    const torusGeo = new THREE.TorusGeometry(1.2, 0.42, 36, 100);
    const torusMesh = new THREE.Mesh(torusGeo, whiteMaterial);

    // C) Smooth Rounded Box / Pillowed Cube (Created via subdivided sphere with smooth cubic expansion)
    // Custom rounded cube geometry with smooth rounded corners
    const roundedCubeGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6, 16, 16, 16);
    // Smooth the vertices to give a rounded pillow effect
    const pos = roundedCubeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      const len = v.length();
      // Interpolate towards spherical normalized radius for pillowed chamfer
      v.normalize().multiplyScalar(len * 0.88 + 0.18);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    roundedCubeGeo.computeVertexNormals();
    const roundedCubeMesh = new THREE.Mesh(roundedCubeGeo, whiteMaterial);

    // D) Smooth Capsule / Pill
    const capsuleGeo = new THREE.CapsuleGeometry(0.65, 1.3, 32, 64);
    const capsuleMesh = new THREE.Mesh(capsuleGeo, whiteMaterial);

    // E) Smooth Cylinder with Rounded Chamfered Caps
    const cylinderGeo = new THREE.CylinderGeometry(0.85, 0.85, 1.7, 64, 16);
    cylinderGeo.computeVertexNormals();
    const cylinderMesh = new THREE.Mesh(cylinderGeo, whiteMaterial);

    // F) Smooth Torus Knot (Organic curved infinite loop)
    const knotGeo = new THREE.TorusKnotGeometry(0.8, 0.28, 128, 32, 2, 3);
    const knotMesh = new THREE.Mesh(knotGeo, whiteMaterial);

    // 6. Assemble into a Constellation Group that Revolves Altogether
    const constellationGroup = new THREE.Group();

    // Initial orbital positions around center
    sphereMesh.position.set(-2.8, 1.6, 0.5);
    torusMesh.position.set(2.9, -1.5, -0.6);
    roundedCubeMesh.position.set(2.4, 1.8, 0.8);
    capsuleMesh.position.set(-2.6, -1.8, 0.4);
    cylinderMesh.position.set(0.2, 0.1, -1.2);
    knotMesh.position.set(-0.3, -2.4, 0.9);

    const meshes = [
      { mesh: sphereMesh, basePos: new THREE.Vector3(-2.8, 1.6, 0.5), rotSpeed: { x: 0.5, y: 0.7, z: 0.3 } },
      { mesh: torusMesh, basePos: new THREE.Vector3(2.9, -1.5, -0.6), rotSpeed: { x: 0.4, y: 0.3, z: 0.8 } },
      { mesh: roundedCubeMesh, basePos: new THREE.Vector3(2.4, 1.8, 0.8), rotSpeed: { x: 0.6, y: 0.5, z: 0.4 } },
      { mesh: capsuleMesh, basePos: new THREE.Vector3(-2.6, -1.8, 0.4), rotSpeed: { x: 0.3, y: 0.8, z: 0.5 } },
      { mesh: cylinderMesh, basePos: new THREE.Vector3(0.2, 0.1, -1.2), rotSpeed: { x: 0.7, y: 0.4, z: 0.2 } },
      { mesh: knotMesh, basePos: new THREE.Vector3(-0.3, -2.4, 0.9), rotSpeed: { x: 0.5, y: 0.6, z: 0.3 } },
    ];

    meshes.forEach((item) => constellationGroup.add(item.mesh));
    scene.add(constellationGroup);

    // 7. Render Loop with Opposite Revolution & Individual Rotation
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      const p = scrollRef.current; // 0 to 1

      // ─────────────────────────────────────────────────────────────
      // REVOLVE ALLTOGETHER IN REVERSED HORIZONTAL DIRECTION
      // ─────────────────────────────────────────────────────────────
      constellationGroup.rotation.y = p * Math.PI * 3.2 - elapsedTime * 0.12;
      constellationGroup.position.x = (0.5 - p) * 4.2;
      constellationGroup.position.y = -Math.sin(p * Math.PI * 2) * 0.35;
      constellationGroup.rotation.z = -Math.sin(p * Math.PI * 2) * 0.18;

      // Rotate each individual solid 3D shape while shuffling position
      meshes.forEach(({ mesh, basePos, rotSpeed }, idx) => {
        // Individual multi-axis rotation linked to scroll + idle spin
        mesh.rotation.x = elapsedTime * rotSpeed.x + p * Math.PI * 4 * rotSpeed.x;
        mesh.rotation.y = elapsedTime * rotSpeed.y + p * Math.PI * 5 * rotSpeed.y;
        mesh.rotation.z = elapsedTime * rotSpeed.z + p * Math.PI * 3 * rotSpeed.z;

        // Dynamic spatial position shuffling along orbital waves
        const wave = Math.sin(elapsedTime * 1.5 + idx * 1.3 - p * Math.PI * 4);
        mesh.position.y = basePos.y + wave * 0.38;
        mesh.position.x = basePos.x + Math.cos(elapsedTime * 1.2 + idx - p * Math.PI * 3) * 0.28;
      });

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 8. Handle Window Resize
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      // Cleanup geometries and material
      sphereGeo.dispose();
      torusGeo.dispose();
      roundedCubeGeo.dispose();
      capsuleGeo.dispose();
      cylinderGeo.dispose();
      knotGeo.dispose();
      whiteMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden opacity-95"
    />
  );
}
