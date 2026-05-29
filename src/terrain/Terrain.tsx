import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import { getTerrainY, getBiomeFactors, noise2D, riverNoise } from './utils';

// We need to slightly update GrassMaterial declaration for TS
const GrassMaterial = shaderMaterial(
  {
    uTime: 0,
    uGroundColor: new THREE.Color('#556B2F'),
    uGrassColor1: new THREE.Color('#4F7942'),
    uGrassColor2: new THREE.Color('#6B8E23'),
    uDirtColor1: new THREE.Color('#9B7653'),
    uStoneColor: new THREE.Color('#808080'),
    uSnowColor: new THREE.Color('#FFFFFF'),
    uPlainsPrevalence: 0.4,
    uHillsPrevalence: 0.7,
    uMountainPrevalence: 0.85,
    uSnowLineHeight: 35.0,
  },
  `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    attribute float aInBasin;
    attribute float aInRiver;
    varying float vInBasin;
    varying float vInRiver;

    void main() {
      vUv = uv;
      vNormal = normal;
      vInBasin = aInBasin;
      vInRiver = aInRiver;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  `
    precision mediump float;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vInBasin;
    varying float vInRiver;

    uniform float uTime;
    uniform vec3 uGroundColor;
    uniform vec3 uGrassColor1;
    uniform vec3 uGrassColor2;
    uniform vec3 uDirtColor1;
    uniform vec3 uStoneColor;
    uniform vec3 uSnowColor;
    uniform float uPlainsPrevalence;
    uniform float uHillsPrevalence;
    uniform float uMountainPrevalence;
    uniform float uSnowLineHeight;

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(random(i + vec2(0.0, 0.0)), random(i + vec2(1.0, 0.0)), u.x),
                   mix(random(i + vec2(0.0, 1.0)), random(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    float fbm(vec2 st) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 6; i++) {
            value += amplitude * noise(st);
            st *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    void main() {
      if (vInBasin > 0.5 || vInRiver > 0.5) {
        float dirtNoise = fbm(vWorldPosition.xz * 0.8);
        vec3 dirtColor = mix(uDirtColor1 * 0.9, uDirtColor1 * 1.1, dirtNoise);
        gl_FragColor = vec4(dirtColor, 1.0);
        return;
      }

      float n = fbm(vWorldPosition.xz * 0.2);
      float n_detail = fbm(vWorldPosition.xz * 1.2) * 0.25;
      vec3 grassColor = mix(uGrassColor1, uGrassColor2, n + n_detail);
      
      float slope = 1.0 - vNormal.y;

      float biomeScale = 0.006;
      float biomeNoiseVal = (noise(vWorldPosition.xz * biomeScale) + 1.0) / 2.0;
      float plainsFactor = 1.0 - smoothstep(0.0, uPlainsPrevalence, biomeNoiseVal);

      float biomeSlope = slope * (1.0 - plainsFactor * 0.9);

      float stoneNoise = fbm(vWorldPosition.xz * 0.5) * 0.5 + fbm(vWorldPosition.yx * 0.8) * 0.5;
      vec3 stoneTex = mix(uStoneColor * 0.8, uStoneColor * 1.2, stoneNoise);

      float stoneFactor = smoothstep(0.5, 0.7, biomeSlope) + smoothstep(0.4, 0.6, stoneNoise) * 0.5;
      vec3 dirtStoneColor = mix(uDirtColor1, stoneTex, clamp(stoneFactor, 0.0, 1.0));

      vec3 finalColor = mix(grassColor, dirtStoneColor, smoothstep(0.35, 0.5, biomeSlope));

      float mountainFactor = smoothstep(uHillsPrevalence, uMountainPrevalence, biomeNoiseVal) - smoothstep(uMountainPrevalence, 1.0, biomeNoiseVal);
      float upperMountainThreshold = uSnowLineHeight - 12.0;
      float upperMountainFactor = smoothstep(upperMountainThreshold, upperMountainThreshold + 8.0, vWorldPosition.y);
      float mountainStoneFactor = mountainFactor * upperMountainFactor;
      finalColor = mix(finalColor, stoneTex, mountainStoneFactor * 0.9);

      float snowFactor = smoothstep(uSnowLineHeight - 1.0, uSnowLineHeight + 1.0, vWorldPosition.y);
      float snowNoise = fbm(vWorldPosition.xz * 0.8) * 0.2;
      snowFactor = clamp(snowFactor + snowNoise - 0.1, 0.0, 1.0);
      
      float snowSlopeFactor = 1.0 - smoothstep(0.0, 0.6, slope);
      snowFactor *= (0.3 + snowSlopeFactor * 0.7);
      
      finalColor = mix(finalColor, uSnowColor, snowFactor);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

extend({ GrassMaterial });

export const Terrain = ({ groundColor, grassColor1, grassColor2, dirtColor1, stoneColor, snowColor, hillSteepness, hillDensity, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, snowLineHeight, basins, rivers }: any) => {
  const terrainRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<any>(null);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime += delta;
      materialRef.current.uPlainsPrevalence = plainsPrevalence;
      materialRef.current.uHillsPrevalence = hillsPrevalence;
      materialRef.current.uMountainPrevalence = mountainPrevalence;
      materialRef.current.uSnowLineHeight = snowLineHeight;
    }
  });

  const geometry = useMemo(() => {
    const size = 800;
    const segments = 200;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const inBasinData = new Float32Array(positions.count);
    const inRiverData = new Float32Array(positions.count);

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const y = getTerrainY(x, z, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, rivers);
      positions.setY(i, y);

      let isInBasin = 0.0;
      for (const basin of basins) {
        const dx = x - basin.x;
        const dz = z - basin.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < basin.radius * basin.radius) {
          const sampleCount = 32;
          let minEdgeHeight = Infinity;
          for (let j = 0; j < sampleCount; j++) {
            const angle = (j / sampleCount) * Math.PI * 2;
            const edgeX = basin.x + Math.cos(angle) * basin.radius;
            const edgeZ = basin.z + Math.sin(angle) * basin.radius;
            const edgeHeight = getTerrainY(edgeX, edgeZ, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, rivers);
            minEdgeHeight = Math.min(minEdgeHeight, edgeHeight);
          }
          const waterLevel = minEdgeHeight - 0.3;
          
          if (y < waterLevel) {
            isInBasin = 1.0;
          }
          break;
        }
      }
      inBasinData[i] = isInBasin;

      let isInRiver = 0.0;
      for (const river of rivers) {
        for (let j = 0; j < river.path.length - 1; j++) {
          const p1 = river.path[j];
          const p2 = river.path[j + 1];
          const l2 = (p2.x - p1.x) ** 2 + (p2.z - p1.z) ** 2;
          if (l2 === 0) continue;
          const t = Math.max(0, Math.min(1, ((x - p1.x) * (p2.x - p1.x) + (z - p1.z) * (p2.z - p1.z)) / l2));
          const closestX = p1.x + t * (p2.x - p1.x);
          const closestZ = p1.z + t * (p2.z - p1.z);
          const distSq = (x - closestX) ** 2 + (z - closestZ) ** 2;
          const currentWidth = river.width * (0.8 + riverNoise(j * 0.2, river.seed) * 0.4);
          if (distSq < (currentWidth * currentWidth)) {
            const riverbedY = getTerrainY(x, z, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, rivers);
            const waterSurfaceY = riverbedY + (currentWidth / 8) * 1.5;
            if (y < waterSurfaceY) {
              isInRiver = 1.0;
              break;
            }
          }
        }
        if (isInRiver > 0.5) break;
      }
      inRiverData[i] = isInRiver;

      const normal = new THREE.Vector3();
      if (i > 0) {
          const pA = new THREE.Vector3(positions.getX(i-1), positions.getY(i-1), positions.getZ(i-1));
          const pB = new THREE.Vector3(x, y, z);
          const pC = new THREE.Vector3();
          if (i < positions.count - 1) {
              pC.set(positions.getX(i+1), getTerrainY(positions.getX(i+1), positions.getZ(i+1), hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, [], rivers), positions.getZ(i+1));
          } else {
              pC.set(x, y, z-1);
          }
          const cb = new THREE.Vector3().subVectors(pC, pB);
          const ab = new THREE.Vector3().subVectors(pA, pB);
          cb.cross(ab);
          normal.copy(cb).normalize();
      } else {
          normal.set(0, 1, 0);
      }

      const slope = 1.0 - normal.y;

      if (slope > 0.35) {
        const { plainsFactor } = getBiomeFactors(x, z, plainsPrevalence, hillsPrevalence, mountainPrevalence);
        if (plainsFactor < 0.5) {
            const erosionNoise = noise2D(x * 0.3, z * 0.3);
            const bumpiness = noise2D(x * 1.5, z * 1.5) * 0.5;
            const inwardIncline = (erosionNoise - 0.5) * 1.5;

            const displacement = new THREE.Vector3(normal.x, 0, normal.z).normalize();
            displacement.multiplyScalar(inwardIncline + bumpiness);

            positions.setX(i, x + displacement.x);
            positions.setZ(i, z + displacement.z);
        }
      }
    }
    geo.setAttribute('aInBasin', new THREE.BufferAttribute(inBasinData, 1));
    geo.setAttribute('aInRiver', new THREE.BufferAttribute(inRiverData, 1));
    geo.computeVertexNormals();
    return geo;
  }, [hillSteepness, hillDensity, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, rivers]);

  return (
    <mesh ref={terrainRef} geometry={geometry} receiveShadow>
      {/* @ts-ignore */}
      <grassMaterial ref={materialRef} key={GrassMaterial.key} uGroundColor={groundColor} uGrassColor1={grassColor1} uGrassColor2={grassColor2} uDirtColor1={dirtColor1} uStoneColor={stoneColor} uSnowColor={snowColor} />
    </mesh>
  );
};
