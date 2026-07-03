// ============================================
// VECTRON TD - UI System
// ============================================

import { TOTAL_LEVELS, TOWER_DEFS, SUPER_DEFS } from './constants.js';
import { state } from './state.js';
import { canExtendPath, getExtensionCost } from './map.js';
import { startLevel } from './levels.js';
import { getTowerSynergies } from './towers.js';

export function selectTower(type) {
    let def = type.startsWith('super_') ? SUPER_DEFS[type.replace('super_', '')] : TOWER_DEFS[type];
    if (state.money < def.cost) return;
    state.selectedTowerType = type;
    state.selectedTower = null;
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    let btn = document.getElementById('btn-' + type);
    if (btn) btn.classList.add('selected');
    document.getElementById('towerInfoPanel').style.display = 'none';
}

export function showTowerInfo(tower) {
    let def = tower.isSuper ? SUPER_DEFS[tower.type] : TOWER_DEFS[tower.type];
    let panel = document.getElementById('towerInfoPanel');
    let content = document.getElementById('towerInfoContent');
    let sellValue = Math.floor(tower.totalSpent * 0.7);

    // Kill counter tier (Feature 7)
    let kills = tower.kills || 0;
    let killTier = kills >= 100 ? 'gold' : kills >= 50 ? 'silver' : kills >= 25 ? 'bronze' : '';
    let killTierColor = kills >= 100 ? '#ffd700' : kills >= 50 ? '#c0c0c0' : kills >= 25 ? '#cd7f32' : '';

    // Synergies (Feature 3)
    let synergies = getTowerSynergies(tower);

    let html = `
        <div class="stat-row"><span class="stat-label">Type:</span><span class="stat-value" style="color:${def.color}">${def.name}${tower.isSuper ? ' ★' : ''}</span></div>
        <div class="stat-row"><span class="stat-label">Damage:</span><span class="stat-value">${tower.damage.toFixed(1)}</span></div>
        <div class="stat-row"><span class="stat-label">Range:</span><span class="stat-value">${(tower.range).toFixed(1)} cells</span></div>
        <div class="stat-row"><span class="stat-label">Fire Rate:</span><span class="stat-value">${(60 / tower.fireRate).toFixed(1)}/s</span></div>
        <div class="stat-row"><span class="stat-label">Kills:</span><span class="stat-value">${kills}${killTier ? ' <span style="color:' + killTierColor + '">●</span>' : ''}</span></div>`;

    if (synergies.length > 0) {
        html += `<div class="stat-row"><span class="stat-label">Synergy:</span><span class="stat-value" style="color:#ffcc00">${synergies.join(', ')}</span></div>`;
    }

    html += `<div class="target-modes">`;

    ['first', 'close', 'strong', 'weak'].forEach(m => {
        html += `<button class="target-mode-btn ${tower.targetMode === m ? 'active' : ''}" onclick="window._gameUI.setTargetMode('${m}')">${m[0].toUpperCase()}</button>`;
    });

    html += `</div><button class="sell-btn" onclick="window._gameUI.sellTower()">Sell ($${sellValue}) <span class="hotkey-hint-inline">S</span></button>`;
    content.innerHTML = html;
    panel.style.display = 'block';
}

export function setTargetMode(mode) {
    if (!state.selectedTower) return;
    state.selectedTower.targetMode = mode;
    showTowerInfo(state.selectedTower);
}

export function sellTower() {
    if (!state.selectedTower) return;
    state.money += Math.floor(state.selectedTower.totalSpent * 0.7);
    state.grid[state.selectedTower.row][state.selectedTower.col] = 0;
    state.towers = state.towers.filter(t => t !== state.selectedTower);
    state.selectedTower = null;
    document.getElementById('towerInfoPanel').style.display = 'none';
    updateHUD();
}


export function setSpeed(s) {
    state.gameSpeed = s;
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('speed' + s).classList.add('active');
}

