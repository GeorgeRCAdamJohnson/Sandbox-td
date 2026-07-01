// ============================================
// VECTRON TD - Audio System
// ============================================

import { state } from './state.js';

export function initAudio() {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    startMusic();
}

// === PROCEDURAL SYNTH MUSIC ===
export function startMusic() {
    if (!state.audioCtx || state.musicPlaying) return;
    state.musicPlaying = true;

    let audioCtx = state.audioCtx;

    // Compressor to prevent clipping
    let compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 10;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    compressor.connect(audioCtx.destination);

    // Master gain (lower to prevent clipping)
    let master = audioCtx.createGain();
    master.gain.value = 0.18;
    master.connect(compressor);

    // Warm filter
    let filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 1;
    filter.connect(master);

    // === LAYER 1: Ambient pad ===
    let padGain = audioCtx.createGain();
    padGain.gain.value = 0.1;
    padGain.connect(filter);

    let padOscs = [55, 82.41, 110].map(freq => {
        let osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(padGain);
        osc.start();
        return osc;
    });

    // === LAYER 2: Slow pulsing bass ===
    let bassGain = audioCtx.createGain();
    bassGain.gain.value = 0;
    bassGain.connect(master);

    let bassOsc = audioCtx.createOscillator();
    bassOsc.type = 'triangle';
    bassOsc.frequency.value = 55;
    bassOsc.connect(bassGain);
    bassOsc.start();

    let bassLFO = audioCtx.createOscillator();
    let bassLFOGain = audioCtx.createGain();
    bassLFO.type = 'sine';
    bassLFO.frequency.value = 0.5;
    bassLFOGain.gain.value = 0;
    bassLFO.connect(bassLFOGain);
    bassLFOGain.connect(bassGain.gain);
    bassLFO.start();

    // === LAYER 3: Arpeggio ===
    let arpGain = audioCtx.createGain();
    arpGain.gain.value = 0;
    let arpFilter = audioCtx.createBiquadFilter();
    arpFilter.type = 'lowpass';
    arpFilter.frequency.value = 1200;
    arpFilter.Q.value = 2;
    arpGain.connect(arpFilter);
    arpFilter.connect(master);

    let arpOsc = audioCtx.createOscillator();
    arpOsc.type = 'sawtooth';
    arpOsc.frequency.value = 220;
    arpOsc.connect(arpGain);
    arpOsc.start();

    // === LAYER 4: High pad ===
    let highGain = audioCtx.createGain();
    highGain.gain.value = 0;
    highGain.connect(filter);

    let highOscs = [440, 554.37, 659.25].map(freq => {
        let osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(highGain);
        osc.start();
        return osc;
    });

    // === LAYER 5: Rhythmic tick ===
    let tickGain = audioCtx.createGain();
    tickGain.gain.value = 0;
    tickGain.connect(master);

    let tickOsc = audioCtx.createOscillator();
    tickOsc.type = 'square';
    tickOsc.frequency.value = 880;
    tickOsc.connect(tickGain);
    tickOsc.start();

    state.musicNodes = {
        master, filter, padGain, padOscs,
        bassGain, bassOsc, bassLFO, bassLFOGain,
        arpGain, arpOsc, arpFilter,
        highGain, highOscs,
        tickGain, tickOsc
    };

    // Start sequencers
    runArpSequencer();
    runTickSequencer();
    setMusicIntensity(0.05);
}

// Arpeggio sequencer
function runArpSequencer() {
    if (state.arpRunning) return;
    state.arpRunning = true;

    let patterns = [
        [220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63],
        [220, 329.63, 440, 523.25, 440, 329.63, 261.63, 220],
        [440, 392, 329.63, 293.66, 261.63, 293.66, 329.63, 392],
    ];
    let patternIdx = 0;
    let noteIdx = 0;
    let bpm = 130;
    let stepTime = 60 / bpm / 2;

    function step() {
        if (!state.musicPlaying) { state.arpRunning = false; return; }
        let t = state.audioCtx.currentTime;
        let { arpOsc, arpGain } = state.musicNodes;

        // Use tracked intensity instead of reading gain.value
        if ((state.musicIntensity || 0) > 0.3) {
            let pattern = patterns[patternIdx % patterns.length];
            let note = pattern[noteIdx % pattern.length];
            arpOsc.frequency.setValueAtTime(note, t);

            let targetVol = Math.max(0, (state.musicIntensity - 0.3) * 0.06);
            arpGain.gain.setValueAtTime(targetVol * 1.3, t);
            arpGain.gain.setTargetAtTime(targetVol, t + stepTime * 0.3, 0.05);
        }

        noteIdx++;
        if (noteIdx >= 8) {
            noteIdx = 0;
            if (Math.random() < 0.3) patternIdx++;
        }
        setTimeout(step, stepTime * 1000);
    }
    step();
}

// Tick sequencer
function runTickSequencer() {
    if (state.tickRunning) return;
    state.tickRunning = true;

    let bpm = 130;
    let beatTime = 60 / bpm;
    let subBeat = 0;

    function tick() {
        if (!state.musicPlaying) { state.tickRunning = false; return; }
        let t = state.audioCtx.currentTime;
        let { tickGain } = state.musicNodes;

        // Use tracked intensity
        if ((state.musicIntensity || 0) > 0.4) {
            let targetVol = Math.max(0, (state.musicIntensity - 0.4) * 0.025);
            let accent = (subBeat % 4 === 0) ? 1.5 : (subBeat % 4 === 2 ? 1.0 : 0.4);
            let vol = targetVol * accent;
            tickGain.gain.setValueAtTime(vol, t);
            tickGain.gain.setTargetAtTime(0.001, t + 0.02, 0.01);
            tickGain.gain.setTargetAtTime(targetVol * 0.3, t + beatTime * 0.4, 0.05);
        }

        subBeat++;
        setTimeout(tick, (beatTime / 2) * 1000);
    }
    tick();
}

