// Sound effects, synthesized live with the Web Audio API (no audio files to load or license).
// Everything goes through one master gain + compressor. Volume / mute persist in localStorage.
// Browsers only allow audio after a user gesture, so the context is created on the first click.

const KEY = 'bt-sfx';
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
let volume = saved.volume ?? 0.6, muted = !!saved.muted;
let ctx = null, master = null, noiseBuf = null;
const listeners = new Set();

function persist() { try { localStorage.setItem(KEY, JSON.stringify({ volume, muted })); } catch {} for (const f of listeners) f(); }
export const getVolume = () => volume;
export const isMuted = () => muted;
export function setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (master) master.gain.value = muted ? 0 : volume; persist(); }
export function setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : volume; persist(); }
export function onSettings(fn) { listeners.add(fn); }

function ensure() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
  master = ctx.createGain(); master.gain.value = muted ? 0 : volume;
  master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
if (typeof window !== 'undefined') for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => ensure(), { capture: true });
const ready = () => ctx && ctx.state === 'running' && !muted && volume > 0;

// Don't stack dozens of the same sound in one instant (e.g. an LMG burst or the Skip button).
const lastAt = {};
function gate(name, ms) { const now = performance.now(); if (now - (lastAt[name] || 0) < ms) return false; lastAt[name] = now; return true; }

// ---------- building blocks ----------
function env(g, t, a, peak, dec, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + dec);
}
function noise(t, dur, { type = 'bandpass', f = 1200, f2, q = 1, gain = 0.5, a = 0.002, pan = 0 } = {}) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.setValueAtTime(f, t); if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + dur); flt.Q.value = q;
  const g = ctx.createGain(); env(g, t, a, gain, dur);
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  src.connect(flt); flt.connect(g); g.connect(p); p.connect(master);
  src.start(t, Math.random()); src.stop(t + a + dur + 0.05);
}
function tone(t, dur, { type = 'sine', f = 440, f2, gain = 0.3, a = 0.004, pan = 0, detune = 0 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + dur); o.detune.value = detune;
  const g = ctx.createGain(); env(g, t, a, gain, dur);
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  o.connect(g); g.connect(p); p.connect(master);
  o.start(t); o.stop(t + a + dur + 0.05);
}
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- weapons ----------
// Each fire sound: a filtered noise crack + a low body thump. `far` = enemy fire (a bit duller/quieter).
const GUN = {
  pistol:  { f: 2200, dur: 0.12, body: 150, bodyGain: 0.25, gain: 0.45 },
  smg:     { f: 2600, dur: 0.07, body: 170, bodyGain: 0.15, gain: 0.32 },
  carbine: { f: 2000, dur: 0.11, body: 130, bodyGain: 0.25, gain: 0.45 },
  rifle:   { f: 1700, dur: 0.16, body: 110, bodyGain: 0.32, gain: 0.5 },
  lmg:     { f: 1500, dur: 0.1,  body: 100, bodyGain: 0.3,  gain: 0.42 },
  sniper:  { f: 3200, dur: 0.45, body: 80,  bodyGain: 0.45, gain: 0.6 },
  shotgun: { f: 900,  dur: 0.28, body: 70,  bodyGain: 0.55, gain: 0.6 },
};
export function shot(type, { hit = true, crit = false, enemy = false } = {}) {
  if (!ready() || !gate('shot:' + type, type === 'lmg' || type === 'smg' ? 45 : 70)) return;
  const t = ctx.currentTime + 0.005, pan = rnd(-0.5, 0.5), lvl = enemy ? 0.7 : 1;
  const g = GUN[type];
  if (g) {
    noise(t, g.dur, { type: 'bandpass', f: g.f * (enemy ? 0.75 : 1) * rnd(0.9, 1.1), f2: 300, q: 0.7, gain: g.gain * lvl, pan });
    tone(t, g.dur * 0.8, { f: g.body, f2: 40, gain: g.bodyGain * lvl, pan });
    if (type === 'sniper') noise(t + 0.05, 0.6, { type: 'lowpass', f: 900, f2: 150, gain: 0.12 * lvl, a: 0.03, pan });
  } else if (type === 'arc' || type === 'beam') {
    tone(t, 0.16, { type: 'sawtooth', f: type === 'beam' ? 2400 : 1600, f2: 180, gain: 0.16 * lvl, pan });
    tone(t, 0.16, { type: 'square', f: type === 'beam' ? 2420 : 1612, f2: 190, gain: 0.08 * lvl, pan, detune: 20 });
  } else if (type === 'flamer') {
    noise(t, 0.35, { type: 'lowpass', f: 1800, f2: 500, gain: 0.35 * lvl, a: 0.04, pan });
  } else if (type === 'blade' || type === 'claws') {
    noise(t, 0.12, { type: 'highpass', f: 2500, f2: 6000, gain: 0.3 * lvl, a: 0.01, pan });
  } else if (type === 'spit') {
    noise(t, 0.18, { type: 'lowpass', f: 900, f2: 300, q: 4, gain: 0.35, pan }); tone(t, 0.12, { f: 500, f2: 120, gain: 0.15, pan });
  } else if (type === 'scream') {
    if (!gate('scream', 300)) return;
    for (const d of [-30, 0, 35]) tone(t, 0.5, { type: 'sawtooth', f: 520, f2: 260, gain: 0.07, a: 0.05, pan, detune: d });
  } else return;
  if (hit && crit) tone(t + 0.03, 0.08, { type: 'square', f: 1800, f2: 900, gain: 0.08, pan });
}

