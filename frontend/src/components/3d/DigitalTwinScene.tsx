import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Box, Sphere, Text, Line, Cone } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useQuery } from '@tanstack/react-query';
import { getStationEquipment, getStationDashboard } from '../../api/stations';
import type { Equipment } from '../../api/types';

/* ---------------- helpers ---------------- */

const STATUS_COLORS: Record<string, string> = {
  RUNNING: '#10b981',
  ONLINE: '#10b981',
  CHARGING: '#10b981',
  DISCHARGING: '#10b981',
  STARTING: '#06b6d4',
  WARNING: '#f59e0b',
  DEGRADED: '#f59e0b',
  CRITICAL: '#ef4444',
  FAILED: '#ef4444',
  OFFLINE: '#3f3f46',
  ISOLATED: '#a78bfa',
};

const statusColor = (status: string) => STATUS_COLORS[status] ?? '#94a3b8';

const isFaulted = (status: string) =>
  ['WARNING', 'DEGRADED', 'CRITICAL', 'FAILED', 'OFFLINE'].includes(status);

interface PinTarget {
  equipmentId: number | null;
  label: string;
  focus: [number, number, number];
}

interface DigitalTwinSceneProps {
  stationId: number;
  interactive?: boolean;
  compact?: boolean;
  lightMode?: boolean;
  selectedEquipmentId?: number | null;
  onSubsystemSelect?: (equipmentId: number | null, label: string | null) => void;
}

/* ---------------- status light + fault aura ---------------- */

function StatusLight({ position, status }: { position: [number, number, number]; status: string }) {
  const color = statusColor(status);
  const auraRef = useRef<THREE.Mesh>(null);
  const faulted = isFaulted(status);

  useFrame(({ clock }) => {
    const m = auraRef.current;
    if (!m) return;
    if (faulted) {
      const s = 1 + Math.sin(clock.elapsedTime * 4.5) * 0.35;
      m.scale.setScalar(s);
    }
  });

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color={color} />
        <pointLight color={color} distance={3} intensity={faulted ? 3.5 : 2} />
      </mesh>
      {faulted && (
        <mesh ref={auraRef}>
          <sphereGeometry args={[0.42, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.22} />
        </mesh>
      )}
    </group>
  );
}

/* ---------------- rotating wind turbine ---------------- */

function WindTurbine({
  position,
  scale = 1,
  windKmh,
}: {
  position: [number, number, number];
  scale?: number;
  windKmh: number;
}) {
  const rotorRef = useRef<THREE.Group>(null);
  // RPM scales with live wind telemetry
  const rotSpeed = Math.max(windKmh, 4) / 14;

  useFrame((_, delta) => {
    if (rotorRef.current) rotorRef.current.rotation.z -= delta * rotSpeed;
  });

  return (
    <group position={position} scale={scale}>
      {/* tower */}
      <mesh position={[0, 2.6, 0]}>
        <cylinderGeometry args={[0.09, 0.16, 5.2, 8]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.4} metalness={0.4} />
      </mesh>
      {/* nacelle */}
      <mesh position={[0, 5.25, 0]}>
        <capsuleGeometry args={[0.18, 0.7, 4, 8]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.35} metalness={0.5} />
      </mesh>
      {/* rotor */}
      <group ref={rotorRef} position={[0.55, 5.25, 0]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 0.12, 8]} />
          <meshStandardMaterial color="#f1f5f9" />
        </mesh>
        {[0, 120, 240].map((deg) => (
          <mesh key={deg} rotation={[0, 0, (deg * Math.PI) / 180]} position={[0, 0, 0]}>
            <boxGeometry args={[0.09, 2.6, 0.04]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.3} />
          </mesh>
        ))}
      </group>
      {/* blinking beacon */}
      <Beacon position={[0, 5.9, 0]} />
    </group>
  );
}

function Beacon({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const mat = ref.current?.material as THREE.MeshBasicMaterial | undefined;
    if (mat) mat.opacity = 0.35 + 0.65 * Math.abs(Math.sin(clock.elapsedTime * 2.2));
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.07, 8, 8]} />
      <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
    </mesh>
  );
}

/* ---------------- sun-tracking solar array ---------------- */

