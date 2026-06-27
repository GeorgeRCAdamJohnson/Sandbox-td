// ============================================
// VECTRON TD - A Vector Tower Defense Game
// Spiritual successor to Vector TD
// ============================================

// === CONSTANTS ===
const CELL_SIZE = 32;
const GRID_COLS = 25;
const GRID_ROWS = 20;
const TOTAL_WAVES = 50;

// === GAME STATE ===
let canvas, ctx;
let gameState = 'menu'; // menu, playing, gameover, victory
let gameSpeed = 1;
let money = 250;
let lives = 20;
let score = 0;
let currentWave = 0;
let interestRate = 0.03;
let selectedTowerType = null;
let selectedTower = null;
let waveInProgress = false;
let enemiesSpawned = 0;
let enemiesInWave = 0;
let spawnTimer = 0;
let spawnInterval = 30;
let towers = [];
let enemies = [];
let projectiles = [];
let particles = [];
let floatingTexts = [];
let grid = [];
let path = [];
let hoveredCell = null;
let animFrame = 0;


// === TOWER DEFINITIONS ===
const TOWER_DEFS = {
    green: {
        name: 'Laser Tower',
        cost: 50,
        color: '#00ff64',
        colorRgb: [0, 255, 100],
        range: 120,
        damage: 8,
        fireRate: 15,
        projectileSpeed: 12,
        projectileType: 'laser',
        description: 'Fast-firing laser beam',
        upgradeCostMult: 1.4,
        damagePerLevel: 4,
        rangePerLevel: 5,
    },
    red: {
        name: 'Rocket Tower',
        cost: 75,
        color: '#ff3c3c',
        colorRgb: [255, 60, 60],
        range: 140,
        damage: 25,
        fireRate: 45,
        projectileSpeed: 6,
        projectileType: 'rocket',
        splashRadius: 40,
        description: 'Explosive rockets, splash damage',
        upgradeCostMult: 1.5,
        damagePerLevel: 12,
        rangePerLevel: 8,
    },
    purple: {
        name: 'Beam Tower',
        cost: 100,
        color: '#b43cff',
        colorRgb: [180, 60, 255],
        range: 150,
        damage: 40,
        fireRate: 60,
        projectileSpeed: 0,
        projectileType: 'beam',
        description: 'High damage instant beam',
        upgradeCostMult: 1.6,
        damagePerLevel: 20,
        rangePerLevel: 10,
    },
    blue: {
        name: 'Freeze Tower',
        cost: 60,
        color: '#3c96ff',
        colorRgb: [60, 150, 255],
        range: 100,
        damage: 3,
        fireRate: 20,
        projectileSpeed: 8,
        projectileType: 'slow',
        slowAmount: 0.4,
        slowDuration: 90,
        description: 'Slows and stuns vectoids',
        upgradeCostMult: 1.3,
        damagePerLevel: 2,
        rangePerLevel: 6,
    }
};


// === ENEMY/VECTOID DEFINITIONS ===
const ENEMY_COLORS = ['#00ff64', '#ff3c3c', '#b43cff', '#3c96ff', '#ffcc00', '#ff8800', '#ffffff'];

function getWaveConfig(waveNum) {
    const baseHP = 30 + waveNum * 15 + Math.pow(waveNum, 1.5) * 3;
    const count = 8 + Math.floor(waveNum * 0.8);
    const speed = 1.2 + Math.min(waveNum * 0.03, 1.0);
    const reward = 5 + Math.floor(waveNum * 0.5);
    const colorIdx = (waveNum - 1) % ENEMY_COLORS.length;

    let type = 'normal';
    if (waveNum % 10 === 0) type = 'boss';
    else if (waveNum % 5 === 0) type = 'fast';
    else if (waveNum % 7 === 0) type = 'armored';

    let config = {
        hp: baseHP,
        count: count,
        speed: speed,
        reward: reward,
        color: ENEMY_COLORS[colorIdx],
        type: type,
        hasBonus: waveNum % 5 === 0,
    };

    if (type === 'boss') {
        config.hp *= 8;
        config.count = 3;
        config.speed *= 0.6;
        config.reward *= 5;
    } else if (type === 'fast') {
        config.hp *= 0.5;
        config.count = Math.floor(count * 1.5);
        config.speed *= 1.6;
    } else if (type === 'armored') {
        config.hp *= 2.5;
        config.speed *= 0.8;
        config.reward *= 2;
    }

    return config;
}


