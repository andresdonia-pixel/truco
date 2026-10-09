'use client';
// Sonidos de mesa sintetizados con Web Audio: nada de archivos ni licencias.

let ctx: AudioContext | null = null;
const KEY = 'truco.sonido';
const listeners = new Set<(on: boolean) => void>();

export function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function sonidoActivo(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSonido(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* sin almacenamiento: queda sólo en esta pestaña */
  }
  listeners.forEach((l) => l(on));
}

export function onSonidoChange(l: (on: boolean) => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function ruido(ac: AudioContext, dur: number) {
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

/** Carta que cae sobre el paño: un "fsst" corto y filtrado. */
function carta(ac: AudioContext, at: number, vol = 0.35) {
  const src = ruido(ac, 0.09);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2200;
  bp.Q.value = 0.8;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.09);
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(at);
}

function tono(ac: AudioContext, freq: number, at: number, dur: number, vol = 0.18, type: OscillatorType = 'triangle') {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ac.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
}

export type Sonido = 'carta' | 'barajar' | 'canto' | 'victoria' | 'derrota' | 'mensaje';

export function sonar(s: Sonido) {
  if (!sonidoActivo()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  switch (s) {
    case 'carta':
      carta(ac, t);
      break;
    case 'barajar':
      for (let i = 0; i < 9; i++) carta(ac, t + i * 0.045 + Math.random() * 0.015, 0.18);
      break;
    case 'canto':
      tono(ac, 660, t, 0.18);
      tono(ac, 880, t + 0.09, 0.22);
      break;
    case 'mensaje':
      tono(ac, 990, t, 0.12, 0.08, 'sine');
      break;
    case 'victoria':
      [523, 659, 784, 1047].forEach((f, i) => tono(ac, f, t + i * 0.11, 0.35, 0.16));
      break;
    case 'derrota':
      [392, 330, 262].forEach((f, i) => tono(ac, f, t + i * 0.16, 0.4, 0.14, 'sine'));
      break;
  }
}
