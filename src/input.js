// ============================================
// VECTRON TD - Input Handling
// ============================================

import { CELL_SIZE, GRID_COLS, GRID_ROWS, CANVAS_W, CANVAS_H, TOWER_DEFS, SUPER_DEFS } from './constants.js';
import { state } from './state.js';
import { placePathCell, cancelPathExtend } from './map.js';
import { getTowerStats } from './towers.js';
import { showTowerInfo, updateHUD } from './ui.js';

export function setupInput() {
    let canvas = state.canvas;
    state.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    canvas.addEventListener('mousemove', (e) => {
        let rect = canvas.getBoundingClientRect();
        let scaleX = CANVAS_W / rect.width;
        let scaleY = CANVAS_H / rect.height;
        let mx = (e.clientX - rect.left) * scaleX;
        let my = (e.clientY - rect.top) * scaleY;
        state.hoveredCell = { col: Math.floor(mx / CELL_SIZE), row: Math.floor(my / CELL_SIZE) };
    });

    canvas.addEventListener('mouseleave', () => { state.hoveredCell = null; });

    canvas.addEventListener('click', (e) => {
        handleCanvasClick(e.clientX, e.clientY);
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        deselectAll();
    });

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        let touch = e.touches[0];
        let rect = canvas.getBoundingClientRect();
        let scaleX = CANVAS_W / rect.width;
        let scaleY = CANVAS_H / rect.height;
        let mx = (touch.clientX - rect.left) * scaleX;
        let my = (touch.clientY - rect.top) * scaleY;
        state.hoveredCell = { col: Math.floor(mx / CELL_SIZE), row: Math.floor(my / CELL_SIZE) };
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        let touch = e.touches[0];
        let rect = canvas.getBoundingClientRect();
        let scaleX = CANVAS_W / rect.width;
        let scaleY = CANVAS_H / rect.height;
        let mx = (touch.clientX - rect.left) * scaleX;
        let my = (touch.clientY - rect.top) * scaleY;
        state.hoveredCell = { col: Math.floor(mx / CELL_SIZE), row: Math.floor(my / CELL_SIZE) };
    }, { passive: false });


    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        // Double-tap to deselect (Feature 8)
        let now = Date.now();
        if (now - state.lastTapTime < 300) {
            deselectAll();
            state.lastTapTime = 0;
            return;
        }
        state.lastTapTime = now;

        if (state.hoveredCell) {
            handleCanvasClick(
                state.hoveredCell.col * CELL_SIZE + CELL_SIZE / 2,
                state.hoveredCell.row * CELL_SIZE + CELL_SIZE / 2,
                true
            );
        }
    }, { passive: false });
}

export function handleCanvasClick(clientX, clientY, fromTouch) {
    let col, row;
    if (fromTouch && state.hoveredCell) {
        col = state.hoveredCell.col;
        row = state.hoveredCell.row;
    } else {
        let rect = state.canvas.getBoundingClientRect();
        let scaleX = CANVAS_W / rect.width;
        let scaleY = CANVAS_H / rect.height;
        let mx = (clientX - rect.left) * scaleX;
        let my = (clientY - rect.top) * scaleY;
        col = Math.floor(mx / CELL_SIZE);
        row = Math.floor(my / CELL_SIZE);
    }

    if (state.pathExtendMode) {
        placePathCell(col, row);
    } else if (state.selectedTowerType) {
        placeTower(col, row);
    } else {
        selectExistingTower(col, row);
    }
}

export function deselectAll() {
    state.selectedTowerType = null;
    state.selectedTower = null;
    if (state.pathExtendMode) cancelPathExtend();
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('towerInfoPanel').style.display = 'none';
}

export function placeTower(col, row) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
    if (state.grid[row][col] !== 0) return;

    let isSuper = state.selectedTowerType.startsWith('super_');
    let type = isSuper ? state.selectedTowerType.replace('super_', '') : state.selectedTowerType;
    let def = isSuper ? SUPER_DEFS[type] : TOWER_DEFS[type];
    if (state.money < def.cost) return;

    state.money -= def.cost;
    state.grid[row][col] = 2;

    let stats = getTowerStats(type, isSuper);
    state.towers.push({
        x: col * CELL_SIZE + CELL_SIZE / 2,
        y: row * CELL_SIZE + CELL_SIZE / 2,
        col, row, type, isSuper,
        damage: stats.damage,
        range: stats.range,
        fireRate: stats.fireRate,
        cooldown: 0,
        targetMode: 'first',
        beamTarget: null,
        beamTimer: 0,
        totalSpent: def.cost,
        kills: 0, // Feature 7: kill counter
    });

    // Mobile vibration on placement (Feature 8)
    if (navigator.vibrate) navigator.vibrate(30);

    state.score += 5;
    updateHUD();
}

export function selectExistingTower(col, row) {
    state.selectedTower = null;
    for (let t of state.towers) {
        if (t.col === col && t.row === row) {
            state.selectedTower = t;
            state.selectedTowerType = null;
            document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
            showTowerInfo(t);
            return;
        }
    }
    document.getElementById('towerInfoPanel').style.display = 'none';
}
