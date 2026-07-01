// ============================================
// VECTRON TD - Level System
// ============================================

import { TOTAL_LEVELS, CANVAS_W, CANVAS_H, ENEMY_TRAITS } from './constants.js';
import { state } from './state.js';
import { generateMap } from './map.js';
import { playSound, setMusicIntensity, updateMusicForWave } from './audio.js';
import { getWaveConfig } from './enemies.js';
import { updateHUD, updateSuperButtons, showUpgradeScreen } from './ui.js';

export function levelComplete() {
    playSound('levelup');
    setMusicIntensity(0.1);
    state.upgradePoints += 2 + Math.floor(state.currentLevel / 5);

    let levelBonus;
    if (state.currentLevel <= 3) {
        levelBonus = 40 + state.currentLevel * 10;
    } else if (state.currentLevel <= 10) {
        levelBonus = 50 + state.currentLevel * 6;
    } else {
        levelBonus = 55 + state.currentLevel * 3;
    }
    let interestBonus = Math.floor(state.money * 0.03);
    state.money += levelBonus + interestBonus;

    state.floatingTexts.push({
        x: CANVAS_W / 2, y: CANVAS_H / 2 - 20,
        text: 'LEVEL ' + state.currentLevel + ' COMPLETE!',
        color: '#00ffc8', life: 80, maxLife: 80, vy: -0.3
    });
    state.floatingTexts.push({
        x: CANVAS_W / 2, y: CANVAS_H / 2 + 10,
        text: '+$' + (levelBonus + interestBonus) + ' bonus',
        color: '#ffcc00', life: 80, maxLife: 80, vy: -0.3
    });

    if (state.currentLevel >= TOTAL_LEVELS) {
        victory();
        return;
    }

    setTimeout(() => {
        state.gameState = 'upgradeScreen';
        showUpgradeScreen();
    }, 1500);
}


export function startLevel(lvl) {
    state.currentLevel = lvl;
    state.currentWave = 0;
    state.waveInProgress = false;
    state.enemiesSpawned = 0;
    state.enemies = [];
    state.projectiles = [];
    state.particles = [];
    state.floatingTexts = [];
    state.towers = [];
    state.pathExtensions = 0;
    state.pathExtendMode = false;

    generateMap();
    updateHUD();
    updateSuperButtons();
    if (Object.values(state.superWeaponsUnlocked).some(v => v)) {
        document.getElementById('superPanel').style.display = 'block';
    }

    document.getElementById('waveBtn').disabled = false;
    document.getElementById('waveBtn').textContent = `Wave 1/${state.wavesPerLevel}`;
    document.getElementById('levelDisplay').textContent = `${state.currentLevel} / ${TOTAL_LEVELS}`;

    state.gameState = 'playing';
    requestAnimationFrame(state.gameLoop);
}

export function sendNextWave() {
    if (state.waveInProgress || state.gameState !== 'playing') return;
    if (state.currentWave >= state.wavesPerLevel) return;

    // Confirm if no towers placed
    if (state.towers.length === 0) {
        if (!confirm('No towers placed! Are you sure you want to send the wave?')) {
            return;
        }
    }

    state.currentWaveConfig = getWaveConfig(state.currentLevel, state.currentWave + 1);
    state.currentWaveGroups = state.currentWaveConfig.groups;
    state.currentGroupIdx = 0;
    state.groupSpawned = 0;

    // Total enemies in this wave
    state.enemiesInWave = 0;
    for (let g of state.currentWaveGroups) {
        let traitDef = ENEMY_TRAITS[g.trait] || ENEMY_TRAITS.normal;
        g.count = Math.max(1, Math.floor(g.count * traitDef.countMult));
        state.enemiesInWave += g.count;
    }

    state.enemiesSpawned = 0;
    state.spawnTimer = 0;
    state.spawnInterval = Math.max(8, 20 - Math.floor(state.currentLevel / 3));
    state.waveInProgress = true;

    document.getElementById('waveBtn').disabled = true;
    document.getElementById('waveBtn').textContent = 'Wave in progress...';
    playSound('wave');
    updateMusicForWave();
    updateHUD();
}

export function gameOver() {
    state.gameState = 'gameover';
    document.getElementById('gameOverScreen').style.display = 'flex';
    document.getElementById('gameOverScore').textContent = `Level ${state.currentLevel} | Wave ${state.currentWave} | Score: ${state.score}`;
}

export function victory() {
    state.gameState = 'victory';
    document.getElementById('victoryScreen').style.display = 'flex';
    document.getElementById('victoryScore').textContent = `All ${TOTAL_LEVELS} levels cleared! | Score: ${state.score}`;
}
