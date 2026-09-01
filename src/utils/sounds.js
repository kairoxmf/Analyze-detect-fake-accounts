/** Ambient sound effects for gamification events */
const Ctx = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;

const playTone = (freq, duration = 0.15, type = "sine", gain = 0.08) => {
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    setTimeout(() => ctx.close().catch(() => {}), 400);
  } catch {}
};

export const sounds = {
  badge: () => {
    playTone(523, 0.12);
    setTimeout(() => playTone(659, 0.12), 80);
    setTimeout(() => playTone(784, 0.2), 160);
  },
  approval: () => {
    playTone(587, 0.1);
    setTimeout(() => playTone(784, 0.15), 100);
  },
  clanJoin: () => {
    playTone(440, 0.1);
    setTimeout(() => playTone(554, 0.1), 80);
    setTimeout(() => playTone(659, 0.15), 160);
  },
  levelUp: () => {
    playTone(523, 0.1);
    setTimeout(() => playTone(659, 0.1), 80);
    setTimeout(() => playTone(784, 0.1), 160);
    setTimeout(() => playTone(1047, 0.25), 240);
  },
  success: () => playTone(784, 0.2),
  error: () => {
    playTone(200, 0.15, "sawtooth", 0.05);
    setTimeout(() => playTone(180, 0.2, "sawtooth", 0.04), 100);
  },
  click: () => playTone(600, 0.05, "sine", 0.03),
};
