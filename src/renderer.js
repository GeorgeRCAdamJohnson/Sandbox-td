// ============================================
// VECTRON TD - Renderer
// ============================================

import { CELL_SIZE, GRID_COLS, GRID_ROWS, CANVAS_W, CANVAS_H, TOWER_DEFS, SUPER_DEFS, ENEMY_TRAITS } from './constants.js';
import { state } from './state.js';
import { getTowerStats, getTowerSynergies } from './towers.js';

// Helper: only apply shadow blur when not in low-perf mode
function glow(ctx, blur, color) {
    if (!state.lowPerfMode) {
        ctx.shadowBlur = blur;
        if (color) ctx.shadowColor = color;
    }
}
function noGlow(ctx) {
    noGlow(ctx);
}

export function render() {
    let ctx = state.ctx;
    let lowPerf = state.lowPerfMode;

    // Screen shake
    if (state.screenShake > 0) {
        ctx.save();
        let shakeX = (Math.random() - 0.5) * 2 * state.screenShake;
        let shakeY = (Math.random() - 0.5) * 2 * state.screenShake;
        ctx.translate(shakeX, shakeY);
    }

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    drawTronGrid();
    if (!lowPerf) drawWeather();
    drawPath();
    drawTowers();
    drawEnemies();
    drawProjectiles();
    drawParticles();
    drawFloatingTexts();
    if (!lowPerf) drawDamageNumbers();
    drawCombo();
    drawHoverPreview();

    // End screen shake
    if (state.screenShake > 0) {
        ctx.restore();
    }
}

