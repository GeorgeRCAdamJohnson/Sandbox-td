// ============================================
// VECTRON TD - A Vector Tower Defense Game
// Spiritual successor to Vector TD
// Tron Grid Theme | 30 Levels | Super Weapons
// ============================================

// === CONSTANTS ===
const CELL_SIZE = 40;
const GRID_COLS = 20;
const GRID_ROWS = 15;
const TOTAL_LEVELS = 30;
const CANVAS_W = GRID_COLS * CELL_SIZE;
const CANVAS_H = GRID_ROWS * CELL_SIZE;

// === GAME STATE ===
let canvas, ctx;
let gameState = 'menu'; // menu, playing, upgradeScreen, gameover, victory
let gameSpeed = 1;
let money = 100;
let lives = 20;
let score = 0;
let currentLevel = 0;
let currentWave = 0;
let wavesPerLevel = 5;
let waveInProgress = false;
let enemiesSpawned = 0;
let enemiesInWave = 0;
let spawnTimer = 0;
let spawnInterval = 30;
let selectedTowerType = null;
let selectedTower = null;
let towers = [];
let enemies = [];
let projectiles = [];
let particles = [];
let floatingTexts = [];
let grid = []; // 0=buildable, 1=path, 2=tower
let path = []; // pixel coords of waypoints
let pathCells = []; // grid cells that are path
let hoveredCell = null;
let animFrame = 0;
let gridPulse = 0;
let tronLineOffset = 0;

// Path extension system
let pathExtendMode = false;
let pathExtensions = 0; // Number of extensions used this level
const MAX_EXTENSIONS_PER_LEVEL = 3;
const EXTENSION_LENGTH = 5; // cells added per extension
const EXTENSION_BASE_COST = 100;

// Upgrade system
let upgradePoints = 0;
let towerUpgrades = {
    green: { damage: 0, range: 0, speed: 0 },
    red: { damage: 0, range: 0, speed: 0 },
    purple: { damage: 0, range: 0, speed: 0 },
    blue: { damage: 0, range: 0, speed: 0 },
};
let superWeaponsUnlocked = {
    green: false, red: false, purple: false, blue: false
};


// === TOWER DEFINITIONS ===
const TOWER_DEFS = {
    green: {
        name: 'Laser',
        cost: 30,
        color: '#00ff88',
        colorDim: 'rgba(0,255,136,0.3)',
        range: 3.5,
        damage: 12,
        fireRate: 10,
        projSpeed: 16,
        projType: 'laser',
        desc: 'Fast laser shots',
    },
    red: {
        name: 'Rocket',
        cost: 65,
        color: '#ff3355',
        colorDim: 'rgba(255,51,85,0.3)',
        range: 4.5,
        damage: 45,
        fireRate: 35,
        projSpeed: 10,
        projType: 'rocket',
        splash: 2.5,
        desc: 'Splash damage rockets',
    },
    purple: {
        name: 'Beam',
        cost: 90,
        color: '#cc44ff',
        colorDim: 'rgba(204,68,255,0.3)',
        range: 5,
        damage: 50,
        fireRate: 70,
        projSpeed: 0,
        projType: 'beam',
        desc: 'Instant high-damage beam',
    },
    blue: {
        name: 'Freeze',
        cost: 55,
        color: '#44bbff',
        colorDim: 'rgba(68,187,255,0.3)',
        range: 3,
        damage: 5,
        fireRate: 25,
        projSpeed: 10,
        projType: 'slow',
        slowAmt: 0.35,
        slowDur: 90,
        desc: 'Slows enemies',
    },
};

// Super weapon definitions (unlocked when all upgrades maxed for a color)
const SUPER_DEFS = {
    green: {
        name: 'Overcharge',
        cost: 200,
        color: '#88ffcc',
        range: 5,
        damage: 60,
        fireRate: 6,
        projSpeed: 20,
        projType: 'laser',
        desc: 'Rapid-fire overcharged laser',
    },
    red: {
        name: 'Nova',
        cost: 220,
        color: '#ff8844',
        range: 6,
        damage: 150,
        fireRate: 55,
        projSpeed: 8,
        projType: 'rocket',
        splash: 4,
        desc: 'Massive area explosion',
    },
    purple: {
        name: 'Disintegrate',
        cost: 300,
        color: '#ff44ff',
        range: 7,
        damage: 200,
        fireRate: 100,
        projSpeed: 0,
        projType: 'beam',
        desc: 'Devastating disintegration beam',
    },
    blue: {
        name: 'Cryo Field',
        cost: 180,
        color: '#88eeff',
        range: 4,
        damage: 15,
        fireRate: 15,
        projSpeed: 12,
        projType: 'slow',
        slowAmt: 0.15,
        slowDur: 150,
        desc: 'Deep freeze field',
    },
};


// === RANDOM MAP GENERATOR ===
function generateMap() {
    // Reset grid
    grid = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        grid[r] = [];
        for (let c = 0; c < GRID_COLS; c++) {
            grid[r][c] = 0;
        }
    }
    pathCells = [];

    // Generate a guaranteed-connected path using a simple snake approach
    // Pick entry and exit edges, then create a winding path between them
    let startY = 1 + Math.floor(Math.random() * (GRID_ROWS - 2));
    let endY = 1 + Math.floor(Math.random() * (GRID_ROWS - 2));

    // Create path as series of horizontal runs connected by vertical segments
    let numTurns = 3 + Math.floor(Math.random() * 3); // 3-5 horizontal runs
    let cellPath = []; // array of {x, y} grid coords, each adjacent to previous

    // Divide the grid width into segments for turns
    let xPositions = [0]; // start at left edge
    for (let i = 1; i <= numTurns; i++) {
        let segWidth = Math.floor((GRID_COLS - 2) / (numTurns + 1));
        let x = Math.min(GRID_COLS - 2, 2 + i * segWidth + Math.floor(Math.random() * 3) - 1);
        xPositions.push(Math.max(2, Math.min(GRID_COLS - 2, x)));
    }
    xPositions.push(GRID_COLS - 1); // end at right edge

    // Generate Y positions for each turn - full grid range for interesting paths
    let yPositions = [startY];
    for (let i = 1; i < xPositions.length - 1; i++) {
        yPositions.push(1 + Math.floor(Math.random() * (GRID_ROWS - 2)));
    }
    yPositions.push(endY);

    // Build the path cell by cell
    for (let seg = 0; seg < xPositions.length - 1; seg++) {
        let x0 = xPositions[seg], y0 = yPositions[seg];
        let x1 = xPositions[seg + 1], y1 = yPositions[seg + 1];

        // Alternate: horizontal first on even, vertical first on odd
        if (seg % 2 === 0) {
            // Horizontal first
            let stepX = x1 > x0 ? 1 : -1;
            let x = x0;
            while (x !== x1) {
                cellPath.push({ x: x, y: y0 });
                x += stepX;
            }
            // Then vertical
            if (y0 !== y1) {
                let stepY = y1 > y0 ? 1 : -1;
                let y = y0;
                while (y !== y1) {
                    cellPath.push({ x: x1, y: y });
                    y += stepY;
                }
            }
        } else {
            // Vertical first
            let stepY = y1 > y0 ? 1 : -1;
            let y = y0;
            while (y !== y1) {
                cellPath.push({ x: x0, y: y });
                y += stepY;
            }
            // Then horizontal
            let stepX = x1 > x0 ? 1 : -1;
            let x = x0;
            while (x !== x1) {
                cellPath.push({ x: x, y: y1 });
                x += stepX;
            }
        }
    }
    // Add final cell
    cellPath.push({ x: xPositions[xPositions.length - 1], y: yPositions[yPositions.length - 1] });

    // Remove any duplicate consecutive cells
    let cleanPath = [cellPath[0]];
    for (let i = 1; i < cellPath.length; i++) {
        let prev = cleanPath[cleanPath.length - 1];
        if (cellPath[i].x !== prev.x || cellPath[i].y !== prev.y) {
            cleanPath.push(cellPath[i]);
        }
    }

    // Validate: ensure every consecutive pair is adjacent (share edge)
    // If not, insert bridging cells
    let validatedPath = [cleanPath[0]];
    for (let i = 1; i < cleanPath.length; i++) {
        let prev = validatedPath[validatedPath.length - 1];
        let curr = cleanPath[i];
        let dx = curr.x - prev.x;
        let dy = curr.y - prev.y;

        // If not adjacent, bridge with L-shaped connector
        if (Math.abs(dx) + Math.abs(dy) > 1) {
            // Move horizontally first, then vertically
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
            grid[p.y][p.x] = 1;
            pathCells.push(p);
        }
    }

    // Convert to pixel path - enemies follow EVERY cell center for strict grid movement
    path = [];
    for (let i = 0; i < cleanPath.length; i++) {
        if (cleanPath[i].y >= 0 && cleanPath[i].y < GRID_ROWS && cleanPath[i].x >= 0 && cleanPath[i].x < GRID_COLS) {
            path.push({
                x: cleanPath[i].x * CELL_SIZE + CELL_SIZE / 2,
                y: cleanPath[i].y * CELL_SIZE + CELL_SIZE / 2
            });
        }
    }
}