export function updateHUD() {
    document.getElementById('moneyDisplay').textContent = '$' + state.money;
    document.getElementById('livesDisplay').textContent = state.lives;
    document.getElementById('scoreDisplay').textContent = state.score;
    document.getElementById('levelDisplay').textContent = state.currentLevel + ' / ' + TOTAL_LEVELS;
    document.getElementById('waveHUD').textContent = state.currentWave + '/' + state.wavesPerLevel;
    document.getElementById('upgPtsDisplay').textContent = state.upgradePoints;

    // Tower button affordability
    Object.keys(TOWER_DEFS).forEach(type => {
        let btn = document.getElementById('btn-' + type);
        if (btn) btn.style.opacity = state.money < TOWER_DEFS[type].cost ? '0.4' : '1';
    });
    Object.keys(SUPER_DEFS).forEach(type => {
        let btn = document.getElementById('btn-super_' + type);
        if (btn) btn.style.opacity = state.money < SUPER_DEFS[type].cost ? '0.4' : '1';
    });

    // Extend path button
    let extBtn = document.getElementById('extendBtn');
    if (extBtn) {
        if (canExtendPath()) {
            let cost = getExtensionCost();
            extBtn.style.display = 'block';
            extBtn.textContent = `Extend Path ($${cost}) [${state.pathExtensions}/3]`;
            extBtn.style.opacity = state.money >= cost ? '1' : '0.4';
        } else if (state.currentLevel < 10) {
            extBtn.style.display = 'none';
        } else {
            extBtn.style.display = 'block';
            extBtn.textContent = state.waveInProgress ? 'Extend (between waves)' : `Extend (${state.pathExtensions}/3 used)`;
            extBtn.style.opacity = '0.3';
        }
    }
}

export function updateSuperButtons() {
    let container = document.getElementById('superTowers');
    let html = '';
    ['green', 'red', 'purple', 'blue'].forEach(type => {
        if (state.superWeaponsUnlocked[type]) {
            let def = SUPER_DEFS[type];
            html += `<div class="tower-btn super ${type}" onclick="window._gameUI.selectTower('super_${type}')" id="btn-super_${type}">
                <div class="tower-icon">★</div>
                <div>${def.name}</div>
                <div class="tower-cost">$${def.cost}</div>
            </div>`;
        }
    });
    container.innerHTML = html;
}

export function showUpgradeScreen() {
    let screen = document.getElementById('upgradeScreen');
    screen.style.display = 'flex';
    renderUpgradeScreen();
}

export function renderUpgradeScreen() {
    let content = document.getElementById('upgradeContent');
    let html = `<div class="upgrade-header">
        <h2>LEVEL ${state.currentLevel} CLEARED</h2>
        <p>Upgrade Points: <span class="pts">${state.upgradePoints}</span></p>
    </div><div class="upgrade-grid">`;

    ['green', 'red', 'purple', 'blue'].forEach(type => {
        let def = TOWER_DEFS[type];
        let upg = state.towerUpgrades[type];
        let maxed = upg.damage >= 5 && upg.range >= 5 && upg.speed >= 5;
        let superUnlocked = state.superWeaponsUnlocked[type];

        html += `<div class="upgrade-tower-card" style="border-color:${def.color}">
            <h3 style="color:${def.color}">${def.name}</h3>
            <div class="upg-row">
                <span>DMG (${upg.damage}/5)</span>
                <button class="upg-btn" onclick="window._gameUI.buyUpgrade('${type}','damage')" ${upg.damage >= 5 || state.upgradePoints < 1 ? 'disabled' : ''}>+</button>
            </div>
            <div class="upg-row">
                <span>RNG (${upg.range}/5)</span>
                <button class="upg-btn" onclick="window._gameUI.buyUpgrade('${type}','range')" ${upg.range >= 5 || state.upgradePoints < 1 ? 'disabled' : ''}>+</button>
            </div>
            <div class="upg-row">
                <span>SPD (${upg.speed}/5)</span>
                <button class="upg-btn" onclick="window._gameUI.buyUpgrade('${type}','speed')" ${upg.speed >= 5 || state.upgradePoints < 1 ? 'disabled' : ''}>+</button>
            </div>`;

        if (maxed && !superUnlocked) {
            html += `<button class="super-unlock-btn" style="border-color:${def.color};color:${def.color}" onclick="window._gameUI.unlockSuper('${type}')">UNLOCK SUPER</button>`;
        } else if (superUnlocked) {
            html += `<div class="super-badge" style="color:${def.color}">★ ${SUPER_DEFS[type].name} UNLOCKED</div>`;
        }

        html += `</div>`;
    });

    html += `</div>
        <button class="continue-btn" onclick="window._gameUI.continueToNextLevel()">CONTINUE TO LEVEL ${state.currentLevel + 1}</button>`;
    content.innerHTML = html;
}

export function buyUpgrade(type, stat) {
    if (state.upgradePoints < 1) return;
    if (state.towerUpgrades[type][stat] >= 5) return;
    state.towerUpgrades[type][stat]++;
    state.upgradePoints--;
    renderUpgradeScreen();
}

export function unlockSuper(type) {
    state.superWeaponsUnlocked[type] = true;
    renderUpgradeScreen();
    updateSuperButtons();
    document.getElementById('superPanel').style.display = 'block';
}

export function continueToNextLevel() {
    document.getElementById('upgradeScreen').style.display = 'none';
    startLevel(state.currentLevel + 1);
}
