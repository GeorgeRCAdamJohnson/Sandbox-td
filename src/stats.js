// ============================================
// VECTRON TD - Statistics Screen (Feature 10)
// ============================================

import { state } from './state.js';
import { TOWER_DEFS } from './constants.js';

export function resetLevelStats() {
    state.levelStats = {
        damageByType: { green: 0, red: 0, purple: 0, blue: 0 },
        enemiesKilled: 0,
        moneyEarned: 0,
        livesLostThisLevel: 0,
    };
}

export function showStatsScreen(callback) {
    let stats = state.levelStats;
    let screen = document.getElementById('statsScreen');
    let content = document.getElementById('statsContent');

    // Find most effective tower
    let bestType = 'green';
    let bestDmg = 0;
    for (let type of ['green', 'red', 'purple', 'blue']) {
        if (stats.damageByType[type] > bestDmg) {
            bestDmg = stats.damageByType[type];
            bestType = type;
        }
    }

    let totalDamage = Object.values(stats.damageByType).reduce((a, b) => a + b, 0);

    let html = `<div class="stats-header"><h2>LEVEL ${state.currentLevel} STATS</h2></div>`;
    html += `<div class="stats-grid">`;
    html += `<div class="stats-row"><span>Total Damage:</span><span>${Math.floor(totalDamage)}</span></div>`;
    for (let type of ['green', 'red', 'purple', 'blue']) {
        let def = TOWER_DEFS[type];
        let pct = totalDamage > 0 ? Math.round(stats.damageByType[type] / totalDamage * 100) : 0;
        html += `<div class="stats-row"><span style="color:${def.color}">&nbsp;&nbsp;${def.name}:</span><span>${Math.floor(stats.damageByType[type])} (${pct}%)</span></div>`;
    }
    html += `<div class="stats-row"><span>Enemies Killed:</span><span>${stats.enemiesKilled}</span></div>`;
    html += `<div class="stats-row"><span>Money Earned:</span><span>$${stats.moneyEarned}</span></div>`;
    html += `<div class="stats-row"><span>Lives Lost:</span><span>${stats.livesLostThisLevel}</span></div>`;
    if (bestDmg > 0) {
        let def = TOWER_DEFS[bestType];
        html += `<div class="stats-row"><span>MVP Tower:</span><span style="color:${def.color}">${def.name}</span></div>`;
    }
    html += `</div>`;

    content.innerHTML = html;
    screen.style.display = 'flex';

    setTimeout(() => {
        screen.style.display = 'none';
        if (callback) callback();
    }, 3000);
}
