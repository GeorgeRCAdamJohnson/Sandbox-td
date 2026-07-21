// projectiles.js - Physics, trajectory, explosions
import { GRAVITY, CANVAS_W, CANVAS_H, TANK_HEIGHT } from './constants.js';
import { state } from './state.js';
import { getTerrainHeight, destroyTerrain, addTerrain } from './terrain.js';
import { damageTank, applyGravityToTanks } from './tanks.js';
import { playExplosion, playFire } from './audio.js';
import { addCraterGlow, triggerScreenFlash } from './renderer.js';

export function createProjectile(player, weapon) {
  const angleRad = (player.angle * Math.PI) / 180;
  const speed = player.power * 0.2;
  const vx = Math.cos(angleRad) * speed;
  const vy = -Math.sin(angleRad) * speed;

  // Launch from turret tip
  const turretLen = 18;
  const startX = player.x + Math.cos(angleRad) * turretLen;
  const startY = player.y - TANK_HEIGHT / 2 - Math.sin(angleRad) * turretLen;

  return {
    x: startX,
    y: startY,
    vx,
    vy,
    weapon,
    owner: player.index,
    trail: [],
    bounces: 0,
    active: true,
    ignoreWind: weapon.type === 'deathshead',
    isRoller: false,
    isMirvChild: false,
    apex: false,
    prevVy: vy
  };
}

export function updateProjectiles(dt) {
  const toRemove = [];
  const newProjectiles = [];

  for (let i = 0; i < state.projectiles.length; i++) {
    const p = state.projectiles[i];
    if (!p.active) continue;

    // Apply physics
    if (!p.isRoller) {
      if (!p.ignoreWind) {
        p.vx += state.wind * 0.01;
      }
      p.vy += GRAVITY;
    }

    // Track apex for MIRV
    if (p.weapon.type === 'mirv' && !p.isMirvChild && p.prevVy < 0 && p.vy >= 0) {
      p.apex = true;
    }
    p.prevVy = p.vy;

    // Move
    p.x += p.vx;
    p.y += p.vy;

    // Store trail
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 30) p.trail.shift();

    // MIRV split at apex
    if (p.weapon.type === 'mirv' && p.apex && !p.isMirvChild) {
      for (let j = 0; j < 5; j++) {
        const spread = (j - 2) * 3;
        newProjectiles.push({
          x: p.x,
          y: p.y,
          vx: p.vx + spread,
          vy: p.vy * 0.5,
          weapon: { ...p.weapon, type: 'missile' },
          owner: p.owner,
          trail: [],
          bounces: 0,
          active: true,
          ignoreWind: false,
          isRoller: false,
          isMirvChild: true,
          apex: false,
          prevVy: p.vy
        });
      }
      p.active = false;
      toRemove.push(i);
      continue;
    }

    // Out of bounds
    if (p.x < -50 || p.x > CANVAS_W + 50 || p.y > CANVAS_H + 50) {
      p.active = false;
      toRemove.push(i);
      continue;
    }

    // Terrain collision
    const terrainY = getTerrainHeight(state.terrain, p.x);
    if (p.y >= terrainY) {
      if (p.weapon.type === 'funky' && p.bounces < 3) {
        p.bounces++;
        p.vy = -Math.abs(p.vy) * 0.6;
        p.y = terrainY - 2;
      } else if (p.weapon.type === 'roller' && !p.isRoller) {
        // Convert to roller
        p.isRoller = true;
        p.y = terrainY - 3;
        p.vy = 0;
        p.vx = p.vx > 0 ? 3 : -3;
      } else if (p.isRoller) {
        // Roller follows terrain
        p.y = terrainY - 3;
        // Check if roller hit a tank
        let hitTank = false;
        for (const player of state.players) {
          if (player.index === p.owner || !player.alive) continue;
          if (Math.abs(p.x - player.x) < 15) {
            hitTank = true;
            break;
          }
        }
        // Roller stops after traveling far or hitting something
        if (hitTank || Math.abs(p.vx) < 0.5) {
          explodeAt(p.x, p.y, p.weapon, p.owner);
          p.active = false;
          toRemove.push(i);
        } else {
          p.vx *= 0.99; // slight friction
        }
      } else {
        // Normal impact
        handleImpact(p);
        p.active = false;
        toRemove.push(i);
      }
    }
  }

  // Remove inactive and add new
  state.projectiles = state.projectiles.filter((_, i) => !toRemove.includes(i));
  state.projectiles.push(...newProjectiles);

  return state.projectiles.length === 0;
}

