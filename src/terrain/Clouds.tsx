import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const Clouds = () => {
  const groupRef = useRef<THREE.Group>(null!);
  const cloudCount = 50;
  const clouds = useMemo(() => {
    const temp = [];
    for (let i = 0; i < cloudCount; i++) {
      const cloudSize = Math.random() * 20 + 15;
      temp.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 500,
          Math.random() * 40 + 70,
          (Math.random() - 0.5) * 500
        ),
        baseSize: cloudSize,
        speed: Math.random() * 0.8 + 0.4,
        numPuffs: Math.floor(Math.random() * 8 + 5)
      });
    }
    return temp;
  }, []);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((cloudGroup, i) => {
        cloudGroup.position.x += clouds[i].speed * delta;
        if (cloudGroup.position.x > 250) {
          cloudGroup.position.x = -250;
        }
        cloudGroup.children.forEach((puff, j) => {
            puff.rotation.y += delta * 0.05 * (j % 2 === 0 ? 1 : -1);
            puff.position.y = Math.sin(state.clock.elapsedTime * 0.2 + i) * 2;
        });
      });
    }
  });

  return (
    <group ref={groupRef}>
      {clouds.map((cloud, i) => (
        <group key={i} position={cloud.position}>
          {Array.from({ length: cloud.numPuffs }).map((_, j) => {
            const puffSize = cloud.baseSize * (Math.random() * 0.4 + 0.8);
            const puffPosition = new THREE.Vector3(
              (Math.random() - 0.5) * cloud.baseSize * 1.5,
              (Math.random() - 0.5) * cloud.baseSize * 0.5,
              (Math.random() - 0.5) * cloud.baseSize * 1.5
            );
            return (
              <mesh key={j} position={puffPosition}>
                <sphereGeometry args={[puffSize, 8, 6]} />
                <meshBasicMaterial color="white" transparent opacity={0.55} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
};