// === MAP / PATH DEFINITION ===
function initMap() {
    // Initialize grid: 0 = buildable, 1 = path, 2 = blocked
    grid = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        grid[r] = [];
        for (let c = 0; c < GRID_COLS; c++) {
            grid[r][c] = 0;
        }
    }

    // Define a winding path (waypoints)
    path = [
        {x: 0, y: 3},
        {x: 5, y: 3},
        {x: 5, y: 8},
        {x: 12, y: 8},
        {x: 12, y: 2},
        {x: 19, y: 2},
        {x: 19, y: 10},
        {x: 8, y: 10},
        {x: 8, y: 15},
        {x: 15, y: 15},
        {x: 15, y: 12},
        {x: 22, y: 12},
        {x: 22, y: 17},
        {x: 24, y: 17},
    ];

    // Mark path cells on grid
    for (let i = 0; i < path.length - 1; i++) {
        let x0 = path[i].x, y0 = path[i].y;
        let x1 = path[i + 1].x, y1 = path[i + 1].y;

        if (x0 === x1) {
            let minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
            for (let y = minY; y <= maxY; y++) {
                grid[y][x0] = 1;
            }
        } else {
            let minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
            for (let x = minX; x <= maxX; x++) {
                grid[y0][x] = 1;
            }
        }
    }

    // Convert path waypoints to pixel coordinates (center of cells)
    path = path.map(p => ({
        x: p.x * CELL_SIZE + CELL_SIZE / 2,
        y: p.y * CELL_SIZE + CELL_SIZE / 2
    }));
}


// === AUDIO SYSTEM (Web Audio API) ===
let audioCtx = null;

function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    switch(type) {
        case 'laser':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.start(); osc.stop(audioCtx.currentTime + 0.1);
            break;
        case 'rocket':
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
            osc.start(); osc.stop(audioCtx.currentTime + 0.2);
            break;
        case 'beam':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
            osc.start(); osc.stop(audioCtx.currentTime + 0.15);
            break;
        case 'freeze':
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.start(); osc.stop(audioCtx.currentTime + 0.1);
            break;
        case 'explosion':
            const bufferSize = audioCtx.sampleRate * 0.2;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            }
            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            const noiseGain = audioCtx.createGain();
            noiseGain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
            noise.connect(noiseGain);
            noiseGain.connect(audioCtx.destination);
            noise.start(); noise.stop(audioCtx.currentTime + 0.2);
            return;
        case 'death':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.07, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
            break;
        case 'wave':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
            break;
    }
}


// === INITIALIZATION ===
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    initAudio();
    initMap();
    resizeCanvas();
    gameState = 'playing';
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    const container = document.getElementById('gameContainer');
    canvas.width = container.clientWidth - 240;
    canvas.height = container.clientHeight;
}

window.addEventListener('resize', () => {
    if (gameState === 'playing') resizeCanvas();
});

// === GAME LOOP ===
let lastTime = 0;
function gameLoop(timestamp) {
    if (gameState !== 'playing') return;

    const dt = timestamp - lastTime;
    lastTime = timestamp;
    animFrame++;

    for (let i = 0; i < gameSpeed; i++) {
        update();
    }
    render();
    requestAnimationFrame(gameLoop);
}

