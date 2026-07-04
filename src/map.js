// ============================================
// VECTRON TD - Map Generation & Path Extension
// ============================================

import { CELL_SIZE, GRID_COLS, GRID_ROWS, CANVAS_W, CANVAS_H, EXTENSION_BASE_COST, EXTENSION_LENGTH, MAX_EXTENSIONS_PER_LEVEL } from './constants.js';
import { state } from './state.js';
import { playSound } from './audio.js';

// Late-import to break circular: map.js <-> ui.js
function updateHUD() {
    import('./ui.js').then(mod => mod.updateHUD());
}

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

    // Simple non-crossing snake path generator
    // Strategy: go right in lanes, connecting them with short verticals
    // This GUARANTEES no crossing because each lane is at a unique Y
    let numLanes = 3 + Math.floor(Math.random() * 2); // 3-4 lanes
    let laneYs = [];

    // Distribute lanes evenly across grid height
    for (let i = 0; i < numLanes; i++) {
        let y = Math.floor((i + 0.5) * (GRID_ROWS / numLanes));
        y = Math.max(1, Math.min(GRID_ROWS - 2, y + Math.floor(Math.random() * 3) - 1));
        laneYs.push(y);
    }

    let cellPath = [];

    for (let lane = 0; lane < numLanes; lane++) {
        let y = laneYs[lane];
        let goingRight = (lane % 2 === 0);

        if (goingRight) {
            // Horizontal lane going right
            let startX = (lane === 0) ? 0 : 1;
            let endX = (lane === numLanes - 1) ? GRID_COLS - 1 : GRID_COLS - 2;
            for (let x = startX; x <= endX; x++) {
                cellPath.push({ x, y });
            }
        } else {
            // Horizontal lane going left
            let startX = (lane === numLanes - 1) ? GRID_COLS - 1 : GRID_COLS - 2;
            let endX = 1;
            for (let x = startX; x >= endX; x--) {
                cellPath.push({ x, y });
            }
        }

        // Connect to next lane with vertical segment
        if (lane < numLanes - 1) {
            let connectX = goingRight ? (GRID_COLS - 2) : 1;
            let nextY = laneYs[lane + 1];
            let stepY = nextY > y ? 1 : -1;
            let cy = y;
            while (cy !== nextY) {
                cy += stepY;
                cellPath.push({ x: connectX, y: cy });
            }
        }
    }

    // Ensure path ends at right edge
    let lastCell = cellPath[cellPath.length - 1];
    if (lastCell.x !== GRID_COLS - 1) {
        let stepX = GRID_COLS - 1 > lastCell.x ? 1 : -1;
        let x = lastCell.x;
        while (x !== GRID_COLS - 1) {
            x += stepX;
            cellPath.push({ x, y: lastCell.y });
        }
    }

    // Mark grid cells as path
    for (let p of cellPath) {
        state.grid[p.y][p.x] = 1;
        state.pathCells.push(p);
    }

    // Convert to pixel path
    state.path = [];
    for (let p of cellPath) {
        state.path.push({
            x: p.x * CELL_SIZE + CELL_SIZE / 2,
            y: p.y * CELL_SIZE + CELL_SIZE / 2
        });
    }

    state.splitPath = null;
}

// === PATH EXTENSION SYSTEM ===
// Simplified: place 2 cells at a time, only off path corners, can't touch existing path
export function getExtensionCost() {
    return EXTENSION_BASE_COST + state.pathExtensions * 50 + state.currentLevel * 10;
}

export function canExtendPath() {
    return state.currentLevel >= 10 && state.pathExtensions < MAX_EXTENSIONS_PER_LEVEL && !state.waveInProgress && !state.pathExtendMode;
}

// Find corners (cells where path changes direction)
function getPathCorners() {
    let corners = [];
    for (let i = 1; i < state.pathCells.length - 1; i++) {
        let prev = state.pathCells[i - 1];
        let curr = state.pathCells[i];
        let next = state.pathCells[i + 1];
        let dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
        let dx2 = next.x - curr.x, dy2 = next.y - curr.y;
        if (dx1 !== dx2 || dy1 !== dy2) {
            corners.push({ x: curr.x, y: curr.y, idx: i });
        }
    }
    return corners;
}

