// game.js - Entry point, ES module
import { CANVAS_W, CANVAS_H, COLORS, COLOR_NAMES, WEAPONS } from './src/constants.js';
import { state, GamePhase, createPlayer, resetState, nextPlayer, getAliveCount, getCurrentPlayer } from './src/state.js';
import { generateTerrain, getTerrainHeight } from './src/terrain.js';
import { placeTanks, applyGravityToTanks, moveTank } from './src/tanks.js';
import { createProjectile, updateProjectiles, updateNapalm, updateExplosions, updateParticles } from './src/projectiles.js';
import { canFire, consumeAmmo, getPlayerWeapon, selectNextWeapon } from './src/weapons.js';
import { computeAIMove, aiSelectWeapon } from './src/ai.js';
import { openShop, buyWeapon, sellWeapon, finishShopping, isShopDone } from './src/shop.js';
import { initRenderer, render, renderMenu, renderGameOver, drawAimingGuide } from './src/renderer.js';
import { initInput, processHeldKeys } from './src/input.js';
import { initAudio, resumeAudio, playFire, playUIClick } from './src/audio.js';

let canvas = null;
let animFrame = null;
let aiTimeout = null;

function init() {
  canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  initRenderer(canvas);
  initAudio();
  initInput(canvas, {
    onFire: fireWeapon,
    onRestart: showMenu
  });

  showMenu();
  gameLoop();
}

function showMenu() {
  state.phase = GamePhase.MENU;
  clearAITimeout();
  showMenuOverlay();
  renderMenu();
}

function showMenuOverlay() {
  const overlay = document.getElementById('menu-overlay');
  if (overlay) overlay.style.display = 'flex';
  const shop = document.getElementById('shop-overlay');
  if (shop) shop.style.display = 'none';
}

function hideMenuOverlay() {
  const overlay = document.getElementById('menu-overlay');
  if (overlay) overlay.style.display = 'none';
}

function startGame() {
  resumeAudio();
  playUIClick();
  hideMenuOverlay();

  // Read settings from UI
  const numPlayers = parseInt(document.getElementById('num-players').value) || 2;
  const numHumans = parseInt(document.getElementById('num-humans').value) || 1;
  const difficulty = document.getElementById('ai-difficulty').value || 'medium';
  const rounds = parseInt(document.getElementById('num-rounds').value) || 5;

  state.totalRounds = rounds;
  state.round = 1;
  state.numPlayers = numPlayers;
  state.aiDifficulty = difficulty;

  // Create players
  state.players = [];
  for (let i = 0; i < numPlayers; i++) {
    const isAI = i >= numHumans;
    const name = isAI ? `CPU ${i + 1}` : `Player ${i + 1}`;
    const player = createPlayer(i, name, COLORS[i], isAI);
    state.players.push(player);
  }

  startRound();
}

function startRound() {
  resetState();
  state.terrain = generateTerrain();
  placeTanks(state.players, state.terrain);

  // Reset fuel and assign new wind
  for (const p of state.players) {
    if (p.alive) {
      p.fuel = 100;
    }
  }
  state.wind = (Math.random() - 0.5) * 20;

  // Start with first alive player
  state.currentPlayerIndex = -1;
  nextPlayer();
  state.phase = GamePhase.AIMING;

  startTurn();
}

function syncMobileSliders(player) {
  const angleSlider = document.getElementById('angle-slider');
  const angleVal = document.getElementById('angle-val');
  const powerSlider = document.getElementById('power-slider');
  const powerVal = document.getElementById('power-val');
  if (angleSlider) angleSlider.value = Math.round(player.angle);
  if (angleVal) angleVal.textContent = Math.round(player.angle) + '°';
  if (powerSlider) powerSlider.value = Math.round(player.power);
  if (powerVal) powerVal.textContent = Math.round(player.power);
}

function startTurn() {
  state.phase = GamePhase.AIMING;
  const player = getCurrentPlayer();
  if (!player) return;

  // Sync mobile sliders with current player's values
  syncMobileSliders(player);

  if (player.isAI) {
    // AI takes its turn after a brief delay
    aiTimeout = setTimeout(() => {
      executeAITurn(player);
    }, 800);
  }
}

function executeAITurn(player) {
  // AI selects weapon
  player.selectedWeapon = aiSelectWeapon(player);

  // AI computes angle/power
  const move = computeAIMove(player, state.aiDifficulty);
  player.angle = move.angle;
  player.power = move.power;

  // Fire after a brief pause
  aiTimeout = setTimeout(() => {
    fireWeapon();
  }, 500);
}

function fireWeapon() {
  const player = getCurrentPlayer();
  if (!player || !player.alive) return;
  if (state.phase !== GamePhase.AIMING) return;

  if (!canFire(player)) return;

  playFire();
  consumeAmmo(player);

  const weapon = getPlayerWeapon(player);
  const proj = createProjectile(player, weapon);
  state.projectiles.push(proj);
  state.phase = GamePhase.FIRING;
}

