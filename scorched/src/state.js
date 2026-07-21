// state.js - Game state management
import { WEAPONS, DEFAULT_ROUNDS } from './constants.js';

export const GamePhase = {
  MENU: 'menu',
  PLAYING: 'playing',
  AIMING: 'aiming',
  FIRING: 'firing',
  SHOP: 'shop',
  ROUND_OVER: 'round_over',
  GAME_OVER: 'game_over'
};

export const state = {
  phase: GamePhase.MENU,
  players: [],
  currentPlayerIndex: 0,
  terrain: [],
  wind: 0,
  round: 1,
  totalRounds: DEFAULT_ROUNDS,
  projectiles: [],
  explosions: [],
  particles: [],
  napalmFires: [],
  turnActive: false,
  animating: false,
  lowPerfMode: false,
  numPlayers: 2,
  aiDifficulty: 'medium'
};

export function createPlayer(index, name, color, isAI = false) {
  return {
    index,
    name,
    color,
    isAI,
    x: 0,
    y: 0,
    hp: 100,
    angle: 45,
    power: 60,
    fuel: 100,
    alive: true,
    money: 5000,
    score: 0,
    weapons: createDefaultWeapons(),
    selectedWeapon: 0
  };
}

function createDefaultWeapons() {
  return WEAPONS.map((w, i) => ({
    ...w,
    owned: i === 0 ? Infinity : 0
  }));
}

export function resetState() {
  state.projectiles = [];
  state.explosions = [];
  state.particles = [];
  state.napalmFires = [];
  state.turnActive = false;
  state.animating = false;
}

export function nextPlayer() {
  let attempts = 0;
  do {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    attempts++;
    if (attempts > state.players.length) return false;
  } while (!state.players[state.currentPlayerIndex].alive);
  return true;
}

export function getAliveCount() {
  return state.players.filter(p => p.alive).length;
}

export function getCurrentPlayer() {
  return state.players[state.currentPlayerIndex];
}
