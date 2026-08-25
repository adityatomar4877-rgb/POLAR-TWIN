import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Box, Sphere, Text } from '@react-three/drei';
import { useQuery } from '@tanstack/react-query';
import { getStationEquipment } from '../../api/stations';
import type { Equipment } from '../../api/types';

// Helper component for a glowing status indicator light
const StatusLight = ({ position, status }: { position: [number, number, number], status: string }) => {
  let color = '#3f3f46'; // OFFLINE
  if (status === 'RUNNING' || status === 'ONLINE' || status === 'DISCHARGING' || status === 'CHARGING') color = '#10b981'; // HEALTHY
  if (status === 'WARNING') color = '#f59e0b';
  if (status === 'CRITICAL' || status === 'FAILED') color = '#ef4444';
  if (status === 'STARTING') color = '#06b6d4';
  
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshBasicMaterial color={color} />
      {/* Fake glow */}
      <pointLight color={color} distance={2} intensity={2} />
    </mesh>
  );
};

export const DigitalTwinScene = ({ stationId }: { stationId: number }) => {
  const { data: equipment } = useQuery({
    queryKey: ['equipment', stationId],
    queryFn: () => getStationEquipment(stationId),
  });

  const getEq = (name: string): Equipment | undefined => {
    return equipment?.find(e => e.name === name);
  };

  const gen1 = getEq('Generator 1');
  const gen2 = getEq('Generator 2');
  const bat = getEq('Battery Storage Bank');

  return (
    <Canvas camera={{ position: [15, 12, 15], fov: 45 }}>
      <color attach="background" args={['#020617']} />
      
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} />
      <Environment preset="city" />

      {/* Main Base Platform (Ice/Snow) */}
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <cylinderGeometry args={[15, 15, 1, 64]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>
      
      <ContactShadows resolution={1024} scale={20} blur={2} opacity={0.5} far={10} color="#000000" />

      {/* Main Station Building */}
      <group position={[0, 1, -2]}>
        <Box args={[8, 3, 5]} castShadow receiveShadow>
          <meshStandardMaterial color="#1e293b" />
        </Box>
        <Text position={[0, 2, 2.6]} fontSize={0.5} color="#cbd5e1" anchorX="center" anchorY="middle">
          {stationId === 1 ? 'MAITRI HQ' : 'BHARATI HQ'}
        </Text>
      </group>

      {/* Generator 1 Area */}
      <group position={[-6, 1, 3]}>
        <Box args={[2, 2, 3]} castShadow receiveShadow>
          <meshStandardMaterial color="#334155" />
        </Box>
        <StatusLight position={[0, 1.2, 0]} status={gen1?.status || 'OFFLINE'} />
        <Text position={[0, 2, 0]} fontSize={0.4} color="#94a3b8">GEN-1</Text>
      </group>

      {/* Generator 2 Area */}
      <group position={[-2, 1, 4.5]}>
        <Box args={[2, 2, 3]} castShadow receiveShadow>
          <meshStandardMaterial color="#334155" />
        </Box>
        <StatusLight position={[0, 1.2, 0]} status={gen2?.status || 'OFFLINE'} />
        <Text position={[0, 2, 0]} fontSize={0.4} color="#94a3b8">GEN-2</Text>
      </group>

      {/* Battery Bank Area */}
      <group position={[5, 1, 3]}>
        <Box args={[4, 1.5, 2]} castShadow receiveShadow>
          <meshStandardMaterial color="#0f766e" />
        </Box>
        <StatusLight position={[0, 1, 0]} status={bat?.status || 'OFFLINE'} />
        <Text position={[0, 2, 0]} fontSize={0.4} color="#94a3b8">BATT-BANK</Text>
      </group>

      <OrbitControls 
        enablePan={false} 
        minPolarAngle={Math.PI / 6} 
        maxPolarAngle={Math.PI / 2 - 0.1}
        minDistance={10}
        maxDistance={30}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
};
