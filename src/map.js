// ============================================
// VECTRON TD - Map Generation & Path Extension
// ============================================

import { CELL_SIZE, GRID_COLS, GRID_ROWS, CANVAS_W, CANVAS_H, EXTENSION_BASE_COST, EXTENSION_LENGTH, MAX_EXTENSIONS_PER_LEVEL } from './constants.js';
import { state } from './state.js';
import { updateHUD } from './ui.js';
import { playSound } from './audio.js';

// === RANDOM MAP GENERATOR ===
export function generateMap() {
    // Reset grid
    state.grid = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        state.grid[r] = [];
        for (let c = 0; c < GRID_COLS; c++) {
            state.grid[r][c] = 0;
        }
    }
    state.pathCells = [];

    let startY = 1 + Math.floor(Math.random() * (GRID_ROWS - 2));
    let endY = 1 + Math.floor(Math.random() * (GRID_ROWS - 2));

    let numTurns = 3 + Math.floor(Math.random() * 3);
    let cellPath = [];

    let xPositions = [0];
    for (let i = 1; i <= numTurns; i++) {
        let segWidth = Math.floor((GRID_COLS - 2) / (numTurns + 1));
        let x = Math.min(GRID_COLS - 2, 2 + i * segWidth + Math.floor(Math.random() * 3) - 1);
        xPositions.push(Math.max(2, Math.min(GRID_COLS - 2, x)));
    }
    xPositions.push(GRID_COLS - 1);

    let yPositions = [startY];
    for (let i = 1; i < xPositions.length - 1; i++) {
        yPositions.push(1 + Math.floor(Math.random() * (GRID_ROWS - 2)));
    }
    yPositions.push(endY);

    for (let seg = 0; seg < xPositions.length - 1; seg++) {
        let x0 = xPositions[seg], y0 = yPositions[seg];
        let x1 = xPositions[seg + 1], y1 = yPositions[seg + 1];

        if (seg % 2 === 0) {
            let stepX = x1 > x0 ? 1 : -1;
            let x = x0;
            while (x !== x1) {
                cellPath.push({ x: x, y: y0 });
                x += stepX;
            }
            if (y0 !== y1) {
                let stepY = y1 > y0 ? 1 : -1;
                let y = y0;
                while (y !== y1) {
                    cellPath.push({ x: x1, y: y });
                    y += stepY;
                }
            }
        } else {
            let stepY = y1 > y0 ? 1 : -1;
            let y = y0;
            while (y !== y1) {
                cellPath.push({ x: x0, y: y });
                y += stepY;
            }
            let stepX = x1 > x0 ? 1 : -1;
            let x = x0;
            while (x !== x1) {
                cellPath.push({ x: x, y: y1 });
                x += stepX;
            }
        }
    }
    cellPath.push({ x: xPositions[xPositions.length - 1], y: yPositions[yPositions.length - 1] });

    // Remove duplicate consecutive cells
    let cleanPath = [cellPath[0]];
    for (let i = 1; i < cellPath.length; i++) {
        let prev = cleanPath[cleanPath.length - 1];
        if (cellPath[i].x !== prev.x || cellPath[i].y !== prev.y) {
            cleanPath.push(cellPath[i]);
        }
    }

    // Validate adjacency - bridge non-adjacent cells
    let validatedPath = [cleanPath[0]];
    for (let i = 1; i < cleanPath.length; i++) {
        let prev = validatedPath[validatedPath.length - 1];
        let curr = cleanPath[i];
        let dx = curr.x - prev.x;
        let dy = curr.y - prev.y;

        if (Math.abs(dx) + Math.abs(dy) > 1) {
            let x = prev.x;
            let stepX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
            while (x !== curr.x) {
                x += stepX;
                if (x !== curr.x || dy === 0) {
                    validatedPath.push({ x: x, y: prev.y });
                }
            }
            let y = prev.y;
            let stepY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);
            while (y !== curr.y) {
                y += stepY;
                validatedPath.push({ x: curr.x, y: y });
            }
        } else {
            validatedPath.push(curr);
        }
    }

    cleanPath = validatedPath;

    // Mark grid cells as path
    for (let p of cleanPath) {
        if (p.y >= 0 && p.y < GRID_ROWS && p.x >= 0 && p.x < GRID_COLS) {
            state.grid[p.y][p.x] = 1;
            state.pathCells.push(p);
        }
    }

    // Convert to pixel path
    state.path = [];
    for (let i = 0; i < cleanPath.length; i++) {
        if (cleanPath[i].y >= 0 && cleanPath[i].y < GRID_ROWS && cleanPath[i].x >= 0 && cleanPath[i].x < GRID_COLS) {
            state.path.push({
                x: cleanPath[i].x * CELL_SIZE + CELL_SIZE / 2,
                y: cleanPath[i].y * CELL_SIZE + CELL_SIZE / 2
            });
        }
    }

    // === SPLIT PATH (Feature 4) ===
    // On levels 15+, 50% chance to create a fork that rejoins before exit
    state.splitPath = null;
    if (state.currentLevel >= 15 && Math.random() < 0.5 && state.path.length > 10) {
        let forkIdx = Math.floor(state.path.length * 0.3);
        let rejoinIdx = Math.floor(state.path.length * 0.7);
        if (rejoinIdx - forkIdx >= 4) {
            // Create an alternate branch (offset vertically by 1-2 cells)
            let branchA = [];
            let branchB = [];
            for (let i = forkIdx; i <= rejoinIdx; i++) {
                branchA.push(state.path[i]);
            }
            // Generate offset branch
            let offsetDir = Math.random() < 0.5 ? -1 : 1;
            let offsetAmt = CELL_SIZE * (1 + Math.floor(Math.random() * 2));
            for (let i = forkIdx; i <= rejoinIdx; i++) {
                let newY = state.path[i].y + offsetDir * offsetAmt;
                // Clamp to canvas
                newY = Math.max(CELL_SIZE / 2, Math.min(CANVAS_H - CELL_SIZE / 2, newY));
                branchB.push({ x: state.path[i].x, y: newY });
                // Mark grid cells for branch
                let bCol = Math.floor(state.path[i].x / CELL_SIZE);
                let bRow = Math.floor(newY / CELL_SIZE);
                if (bRow >= 0 && bRow < GRID_ROWS && bCol >= 0 && bCol < GRID_COLS) {
                    state.grid[bRow][bCol] = 1;
                }
            }
            state.splitPath = { branchA, branchB, forkIdx, rejoinIdx };
        }
    }
}