// ---------- events ----------
export function boom(big = false) {
  if (!ready() || !gate('boom', 120)) return;
  const t = ctx.currentTime + 0.005, pan = rnd(-0.3, 0.3);
  noise(t, big ? 1.1 : 0.7, { type: 'lowpass', f: 1400, f2: 60, gain: big ? 0.9 : 0.7, a: 0.004, pan });
  tone(t, big ? 0.9 : 0.6, { f: 90, f2: 28, gain: big ? 0.8 : 0.6, pan });
}
export function alarm(level) {
  if (!ready() || !gate('alarm', 1500)) return;
  const t = ctx.currentTime + 0.01, n = level >= 2 ? 3 : 1;
  for (let i = 0; i < n; i++) { tone(t + i * 0.5, 0.22, { type: 'square', f: 880, gain: 0.07 }); tone(t + i * 0.5 + 0.25, 0.22, { type: 'square', f: 660, gain: 0.07 }); }
}
export function down() {
  if (!ready() || !gate('down', 200)) return;
  const t = ctx.currentTime + 0.005;
  tone(t, 0.35, { f: 120, f2: 45, gain: 0.5 }); tone(t + 0.05, 0.5, { type: 'triangle', f: 330, f2: 160, gain: 0.12 });
}
export function enemyDown() { if (!ready() || !gate('edown', 90)) return; const t = ctx.currentTime + 0.005; tone(t, 0.15, { f: 160, f2: 60, gain: 0.25 }); noise(t, 0.08, { type: 'lowpass', f: 700, gain: 0.15 }); }
export function heal() { if (!ready() || !gate('heal', 250)) return; const t = ctx.currentTime + 0.01; [660, 880, 1320].forEach((f, i) => tone(t + i * 0.06, 0.18, { type: 'triangle', f, gain: 0.08 })); }
export function revive() { if (!ready() || !gate('revive', 300)) return; const t = ctx.currentTime + 0.01; tone(t, 0.35, { type: 'triangle', f: 330, f2: 990, gain: 0.12 }); tone(t + 0.25, 0.3, { type: 'sine', f: 1320, gain: 0.08 }); }
export function teleport() { if (!ready() || !gate('tele', 200)) return; const t = ctx.currentTime + 0.01; tone(t, 0.45, { type: 'sine', f: 300, f2: 2400, gain: 0.12 }); noise(t, 0.45, { type: 'bandpass', f: 600, f2: 6000, q: 3, gain: 0.12, a: 0.05 }); }
export function objective(big = false) {
  if (!ready()) return;
  const t = ctx.currentTime + 0.02, notes = big ? [523, 659, 784, 1047] : [784, 1047];
  notes.forEach((f, i) => { tone(t + i * 0.11, big ? 0.35 : 0.2, { type: 'triangle', f, gain: 0.12 }); tone(t + i * 0.11, big ? 0.35 : 0.2, { type: 'square', f: f / 2, gain: 0.03 }); });
}
export function retreat() { if (!ready()) return; const t = ctx.currentTime + 0.01; [784, 622, 494].forEach((f, i) => tone(t + i * 0.16, 0.22, { type: 'square', f, gain: 0.07 })); }
export function hatch() { if (!ready() || !gate('hatch', 200)) return; const t = ctx.currentTime + 0.01; noise(t, 0.4, { type: 'lowpass', f: 500, f2: 120, q: 6, gain: 0.45 }); tone(t, 0.3, { f: 220, f2: 70, gain: 0.25 }); }
export function sizzle() { if (!ready() || !gate('sizzle', 200)) return; const t = ctx.currentTime + 0.01; noise(t, 0.5, { type: 'highpass', f: 3000, gain: 0.2, a: 0.02 }); }
export function fire() { if (!ready() || !gate('fire', 500)) return; const t = ctx.currentTime + 0.01; noise(t, 0.9, { type: 'lowpass', f: 1200, f2: 400, gain: 0.3, a: 0.08 }); }
export function gravity(mode) { if (!ready()) return; const t = ctx.currentTime + 0.01; tone(t, 0.9, { type: 'sawtooth', f: mode === 'zero' ? 60 : mode === 'heavy' ? 140 : 90, f2: mode === 'zero' ? 220 : 40, gain: 0.14, a: 0.1 }); }
export function blip(good = true) { if (!ready() || !gate('blip', 150)) return; const t = ctx.currentTime + 0.01; tone(t, 0.07, { type: 'square', f: good ? 1200 : 400, gain: 0.06 }); tone(t + 0.08, 0.07, { type: 'square', f: good ? 1600 : 300, gain: 0.06 }); }
export function spores() { if (!ready() || !gate('spores', 400)) return; const t = ctx.currentTime + 0.01; noise(t, 0.6, { type: 'bandpass', f: 400, f2: 1500, q: 2, gain: 0.18, a: 0.15 }); }

