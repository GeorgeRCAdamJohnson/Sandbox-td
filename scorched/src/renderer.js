// renderer.js - All drawing: terrain, tanks, UI, effects
import { CANVAS_W, CANVAS_H, TANK_WIDTH, TANK_HEIGHT } from './constants.js';
import { state, GamePhase, getCurrentPlayer } from './state.js';
import { getTerrainHeight } from './terrain.js';
import { getPlayerWeapon } from './weapons.js';

let ctx = null;
let canvas = null;

export function initRenderer(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext('2d');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  // Detect low perf
  if (/Mobi|Android/i.test(navigator.userAgent)) {
    state.lowPerfMode = true;
  }
}

export function render() {
  if (!ctx) return;

  // Clear
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Draw grid
  if (!state.lowPerfMode) {
    drawGrid();
  }

  // Draw terrain
  drawTerrain();

  // Draw napalm fires
  drawNapalm();

  // Draw tanks
  drawTanks();

  // Draw projectiles
  drawProjectiles();

  // Draw explosions
  drawExplosions();

  // Draw particles
  drawParticles();

  // Draw HUD
  drawHUD();

  // Draw wind indicator
  drawWind();
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(0, 100, 150, 0.08)';
  ctx.lineWidth = 1;
  const gridSize = 40;

  for (let x = 0; x < CANVAS_W; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_H);
    ctx.stroke();
  }
  for (let y = 0; y < CANVAS_H; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
    ctx.stroke();
  }
}

function drawTerrain() {
  if (!state.terrain || state.terrain.length === 0) return;

  // Fill terrain
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H);
  for (let x = 0; x < CANVAS_W; x++) {
    ctx.lineTo(x, state.terrain[x]);
  }
  ctx.lineTo(CANVAS_W, CANVAS_H);
  ctx.closePath();

  // Dark fill
  ctx.fillStyle = '#0a1a0a';
  ctx.fill();

  // Glowing edge on top surface
  ctx.beginPath();
  ctx.moveTo(0, state.terrain[0]);
  for (let x = 1; x < CANVAS_W; x++) {
    ctx.lineTo(x, state.terrain[x]);
  }

  if (!state.lowPerfMode) {
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
  }
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawNapalm() {
  for (const fire of state.napalmFires) {
    const alpha = fire.life / 180;
    ctx.fillStyle = `rgba(255, 68, 0, ${alpha * 0.3})`;
    const y = getTerrainHeight(state.terrain, fire.x);
    ctx.fillRect(fire.startX, y - 10, fire.endX - fire.startX, 15);
  }
}

function drawTanks() {
  const VISUAL_TANK_W = 28;
  const VISUAL_TANK_H = 16;
  for (const player of state.players) {
    if (!player.alive) continue;

    const x = player.x;
    const y = player.y;

    // Tank body
    ctx.fillStyle = player.color;
    if (!state.lowPerfMode) {
      ctx.shadowColor = player.color;
      ctx.shadowBlur = 6;
    }

    // Body rectangle (visual size)
    ctx.fillRect(
      x - VISUAL_TANK_W / 2,
      y - VISUAL_TANK_H,
      VISUAL_TANK_W,
      VISUAL_TANK_H
    );

    // Turret
    const angleRad = (player.angle * Math.PI) / 180;
    const turretLen = 18;
    const tx = x + Math.cos(angleRad) * turretLen;
    const ty = y - VISUAL_TANK_H / 2 - Math.sin(angleRad) * turretLen;

    ctx.beginPath();
    ctx.moveTo(x, y - VISUAL_TANK_H / 2);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = player.color;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // HP bar
    const hpWidth = VISUAL_TANK_W + 6;
    const hpHeight = 5;
    const hpX = x - hpWidth / 2;
    const hpY = y - VISUAL_TANK_H - 10;

    ctx.fillStyle = '#333';
    ctx.fillRect(hpX, hpY, hpWidth, hpHeight);
    const hpFrac = player.hp / 100;
    const hpColor = hpFrac > 0.5 ? '#00ff00' : hpFrac > 0.25 ? '#ffff00' : '#ff0000';
    ctx.fillStyle = hpColor;
    ctx.fillRect(hpX, hpY, hpWidth * hpFrac, hpHeight);

    // Current player indicator
    if (state.phase === GamePhase.AIMING && player.index === state.currentPlayerIndex) {
      ctx.fillStyle = player.color;
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▼', x, y - VISUAL_TANK_H - 16);
    }
  }
}

