// ai.js - Computer player logic
import { GRAVITY, CANVAS_W, CANVAS_H } from './constants.js';
import { state } from './state.js';
import { getTerrainHeight } from './terrain.js';

export function computeAIMove(player, difficulty) {
  // Find nearest alive enemy
  let target = null;
  let minDist = Infinity;

  for (const p of state.players) {
    if (p.index === player.index || !p.alive) continue;
    const dist = Math.abs(p.x - player.x);
    if (dist < minDist) {
      minDist = dist;
      target = p;
    }
  }

  if (!target) return { angle: 45, power: 50 };

  switch (difficulty) {
    case 'easy':
      return computeEasy(player, target);
    case 'medium':
      return computeMedium(player, target);
    case 'hard':
      return computeHard(player, target);
    default:
      return computeMedium(player, target);
  }
}

function computeEasy(player, target) {
  // Rough estimate with large error
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const idealAngle = Math.atan2(-dy - 50, Math.abs(dx)) * 180 / Math.PI;
  const angle = Math.max(5, Math.min(175, idealAngle + (Math.random() - 0.5) * 60));
  const power = 30 + Math.random() * 40;
  return { angle, power };
}

function computeMedium(player, target) {
  const dx = target.x - player.x;
  const dist = Math.abs(dx);

  // Estimate angle accounting for distance
  let angle;
  if (dx > 0) {
    angle = 30 + (dist / CANVAS_W) * 40;
  } else {
    angle = 150 - (dist / CANVAS_W) * 40;
  }

  // Estimate power based on distance
  let power = (dist / CANVAS_W) * 80 + 20;
  power = Math.max(20, Math.min(95, power));

  // Add small error
  angle += (Math.random() - 0.5) * 20;
  power += (Math.random() - 0.5) * 15;

  // Account for wind somewhat
  if (state.wind !== 0) {
    const windEffect = state.wind * (dist / 200);
    if (dx > 0) {
      angle -= windEffect * 2;
    } else {
      angle += windEffect * 2;
    }
  }

  angle = Math.max(5, Math.min(175, angle));
  power = Math.max(15, Math.min(95, power));

  return { angle, power };
}

function computeHard(player, target) {
  // Iterative solver - simulate trajectories
  let bestAngle = 90;
  let bestPower = 50;
  let bestDist = Infinity;

  const dx = target.x - player.x;

  // Search angles
  const startAngle = dx > 0 ? 15 : 95;
  const endAngle = dx > 0 ? 85 : 165;

  for (let angle = startAngle; angle <= endAngle; angle += 5) {
    for (let power = 20; power <= 95; power += 5) {
      const result = simulateShot(player, angle, power);
      const dist = Math.sqrt((result.x - target.x) ** 2 + (result.y - target.y) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestAngle = angle;
        bestPower = power;
      }
    }
  }

  // Fine-tune
  for (let angle = bestAngle - 5; angle <= bestAngle + 5; angle += 1) {
    for (let power = bestPower - 5; power <= bestPower + 5; power += 1) {
      if (power < 10 || power > 100) continue;
      const result = simulateShot(player, angle, power);
      const dist = Math.sqrt((result.x - target.x) ** 2 + (result.y - target.y) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestAngle = angle;
        bestPower = power;
      }
    }
  }

  // Add tiny error even for hard AI
  bestAngle += (Math.random() - 0.5) * 4;
  bestPower += (Math.random() - 0.5) * 3;

  return {
    angle: Math.max(5, Math.min(175, bestAngle)),
    power: Math.max(15, Math.min(95, bestPower))
  };
}

function simulateShot(player, angle, power) {
  const angleRad = (angle * Math.PI) / 180;
  const speed = power * 0.2;
  let vx = Math.cos(angleRad) * speed;
  let vy = -Math.sin(angleRad) * speed;
  let x = player.x;
  let y = player.y - 12;

  for (let i = 0; i < 500; i++) {
    vx += state.wind * 0.01;
    vy += GRAVITY;
    x += vx;
    y += vy;

    if (x < 0 || x >= CANVAS_W || y > CANVAS_H) {
      return { x, y };
    }

    const terrainY = getTerrainHeight(state.terrain, x);
    if (y >= terrainY) {
      return { x, y: terrainY };
    }
  }

  return { x, y };
}

export function aiSelectWeapon(player) {
  // AI picks a reasonable weapon
  // Prefer special weapons occasionally
  const available = player.weapons.filter(w => w.owned > 0);
  if (available.length === 1) return 0; // Only small missile

  // 70% chance to use special weapon if available
  if (Math.random() < 0.7) {
    const specials = available.filter(w => w.id !== 0 && w.owned > 0);
    if (specials.length > 0) {
      const chosen = specials[Math.floor(Math.random() * specials.length)];
      return chosen.id;
    }
  }
  return 0;
}
