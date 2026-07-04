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

    // Generate a non-overlapping winding path left-to-right
    // Strategy: divide grid into vertical columns, snake up and down
    let startY = 1 + Math.floor(Math.random() * (GRID_ROWS - 2));
    let endY = 1 + Math.floor(Math.random() * (GRID_ROWS - 2));

    // Create waypoints that zigzag - ensure no path crossing
    let numSegments = 3 + Math.floor(Math.random() * 3); // 3-5 segments
    let segWidth = Math.floor((GRID_COLS - 2) / numSegments);

    let waypoints = [{ x: 0, y: startY }];

    // Generate waypoints ensuring they create a non-crossing path
    let prevY = startY;
    for (let i = 1; i <= numSegments; i++) {
        let x = Math.min(GRID_COLS - 2, i * segWidth + Math.floor(Math.random() * 2));
        // Alternate between top half and bottom half to create zigzag
        let newY;
        if (i % 2 === 1) {
            // Go to opposite side of prevY
            if (prevY < GRID_ROWS / 2) {
                newY = Math.min(GRID_ROWS - 2, prevY + 3 + Math.floor(Math.random() * 5));
            } else {
                newY = Math.max(1, prevY - 3 - Math.floor(Math.random() * 5));
            }
        } else {
            if (prevY >= GRID_ROWS / 2) {
                newY = Math.max(1, prevY - 3 - Math.floor(Math.random() * 5));
            } else {
                newY = Math.min(GRID_ROWS - 2, prevY + 3 + Math.floor(Math.random() * 5));
            }
        }
        newY = Math.max(1, Math.min(GRID_ROWS - 2, newY));
        waypoints.push({ x, y: newY });
        prevY = newY;
    }
    waypoints.push({ x: GRID_COLS - 1, y: endY });

    // Build path cell-by-cell with NO overlaps
    let usedCells = new Set();
    let cellPath = [];

    function addCell(x, y) {
        let key = x + ',' + y;
        if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return false;
        if (usedCells.has(key)) return false;
        usedCells.add(key);
        cellPath.push({ x, y });
        return true;
    }

    // Add start
    addCell(waypoints[0].x, waypoints[0].y);

    for (let seg = 0; seg < waypoints.length - 1; seg++) {
        let from = waypoints[seg];
        let to = waypoints[seg + 1];

        // Move horizontal first, then vertical
        // If a cell is already used, try to go around it
        let cx = from.x, cy = from.y;

        // Horizontal movement
        let stepX = to.x > cx ? 1 : (to.x < cx ? -1 : 0);
        while (cx !== to.x) {
            let nextX = cx + stepX;
            let key = nextX + ',' + cy;
            if (usedCells.has(key)) {
                // Cell occupied - try to detour vertically
                let detourY = cy + (Math.random() < 0.5 ? 1 : -1);
                detourY = Math.max(0, Math.min(GRID_ROWS - 1, detourY));
                if (!usedCells.has(cx + ',' + detourY)) {
                    addCell(cx, detourY);
                    cy = detourY;
                    if (!usedCells.has(nextX + ',' + cy)) {
                        addCell(nextX, cy);
                        cx = nextX;
                    }
                } else {
                    // Can't detour, skip this cell
                    cx = nextX;
                }
            } else {
                addCell(nextX, cy);
                cx = nextX;
            }
        }

        // Vertical movement
        let stepY = to.y > cy ? 1 : (to.y < cy ? -1 : 0);
        while (cy !== to.y) {
            let nextY = cy + stepY;
            let key = cx + ',' + nextY;
            if (usedCells.has(key)) {
                // Cell occupied - try horizontal detour
                let detourX = cx + (Math.random() < 0.5 ? 1 : -1);
                detourX = Math.max(0, Math.min(GRID_COLS - 1, detourX));
                if (!usedCells.has(detourX + ',' + cy)) {
                    addCell(detourX, cy);
                    cx = detourX;
                    if (!usedCells.has(cx + ',' + nextY)) {
                        addCell(cx, nextY);
                        cy = nextY;
                    }
                } else {
                    cy = nextY;
                }
            } else {
                addCell(cx, nextY);
                cy = nextY;
            }
        }
    }

    // Ensure path has at least 10 cells
    if (cellPath.length < 10) {
        // Fallback: simple L-shaped path
        cellPath = [];
        usedCells.clear();
        for (let x = 0; x < GRID_COLS; x++) {
            addCell(x, startY);
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
