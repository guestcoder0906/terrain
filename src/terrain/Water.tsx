import React from 'react';
import * as THREE from 'three';
import { getTerrainY, riverNoise } from './utils';

export const WaterBasins = ({ basins, waterColor, waterOpacity, hillSteepness, hillDensity, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, rivers }: any) => {
  return (
    <group>
      {basins.map((basin: any, idx: number) => {
        const sampleCount = 32;
        let minEdgeHeight = Infinity;
        
        for (let i = 0; i < sampleCount; i++) {
          const angle = (i / sampleCount) * Math.PI * 2;
          const edgeX = basin.x + Math.cos(angle) * basin.radius;
          const edgeZ = basin.z + Math.sin(angle) * basin.radius;
          const edgeHeight = getTerrainY(edgeX, edgeZ, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, rivers);
          minEdgeHeight = Math.min(minEdgeHeight, edgeHeight);
        }
        
        const waterLevel = minEdgeHeight - 0.3;
        
        return (
          <mesh key={`water-${idx}`} position={[basin.x, waterLevel, basin.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[basin.radius * 0.95, 32]} />
            <meshBasicMaterial color={waterColor} transparent opacity={waterOpacity} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
};

export const Rivers = ({ rivers, waterColor, waterOpacity, hillSteepness, hillDensity, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins }: any) => {
  return (
    <group>
      {rivers.map((river: any, idx: number) => {
        const riverPoints = [];
        for (let i = 0; i < river.path.length; i++) {
          const p = river.path[i];
          const terrainY = getTerrainY(p.x, p.z, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, rivers);
          const waterDepth = (river.width / 8) * 1.5;
          riverPoints.push(new THREE.Vector3(p.x, terrainY + waterDepth, p.z));
        }

        const curve = new THREE.CatmullRomCurve3(riverPoints);
        const points = curve.getPoints(river.path.length * 4);
        
        const riverVertices = [];
        const riverIndices = [];

        for (let i = 0; i < points.length; i++) {
          const currentPoint = points[i];
          const nextPoint = (i < points.length - 1) ? points[i + 1] : currentPoint;
          
          const direction = new THREE.Vector3().subVectors(nextPoint, currentPoint).normalize();
          const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
          
          const currentWidth = river.width * (0.8 + riverNoise(i * 0.05, river.seed) * 0.4);
          
          const v1 = new THREE.Vector3().copy(currentPoint).addScaledVector(perpendicular, currentWidth / 2);
          const v2 = new THREE.Vector3().copy(currentPoint).addScaledVector(perpendicular, -currentWidth / 2);
          
          riverVertices.push(v1.x, v1.y, v1.z);
          riverVertices.push(v2.x, v2.y, v2.z);
        }

        for (let i = 0; i < points.length - 1; i++) {
          const i2 = i * 2;
          riverIndices.push(i2, i2 + 1, i2 + 2);
          riverIndices.push(i2 + 1, i2 + 3, i2 + 2);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(riverVertices, 3));
        geometry.setIndex(riverIndices);
        geometry.computeVertexNormals();

        return (
          <mesh key={`river-${idx}`} geometry={geometry}>
            <meshBasicMaterial color={waterColor} transparent opacity={waterOpacity} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
};