// === PATH EXTENSION SYSTEM ===
// Player manually draws path extensions cell-by-cell
let extensionCellsPlaced = 0;
let extensionCellsRemaining = 0;

function getExtensionCost() {
    return EXTENSION_BASE_COST + pathExtensions * 50 + currentLevel * 10;
}

function canExtendPath() {
    return currentLevel >= 10 && pathExtensions < MAX_EXTENSIONS_PER_LEVEL && !waveInProgress && !pathExtendMode;
}

function startPathExtend() {
    if (!canExtendPath()) return;
    let cost = getExtensionCost();
    if (money < cost) return;

    money -= cost;
    pathExtendMode = true;
    extensionCellsPlaced = 0;
    extensionCellsRemaining = EXTENSION_LENGTH;
    selectedTowerType = null;
    selectedTower = null;
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('towerInfoPanel').style.display = 'none';

    updateHUD();
    floatingTexts.push({
        x: CANVAS_W / 2, y: 30,
        text: 'TAP ' + EXTENSION_LENGTH + ' CELLS ADJACENT TO PATH',
        color: '#ff8844', life: 90, maxLife: 90, vy: 0
    });
}

function placePathCell(col, row) {
    if (!pathExtendMode || extensionCellsRemaining <= 0) return false;
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    if (grid[row][col] !== 0) return false; // Must be empty

    // Must be adjacent to existing path
    let adjacent = false;
    let adjDirections = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
    for (let d of adjDirections) {
        let nx = col + d.dx, ny = row + d.dy;
        if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS && grid[ny][nx] === 1) {
            adjacent = true;
            break;
        }
    }
    if (!adjacent) return false;

    // Place the cell
    grid[row][col] = 1;
    extensionCellsPlaced++;
    extensionCellsRemaining--;

    // Find where to insert in pathCells (after nearest existing path cell)
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pathCells.length; i++) {
        let dx = pathCells[i].x - col;
        let dy = pathCells[i].y - row;
        let dist = Math.abs(dx) + Math.abs(dy);
        if (dist === 1 && dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
        }
    }

    // Insert after the nearest path cell
    pathCells.splice(bestIdx + 1, 0, {x: col, y: row});

    // Rebuild pixel path
    path = [];
    for (let p of pathCells) {
        path.push({
            x: p.x * CELL_SIZE + CELL_SIZE / 2,
            y: p.y * CELL_SIZE + CELL_SIZE / 2
        });
    }

    if (extensionCellsRemaining <= 0) {
        finishPathExtend();
    }

    updateHUD();
    return true;
}

function finishPathExtend() {
    pathExtendMode = false;
    pathExtensions++;
    floatingTexts.push({
        x: CANVAS_W / 2, y: CANVAS_H / 2,
        text: 'PATH EXTENDED! +' + extensionCellsPlaced + ' cells',
        color: '#ff8844', life: 60, maxLife: 60, vy: -0.5
    });
    playSound('levelup');
    updateHUD();
}

function cancelPathExtend() {
    // Refund if cancelled with no cells placed
    if (extensionCellsPlaced === 0) {
        money += getExtensionCost();
    }
    pathExtendMode = false;
    extensionCellsRemaining = 0;
    updateHUD();
}

// === ENEMY TRAITS & EFFECTIVENESS SYSTEM ===
// Enemy traits determine which towers are effective/ineffective
// Traits: normal, armored, shielded, fast, camo, regen, swarm, phase
const ENEMY_TRAITS = {
    normal: {
        name: 'Vectoid',
        color: '#00ff88',
        hpMult: 1, speedMult: 1, countMult: 1, rewardMult: 1,
        shape: 'diamond',
        // Effectiveness: green=normal, red=normal, purple=normal, blue=normal
        resist: {},
        weak: {},
    },
    armored: {
        name: 'Plated',
        color: '#aaaaaa',
        hpMult: 2.5, speedMult: 0.7, countMult: 0.7, rewardMult: 2,
        shape: 'square',
        resist: { green: 0.5 },  // Lasers do half damage
        weak: { red: 1.8 },      // Rockets shred armor
    },
    shielded: {
        name: 'Shielded',
        color: '#44bbff',
        hpMult: 1.8, speedMult: 0.9, countMult: 0.8, rewardMult: 1.8,
        shape: 'hexagon',
        resist: { red: 0.4, purple: 0.5 },  // Shields absorb AoE and beams
        weak: { green: 1.6, blue: 1.5 },    // Fast shots and freeze break shields
    },
    fast: {
        name: 'Runner',
        color: '#ffcc00',
        hpMult: 0.4, speedMult: 1.8, countMult: 1.8, rewardMult: 0.8,
        shape: 'triangle',
        resist: { red: 0.5 },    // Too fast for rockets
        weak: { blue: 2.0, green: 1.3 }, // Freeze and rapid-fire shred them
    },
    camo: {
        name: 'Phantom',
        color: '#553388',
        hpMult: 1.2, speedMult: 1.1, countMult: 1.0, rewardMult: 1.5,
        shape: 'diamond',
        resist: { green: 0.3, red: 0.3 }, // Nearly invisible to lasers/rockets
        weak: { purple: 2.0, blue: 1.4 }, // Beams detect them, freeze reveals
    },
    regen: {
        name: 'Regenerator',
        color: '#33ff33',
        hpMult: 1.5, speedMult: 0.9, countMult: 0.8, rewardMult: 1.8,
        shape: 'diamond',
        resist: { blue: 0.4 }, // Regen resists slow damage
        weak: { purple: 1.8, red: 1.5 }, // High burst damage kills before regen
        regenRate: 0.002, // Regens 0.2% maxHP per frame (~12%/sec at 60fps)
    },
    swarm: {
        name: 'Swarm',
        color: '#ff8844',
        hpMult: 0.25, speedMult: 1.2, countMult: 3.5, rewardMult: 0.4,
        shape: 'triangle',
        resist: { purple: 0.4 }, // Single-target beams waste DPS on swarms
        weak: { red: 2.5, green: 1.4 }, // AoE and rapid-fire great vs swarms
    },
    phase: {
        name: 'Phase',
        color: '#ff44ff',
        hpMult: 1.3, speedMult: 1.0, countMult: 0.8, rewardMult: 2.2,
        shape: 'hexagon',
        resist: { green: 0.5, blue: 0.5 }, // Phases through projectiles
        weak: { purple: 1.6, red: 1.3 },   // Beams/explosions hit regardless
        phaseChance: 0.4, // 40% chance to dodge projectile hits
    },
};