function endTurn() {
  // Check if round is over
  const alive = getAliveCount();
  if (alive <= 1) {
    endRound();
    return;
  }

  // Next player
  if (!nextPlayer()) {
    endRound();
    return;
  }

  // New wind variation
  state.wind += (Math.random() - 0.5) * 4;
  state.wind = Math.max(-15, Math.min(15, state.wind));

  startTurn();
}

function endRound() {
  // Award points to survivors
  for (const p of state.players) {
    if (p.alive) {
      p.score += 1000;
      p.money += 3000;
    }
  }

  state.round++;

  if (state.round > state.totalRounds) {
    state.phase = GamePhase.GAME_OVER;
    return;
  }

  // Revive all players for next round
  for (const p of state.players) {
    p.alive = true;
    p.hp = 100;
  }

  // Open shop
  openShop();
}

function clearAITimeout() {
  if (aiTimeout) {
    clearTimeout(aiTimeout);
    aiTimeout = null;
  }
}

function gameLoop() {
  processHeldKeys();
  update();
  renderFrame();
  animFrame = requestAnimationFrame(gameLoop);
}

function update() {
  if (state.phase === GamePhase.FIRING) {
    const allDone = updateProjectiles();
    updateNapalm();
    updateExplosions();
    updateParticles();

    if (allDone && state.explosions.length === 0 && state.napalmFires.length === 0) {
      // All projectiles done, end turn
      endTurn();
    }
  } else if (state.phase === GamePhase.AIMING) {
    updateExplosions();
    updateParticles();
  }
}

function renderFrame() {
  switch (state.phase) {
    case GamePhase.MENU:
      renderMenu();
      break;
    case GamePhase.GAME_OVER:
      render();
      renderGameOver();
      break;
    case GamePhase.AIMING:
      render();
      drawAimingGuide(getCurrentPlayer());
      break;
    case GamePhase.FIRING:
    case GamePhase.SHOP:
      render();
      break;
    default:
      render();
  }
}

// Shop callbacks on window
window.shopBuy = (id) => {
  playUIClick();
  buyWeapon(id);
};
window.shopSell = (id) => {
  playUIClick();
  sellWeapon(id);
};
window.shopDone = () => {
  playUIClick();
  const allDone = finishShopping();
  if (allDone) {
    document.getElementById('shop-overlay').style.display = 'none';
    startRound();
  }
};

// Menu start callback
window.startGame = () => {
  startGame();
};

// Fire button for mobile
window.fireMobile = () => {
  console.log('FIRE pressed, phase:', state.phase, 'player:', getCurrentPlayer()?.name);
  fireWeapon();
};

// Mobile control: set angle
window.setAngle = (val) => {
  const player = getCurrentPlayer();
  if (player && !player.isAI && state.phase === GamePhase.AIMING) {
    player.angle = parseInt(val);
    const el = document.getElementById('angle-val');
    if (el) el.textContent = val + '°';
  }
};

// Mobile control: set power
window.setPower = (val) => {
  const player = getCurrentPlayer();
  if (player && !player.isAI && state.phase === GamePhase.AIMING) {
    player.power = parseInt(val);
    const el = document.getElementById('power-val');
    if (el) el.textContent = val;
  }
};

// Mobile control: next weapon
window.nextWeapon = () => {
  const player = getCurrentPlayer();
  if (player && !player.isAI && state.phase === GamePhase.AIMING) {
    selectNextWeapon(player, 1);
  }
};

// Mobile control: prev weapon
window.prevWeapon = () => {
  const player = getCurrentPlayer();
  if (player && !player.isAI && state.phase === GamePhase.AIMING) {
    selectNextWeapon(player, -1);
  }
};

// Mobile control: move left
window.moveLeft = () => {
  const player = getCurrentPlayer();
  if (player && !player.isAI && state.phase === GamePhase.AIMING) {
    moveTank(player, -1, state.terrain);
  }
};

// Mobile control: move right
window.moveRight = () => {
  const player = getCurrentPlayer();
  if (player && !player.isAI && state.phase === GamePhase.AIMING) {
    moveTank(player, 1, state.terrain);
  }
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Direct event listeners for mobile controls (more reliable than onclick attributes)
document.addEventListener('DOMContentLoaded', () => {
  const angleSlider = document.getElementById('angle-slider');
  const powerSlider = document.getElementById('power-slider');
  const fireBtn = document.querySelector('.fire-btn');

  if (angleSlider) {
    angleSlider.addEventListener('input', (e) => {
      const player = getCurrentPlayer();
      if (player && !player.isAI && state.phase === GamePhase.AIMING) {
        player.angle = parseInt(e.target.value);
        const el = document.getElementById('angle-val');
        if (el) el.textContent = e.target.value + '°';
      }
    });
  }

  if (powerSlider) {
    powerSlider.addEventListener('input', (e) => {
      const player = getCurrentPlayer();
      if (player && !player.isAI && state.phase === GamePhase.AIMING) {
        player.power = parseInt(e.target.value);
        const el = document.getElementById('power-val');
        if (el) el.textContent = e.target.value;
      }
    });
  }

  if (fireBtn) {
    fireBtn.addEventListener('click', () => { fireWeapon(); });
    fireBtn.addEventListener('touchend', (e) => { e.preventDefault(); fireWeapon(); });
  }
});
