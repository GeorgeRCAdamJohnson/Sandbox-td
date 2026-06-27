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
let money = 80;
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
        cost: 40,
        color: '#00ff88',
        colorDim: 'rgba(0,255,136,0.3)',
        range: 3.5,
        damage: 10,
        fireRate: 12,
        projSpeed: 14,
        projType: 'laser',
        desc: 'Fast laser shots',
    },
    red: {
        name: 'Rocket',
        cost: 70,
        color: '#ff3355',
        colorDim: 'rgba(255,51,85,0.3)',
        range: 4,
        damage: 30,
        fireRate: 50,
        projSpeed: 7,
        projType: 'rocket',
        splash: 1.5,
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
        cost: 250,
        color: '#ff8844',
        range: 6,
        damage: 100,
        fireRate: 80,
        projSpeed: 5,
        projType: 'rocket',
        splash: 3,
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

    // Generate random winding path using waypoints
    let waypoints = [];
    let startSide = Math.random() < 0.5 ? 'left' : 'top';
    let endSide = Math.random() < 0.5 ? 'right' : 'bottom';

    // Start point
    if (startSide === 'left') {
        waypoints.push({ x: 0, y: Math.floor(Math.random() * (GRID_ROWS - 4)) + 2 });
    } else {
        waypoints.push({ x: Math.floor(Math.random() * (GRID_COLS - 4)) + 2, y: 0 });
    }

    // Generate 4-7 intermediate waypoints
    let numWaypoints = 4 + Math.floor(Math.random() * 4);
    let lastWP = waypoints[0];

    for (let i = 0; i < numWaypoints; i++) {
        let newX, newY;
        let attempts = 0;
        do {
            newX = Math.floor(Math.random() * (GRID_COLS - 4)) + 2;
            newY = Math.floor(Math.random() * (GRID_ROWS - 4)) + 2;
            attempts++;
        } while (attempts < 50 && (Math.abs(newX - lastWP.x) < 3 && Math.abs(newY - lastWP.y) < 3));

        waypoints.push({ x: newX, y: newY });
        lastWP = waypoints[waypoints.length - 1];
    }

    // End point
    if (endSide === 'right') {
        waypoints.push({ x: GRID_COLS - 1, y: Math.floor(Math.random() * (GRID_ROWS - 4)) + 2 });
    } else {
        waypoints.push({ x: Math.floor(Math.random() * (GRID_COLS - 4)) + 2, y: GRID_ROWS - 1 });
    }

    // Connect waypoints with L-shaped paths (horizontal then vertical)
    let fullPath = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
        let from = waypoints[i];
        let to = waypoints[i + 1];

        // Decide randomly: go horizontal first or vertical first
        if (Math.random() < 0.5) {
            // Horizontal then vertical
            let x = from.x;
            let step = to.x > from.x ? 1 : -1;
            while (x !== to.x) {
                fullPath.push({ x: x, y: from.y });
                x += step;
            }
            let y = from.y;
            step = to.y > from.y ? 1 : -1;
            while (y !== to.y) {
                fullPath.push({ x: to.x, y: y });
                y += step;
            }
        } else {
            // Vertical then horizontal
            let y = from.y;
            let step = to.y > from.y ? 1 : -1;
            while (y !== to.y) {
                fullPath.push({ x: from.x, y: y });
                y += step;
            }
            let x = from.x;
            step = to.x > from.x ? 1 : -1;
            while (x !== to.x) {
                fullPath.push({ x: x, y: to.y });
                x += step;
            }
        }
    }
    fullPath.push(waypoints[waypoints.length - 1]);

    // Remove duplicates while preserving order
    let seen = new Set();
    let cleanPath = [];
    for (let p of fullPath) {
        let key = p.x + ',' + p.y;
        if (!seen.has(key)) {
            seen.add(key);
            cleanPath.push(p);
        }
    }

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
        path.push({
            x: cleanPath[i].x * CELL_SIZE + CELL_SIZE / 2,
            y: cleanPath[i].y * CELL_SIZE + CELL_SIZE / 2
        });
    }
}


// === WAVE / ENEMY CONFIG ===
function getWaveConfig(level, wave) {
    let difficulty = level * 5 + wave;
    let baseHP = 25 + difficulty * 12 + Math.pow(difficulty, 1.4) * 2;
    let count = 6 + Math.floor(difficulty * 0.6);
    let speed = 1.0 + Math.min(difficulty * 0.025, 1.5);
    let reward = 4 + Math.floor(difficulty * 0.4);

    const colors = ['#00ff88', '#ff3355', '#cc44ff', '#44bbff', '#ffcc00', '#ff8844', '#ffffff'];
    let color = colors[(difficulty - 1) % colors.length];

    let type = 'normal';
    if (wave === wavesPerLevel) type = 'boss';
    else if (wave % 3 === 0) type = 'fast';
    else if (difficulty > 10 && wave % 4 === 0) type = 'armored';

    let config = { hp: baseHP, count, speed, reward, color, type };

    if (type === 'boss') {
        config.hp *= 10;
        config.count = 2 + Math.floor(level / 10);
        config.speed *= 0.5;
        config.reward *= 6;
    } else if (type === 'fast') {
        config.hp *= 0.4;
        config.count = Math.floor(count * 1.8);
        config.speed *= 1.7;
    } else if (type === 'armored') {
        config.hp *= 3;
        config.speed *= 0.7;
        config.reward *= 2.5;
    }

    return config;
}