// === UPDATE ===
function update() {
    // Spawn enemies
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
            score -= 10;
            spawnParticles(enemies[i].x, enemies[i].y, '#ff0000', 8);
            enemies.splice(i, 1);
            updateHUD();
            if (lives <= 0) {
                gameOver();
                return;
            }
        } else if (enemies[i].hp <= 0) {
            money += enemies[i].reward;
            score += enemies[i].reward * 2;
            spawnParticles(enemies[i].x, enemies[i].y, enemies[i].color, 12);
            floatingTexts.push({
                x: enemies[i].x, y: enemies[i].y,
                text: '+$' + enemies[i].reward,
                color: '#ffcc00', life: 40, vy: -1
            });
            playSound('death');
            enemies.splice(i, 1);
            updateHUD();
        }
    }

    // Check wave complete
    if (waveInProgress && enemiesSpawned >= enemiesInWave && enemies.length === 0) {
        waveInProgress = false;
        // Interest bonus
        let interest = Math.floor(money * interestRate);
        if (interest > 0) {
            money += interest;
            floatingTexts.push({
                x: canvas.width / 2, y: 40,
                text: 'Interest: +$' + interest,
                color: '#00ffaa', life: 60, vy: -0.5
            });
        }
        updateHUD();

        if (currentWave >= TOTAL_WAVES) {
            victory();
            return;
        }

        document.getElementById('waveBtn').disabled = false;
        document.getElementById('waveBtn').textContent = 'Send Wave ' + (currentWave + 1);
    }

    // Update towers (firing)
    for (let tower of towers) {
        updateTower(tower);
    }

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        updateProjectile(projectiles[i]);
        if (projectiles[i].dead) {
            projectiles.splice(i, 1);
        }
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


// === ENEMY LOGIC ===
function spawnEnemy() {
    const config = getWaveConfig(currentWave);
    enemies.push({
        x: path[0].x,
        y: path[0].y,
        pathIdx: 0,
        hp: config.hp,
        maxHp: config.hp,
        speed: config.speed,
        reward: config.reward,
        color: config.color,
        type: config.type,
        size: config.type === 'boss' ? 14 : (config.type === 'fast' ? 7 : 10),
        slowTimer: 0,
        slowAmount: 1,
        reachedEnd: false,
        angle: 0,
    });
}

function updateEnemy(enemy) {
    if (enemy.pathIdx >= path.length - 1) {
        enemy.reachedEnd = true;
        return;
    }

    let target = path[enemy.pathIdx + 1];
    let dx = target.x - enemy.x;
    let dy = target.y - enemy.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    let speed = enemy.speed * enemy.slowAmount;
    if (enemy.slowTimer > 0) {
        enemy.slowTimer--;
        if (enemy.slowTimer <= 0) enemy.slowAmount = 1;
    }

    if (dist < speed) {
        enemy.x = target.x;
        enemy.y = target.y;
        enemy.pathIdx++;
    } else {
        enemy.x += (dx / dist) * speed;
        enemy.y += (dy / dist) * speed;
    }
    enemy.angle += 0.05;
}

// === TOWER LOGIC ===
function updateTower(tower) {
    tower.cooldown--;
    if (tower.cooldown <= 0) {
        let target = findTarget(tower);
        if (target) {
            fireTower(tower, target);
            tower.cooldown = tower.fireRate;
        }
    }
    // Beam visual timer
    if (tower.beamTarget) {
        tower.beamTimer--;
        if (tower.beamTimer <= 0) tower.beamTarget = null;
    }
}

function findTarget(tower) {
    let best = null;
    let bestVal = -1;

    for (let enemy of enemies) {
        let dx = enemy.x - tower.x;
        let dy = enemy.y - tower.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > tower.range) continue;

        let val = 0;
        switch (tower.targetMode) {
            case 'close':
                val = 1000 - dist;
                break;
            case 'strong':
                val = enemy.hp;
                break;
            case 'weak':
                val = enemy.maxHp - enemy.hp;
                break;
            case 'first':
            default:
                val = enemy.pathIdx * 1000 - dist;
                break;
        }

        if (val > bestVal) {
            bestVal = val;
            best = enemy;
        }
    }
    return best;
}