// ---------- stingers + UI ----------
export function victory() { if (!ready()) return; const t = ctx.currentTime + 0.05; [392, 523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.12, i === 4 ? 0.8 : 0.25, { type: 'triangle', f, gain: 0.14 })); tone(t + 0.48, 0.9, { type: 'sine', f: 262, gain: 0.12 }); }
export function defeat() { if (!ready()) return; const t = ctx.currentTime + 0.05; [392, 349, 311, 262].forEach((f, i) => tone(t + i * 0.28, 0.5, { type: 'triangle', f, gain: 0.12 })); tone(t, 1.6, { type: 'sine', f: 98, gain: 0.15 }); }
export function gameOver() { if (!ready()) return; const t = ctx.currentTime + 0.05; [220, 208, 196, 147].forEach((f, i) => { tone(t + i * 0.45, 0.9, { type: 'sawtooth', f, gain: 0.06 }); tone(t + i * 0.45, 0.9, { type: 'sine', f: f / 2, gain: 0.14 }); }); }
export function levelUp() { if (!ready() || !gate('lvl', 400)) return; const t = ctx.currentTime + 0.05; [523, 659, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.07, 0.2, { type: 'square', f, gain: 0.05 })); }
export function packOpen(rare = false) {
  if (!ready()) return;
  const t = ctx.currentTime + 0.01;
  noise(t, 0.35, { type: 'bandpass', f: 800, f2: 5000, q: 1.5, gain: 0.25, a: 0.02 });
  [784, 988, 1175, 1568].forEach((f, i) => tone(t + 0.25 + i * 0.07, 0.3, { type: 'triangle', f, gain: 0.08 }));
  if (rare) [1568, 1976, 2349, 3136].forEach((f, i) => tone(t + 0.6 + i * 0.09, 0.5, { type: 'sine', f, gain: 0.07 }));
}
export function click() { if (!ready() || !gate('click', 40)) return; const t = ctx.currentTime; tone(t, 0.03, { type: 'square', f: 1400, f2: 900, gain: 0.025 }); }
export function coins() { if (!ready() || !gate('coins', 200)) return; const t = ctx.currentTime + 0.01; [1568, 2093].forEach((f, i) => tone(t + i * 0.07, 0.15, { type: 'square', f, gain: 0.04 })); }

// Low ship hum during mission playback. Returns a stop() function; stopHum() stops whatever is playing.
let humStop = null;
export function stopHum() { if (humStop) { humStop(); humStop = null; } }
export function hum() {
  stopHum();
  if (!ready()) return () => {};
  const t = ctx.currentTime, g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 1.5);
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'sine'; o1.frequency.value = 55; o2.frequency.value = 82.5;
  const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 180;
  o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(master); o1.start(); o2.start();
  let stopped = false;
  return humStop = () => { if (stopped) return; stopped = true; const n = ctx.currentTime; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), n); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.8); o1.stop(n + 0.9); o2.stop(n + 0.9); };
}
