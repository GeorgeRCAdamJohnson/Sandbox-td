// renderer.js - All drawing: terrain, tanks, UI, effects v3 - TRON VISUAL OVERHAUL
import { CANVAS_W, CANVAS_H, TANK_WIDTH, TANK_HEIGHT, GRAVITY } from './constants.js';
import { state, GamePhase, getCurrentPlayer } from './state.js';
import { getTerrainHeight } from './terrain.js';
import { getPlayerWeapon } from './weapons.js';

let ctx = null;
let canvas = null;
let animFrame = 0;
let starField = [];
let craterGlows = [];
let muzzleFlashes = [];
let windParticles = [];
let screenFlash = 0;


export function initRenderer(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext('2d');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  // Generate starfield
  starField = [];
  for (let i = 0; i < 50; i++) {
    starField.push({
      x: Math.random() * CANVAS_W,
      y: Math.random() * (CANVAS_H * 0.6),
      size: Math.random() * 1.5 + 0.5,
      twinkleSpeed: Math.random() * 0.05 + 0.02,
      phase: Math.random() * Math.PI * 2
    });
  }

  // Detect low perf
  if (/Mobi|Android/i.test(navigator.userAgent)) {
    state.lowPerfMode = true;
  }
}


export function render() {
  if (!ctx) return;
  animFrame++;

  // Screen flash effect
  if (screenFlash > 0) screenFlash -= 0.05;

  // Update wind particles
  updateWindParticles();

  // Update crater glows
  craterGlows = craterGlows.filter(c => { c.life--; return c.life > 0; });

  // Update muzzle flashes
  muzzleFlashes = muzzleFlashes.filter(m => { m.life--; return m.life > 0; });

  // Clear
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Draw background layers
  if (!state.lowPerfMode) {
    drawHorizonGlow();
    drawStarfield();
    drawGrid();
    drawScanline();
  }

  // Draw terrain
  drawTerrain();

  // Draw crater glows
  drawCraterGlows();

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

  // Screen flash overlay
  if (screenFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${screenFlash})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // Draw HUD
  drawHUD();

  // Draw wind indicator
  drawWind();
}