// Check if a cell is valid for extension (empty AND not adjacent to any existing path cell except the source)
function isValidExtensionCell(col, row, sourceCol, sourceRow) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    if (state.grid[row][col] !== 0) return false;

    // Must not be adjacent to any existing path cell other than source
    let adjDirections = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
    for (let d of adjDirections) {
        let nx = col + d.dx, ny = row + d.dy;
        if (nx === sourceCol && ny === sourceRow) continue; // OK to be adjacent to source
        if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS && state.grid[ny][nx] === 1) {
            return false; // Touching other path - not allowed
        }
    }
    return true;
}

export function startPathExtend() {
    if (!canExtendPath()) return;
    let cost = getExtensionCost();
    if (state.money < cost) return;

    // Find valid corner + direction combos
    let corners = getPathCorners();
    let validPlacements = [];

    for (let corner of corners) {
        let adjDirs = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
        for (let d of adjDirs) {
            let c1 = { x: corner.x + d.dx, y: corner.y + d.dy };
            let c2 = { x: corner.x + d.dx * 2, y: corner.y + d.dy * 2 };

            if (isValidExtensionCell(c1.x, c1.y, corner.x, corner.y) &&
                isValidExtensionCell(c2.x, c2.y, c1.x, c1.y)) {
                validPlacements.push({ corner, dir: d, cells: [c1, c2] });
            }
        }
    }

    if (validPlacements.length === 0) {
        // Refund - no valid spots
        state.floatingTexts.push({
            x: CANVAS_W / 2, y: CANVAS_H / 2,
            text: 'NO VALID CORNERS TO EXTEND',
            color: '#ff3355', life: 60, maxLife: 60, vy: -0.5
        });
        return;
    }

    state.money -= cost;
    state.pathExtendMode = true;
    state.extensionCellsPlaced = 0;
    state.extensionCellsRemaining = 2;
    state.validExtensionSpots = validPlacements;
    state.selectedTowerType = null;
    state.selectedTower = null;
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('towerInfoPanel').style.display = 'none';

    updateHUD();
    state.floatingTexts.push({
        x: CANVAS_W / 2, y: 30,
        text: 'TAP A HIGHLIGHTED CORNER DIRECTION',
        color: '#ff8844', life: 120, maxLife: 120, vy: 0
    });
}

export function placePathCell(col, row) {
    if (!state.pathExtendMode) return false;
    if (!state.validExtensionSpots) return false;

    // Find if clicked cell matches any valid placement's first cell
    let match = null;
    for (let spot of state.validExtensionSpots) {
        if (spot.cells[0].x === col && spot.cells[0].y === row) {
            match = spot;
            break;
        }
        // Also allow clicking the second cell
        if (spot.cells[1].x === col && spot.cells[1].y === row) {
            match = spot;
            break;
        }
    }

    if (!match) return false;

    // Place both cells as a detour
    let { corner, cells } = match;

    // Mark grid
    for (let c of cells) {
        state.grid[c.y][c.x] = 1;
    }

    // Insert into path: the 2 new cells go out and back creating a bump
    // Find corner index in pathCells
    let cornerIdx = -1;
    for (let i = 0; i < state.pathCells.length; i++) {
        if (state.pathCells[i].x === corner.x && state.pathCells[i].y === corner.y) {
            cornerIdx = i;
            break;
        }
    }

    if (cornerIdx >= 0) {
        // Insert: go out to cell1, then cell2, then back to cell1, then back to corner
        // This creates a 4-step detour (out 2, back 2)
        state.pathCells.splice(cornerIdx + 1, 0, cells[0], cells[1], cells[0]);
        // Also mark cell0 with path (it gets traversed twice but that's fine)
    }

    // Rebuild pixel path
    state.path = [];
    for (let p of state.pathCells) {
        state.path.push({
            x: p.x * CELL_SIZE + CELL_SIZE / 2,
            y: p.y * CELL_SIZE + CELL_SIZE / 2
        });
    }

    state.extensionCellsPlaced = 2;
    state.extensionCellsRemaining = 0;
    finishPathExtend();
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