// Get damage multiplier for a tower type vs enemy trait
function getDamageMultiplier(towerType, enemyTrait) {
    let traitDef = ENEMY_TRAITS[enemyTrait] || ENEMY_TRAITS.normal;
    let mult = 1.0;
    if (traitDef.resist[towerType]) mult *= traitDef.resist[towerType];
    if (traitDef.weak[towerType]) mult *= traitDef.weak[towerType];
    // Floor: nothing is EVER fully immune - minimum 15% damage always gets through
    return Math.max(0.15, mult);
}

// === WAVE COMPOSITION SYSTEM ===
function getWaveConfig(level, wave) {
    let difficulty = (level - 1) * 3 + wave;

    // Exponential HP scaling - aggressive throughout
    let baseHP;
    if (level <= 3) {
        baseHP = 20 + difficulty * 6 + Math.pow(difficulty, 1.2);
    } else if (level <= 8) {
        baseHP = 40 + difficulty * 10 + Math.pow(difficulty, 1.5);
    } else if (level <= 18) {
        baseHP = 80 + difficulty * 15 + Math.pow(difficulty, 1.75);
    } else {
        baseHP = 150 + difficulty * 25 + Math.pow(difficulty, 2.0);
    }

    // Enemy count ramps up significantly
    let baseCount;
    if (level <= 3) {
        baseCount = 5 + Math.floor(difficulty * 0.3);
    } else if (level <= 10) {
        baseCount = 7 + Math.floor(difficulty * 0.5);
    } else if (level <= 20) {
        baseCount = 10 + Math.floor(difficulty * 0.65);
    } else {
        baseCount = 12 + Math.floor(difficulty * 0.8);
    }

    // Speed increases more aggressively
    let baseSpeed = 1.0 + Math.min(difficulty * 0.03, 2.2);
    if (level > 15) baseSpeed += 0.3;
    if (level > 25) baseSpeed += 0.3;

    // Rewards scale much slower than difficulty (constant pressure)
    let baseReward = 4 + Math.floor(difficulty * 0.2);
    if (level > 10) baseReward = Math.floor(baseReward * 0.75);
    if (level > 20) baseReward = Math.floor(baseReward * 0.7);

    // Determine wave composition (mixed enemies!)
    let groups = [];

    if (wave === wavesPerLevel) {
        // Boss wave scales dramatically
        let bossHPMult = 12 + level * 2;
        let bossCount = 1 + Math.floor(level / 8);
        groups.push({
            trait: getBossTrait(level),
            count: bossCount,
            hpMult: bossHPMult,
            speedMult: 0.35 + level * 0.01,
            rewardMult: 6,
            size: 18 + Math.floor(level / 5),
        });
        // Escorts get nastier
        if (level > 3) {
            let escortTrait = getRandomTrait(level, true);
            groups.push({
                trait: escortTrait,
                count: 4 + Math.floor(level / 3),
                hpMult: 0.8 + level * 0.05,
                speedMult: 1.3,
                rewardMult: 0.4,
                size: 8,
            });
        }
        // Second escort group in very late game
        if (level > 18) {
            groups.push({
                trait: getRandomTrait(level, true),
                count: 5 + Math.floor(level / 4),
                hpMult: 0.6,
                speedMult: 1.6,
                rewardMult: 0.3,
                size: 7,
            });
        }
    } else if (level <= 2) {
        // Early levels: single type per wave
        let trait = wave <= 2 ? 'normal' : (wave <= 4 ? 'fast' : 'normal');
        groups.push({ trait, count: baseCount, hpMult: 1, speedMult: 1, rewardMult: 1, size: 10 });
    } else {
        // Mixed waves! More groups at higher levels
        let numGroups;
        if (level < 5) numGroups = 1 + (Math.random() < 0.3 ? 1 : 0);
        else if (level < 10) numGroups = 2;
        else if (level < 20) numGroups = 2 + Math.floor(Math.random() * 2);
        else numGroups = 3 + Math.floor(Math.random() * 2);

        let remainingCount = baseCount;

        for (let g = 0; g < numGroups; g++) {
            let trait = getRandomTrait(level, false);
            let groupCount = g === numGroups - 1 ? remainingCount : Math.ceil(remainingCount / (numGroups - g) * (0.4 + Math.random() * 0.6));
            groupCount = Math.max(2, groupCount);
            remainingCount = Math.max(2, remainingCount - groupCount);

            // Late game groups get HP/speed boosts
            let groupHPMult = 1.0;
            let groupSpeedMult = 1.0;
            if (level > 12) groupHPMult += (level - 12) * 0.08;
            if (level > 18) groupSpeedMult += (level - 18) * 0.04;

            groups.push({
                trait: trait,
                count: groupCount,
                hpMult: groupHPMult,
                speedMult: groupSpeedMult,
                rewardMult: 1,
                size: 10,
            });
        }
    }

    return { baseHP, baseSpeed, baseReward, groups, difficulty };
}

function getRandomTrait(level, isEscort) {
    // Unlock traits progressively
    let available = ['normal'];
    if (level >= 2) available.push('fast');
    if (level >= 3) available.push('armored');
    if (level >= 4) available.push('swarm');
    if (level >= 6) available.push('shielded');
    if (level >= 8) available.push('camo');
    if (level >= 10) available.push('regen');
    if (level >= 14) available.push('phase');

    // Late game: heavily weight toward dangerous types
    if (level > 15) {
        available = available.filter(t => t !== 'normal');
        // Double-add the hardest types for higher chance
        if (level > 20) {
            available.push('phase', 'regen', 'camo');
        }
    } else if (level > 8 && Math.random() < 0.4) {
        available = available.filter(t => t !== 'normal');
    }

    return available[Math.floor(Math.random() * available.length)];
}

function getBossTrait(level) {
    if (level <= 3) return 'armored';
    if (level <= 6) return 'shielded';
    if (level <= 10) return Math.random() < 0.5 ? 'regen' : 'armored';
    if (level <= 15) return Math.random() < 0.5 ? 'phase' : 'shielded';
    // Late game bosses get the worst traits
    let bossTraits = ['regen', 'phase', 'shielded'];
    return bossTraits[Math.floor(Math.random() * bossTraits.length)];
}


// === AUDIO ===
let audioCtx = null;
let musicPlaying = false;
let musicNodes = {};

function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    startMusic();
}

// === PROCEDURAL SYNTH MUSIC ===
function startMusic() {
    if (!audioCtx || musicPlaying) return;
    musicPlaying = true;

    // Master gain
    let master = audioCtx.createGain();
    master.gain.value = 0.25;
    master.connect(audioCtx.destination);

    // Low-pass filter for warmth
    let filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;
    filter.connect(master);

    // === PAD (deep ambient drone) ===
    let padGain = audioCtx.createGain();
    padGain.gain.value = 0;
    padGain.connect(filter);

    let padNotes = [55, 82.41, 110]; // A1, E2, A2
    let padOscs = padNotes.map(freq => {
        let osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(padGain);
        osc.start();
        return osc;
    });

    // Sub bass layer
    let subGain = audioCtx.createGain();
    subGain.gain.value = 0;
    subGain.connect(master);

    let subOsc = audioCtx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = 36.71; // D1 - deep sub
    subOsc.connect(subGain);
    subOsc.start();

    // Triangle texture (very subtle)
    let texGain = audioCtx.createGain();
    texGain.gain.value = 0;
    texGain.connect(filter);

    let texOsc = audioCtx.createOscillator();
    texOsc.type = 'triangle';
    texOsc.frequency.value = 73.42; // D2
    texOsc.connect(texGain);
    texOsc.start();

    // Store nodes
    musicNodes = { master, filter, padGain, padOscs, subGain, subOsc, texGain, texOsc };

    // Start at zero, will fade in when first wave starts
    setMusicIntensity(0);
}

