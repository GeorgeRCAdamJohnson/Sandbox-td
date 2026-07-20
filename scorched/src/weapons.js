// weapons.js - Weapon definitions and effects
import { WEAPONS } from './constants.js';

export function getWeaponById(id) {
  return WEAPONS[id] || WEAPONS[0];
}

export function getWeaponName(id) {
  return WEAPONS[id] ? WEAPONS[id].name : 'Unknown';
}

export function canFire(player) {
  const weapon = player.weapons[player.selectedWeapon];
  return weapon && weapon.owned > 0;
}

export function consumeAmmo(player) {
  const weapon = player.weapons[player.selectedWeapon];
  if (weapon.owned !== Infinity) {
    weapon.owned--;
  }
}

export function selectNextWeapon(player, direction) {
  let idx = player.selectedWeapon;
  const total = player.weapons.length;
  for (let i = 0; i < total; i++) {
    idx = (idx + direction + total) % total;
    if (player.weapons[idx].owned > 0) {
      player.selectedWeapon = idx;
      return;
    }
  }
}

export function getPlayerWeapon(player) {
  return player.weapons[player.selectedWeapon];
}
