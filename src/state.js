// ============================================
// VECTRON TD - Mutable Game State
// ============================================

export const state = {
    canvas: null,
    ctx: null,
    gameState: 'menu', // menu, playing, upgradeScreen, gameover, victory, statsScreen
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
    validExtensionSpots: [],

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
    musicIntensity: 0,

    // Sequencer flags
    arpRunning: false,
    tickRunning: false,

    // Misc
    lastTime: 0,
    isMobile: false,
    gameLoop: null,

    // === Difficulty system (Feature 11) ===
    difficulty: 'normal', // 'easy', 'normal', 'hard'

    // === Endless mode (Feature 2) ===
    endlessMode: false,
    endlessHighScore: 0,

    // === Tower synergies (Feature 3) ===
    // (synergies computed on-the-fly, no extra state needed)

    // === Split paths (Feature 4) ===
    splitPath: null, // {branchA: [], branchB: [], forkIdx: number, rejoinIdx: number}

    // === Damage numbers (Feature 6) ===
    damageNumbers: [],

    // === Tower kill counter (Feature 7) ===
    // (kills tracked per tower object)

    // === Better mobile UX (Feature 8) ===
    lastTapTime: 0,

    // === Statistics (Feature 10) ===
    levelStats: {
        damageByType: { green: 0, red: 0, purple: 0, blue: 0 },
        enemiesKilled: 0,
        moneyEarned: 0,
        livesLostThisLevel: 0,
    },

    // === Screen Shake ===
    screenShake: 0,

    // === Kill Combo Counter ===
    comboCount: 0,
    comboTimer: 0,
    maxCombo: 0,

    // === Performance ===
    performanceMode: 'auto', // 'auto', 'high', 'low'
    lowPerfMode: false, // true when on mobile or FPS drops
    frameCount: 0,
    fpsCheckTime: 0,
    currentFPS: 60,
    maxParticles: 200,
};