// Intensity 0.0 to 1.0
function setMusicIntensity(intensity) {
    if (!musicNodes.master) return;
    let t = audioCtx.currentTime;
    let ramp = 3.0; // slow 3 second transitions

    // Pad drone grows slightly
    musicNodes.padGain.gain.setTargetAtTime(0.08 + intensity * 0.07, t, ramp);

    // Sub bass fades in gently
    musicNodes.subGain.gain.setTargetAtTime(0.05 + intensity * 0.06, t, ramp);

    // Triangle texture adds body at higher intensity
    musicNodes.texGain.gain.setTargetAtTime(intensity * 0.04, t, ramp);

    // Filter stays low and warm, opens only slightly
    musicNodes.filter.frequency.setTargetAtTime(300 + intensity * 400, t, ramp);
}

function updateMusicForWave() {
    let waveProgress = currentWave / wavesPerLevel;
    let levelFactor = Math.min(currentLevel / 25, 1);
    let intensity = waveProgress * 0.5 + levelFactor * 0.5;
    if (currentWave === wavesPerLevel) intensity = Math.min(1, intensity + 0.15);
    setMusicIntensity(Math.min(1, intensity));
}

let musicMuted = false;
let sfxMuted = false;

function toggleMusic() {
    musicMuted = !musicMuted;
    if (musicNodes.master) {
        musicNodes.master.gain.setTargetAtTime(musicMuted ? 0 : 0.25, audioCtx.currentTime, 0.5);
    }
    document.getElementById('musicBtn').textContent = musicMuted ? '♫ OFF' : '♫ ON';
    document.getElementById('musicBtn').classList.toggle('active', !musicMuted);
}

function toggleSfx() {
    sfxMuted = !sfxMuted;
    document.getElementById('sfxBtn').textContent = sfxMuted ? 'SFX OFF' : 'SFX ON';
    document.getElementById('sfxBtn').classList.toggle('active', !sfxMuted);
}