function SolarArray({ position }: { position: [number, number, number] }) {
  const tiltRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (tiltRef.current) {
      // Gentle daily sun-tracking oscillation
      const angle = Math.sin(clock.elapsedTime * 0.05) * 0.45;
      tiltRef.current.rotation.x = -0.62 + angle;
    }
  });

  return (
    <group position={position}>
      <group ref={tiltRef}>
        {[0, 1, 2].map((row) =>
          [0, 1].map((col) => (
            <mesh key={`${row}-${col}`} position={[col * 1.35 - 0.68, row * 0.02, row * 0.85 - 0.85]}>
              <boxGeometry args={[1.15, 0.05, 0.72]} />
              <meshStandardMaterial
                color="#0e2a47"
                emissive="#0369a1"
                emissiveIntensity={0.55}
                metalness={0.75}
                roughness={0.22}
              />
            </mesh>
          ))
        )}
      </group>
      {/* struts */}
      {[-0.9, 0.9].map((z) => (
        <mesh key={z} position={[0, 0.32, z]}>
          <cylinderGeometry args={[0.04, 0.04, 0.65, 6]} />
          <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- animated energy flow particles ---------------- */

function FlowLine({
  from,
  to,
  color,
  active,
  reverse = false,
  count = 6,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  active: boolean;
  reverse?: boolean;
  count?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const offsets = useMemo(
    () => Array.from({ length: count }, (_, i) => i / count),
    [count]
  );

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const visible = active ? 1 : 0;
    g.visible = active;
    if (!active) return;
    g.children.forEach((child, i) => {
      let t = (clock.elapsedTime * 0.28 + offsets[i]) % 1;
      if (reverse) t = 1 - t;
      child.position.set(
        THREE.MathUtils.lerp(from[0], to[0], t),
        THREE.MathUtils.lerp(from[1], to[1], t),
        THREE.MathUtils.lerp(from[2], to[2], t)
      );
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = visible * (0.35 + 0.65 * Math.sin(t * Math.PI));
    });
  });

  return (
    <group>
      <Line points={[from, to]} color={color} lineWidth={0.8} transparent opacity={0.25} dashed dashSize={0.35} gapSize={0.25} />
      <group ref={groupRef}>
        {offsets.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.11, 8, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ---------------- clickable pin marker ---------------- */

function SubsystemPin({
  position,
  label,
  equipmentId,
  status,
  selected,
  onSelect,
}: {
  position: [number, number, number];
  label: string;
  equipmentId: number | null;
  status?: string;
  selected: boolean;
  onSelect?: (equipmentId: number | null, label: string | null) => void;
}) {
  const pinRef = useRef<THREE.Group>(null);
  const faulted = status ? isFaulted(status) : false;

  useFrame(({ clock }) => {
    if (pinRef.current) {
      pinRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.8) * 0.12;
      pinRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group
      ref={pinRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(equipmentId, label);
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
    >
      <Cone args={[0.28, 0.6, 4]} rotation={[Math.PI, 0, 0]}>
        <meshStandardMaterial
          color={selected ? '#22d3ee' : faulted ? '#ef4444' : '#38bdf8'}
          emissive={selected ? '#22d3ee' : faulted ? '#ef4444' : '#0ea5e9'}
          emissiveIntensity={0.8}
        />
      </Cone>
      <Text
        position={[0, 0.72, 0]}
        fontSize={0.34}
        color={selected ? '#67e8f9' : '#94a3b8'}
        anchorX="center"
        outlineWidth={0.012}
        outlineColor="#020617"
      >
        {label}
      </Text>
    </group>
  );
}

/* ---------------- camera rig ---------------- */

function CameraRig({
  controlsRef,
  focus,
  interactive,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  focus: [number, number, number] | null;
  interactive: boolean;
}) {
  const targetVec = useRef(new THREE.Vector3(0, 0.5, 0));

  useFrame(({ camera }, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (focus) {
      targetVec.current.lerp(new THREE.Vector3(...focus), Math.min(delta * 3, 0.2));
      controls.target.copy(targetVec.current);
      const desired = new THREE.Vector3(focus[0] + 6, focus[1] + 4.5, focus[2] + 6);
      camera.position.lerp(desired, Math.min(delta * 2, 0.15));
    } else if (!interactive) {
      // cinematic slow orbit for story mode
      const t = performance.now() / 1000;
      const r = 17;
      camera.position.lerp(
        new THREE.Vector3(Math.sin(t * 0.08) * r, 9.5, Math.cos(t * 0.08) * r),
        Math.min(delta, 0.05)
      );
      controls.target.lerp(targetVec.current, 0.06);
    }
    controls.update();
  });

  return null;
}

/* ---------------- main scene ---------------- */

export const DigitalTwinScene = ({
  stationId,
  interactive = true,
  compact = false,
  lightMode = false,
  selectedEquipmentId = null,
  onSubsystemSelect,
}: DigitalTwinSceneProps) => {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const { data: equipment } = useQuery({
    queryKey: ['equipment', stationId],
    queryFn: () => getStationEquipment(stationId),
    enabled: stationId != null,
  });

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => getStationDashboard(stationId),
    enabled: stationId != null,
    refetchInterval: 15000,
  });

  const windKmh = dashboard?.environment?.wind_speed_kmh ?? 24;
  const energy = dashboard?.energy;
  const batteryCharging = (energy?.battery_power_kw ?? 0) > 0;

  const getEq = (name: string): Equipment | undefined =>
    equipment?.find((e) => e.name === name);

  const gen1 = getEq('Generator 1');
  const gen2 = getEq('Generator 2');
  const bat = getEq('Battery Storage Bank');
  const hvac = equipment?.find((e) => e.equipment_type?.toUpperCase().includes('HVAC'));
  const solarEq = equipment?.find((e) => e.equipment_type?.toUpperCase().includes('SOLAR'));

  const pins: PinTarget[] = [
    { equipmentId: gen1?.id ?? null, label: 'GEN-1', focus: [-6.5, 1.2, 3] },
    { equipmentId: gen2?.id ?? null, label: 'GEN-2', focus: [-2.2, 1.2, 4.8] },
    { equipmentId: bat?.id ?? null, label: 'BATTERY', focus: [5.2, 1, 3] },
    { equipmentId: solarEq?.id ?? null, label: 'SOLAR', focus: [-4.5, 1, -4] },
    { equipmentId: hvac?.id ?? null, label: 'HVAC', focus: [0.5, 3.2, -2] },
  ];

  const handleSelect = (equipmentId: number | null, label: string | null) => {
    onSubsystemSelect?.(equipmentId, label);
  };

  const focusPin = pins.find(
    (p) => p.equipmentId != null && p.equipmentId === selectedEquipmentId
  );

  const maitri = stationId === 1;

  return (
    <Canvas camera={{ position: [15, 12, 15], fov: 45 }} dpr={[1, 1.8]}>
      <color attach="background" args={[lightMode ? '#d8e5f2' : '#020617']} />

      <ambientLight intensity={lightMode ? 1.0 : 0.3} />
      <directionalLight position={[10, 20, 10]} intensity={lightMode ? 1.7 : 1.4} />
      <directionalLight position={[-12, 8, -8]} intensity={lightMode ? 0.6 : 0.35} color="#38bdf8" />

      {/* Ice platform */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[15, 15, 1, 64]} />
        <meshStandardMaterial color={lightMode ? '#eef3f8' : '#0f172a'} roughness={lightMode ? 0.95 : 0.85} />
      </mesh>
      {!compact && (
        <gridHelper
          args={[30, 30, ...(lightMode ? (['#b6c6d8', '#d4e0ec'] as const) : (['#164e63', '#0b1a33'] as const))]}
          position={[0, 0.02, 0]}
        />
      )}
      <ContactShadows resolution={1024} scale={20} blur={2} opacity={lightMode ? 0.25 : 0.5} far={10} color={lightMode ? '#94a3b8' : '#000000'} />

      {/* Main station building — distinct architecture per station */}
      <group position={[0, 0, -2]}>
        {maitri ? (
          /* Maitri: modular blocks */
          <group position={[0, 1.4, 0]}>
            <Box args={[8, 2.8, 5]} castShadow receiveShadow>
              <meshStandardMaterial color="#1e293b" roughness={0.6} />
            </Box>
            <Box args={[2.4, 2, 2.4]} position={[-4.6, -0.4, 0.6]} castShadow>
              <meshStandardMaterial color="#27354d" roughness={0.6} />
            </Box>
            <Box args={[2, 1.7, 2.2]} position={[4.4, -0.55, -0.8]} castShadow>
              <meshStandardMaterial color="#27354d" roughness={0.6} />
            </Box>
            {[-2.8, -0.9, 1, 2.9].map((x) => (
              <mesh key={x} position={[x, 0.2, 2.53]}>
                <planeGeometry args={[0.9, 0.7]} />
                <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.5} />
              </mesh>
            ))}
          </group>
        ) : (
          /* Bharati: aerodynamic stilt pods */
          <group position={[0, 0, 0]}>
            {/* stilts */}
            {[-3, -1, 1, 3].map((x) =>
              [-1.6, 1.6].map((z) => (
                <mesh key={`${x}:${z}`} position={[x, 0.75, z]}>
                  <cylinderGeometry args={[0.12, 0.14, 1.5, 8]} />
                  <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.5} />
                </mesh>
              ))
            )}
            {/* raised hull */}
            <group position={[0, 2.4, 0]}>
              <Box args={[8.4, 1.8, 4.6]} castShadow receiveShadow>
                <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.25} />
              </Box>
              {/* sloped roof shell */}
              <mesh position={[0, 1.05, 0]} castShadow>
                <capsuleGeometry args={[1.9, 6.4, 6, 14]} />
                <meshStandardMaterial color="#263650" roughness={0.35} metalness={0.35} />
              </mesh>
              <Text position={[0, 2.6, 2.4]} fontSize={0.5} color="#cbd5e1" anchorX="center" anchorY="middle">
                BHARATI HQ
              </Text>
            </group>
          </group>
        )}
        {maitri && (
          <Text position={[0, 3.6, 0.6]} fontSize={0.5} color="#cbd5e1" anchorX="center" anchorY="middle">
            MAITRI HQ
          </Text>
        )}
      </group>

      {/* Generator 1 */}
      <group position={[-6.5, 1, 3]}>
        <Box args={[2, 2, 3]} castShadow receiveShadow>
          <meshStandardMaterial color="#334155" />
        </Box>
        <mesh position={[0.7, 1.35, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.7, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.5} />
        </mesh>
        <StatusLight position={[0, 1.25, 0]} status={gen1?.status || 'OFFLINE'} />
      </group>

      {/* Generator 2 */}
      <group position={[-2.2, 1, 4.8]}>
        <Box args={[2, 2, 3]} castShadow receiveShadow>
          <meshStandardMaterial color="#334155" />
        </Box>
        <mesh position={[0.7, 1.35, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.7, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.5} />
        </mesh>
        <StatusLight position={[0, 1.25, 0]} status={gen2?.status || 'OFFLINE'} />
      </group>

      {/* Battery bank */}
      <group position={[5.2, 0.75, 3]}>
        <Box args={[4, 1.5, 2]} castShadow receiveShadow>
          <meshStandardMaterial color="#0f766e" emissive="#134e4a" emissiveIntensity={0.4} />
        </Box>
        <StatusLight position={[0, 1.05, 0]} status={bat?.status || 'OFFLINE'} />
      </group>

      {/* Solar array */}
      <group position={[-4.5, 0.9, -4]}>
        <SolarArray position={[0, 0, 0]} />
        {solarEq && <StatusLight position={[1.6, 0.4, 0.6]} status={solarEq.status} />}
      </group>

      {/* Wind turbines driven by live wind */}
      <WindTurbine position={[-9.5, 0, -5]} windKmh={windKmh} />
      <WindTurbine position={[-11.5, 0, -1]} scale={0.82} windKmh={windKmh} />

      {/* Radome */}
      <group position={[8.5, 0.9, -4.5]}>
        <Sphere args={[1.5, 20, 20]}>
          <meshStandardMaterial color="#94a3b8" roughness={0.5} transparent opacity={0.85} />
        </Sphere>
        <mesh position={[0, -0.9, 0]}>
          <cylinderGeometry args={[1.2, 1.4, 0.5, 16]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      </group>

      {/* Energy flows: generation -> battery, battery <-> HQ */}
      <FlowLine
        from={[-5.5, 2.1, 3]}
        to={[3.2, 1.6, 3]}
        color="#22d3ee"
        active={(gen1?.status === 'RUNNING' || gen2?.status === 'RUNNING') ?? true}
      />
      <FlowLine
        from={[3.2, 1.6, 3]}
        to={[-4, 1.4, 0.4]}
        color={batteryCharging ? '#34d399' : '#fbbf24'}
        active={(energy?.consumption_kw ?? 1) > 0}
        reverse={!batteryCharging}
      />

      {/* Interactive subsystem pins */}
      {interactive &&
        pins.map((p) => (
          <SubsystemPin
            key={p.label}
            position={[p.focus[0], p.focus[1] + 2.6, p.focus[2]]}
            label={p.label}
            equipmentId={p.equipmentId}
            status={
              equipment?.find((e) => e.id === p.equipmentId)?.status
            }
            selected={selectedEquipmentId === p.equipmentId}
            onSelect={handleSelect}
          />
        ))}

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enabled={interactive}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2 - 0.1}
        minDistance={8}
        maxDistance={30}
        autoRotate={interactive && !focusPin}
        autoRotateSpeed={0.5}
      />
      <CameraRig controlsRef={controlsRef} focus={focusPin ? focusPin.focus : null} interactive={interactive} />
    </Canvas>
  );
};

export default DigitalTwinScene;