function drawProjectiles() {
  for (const p of state.projectiles) {
    if (!p.active) continue;

    // Trail
    for (let i = 0; i < p.trail.length; i++) {
      const alpha = i / p.trail.length;
      ctx.fillStyle = `rgba(255, 255, 100, ${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(p.trail[i].x, p.trail[i].y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Projectile
    ctx.fillStyle = '#ffffff';
    if (!state.lowPerfMode) {
      ctx.shadowColor = '#ffff00';
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawExplosions() {
  for (const e of state.explosions) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.strokeStyle = e.color;
    ctx.globalAlpha = e.alpha;
    ctx.lineWidth = 2;

    if (!state.lowPerfMode) {
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 15;
    }
    ctx.stroke();

    // Inner glow
    ctx.fillStyle = `rgba(255, 255, 255, ${e.alpha * 0.2})`;
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  if (state.phase !== GamePhase.AIMING && state.phase !== GamePhase.FIRING) return;

  const player = getCurrentPlayer();
  if (!player) return;

  const weapon = getPlayerWeapon(player);

  // Left panel: player info
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(5, 5, 220, 100);
  ctx.strokeStyle = player.color;
  ctx.lineWidth = 1;
  ctx.strokeRect(5, 5, 220, 100);

  ctx.font = '14px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = player.color;
  ctx.fillText(`${player.name}`, 15, 25);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`HP: ${player.hp}  Fuel: ${Math.floor(player.fuel)}`, 15, 42);
  ctx.fillText(`Angle: ${Math.round(player.angle)}°  Power: ${Math.round(player.power)}`, 15, 58);
  ctx.fillText(`Weapon: ${weapon ? weapon.name : 'None'}`, 15, 74);
  const ammo = weapon && weapon.owned === Infinity ? '∞' : (weapon ? weapon.owned : 0);
  ctx.fillText(`Ammo: ${ammo}  $${player.money.toLocaleString()}`, 15, 90);

  // Right panel: all players HP
  const panelW = 160;
  const panelX = CANVAS_W - panelW - 5;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(panelX, 5, panelW, 20 + state.players.length * 18);
  ctx.strokeStyle = '#444';
  ctx.strokeRect(panelX, 5, panelW, 20 + state.players.length * 18);

  ctx.font = '13px monospace';
  ctx.fillStyle = '#888';
  ctx.fillText('Players', panelX + 10, 20);

  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    ctx.fillStyle = p.alive ? p.color : '#444';
    ctx.fillText(
      `${p.name}: ${p.alive ? p.hp + ' HP' : 'DEAD'}`,
      panelX + 10,
      38 + i * 18
    );
  }

  // Round info
  ctx.font = '13px monospace';
  ctx.fillStyle = '#888';
  ctx.textAlign = 'center';
  ctx.fillText(`Round ${state.round} / ${state.totalRounds}`, CANVAS_W / 2, CANVAS_H - 10);
}

function drawWind() {
  if (state.phase !== GamePhase.AIMING && state.phase !== GamePhase.FIRING) return;

  const wind = state.wind;
  const cx = CANVAS_W / 2;
  const cy = 20;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(cx - 60, cy - 12, 120, 24);

  // Arrow
  const arrowLen = Math.abs(wind) * 3;
  const dir = wind > 0 ? 1 : -1;

  if (Math.abs(wind) > 0.1) {
    ctx.beginPath();
    ctx.moveTo(cx - dir * arrowLen, cy);
    ctx.lineTo(cx + dir * arrowLen, cy);
    // Arrow head
    ctx.lineTo(cx + dir * (arrowLen - 6), cy - 4);
    ctx.moveTo(cx + dir * arrowLen, cy);
    ctx.lineTo(cx + dir * (arrowLen - 6), cy + 4);
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.font = '10px monospace';
  ctx.fillStyle = '#00ccff';
  ctx.textAlign = 'center';
  ctx.fillText(`Wind: ${wind.toFixed(1)}`, cx, cy + 20);
}

export function drawAimingGuide(player) {
  if (!player || state.phase !== GamePhase.AIMING) return;

  // Draw dotted trajectory preview (first few points)
  const angleRad = (player.angle * Math.PI) / 180;
  const speed = player.power * 0.2;
  let vx = Math.cos(angleRad) * speed;
  let vy = -Math.sin(angleRad) * speed;
  let x = player.x;
  let y = player.y - TANK_HEIGHT;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  for (let i = 0; i < 20; i++) {
    vx += state.wind * 0.01;
    vy += GRAVITY;
    x += vx;
    y += vy;

    if (x < 0 || x >= CANVAS_W || y > CANVAS_H) break;
    if (y >= getTerrainHeight(state.terrain, x)) break;

    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function renderMenu() {
  if (!ctx) return;

  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (!state.lowPerfMode) {
    drawGrid();
  }

  // Title
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#00ffff';
  if (!state.lowPerfMode) {
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 20;
  }
  ctx.fillText('VECTRON SCORCHED', CANVAS_W / 2, 120);
  ctx.shadowBlur = 0;

  ctx.font = '16px monospace';
  ctx.fillStyle = '#ff00ff';
  ctx.fillText('The Mother of All Games', CANVAS_W / 2, 155);

  // Instructions
  ctx.font = '14px monospace';
  ctx.fillStyle = '#888';
  ctx.fillText('Configure options below and press START', CANVAS_W / 2, 200);

  // Options rendered by HTML overlay
}

export function renderGameOver() {
  if (!ctx) return;

  ctx.fillStyle = 'rgba(5, 5, 16, 0.85)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffff00';
  if (!state.lowPerfMode) {
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 15;
  }
  ctx.fillText('GAME OVER', CANVAS_W / 2, 150);
  ctx.shadowBlur = 0;

  // Scores
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  ctx.font = '18px monospace';
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    ctx.fillStyle = p.color;
    ctx.fillText(
      `${i + 1}. ${p.name} - Score: ${p.score} - $${p.money.toLocaleString()}`,
      CANVAS_W / 2,
      220 + i * 35
    );
  }

  ctx.font = '14px monospace';
  ctx.fillStyle = '#888';
  ctx.fillText('Press SPACE or click to play again', CANVAS_W / 2, 400);
}
