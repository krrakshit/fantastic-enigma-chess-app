/**
 * Chess Arena — Sound Effects System
 *
 * Uses the Web Audio API to synthesize all game sounds procedurally.
 * No external audio files needed — all sounds are generated at runtime.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function isMuted(): boolean {
  return localStorage.getItem("chess_sound_muted") === "true";
}

export function setMuted(muted: boolean) {
  localStorage.setItem("chess_sound_muted", muted ? "true" : "false");
}

export function getMuted(): boolean {
  return isMuted();
}

// ── Synth helpers ──────────────────────────────────────────────────────────────

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.15) {
  if (isMuted()) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.08) {
  if (isMuted()) return;
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

// ── Sound effects ──────────────────────────────────────────────────────────────

/** Normal piece placement sound — soft wooden "tap" */
export function playMove() {
  playNoise(0.08, 0.12);
  playTone(800, 0.06, "sine", 0.06);
}

/** Capture sound — sharper knock */
export function playCapture() {
  playNoise(0.12, 0.2);
  playTone(400, 0.1, "triangle", 0.12);
  playTone(250, 0.08, "square", 0.04);
}

/** Check notification — two quick high tones */
export function playCheck() {
  playTone(880, 0.12, "triangle", 0.15);
  setTimeout(() => playTone(1100, 0.15, "triangle", 0.12), 80);
}

/** Castling — sliding + placement */
export function playCastle() {
  playNoise(0.06, 0.08);
  setTimeout(() => playNoise(0.06, 0.1), 60);
  playTone(600, 0.1, "sine", 0.06);
}

/** Pawn promotion — ascending arpeggio */
export function playPromotion() {
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.15, "sine", 0.1), i * 60);
  });
}

/** Game start — bright ascending chord */
export function playGameStart() {
  [523, 659, 784].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.25, "triangle", 0.1), i * 80);
  });
}

/** Game over — descending minor chord */
export function playGameEnd() {
  [784, 622, 523].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.3, "sine", 0.1), i * 120);
  });
}

/** Victory fanfare */
export function playVictory() {
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.3, "triangle", 0.12), i * 100);
  });
}

/** Defeat sound — somber descending */
export function playDefeat() {
  [440, 370, 330, 262].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.35, "sine", 0.08), i * 130);
  });
}

/** Notification ping — for chat messages and draw offers */
export function playNotify() {
  playTone(1200, 0.1, "sine", 0.08);
  setTimeout(() => playTone(1500, 0.15, "sine", 0.06), 60);
}

/** Low time warning tick */
export function playClockTick() {
  playTone(1000, 0.04, "square", 0.06);
}

/** Error buzz */
export function playError() {
  playTone(200, 0.15, "sawtooth", 0.06);
  setTimeout(() => playTone(180, 0.15, "sawtooth", 0.05), 50);
}

/**
 * Determine which sound to play based on a chess.js Move result.
 * Call this after successfully applying a move.
 */
export function playSoundForMove(move: {
  captured?: string;
  san?: string;
  flags?: string;
  promotion?: string;
}, isCheck: boolean) {
  if (move.promotion) {
    playPromotion();
  } else if (isCheck) {
    playCheck();
  } else if (move.san?.includes("O-O") || move.flags?.includes("k") || move.flags?.includes("q")) {
    playCastle();
  } else if (move.captured) {
    playCapture();
  } else {
    playMove();
  }
}
