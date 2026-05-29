import { createNoise2D, createNoise3D } from 'simplex-noise';

export const noise2D = createNoise2D();
export const noise3D = createNoise3D();
export const biomeNoise = createNoise2D();
export const riverNoise = createNoise2D();

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

export function getBiomeFactors(x: number, z: number, plainsPrevalence: number, hillsPrevalence: number, mountainPrevalence: number) {
  const biomeScale = 0.008;
  const noiseVal = (biomeNoise(x * biomeScale, z * biomeScale) + 1) / 2;

  const plainsFactor = 1.0 - smoothstep(0.0, plainsPrevalence, noiseVal);
  const hillsFactor = smoothstep(plainsPrevalence, hillsPrevalence, noiseVal) - smoothstep(hillsPrevalence, mountainPrevalence, noiseVal);
  const mountainFactor = smoothstep(hillsPrevalence, mountainPrevalence, noiseVal) - smoothstep(mountainPrevalence, 1.0, noiseVal);
  const cliffsFactor = smoothstep(mountainPrevalence, 1.0, noiseVal);

  return { plainsFactor, hillsFactor, mountainFactor, cliffsFactor };
}

export function getTerrainY(
  x: number, 
  z: number, 
  hillDensity: number, 
  hillSteepness: number, 
  plainsPrevalence: number, 
  hillsPrevalence: number, 
  mountainPrevalence: number, 
  mountainHeight: number, 
  basins: any[] = [], 
  rivers: any[] = []
) {
  const { plainsFactor, hillsFactor, mountainFactor, cliffsFactor } = getBiomeFactors(x, z, plainsPrevalence, hillsPrevalence, mountainPrevalence);

  const plainsHeight = noise2D(x * hillDensity * 0.1, z * hillDensity * 0.1) * (hillSteepness * 0.2);
  const hillsHeight = noise2D(x * hillDensity, z * hillDensity) * hillSteepness * 0.7;

  const mountainScale = hillDensity * 0.2;
  let mountainsHeight = noise2D(x * mountainScale, z * mountainScale) * mountainHeight;
  mountainsHeight += noise2D(x * mountainScale * 2, z * mountainScale * 2) * (mountainHeight * 0.3);
  mountainsHeight += noise2D(x * mountainScale * 4, z * mountainScale * 4) * (mountainHeight * 0.15);
  mountainsHeight += noise2D(x * mountainScale * 8, z * mountainScale * 8) * (mountainHeight * 0.08);
  
  const ridgeNoise1 = Math.abs(noise2D(x * mountainScale * 0.5, z * mountainScale * 0.5));
  const ridgeNoise2 = Math.abs(noise2D(x * mountainScale * 1.5, z * mountainScale * 1.5));
  const ridgeFactor = (1 - ridgeNoise1) * 0.7 + (1 - ridgeNoise2) * 0.3;
  mountainsHeight *= (0.5 + ridgeFactor * 1.5);
  
  const peakSharpness = Math.pow(Math.max(0, mountainsHeight / mountainHeight), 1.2);
  mountainsHeight = mountainsHeight * (0.8 + peakSharpness * 0.2);
  
  const cliffInfluence = Math.max(0, cliffsFactor - 0.3);
  const adjustedMountainFactor = Math.max(0, mountainFactor - cliffInfluence * 0.8);

  let cliffsHeight = noise2D(x * hillDensity, z * hillDensity) * hillSteepness;
  let cliffNoise = (noise2D(x * hillDensity * 0.5, z * hillDensity * 0.5) + 1) / 2;
  if (cliffNoise > 0.6) {
    const plateauStart = 0.6;
    const plateauEnd = 0.8;
    const plateauFactor = Math.max(0, Math.min(1, (cliffNoise - plateauStart) / (plateauEnd - plateauStart)));
    const plateauHeight = hillSteepness * 0.8 + noise2D(x * 0.01, z * 0.01) * 2;
    cliffsHeight = cliffsHeight * (1 - plateauFactor) + plateauHeight * plateauFactor;
  }

  let finalHeight = plainsHeight * plainsFactor + hillsHeight * hillsFactor + mountainsHeight * adjustedMountainFactor + cliffsHeight * cliffsFactor;

  finalHeight += noise2D(x * hillDensity * 2.5, z * hillDensity * 2.5) * 2;

  for (const river of rivers) {
    for (let i = 0; i < river.path.length - 1; i++) {
      const p1 = river.path[i];
      const p2 = river.path[i + 1];
      
      const l2 = (p2.x - p1.x) ** 2 + (p2.z - p1.z) ** 2;
      if (l2 === 0) continue;
      
      const t = Math.max(0, Math.min(1, ((x - p1.x) * (p2.x - p1.x) + (z - p1.z) * (p2.z - p1.z)) / l2));
      const closestX = p1.x + t * (p2.x - p1.x);
      const closestZ = p1.z + t * (p2.z - p1.z);
      
      const dx = x - closestX;
      const dz = z - closestZ;
      const distSq = dx * dx + dz * dz;
      
      const currentWidth = river.width * (0.8 + riverNoise(i * 0.2, river.seed) * 0.4);
      const radiusSq = currentWidth * currentWidth;

      if (distSq < radiusSq) {
        const dist = Math.sqrt(distSq);
        const normalizedDist = dist / currentWidth;
        
        const falloff = 1 - normalizedDist;
        const smoothFalloff = falloff * falloff * (3 - 2 * falloff);
        
        const depth = (river.width / 8) * 3;
        const depression = depth * smoothFalloff;
        
        finalHeight -= depression;
      }
    }
  }

  for (const basin of basins) {
    const dx = x - basin.x;
    const dz = z - basin.z;
    const distSq = dx * dx + dz * dz;
    const radiusSq = basin.radius * basin.radius;
    
    if (distSq < radiusSq) {
      const dist = Math.sqrt(distSq);
      const normalizedDist = dist / basin.radius;
      
      const falloff = 1 - normalizedDist;
      const smoothFalloff = falloff * falloff * (3 - 2 * falloff);
      
      const bumpiness = noise2D(x * 0.5, z * 0.5) * 0.8 + noise2D(x * 1.2, z * 1.2) * 0.4;
      
      const depthVariation = noise2D(x * 0.15, z * 0.15) * 0.3 + 1.0;
      const depression = basin.depth * smoothFalloff * depthVariation + bumpiness * smoothFalloff;
      
      finalHeight -= depression;
    }
  }

  return finalHeight;
}