function fireTower(tower, target) {
    const def = TOWER_DEFS[tower.type];

    if (def.projectileType === 'beam') {
        // Instant hit beam
        target.hp -= tower.damage;
        tower.beamTarget = { x: target.x, y: target.y };
        tower.beamTimer = 8;
        spawnParticles(target.x, target.y, def.color, 4);
        playSound('beam');
    } else if (def.projectileType === 'slow') {
        // Slow projectile
        let dx = target.x - tower.x;
        let dy = target.y - tower.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        projectiles.push({
            x: tower.x, y: tower.y,
            vx: (dx / dist) * def.projectileSpeed,
            vy: (dy / dist) * def.projectileSpeed,
            damage: tower.damage,
            color: def.color,
            type: 'slow',
            slowAmount: def.slowAmount - (tower.level * 0.02),
            slowDuration: def.slowDuration + tower.level * 5,
            life: 60,
            dead: false,
            size: 4,
        });
        playSound('freeze');
    } else if (def.projectileType === 'rocket') {
        let dx = target.x - tower.x;
        let dy = target.y - tower.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        projectiles.push({
            x: tower.x, y: tower.y,
            vx: (dx / dist) * def.projectileSpeed,
            vy: (dy / dist) * def.projectileSpeed,
            damage: tower.damage,
            color: def.color,
            type: 'rocket',
            splashRadius: def.splashRadius + tower.level * 3,
            targetX: target.x, targetY: target.y,
            life: 80,
            dead: false,
            size: 5,
            trail: [],
        });
        playSound('rocket');
    } else {
        // Laser
        let dx = target.x - tower.x;
        let dy = target.y - tower.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        projectiles.push({
            x: tower.x, y: tower.y,
            vx: (dx / dist) * def.projectileSpeed,
            vy: (dy / dist) * def.projectileSpeed,
            damage: tower.damage,
            color: def.color,
            type: 'laser',
            life: 40,
            dead: false,
            size: 3,
        });
        playSound('laser');
    }
}


// === PROJECTILE LOGIC ===
function updateProjectile(proj) {
    proj.x += proj.vx;
    proj.y += proj.vy;
    proj.life--;

    if (proj.life <= 0) {
        proj.dead = true;
        return;
    }

    if (proj.type === 'rocket') {
        proj.trail.push({ x: proj.x, y: proj.y, life: 10 });
        for (let i = proj.trail.length - 1; i >= 0; i--) {
            proj.trail[i].life--;
            if (proj.trail[i].life <= 0) proj.trail.splice(i, 1);
        }
        // Check if reached target area
        let dx = proj.targetX - proj.x;
        let dy = proj.targetY - proj.y;
        if (Math.sqrt(dx * dx + dy * dy) < 10) {
            // Splash damage
            for (let enemy of enemies) {
                let ex = enemy.x - proj.x;
                let ey = enemy.y - proj.y;
                let dist = Math.sqrt(ex * ex + ey * ey);
                if (dist < proj.splashRadius) {
                    let dmgMult = 1 - (dist / proj.splashRadius) * 0.5;
                    enemy.hp -= proj.damage * dmgMult;
                }
            }
            spawnParticles(proj.x, proj.y, proj.color, 15);
            playSound('explosion');
            proj.dead = true;
        }
    } else {
        // Hit detection for laser and slow
        for (let enemy of enemies) {
            let dx = enemy.x - proj.x;
            let dy = enemy.y - proj.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < enemy.size + proj.size) {
                enemy.hp -= proj.damage;
                if (proj.type === 'slow') {
                    enemy.slowAmount = proj.slowAmount;
                    enemy.slowTimer = proj.slowDuration;
                }
                spawnParticles(proj.x, proj.y, proj.color, 4);
                proj.dead = true;
                break;
            }
        }
    }
}

