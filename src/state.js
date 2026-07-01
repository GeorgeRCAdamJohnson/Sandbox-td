// ============================================
// VECTRON TD - Mutable Game State
// ============================================

export const state = {
    canvas: null,
    ctx: null,
    gameState: 'menu', // menu, playing, upgradeScreen, gameover, victory
    gameSpeed: 1,
    money: 100,
    lives: 20,
    score: 0,
    currentLevel: 0,
    currentWave: 0,
    wavesPerLevel: 5,
    waveInProgress: false,
    enemiesSpawned: 0,
    enemiesInWave: 0,
    spawnTimer: 0,
    spawnInterval: 30,
    selectedTowerType: null,
    selectedTower: null,
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    floatingTexts: [],
    grid: [],       // 0=buildable, 1=path, 2=tower
    path: [],       // pixel coords of waypoints
    pathCells: [],  // grid cells that are path
    hoveredCell: null,
    animFrame: 0,
    gridPulse: 0,
    musicMuted: false,
    sfxMuted: false,
    tronLineOffset: 0,

    // Path extension system
    pathExtendMode: false,
    pathExtensions: 0,
    extensionCellsPlaced: 0,
    extensionCellsRemaining: 0,

    // Upgrade system
    upgradePoints: 0,
    towerUpgrades: {
        green: { damage: 0, range: 0, speed: 0 },
        red: { damage: 0, range: 0, speed: 0 },
        purple: { damage: 0, range: 0, speed: 0 },
        blue: { damage: 0, range: 0, speed: 0 },
    },
    superWeaponsUnlocked: {
        green: false, red: false, purple: false, blue: false
    },

    // Wave spawning
    currentWaveConfig: null,
    currentWaveGroups: [],
    currentGroupIdx: 0,
    groupSpawned: 0,

    // Audio
    audioCtx: null,
    musicPlaying: false,
    musicNodes: {},

    // Sequencer flags
    arpRunning: false,
    tickRunning: false,

    // Misc
    lastTime: 0,
    isMobile: false,
    gameLoop: null,
};
