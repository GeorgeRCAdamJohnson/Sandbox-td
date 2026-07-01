// ============================================
// VECTRON TD - Tower Logic
// ============================================

import { CELL_SIZE, TOWER_DEFS, SUPER_DEFS } from './constants.js';
import { state } from './state.js';
import { getDamageMultiplier } from './enemies.js';
import { playSound } from './audio.js';

export function getTowerStats(type, isSuper) {
    let base = isSuper ? SUPER_DEFS[type] : TOWER_DEFS[type];
    let upg = state.towerUpgrades[type];
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
}


export function findTarget(tower) {
    let best = null;
    let bestVal = -Infinity;
    let rangePixels = getTowerStats(tower.type, tower.isSuper).range * CELL_SIZE;

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
    let stats = getTowerStats(tower.type, tower.isSuper);
    let def = tower.isSuper ? SUPER_DEFS[tower.type] : TOWER_DEFS[tower.type];

    if (stats.projType === 'beam') {
        let mult = getDamageMultiplier(tower.type, target.trait || 'normal');
        if (target.phaseChance > 0 && Math.random() < target.phaseChance * 0.5) {
            state.floatingTexts.push({ x: target.x, y: target.y - 10, text: 'PHASE', color: '#ff44ff', life: 20, maxLife: 20, vy: -0.5 });
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
                    let dmg = p.damage * (1 - dist / p.splash * 0.5) * mult;
                    e.hp -= dmg;
                }
            }
            spawnParticles(p.x, p.y, p.color, 12);
            playSound('explosion');
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
export function spawnParticles(x, y, color, count) {
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