// === PARTICLES ===
function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = 1 + Math.random() * 3;
        particles.push({
            x: x, y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: color,
            life: 15 + Math.floor(Math.random() * 15),
            size: 1 + Math.random() * 2,
        });
    }
}


// === RENDERING ===
function render() {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawPath();
    drawTowers();
    drawEnemies();
    drawProjectiles();
    drawParticles();
    drawFloatingTexts();
    drawHoverPreview();
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(0, 255, 170, 0.04)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= GRID_ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * CELL_SIZE);
        ctx.lineTo(GRID_COLS * CELL_SIZE, r * CELL_SIZE);
        ctx.stroke();
    }
    for (let c = 0; c <= GRID_COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * CELL_SIZE, 0);
        ctx.lineTo(c * CELL_SIZE, GRID_ROWS * CELL_SIZE);
        ctx.stroke();
    }
}

function drawPath() {
    // Draw path glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0, 255, 170, 0.3)';
    ctx.strokeStyle = 'rgba(0, 255, 170, 0.4)';
    ctx.lineWidth = CELL_SIZE - 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();

    // Draw path outline
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0, 255, 170, 0.15)';
    ctx.lineWidth = CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();

    // Path border
    ctx.strokeStyle = 'rgba(0, 255, 170, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();

    // Draw entry/exit markers
    ctx.fillStyle = '#00ffaa';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('ENTRY', path[0].x, path[0].y - 20);
    ctx.fillText('EXIT', path[path.length-1].x, path[path.length-1].y - 20);

    // Animated dots along path
    let dotPhase = animFrame * 0.02;
    ctx.fillStyle = 'rgba(0, 255, 170, 0.6)';
    for (let t = 0; t < 1; t += 0.03) {
        let tt = (t + dotPhase) % 1;
        let pos = getPathPosition(tt);
        if (pos) {
            let pulse = Math.sin(tt * 20 + animFrame * 0.05) * 0.5 + 0.5;
            ctx.globalAlpha = 0.2 + pulse * 0.3;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}

function getPathPosition(t) {
    // Get total path length
    let totalLen = 0;
    let segLens = [];
    for (let i = 0; i < path.length - 1; i++) {
        let dx = path[i+1].x - path[i].x;
        let dy = path[i+1].y - path[i].y;
        let len = Math.sqrt(dx*dx + dy*dy);
        segLens.push(len);
        totalLen += len;
    }

    let targetDist = t * totalLen;
    let accumulated = 0;
    for (let i = 0; i < segLens.length; i++) {
        if (accumulated + segLens[i] >= targetDist) {
            let segT = (targetDist - accumulated) / segLens[i];
            return {
                x: path[i].x + (path[i+1].x - path[i].x) * segT,
                y: path[i].y + (path[i+1].y - path[i].y) * segT,
            };
        }
        accumulated += segLens[i];
    }
    return path[path.length - 1];
}


function drawTowers() {
    for (let tower of towers) {
        const def = TOWER_DEFS[tower.type];
        const x = tower.x;
        const y = tower.y;
        const size = 12 + tower.level;

        // Range indicator for selected tower
        if (tower === selectedTower) {
            ctx.strokeStyle = 'rgba(' + def.colorRgb.join(',') + ', 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, tower.range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(' + def.colorRgb.join(',') + ', 0.03)';
            ctx.fill();
        }

        // Tower base glow
        ctx.shadowBlur = 10 + tower.level * 2;
        ctx.shadowColor = def.color;

        // Draw tower shape based on type
        ctx.fillStyle = def.color;
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;

        if (tower.type === 'green') {
            // Diamond
            ctx.beginPath();
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size * 0.7, y);
            ctx.lineTo(x, y + size);
            ctx.lineTo(x - size * 0.7, y);
            ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = 'rgba(' + def.colorRgb.join(',') + ', 0.2)';
            ctx.fill();
        } else if (tower.type === 'red') {
            // Triangle
            ctx.beginPath();
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size, y + size * 0.7);
            ctx.lineTo(x - size, y + size * 0.7);
            ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = 'rgba(' + def.colorRgb.join(',') + ', 0.2)';
            ctx.fill();
        } else if (tower.type === 'purple') {
            // Star
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                let angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                let r = i === 0 ? size : size;
                let px = x + Math.cos(angle) * r;
                let py = y + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = 'rgba(' + def.colorRgb.join(',') + ', 0.2)';
            ctx.fill();
        } else if (tower.type === 'blue') {
            // Circle
            ctx.beginPath();
            ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(' + def.colorRgb.join(',') + ', 0.2)';
            ctx.fill();
            // Inner ring
            ctx.beginPath();
            ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;

        // Level indicator
        if (tower.level > 1) {
            ctx.fillStyle = '#fff';
            ctx.font = '8px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('L' + tower.level, x, y + size + 10);
        }

        // Beam visualization
        if (tower.beamTarget) {
            ctx.strokeStyle = def.color;
            ctx.lineWidth = 2 + tower.level * 0.5;
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
    for (let enemy of enemies) {
        const x = enemy.x;
        const y = enemy.y;
        const size = enemy.size;

        // Glow
        ctx.shadowBlur = 8;
        ctx.shadowColor = enemy.color;

        // Draw vectoid shape based on type
        ctx.strokeStyle = enemy.color;
        ctx.lineWidth = 1.5;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';

        if (enemy.type === 'boss') {
            // Hexagon
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                let angle = (i * Math.PI * 2) / 6 + enemy.angle;
                let px = x + Math.cos(angle) * size;
                let py = y + Math.sin(angle) * size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (enemy.type === 'fast') {
            // Small triangle
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                let angle = (i * Math.PI * 2) / 3 + enemy.angle;
                let px = x + Math.cos(angle) * size;
                let py = y + Math.sin(angle) * size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (enemy.type === 'armored') {
            // Square
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(enemy.angle);
            ctx.beginPath();
            ctx.rect(-size, -size, size * 2, size * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        } else {
            // Normal - diamond
            ctx.beginPath();
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size, y);
            ctx.lineTo(x, y + size);
            ctx.lineTo(x - size, y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        ctx.shadowBlur = 0;

        // HP bar
        if (enemy.hp < enemy.maxHp) {
            let barWidth = size * 2;
            let barHeight = 3;
            let barX = x - barWidth / 2;
            let barY = y - size - 8;
            let hpRatio = enemy.hp / enemy.maxHp;

            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.fillStyle = hpRatio > 0.5 ? '#00ff64' : hpRatio > 0.25 ? '#ffcc00' : '#ff3c3c';
            ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        }

        // Slow indicator
        if (enemy.slowTimer > 0) {
            ctx.strokeStyle = 'rgba(60, 150, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, size + 4, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

function drawProjectiles() {
    for (let proj of projectiles) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = proj.color;
        ctx.fillStyle = proj.color;

        if (proj.type === 'rocket') {
            // Draw trail
            for (let t of proj.trail) {
                ctx.globalAlpha = t.life / 10;
                ctx.beginPath();
                ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            // Rocket body
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }
}

function drawParticles() {
    for (let p of particles) {
        ctx.globalAlpha = p.life / 30;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.life / 30), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

function drawFloatingTexts() {
    for (let ft of floatingTexts) {
        ctx.globalAlpha = ft.life / 40;
        ctx.fillStyle = ft.color;
        ctx.font = '11px Courier New';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 5;
        ctx.shadowColor = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}


function drawHoverPreview() {
    if (!hoveredCell || !selectedTowerType) return;
    const { col, row } = hoveredCell;
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    const def = TOWER_DEFS[selectedTowerType];
    const x = col * CELL_SIZE + CELL_SIZE / 2;
    const y = row * CELL_SIZE + CELL_SIZE / 2;
    const canPlace = grid[row][col] === 0;

    // Range preview
    ctx.strokeStyle = canPlace
        ? 'rgba(' + def.colorRgb.join(',') + ', 0.3)'
        : 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, def.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Tower preview
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = canPlace ? def.color : '#ff0000';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

// === INPUT HANDLING ===
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('contextmenu', (e) => e.preventDefault());
});

function setupInput() {
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        hoveredCell = {
            col: Math.floor(mx / CELL_SIZE),
            row: Math.floor(my / CELL_SIZE)
        };
    });

    canvas.addEventListener('mouseleave', () => {
        hoveredCell = null;
    });

    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const col = Math.floor(mx / CELL_SIZE);
        const row = Math.floor(my / CELL_SIZE);

        if (selectedTowerType) {
            placeTower(col, row);
        } else {
            // Try to select existing tower
            selectExistingTower(mx, my);
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

    const def = TOWER_DEFS[selectedTowerType];
    if (money < def.cost) return;

    money -= def.cost;
    grid[row][col] = 2; // Occupied by tower

    towers.push({
        x: col * CELL_SIZE + CELL_SIZE / 2,
        y: row * CELL_SIZE + CELL_SIZE / 2,
        col: col,
        row: row,
        type: selectedTowerType,
        level: 1,
        damage: def.damage,
        range: def.range,
        fireRate: def.fireRate,
        cooldown: 0,
        targetMode: 'first',
        beamTarget: null,
        beamTimer: 0,
        totalSpent: def.cost,
    });

    updateHUD();
    score += 5;
}

function selectExistingTower(mx, my) {
    selectedTower = null;
    for (let tower of towers) {
        let dx = tower.x - mx;
        let dy = tower.y - my;
        if (Math.sqrt(dx * dx + dy * dy) < CELL_SIZE * 0.7) {
            selectedTower = tower;
            selectedTowerType = null;
            document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
            showTowerInfo(tower);
            return;
        }
    }
    document.getElementById('towerInfoPanel').style.display = 'none';
}


// === UI FUNCTIONS ===
function selectTower(type) {
    if (money < TOWER_DEFS[type].cost) return;
    selectedTowerType = type;
    selectedTower = null;
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('btn-' + type).classList.add('selected');
    document.getElementById('towerInfoPanel').style.display = 'none';
}

function showTowerInfo(tower) {
    const def = TOWER_DEFS[tower.type];
    const panel = document.getElementById('towerInfoPanel');
    const content = document.getElementById('towerInfoContent');
    const upgradeCost = Math.floor(def.cost * Math.pow(def.upgradeCostMult, tower.level));
    const sellValue = Math.floor(tower.totalSpent * 0.7);

    let html = `
        <div class="stat-row"><span class="stat-label">Type:</span><span class="stat-value" style="color:${def.color}">${def.name}</span></div>
        <div class="stat-row"><span class="stat-label">Level:</span><span class="stat-value">${tower.level}/10</span></div>
        <div class="stat-row"><span class="stat-label">Damage:</span><span class="stat-value">${tower.damage.toFixed(1)}</span></div>
        <div class="stat-row"><span class="stat-label">Range:</span><span class="stat-value">${tower.range.toFixed(0)}</span></div>
        <div class="stat-row"><span class="stat-label">Fire Rate:</span><span class="stat-value">${(60 / tower.fireRate).toFixed(1)}/s</span></div>
    `;

    // Target mode buttons
    html += '<div class="target-modes">';
    ['first', 'close', 'strong', 'weak'].forEach(mode => {
        html += `<button class="target-mode-btn ${tower.targetMode === mode ? 'active' : ''}" onclick="setTargetMode('${mode}')">${mode[0].toUpperCase()}</button>`;
    });
    html += '</div>';

    if (tower.level < 10) {
        html += `<button class="upgrade-btn" onclick="upgradeTower()">Upgrade ($${upgradeCost})</button>`;
    }
    html += `<button class="sell-btn" onclick="sellTower()">Sell ($${sellValue})</button>`;

    content.innerHTML = html;
    panel.style.display = 'block';
}

function upgradeTower() {
    if (!selectedTower || selectedTower.level >= 10) return;
    const def = TOWER_DEFS[selectedTower.type];
    const cost = Math.floor(def.cost * Math.pow(def.upgradeCostMult, selectedTower.level));

    if (money < cost) return;

    money -= cost;
    selectedTower.level++;
    selectedTower.damage += def.damagePerLevel;
    selectedTower.range += def.rangePerLevel;
    selectedTower.fireRate = Math.max(5, selectedTower.fireRate - 1);
    selectedTower.totalSpent += cost;

    score += 10;
    updateHUD();
    showTowerInfo(selectedTower);
}

function sellTower() {
    if (!selectedTower) return;
    const sellValue = Math.floor(selectedTower.totalSpent * 0.7);
    money += sellValue;
    grid[selectedTower.row][selectedTower.col] = 0;
    towers = towers.filter(t => t !== selectedTower);
    selectedTower = null;
    document.getElementById('towerInfoPanel').style.display = 'none';
    updateHUD();
}

function setTargetMode(mode) {
    if (!selectedTower) return;
    selectedTower.targetMode = mode;
    showTowerInfo(selectedTower);
}

function sendNextWave() {
    if (waveInProgress) return;
    currentWave++;
    waveInProgress = true;
    enemiesSpawned = 0;
    spawnTimer = 0;

    const config = getWaveConfig(currentWave);
    enemiesInWave = config.count;
    spawnInterval = config.type === 'fast' ? 15 : config.type === 'boss' ? 60 : 30;

    document.getElementById('waveBtn').disabled = true;
    document.getElementById('waveBtn').textContent = 'Wave ' + currentWave + ' in progress...';
    playSound('wave');
    updateHUD();
}

function setSpeed(speed) {
    gameSpeed = speed;
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('speed' + speed).classList.add('active');
}

function updateHUD() {
    document.getElementById('moneyDisplay').textContent = '$' + money;
    document.getElementById('livesDisplay').textContent = lives;
    document.getElementById('waveDisplay').textContent = currentWave + ' / ' + TOTAL_WAVES;
    document.getElementById('interestDisplay').textContent = (interestRate * 100).toFixed(0) + '%';
    document.getElementById('scoreDisplay').textContent = score;

    // Update tower button affordability
    Object.keys(TOWER_DEFS).forEach(type => {
        const btn = document.getElementById('btn-' + type);
        if (money < TOWER_DEFS[type].cost) {
            btn.style.opacity = '0.4';
        } else {
            btn.style.opacity = '1';
        }
    });
}


// === GAME STATE TRANSITIONS ===
function gameOver() {
    gameState = 'gameover';
    document.getElementById('gameOverScreen').style.display = 'flex';
    document.getElementById('gameOverScore').textContent = 'Waves Survived: ' + currentWave + ' | Score: ' + score;
}

function victory() {
    gameState = 'victory';
    document.getElementById('victoryScreen').style.display = 'flex';
    document.getElementById('victoryScore').textContent = 'All ' + TOTAL_WAVES + ' waves cleared! | Score: ' + score;
}

// === KEYBOARD SHORTCUTS ===
document.addEventListener('keydown', (e) => {
    if (gameState !== 'playing') return;

    switch(e.key) {
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
        case 'u':
            if (selectedTower) upgradeTower();
            break;
        case 's':
            if (selectedTower) sellTower();
            break;
    }
});

// === STARTUP (called from HTML) ===
function initGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    setupInput();
    resizeCanvas();
    updateHUD();
}

// Override startGame to also init
const originalStartGame = startGame;
window.startGame = function() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    initAudio();
    initMap();

    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    setupInput();
    updateHUD();

    gameState = 'playing';
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
};