// === AUDIO ===
let audioCtx = null;
function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(type) {
    if (!audioCtx) return;
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
            ctx.strokeStyle = def.color.replace(')', ',0.25)').replace('rgb', 'rgba');
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(x, y, tower.range * CELL_SIZE, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
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
        ctx.shadowBlur = 6;
        ctx.shadowColor = e.color;
        ctx.strokeStyle = e.color;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1.5;

        if (e.type === 'boss') {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                let a = (i * Math.PI * 2) / 6 + e.angle;
                let px = e.x + Math.cos(a) * size;
                let py = e.y + Math.sin(a) * size;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (e.type === 'fast') {
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                let a = (i * Math.PI * 2) / 3 + e.angle;
                let px = e.x + Math.cos(a) * size;
                let py = e.y + Math.sin(a) * size;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (e.type === 'armored') {
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
    if (!hoveredCell || !selectedTowerType) return;
    let { col, row } = hoveredCell;
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    let def = selectedTowerType.startsWith('super_')
        ? SUPER_DEFS[selectedTowerType.replace('super_', '')]
        : TOWER_DEFS[selectedTowerType];
    if (!def) return;

    let x = col * CELL_SIZE + CELL_SIZE / 2;
    let y = row * CELL_SIZE + CELL_SIZE / 2;
    let canPlace = grid[row][col] === 0;
    let range = def.range * CELL_SIZE;

    // Range circle
    ctx.strokeStyle = canPlace ? 'rgba(0,255,200,0.3)' : 'rgba(255,0,50,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

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
function spawnEnemy() {
    let config = getWaveConfig(currentLevel, currentWave);
    enemies.push({
        x: path[0].x,
        y: path[0].y,
        pathIdx: 0,
        hp: config.hp,
        maxHp: config.hp,
        speed: config.speed,
        reward: Math.floor(config.reward),
        color: config.color,
        type: config.type,
        size: config.type === 'boss' ? 16 : config.type === 'fast' ? 7 : 10,
        slowTimer: 0,
        slowAmt: 1,
        angle: 0,
        reachedEnd: false,
    });
}

function updateEnemy(e) {
    if (e.pathIdx >= path.length - 1) { e.reachedEnd = true; return; }

    let target = path[e.pathIdx + 1];
    let dx = target.x - e.x;
    let dy = target.y - e.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    let speed = e.speed * e.slowAmt;

    if (e.slowTimer > 0) {
        e.slowTimer--;
        if (e.slowTimer <= 0) e.slowAmt = 1;
    }

    // Move strictly along grid - only horizontal or vertical at a time
    if (dist < speed + 0.5) {
        e.x = target.x;
        e.y = target.y;
        e.pathIdx++;
    } else {
        // Move along one axis at a time for strict grid movement
        let absDx = Math.abs(dx);
        let absDy = Math.abs(dy);

        if (absDx > 0.5 && absDy > 0.5) {
            // At a corner - prioritize the larger axis
            if (absDx >= absDy) {
                e.x += Math.sign(dx) * Math.min(speed, absDx);
            } else {
                e.y += Math.sign(dy) * Math.min(speed, absDy);
            }
        } else if (absDx > 0.5) {
            e.x += Math.sign(dx) * Math.min(speed, absDx);
        } else {
            e.y += Math.sign(dy) * Math.min(speed, absDy);
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
    let rangePixels = tower.range * CELL_SIZE;

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
        target.hp -= stats.damage;
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
                    e.hp -= p.damage * (1 - dist / p.splash * 0.5);
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
                e.hp -= p.damage;
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
    upgradePoints += 2 + Math.floor(currentLevel / 5);
    let bonus = Math.floor(money * 0.05);
    money += bonus;

    floatingTexts.push({
        x: CANVAS_W / 2, y: CANVAS_H / 2,
        text: 'LEVEL ' + currentLevel + ' COMPLETE!',
        color: '#00ffc8', life: 80, maxLife: 80, vy: -0.3
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

function sendNextWave() {
    if (waveInProgress || gameState !== 'playing') return;
    if (currentWave >= wavesPerLevel) return;

    let config = getWaveConfig(currentLevel, currentWave + 1);
    enemiesInWave = config.count;
    enemiesSpawned = 0;
    spawnTimer = 0;
    spawnInterval = config.type === 'fast' ? 15 : config.type === 'boss' ? 50 : 25;
    waveInProgress = true;

    document.getElementById('waveBtn').disabled = true;
    document.getElementById('waveBtn').textContent = 'Wave in progress...';
    playSound('wave');
    updateHUD();
}

// === UPGRADE SCREEN ===
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
function setupInput() {
    canvas.addEventListener('mousemove', (e) => {
        let rect = canvas.getBoundingClientRect();
        let mx = e.clientX - rect.left;
        let my = e.clientY - rect.top;
        hoveredCell = { col: Math.floor(mx / CELL_SIZE), row: Math.floor(my / CELL_SIZE) };
    });

    canvas.addEventListener('mouseleave', () => { hoveredCell = null; });

    canvas.addEventListener('click', (e) => {
        let rect = canvas.getBoundingClientRect();
        let mx = e.clientX - rect.left;
        let my = e.clientY - rect.top;
        let col = Math.floor(mx / CELL_SIZE);
        let row = Math.floor(my / CELL_SIZE);

        if (selectedTowerType) {
            placeTower(col, row);
        } else {
            selectExistingTower(col, row);
        }
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        selectedTowerType = null;
        selectedTower = null;
        document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('towerInfoPanel').style.display = 'none';
    });
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
    setupInput();

    startLevel(1);
}

// Prevent context menu globally
document.addEventListener('contextmenu', e => e.preventDefault());