// Intensity 0.0 to 1.0
export function setMusicIntensity(intensity) {
    if (!state.musicNodes.master) return;
    state.musicIntensity = intensity; // Track for sequencers
    let t = state.audioCtx.currentTime;
    let ramp = 4.0; // Slower transitions to avoid jarring changes

    // Pad: always present, grows gently
    state.musicNodes.padGain.gain.setTargetAtTime(0.06 + intensity * 0.04, t, ramp);

    // Bass pulse: fades in at 10% (very early, subtle)
    let bassVol = Math.max(0, (intensity - 0.1) * 0.08);
    state.musicNodes.bassGain.gain.setTargetAtTime(0.03 + bassVol, t, ramp);
    state.musicNodes.bassLFOGain.gain.setTargetAtTime(bassVol * 0.4, t, ramp);
    state.musicNodes.bassLFO.frequency.setTargetAtTime(0.3 + intensity * 0.6, t, ramp);

    // Arpeggio: fades in at 35% (mid waves)
    let arpVol = Math.max(0, (intensity - 0.35) * 0.04);
    state.musicNodes.arpGain.gain.setTargetAtTime(arpVol, t, ramp);
    state.musicNodes.arpFilter.frequency.setTargetAtTime(800 + intensity * 1500, t, ramp);

    // High pad: fades in at 55%
    let highVol = Math.max(0, (intensity - 0.55) * 0.025);
    state.musicNodes.highGain.gain.setTargetAtTime(highVol, t, ramp);

    // Tick: fades in at 60% (only final waves / high levels)
    let tickVol = Math.max(0, (intensity - 0.6) * 0.015);
    state.musicNodes.tickGain.gain.setTargetAtTime(tickVol, t, ramp);

    // Main filter opens gradually
    state.musicNodes.filter.frequency.setTargetAtTime(500 + intensity * 2000, t, ramp);
}

export function updateMusicForWave() {
    let waveProgress = state.currentWave / state.wavesPerLevel;
    let levelFactor = Math.min(state.currentLevel / 25, 1);
    // Smoother curve: each wave adds ~0.12 intensity
    let intensity = waveProgress * 0.5 + levelFactor * 0.4;
    if (state.currentWave === state.wavesPerLevel) intensity = Math.min(1, intensity + 0.15);
    setMusicIntensity(Math.min(1, intensity));
}

export function toggleMusic() {
    state.musicMuted = !state.musicMuted;
    if (state.musicNodes.master) {
        state.musicNodes.master.gain.setTargetAtTime(state.musicMuted ? 0 : 0.18, state.audioCtx.currentTime, 0.5);
    }
    document.getElementById('musicBtn').textContent = state.musicMuted ? '♫ OFF' : '♫ ON';
    document.getElementById('musicBtn').classList.toggle('active', !state.musicMuted);
}

export function toggleSfx() {
    state.sfxMuted = !state.sfxMuted;
    document.getElementById('sfxBtn').textContent = state.sfxMuted ? 'SFX OFF' : 'SFX ON';
    document.getElementById('sfxBtn').classList.toggle('active', !state.sfxMuted);
}

export function playSound(type) {
    if (!state.audioCtx || state.sfxMuted) return;
    try {
        let audioCtx = state.audioCtx;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const t = audioCtx.currentTime;

        switch (type) {
            case 'laser':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(900, t);
                osc.frequency.exponentialRampToValueAtTime(300, t + 0.08);
                gain.gain.setValueAtTime(0.025, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
                osc.start(t); osc.stop(t + 0.08);
                break;
            case 'rocket':
                osc.type = 'square';
                osc.frequency.setValueAtTime(120, t);
                osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
                gain.gain.setValueAtTime(0.035, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                osc.start(t); osc.stop(t + 0.15);
                break;
            case 'beam':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1400, t);
                osc.frequency.exponentialRampToValueAtTime(700, t + 0.12);
                gain.gain.setValueAtTime(0.03, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
                osc.start(t); osc.stop(t + 0.12);
                break;
            case 'freeze':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(500, t);
                osc.frequency.exponentialRampToValueAtTime(1000, t + 0.08);
                gain.gain.setValueAtTime(0.02, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
                osc.start(t); osc.stop(t + 0.08);
                break;
            case 'explosion': {
                const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
                const d = buf.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
                const src = audioCtx.createBufferSource();
                src.buffer = buf;
                const g = audioCtx.createGain();
                g.gain.setValueAtTime(0.05, t);
                g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                src.connect(g); g.connect(audioCtx.destination);
                src.start(t); src.stop(t + 0.15);
                return;
            }
            case 'levelup':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, t);
                osc.frequency.linearRampToValueAtTime(800, t + 0.2);
                osc.frequency.linearRampToValueAtTime(1200, t + 0.4);
                gain.gain.setValueAtTime(0.04, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
                osc.start(t); osc.stop(t + 0.4);
                break;
            case 'death':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, t);
                osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);
                gain.gain.setValueAtTime(0.05, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
            case 'wave':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(300, t);
                osc.frequency.exponentialRampToValueAtTime(600, t + 0.2);
                gain.gain.setValueAtTime(0.04, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
        }
    } catch (e) {}
}
