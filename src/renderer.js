// ============================================
// VECTRON TD - Renderer
// ============================================

import { CELL_SIZE, GRID_COLS, GRID_ROWS, CANVAS_W, CANVAS_H, TOWER_DEFS, SUPER_DEFS, ENEMY_TRAITS } from './constants.js';
import { state } from './state.js';
import { getTowerStats, getTowerSynergies } from './towers.js';

export function render() {
    let ctx = state.ctx;
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    drawTronGrid();
    drawPath();
    drawTowers();
    drawEnemies();
    drawProjectiles();
    drawParticles();
    drawFloatingTexts();
    drawDamageNumbers();
    drawHoverPreview();
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


    // Bright intersection dots
    ctx.fillStyle = `rgba(0, 255, 200, ${0.25 * state.gridPulse})`;
    for (let r = 0; r <= GRID_ROWS; r++) {
        for (let c = 0; c <= GRID_COLS; c++) {
            ctx.beginPath();
            ctx.arc(c * CELL_SIZE, r * CELL_SIZE, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Animated scan lines
    let scanY = (state.animFrame * 0.5) % CANVAS_H;
    ctx.strokeStyle = `rgba(0, 255, 200, 0.04)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(CANVAS_W, scanY);
    ctx.stroke();

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
    for (let p of state.pathCells) {
        let x = p.x * CELL_SIZE;
        let y = p.y * CELL_SIZE;

        ctx.fillStyle = 'rgba(0, 255, 200, 0.06)';
        ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

        ctx.strokeStyle = 'rgba(0, 255, 200, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }

    if (state.path.length > 1) {
        ctx.strokeStyle = 'rgba(0, 255, 200, 0.6)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
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
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#00ffc8';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffc8';
        ctx.fillText('▶ ENTRY', state.path[0].x, state.path[0].y - 12);
        ctx.fillStyle = '#ff3355';
        ctx.shadowColor = '#ff3355';
        ctx.fillText('■ EXIT', state.path[state.path.length - 1].x, state.path[state.path.length - 1].y - 12);
        ctx.shadowBlur = 0;
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

        ctx.shadowBlur = 12;
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

        ctx.shadowBlur = 0;

        if (tower.beamTarget) {
            ctx.strokeStyle = def.color;
            ctx.lineWidth = 2 + Math.random() * 2;
            ctx.shadowBlur = 15;
            ctx.shadowColor = def.color;
            ctx.globalAlpha = tower.beamTimer / 8;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(tower.beamTarget.x, tower.beamTarget.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
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
    }
}


export function drawEnemies() {
    let ctx = state.ctx;
    for (let e of state.enemies) {
        let size = e.size;
        let trait = ENEMY_TRAITS[e.trait] || ENEMY_TRAITS.normal;
        let shape = trait.shape || 'diamond';

        ctx.shadowBlur = 6;
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

        if (shape === 'hexagon' || e.type === 'boss') {
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
        ctx.shadowBlur = 0;

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
        ctx.shadowBlur = 6;
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
        ctx.shadowBlur = 0;
    }
}

export function drawParticles() {
    let ctx = state.ctx;
    for (let p of state.particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

export function drawFloatingTexts() {
    let ctx = state.ctx;
    for (let ft of state.floatingTexts) {
        ctx.globalAlpha = ft.life / ft.maxLife;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 4;
        ctx.shadowColor = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
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


export function drawHoverPreview() {
    let ctx = state.ctx;
    if (!state.hoveredCell) return;
    let { col, row } = state.hoveredCell;
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    // Path extension mode
    if (state.pathExtendMode) {
        let isAdjacentToPath = false;
        let adjDirs = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
        for (let d of adjDirs) {
            let nx = col + d.dx, ny = row + d.dy;
            if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS && state.grid[ny][nx] === 1) {
                isAdjacentToPath = true;
                break;
            }
        }
        let canPlace = state.grid[row][col] === 0 && isAdjacentToPath;

        ctx.fillStyle = canPlace ? 'rgba(255, 136, 68, 0.3)' : 'rgba(255, 0, 50, 0.15)';
        ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = canPlace ? '#ff8844' : '#ff0033';
        ctx.lineWidth = 2;
        ctx.strokeRect(col * CELL_SIZE + 1, row * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);

        ctx.fillStyle = '#ff8844';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(state.extensionCellsRemaining + ' left', col * CELL_SIZE + CELL_SIZE / 2, row * CELL_SIZE - 5);
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
