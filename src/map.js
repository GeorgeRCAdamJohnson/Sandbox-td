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

    // Split path removed - was causing ghost pathing issues
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
