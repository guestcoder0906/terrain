/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useControls } from 'leva';
import { createNoise2D } from 'simplex-noise';
import { getTerrainY, getBiomeFactors, noise2D, riverNoise } from './terrain/utils';
import { Terrain } from './terrain/Terrain';
import { Forest } from './terrain/Forest';
import { WaterBasins, Rivers } from './terrain/Water';
import { Clouds } from './terrain/Clouds';
import { Player, LookController } from './terrain/Player';
import { BackgroundMusic } from './terrain/BackgroundMusic';
import { Joystick, JumpButton } from './terrain/UI';
import { Volume2, VolumeX } from 'lucide-react';

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const joystickState = useRef({ x: 0, y: 0 });
  const jumpTrigger = useRef<(() => void) | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const {
    skyColorBottom,
    skyColorTop,
    groundColor,
    grassColor1,
    grassColor2,
    dirtColor1,
    stoneColor,
    snowColor,
    joystickBaseColor,
    joystickHandleColor,
    moveSpeed,
    bobbingIntensity,
    hillSteepness,
    hillDensity,
    plainsPrevalence,
    hillsPrevalence,
    mountainPrevalence,
    mountainHeight,
    snowLineHeight,
    waterColor,
    waterOpacity,
    basinCount,
    riverCount,
    riverWidth,
    treeDensity,
    trunkColor,
    leafColor,
    jumpForce,
    gravity,
    musicVolume,
  } = useControls('Environment', {
    skyColorBottom: '#87CEEB',
    skyColorTop: '#B0E0E6',
    groundColor: '#556B2F',
    grassColor1: '#4F7942',
    grassColor2: '#6B8E23',
    dirtColor1: '#9B7653',
    stoneColor: '#808080',
    snowColor: '#FFFFFF',
    joystickBaseColor: '#FFFFFF80',
    joystickHandleColor: '#FFFFFF',
    moveSpeed: { value: 12.1, min: 1, max: 20, step: 0.1 },
    bobbingIntensity: { value: 0.08, min: 0, max: 0.3, step: 0.01 },
    hillSteepness: { value: 14.0, min: 5, max: 50, step: 1 },
    hillDensity: { value: 0.013, min: 0.005, max: 0.05, step: 0.001 },
    plainsPrevalence: { value: 0.25, min: 0.1, max: 0.9, step: 0.05 },
    hillsPrevalence: { value: 0.15, min: 0.1, max: 0.9, step: 0.05 },
    mountainPrevalence: { value: 0.3, min: 0.1, max: 0.9, step: 0.05 },
    mountainHeight: { value: 55.0, min: 30, max: 120, step: 5 },
    snowLineHeight: { value: 35, min: 20, max: 80, step: 5 },
    waterColor: '#53B5F9',
    waterOpacity: { value: 0.6, min: 0.2, max: 0.9, step: 0.05 },
    basinCount: { value: 25, min: 5, max: 50, step: 1 },
    riverCount: { value: 15, min: 0, max: 40, step: 1 },
    riverWidth: { value: 8, min: 2, max: 20, step: 1 },
    treeDensity: { value: 0.3, min: 0, max: 1, step: 0.05 },
    trunkColor: '#654321',
    leafColor: '#2E8B57',
    jumpForce: { value: 9.0, min: 3, max: 15, step: 0.5 },
    gravity: { value: 20, min: 5, max: 40, step: 1 },
    musicVolume: { value: -8, min: -30, max: 0, step: 1 },
  });

  const basins = useMemo(() => {
    const generatedBasins = [];
    const seed = 12345;
    
    for (let i = 0; i < basinCount; i++) {
      const angle = (i / basinCount) * Math.PI * 2 + noise2D(i * 0.1, seed) * Math.PI;
      const distance = 50 + noise2D(i * 0.2, seed + 100) * 300;
      
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      
      const terrainHeight = getTerrainY(x, z, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, [], []);
      
      const sampleDist = 10;
      const h1 = getTerrainY(x + sampleDist, z, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, [], []);
      const h2 = getTerrainY(x - sampleDist, z, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, [], []);
      const h3 = getTerrainY(x, z + sampleDist, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, [], []);
      const h4 = getTerrainY(x, z - sampleDist, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, [], []);
      const avgSlope = (Math.abs(h1 - terrainHeight) + Math.abs(h2 - terrainHeight) + Math.abs(h3 - terrainHeight) + Math.abs(h4 - terrainHeight)) / (4 * sampleDist);
      
      const flatness = Math.max(0, 1 - avgSlope * 2);
      const lowness = Math.max(0, 1 - terrainHeight / 30);
      
      const sizeFactor = noise2D(x * 0.01, z * 0.01) * 0.5 + 0.5;
      const probability = (flatness * 0.4 + lowness * 0.3 + sizeFactor * 0.3);
      
      if (noise2D(x * 0.05 + seed, z * 0.05 + seed) < probability * 0.8) {
        const radius = 15 + sizeFactor * 40 + flatness * 25;
        const depth = 4 + noise2D(x * 0.03, z * 0.03) * 5 + sizeFactor * 4;
        
        generatedBasins.push({ x, z, radius, depth });
      }
    }
    
    return generatedBasins;
  }, [basinCount, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight]);

  const riversConfig = useMemo(() => {
    const generatedRivers = [];
    const seed = 54321;
    for (let i = 0; i < riverCount; i++) {
      const startAngle = riverNoise(i * 0.1, seed) * Math.PI * 2;
      const startDist = 300 + riverNoise(i * 0.1, seed + 1) * 100;
      let x = Math.cos(startAngle) * startDist;
      let z = Math.sin(startAngle) * startDist;

      const startHeight = getTerrainY(x, z, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, []);
      if (startHeight < 15) continue;

      const path = [{ x, z }];
      let currentAngle = Math.atan2(z, x) + Math.PI;

      for (let j = 0; j < 150; j++) {
        const h0 = getTerrainY(x, z, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, []);
        const hx = getTerrainY(x + 1, z, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, []);
        const hz = getTerrainY(x, z + 1, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, []);
        
        const gradientX = hx - h0;
        const gradientZ = hz - h0;
        
        currentAngle = Math.atan2(-gradientZ, -gradientX) + (riverNoise(x * 0.05, z * 0.05) - 0.5) * 1.5;

        const stepLength = 5;
        x += Math.cos(currentAngle) * stepLength;
        z += Math.sin(currentAngle) * stepLength;

        if (x * x + z * z > 400 * 400) break;
        
        path.push({ x, z });

        const currentHeight = getTerrainY(x, z, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, []);
        if (currentHeight < 0) break;
      }
      
      if (path.length > 10) {
        generatedRivers.push({ path, width: riverWidth * (0.7 + riverNoise(i * 0.5, seed) * 1.3), seed: i });
      }
    }
    return generatedRivers;
  }, [riverCount, riverWidth, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins]);

  const treePositions = useMemo(() => {
    const positions = [];
    const treeNoise = createNoise2D();
    const density = 20;
    const area = 400;

    for (let x = -area; x < area; x += density) {
        for (let z = -area; z < area; z += density) {
            const nx = x + (Math.random() - 0.5) * density;
            const nz = z + (Math.random() - 0.5) * density;

            const noiseVal = (treeNoise(nx * 0.005, nz * 0.005) + 1) / 2;
            const y = getTerrainY(nx, nz, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, riversConfig);

            const sampleDist = 2;
            const y1 = getTerrainY(nx + sampleDist, nz, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, riversConfig);
            const slope = Math.abs(y1 - y) / sampleDist;

            const { plainsFactor } = getBiomeFactors(nx, nz, plainsPrevalence, hillsPrevalence, mountainPrevalence);

            const densityMultiplier = 1.0 + plainsFactor * 2.5;

            if (y < 1 || y > snowLineHeight - 5 || slope > 0.6) continue;

            if (noiseVal < treeDensity * densityMultiplier) {
                positions.push(new THREE.Vector3(nx, 0, nz));
            }
        }
    }
    return positions;
  }, [treeDensity, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, snowLineHeight, basins, riversConfig]);

  const handleJoystickMove = (movement: any) => {
    joystickState.current = movement;
  };

  const handleJump = () => {
    if (jumpTrigger.current) {
      jumpTrigger.current();
    }
  };

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    const listener = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    const mql = window.matchMedia("(pointer: coarse)");
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 100) {
        progress = 100;
        setLoadingProgress(100);
        setTimeout(() => setIsLoading(false), 300);
        clearInterval(interval);
      } else {
        setLoadingProgress(progress);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-black font-sans">
      {!isStarted && <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
        <h1 className="text-white text-4xl font-bold tracking-tight mb-4">World Explorer</h1>
        <p className="text-gray-300 mb-8 max-w-md text-center">Drag to look around, use the joystick to move. You can tweak the terrain settings via the control panel.</p>
        <button 
          onClick={() => setIsStarted(true)}
          className="px-8 py-3 bg-white text-black font-semibold rounded-full hover:bg-gray-200 transition-colors"
        >
          Enter World
        </button>
      </div>}
      
      {isLoading && isStarted && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
          <div className="text-white text-2xl font-bold mb-8">Generating terrain...</div>
          <div className="w-64 h-4 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-blue-400 transition-all duration-300 ease-out" 
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <div className="text-white text-lg mt-4">{Math.floor(loadingProgress)}%</div>
        </div>
      )}
      
      {isStarted && (
        <>
          <Canvas
            shadows
            camera={{ fov: 75, near: 0.1, far: 2000 }}
            style={{ background: `linear-gradient(to bottom, ${skyColorTop} 0%, ${skyColorBottom} 100%)` }}
          >
            <ambientLight intensity={0.7} />
            <directionalLight
              position={[200, 150, 100]}
              intensity={1.5}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-left={-400}
              shadow-camera-right={400}
              shadow-camera-top={400}
              shadow-camera-bottom={-400}
              shadow-camera-far={600}
            />
            <Suspense fallback={null}>
              <Terrain groundColor={groundColor} grassColor1={grassColor1} grassColor2={grassColor2} dirtColor1={dirtColor1} stoneColor={stoneColor} snowColor={snowColor} hillSteepness={hillSteepness} hillDensity={hillDensity} plainsPrevalence={plainsPrevalence} hillsPrevalence={hillsPrevalence} mountainPrevalence={mountainPrevalence} mountainHeight={mountainHeight} snowLineHeight={snowLineHeight} basins={basins} rivers={riversConfig} />
              <Forest treePositions={treePositions} trunkColor={trunkColor} leafColor={leafColor} hillDensity={hillDensity} hillSteepness={hillSteepness} plainsPrevalence={plainsPrevalence} hillsPrevalence={hillsPrevalence} mountainPrevalence={mountainPrevalence} mountainHeight={mountainHeight} basins={basins} rivers={riversConfig} />
              <WaterBasins basins={basins} waterColor={waterColor} waterOpacity={waterOpacity} hillSteepness={hillSteepness} hillDensity={hillDensity} plainsPrevalence={plainsPrevalence} hillsPrevalence={hillsPrevalence} mountainPrevalence={mountainPrevalence} mountainHeight={mountainHeight} rivers={riversConfig} />
              <Rivers rivers={riversConfig} waterColor={waterColor} waterOpacity={waterOpacity} hillSteepness={hillSteepness} hillDensity={hillDensity} plainsPrevalence={plainsPrevalence} hillsPrevalence={hillsPrevalence} mountainPrevalence={mountainPrevalence} mountainHeight={mountainHeight} basins={basins} />
              <Clouds />
              <Player 
                joystickState={joystickState} 
                moveSpeed={moveSpeed} 
                bobbingIntensity={bobbingIntensity} 
                hillSteepness={hillSteepness} 
                hillDensity={hillDensity} 
                plainsPrevalence={plainsPrevalence} 
                hillsPrevalence={hillsPrevalence} 
                mountainPrevalence={mountainPrevalence} 
                mountainHeight={mountainHeight} 
                basins={basins} 
                rivers={riversConfig}
                treePositions={treePositions}
                jumpForce={jumpForce}
                gravity={gravity}
                jumpTrigger={jumpTrigger}
              />
              <LookController />
            </Suspense>
          </Canvas>
          <BackgroundMusic volume={musicVolume} isStarted={isStarted} isMuted={isMuted} />
          {isTouch && (
            <>
              <Joystick
                onMove={handleJoystickMove}
                joystickBaseColor={joystickBaseColor}
                joystickHandleColor={joystickHandleColor}
              />
              <JumpButton onJump={handleJump} />
            </>
          )}
          <button
            onClick={() => setIsMuted(m => !m)}
            className="absolute top-4 right-4 z-50 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur transition-all"
            title={isMuted ? "Unmute music" : "Mute music"}
          >
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>
        </>
      )}
    </div>
  );
}

