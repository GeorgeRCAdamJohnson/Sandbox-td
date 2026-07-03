// ============================================
// VECTRON TD - Main Entry Point (ES Module)
// ============================================

import { CANVAS_W, CANVAS_H } from './src/constants.js';
import { state } from './src/state.js';
import { initAudio, playSound, toggleMusic, toggleSfx } from './src/audio.js';
import { spawnEnemy, updateEnemy } from './src/enemies.js';
import { updateTower, updateProjectile, spawnParticles } from './src/towers.js';
import { render } from './src/renderer.js';
import { setupInput } from './src/input.js';
import { selectTower, showTowerInfo, setTargetMode, sellTower, setSpeed, updateHUD, updateSuperButtons, showUpgradeScreen, renderUpgradeScreen, buyUpgrade, unlockSuper, continueToNextLevel } from './src/ui.js';
import { levelComplete, startLevel, sendNextWave, gameOver, victory, startEndlessMode, updateWavePreview } from './src/levels.js';
import { startPathExtend, cancelPathExtend } from './src/map.js';
import { deselectAll } from './src/input.js';
import { hasSavedGame, loadGame, applySaveData, deleteSave } from './src/save.js';
import { resetLevelStats } from './src/stats.js';

// Expose UI functions to global scope for onclick handlers in HTML
window._gameUI = {
    selectTower,
    setTargetMode,
    sellTower,
    setSpeed,
    buyUpgrade,
    unlockSuper,
    continueToNextLevel,
    sendNextWave,
    startPathExtend,
    deselectAll,
    toggleMusic,
    toggleSfx,
    startEndlessMode,
};

// Also expose top-level functions that HTML onclick attributes reference directly
window.selectTower = selectTower;
window.sendNextWave = sendNextWave;
window.setSpeed = setSpeed;
window.startPathExtend = startPathExtend;
window.deselectAll = deselectAll;
window.toggleMusic = toggleMusic;
window.toggleSfx = toggleSfx;
window.startGame = startGame;
window.startNewGame = startNewGame;
window.continueGame = continueGame;
window.startEndlessMode = startEndlessMode;
window.setDifficulty = setDifficulty;

// === KEYBOARD ===
document.addEventListener('keydown', (e) => {
    if (state.gameState !== 'playing') return;
    switch (e.key) {
        case '1': selectTower('green'); break;
        case '2': selectTower('red'); break;
        case '3': selectTower('purple'); break;
        case '4': selectTower('blue'); break;
        case ' ':
            e.preventDefault();
            if (!state.waveInProgress) sendNextWave();
            break;
        case 'Escape':
            state.selectedTowerType = null;
            state.selectedTower = null;
            document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
            document.getElementById('towerInfoPanel').style.display = 'none';
            break;
        case 's': if (state.selectedTower) sellTower(); break;
    }
});


// === INIT ===
// Register gameLoop on state so modules can call it without circular imports
state.gameLoop = gameLoop;

// Difficulty settings (Feature 11)
const DIFFICULTY_SETTINGS = {
    easy: { money: 150, lives: 30 },
    normal: { money: 100, lives: 20 },
    hard: { money: 75, lives: 15 },
};

function setDifficulty(diff) {
    state.difficulty = diff;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    let btn = document.getElementById('diff-' + diff);
    if (btn) btn.classList.add('active');
}

// Show continue button if save exists (Feature 1)
document.addEventListener('DOMContentLoaded', () => {
    if (hasSavedGame()) {
        let continueBtn = document.getElementById('continueBtn');
        if (continueBtn) continueBtn.style.display = 'inline-block';
    }
});

function startNewGame() {
    deleteSave();
    let settings = DIFFICULTY_SETTINGS[state.difficulty] || DIFFICULTY_SETTINGS.normal;
    state.money = settings.money;
    state.lives = settings.lives;
    state.endlessMode = false;
    launchGame(1);
}

function continueGame() {
    let saveData = loadGame();
    if (saveData) {
        applySaveData(saveData);
        launchGame(saveData.currentLevel + 1);
    } else {
        startNewGame();
    }
}

function startGame() {
    // Legacy function - acts as new game
    startNewGame();
}

function launchGame(startLvl) {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    initAudio();

    state.canvas = document.getElementById('gameCanvas');
    state.canvas.width = CANVAS_W;
    state.canvas.height = CANVAS_H;
    state.ctx = state.canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100));

    setupInput();
    startLevel(startLvl);
}

