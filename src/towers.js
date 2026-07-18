// ============================================
// VECTRON TD - Tower Logic
// ============================================

import { CELL_SIZE, GRID_COLS, GRID_ROWS, TOWER_DEFS, SUPER_DEFS } from './constants.js';
import { state } from './state.js';
import { getDamageMultiplier } from './enemies.js';
import { playSound } from './audio.js';

// === TOWER SYNERGIES (Feature 3) ===
export function getAdjacentTowers(tower) {
    let dirs = [{dr:-1,dc:0},{dr:1,dc:0},{dr:0,dc:-1},{dr:0,dc:1}];
    let adj = [];
    for (let d of dirs) {
        let nr = tower.row + d.dr;
        let nc = tower.col + d.dc;
        if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
            for (let t of state.towers) {
                if (t.row === nr && t.col === nc) adj.push(t);
            }
        }
    }
    return adj;
}

export function getTowerSynergies(tower) {
    let synergies = [];
    let adj = getAdjacentTowers(tower);
    for (let a of adj) {
        // Blue + Green = Shatter
        if (tower.type === 'green' && a.type === 'blue') synergies.push('shatter');
        if (tower.type === 'blue' && a.type === 'green') synergies.push('shatter');
        // Red + Red = Barrage
        if (tower.type === 'red' && a.type === 'red') synergies.push('barrage');
        // Purple + Blue = Cryo Beam
        if (tower.type === 'purple' && a.type === 'blue') synergies.push('cryobeam');
        if (tower.type === 'blue' && a.type === 'purple') synergies.push('cryobeam');
    }
    // Deduplicate
    return [...new Set(synergies)];
}

// === KILL COUNTER BONUSES (Feature 7) ===
function getKillBonus(kills) {
    if (kills >= 100) return { damage: 0.15, range: 0.10, fireRate: 0.10, tier: 'gold' };
    if (kills >= 50) return { damage: 0.10, range: 0.05, fireRate: 0, tier: 'silver' };
    if (kills >= 25) return { damage: 0.05, range: 0, fireRate: 0, tier: 'bronze' };
    return { damage: 0, range: 0, fireRate: 0, tier: null };
}

export function getTowerStats(type, isSuper, tower) {
    let base = isSuper ? SUPER_DEFS[type] : TOWER_DEFS[type];
    let upg = state.towerUpgrades[type];

    let damage = base.damage * (1 + upg.damage * 0.15);
    let range = base.range * (1 + upg.range * 0.1);
    let fireRate = Math.max(4, base.fireRate * (1 - upg.speed * 0.08));

    // Apply kill counter bonuses (Feature 7)
    if (tower && tower.kills !== undefined) {
        let kb = getKillBonus(tower.kills);
        damage *= (1 + kb.damage);
        range *= (1 + kb.range);
        if (kb.fireRate > 0) fireRate = Math.max(4, fireRate * (1 - kb.fireRate));
    }

    // Apply synergy bonuses (Feature 3)
    if (tower) {
        let synergies = getTowerSynergies(tower);
        if (synergies.includes('barrage') && type === 'red') {
            fireRate = Math.max(4, fireRate * 0.8); // +20% fire rate
        }
    }

    return {
        damage,
        range,
        fireRate,
        projSpeed: base.projSpeed,
        projType: base.projType,
        splash: base.splash ? base.splash * (1 + upg.range * 0.05) : 0,
        slowAmt: base.slowAmt || 0,
        slowDur: base.slowDur || 0,
    };
}

export function updateTower(tower) {
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
    // Tower fire flash decay
    if (tower.fireFlash > 0) tower.fireFlash--;
}


