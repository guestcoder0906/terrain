import React, { useMemo } from 'react';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getTerrainY } from './utils';

const Tree = ({ position, trunkColor, leafColor, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, rivers }: any) => {
  const treeData = useMemo(() => {
    const seed = position.x * 100 + position.z;
    const rand = (s: number) => {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
    };

    const trunkHeight = 8 + rand(seed) * 5;
    const trunkRadius = 0.3 + rand(seed + 1) * 0.4;

    const trunkGeometries = [];
    const leafGeometries = [];

    const trunkGeom = new THREE.CylinderGeometry(trunkRadius * 0.8, trunkRadius, trunkHeight, 8);
    trunkGeom.translate(0, trunkHeight / 2, 0);
    trunkGeometries.push(trunkGeom);

    const numBranches = Math.floor(4 + rand(seed + 2) * 4);
    for (let i = 0; i < numBranches; i++) {
      let currentPos = new THREE.Vector3(0, trunkHeight * (0.6 + rand(seed + 3 + i) * 0.4), 0);
      let currentRadius = trunkRadius * (0.5 + rand(seed + 4 + i) * 0.3);
      let currentDirection = new THREE.Vector3(
        rand(seed + 5 + i * 10) - 0.5,
        rand(seed + 6 + i * 10) * 0.5 + 0.2,
        rand(seed + 7 + i * 10) - 0.5
      ).normalize();

      const numSegments = Math.floor(2 + rand(seed + 8 + i) * 2);
      for (let j = 0; j < numSegments; j++) {
        const segmentLength = 2.0 + rand(seed + 9 + i * 10 + j) * 2.0;
        const nextPos = currentPos.clone().add(currentDirection.clone().multiplyScalar(segmentLength));

        const branchSegmentGeom = new THREE.CylinderGeometry(currentRadius * 0.7, currentRadius, segmentLength, 5);
        
        const orientation = new THREE.Matrix4();
        const offsetRotation = new THREE.Matrix4();
        const offsetPosition = new THREE.Matrix4();
        orientation.lookAt(currentPos, nextPos, new THREE.Vector3(0, 1, 0));
        offsetRotation.makeRotationX(Math.PI / 2);
        orientation.multiply(offsetRotation);
        offsetPosition.makeTranslation((currentPos.x + nextPos.x) / 2, (currentPos.y + nextPos.y) / 2, (currentPos.z + nextPos.z) / 2);
        branchSegmentGeom.applyMatrix4(orientation.premultiply(offsetPosition));

        trunkGeometries.push(branchSegmentGeom);

        if (j === numSegments - 1) {
            const numLeafClusters = 3 + Math.floor(rand(seed + i * j) * 4);
            for (let k = 0; k < numLeafClusters; k++) {
                const leafClusterPos = nextPos.clone().add(
                    new THREE.Vector3(
                        (rand(seed + k * 10) - 0.5) * 2,
                        (rand(seed + k * 11) - 0.5) * 2,
                        (rand(seed + k * 12) - 0.5) * 2
                    )
                );
                const baseLeafSize = 1.8 + rand(seed + k * 13) * 1.2;
                
                const numLeavesPerCluster = 10 + Math.floor(rand(seed + k * 17) * 10);
                for (let l = 0; l < numLeavesPerCluster; l++) {
                    const leafOffset = new THREE.Vector3(
                        (rand(seed + k * 18 + l * 10) - 0.5) * baseLeafSize * 1.2,
                        (rand(seed + k * 19 + l * 10) - 0.5) * baseLeafSize * 1.2,
                        (rand(seed + k * 20 + l * 10) - 0.5) * baseLeafSize * 1.2
                    );
                    const leafPosition = leafClusterPos.clone().add(leafOffset);
                    
                    const leafSize = baseLeafSize * (0.4 + rand(seed + k * 21 + l * 10) * 0.4);
                    const leafGeom = new THREE.SphereGeometry(leafSize, 5, 4);
                    leafGeom.scale(0.8 + rand(seed+k*22+l*10)*0.4, 1.0 + rand(seed+k*23+l*10)*0.5, 0.8 + rand(seed+k*24+l*10)*0.4);
                    leafGeom.translate(leafPosition.x, leafPosition.y, leafPosition.z);
                    leafGeometries.push(leafGeom);
                }
            }
        }

        currentPos = nextPos;
        currentRadius *= 0.7;
        currentDirection.x += (rand(seed + 10 + i * 10 + j) - 0.5) * 0.8;
        currentDirection.y += (rand(seed + 11 + i * 10 + j) - 0.5) * 0.4;
        currentDirection.z += (rand(seed + 12 + i * 10 + j) - 0.5) * 0.8;
        currentDirection.normalize();
      }
    }

    const mergedTrunkGeometry = BufferGeometryUtils.mergeGeometries(trunkGeometries);
    const mergedLeafGeometry = leafGeometries.length > 0 ? BufferGeometryUtils.mergeGeometries(leafGeometries) : null;
    
    if (!mergedTrunkGeometry) return null;

    const y = getTerrainY(position.x, position.z, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, rivers);
    mergedTrunkGeometry.translate(position.x, y, position.z);
    if (mergedLeafGeometry) {
        mergedLeafGeometry.translate(position.x, y, position.z);
    }

    return { trunk: mergedTrunkGeometry, leaves: mergedLeafGeometry, baseY: y, radius: trunkRadius };
  }, [position, trunkColor, leafColor, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, rivers]);

  if (!treeData) return null;

  return (
    <group>
        <mesh geometry={treeData.trunk} castShadow>
            <meshStandardMaterial color={trunkColor} />
        </mesh>
        {treeData.leaves && (
            <mesh geometry={treeData.leaves} castShadow>
                <meshStandardMaterial color={leafColor} />
            </mesh>
        )}
    </group>
  );
};

export const Forest = ({ treePositions, trunkColor, leafColor, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, rivers }: any) => {
  return (
    <group>
      {treePositions.map((pos: any, i: number) => (
        <Tree 
          key={i} 
          position={pos} 
          trunkColor={trunkColor} 
          leafColor={leafColor}
          hillDensity={hillDensity}
          hillSteepness={hillSteepness}
          plainsPrevalence={plainsPrevalence}
          hillsPrevalence={hillsPrevalence}
          mountainPrevalence={mountainPrevalence}
          mountainHeight={mountainHeight}
          basins={basins}
          rivers={rivers}
        />
      ))}
    </group>
  );
};
