// terrain.js - Heightmap generation and destruction
import { CANVAS_W, CANVAS_H, TERRAIN_STYLES } from './constants.js';

export function generateTerrain(style) {
  if (!style) {
    style = TERRAIN_STYLES[Math.floor(Math.random() * TERRAIN_STYLES.length)];
  }
  const heightmap = new Float32Array(CANVAS_W);

  switch (style) {
    case 'mountains':
      generateMountains(heightmap);
      break;
    case 'plains':
      generatePlains(heightmap);
      break;
    case 'valleys':
      generateValleys(heightmap);
      break;
    case 'mesa':
      generateMesa(heightmap);
      break;
    default:
      generateMountains(heightmap);
  }

  return heightmap;
}

function noise(x, frequency, amplitude, phase) {
  return Math.sin(x * frequency + phase) * amplitude;
}

function generateMountains(heightmap) {
  const phase1 = Math.random() * Math.PI * 2;
  const phase2 = Math.random() * Math.PI * 2;
  const phase3 = Math.random() * Math.PI * 2;
  const phase4 = Math.random() * Math.PI * 2;

  for (let x = 0; x < CANVAS_W; x++) {
    const nx = x / CANVAS_W;
    let h = 0;
    h += noise(nx, 3, 80, phase1);
    h += noise(nx, 7, 40, phase2);
    h += noise(nx, 13, 20, phase3);
    h += noise(nx, 29, 10, phase4);
    heightmap[x] = CANVAS_H * 0.5 + h;
  }
}

function generatePlains(heightmap) {
  const phase1 = Math.random() * Math.PI * 2;
  const phase2 = Math.random() * Math.PI * 2;

  for (let x = 0; x < CANVAS_W; x++) {
    const nx = x / CANVAS_W;
    let h = 0;
    h += noise(nx, 2, 30, phase1);
    h += noise(nx, 5, 15, phase2);
    heightmap[x] = CANVAS_H * 0.65 + h;
  }
}

function generateValleys(heightmap) {
  const phase1 = Math.random() * Math.PI * 2;
  const phase2 = Math.random() * Math.PI * 2;
  const valleyCenter = 0.3 + Math.random() * 0.4;

  for (let x = 0; x < CANVAS_W; x++) {
    const nx = x / CANVAS_W;
    const valleyDepth = Math.exp(-Math.pow((nx - valleyCenter) * 3, 2)) * 120;
    let h = 0;
    h += noise(nx, 4, 50, phase1);
    h += noise(nx, 9, 20, phase2);
    heightmap[x] = CANVAS_H * 0.45 + h + valleyDepth;
  }
}

function generateMesa(heightmap) {
  const phase1 = Math.random() * Math.PI * 2;
  const numMesas = 2 + Math.floor(Math.random() * 3);
  const mesas = [];

  for (let i = 0; i < numMesas; i++) {
    mesas.push({
      center: 0.1 + Math.random() * 0.8,
      width: 0.08 + Math.random() * 0.12,
      height: 40 + Math.random() * 60
    });
  }

  for (let x = 0; x < CANVAS_W; x++) {
    const nx = x / CANVAS_W;
    let h = noise(nx, 3, 20, phase1);

    for (const mesa of mesas) {
      const dist = Math.abs(nx - mesa.center);
      if (dist < mesa.width) {
        const edge = 1 - Math.pow(dist / mesa.width, 4);
        h -= mesa.height * Math.min(1, edge * 3);
      }
    }

    heightmap[x] = CANVAS_H * 0.6 + h;
  }
}

export function destroyTerrain(heightmap, cx, cy, radius) {
  const startX = Math.max(0, Math.floor(cx - radius));
  const endX = Math.min(CANVAS_W - 1, Math.ceil(cx + radius));

  for (let x = startX; x <= endX; x++) {
    const dx = x - cx;
    const maxDy = Math.sqrt(radius * radius - dx * dx);
    const top = cy - maxDy;
    const bottom = cy + maxDy;

    if (heightmap[x] < bottom && heightmap[x] > top) {
      // Terrain surface is within explosion circle - lower it
      heightmap[x] = Math.min(CANVAS_H, bottom);
    } else if (heightmap[x] <= top) {
      // Terrain is above the explosion - carve a hole (lower terrain to bottom of circle)
      heightmap[x] = Math.min(CANVAS_H, bottom);
    }
  }
}

export function addTerrain(heightmap, cx, cy, radius) {
  const startX = Math.max(0, Math.floor(cx - radius));
  const endX = Math.min(CANVAS_W - 1, Math.ceil(cx + radius));

  for (let x = startX; x <= endX; x++) {
    const dx = x - cx;
    const dist = Math.abs(dx);
    if (dist < radius) {
      const amount = Math.sqrt(radius * radius - dx * dx);
      heightmap[x] = Math.max(0, heightmap[x] - amount);
    }
  }
}

export function getTerrainHeight(heightmap, x) {
  const ix = Math.floor(Math.max(0, Math.min(CANVAS_W - 1, x)));
  return heightmap[ix];
}
