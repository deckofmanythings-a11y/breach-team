// Pack-opening sounds (foil crinkle, rip, card snaps, build-ups and fanfares), synthesized live.
// Own AudioContext, but it follows the game's volume / mute settings in sfx.js. New file (stale-cache rule).
import { getVolume, isMuted } from './sfx.js';

let ctx = null, out = null, nb = null;
function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    out = ctx.createGain(); out.connect(comp); comp.connect(ctx.destination);
    nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  out.gain.value = isMuted() ? 0 : getVolume();
  return ctx.state === 'running' && !isMuted() && getVolume() > 0 ? ctx : null;
}
// Call from a pointer / key handler so the browser lets audio start.
export const unlock = () => { ac(); };

const lastAt = {};
function gate(name, ms) { const n = performance.now(); if (n - (lastAt[name] || 0) < ms) return false; lastAt[name] = n; return true; }

function noise(t, dur, { type = 'bandpass', f = 1200, f2, q = 1, gain = 0.3, a = 0.003 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f, t); if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(flt); flt.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function tone(t, dur, { type = 'sine', f = 440, f2, gain = 0.2, a = 0.005, detune = 0 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.detune.value = detune;
  o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}

// Foil being handled.
export function crinkle(amount = 1) {
  if (!ac() || !gate('crinkle', 45)) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 2 + Math.round(amount * 2); i++)
    noise(t + Math.random() * 0.05, 0.02 + Math.random() * 0.04, { type: 'highpass', f: 2500 + Math.random() * 5000, gain: 0.05 + Math.random() * 0.08 * amount, a: 0.002 });
}
// Progressive tear: a short rasp each time the tear advances.
export function tearBit() {
  if (!ac() || !gate('tear', 35)) return;
  const t = ctx.currentTime;
  noise(t, 0.07, { type: 'bandpass', f: 1800 + Math.random() * 2500, q: 0.8, gain: 0.16, a: 0.004 });
}
export function rip() {
  if (!ac()) return;
  const t = ctx.currentTime + 0.01;
  noise(t, 0.42, { type: 'bandpass', f: 900, f2: 5200, q: 0.9, gain: 0.5, a: 0.008 });
  noise(t + 0.02, 0.12, { type: 'highpass', f: 4000, gain: 0.3 });
  tone(t, 0.35, { f: 110, f2: 40, gain: 0.35 });
}
export function whoosh(up = true) {
  if (!ac()) return;
  const t = ctx.currentTime;
  noise(t, 0.32, { type: 'bandpass', f: up ? 400 : 2400, f2: up ? 2600 : 380, q: 1.2, gain: 0.22, a: 0.09 });
}
export function snap() {
  if (!ac()) return;
  const t = ctx.currentTime;
  tone(t, 0.04, { type: 'square', f: 2300, f2: 1100, gain: 0.07 });
  noise(t, 0.05, { type: 'highpass', f: 3500, gain: 0.18 });
}
// Tension before a big reveal: an accelerating drum roll and a rising tone.
export function build(ms, tier) {
  if (!ac()) return;
  const t0 = ctx.currentTime, dur = ms / 1000;
  let t = 0, gap = 0.16;
  while (t < dur) { noise(t0 + t, 0.06, { type: 'bandpass', f: 180 + t * 60, q: 2, gain: 0.18 + 0.25 * (t / dur), a: 0.002 }); gap = Math.max(0.035, gap * 0.9); t += gap; }
  tone(t0, dur, { type: 'sawtooth', f: 110, f2: 110 * (2 + tier), gain: 0.035, a: dur * 0.8 });
  tone(t0, dur, { type: 'sine', f: 220, f2: 220 * (2 + tier), gain: 0.06, a: dur * 0.8 });
  if (tier >= 3) tone(t0, dur, { type: 'triangle', f: 55, f2: 82, gain: 0.12, a: dur * 0.6 });
}
export function boom() {
  if (!ac()) return;
  const t = ctx.currentTime;
  tone(t, 0.9, { f: 130, f2: 32, gain: 0.55, a: 0.005 });
  noise(t, 0.7, { type: 'lowpass', f: 900, f2: 120, gain: 0.45 });
}
export function crackle() {
  if (!ac() || !gate('crackle', 60)) return;
  const t = ctx.currentTime;
  noise(t, 0.25, { type: 'lowpass', f: 1400, f2: 200, gain: 0.25 });
  for (let i = 0; i < 14; i++) noise(t + 0.08 + Math.random() * 0.7, 0.015, { type: 'highpass', f: 3000 + Math.random() * 4000, gain: 0.06 + Math.random() * 0.08, a: 0.001 });
}
export function coin() {
  if (!ac() || !gate('coin', 70)) return;
  const t = ctx.currentTime;
  [1568, 2093].forEach((f, i) => tone(t + i * 0.06, 0.16, { type: 'square', f, gain: 0.035 }));
}
// The celebration: every tier gets a fanfare, and each tier up adds more on top.
const N = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093, 2637, 3136];
export function fanfare(tier) {
  if (!ac()) return;
  const t = ctx.currentTime + 0.02;
  const steps = [4, 5, 6, 7, 9][tier];
  for (let i = 0; i < steps; i++) tone(t + i * 0.065, 0.32, { type: 'triangle', f: N[i] * (tier >= 4 ? 1 : 1), gain: 0.09 });
  const ct = t + steps * 0.065;
  [N[0], N[1], N[2], N[3]].forEach((f, i) => tone(ct, 0.6 + tier * 0.25, { type: tier >= 2 ? 'sawtooth' : 'triangle', f: f / 2, gain: tier >= 2 ? 0.03 : 0.05, detune: (i - 1.5) * 6 }));
  if (tier >= 1) for (let i = 0; i < 6 + tier * 4; i++) tone(ct + 0.05 + i * 0.05, 0.25, { f: N[3 + (i % 5)] * 1.5, gain: 0.035 });
  if (tier >= 3) {
    boom();
    // Second, higher brass chord.
    [N[3], N[4], N[5]].forEach((f, i) => tone(ct + 0.45, 1.6, { type: 'sawtooth', f: f / 2, gain: 0.03, a: 0.04, detune: (i - 1) * 7 }));
  }
  if (tier >= 4) {
    // A shimmering "choir" pad, detuned sines.
    [N[0], N[2], N[3], N[5]].forEach((f, i) => { for (const d of [-9, 0, 9]) tone(ct + 0.9, 2.6, { f, gain: 0.018, a: 0.5, detune: d + i }); });
    for (let i = 0; i < 9; i++) tone(ct + 1.0 + i * 0.07, 0.4, { type: 'triangle', f: N[8 - i], gain: 0.05 });
  }
}
export function keep() {
  if (!ac()) return;
  const t = ctx.currentTime;
  noise(t, 0.22, { type: 'bandpass', f: 2600, f2: 600, q: 1, gain: 0.14, a: 0.03 });
  tone(t + 0.12, 0.12, { type: 'square', f: 1760, gain: 0.03 });
}
