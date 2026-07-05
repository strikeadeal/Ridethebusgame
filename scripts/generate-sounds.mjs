// Synthesizes the game's sound effects as small mono WAVs into public/sounds/.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RATE = 22050;
const OUT = path.resolve('public/sounds');

function wav(samples) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const buffer = (duration) => new Float64Array(Math.floor(RATE * duration));

function addTone(buf, { freq, start = 0, dur, gain = 0.4, shape = 'sine' }) {
  const from = Math.floor(start * RATE);
  const n = Math.floor(dur * RATE);
  for (let i = 0; i < n && from + i < buf.length; i++) {
    const t = i / RATE;
    const env = Math.min(1, t * 200) * Math.exp(-4 * (t / dur)); // fast attack, exponential decay
    const phase = 2 * Math.PI * freq * t;
    const v = shape === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
    buf[from + i] += v * env * gain;
  }
}

function addNoise(buf, { start = 0, dur, gain = 0.3 }) {
  const from = Math.floor(start * RATE);
  const n = Math.floor(dur * RATE);
  let last = 0;
  for (let i = 0; i < n && from + i < buf.length; i++) {
    const env = Math.exp(-8 * (i / RATE / dur));
    last = 0.6 * last + 0.4 * (Math.random() * 2 - 1); // one-pole low-pass: paper, not static
    buf[from + i] += last * env * gain;
  }
}

const sounds = {
  // Card leaves the deck: soft paper swish.
  deal() { const b = buffer(0.12); addNoise(b, { dur: 0.12, gain: 0.5 }); return b; },
  // Pyramid card turn: short snap.
  flip() { const b = buffer(0.1); addNoise(b, { dur: 0.06, gain: 0.35 }); addTone(b, { freq: 1200, dur: 0.05, gain: 0.15 }); return b; },
  // Right guess: two-note upward chime.
  correct() { const b = buffer(0.35); addTone(b, { freq: 659, dur: 0.15, shape: 'triangle' }); addTone(b, { freq: 880, start: 0.09, dur: 0.25, shape: 'triangle' }); return b; },
  // Wrong guess: low thud.
  wrong() { const b = buffer(0.4); addTone(b, { freq: 147, dur: 0.35, gain: 0.55 }); addTone(b, { freq: 110, start: 0.02, dur: 0.35, gain: 0.35 }); return b; },
  // Entering the pyramid.
  rowAdvance() { const b = buffer(0.3); addTone(b, { freq: 523, dur: 0.22, shape: 'triangle' }); return b; },
  // The bus rider is revealed: three rising notes.
  busStart() { const b = buffer(0.55); addTone(b, { freq: 392, dur: 0.16 }); addTone(b, { freq: 494, start: 0.14, dur: 0.16 }); addTone(b, { freq: 587, start: 0.28, dur: 0.25 }); return b; },
  // Game over: short arpeggio.
  fanfare() { const b = buffer(1.0); [440, 554, 659, 880].forEach((f, i) => addTone(b, { freq: f, start: i * 0.13, dur: 0.5, gain: 0.35, shape: 'triangle' })); return b; },
};

mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(sounds)) {
  writeFileSync(path.join(OUT, `${name}.wav`), wav(make()));
  console.log(`wrote public/sounds/${name}.wav`);
}
