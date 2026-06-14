// Sound effects synthesized via Web Audio API. No external assets — keeps the
// single-file build small and avoids needing to inline base64 audio.

import { loadMute, saveMute } from './save';

type SoundName = 'coin' | 'walkby' | 'grumble' | 'praise' | 'bell' | 'cashier' | 'lowstock';

let ctx: AudioContext | null = null;
let muted = loadMute();

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx === null) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

function envelope(
  gain: GainNode,
  attack: number,
  decay: number,
  peak: number,
  startTime: number,
): void {
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + attack + decay);
}

function blip(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  peak = 0.2,
): void {
  const c = getCtx();
  if (!c || muted) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.connect(gain).connect(c.destination);
  envelope(gain, 0.005, duration, peak, now);
  osc.start(now);
  osc.stop(now + duration + 0.05);
}

const SOUND_PLAYERS: Record<SoundName, () => void> = {
  coin: () => {
    // Two-tone bright chime
    blip(880, 0.12, 'square', 0.15);
    setTimeout(() => blip(1320, 0.14, 'square', 0.13), 70);
  },
  walkby: () => {
    // Soft low whoosh
    const c = getCtx();
    if (!c || muted) return;
    const now = c.currentTime;
    const noise = c.createBufferSource();
    const buf = c.createBuffer(1, c.sampleRate * 0.2, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    noise.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const gain = c.createGain();
    noise.connect(filter).connect(gain).connect(c.destination);
    envelope(gain, 0.02, 0.18, 0.08, now);
    noise.start(now);
    noise.stop(now + 0.25);
  },
  grumble: () => {
    // Descending low buzz
    const c = getCtx();
    if (!c || muted) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.2);
    osc.connect(gain).connect(c.destination);
    envelope(gain, 0.01, 0.2, 0.1, now);
    osc.start(now);
    osc.stop(now + 0.3);
  },
  praise: () => {
    // Gentle rising major arpeggio (D5–F#5–A5) — a warm "they liked it" cue for
    // a satisfied buyer's walk-off reaction. Mellow triangle tone keeps it
    // clearly positive yet distinct from the coin's bright square money chime.
    blip(587, 0.12, 'triangle', 0.12);
    setTimeout(() => blip(740, 0.12, 'triangle', 0.12), 70);
    setTimeout(() => blip(880, 0.16, 'triangle', 0.11), 140);
  },
  bell: () => {
    blip(1568, 0.4, 'sine', 0.2);
    setTimeout(() => blip(2093, 0.5, 'sine', 0.15), 60);
  },
  cashier: () => {
    blip(660, 0.06, 'square', 0.12);
    setTimeout(() => blip(440, 0.08, 'square', 0.12), 40);
  },
  lowstock: () => {
    // Gentle two-note descending "running low" alert
    blip(784, 0.14, 'triangle', 0.16);
    setTimeout(() => blip(587, 0.18, 'triangle', 0.16), 130);
  },
};

export function play(name: SoundName): void {
  // Resume on user gesture (browsers suspend AudioContext until interaction)
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  SOUND_PLAYERS[name]();
}

export function setMuted(m: boolean): void {
  muted = m;
  saveMute(m);
}

export function isMuted(): boolean {
  return muted;
}