function handleImpact(p) {
  if (p.weapon.type === 'napalm') {
    createNapalm(p.x, p.y, p.owner);
  } else {
    explodeAt(p.x, p.y, p.weapon, p.owner);
  }
}

function explodeAt(x, y, weapon, ownerIndex) {
  playExplosion(weapon.radius);

  // Crater glow effect
  addCraterGlow(x, y, weapon.radius);

  // Screen flash for big explosions
  if (weapon.radius >= 40) {
    triggerScreenFlash(weapon.radius >= 70 ? 0.6 : 0.3);
  }

  // Create explosion visual
  state.explosions.push({
    x, y,
    radius: 0,
    maxRadius: weapon.radius,
    alpha: 1,
    color: weapon.type === 'dirt' ? '#88ff44' : '#ff8800'
  });

  // Create particles
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 1,
      color: weapon.type === 'dirt' ? '#88ff44' : '#ffaa00'
    });
  }

  // Modify terrain
  if (weapon.type === 'dirt') {
    addTerrain(state.terrain, x, y, weapon.radius);
  } else {
    destroyTerrain(state.terrain, x, y, weapon.radius);
  }

  // Damage tanks
  for (const player of state.players) {
    if (!player.alive) continue;
    const dist = Math.sqrt((player.x - x) ** 2 + (player.y - y) ** 2);
    if (dist < weapon.radius) {
      const factor = 1 - dist / weapon.radius;
      const damage = Math.floor(weapon.damage * factor);
      if (damage > 0) {
        const actual = damageTank(player, damage);
        if (actual > 0 && ownerIndex !== player.index) {
          const owner = state.players[ownerIndex];
          if (owner) owner.money += actual * 50;
        }
      }
    }
  }

  // Apply gravity to tanks after terrain change
  applyGravityToTanks(state.players, state.terrain);
}

function createNapalm(x, y, ownerIndex) {
  playFire();
  const spread = 60;
  state.napalmFires.push({
    x,
    startX: x - spread,
    endX: x + spread,
    ownerIndex,
    life: 180, // 3 seconds at 60fps
    damage: 10
  });
}

export function updateNapalm() {
  for (let i = state.napalmFires.length - 1; i >= 0; i--) {
    const fire = state.napalmFires[i];
    fire.life--;

    // Damage tanks in napalm area every 30 frames
    if (fire.life % 30 === 0) {
      for (const player of state.players) {
        if (!player.alive) continue;
        if (player.x >= fire.startX && player.x <= fire.endX) {
          const terrainY = getTerrainHeight(state.terrain, player.x);
          if (Math.abs(player.y - terrainY) < 20) {
            const actual = damageTank(player, fire.damage);
            if (actual > 0 && fire.ownerIndex !== player.index) {
              const owner = state.players[fire.ownerIndex];
              if (owner) owner.money += actual * 30;
            }
          }
        }
      }
      // Destroy a bit of terrain
      const burnX = fire.startX + Math.random() * (fire.endX - fire.startX);
      const burnY = getTerrainHeight(state.terrain, burnX);
      destroyTerrain(state.terrain, burnX, burnY, 5);
    }

    // Add fire particles
    if (fire.life % 3 === 0) {
      const px = fire.startX + Math.random() * (fire.endX - fire.startX);
      const py = getTerrainHeight(state.terrain, px);
      state.particles.push({
        x: px, y: py,
        vx: (Math.random() - 0.5) * 2,
        vy: -1 - Math.random() * 3,
        life: 0.5 + Math.random() * 0.5,
        color: Math.random() > 0.5 ? '#ff4400' : '#ffaa00'
      });
    }

    if (fire.life <= 0) {
      state.napalmFires.splice(i, 1);
    }
  }
}

export function updateExplosions() {
  for (let i = state.explosions.length - 1; i >= 0; i--) {
    const e = state.explosions[i];
    e.radius += 3;
    e.alpha -= 0.04;
    if (e.alpha <= 0) {
      state.explosions.splice(i, 1);
    }
  }
}

export function updateParticles() {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life -= 0.02;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
}
