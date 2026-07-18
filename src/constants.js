// ============================================
// VECTRON TD - Constants & Definitions
// ============================================

export const CELL_SIZE = 40;
export const GRID_COLS = 20;
export const GRID_ROWS = 15;
export const TOTAL_LEVELS = 30;
export const CANVAS_W = GRID_COLS * CELL_SIZE;
export const CANVAS_H = GRID_ROWS * CELL_SIZE;

export const MAX_EXTENSIONS_PER_LEVEL = 3;
export const EXTENSION_LENGTH = 5;
export const EXTENSION_BASE_COST = 100;

// === TOWER DEFINITIONS ===
export const TOWER_DEFS = {
    green: {
        name: 'Laser',
        cost: 30,
        color: '#00ff88',
        colorDim: 'rgba(0,255,136,0.3)',
        range: 3.5,
        damage: 12,
        fireRate: 10,
        projSpeed: 16,
        projType: 'laser',
        desc: 'Fast laser shots',
    },
    red: {
        name: 'Rocket',
        cost: 65,
        color: '#ff3355',
        colorDim: 'rgba(255,51,85,0.3)',
        range: 4.5,
        damage: 45,
        fireRate: 35,
        projSpeed: 10,
        projType: 'rocket',
        splash: 2.5,
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
export const SUPER_DEFS = {
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
        cost: 220,
        color: '#ff8844',
        range: 6,
        damage: 150,
        fireRate: 55,
        projSpeed: 8,
        projType: 'rocket',
        splash: 4,
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

// === ENEMY TRAITS & EFFECTIVENESS SYSTEM ===
export const ENEMY_TRAITS = {
    normal: {
        name: 'Vectoid',
        color: '#00ff88',
        hpMult: 1, speedMult: 1, countMult: 1, rewardMult: 1,
        shape: 'diamond',
        resist: {},
        weak: {},
    },
    armored: {
        name: 'Plated',
        color: '#aaaaaa',
        hpMult: 2.5, speedMult: 0.7, countMult: 0.7, rewardMult: 2,
        shape: 'square',
        resist: { green: 0.5 },
        weak: { red: 1.8 },
    },
    shielded: {
        name: 'Shielded',
        color: '#44bbff',
        hpMult: 1.8, speedMult: 0.9, countMult: 0.8, rewardMult: 1.8,
        shape: 'hexagon',
        resist: { red: 0.4, purple: 0.5 },
        weak: { green: 1.6, blue: 1.5 },
    },
    fast: {
        name: 'Runner',
        color: '#ffcc00',
        hpMult: 0.4, speedMult: 1.8, countMult: 1.8, rewardMult: 0.8,
        shape: 'triangle',
        resist: { red: 0.5 },
        weak: { blue: 2.0, green: 1.3 },
    },
    camo: {
        name: 'Phantom',
        color: '#553388',
        hpMult: 1.2, speedMult: 1.1, countMult: 1.0, rewardMult: 1.5,
        shape: 'diamond',
        resist: { green: 0.3, red: 0.3 },
        weak: { purple: 2.0, blue: 1.4 },
    },
    regen: {
        name: 'Regenerator',
        color: '#33ff33',
        hpMult: 1.5, speedMult: 0.9, countMult: 0.8, rewardMult: 1.8,
        shape: 'diamond',
        resist: { blue: 0.4 },
        weak: { purple: 1.8, red: 1.5 },
        regenRate: 0.002,
    },
    swarm: {
        name: 'Swarm',
        color: '#ff8844',
        hpMult: 0.25, speedMult: 1.2, countMult: 3.5, rewardMult: 0.4,
        shape: 'triangle',
        resist: { purple: 0.4 },
        weak: { red: 2.5, green: 1.4 },
    },
    phase: {
        name: 'Phase',
        color: '#ff44ff',
        hpMult: 1.3, speedMult: 1.0, countMult: 0.8, rewardMult: 2.2,
        shape: 'hexagon',
        resist: { green: 0.5, blue: 0.5 },
        weak: { purple: 1.6, red: 1.3 },
        phaseChance: 0.4,
    },
    mazeBuilder: {
        name: 'Architect',
        color: '#ff00ff',
        hpMult: 4, speedMult: 0.4, countMult: 0.3, rewardMult: 5,
        shape: 'hexagon',
        resist: { green: 0.6, blue: 0.6 },
        weak: { purple: 1.5, red: 1.3 },
    },
};