function resizeCanvas() {
    let wrap = document.getElementById('canvasWrap');
    if (!wrap) return;
    let maxW = wrap.clientWidth - 4;
    let maxH = wrap.clientHeight - 4;

    let scale = Math.min(maxW / CANVAS_W, maxH / CANVAS_H);
    state.canvas.style.width = Math.floor(CANVAS_W * scale) + 'px';
    state.canvas.style.height = Math.floor(CANVAS_H * scale) + 'px';
}

// === GAME LOOP ===
export function gameLoop(ts) {
    if (state.gameState !== 'playing') return;
    state.lastTime = ts;
    state.animFrame++;
    for (let i = 0; i < state.gameSpeed; i++) update();
    render();
    requestAnimationFrame(gameLoop);
}

function update() {
    // Spawn
    if (state.waveInProgress && state.enemiesSpawned < state.enemiesInWave) {
        state.spawnTimer++;
        if (state.spawnTimer >= state.spawnInterval) {
            state.spawnTimer = 0;
            spawnEnemy();
            state.enemiesSpawned++;
        }
    }

    // Update enemies
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        updateEnemy(state.enemies[i]);
        if (state.enemies[i].reachedEnd) {
            state.lives--;
            state.levelStats.livesLostThisLevel++;
            // Mobile vibration on life loss (Feature 8)
            if (navigator.vibrate) navigator.vibrate(50);
            spawnParticles(state.enemies[i].x, state.enemies[i].y, '#ff0033', 8);
            state.enemies.splice(i, 1);
            updateHUD();
            if (state.lives <= 0) { gameOver(); return; }
        } else if (state.enemies[i].hp <= 0) {
            let enemy = state.enemies[i];
            state.money += enemy.reward;
            state.score += enemy.reward * 2;
            // Track stats (Feature 10)
            state.levelStats.enemiesKilled++;
            state.levelStats.moneyEarned += enemy.reward;
            // Kill counter: find nearest tower to credit (Feature 7)
            creditKillToNearestTower(enemy);
            spawnParticles(enemy.x, enemy.y, enemy.color, 10);
            state.floatingTexts.push({
                x: enemy.x, y: enemy.y,
                text: '+$' + enemy.reward,
                color: '#ffcc00', life: 35, maxLife: 35, vy: -0.8
            });
            playSound('death');
            state.enemies.splice(i, 1);
            updateHUD();
        }
    }

    // Wave complete check
    if (state.waveInProgress && state.enemiesSpawned >= state.enemiesInWave && state.enemies.length === 0) {
        state.waveInProgress = false;
        state.currentWave++;

        if (state.currentWave >= state.wavesPerLevel) {
            levelComplete();
            return;
        }

        document.getElementById('waveBtn').disabled = false;
        document.getElementById('waveBtn').textContent = `Wave ${state.currentWave + 1}/${state.wavesPerLevel}`;
        // Update wave preview (Feature 5)
        updateWavePreview();
        updateHUD();
    }

    // Update towers
    for (let t of state.towers) updateTower(t);

    // Update projectiles
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        updateProjectile(state.projectiles[i]);
        if (state.projectiles[i].dead) state.projectiles.splice(i, 1);
    }

    // Update particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
        state.particles[i].x += state.particles[i].vx;
        state.particles[i].y += state.particles[i].vy;
        state.particles[i].life--;
        if (state.particles[i].life <= 0) state.particles.splice(i, 1);
    }

    // Update floating texts
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        state.floatingTexts[i].y += state.floatingTexts[i].vy;
        state.floatingTexts[i].life--;
        if (state.floatingTexts[i].life <= 0) state.floatingTexts.splice(i, 1);
    }

    // Update damage numbers (Feature 6)
    for (let i = state.damageNumbers.length - 1; i >= 0; i--) {
        state.damageNumbers[i].y += state.damageNumbers[i].vy;
        state.damageNumbers[i].life--;
        if (state.damageNumbers[i].life <= 0) state.damageNumbers.splice(i, 1);
    }
}

// Feature 7: Credit kill to nearest tower
function creditKillToNearestTower(enemy) {
    let bestTower = null;
    let bestDist = Infinity;
    for (let t of state.towers) {
        let dx = t.x - enemy.x;
        let dy = t.y - enemy.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
            bestDist = dist;
            bestTower = t;
        }
    }
    if (bestTower) {
        if (bestTower.kills === undefined) bestTower.kills = 0;
        bestTower.kills++;
    }
}

// Prevent context menu globally
document.addEventListener('contextmenu', e => e.preventDefault());