export function findTarget(tower) {
    let best = null;
    let bestVal = -Infinity;
    let rangePixels = getTowerStats(tower.type, tower.isSuper, tower).range * CELL_SIZE;

    for (let e of state.enemies) {
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

export function fireTower(tower, target) {
    let stats = getTowerStats(tower.type, tower.isSuper, tower);
    let def = tower.isSuper ? SUPER_DEFS[tower.type] : TOWER_DEFS[tower.type];
    let synergies = getTowerSynergies(tower);
    tower.fireFlash = 8;

    if (stats.projType === 'beam') {
        let mult = getDamageMultiplier(tower.type, target.trait || 'normal');
        // Shatter synergy: frozen enemies take 1.5x damage from green
        if (synergies.includes('shatter') && tower.type === 'green' && target.slowTimer > 0) {
            mult *= 1.5;
        }
        if (target.phaseChance > 0 && Math.random() < target.phaseChance * 0.5) {
            state.floatingTexts.push({ x: target.x, y: target.y - 10, text: 'PHASE', color: '#ff44ff', life: 20, maxLife: 20, vy: -0.5 });
        } else {
            let dmg = stats.damage * mult;
            target.hp -= dmg;
            // Cryo Beam synergy: beam applies 30% slow for 60 frames
            if (synergies.includes('cryobeam') && tower.type === 'purple') {
                target.slowAmt = 0.7;
                target.slowTimer = 60;
            }
            // Track stats (Feature 10)
            state.levelStats.damageByType[tower.type] += dmg;
            // Damage number (Feature 6)
            spawnDamageNumber(target.x, target.y, dmg, mult);
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
            towerRef: tower,
            life: 80,
            dead: false,
            size: stats.projType === 'rocket' ? 5 : 3,
            synergies: synergies,
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
        state.projectiles.push(proj);
    }
}


// === PROJECTILE LOGIC ===
export function updateProjectile(p) {
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
            for (let e of state.enemies) {
                let ex = e.x - p.x, ey = e.y - p.y;
                let dist = Math.sqrt(ex * ex + ey * ey);
                if (dist < p.splash) {
                    let mult = getDamageMultiplier(p.towerType || 'red', e.trait || 'normal');
                    // Shatter synergy for rockets from green adjacent to blue
                    if (p.synergies && p.synergies.includes('shatter') && p.towerType === 'green' && e.slowTimer > 0) {
                        mult *= 1.5;
                    }
                    let dmg = p.damage * (1 - dist / p.splash * 0.5) * mult;
                    e.hp -= dmg;
                    state.levelStats.damageByType[p.towerType || 'red'] += dmg;
                    spawnDamageNumber(e.x, e.y, dmg, mult);
                }
            }
            spawnParticles(p.x, p.y, p.color, 12);
            playSound('explosion');
            state.screenShake = 5;
            p.dead = true;
        }
    } else {
        for (let e of state.enemies) {
            let dx = e.x - p.x, dy = e.y - p.y;
            if (Math.sqrt(dx * dx + dy * dy) < e.size + p.size) {
                if (e.phaseChance > 0 && Math.random() < e.phaseChance) {
                    state.floatingTexts.push({ x: e.x, y: e.y - 10, text: 'PHASE', color: '#ff44ff', life: 20, maxLife: 20, vy: -0.5 });
                    p.dead = true;
                    break;
                }
                let mult = getDamageMultiplier(p.towerType || 'green', e.trait || 'normal');
                // Shatter synergy
                if (p.synergies && p.synergies.includes('shatter') && p.towerType === 'green' && e.slowTimer > 0) {
                    mult *= 1.5;
                }
                let dmg = p.damage * mult;
                e.hp -= dmg;
                if (p.type === 'slow') {
                    e.slowAmt = p.slowAmt;
                    e.slowTimer = p.slowDur;
                }
                // Track stats (Feature 10)
                state.levelStats.damageByType[p.towerType || 'green'] += dmg;
                // Damage number (Feature 6)
                spawnDamageNumber(e.x, e.y, dmg, mult);
                spawnParticles(p.x, p.y, p.color, 4);
                p.dead = true;
                break;
            }
        }
    }
}

// === DAMAGE NUMBERS (Feature 6) ===
export function spawnDamageNumber(x, y, damage, mult) {
    let color = '#ffffff';
    if (mult > 1.0) color = '#00ff88';
    else if (mult < 1.0) color = '#ff3355';
    state.damageNumbers.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y - 5,
        text: Math.floor(damage).toString(),
        color: color,
        life: 20,
        maxLife: 20,
        vy: -0.8,
    });
}

// === PARTICLES ===
export function spawnParticles(x, y, color, count) {
    // Cap particles for performance
    let maxNew = state.maxParticles - state.particles.length;
    if (maxNew <= 0) return;
    count = Math.min(count, maxNew);
    // Reduce count in low-perf mode
    if (state.lowPerfMode) count = Math.max(1, Math.floor(count * 0.4));

    for (let i = 0; i < count; i++) {
        let a = Math.random() * Math.PI * 2;
        let spd = 1 + Math.random() * 3;
        let life = 15 + Math.floor(Math.random() * 15);
        state.particles.push({
            x, y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            color, life, maxLife: life,
            size: 1 + Math.random() * 2.5,
        });
    }
}
