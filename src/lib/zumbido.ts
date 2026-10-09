'use client';
// El zumbido de MSN: sacude la pantalla, suena un bzzz sintetizado y vibra el celular.

import { audio, sonidoActivo } from './sonidos';

export const ZUMBIDO_COOLDOWN_MS = 15_000;

/** Llamar en un clic del usuario para que el navegador permita el sonido después. */
export function prepararSonido() {
  audio();
}

function bzzz() {
  if (!sonidoActivo()) return;
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
  out.gain.setValueAtTime(0.25, now + 0.55);
  out.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
  out.connect(ac.destination);

  // zumbido grave con "temblor" de volumen, como un celular vibrando sobre la mesa
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(95, now);
  osc.frequency.linearRampToValueAtTime(120, now + 0.75);
  const tremolo = ac.createGain();
  tremolo.gain.value = 0.5;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 28;
  const lfoDepth = ac.createGain();
  lfoDepth.gain.value = 0.5;
  lfo.connect(lfoDepth).connect(tremolo.gain);
  osc.connect(tremolo).connect(out);
  osc.start(now);
  lfo.start(now);
  osc.stop(now + 0.8);
  lfo.stop(now + 0.8);
}

/** Lo que siente quien recibe el zumbido. */
export function recibirZumbido() {
  bzzz();
  try {
    navigator.vibrate?.([120, 60, 120, 60, 240]);
  } catch {
    /* sin vibración */
  }
  const body = document.body;
  body.classList.remove('zumbido');
  void body.offsetWidth; // reinicia la animación si llegan dos seguidos
  body.classList.add('zumbido');
  setTimeout(() => body.classList.remove('zumbido'), 900);

  const original = document.title;
  if (!original.startsWith('¡Zumbido!')) {
    document.title = '¡Zumbido! · ' + original;
    setTimeout(() => (document.title = original), 4000);
  }
}
