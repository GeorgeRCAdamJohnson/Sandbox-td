// tanks.js - Tank rendering, placement, movement
import { CANVAS_W, TANK_WIDTH, TANK_HEIGHT, FALL_DAMAGE_FACTOR } from './constants.js';
import { state } from './state.js';
import { getTerrainHeight } from './terrain.js';

export function placeTanks(players, heightmap) {
  const count = players.length;
  const margin = 80;
  const spacing = (CANVAS_W - margin * 2) / (count - 1);

  for (let i = 0; i < count; i++) {
    const x = Math.floor(margin + spacing * i);
    const y = getTerrainHeight(heightmap, x);
    players[i].x = x;
    players[i].y = y;
    players[i].fuel = 100;
  }
}

export function moveTank(player, direction, heightmap) {
  if (player.fuel <= 0) return;

  const moveSpeed = 2;
  const fuelCost = 1;
  const newX = player.x + direction * moveSpeed;

  if (newX < TANK_WIDTH / 2 || newX > CANVAS_W - TANK_WIDTH / 2) return;

  player.x = newX;
  player.y = getTerrainHeight(heightmap, newX);
  player.fuel -= fuelCost;
}

export function applyGravityToTanks(players, heightmap) {
  const results = [];
  for (const player of players) {
    if (!player.alive) continue;
    const groundY = getTerrainHeight(heightmap, player.x);
    if (player.y < groundY - 2) {
      // Tank is floating - needs to fall
      const fallDistance = groundY - player.y;
      player.y = groundY;
      const damage = Math.floor(fallDistance * FALL_DAMAGE_FACTOR);
      if (damage > 0) {
        player.hp -= damage;
        results.push({ player, damage, type: 'fall' });
        if (player.hp <= 0) {
          player.hp = 0;
          player.alive = false;
          results.push({ player, damage: 0, type: 'death' });
        }
      }
    } else {
      player.y = groundY;
    }
  }
  return results;
}

export function damageTank(player, damage) {
  if (!player.alive) return 0;
  const actual = Math.min(player.hp, damage);
  player.hp -= actual;
  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
  }
  return actual;
}

export function getTankBounds(player) {
  return {
    left: player.x - TANK_WIDTH / 2,
    right: player.x + TANK_WIDTH / 2,
    top: player.y - TANK_HEIGHT,
    bottom: player.y
  };
}
