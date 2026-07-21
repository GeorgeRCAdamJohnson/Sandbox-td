// constants.js - Game constants and configuration
export const CANVAS_W = 1000;
export const CANVAS_H = 600;
export const GRAVITY = 0.15;
export const MAX_POWER = 100;
export const TANK_WIDTH = 20;
export const TANK_HEIGHT = 12;
export const MAX_FUEL = 100;
export const FALL_DAMAGE_FACTOR = 0.5; // damage per pixel fallen
export const DEFAULT_ROUNDS = 5;

export const COLORS = ['#00ffff', '#ff00ff', '#ffff00', '#00ff66'];
export const COLOR_NAMES = ['Cyan', 'Magenta', 'Yellow', 'Green'];

export const WEAPONS = [
  { id: 0, name: 'Small Missile', cost: 0, damage: 20, radius: 30, count: Infinity, type: 'missile' },
  { id: 1, name: 'Large Missile', cost: 2000, damage: 40, radius: 50, count: 3, type: 'missile' },
  { id: 2, name: 'Baby Nuke', cost: 5000, damage: 60, radius: 75, count: 2, type: 'missile' },
  { id: 3, name: 'Nuke', cost: 15000, damage: 100, radius: 130, count: 1, type: 'missile' },
  { id: 4, name: 'MIRV', cost: 10000, damage: 25, radius: 35, count: 2, type: 'mirv' },
  { id: 5, name: 'Napalm', cost: 8000, damage: 10, radius: 20, count: 2, type: 'napalm' },
  { id: 6, name: 'Dirt Charge', cost: 3000, damage: 0, radius: 50, count: 3, type: 'dirt' },
  { id: 7, name: 'Funky Bomb', cost: 7000, damage: 35, radius: 40, count: 2, type: 'funky' },
  { id: 8, name: "Death's Head", cost: 20000, damage: 150, radius: 90, count: 1, type: 'deathshead' },
  { id: 9, name: 'Roller', cost: 4000, damage: 30, radius: 35, count: 3, type: 'roller' }
];

export const TERRAIN_STYLES = ['mountains', 'plains', 'valleys', 'mesa'];
