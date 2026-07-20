// input.js - Keyboard + touch + mouse controls
import { state, GamePhase, getCurrentPlayer } from './state.js';
import { moveTank } from './tanks.js';
import { selectNextWeapon } from './weapons.js';

const keys = {};
let mouseDown = false;
let mouseX = 0;
let mouseY = 0;
let touchAngleDrag = false;

export function initInput(canvas, callbacks) {
  // Keyboard
  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    handleKeyDown(e, callbacks);
  });

  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Mouse
  canvas.addEventListener('mousedown', (e) => {
    mouseDown = true;
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    handleMouseDown(callbacks);
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (mouseDown) {
      handleMouseDrag(callbacks);
    }
  });

  canvas.addEventListener('mouseup', () => {
    mouseDown = false;
    touchAngleDrag = false;
  });

  // Touch
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    mouseX = (touch.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (touch.clientY - rect.top) * (canvas.height / rect.height);
    mouseDown = true;
    handleMouseDown(callbacks);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    mouseX = (touch.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (touch.clientY - rect.top) * (canvas.height / rect.height);
    if (mouseDown) {
      handleMouseDrag(callbacks);
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    mouseDown = false;
    touchAngleDrag = false;
  }, { passive: false });
}

function handleKeyDown(e, callbacks) {
  if (state.phase === GamePhase.GAME_OVER) {
    if (e.code === 'Space') {
      callbacks.onRestart();
    }
    return;
  }

  if (state.phase !== GamePhase.AIMING) return;

  const player = getCurrentPlayer();
  if (!player || player.isAI) return;

  switch (e.code) {
    case 'ArrowLeft':
      player.angle = Math.min(180, player.angle + 2);
      break;
    case 'ArrowRight':
      player.angle = Math.max(0, player.angle - 2);
      break;
    case 'ArrowUp':
      player.power = Math.min(100, player.power + 2);
      break;
    case 'ArrowDown':
      player.power = Math.max(5, player.power - 2);
      break;
    case 'Space':
      e.preventDefault();
      callbacks.onFire();
      break;
    case 'KeyA':
      moveTank(player, -1, state.terrain);
      break;
    case 'KeyD':
      moveTank(player, 1, state.terrain);
      break;
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
    case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9':
      {
        const idx = parseInt(e.code.replace('Digit', '')) - 1;
        if (player.weapons[idx] && player.weapons[idx].owned > 0) {
          player.selectedWeapon = idx;
        }
      }
      break;
    case 'Digit0':
      if (player.weapons[9] && player.weapons[9].owned > 0) {
        player.selectedWeapon = 9;
      }
      break;
    case 'Tab':
      e.preventDefault();
      selectNextWeapon(player, e.shiftKey ? -1 : 1);
      break;
  }
}

function handleMouseDown(callbacks) {
  if (state.phase === GamePhase.GAME_OVER) {
    callbacks.onRestart();
    return;
  }

  if (state.phase !== GamePhase.AIMING) return;

  const player = getCurrentPlayer();
  if (!player || player.isAI) return;

  // Check if clicking near the tank to start angle/power drag
  const dist = Math.sqrt((mouseX - player.x) ** 2 + (mouseY - player.y) ** 2);
  if (dist < 60) {
    touchAngleDrag = true;
  }
}

function handleMouseDrag(callbacks) {
  if (state.phase !== GamePhase.AIMING) return;
  if (!touchAngleDrag) return;

  const player = getCurrentPlayer();
  if (!player || player.isAI) return;

  // Set angle based on mouse position relative to tank
  const dx = mouseX - player.x;
  const dy = player.y - mouseY; // inverted because canvas y is down
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  angle = Math.max(0, Math.min(180, angle));
  player.angle = angle;

  // Set power based on distance
  const dist = Math.sqrt(dx * dx + dy * dy);
  player.power = Math.min(100, Math.max(5, dist * 0.8));
}

export function processHeldKeys() {
  if (state.phase !== GamePhase.AIMING) return;

  const player = getCurrentPlayer();
  if (!player || player.isAI) return;

  if (keys['KeyA']) {
    moveTank(player, -1, state.terrain);
  }
  if (keys['KeyD']) {
    moveTank(player, 1, state.terrain);
  }
}