export function drawTronGrid() {
    let ctx = state.ctx;
    state.tronLineOffset = (state.tronLineOffset + 0.15) % CELL_SIZE;
    state.gridPulse = Math.sin(state.animFrame * 0.02) * 0.3 + 0.7;

    ctx.strokeStyle = `rgba(0, 255, 200, ${0.08 * state.gridPulse})`;
    ctx.lineWidth = 0.5;

    for (let r = 0; r <= GRID_ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * CELL_SIZE);
        ctx.lineTo(CANVAS_W, r * CELL_SIZE);
        ctx.stroke();
    }
    for (let c = 0; c <= GRID_COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * CELL_SIZE, 0);
        ctx.lineTo(c * CELL_SIZE, CANVAS_H);
        ctx.stroke();
    }


    // Bright intersection dots (skip in low-perf mode)
    if (!state.lowPerfMode) {
        ctx.fillStyle = `rgba(0, 255, 200, ${0.25 * state.gridPulse})`;
        for (let r = 0; r <= GRID_ROWS; r++) {
            for (let c = 0; c <= GRID_COLS; c++) {
                ctx.beginPath();
                ctx.arc(c * CELL_SIZE, r * CELL_SIZE, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Animated scan lines (skip in low-perf)
    if (!state.lowPerfMode) {
        let scanY = (state.animFrame * 0.5) % CANVAS_H;
        ctx.strokeStyle = `rgba(0, 255, 200, 0.04)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(CANVAS_W, scanY);
        ctx.stroke();
    }

    // Cell highlights for buildable areas near hover
    if (state.hoveredCell && state.selectedTowerType) {
        let { col, row } = state.hoveredCell;
        if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
            let canPlace = state.grid[row][col] === 0;
            ctx.fillStyle = canPlace
                ? 'rgba(0, 255, 200, 0.08)'
                : 'rgba(255, 0, 50, 0.08)';
            ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }
}

export function drawPath() {
    let ctx = state.ctx;

    // Path danger glow: check if any enemy is in last 20% of path
    let dangerZone = false;
    let dangerStart = Math.floor(state.path.length * 0.8);
    for (let e of state.enemies) {
        if (e.pathIdx > dangerStart) {
            dangerZone = true;
            break;
        }
    }

    for (let i = 0; i < state.pathCells.length; i++) {
        let p = state.pathCells[i];
        let x = p.x * CELL_SIZE;
        let y = p.y * CELL_SIZE;

        ctx.fillStyle = 'rgba(0, 255, 200, 0.06)';
        ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

        ctx.strokeStyle = 'rgba(0, 255, 200, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }

    // Draw danger glow on last 20% of path cells
    if (dangerZone) {
        let pulse = Math.sin(state.animFrame * 0.1) * 0.3 + 0.5;
        let startIdx = Math.floor(state.pathCells.length * 0.8);
        for (let i = startIdx; i < state.pathCells.length; i++) {
            let p = state.pathCells[i];
            let x = p.x * CELL_SIZE;
            let y = p.y * CELL_SIZE;
            ctx.fillStyle = `rgba(255, 0, 50, ${0.15 * pulse})`;
            ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        }
    }

    if (state.path.length > 1) {
        ctx.strokeStyle = 'rgba(0, 255, 200, 0.6)';
        ctx.lineWidth = 2;
        glow(ctx, 8);
        ctx.shadowColor = 'rgba(0, 255, 200, 0.5)';
        ctx.setLineDash([8, 16]);
        ctx.lineDashOffset = -state.animFrame * 0.5;
        ctx.beginPath();
        ctx.moveTo(state.path[0].x, state.path[0].y);
        for (let i = 1; i < state.path.length; i++) {
            ctx.lineTo(state.path[i].x, state.path[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        noGlow(ctx);

        ctx.fillStyle = '#00ffc8';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        glow(ctx, 10);
        ctx.shadowColor = '#00ffc8';
        ctx.fillText('▶ ENTRY', state.path[0].x, state.path[0].y - 12);
        ctx.fillStyle = '#ff3355';
        ctx.shadowColor = '#ff3355';
        ctx.fillText('■ EXIT', state.path[state.path.length - 1].x, state.path[state.path.length - 1].y - 12);
        noGlow(ctx);
    }
}


export function drawTowers() {
    let ctx = state.ctx;
    for (let tower of state.towers) {
        let def = tower.isSuper ? SUPER_DEFS[tower.type] : TOWER_DEFS[tower.type];
        let x = tower.x;
        let y = tower.y;
        let size = 14;

        if (tower === state.selectedTower) {
            let actualRange = getTowerStats(tower.type, tower.isSuper, tower).range * CELL_SIZE;
            ctx.strokeStyle = def.color;
            ctx.globalAlpha = 0.8;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(x, y, actualRange, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = def.color;
            ctx.globalAlpha = 0.07;
            ctx.beginPath();
            ctx.arc(x, y, actualRange, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        glow(ctx, 12);
        ctx.shadowColor = def.color;

        ctx.fillStyle = def.colorDim || 'rgba(0,255,200,0.1)';
        ctx.fillRect(tower.col * CELL_SIZE + 2, tower.row * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);

        ctx.strokeStyle = def.color;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 2;

        if (tower.type === 'green') {
            ctx.beginPath();
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size * 0.7, y);
            ctx.lineTo(x, y + size);
            ctx.lineTo(x - size * 0.7, y);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        } else if (tower.type === 'red') {
            ctx.beginPath();
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size, y + size * 0.7);
            ctx.lineTo(x - size, y + size * 0.7);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        } else if (tower.type === 'purple') {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                let a = (i * Math.PI * 2) / 5 - Math.PI / 2;
                let r = i % 2 === 0 ? size : size * 0.5;
                let px = x + Math.cos(a) * r;
                let py = y + Math.sin(a) * r;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        } else if (tower.type === 'blue') {
            ctx.beginPath();
            ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (tower.isSuper) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, size + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = '7px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('S', x, y + 3);
        }

        noGlow(ctx);

        if (tower.beamTarget) {
            ctx.strokeStyle = def.color;
            ctx.lineWidth = 2 + Math.random() * 2;
            glow(ctx, 15);
            ctx.shadowColor = def.color;
            ctx.globalAlpha = tower.beamTimer / 8;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(tower.beamTarget.x, tower.beamTarget.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
            noGlow(ctx);
        }

        // Kill tier indicator (Feature 7)
        let kills = tower.kills || 0;
        if (kills >= 25) {
            let tierColor = kills >= 100 ? '#ffd700' : kills >= 50 ? '#c0c0c0' : '#cd7f32';
            ctx.fillStyle = tierColor;
            ctx.beginPath();
            ctx.arc(x + size - 2, y - size + 2, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Synergy indicator (Feature 3)
        let synergies = getTowerSynergies(tower);
        if (synergies.length > 0) {
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.globalAlpha = 0.8;
            ctx.fillText('⚡', x, y + size + 10);
            ctx.globalAlpha = 1;
        }

        // Tower fire flash
        if (tower.fireFlash > 0) {
            ctx.globalAlpha = tower.fireFlash / 8;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, size + 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
}


export function drawEnemies() {
    let ctx = state.ctx;
    for (let e of state.enemies) {
        let size = e.size;
        let trait = ENEMY_TRAITS[e.trait] || ENEMY_TRAITS.normal;
        let shape = trait.shape || 'diamond';

        glow(ctx, 6);
        ctx.shadowColor = e.color;
        ctx.strokeStyle = e.color;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1.5;

        if (e.trait === 'camo') {
            ctx.globalAlpha = 0.4 + Math.sin(state.animFrame * 0.1) * 0.15;
        }
        if (e.trait === 'regen' && e.hp < e.maxHp) {
            ctx.fillStyle = 'rgba(0,80,0,0.5)';
        }

        // Maze Builder (Architect) special rendering
        if (e.trait === 'mazeBuilder') {
            let pulse = 1 + Math.sin(state.animFrame * 0.08) * 0.15;
            let outerSize = size * pulse * 1.2;
            ctx.strokeStyle = '#ff00ff';
            ctx.fillStyle = 'rgba(255,0,255,0.2)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                let a = (i * Math.PI * 2) / 6 + e.angle;
                let px = e.x + Math.cos(a) * outerSize;
                let py = e.y + Math.sin(a) * outerSize;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // Inner spinning detail
            ctx.strokeStyle = 'rgba(255,0,255,0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                let a = (i * Math.PI * 2) / 6 - e.angle * 2;
                let px = e.x + Math.cos(a) * (outerSize * 0.5);
                let py = e.y + Math.sin(a) * (outerSize * 0.5);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.stroke();
        } else if (shape === 'hexagon' || e.type === 'boss') {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                let a = (i * Math.PI * 2) / 6 + e.angle;
                let px = e.x + Math.cos(a) * size;
                let py = e.y + Math.sin(a) * size;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (shape === 'triangle') {
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                let a = (i * Math.PI * 2) / 3 + e.angle;
                let px = e.x + Math.cos(a) * size;
                let py = e.y + Math.sin(a) * size;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (shape === 'square') {
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.rotate(e.angle);
            ctx.beginPath();
            ctx.rect(-size, -size, size * 2, size * 2);
            ctx.fill(); ctx.stroke();
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.moveTo(e.x, e.y - size);
            ctx.lineTo(e.x + size, e.y);
            ctx.lineTo(e.x, e.y + size);
            ctx.lineTo(e.x - size, e.y);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }

        ctx.globalAlpha = 1;
        noGlow(ctx);

        // HP bar
        if (e.hp < e.maxHp) {
            let bw = size * 2.5, bh = 3;
            let bx = e.x - bw / 2, by = e.y - size - 8;
            let ratio = e.hp / e.maxHp;
            ctx.fillStyle = '#111';
            ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = ratio > 0.5 ? '#00ff88' : ratio > 0.25 ? '#ffcc00' : '#ff3355';
            ctx.fillRect(bx, by, bw * ratio, bh);
        }

        // Slow indicator
        if (e.slowTimer > 0) {
            ctx.strokeStyle = 'rgba(68, 187, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(e.x, e.y, size + 4, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Trait indicator
        if (e.trait !== 'normal' && e.type !== 'boss') {
            ctx.fillStyle = e.color;
            ctx.font = '7px monospace';
            ctx.textAlign = 'center';
            ctx.globalAlpha = 0.7;
            ctx.fillText(trait.name[0], e.x, e.y + size + 9);
            ctx.globalAlpha = 1;
        }
    }
}


export function drawProjectiles() {
    let ctx = state.ctx;
    for (let p of state.projectiles) {
        glow(ctx, 6);
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;

        if (p.type === 'rocket' && p.trail) {
            for (let t of p.trail) {
                ctx.globalAlpha = t.life / 10;
                ctx.beginPath();
                ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        noGlow(ctx);
    }
}

export function drawParticles() {
    let ctx = state.ctx;
    for (let p of state.particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        glow(ctx, 4);
        ctx.shadowColor = p.color;

        if (p.type === 'fragment' && p.rotation !== undefined) {
            // Update rotation
            p.rotation += p.rotSpeed;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            let s = p.size * (p.life / p.maxLife);
            ctx.beginPath();
            ctx.moveTo(0, -s);
            ctx.lineTo(s * 0.8, s * 0.6);
            ctx.lineTo(-s * 0.8, s * 0.6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
    noGlow(ctx);
}

export function drawFloatingTexts() {
    let ctx = state.ctx;
    for (let ft of state.floatingTexts) {
        ctx.globalAlpha = ft.life / ft.maxLife;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        glow(ctx, 4);
        ctx.shadowColor = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
    noGlow(ctx);
}

// === DAMAGE NUMBERS (Feature 6) ===
export function drawDamageNumbers() {
    let ctx = state.ctx;
    for (let dn of state.damageNumbers) {
        ctx.globalAlpha = dn.life / dn.maxLife;
        ctx.fillStyle = dn.color;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(dn.text, dn.x, dn.y);
    }
    ctx.globalAlpha = 1;
}


// === COMBO DISPLAY ===
export function drawCombo() {
    if (state.comboCount <= 5) return;
    let ctx = state.ctx;
    let text = state.comboCount + 'x COMBO';
    ctx.save();
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    let alpha = Math.min(1, state.comboTimer / 30);
    ctx.globalAlpha = alpha;
    glow(ctx, 12);
    ctx.shadowColor = '#ffcc00';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(text, CANVAS_W - 12, 25);
    noGlow(ctx);
    ctx.globalAlpha = 1;
    ctx.restore();
}

// === WEATHER EFFECTS ===
export function drawWeather() {
    if (state.weatherTier <= 0) return;
    let ctx = state.ctx;

    if (state.weatherTier >= 1) {
        // Tier 1: random horizontal glitch lines
        ctx.save();
        for (let i = 0; i < 3; i++) {
            let y = Math.random() * CANVAS_H;
            let w = 30 + Math.random() * 80;
            let x = Math.random() * CANVAS_W;
            ctx.fillStyle = `rgba(0, 255, 200, ${0.03 + Math.random() * 0.04})`;
            ctx.fillRect(x, y, w, 1 + Math.random() * 2);
        }
        ctx.restore();
    }

    if (state.weatherTier >= 2) {
        // Tier 2: red pulsing edges
        let pulse = Math.sin(state.animFrame * 0.05) * 0.5 + 0.5;
        let edgeAlpha = 0.08 * pulse;
        ctx.save();
        let grad = ctx.createLinearGradient(0, 0, 40, 0);
        grad.addColorStop(0, `rgba(255, 0, 50, ${edgeAlpha})`);
        grad.addColorStop(1, 'rgba(255, 0, 50, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 40, CANVAS_H);
        let grad2 = ctx.createLinearGradient(CANVAS_W, 0, CANVAS_W - 40, 0);
        grad2.addColorStop(0, `rgba(255, 0, 50, ${edgeAlpha})`);
        grad2.addColorStop(1, 'rgba(255, 0, 50, 0)');
        ctx.fillStyle = grad2;
        ctx.fillRect(CANVAS_W - 40, 0, 40, CANVAS_H);
        ctx.restore();
    }

    if (state.weatherTier >= 3) {
        // Tier 3: dark vignette overlay
        ctx.save();
        let grd = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.3, CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.7);
        grd.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grd.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.restore();
    }
}

export function drawHoverPreview() {
    let ctx = state.ctx;
    if (!state.hoveredCell) return;
    let { col, row } = state.hoveredCell;
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    // Path extension mode - highlight valid extension spots
    if (state.pathExtendMode) {
        // Draw all valid first-cells as orange highlights
        if (state.validExtensionSpots) {
            for (let spot of state.validExtensionSpots) {
                for (let c of spot.cells) {
                    ctx.fillStyle = 'rgba(255, 136, 68, 0.2)';
                    ctx.fillRect(c.x * CELL_SIZE + 2, c.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                    ctx.strokeStyle = 'rgba(255, 136, 68, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(c.x * CELL_SIZE + 2, c.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                }
            }
        }

        // Highlight hovered cell if it's a valid pick
        let isValid = false;
        if (state.validExtensionSpots) {
            for (let spot of state.validExtensionSpots) {
                if ((spot.cells[0].x === col && spot.cells[0].y === row) ||
                    (spot.cells[1].x === col && spot.cells[1].y === row)) {
                    isValid = true;
                    // Highlight both cells of this spot brightly
                    for (let c of spot.cells) {
                        ctx.fillStyle = 'rgba(255, 136, 68, 0.5)';
                        ctx.fillRect(c.x * CELL_SIZE, c.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                        ctx.strokeStyle = '#ff8844';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(c.x * CELL_SIZE + 1, c.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                    }
                    break;
                }
            }
        }

        if (!isValid && state.grid[row][col] === 0) {
            ctx.fillStyle = 'rgba(255, 0, 50, 0.15)';
            ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }

        ctx.fillStyle = '#ff8844';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('TAP ORANGE CELLS', CANVAS_W / 2, 20);
        return;
    }

    if (!state.selectedTowerType) return;

    let def = state.selectedTowerType.startsWith('super_')
        ? SUPER_DEFS[state.selectedTowerType.replace('super_', '')]
        : TOWER_DEFS[state.selectedTowerType];
    if (!def) return;

    let x = col * CELL_SIZE + CELL_SIZE / 2;
    let y = row * CELL_SIZE + CELL_SIZE / 2;
    let canPlace = state.grid[row][col] === 0;
    let type = state.selectedTowerType.startsWith('super_') ? state.selectedTowerType.replace('super_', '') : state.selectedTowerType;
    let isSuper = state.selectedTowerType.startsWith('super_');
    let range = getTowerStats(type, isSuper).range * CELL_SIZE;

    ctx.strokeStyle = canPlace ? 'rgba(0,255,200,0.7)' : 'rgba(255,0,50,0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = canPlace ? 'rgba(0,255,200,0.06)' : 'rgba(255,0,50,0.06)';
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = canPlace ? def.color : '#ff0033';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = canPlace ? '#00ffc8' : '#ff0033';
    ctx.lineWidth = 2;
    ctx.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
}
