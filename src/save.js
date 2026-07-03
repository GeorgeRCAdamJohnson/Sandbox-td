// ============================================
// VECTRON TD - Save/Load System (Feature 1)
// ============================================

import { state } from './state.js';

const SAVE_KEY = 'vectronTD_save';
const HIGHSCORE_KEY = 'vectronTD_highscore';

export function saveGame() {
    let saveData = {
        currentLevel: state.currentLevel,
        money: state.money,
        lives: state.lives,
        score: state.score,
        upgradePoints: state.upgradePoints,
        towerUpgrades: JSON.parse(JSON.stringify(state.towerUpgrades)),
        superWeaponsUnlocked: JSON.parse(JSON.stringify(state.superWeaponsUnlocked)),
        difficulty: state.difficulty,
    };
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch (e) {
        // localStorage might be unavailable
    }
}

export function loadGame() {
    try {
        let data = localStorage.getItem(SAVE_KEY);
        if (!data) return null;
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

export function hasSavedGame() {
    try {
        return localStorage.getItem(SAVE_KEY) !== null;
    } catch (e) {
        return false;
    }
}

export function deleteSave() {
    try {
        localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
}

export function applySaveData(data) {
    state.currentLevel = data.currentLevel;
    state.money = data.money;
    state.lives = data.lives;
    state.score = data.score;
    state.upgradePoints = data.upgradePoints;
    state.towerUpgrades = data.towerUpgrades;
    state.superWeaponsUnlocked = data.superWeaponsUnlocked;
    state.difficulty = data.difficulty || 'normal';
}

export function saveHighScore(score) {
    try {
        let current = getHighScore();
        if (score > current) {
            localStorage.setItem(HIGHSCORE_KEY, String(score));
        }
    } catch (e) {}
}

export function getHighScore() {
    try {
        return parseInt(localStorage.getItem(HIGHSCORE_KEY) || '0', 10);
    } catch (e) {
        return 0;
    }
}
