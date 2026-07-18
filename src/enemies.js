// ============================================
// VECTRON TD - Enemy Logic
// ============================================

import { ENEMY_TRAITS, GRID_COLS, GRID_ROWS } from './constants.js';
import { state } from './state.js';

// Get damage multiplier for a tower type vs enemy trait
export function getDamageMultiplier(towerType, enemyTrait) {
    let traitDef = ENEMY_TRAITS[enemyTrait] || ENEMY_TRAITS.normal;
    let mult = 1.0;
    if (traitDef.resist[towerType]) mult *= traitDef.resist[towerType];
    if (traitDef.weak[towerType]) mult *= traitDef.weak[towerType];
    return Math.max(0.15, mult);
}

// === WAVE COMPOSITION SYSTEM ===
export function getWaveConfig(level, wave) {
    let difficulty = (level - 1) * 3 + wave;

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

    // Difficulty multipliers (Feature 11)
    let hpMult = 1.0;
    let rewardMult = 1.0;
    if (state.difficulty === 'easy') { hpMult = 0.7; rewardMult = 1.3; }
    else if (state.difficulty === 'hard') { hpMult = 1.4; rewardMult = 0.7; }
    baseHP *= hpMult;

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

    let baseSpeed = 1.0 + Math.min(difficulty * 0.03, 2.2);
    if (level > 15) baseSpeed += 0.3;
    if (level > 25) baseSpeed += 0.3;

    let baseReward = 4 + Math.floor(difficulty * 0.2);
    if (level > 10) baseReward = Math.floor(baseReward * 0.75);
    if (level > 20) baseReward = Math.floor(baseReward * 0.7);
    baseReward = Math.max(1, Math.floor(baseReward * rewardMult));

    let groups = [];

    if (wave === state.wavesPerLevel) {
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
        let trait = wave <= 2 ? 'normal' : (wave <= 4 ? 'fast' : 'normal');
        groups.push({ trait, count: baseCount, hpMult: 1, speedMult: 1, rewardMult: 1, size: 10 });
    } else {
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

export function getRandomTrait(level, isEscort) {
    let available = ['normal'];
    if (level >= 2) available.push('fast');
    if (level >= 3) available.push('armored');
    if (level >= 4) available.push('swarm');
    if (level >= 6) available.push('shielded');
    if (level >= 8) available.push('camo');
    if (level >= 10) available.push('regen');
    if (level >= 14) available.push('phase');
    if (level >= 31) available.push('mazeBuilder');

    if (level > 15) {
        available = available.filter(t => t !== 'normal');
        if (level > 20) {
            available.push('phase', 'regen', 'camo');
        }
    } else if (level > 8 && Math.random() < 0.4) {
        available = available.filter(t => t !== 'normal');
    }

    return available[Math.floor(Math.random() * available.length)];
}

export function getBossTrait(level) {
    if (level <= 3) return 'armored';
    if (level <= 6) return 'shielded';
    if (level <= 10) return Math.random() < 0.5 ? 'regen' : 'armored';
    if (level <= 15) return Math.random() < 0.5 ? 'phase' : 'shielded';
    let bossTraits = ['regen', 'phase', 'shielded'];
    if (level > 30) bossTraits.push('mazeBuilder');
    return bossTraits[Math.floor(Math.random() * bossTraits.length)];
}

export function spawnEnemy() {
    if (state.currentGroupIdx >= state.currentWaveGroups.length) return;

    let group = state.currentWaveGroups[state.currentGroupIdx];
    let traitDef = ENEMY_TRAITS[group.trait] || ENEMY_TRAITS.normal;
    let config = state.currentWaveConfig;

    let hp = config.baseHP * traitDef.hpMult * group.hpMult;
    let speed = config.baseSpeed * traitDef.speedMult * group.speedMult;
    let reward = Math.floor(config.baseReward * traitDef.rewardMult * group.rewardMult);

    state.enemies.push({
        x: state.path[0].x,
        y: state.path[0].y,
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
        buildTimer: 0,
    });

    state.groupSpawned++;
    if (state.groupSpawned >= group.count) {
        state.currentGroupIdx++;
        state.groupSpawned = 0;
    }
}

export function updateEnemy(e) {
    if (e.pathIdx >= state.path.length - 1) { e.reachedEnd = true; return; }

    // Maze Builder (Architect) ability: place blocks every 120 frames
    if (e.trait === 'mazeBuilder') {
        e.buildTimer++;
        if (e.buildTimer >= 120) {
            e.buildTimer = 0;
            // Pick a random adjacent empty cell and block it
            let cellCol = Math.floor(e.x / 40);
            let cellRow = Math.floor(e.y / 40);
            let dirs = [{dc:-1,dr:0},{dc:1,dr:0},{dc:0,dr:-1},{dc:0,dr:1}];
            let candidates = [];
            for (let d of dirs) {
                let nc = cellCol + d.dc;
                let nr = cellRow + d.dr;
                if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS && state.grid[nr][nc] === 0) {
                    candidates.push({x: nc, y: nr});
                }
            }
            if (candidates.length > 0) {
                let pick = candidates[Math.floor(Math.random() * candidates.length)];
                state.grid[pick.y][pick.x] = 1;
            }
        }
    }

    let target = state.path[e.pathIdx + 1];
    let dx = target.x - e.x;
    let dy = target.y - e.y;
    let dist = Math.abs(dx) + Math.abs(dy);
    let speed = e.speed * e.slowAmt;

    if (e.slowTimer > 0) {
        e.slowTimer--;
        if (e.slowTimer <= 0) e.slowAmt = 1;
    }

    // Regeneration - weaker for high-HP enemies (bosses)
    if (e.regenRate > 0 && e.hp > e.maxHp * 0.4 && e.hp < e.maxHp) {
        // Cap regen at 2 HP/frame max regardless of maxHp
        let regenAmount = Math.min(2, e.maxHp * e.regenRate);
        e.hp = Math.min(e.maxHp, e.hp + regenAmount);
    }

    if (dist <= speed) {
        e.x = target.x;
        e.y = target.y;
        e.pathIdx++;
    } else {
        if (Math.abs(dx) > 0.1) {
            e.x += Math.sign(dx) * speed;
        } else {
            e.y += Math.sign(dy) * speed;
        }
    }
    e.angle += 0.04;
}