function drawHorizonGlow() {
  // Subtle gradient at the horizon area
  const minTerrain = Math.min(...state.terrain.slice(0, CANVAS_W).filter(v => v > 0));
  const horizonY = minTerrain || CANVAS_H * 0.6;
  const grad = ctx.createLinearGradient(0, horizonY - 100, 0, horizonY);
  grad.addColorStop(0, 'rgba(20, 0, 60, 0)');
  grad.addColorStop(0.7, 'rgba(30, 0, 80, 0.15)');
  grad.addColorStop(1, 'rgba(0, 20, 60, 0.1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, horizonY - 100, CANVAS_W, 100);
}

function drawStarfield() {
  for (const star of starField) {
    // Only draw stars above terrain
    const terrainY = state.terrain[Math.floor(star.x)] || CANVAS_H;
    if (star.y >= terrainY - 5) continue;

    const twinkle = Math.sin(animFrame * star.twinkleSpeed + star.phase);
    const alpha = 0.3 + twinkle * 0.4;
    if (alpha <= 0) continue;
    ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
}


function drawGrid() {
  const gridPulse = Math.sin(animFrame * 0.02) * 0.3 + 0.7;
  ctx.strokeStyle = `rgba(0, 150, 200, ${0.06 * gridPulse})`;
  ctx.lineWidth = 0.5;
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

  // Intersection dots
  ctx.fillStyle = `rgba(0, 200, 255, ${0.15 * gridPulse})`;
  for (let x = 0; x < CANVAS_W; x += gridSize) {
    for (let y = 0; y < CANVAS_H; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawScanline() {
  const scanY = (animFrame * 0.4) % CANVAS_H;
  ctx.strokeStyle = 'rgba(0, 255, 200, 0.03)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, scanY);
  ctx.lineTo(CANVAS_W, scanY);
  ctx.stroke();
}


function drawTerrain() {
  if (!state.terrain || state.terrain.length === 0) return;

  // Main terrain fill with gradient (darker at bottom, lighter near surface)
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H);
  for (let x = 0; x < CANVAS_W; x++) {
    ctx.lineTo(x, state.terrain[x]);
  }
  ctx.lineTo(CANVAS_W, CANVAS_H);
  ctx.closePath();

  const terrainGrad = ctx.createLinearGradient(0, CANVAS_H * 0.4, 0, CANVAS_H);
  terrainGrad.addColorStop(0, '#0a2a0a');
  terrainGrad.addColorStop(0.4, '#081808');
  terrainGrad.addColorStop(1, '#030d03');
  ctx.fillStyle = terrainGrad;
  ctx.fill();

  // Rock strata lines (subtle horizontal lines at different depths)
  if (!state.lowPerfMode) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H);
    for (let x = 0; x < CANVAS_W; x++) {
      ctx.lineTo(x, state.terrain[x]);
    }
    ctx.lineTo(CANVAS_W, CANVAS_H);
    ctx.closePath();
    ctx.clip();

    const strataDepths = [0.15, 0.3, 0.5, 0.7, 0.85];
    for (const depth of strataDepths) {
      const yOffset = CANVAS_H * depth;
      ctx.strokeStyle = `rgba(0, 80, 40, ${0.12 - depth * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < CANVAS_W; x += 3) {
        const wobble = Math.sin(x * 0.02 + depth * 10) * 3;
        const y = yOffset + wobble;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }


  // Glowing terrain edge with pulse
  const edgePulse = 0.7 + Math.sin(animFrame * 0.03) * 0.3;
  ctx.beginPath();
  ctx.moveTo(0, state.terrain[0]);
  for (let x = 1; x < CANVAS_W; x++) {
    ctx.lineTo(x, state.terrain[x]);
  }

  if (!state.lowPerfMode) {
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 10 * edgePulse;
  }
  ctx.strokeStyle = `rgba(0, 255, 136, ${0.7 * edgePulse})`;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Second brighter pass for edge
  ctx.strokeStyle = `rgba(100, 255, 180, ${0.4 * edgePulse})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Surface crystals / sparkle dots along the terrain edge
  if (!state.lowPerfMode) {
    for (let x = 0; x < CANVAS_W; x += 7) {
      const sparkle = Math.sin(animFrame * 0.1 + x * 0.5);
      if (sparkle > 0.7) {
        const alpha = (sparkle - 0.7) * 3;
        ctx.fillStyle = `rgba(180, 255, 220, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, state.terrain[x] - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}


function drawCraterGlows() {
  for (const crater of craterGlows) {
    const alpha = (crater.life / crater.maxLife) * 0.6;
    const grad = ctx.createRadialGradient(crater.x, crater.y, 0, crater.x, crater.y, crater.radius);
    grad.addColorStop(0, `rgba(255, 100, 0, ${alpha})`);
    grad.addColorStop(0.5, `rgba(255, 50, 0, ${alpha * 0.5})`);
    grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(crater.x, crater.y, crater.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function addCraterGlow(x, y, radius) {
  craterGlows.push({ x, y, radius: radius * 1.5, life: 60, maxLife: 60 });
}

export function addMuzzleFlash(x, y, color) {
  muzzleFlashes.push({ x, y, color, life: 6 });
}

export function triggerScreenFlash(intensity) {
  screenFlash = Math.min(intensity, 0.8);
}


function drawNapalm() {
  for (const fire of state.napalmFires) {
    const alpha = fire.life / 180;
    const y = getTerrainHeight(state.terrain, fire.x);
    // More dramatic napalm with glow
    const grad = ctx.createLinearGradient(fire.startX, y - 15, fire.startX, y + 10);
    grad.addColorStop(0, `rgba(255, 200, 0, ${alpha * 0.2})`);
    grad.addColorStop(0.5, `rgba(255, 68, 0, ${alpha * 0.5})`);
    grad.addColorStop(1, `rgba(200, 0, 0, ${alpha * 0.1})`);
    ctx.fillStyle = grad;
    ctx.fillRect(fire.startX, y - 15, fire.endX - fire.startX, 20);

    // Flickering fire particles
    if (!state.lowPerfMode) {
      for (let fx = fire.startX; fx < fire.endX; fx += 8) {
        const flicker = Math.random();
        if (flicker > 0.6) {
          const fh = Math.random() * 12 + 4;
          ctx.fillStyle = `rgba(255, ${Math.floor(100 + Math.random() * 100)}, 0, ${alpha * flicker * 0.4})`;
          ctx.fillRect(fx, y - fh, 3, fh);
        }
      }
    }
  }
}


function drawTanks() {
  const VISUAL_W = 30;
  const VISUAL_H = 18;

  for (const player of state.players) {
    if (!player.alive) continue;

    const x = player.x;
    const y = player.y;
    const color = player.color;

    // Parse color for dimmer variants
    const dimColor = colorWithAlpha(color, 0.3);

    // === TRACKS / TREADS ===
    ctx.fillStyle = colorWithAlpha(color, 0.5);
    const treadY = y - 3;
    const treadW = VISUAL_W + 4;
    const treadX = x - treadW / 2;
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(treadX + i * (treadW / 8) + 1, treadY, (treadW / 8) - 2, 3);
    }

    // === TANK BODY - Trapezoid ===
    ctx.beginPath();
    const bodyTop = y - VISUAL_H;
    const bodyBot = y - 3;
    const topInset = 4;
    ctx.moveTo(x - VISUAL_W / 2, bodyBot);           // bottom-left
    ctx.lineTo(x + VISUAL_W / 2, bodyBot);           // bottom-right
    ctx.lineTo(x + VISUAL_W / 2 - topInset, bodyTop); // top-right
    ctx.lineTo(x - VISUAL_W / 2 + topInset, bodyTop); // top-left
    ctx.closePath();

    // Dark fill with slight gradient
    const bodyGrad = ctx.createLinearGradient(x, bodyTop, x, bodyBot);
    bodyGrad.addColorStop(0, 'rgba(20, 20, 30, 0.9)');
    bodyGrad.addColorStop(1, 'rgba(10, 10, 15, 0.95)');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Glowing outline
    if (!state.lowPerfMode) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;


    // === INNER CIRCUIT DETAIL LINES ===
    if (!state.lowPerfMode) {
      ctx.strokeStyle = colorWithAlpha(color, 0.25);
      ctx.lineWidth = 0.5;
      // Horizontal lines
      const midY = (bodyTop + bodyBot) / 2;
      ctx.beginPath();
      ctx.moveTo(x - VISUAL_W / 3, midY);
      ctx.lineTo(x + VISUAL_W / 3, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - VISUAL_W / 4, midY - 4);
      ctx.lineTo(x + VISUAL_W / 4, midY - 4);
      ctx.stroke();
      // Vertical accent
      ctx.beginPath();
      ctx.moveTo(x, bodyTop + 3);
      ctx.lineTo(x, bodyBot - 3);
      ctx.stroke();
      // Small angular details
      ctx.beginPath();
      ctx.moveTo(x - 8, bodyBot - 4);
      ctx.lineTo(x - 4, bodyTop + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 8, bodyBot - 4);
      ctx.lineTo(x + 4, bodyTop + 4);
      ctx.stroke();
    }

    // === TURRET - Tapered barrel ===
    const angleRad = (player.angle * Math.PI) / 180;
    const turretLen = 20;
    const baseWidth = 5;
    const tipWidth = 2;

    const turretBaseX = x;
    const turretBaseY = y - VISUAL_H / 2 - 3;
    const turretTipX = turretBaseX + Math.cos(angleRad) * turretLen;
    const turretTipY = turretBaseY - Math.sin(angleRad) * turretLen;

    // Draw tapered barrel
    const perpAngle = angleRad + Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(
      turretBaseX + Math.cos(perpAngle) * baseWidth,
      turretBaseY - Math.sin(perpAngle) * baseWidth
    );
    ctx.lineTo(
      turretTipX + Math.cos(perpAngle) * tipWidth,
      turretTipY - Math.sin(perpAngle) * tipWidth
    );
    ctx.lineTo(
      turretTipX - Math.cos(perpAngle) * tipWidth,
      turretTipY + Math.sin(perpAngle) * tipWidth
    );
    ctx.lineTo(
      turretBaseX - Math.cos(perpAngle) * baseWidth,
      turretBaseY + Math.sin(perpAngle) * baseWidth
    );
    ctx.closePath();


    ctx.fillStyle = 'rgba(15, 15, 25, 0.9)';
    ctx.fill();
    if (!state.lowPerfMode) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Muzzle glow dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(turretTipX, turretTipY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // === MUZZLE FLASH ===
    for (const flash of muzzleFlashes) {
      if (Math.abs(flash.x - turretTipX) < 30 && Math.abs(flash.y - turretTipY) < 30) {
        const flashAlpha = flash.life / 6;
        ctx.fillStyle = `rgba(255, 255, 200, ${flashAlpha})`;
        if (!state.lowPerfMode) {
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 15;
        }
        ctx.beginPath();
        ctx.arc(turretTipX, turretTipY, 6 * flashAlpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // === HP BAR ===
    const hpWidth = VISUAL_W + 6;
    const hpHeight = 4;
    const hpX = x - hpWidth / 2;
    const hpY = y - VISUAL_H - 12;

    ctx.fillStyle = 'rgba(30, 30, 40, 0.8)';
    ctx.fillRect(hpX, hpY, hpWidth, hpHeight);
    ctx.strokeStyle = 'rgba(100, 100, 120, 0.5)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(hpX, hpY, hpWidth, hpHeight);

    const hpFrac = player.hp / 100;
    const hpColor = hpFrac > 0.5 ? '#00ff00' : hpFrac > 0.25 ? '#ffff00' : '#ff0000';
    ctx.fillStyle = hpColor;
    ctx.fillRect(hpX + 0.5, hpY + 0.5, (hpWidth - 1) * hpFrac, hpHeight - 1);


    // Current player indicator
    if (state.phase === GamePhase.AIMING && player.index === state.currentPlayerIndex) {
      ctx.fillStyle = color;
      if (!state.lowPerfMode) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
      }
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('▼', x, y - VISUAL_H - 18);
      ctx.shadowBlur = 0;
    }
  }
}


function drawProjectiles() {
  for (const p of state.projectiles) {
    if (!p.active) continue;

    // Determine projectile color from the player who fired
    const playerColor = (state.players[p.playerIndex] && state.players[p.playerIndex].color) || '#ffffff';

    // Trail - thicker and colored
    for (let i = 0; i < p.trail.length; i++) {
      const alpha = (i / p.trail.length) * 0.7;
      ctx.fillStyle = colorWithAlpha(playerColor, alpha * 0.8);
      ctx.beginPath();
      ctx.arc(p.trail[i].x, p.trail[i].y, 3 * (i / p.trail.length), 0, Math.PI * 2);
      ctx.fill();
    }

    // Motion blur - elongated shape in direction of travel
    if (p.trail.length > 1) {
      const prev = p.trail[p.trail.length - 1];
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 2) {
        const nx = dx / dist;
        const ny = dy / dist;
        ctx.beginPath();
        ctx.moveTo(p.x - nx * dist * 0.5, p.y - ny * dist * 0.5);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = colorWithAlpha(playerColor, 0.4);
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }

    // Projectile core - larger and brighter
    if (!state.lowPerfMode) {
      ctx.shadowColor = playerColor;
      ctx.shadowBlur = 12;
    }
    // Outer glow
    ctx.fillStyle = colorWithAlpha(playerColor, 0.4);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    // Bright core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    // Inner hot spot
    ctx.fillStyle = playerColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}


function drawExplosions() {
  for (const e of state.explosions) {
    const progress = 1 - e.alpha;

    // Outer shockwave ring (expands beyond damage radius)
    if (!state.lowPerfMode) {
      const shockRadius = e.radius * (1 + progress * 0.5);
      ctx.beginPath();
      ctx.arc(e.x, e.y, shockRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 100, 50, ${e.alpha * 0.3})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Outer red ring
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 50, 0, ${e.alpha})`;
    ctx.lineWidth = 3;
    if (!state.lowPerfMode) {
      ctx.shadowColor = '#ff3300';
      ctx.shadowBlur = 15;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Middle orange ring
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 150, 0, ${e.alpha * 0.8})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner white hot core
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * 0.3, 0, Math.PI * 2);
    const coreGrad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius * 0.3);
    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${e.alpha * 0.8})`);
    coreGrad.addColorStop(0.5, `rgba(255, 200, 50, ${e.alpha * 0.5})`);
    coreGrad.addColorStop(1, `rgba(255, 100, 0, ${e.alpha * 0.2})`);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Fill with fading glow
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 150, 50, ${e.alpha * 0.1})`;
    ctx.fill();
  }
}


function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    if (!state.lowPerfMode) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 3;
    }
    // Varied particle sizes
    const size = 1 + Math.random() * 2;
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}


function drawHUD() {
  if (state.phase !== GamePhase.AIMING && state.phase !== GamePhase.FIRING) return;

  const player = getCurrentPlayer();
  if (!player) return;

  const weapon = getPlayerWeapon(player);

  // Turn indicator bar at the very top
  ctx.fillStyle = colorWithAlpha(player.color, 0.3);
  ctx.fillRect(0, 0, CANVAS_W, 3);
  if (!state.lowPerfMode) {
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 6;
  }
  ctx.fillStyle = player.color;
  ctx.fillRect(0, 0, CANVAS_W, 2);
  ctx.shadowBlur = 0;

  // Left panel: player info with border glow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(5, 8, 220, 100);
  if (!state.lowPerfMode) {
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 8;
  }
  ctx.strokeStyle = player.color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(5, 8, 220, 100);
  ctx.shadowBlur = 0;

  // Player name with text shadow
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  if (!state.lowPerfMode) {
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 6;
  }
  ctx.fillStyle = player.color;
  ctx.fillText(`${player.name}`, 15, 28);
  ctx.shadowBlur = 0;

  ctx.font = '13px monospace';
  ctx.fillStyle = '#cccccc';
  ctx.fillText(`HP: ${player.hp}  Fuel: ${Math.floor(player.fuel)}`, 15, 44);
  ctx.fillText(`Angle: ${Math.round(player.angle)}°  Power: ${Math.round(player.power)}`, 15, 60);

  // Weapon name highlighted
  ctx.fillStyle = '#ffcc00';
  ctx.fillText(`Weapon: ${weapon ? weapon.name : 'None'}`, 15, 76);
  ctx.fillStyle = '#cccccc';
  const ammo = weapon && weapon.owned === Infinity ? '∞' : (weapon ? weapon.owned : 0);
  ctx.fillText(`Ammo: ${ammo}  $${player.money.toLocaleString()}`, 15, 92);


  // Right panel: all players HP with border glow
  const panelW = 160;
  const panelX = CANVAS_W - panelW - 5;
  const panelH = 20 + state.players.length * 18;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(panelX, 8, panelW, panelH);
  if (!state.lowPerfMode) {
    ctx.shadowColor = '#0088ff';
    ctx.shadowBlur = 6;
  }
  ctx.strokeStyle = 'rgba(0, 136, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, 8, panelW, panelH);
  ctx.shadowBlur = 0;

  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#88aacc';
  ctx.fillText('PLAYERS', panelX + 10, 22);

  ctx.font = '12px monospace';
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    ctx.fillStyle = p.alive ? p.color : '#444';
    if (!state.lowPerfMode && p.alive) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 3;
    }
    ctx.fillText(
      `${p.name}: ${p.alive ? p.hp + ' HP' : 'DEAD'}`,
      panelX + 10,
      40 + i * 18
    );
    ctx.shadowBlur = 0;
  }

  // Round info
  ctx.font = '12px monospace';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.fillText(`Round ${state.round} / ${state.totalRounds}`, CANVAS_W / 2, CANVAS_H - 10);
}