function playSound(type) {
    if (!audioCtx || sfxMuted) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const t = audioCtx.currentTime;

        switch (type) {
            case 'laser':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(900, t);
                osc.frequency.exponentialRampToValueAtTime(300, t + 0.08);
                gain.gain.setValueAtTime(0.04, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
                osc.start(t); osc.stop(t + 0.08);
                break;
            case 'rocket':
                osc.type = 'square';
                osc.frequency.setValueAtTime(120, t);
                osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
                gain.gain.setValueAtTime(0.06, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                osc.start(t); osc.stop(t + 0.15);
                break;
            case 'beam':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1400, t);
                osc.frequency.exponentialRampToValueAtTime(700, t + 0.12);
                gain.gain.setValueAtTime(0.05, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
                osc.start(t); osc.stop(t + 0.12);
                break;
            case 'freeze':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(500, t);
                osc.frequency.exponentialRampToValueAtTime(1000, t + 0.08);
                gain.gain.setValueAtTime(0.03, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
                osc.start(t); osc.stop(t + 0.08);
                break;
            case 'explosion':
                const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
                const d = buf.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
                const src = audioCtx.createBufferSource();
                src.buffer = buf;
                const g = audioCtx.createGain();
                g.gain.setValueAtTime(0.08, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                src.connect(g); g.connect(audioCtx.destination);
                src.start(t); src.stop(t + 0.15);
                return;
            case 'levelup':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, t);
                osc.frequency.linearRampToValueAtTime(800, t + 0.2);
                osc.frequency.linearRampToValueAtTime(1200, t + 0.4);
                gain.gain.setValueAtTime(0.06, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
                osc.start(t); osc.stop(t + 0.4);
                break;
            case 'death':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, t);
                osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);
                gain.gain.setValueAtTime(0.05, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
            case 'wave':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(300, t);
                osc.frequency.exponentialRampToValueAtTime(600, t + 0.2);
                gain.gain.setValueAtTime(0.04, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
        }
    } catch (e) {}
}


// === RENDERING ===
function render() {
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    drawTronGrid();
    drawPath();
    drawTowers();
    drawEnemies();
    drawProjectiles();
    drawParticles();
    drawFloatingTexts();
    drawHoverPreview();
}

function drawTronGrid() {
    tronLineOffset = (tronLineOffset + 0.15) % CELL_SIZE;
    gridPulse = Math.sin(animFrame * 0.02) * 0.3 + 0.7;

    // Main grid lines
    ctx.strokeStyle = `rgba(0, 255, 200, ${0.08 * gridPulse})`;
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
    ctx.fillStyle = `rgba(0, 255, 200, ${0.25 * gridPulse})`;
    for (let r = 0; r <= GRID_ROWS; r++) {
        for (let c = 0; c <= GRID_COLS; c++) {
            ctx.beginPath();
            ctx.arc(c * CELL_SIZE, r * CELL_SIZE, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Animated scan lines (horizontal)
    let scanY = (animFrame * 0.5) % CANVAS_H;
    ctx.strokeStyle = `rgba(0, 255, 200, 0.04)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(CANVAS_W, scanY);
    ctx.stroke();

    // Cell highlights for buildable areas near hover
    if (hoveredCell && selectedTowerType) {
        let { col, row } = hoveredCell;
        if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
            let canPlace = grid[row][col] === 0;
            ctx.fillStyle = canPlace
                ? 'rgba(0, 255, 200, 0.08)'
                : 'rgba(255, 0, 50, 0.08)';
            ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }
}

function drawPath() {
    // Draw path cells with glow
    for (let p of pathCells) {
        let x = p.x * CELL_SIZE;
        let y = p.y * CELL_SIZE;

        // Path fill
        ctx.fillStyle = 'rgba(0, 255, 200, 0.06)';
        ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

        // Path border glow
        ctx.strokeStyle = 'rgba(0, 255, 200, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }

    // Animated flow along path
    if (path.length > 1) {
        ctx.strokeStyle = 'rgba(0, 255, 200, 0.6)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(0, 255, 200, 0.5)';
        ctx.setLineDash([8, 16]);
        ctx.lineDashOffset = -animFrame * 0.5;
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Entry/exit markers
        ctx.fillStyle = '#00ffc8';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffc8';
        ctx.fillText('▶ ENTRY', path[0].x, path[0].y - 12);
        ctx.fillStyle = '#ff3355';
        ctx.shadowColor = '#ff3355';
        ctx.fillText('■ EXIT', path[path.length - 1].x, path[path.length - 1].y - 12);
        ctx.shadowBlur = 0;
    }
}


function drawTowers() {
    for (let tower of towers) {
        let def = tower.isSuper ? SUPER_DEFS[tower.type] : TOWER_DEFS[tower.type];
        let x = tower.x;
        let y = tower.y;
        let size = 14;

        // Range ring for selected
        if (tower === selectedTower) {
            let actualRange = getTowerStats(tower.type, tower.isSuper).range * CELL_SIZE;
            ctx.strokeStyle = def.color;
            ctx.globalAlpha = 0.8;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(x, y, actualRange, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            // Range fill
            ctx.fillStyle = def.color;
            ctx.globalAlpha = 0.07;
            ctx.beginPath();
            ctx.arc(x, y, actualRange, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Tower base glow
        ctx.shadowBlur = 12;
        ctx.shadowColor = def.color;

        // Cell highlight
        ctx.fillStyle = def.colorDim || 'rgba(0,255,200,0.1)';
        ctx.fillRect(tower.col * CELL_SIZE + 2, tower.row * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);

        // Draw tower shape
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

        // Super weapon indicator
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

        // Beam visualization
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
    }
}

function drawEnemies() {
    for (let e of enemies) {
        let size = e.size;
        let trait = ENEMY_TRAITS[e.trait] || ENEMY_TRAITS.normal;
        let shape = trait.shape || 'diamond';

        ctx.shadowBlur = 6;
        ctx.shadowColor = e.color;
        ctx.strokeStyle = e.color;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1.5;

        // Camo enemies are semi-transparent
        if (e.trait === 'camo') {
            ctx.globalAlpha = 0.4 + Math.sin(animFrame * 0.1) * 0.15;
        }
        // Regen enemies pulse green
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
            // Diamond (default)
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

        // Trait indicator for special types
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


function drawProjectiles() {
    for (let p of projectiles) {
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

function drawParticles() {
    for (let p of particles) {
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

function drawFloatingTexts() {
    for (let ft of floatingTexts) {
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

function drawHoverPreview() {
    if (!hoveredCell) return;
    let { col, row } = hoveredCell;
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    // Path extension mode: show valid placement cells
    if (pathExtendMode) {
        let isAdjacentToPath = false;
        let adjDirs = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
        for (let d of adjDirs) {
            let nx = col + d.dx, ny = row + d.dy;
            if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS && grid[ny][nx] === 1) {
                isAdjacentToPath = true;
                break;
            }
        }
        let canPlace = grid[row][col] === 0 && isAdjacentToPath;

        ctx.fillStyle = canPlace ? 'rgba(255, 136, 68, 0.3)' : 'rgba(255, 0, 50, 0.15)';
        ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = canPlace ? '#ff8844' : '#ff0033';
        ctx.lineWidth = 2;
        ctx.strokeRect(col * CELL_SIZE + 1, row * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);

        // Show remaining cells count
        ctx.fillStyle = '#ff8844';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(extensionCellsRemaining + ' left', col * CELL_SIZE + CELL_SIZE / 2, row * CELL_SIZE - 5);
        return;
    }

    if (!selectedTowerType) return;

    let def = selectedTowerType.startsWith('super_')
        ? SUPER_DEFS[selectedTowerType.replace('super_', '')]
        : TOWER_DEFS[selectedTowerType];
    if (!def) return;

    let x = col * CELL_SIZE + CELL_SIZE / 2;
    let y = row * CELL_SIZE + CELL_SIZE / 2;
    let canPlace = grid[row][col] === 0;
    let type = selectedTowerType.startsWith('super_') ? selectedTowerType.replace('super_', '') : selectedTowerType;
    let isSuper = selectedTowerType.startsWith('super_');
    let range = getTowerStats(type, isSuper).range * CELL_SIZE;

    // Range circle
    ctx.strokeStyle = canPlace ? 'rgba(0,255,200,0.7)' : 'rgba(255,0,50,0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Range fill
    ctx.fillStyle = canPlace ? 'rgba(0,255,200,0.06)' : 'rgba(255,0,50,0.06)';
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.fill();

    // Ghost tower
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = canPlace ? def.color : '#ff0033';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Cell border
    ctx.strokeStyle = canPlace ? '#00ffc8' : '#ff0033';
    ctx.lineWidth = 2;
    ctx.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
}


// === ENEMY LOGIC ===
let currentWaveGroups = [];
let currentGroupIdx = 0;
let groupSpawned = 0;

function spawnEnemy() {
    if (currentGroupIdx >= currentWaveGroups.length) return;

    let group = currentWaveGroups[currentGroupIdx];
    let traitDef = ENEMY_TRAITS[group.trait] || ENEMY_TRAITS.normal;
    let config = currentWaveConfig;

    let hp = config.baseHP * traitDef.hpMult * group.hpMult;
    let speed = config.baseSpeed * traitDef.speedMult * group.speedMult;
    let reward = Math.floor(config.baseReward * traitDef.rewardMult * group.rewardMult);

    enemies.push({
        x: path[0].x,
        y: path[0].y,
        pathIdx: 0,
        hp: hp,
        maxHp: hp,
        speed: speed,
        reward: reward,
        color: traitDef.color,
        trait: group.trait,
        type: group.trait === 'armored' || (group.hpMult > 5) ? 'boss' : group.trait,
        size: group.size || (traitDef.countMult > 2 ? 7 : 10),
        slowTimer: 0,
        slowAmt: 1,
        angle: 0,
        reachedEnd: false,
        regenRate: traitDef.regenRate || 0,
        phaseChance: traitDef.phaseChance || 0,
        traitName: traitDef.name,
    });

    groupSpawned++;
    if (groupSpawned >= group.count) {
        currentGroupIdx++;
        groupSpawned = 0;
    }
}

function updateEnemy(e) {
    if (e.pathIdx >= path.length - 1) { e.reachedEnd = true; return; }

    let target = path[e.pathIdx + 1];
    let dx = target.x - e.x;
    let dy = target.y - e.y;
    let dist = Math.abs(dx) + Math.abs(dy); // Manhattan distance since path is grid-aligned
    let speed = e.speed * e.slowAmt;

    if (e.slowTimer > 0) {
        e.slowTimer--;
        if (e.slowTimer <= 0) e.slowAmt = 1;
    }

    // Regeneration - only regens while above 40% HP (once hurt badly, regen stops)
    if (e.regenRate > 0 && e.hp > e.maxHp * 0.4 && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regenRate);
    }

    if (dist <= speed) {
        // Snap to target and advance
        e.x = target.x;
        e.y = target.y;
        e.pathIdx++;
    } else {
        // Move along exactly one axis (path cells are always axis-aligned neighbors)
        if (Math.abs(dx) > 0.1) {
            e.x += Math.sign(dx) * speed;
        } else {
            e.y += Math.sign(dy) * speed;
        }
    }
    e.angle += 0.04;
}

// === TOWER LOGIC ===
function getTowerStats(type, isSuper) {
    let base = isSuper ? SUPER_DEFS[type] : TOWER_DEFS[type];
    let upg = towerUpgrades[type];
    return {
        damage: base.damage * (1 + upg.damage * 0.15),
        range: base.range * (1 + upg.range * 0.1),
        fireRate: Math.max(4, base.fireRate * (1 - upg.speed * 0.08)),
        projSpeed: base.projSpeed,
        projType: base.projType,
        splash: base.splash ? base.splash * (1 + upg.range * 0.05) : 0,
        slowAmt: base.slowAmt || 0,
        slowDur: base.slowDur || 0,
    };
}

function updateTower(tower) {
    tower.cooldown--;
    if (tower.cooldown <= 0) {
        let target = findTarget(tower);
        if (target) {
            fireTower(tower, target);
            tower.cooldown = tower.fireRate;
        }
    }
    if (tower.beamTarget) {
        tower.beamTimer--;
        if (tower.beamTimer <= 0) tower.beamTarget = null;
    }
}

function findTarget(tower) {
    let best = null;
    let bestVal = -Infinity;
    let rangePixels = getTowerStats(tower.type, tower.isSuper).range * CELL_SIZE;

    for (let e of enemies) {
        let dx = e.x - tower.x;
        let dy = e.y - tower.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > rangePixels) continue;

        let val = 0;
        switch (tower.targetMode) {
            case 'close': val = 1000 - dist; break;
            case 'strong': val = e.hp; break;
            case 'weak': val = e.maxHp - e.hp; break;
            default: val = e.pathIdx * 10000 - dist; break;
        }
        if (val > bestVal) { bestVal = val; best = e; }
    }
    return best;
}

function fireTower(tower, target) {
    let stats = getTowerStats(tower.type, tower.isSuper);
    let def = tower.isSuper ? SUPER_DEFS[tower.type] : TOWER_DEFS[tower.type];

    if (stats.projType === 'beam') {
        // Beam applies damage multiplier directly
        let mult = getDamageMultiplier(tower.type, target.trait || 'normal');
        // Phase dodge for beams too
        if (target.phaseChance > 0 && Math.random() < target.phaseChance * 0.5) {
            floatingTexts.push({ x: target.x, y: target.y - 10, text: 'PHASE', color: '#ff44ff', life: 20, maxLife: 20, vy: -0.5 });
        } else {
            target.hp -= stats.damage * mult;
        }
        tower.beamTarget = { x: target.x, y: target.y };
        tower.beamTimer = 8;
        spawnParticles(target.x, target.y, def.color, 5);
        playSound('beam');
    } else {
        let dx = target.x - tower.x;
        let dy = target.y - tower.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        let proj = {
            x: tower.x, y: tower.y,
            vx: (dx / dist) * stats.projSpeed,
            vy: (dy / dist) * stats.projSpeed,
            damage: stats.damage,
            color: def.color,
            type: stats.projType,
            towerType: tower.type,
            life: 80,
            dead: false,
            size: stats.projType === 'rocket' ? 5 : 3,
        };
        if (stats.projType === 'rocket') {
            proj.splash = stats.splash * CELL_SIZE;
            proj.targetX = target.x;
            proj.targetY = target.y;
            proj.trail = [];
            playSound('rocket');
        } else if (stats.projType === 'slow') {
            proj.slowAmt = stats.slowAmt;
            proj.slowDur = stats.slowDur;
            playSound('freeze');
        } else {
            playSound('laser');
        }
        projectiles.push(proj);
    }
}


// === PROJECTILE LOGIC ===
function updateProjectile(p) {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) { p.dead = true; return; }

    if (p.type === 'rocket') {
        p.trail.push({ x: p.x, y: p.y, life: 10 });
        for (let i = p.trail.length - 1; i >= 0; i--) {
            p.trail[i].life--;
            if (p.trail[i].life <= 0) p.trail.splice(i, 1);
        }
        let dx = p.targetX - p.x;
        let dy = p.targetY - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < 12) {
            for (let e of enemies) {
                let ex = e.x - p.x, ey = e.y - p.y;
                let dist = Math.sqrt(ex * ex + ey * ey);
                if (dist < p.splash) {
                    let mult = getDamageMultiplier(p.towerType || 'red', e.trait || 'normal');
                    let dmg = p.damage * (1 - dist / p.splash * 0.5) * mult;
                    e.hp -= dmg;
                }
            }
            spawnParticles(p.x, p.y, p.color, 12);
            playSound('explosion');
            p.dead = true;
        }
    } else {
        for (let e of enemies) {
            let dx = e.x - p.x, dy = e.y - p.y;
            if (Math.sqrt(dx * dx + dy * dy) < e.size + p.size) {
                // Phase dodge check
                if (e.phaseChance > 0 && Math.random() < e.phaseChance) {
                    // Dodged! Show visual
                    floatingTexts.push({ x: e.x, y: e.y - 10, text: 'PHASE', color: '#ff44ff', life: 20, maxLife: 20, vy: -0.5 });
                    p.dead = true;
                    break;
                }
                let mult = getDamageMultiplier(p.towerType || 'green', e.trait || 'normal');
                e.hp -= p.damage * mult;
                if (p.type === 'slow') {
                    e.slowAmt = p.slowAmt;
                    e.slowTimer = p.slowDur;
                }
                spawnParticles(p.x, p.y, p.color, 4);
                p.dead = true;
                break;
            }
        }
    }
}

// === PARTICLES ===
function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        let a = Math.random() * Math.PI * 2;
        let spd = 1 + Math.random() * 3;
        let life = 15 + Math.floor(Math.random() * 15);
        particles.push({
            x, y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            color, life, maxLife: life,
            size: 1 + Math.random() * 2.5,
        });
    }
}


// === GAME LOOP ===
let lastTime = 0;
function gameLoop(ts) {
    if (gameState !== 'playing') return;
    lastTime = ts;
    animFrame++;
    for (let i = 0; i < gameSpeed; i++) update();
    render();
    requestAnimationFrame(gameLoop);
}

function update() {
    // Spawn
    if (waveInProgress && enemiesSpawned < enemiesInWave) {
        spawnTimer++;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            spawnEnemy();
            enemiesSpawned++;
        }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        updateEnemy(enemies[i]);
        if (enemies[i].reachedEnd) {
            lives--;
            spawnParticles(enemies[i].x, enemies[i].y, '#ff0033', 8);
            enemies.splice(i, 1);
            updateHUD();
            if (lives <= 0) { gameOver(); return; }
        } else if (enemies[i].hp <= 0) {
            money += enemies[i].reward;
            score += enemies[i].reward * 2;
            spawnParticles(enemies[i].x, enemies[i].y, enemies[i].color, 10);
            floatingTexts.push({
                x: enemies[i].x, y: enemies[i].y,
                text: '+$' + enemies[i].reward,
                color: '#ffcc00', life: 35, maxLife: 35, vy: -0.8
            });
            playSound('death');
            enemies.splice(i, 1);
            updateHUD();
        }
    }

    // Wave complete check
    if (waveInProgress && enemiesSpawned >= enemiesInWave && enemies.length === 0) {
        waveInProgress = false;
        currentWave++;

        if (currentWave >= wavesPerLevel) {
            // Level complete!
            levelComplete();
            return;
        }

        document.getElementById('waveBtn').disabled = false;
        document.getElementById('waveBtn').textContent = `Wave ${currentWave + 1}/${wavesPerLevel}`;
        updateHUD();
    }

    // Update towers
    for (let t of towers) updateTower(t);

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        updateProjectile(projectiles[i]);
        if (projectiles[i].dead) projectiles.splice(i, 1);
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        particles[i].life--;
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // Update floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].y += floatingTexts[i].vy;
        floatingTexts[i].life--;
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }
}


// === LEVEL SYSTEM ===
function levelComplete() {
    playSound('levelup');
    setMusicIntensity(0.1); // Calm down between levels
    upgradePoints += 2 + Math.floor(currentLevel / 5);

    // Level completion bonus: tight economy forces decisions
    let levelBonus;
    if (currentLevel <= 3) {
        levelBonus = 40 + currentLevel * 10;
    } else if (currentLevel <= 10) {
        levelBonus = 50 + currentLevel * 6;
    } else {
        levelBonus = 55 + currentLevel * 3; // Barely keeps up
    }
    let interestBonus = Math.floor(money * 0.03);
    money += levelBonus + interestBonus;

    floatingTexts.push({
        x: CANVAS_W / 2, y: CANVAS_H / 2 - 20,
        text: 'LEVEL ' + currentLevel + ' COMPLETE!',
        color: '#00ffc8', life: 80, maxLife: 80, vy: -0.3
    });
    floatingTexts.push({
        x: CANVAS_W / 2, y: CANVAS_H / 2 + 10,
        text: '+$' + (levelBonus + interestBonus) + ' bonus',
        color: '#ffcc00', life: 80, maxLife: 80, vy: -0.3
    });

    if (currentLevel >= TOTAL_LEVELS) {
        victory();
        return;
    }

    // Show upgrade screen
    setTimeout(() => {
        gameState = 'upgradeScreen';
        showUpgradeScreen();
    }, 1500);
}

function startLevel(lvl) {
    currentLevel = lvl;
    currentWave = 0;
    waveInProgress = false;
    enemiesSpawned = 0;
    enemies = [];
    projectiles = [];
    particles = [];
    floatingTexts = [];
    towers = [];
    pathExtensions = 0;
    pathExtendMode = false;

    generateMap();
    updateHUD();
    updateSuperButtons();
    if (Object.values(superWeaponsUnlocked).some(v => v)) {
        document.getElementById('superPanel').style.display = 'block';
    }

    document.getElementById('waveBtn').disabled = false;
    document.getElementById('waveBtn').textContent = `Wave 1/${wavesPerLevel}`;
    document.getElementById('levelDisplay').textContent = `${currentLevel} / ${TOTAL_LEVELS}`;

    gameState = 'playing';
    requestAnimationFrame(gameLoop);
}

let currentWaveConfig = null;

function sendNextWave() {
    if (waveInProgress || gameState !== 'playing') return;
    if (currentWave >= wavesPerLevel) return;

    // Confirm if no towers placed
    if (towers.length === 0) {
        if (!confirm('No towers placed! Are you sure you want to send the wave?')) {
            return;
        }
    }

    currentWaveConfig = getWaveConfig(currentLevel, currentWave + 1);
    currentWaveGroups = currentWaveConfig.groups;
    currentGroupIdx = 0;
    groupSpawned = 0;

    // Total enemies in this wave
    enemiesInWave = 0;
    for (let g of currentWaveGroups) {
        let traitDef = ENEMY_TRAITS[g.trait] || ENEMY_TRAITS.normal;
        g.count = Math.max(1, Math.floor(g.count * traitDef.countMult));
        enemiesInWave += g.count;
    }

    enemiesSpawned = 0;
    spawnTimer = 0;
    spawnInterval = Math.max(8, 20 - Math.floor(currentLevel / 3)); // Gets faster each level
    waveInProgress = true;

    document.getElementById('waveBtn').disabled = true;
    document.getElementById('waveBtn').textContent = 'Wave in progress...';
    playSound('wave');
    updateMusicForWave();
    updateHUD();
}
function showUpgradeScreen() {
    let screen = document.getElementById('upgradeScreen');
    screen.style.display = 'flex';
    renderUpgradeScreen();
}

function renderUpgradeScreen() {
    let content = document.getElementById('upgradeContent');
    let html = `<div class="upgrade-header">
        <h2>LEVEL ${currentLevel} CLEARED</h2>
        <p>Upgrade Points: <span class="pts">${upgradePoints}</span></p>
    </div><div class="upgrade-grid">`;

    ['green', 'red', 'purple', 'blue'].forEach(type => {
        let def = TOWER_DEFS[type];
        let upg = towerUpgrades[type];
        let maxed = upg.damage >= 5 && upg.range >= 5 && upg.speed >= 5;
        let superUnlocked = superWeaponsUnlocked[type];

        html += `<div class="upgrade-tower-card" style="border-color:${def.color}">
            <h3 style="color:${def.color}">${def.name}</h3>
            <div class="upg-row">
                <span>DMG (${upg.damage}/5)</span>
                <button class="upg-btn" onclick="buyUpgrade('${type}','damage')" ${upg.damage >= 5 || upgradePoints < 1 ? 'disabled' : ''}>+</button>
            </div>
            <div class="upg-row">
                <span>RNG (${upg.range}/5)</span>
                <button class="upg-btn" onclick="buyUpgrade('${type}','range')" ${upg.range >= 5 || upgradePoints < 1 ? 'disabled' : ''}>+</button>
            </div>
            <div class="upg-row">
                <span>SPD (${upg.speed}/5)</span>
                <button class="upg-btn" onclick="buyUpgrade('${type}','speed')" ${upg.speed >= 5 || upgradePoints < 1 ? 'disabled' : ''}>+</button>
            </div>`;

        if (maxed && !superUnlocked) {
            html += `<button class="super-unlock-btn" style="border-color:${def.color};color:${def.color}" onclick="unlockSuper('${type}')">UNLOCK SUPER</button>`;
        } else if (superUnlocked) {
            html += `<div class="super-badge" style="color:${def.color}">★ ${SUPER_DEFS[type].name} UNLOCKED</div>`;
        }

        html += `</div>`;
    });

    html += `</div>
        <button class="continue-btn" onclick="continueToNextLevel()">CONTINUE TO LEVEL ${currentLevel + 1}</button>`;
    content.innerHTML = html;
}

function buyUpgrade(type, stat) {
    if (upgradePoints < 1) return;
    if (towerUpgrades[type][stat] >= 5) return;
    towerUpgrades[type][stat]++;
    upgradePoints--;
    renderUpgradeScreen();
}

function unlockSuper(type) {
    superWeaponsUnlocked[type] = true;
    renderUpgradeScreen();
    updateSuperButtons();
    document.getElementById('superPanel').style.display = 'block';
}

function continueToNextLevel() {
    document.getElementById('upgradeScreen').style.display = 'none';
    startLevel(currentLevel + 1);
}


// === INPUT ===
let isMobile = false;

function setupInput() {
    isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    canvas.addEventListener('mousemove', (e) => {
        let rect = canvas.getBoundingClientRect();
        let scaleX = CANVAS_W / rect.width;
        let scaleY = CANVAS_H / rect.height;
        let mx = (e.clientX - rect.left) * scaleX;
        let my = (e.clientY - rect.top) * scaleY;
        hoveredCell = { col: Math.floor(mx / CELL_SIZE), row: Math.floor(my / CELL_SIZE) };
    });

    canvas.addEventListener('mouseleave', () => { hoveredCell = null; });

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
        hoveredCell = { col: Math.floor(mx / CELL_SIZE), row: Math.floor(my / CELL_SIZE) };
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        let touch = e.touches[0];
        let rect = canvas.getBoundingClientRect();
        let scaleX = CANVAS_W / rect.width;
        let scaleY = CANVAS_H / rect.height;
        let mx = (touch.clientX - rect.left) * scaleX;
        let my = (touch.clientY - rect.top) * scaleY;
        hoveredCell = { col: Math.floor(mx / CELL_SIZE), row: Math.floor(my / CELL_SIZE) };
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (hoveredCell) {
            handleCanvasClick(
                hoveredCell.col * CELL_SIZE + CELL_SIZE / 2,
                hoveredCell.row * CELL_SIZE + CELL_SIZE / 2,
                true
            );
        }
    }, { passive: false });
}

function handleCanvasClick(clientX, clientY, fromTouch) {
    let col, row;
    if (fromTouch && hoveredCell) {
        col = hoveredCell.col;
        row = hoveredCell.row;
    } else {
        let rect = canvas.getBoundingClientRect();
        let scaleX = CANVAS_W / rect.width;
        let scaleY = CANVAS_H / rect.height;
        let mx = (clientX - rect.left) * scaleX;
        let my = (clientY - rect.top) * scaleY;
        col = Math.floor(mx / CELL_SIZE);
        row = Math.floor(my / CELL_SIZE);
    }

    if (pathExtendMode) {
        placePathCell(col, row);
    } else if (selectedTowerType) {
        placeTower(col, row);
    } else {
        selectExistingTower(col, row);
    }
}

function deselectAll() {
    selectedTowerType = null;
    selectedTower = null;
    if (pathExtendMode) cancelPathExtend();
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('towerInfoPanel').style.display = 'none';
}

function placeTower(col, row) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
    if (grid[row][col] !== 0) return;

    let isSuper = selectedTowerType.startsWith('super_');
    let type = isSuper ? selectedTowerType.replace('super_', '') : selectedTowerType;
    let def = isSuper ? SUPER_DEFS[type] : TOWER_DEFS[type];
    if (money < def.cost) return;

    money -= def.cost;
    grid[row][col] = 2;

    let stats = getTowerStats(type, isSuper);
    towers.push({
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
    });

    score += 5;
    updateHUD();
}

function selectExistingTower(col, row) {
    selectedTower = null;
    for (let t of towers) {
        if (t.col === col && t.row === row) {
            selectedTower = t;
            selectedTowerType = null;
            document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
            showTowerInfo(t);
            return;
        }
    }
    document.getElementById('towerInfoPanel').style.display = 'none';
}


// === UI ===
function selectTower(type) {
    let def = type.startsWith('super_') ? SUPER_DEFS[type.replace('super_', '')] : TOWER_DEFS[type];
    if (money < def.cost) return;
    selectedTowerType = type;
    selectedTower = null;
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    let btn = document.getElementById('btn-' + type);
    if (btn) btn.classList.add('selected');
    document.getElementById('towerInfoPanel').style.display = 'none';
}

function showTowerInfo(tower) {
    let def = tower.isSuper ? SUPER_DEFS[tower.type] : TOWER_DEFS[tower.type];
    let panel = document.getElementById('towerInfoPanel');
    let content = document.getElementById('towerInfoContent');
    let sellValue = Math.floor(tower.totalSpent * 0.7);

    let html = `
        <div class="stat-row"><span class="stat-label">Type:</span><span class="stat-value" style="color:${def.color}">${def.name}${tower.isSuper ? ' ★' : ''}</span></div>
        <div class="stat-row"><span class="stat-label">Damage:</span><span class="stat-value">${tower.damage.toFixed(1)}</span></div>
        <div class="stat-row"><span class="stat-label">Range:</span><span class="stat-value">${(tower.range).toFixed(1)} cells</span></div>
        <div class="stat-row"><span class="stat-label">Fire Rate:</span><span class="stat-value">${(60 / tower.fireRate).toFixed(1)}/s</span></div>
        <div class="target-modes">`;

    ['first', 'close', 'strong', 'weak'].forEach(m => {
        html += `<button class="target-mode-btn ${tower.targetMode === m ? 'active' : ''}" onclick="setTargetMode('${m}')">${m[0].toUpperCase()}</button>`;
    });

    html += `</div><button class="sell-btn" onclick="sellTower()">Sell ($${sellValue})</button>`;
    content.innerHTML = html;
    panel.style.display = 'block';
}

function setTargetMode(mode) {
    if (!selectedTower) return;
    selectedTower.targetMode = mode;
    showTowerInfo(selectedTower);
}

function sellTower() {
    if (!selectedTower) return;
    money += Math.floor(selectedTower.totalSpent * 0.7);
    grid[selectedTower.row][selectedTower.col] = 0;
    towers = towers.filter(t => t !== selectedTower);
    selectedTower = null;
    document.getElementById('towerInfoPanel').style.display = 'none';
    updateHUD();
}

function setSpeed(s) {
    gameSpeed = s;
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('speed' + s).classList.add('active');
}

function updateHUD() {
    document.getElementById('moneyDisplay').textContent = '$' + money;
    document.getElementById('livesDisplay').textContent = lives;
    document.getElementById('scoreDisplay').textContent = score;
    document.getElementById('levelDisplay').textContent = currentLevel + ' / ' + TOTAL_LEVELS;
    document.getElementById('waveHUD').textContent = currentWave + '/' + wavesPerLevel;
    document.getElementById('upgPtsDisplay').textContent = upgradePoints;

    // Tower button affordability
    Object.keys(TOWER_DEFS).forEach(type => {
        let btn = document.getElementById('btn-' + type);
        if (btn) btn.style.opacity = money < TOWER_DEFS[type].cost ? '0.4' : '1';
    });
    Object.keys(SUPER_DEFS).forEach(type => {
        let btn = document.getElementById('btn-super_' + type);
        if (btn) btn.style.opacity = money < SUPER_DEFS[type].cost ? '0.4' : '1';
    });

    // Extend path button
    let extBtn = document.getElementById('extendBtn');
    if (extBtn) {
        if (canExtendPath()) {
            let cost = getExtensionCost();
            extBtn.style.display = 'block';
            extBtn.textContent = `Extend Path ($${cost}) [${pathExtensions}/${MAX_EXTENSIONS_PER_LEVEL}]`;
            extBtn.style.opacity = money >= cost ? '1' : '0.4';
        } else if (currentLevel < 10) {
            extBtn.style.display = 'none';
        } else {
            extBtn.style.display = 'block';
            extBtn.textContent = waveInProgress ? 'Extend (between waves)' : `Extend (${pathExtensions}/${MAX_EXTENSIONS_PER_LEVEL} used)`;
            extBtn.style.opacity = '0.3';
        }
    }
}

function updateSuperButtons() {
    let container = document.getElementById('superTowers');
    let html = '';
    ['green', 'red', 'purple', 'blue'].forEach(type => {
        if (superWeaponsUnlocked[type]) {
            let def = SUPER_DEFS[type];
            html += `<div class="tower-btn super ${type}" onclick="selectTower('super_${type}')" id="btn-super_${type}">
                <div class="tower-icon">★</div>
                <div>${def.name}</div>
                <div class="tower-cost">$${def.cost}</div>
            </div>`;
        }
    });
    container.innerHTML = html;
}


// === GAME STATE TRANSITIONS ===
function gameOver() {
    gameState = 'gameover';
    document.getElementById('gameOverScreen').style.display = 'flex';
    document.getElementById('gameOverScore').textContent = `Level ${currentLevel} | Wave ${currentWave} | Score: ${score}`;
}

function victory() {
    gameState = 'victory';
    document.getElementById('victoryScreen').style.display = 'flex';
    document.getElementById('victoryScore').textContent = `All ${TOTAL_LEVELS} levels cleared! | Score: ${score}`;
}

// === KEYBOARD ===
document.addEventListener('keydown', (e) => {
    if (gameState !== 'playing') return;
    switch (e.key) {
        case '1': selectTower('green'); break;
        case '2': selectTower('red'); break;
        case '3': selectTower('purple'); break;
        case '4': selectTower('blue'); break;
        case ' ':
            e.preventDefault();
            if (!waveInProgress) sendNextWave();
            break;
        case 'Escape':
            selectedTowerType = null;
            selectedTower = null;
            document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
            document.getElementById('towerInfoPanel').style.display = 'none';
            break;
        case 's': if (selectedTower) sellTower(); break;
    }
});

// === INIT ===
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    initAudio();

    canvas = document.getElementById('gameCanvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100));

    setupInput();
    startLevel(1);
}

function resizeCanvas() {
    let wrap = document.getElementById('canvasWrap');
    if (!wrap) return;
    let maxW = wrap.clientWidth - 4; // small border margin
    let maxH = wrap.clientHeight - 4;

    let scale = Math.min(maxW / CANVAS_W, maxH / CANVAS_H);
    canvas.style.width = Math.floor(CANVAS_W * scale) + 'px';
    canvas.style.height = Math.floor(CANVAS_H * scale) + 'px';
}

// Prevent context menu globally
document.addEventListener('contextmenu', e => e.preventDefault());