// === PATH EXTENSION SYSTEM ===
export function getExtensionCost() {
    return EXTENSION_BASE_COST + state.pathExtensions * 50 + state.currentLevel * 10;
}

export function canExtendPath() {
    return state.currentLevel >= 10 && state.pathExtensions < MAX_EXTENSIONS_PER_LEVEL && !state.waveInProgress && !state.pathExtendMode;
}

export function startPathExtend() {
    if (!canExtendPath()) return;
    let cost = getExtensionCost();
    if (state.money < cost) return;

    state.money -= cost;
    state.pathExtendMode = true;
    state.extensionCellsPlaced = 0;
    state.extensionCellsRemaining = EXTENSION_LENGTH;
    state.selectedTowerType = null;
    state.selectedTower = null;
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('towerInfoPanel').style.display = 'none';

    updateHUD();
    state.floatingTexts.push({
        x: CANVAS_W / 2, y: 30,
        text: 'TAP ' + EXTENSION_LENGTH + ' CELLS ADJACENT TO PATH',
        color: '#ff8844', life: 90, maxLife: 90, vy: 0
    });
}

export function placePathCell(col, row) {
    if (!state.pathExtendMode || state.extensionCellsRemaining <= 0) return false;
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    if (state.grid[row][col] !== 0) return false;

    // Must be adjacent to existing path
    let adjacent = false;
    let adjDirections = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
    for (let d of adjDirections) {
        let nx = col + d.dx, ny = row + d.dy;
        if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS && state.grid[ny][nx] === 1) {
            adjacent = true;
            break;
        }
    }
    if (!adjacent) return false;

    // Place the cell
    state.grid[row][col] = 1;
    state.extensionCellsPlaced++;
    state.extensionCellsRemaining--;

    // Find where to insert in pathCells
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < state.pathCells.length; i++) {
        let dx = state.pathCells[i].x - col;
        let dy = state.pathCells[i].y - row;
        let dist = Math.abs(dx) + Math.abs(dy);
        if (dist === 1 && dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
        }
    }

    state.pathCells.splice(bestIdx + 1, 0, {x: col, y: row});

    // Rebuild pixel path
    state.path = [];
    for (let p of state.pathCells) {
        state.path.push({
            x: p.x * CELL_SIZE + CELL_SIZE / 2,
            y: p.y * CELL_SIZE + CELL_SIZE / 2
        });
    }

    if (state.extensionCellsRemaining <= 0) {
        finishPathExtend();
    }

    updateHUD();
    return true;
}

export function finishPathExtend() {
    state.pathExtendMode = false;
    state.pathExtensions++;
    state.floatingTexts.push({
        x: CANVAS_W / 2, y: CANVAS_H / 2,
        text: 'PATH EXTENDED! +' + state.extensionCellsPlaced + ' cells',
        color: '#ff8844', life: 60, maxLife: 60, vy: -0.5
    });
    playSound('levelup');
    updateHUD();
}

export function cancelPathExtend() {
    if (state.extensionCellsPlaced === 0) {
        state.money += getExtensionCost();
    }
    state.pathExtendMode = false;
    state.extensionCellsRemaining = 0;
    updateHUD();
}