function updateWindParticles() {
  // Generate new wind particles
  if (state.phase === GamePhase.AIMING || state.phase === GamePhase.FIRING) {
    if (Math.abs(state.wind) > 0.5 && animFrame % 4 === 0) {
      const startX = state.wind > 0 ? -5 : CANVAS_W + 5;
      windParticles.push({
        x: startX,
        y: 10 + Math.random() * 20,
        speed: Math.abs(state.wind) * 1.5 + Math.random(),
        life: 80,
        dir: state.wind > 0 ? 1 : -1
      });
    }
  }
  // Update particles
  windParticles = windParticles.filter(wp => {
    wp.x += wp.speed * wp.dir;
    wp.life--;
    return wp.life > 0 && wp.x > -10 && wp.x < CANVAS_W + 10;
  });
}

function drawWind() {
  if (state.phase !== GamePhase.AIMING && state.phase !== GamePhase.FIRING) return;

  const wind = state.wind;
  const cx = CANVAS_W / 2;
  const cy = 22;

  // Background panel
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(cx - 70, cy - 14, 140, 28);
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.3)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(cx - 70, cy - 14, 140, 28);

  // Arrow - larger and more prominent
  const arrowLen = Math.abs(wind) * 4;
  const dir = wind > 0 ? 1 : -1;

  if (Math.abs(wind) > 0.1) {
    if (!state.lowPerfMode) {
      ctx.shadowColor = '#00ccff';
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.moveTo(cx - dir * arrowLen, cy);
    ctx.lineTo(cx + dir * arrowLen, cy);
    // Larger arrow head
    ctx.lineTo(cx + dir * (arrowLen - 8), cy - 5);
    ctx.moveTo(cx + dir * arrowLen, cy);
    ctx.lineTo(cx + dir * (arrowLen - 8), cy + 5);
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Wind particles flowing
  if (!state.lowPerfMode) {
    for (const wp of windParticles) {
      const alpha = wp.life / 80;
      ctx.fillStyle = `rgba(0, 200, 255, ${alpha * 0.5})`;
      ctx.fillRect(wp.x, wp.y, 3, 1);
    }
  }

  ctx.font = '10px monospace';
  ctx.fillStyle = '#00ccff';
  ctx.textAlign = 'center';
  ctx.fillText(`Wind: ${wind.toFixed(1)}`, cx, cy + 22);
}


export function drawAimingGuide(player) {
  if (!player || state.phase !== GamePhase.AIMING) return;

  // Draw dotted trajectory preview starting from turret tip
  const angleRad = (player.angle * Math.PI) / 180;
  const speed = player.power * 0.2;
  let vx = Math.cos(angleRad) * speed;
  let vy = -Math.sin(angleRad) * speed;
  const turretLen = 20;
  let x = player.x + Math.cos(angleRad) * turretLen;
  let y = player.y - 9 - Math.sin(angleRad) * turretLen;

  const playerColor = player.color || '#ffffff';
  for (let i = 0; i < 40; i++) {
    vx += state.wind * 0.01;
    vy += GRAVITY;
    x += vx;
    y += vy;

    if (x < 0 || x >= CANVAS_W || y > CANVAS_H) break;
    if (y >= getTerrainHeight(state.terrain, x)) break;

    if (i % 2 === 0) {
      const alpha = 0.5 - (i / 40) * 0.4;
      ctx.fillStyle = colorWithAlpha(playerColor, alpha);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}


export function renderMenu() {
  if (!ctx) return;

  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  animFrame++;
  if (!state.lowPerfMode) {
    drawGrid();
    drawScanline();
    drawStarfield();
  }

  // Title
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#00ffff';
  if (!state.lowPerfMode) {
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 25;
  }
  ctx.fillText('VECTRON SCORCHED', CANVAS_W / 2, 120);
  ctx.shadowBlur = 0;

  ctx.font = '16px monospace';
  if (!state.lowPerfMode) {
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 10;
  }
  ctx.fillStyle = '#ff00ff';
  ctx.fillText('The Mother of All Games', CANVAS_W / 2, 155);
  ctx.shadowBlur = 0;

  // Instructions
  ctx.font = '14px monospace';
  ctx.fillStyle = '#888';
  ctx.fillText('Configure options below and press START', CANVAS_W / 2, 200);
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
    ctx.shadowBlur = 20;
  }
  ctx.fillText('GAME OVER', CANVAS_W / 2, 150);
  ctx.shadowBlur = 0;

  // Scores
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  ctx.font = '18px monospace';
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (!state.lowPerfMode) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
    }
    ctx.fillStyle = p.color;
    ctx.fillText(
      `${i + 1}. ${p.name} - Score: ${p.score} - $${p.money.toLocaleString()}`,
      CANVAS_W / 2,
      220 + i * 35
    );
    ctx.shadowBlur = 0;
  }

  ctx.font = '14px monospace';
  ctx.fillStyle = '#888';
  ctx.fillText('Press SPACE or click to play again', CANVAS_W / 2, 400);
}


// === UTILITY ===
function colorWithAlpha(color, alpha) {
  // Convert hex color to rgba
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  // If already rgba or named, try to apply alpha
  if (color.startsWith('rgba')) {
    return color.replace(/,\s*[\d.]+\)/, `, ${alpha})`);
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  return color;
}
