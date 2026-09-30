/** Áudio 0.7: efeitos sintetizados em tempo real, sem arquivos externos.
 * Scripts pedem sons por nome (engine.sound / engine.loop); nada aqui é específico de um jogo. */
type Ctx = AudioContext;
interface ToneOptions {
  type?: OscillatorType;
  from: number;
  to?: number;
  dur: number;
  gain: number;
  attack?: number;
  filter?: { type: BiquadFilterType; from: number; to?: number; q?: number };
  detune?: number;
  delay?: number;
  vibrato?: { rate: number; depth: number };
}
interface NoiseOptions {
  dur: number;
  gain: number;
  filter?: { type: BiquadFilterType; from: number; to?: number; q?: number };
  attack?: number;
  rate?: number;
  delay?: number;
  tremolo?: { rate: number; depth: number };
}
class Synth {
  noiseBuffer: AudioBuffer | null = null;
  constructor(
    public ctx: Ctx,
    public out: AudioNode,
  ) {}
  private noiseSource(rate = 1) {
    this.noiseBuffer ??= (() => {
      const buffer = this.ctx.createBuffer(
        1,
        Math.floor(this.ctx.sampleRate * 2),
        this.ctx.sampleRate,
      );
      const data = buffer.getChannelData(0);
      let seed = 1234;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        data[i] = (seed / 0x3fffffff - 1) * 0.9;
      }
      return buffer;
    })();
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    source.playbackRate.value = rate;
    return source;
  }
  noise(options: NoiseOptions) {
    const t = this.ctx.currentTime + (options.delay ?? 0);
    const source = this.noiseSource(options.rate ?? 1);
    let node: AudioNode = source;
    if (options.filter) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = options.filter.type;
      filter.frequency.setValueAtTime(options.filter.from, t);
      if (options.filter.to)
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(20, options.filter.to),
          t + options.dur,
        );
      filter.Q.value = options.filter.q ?? 1;
      node.connect(filter);
      node = filter;
    }
    const gain = this.ctx.createGain();
    const attack = Math.min(options.attack ?? 0.005, options.dur * 0.5);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(options.gain, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + options.dur);
    node.connect(gain);
    let tail: AudioNode = gain;
    if (options.tremolo) {
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = options.tremolo.rate;
      const depth = this.ctx.createGain();
      depth.gain.value = options.tremolo.depth;
      lfo.connect(depth).connect(gain.gain);
      lfo.start(t);
      lfo.stop(t + options.dur);
      const shaped = this.ctx.createGain();
      shaped.gain.value = 1 - options.tremolo.depth;
      gain.connect(shaped);
      tail = shaped;
    }
    tail.connect(this.out);
    source.start(t);
    source.stop(t + options.dur + 0.02);
  }
  tone(options: ToneOptions) {
    const t = this.ctx.currentTime + (options.delay ?? 0);
    const osc = this.ctx.createOscillator();
    osc.type = options.type ?? "sine";
    osc.frequency.setValueAtTime(Math.max(20, options.from), t);
    if (options.to)
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, options.to),
        t + options.dur,
      );
    if (options.detune) osc.detune.value = options.detune;
    let node: AudioNode = osc;
    if (options.filter) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = options.filter.type;
      filter.frequency.setValueAtTime(options.filter.from, t);
      if (options.filter.to)
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(20, options.filter.to),
          t + options.dur,
        );
      filter.Q.value = options.filter.q ?? 1;
      node.connect(filter);
      node = filter;
    }
    const gain = this.ctx.createGain();
    const attack = Math.min(options.attack ?? 0.01, options.dur * 0.4);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(options.gain, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + options.dur);
    node.connect(gain).connect(this.out);
    if (options.vibrato) {
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = options.vibrato.rate;
      const depth = this.ctx.createGain();
      depth.gain.value = options.vibrato.depth;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + options.dur);
    }
    osc.start(t);
    osc.stop(t + options.dur + 0.02);
  }
}
type Recipe = (s: Synth, volume: number, pitch: number) => void;
const recipes: Record<string, Recipe> = {
  clique: (s, v) => s.noise({ dur: 0.04, gain: 0.35 * v, filter: { type: "highpass", from: 2400 } }),
  "porta.abrir": (s, v, p) => {
    const f = 220 * p;
    s.tone({ type: "sawtooth", from: f, to: f * 0.55, dur: 0.85, gain: 0.09 * v, filter: { type: "lowpass", from: 900, to: 380, q: 3 }, vibrato: { rate: 9, depth: 12 } });
    s.noise({ dur: 0.8, gain: 0.12 * v, filter: { type: "bandpass", from: 700 * p, to: 340, q: 2 }, tremolo: { rate: 7, depth: 0.5 } });
    s.tone({ type: "sine", from: 150, to: 60, dur: 0.22, gain: 0.18 * v, delay: 0.8, filter: { type: "lowpass", from: 400 } });
  },
  "porta.fechar": (s, v, p) => {
    s.noise({ dur: 0.14, gain: 0.3 * v, filter: { type: "lowpass", from: 900 * p, to: 300 } });
    s.tone({ type: "sine", from: 140 * p, to: 55, dur: 0.24, gain: 0.32 * v });
  },
  "porta.bater": (s, v, p) => {
    s.noise({ dur: 0.35, gain: 0.5 * v, filter: { type: "lowpass", from: 500 * p, to: 120 } });
    s.tone({ type: "sine", from: 95 * p, to: 38, dur: 0.6, gain: 0.6 * v });
    s.tone({ type: "triangle", from: 260, to: 90, dur: 0.3, gain: 0.2 * v, delay: 0.02 });
  },
  "porta.trancada": (s, v, p) => {
    for (let i = 0; i < 3; i++)
      s.noise({ dur: 0.05, gain: 0.3 * v, delay: i * 0.09, filter: { type: "bandpass", from: 1700 * p, q: 6 } });
    s.tone({ type: "square", from: 180, to: 120, dur: 0.12, gain: 0.1 * v, delay: 0.05 });
  },
  gaveta: (s, v, p) => {
    s.noise({ dur: 0.42, gain: 0.22 * v, filter: { type: "lowpass", from: 1400 * p, to: 700, q: 1.5 }, tremolo: { rate: 15, depth: 0.35 } });
    s.tone({ type: "sine", from: 120, to: 70, dur: 0.18, gain: 0.16 * v, delay: 0.4 });
  },
  armario: (s, v, p) => {
    s.noise({ dur: 0.5, gain: 0.2 * v, filter: { type: "bandpass", from: 380 * p, to: 950, q: 4 }, tremolo: { rate: 11, depth: 0.4 } });
    s.noise({ dur: 0.12, gain: 0.28 * v, delay: 0.46, filter: { type: "bandpass", from: 2100, q: 5 } });
  },
  item: (s, v, p) => {
    s.tone({ type: "sine", from: 880 * p, dur: 0.3, gain: 0.22 * v });
    s.tone({ type: "sine", from: 1320 * p, dur: 0.35, gain: 0.16 * v, delay: 0.06 });
  },
  moeda: (s, v, p) => {
    s.tone({ type: "triangle", from: 1568 * p, dur: 0.12, gain: 0.2 * v });
    s.tone({ type: "triangle", from: 2093 * p, dur: 0.22, gain: 0.16 * v, delay: 0.07 });
  },
  bateria: (s, v, p) => {
    s.tone({ type: "square", from: 320, to: 480, dur: 0.16, gain: 0.14 * v, filter: { type: "lowpass", from: 1800 } });
    s.tone({ type: "sine", from: 660 * p, dur: 0.2, gain: 0.12 * v, delay: 0.14 });
  },
  chave: (s, v, p) => {
    for (let i = 0; i < 4; i++)
      s.noise({ dur: 0.07, gain: 0.2 * v, delay: i * 0.06, filter: { type: "bandpass", from: 2600 * p, q: 8 } });
  },
  gazua: (s, v, p) => s.noise({ dur: 0.35, gain: 0.18 * v, filter: { type: "bandpass", from: 1800 * p, to: 3200, q: 7 }, tremolo: { rate: 22, depth: 0.5 } }),
  curativo: (s, v) => {
    s.noise({ dur: 0.35, gain: 0.16 * v, filter: { type: "highpass", from: 900 }, tremolo: { rate: 9, depth: 0.4 } });
    s.tone({ type: "sine", from: 420, to: 620, dur: 0.3, gain: 0.1 * v, delay: 0.1 });
  },
  lanterna: (s, v) => {
    s.noise({ dur: 0.03, gain: 0.3 * v, filter: { type: "highpass", from: 2000 } });
    s.tone({ type: "square", from: 900, to: 500, dur: 0.05, gain: 0.08 * v });
  },
  "lanterna.falha": (s, v) => {
    s.noise({ dur: 0.4, gain: 0.1 * v, filter: { type: "bandpass", from: 1200, q: 3 }, tremolo: { rate: 26, depth: 0.8 } });
    s.tone({ type: "sawtooth", from: 120, to: 90, dur: 0.4, gain: 0.05 * v, filter: { type: "lowpass", from: 700 } });
  },
  eletrico: (s, v, p) => {
    s.tone({ type: "sawtooth", from: 60 * p, dur: 0.35, gain: 0.09 * v, filter: { type: "lowpass", from: 900, q: 8 }, vibrato: { rate: 40, depth: 20 } });
    s.noise({ dur: 0.3, gain: 0.08 * v, filter: { type: "bandpass", from: 3000, q: 2 } });
  },
  "luz.estouro": (s, v) => {
    s.noise({ dur: 0.16, gain: 0.4 * v, filter: { type: "highpass", from: 3200 } });
    s.noise({ dur: 0.5, gain: 0.12 * v, delay: 0.1, filter: { type: "bandpass", from: 5200, q: 2 } });
    s.tone({ type: "sine", from: 90, to: 45, dur: 0.4, gain: 0.2 * v });
  },
  passo: (s, v, p) => {
    s.noise({ dur: 0.09, gain: 0.16 * v, filter: { type: "lowpass", from: 700 * p, to: 300 } });
    s.tone({ type: "sine", from: 120 * p, to: 70, dur: 0.1, gain: 0.1 * v });
  },
  corrida: (s, v, p) => {
    for (let i = 0; i < 3; i++) {
      s.noise({ dur: 0.08, gain: 0.17 * v, delay: i * 0.13, filter: { type: "lowpass", from: 800 * p, to: 320 } });
      s.tone({ type: "sine", from: 130 * p, to: 75, dur: 0.09, gain: 0.11 * v, delay: i * 0.13 });
    }
  },
  rugido: (s, v, p) => {
    const f = 78 * p;
    s.tone({ type: "sawtooth", from: f, to: f * 0.55, dur: 1.7, gain: 0.42 * v, filter: { type: "lowpass", from: 700, to: 220, q: 6 }, vibrato: { rate: 13, depth: 14 } });
    s.tone({ type: "square", from: f * 0.5, to: f * 0.3, dur: 1.8, gain: 0.2 * v, filter: { type: "lowpass", from: 400 } });
    s.noise({ dur: 1.7, gain: 0.24 * v, filter: { type: "bandpass", from: 320, to: 160, q: 2 }, tremolo: { rate: 17, depth: 0.6 } });
    s.tone({ type: "sine", from: 42, to: 30, dur: 1.9, gain: 0.3 * v });
  },
  ambush: (s, v, p) => {
    s.tone({ type: "sawtooth", from: 190 * p, to: 60, dur: 1.1, gain: 0.34 * v, filter: { type: "lowpass", from: 1200, to: 300, q: 5 }, vibrato: { rate: 19, depth: 26 } });
    s.noise({ dur: 1.2, gain: 0.22 * v, filter: { type: "bandpass", from: 700, to: 220, q: 2 }, tremolo: { rate: 12, depth: 0.65 } });
    s.tone({ type: "triangle", from: 300, to: 120, dur: 0.9, gain: 0.14 * v, delay: 0.15 });
  },
  screech: (s, v, p) => {
    s.tone({ type: "sawtooth", from: 2100 * p, to: 900, dur: 0.85, gain: 0.26 * v, filter: { type: "highpass", from: 700 }, vibrato: { rate: 32, depth: 120 } });
    s.noise({ dur: 0.8, gain: 0.2 * v, filter: { type: "highpass", from: 1800 }, tremolo: { rate: 24, depth: 0.5 } });
    s.tone({ type: "square", from: 1500, to: 600, dur: 0.6, gain: 0.1 * v, delay: 0.2 });
  },
  sussurro: (s, v, p) => s.noise({ dur: 1, gain: 0.16 * v, filter: { type: "bandpass", from: 1100 * p, to: 1500, q: 3 }, tremolo: { rate: 6, depth: 0.6 } }),
  olhos: (s, v, p) => {
    s.noise({ dur: 1.3, gain: 0.14 * v, filter: { type: "bandpass", from: 500 * p, to: 900, q: 2 }, tremolo: { rate: 4, depth: 0.55 } });
    s.tone({ type: "sine", from: 160, to: 90, dur: 1.4, gain: 0.1 * v, filter: { type: "lowpass", from: 500 } });
  },
  "figura.passo": (s, v, p) => {
    s.tone({ type: "sine", from: 62 * p, to: 30, dur: 0.5, gain: 0.5 * v });
    s.noise({ dur: 0.4, gain: 0.22 * v, filter: { type: "lowpass", from: 320, to: 120 } });
  },
  "figura.rugido": (s, v, p) => {
    s.tone({ type: "sawtooth", from: 58 * p, to: 40, dur: 2.1, gain: 0.34 * v, filter: { type: "lowpass", from: 320, q: 4 }, vibrato: { rate: 5, depth: 8 } });
    s.noise({ dur: 2.1, gain: 0.16 * v, filter: { type: "lowpass", from: 400, to: 180 }, tremolo: { rate: 7, depth: 0.5 } });
  },
  "seek.tambor": (s, v, p) => {
    s.tone({ type: "sine", from: 130 * p, to: 48, dur: 0.42, gain: 0.5 * v });
    s.noise({ dur: 0.12, gain: 0.24 * v, filter: { type: "bandpass", from: 220, q: 1.5 } });
    s.tone({ type: "triangle", from: 220, to: 90, dur: 0.2, gain: 0.14 * v });
  },
  "seek.grito": (s, v, p) => {
    s.tone({ type: "sawtooth", from: 620 * p, to: 1250, dur: 0.75, gain: 0.28 * v, vibrato: { rate: 14, depth: 90 }, filter: { type: "bandpass", from: 900, to: 2200, q: 3 } });
    s.noise({ dur: 0.7, gain: 0.18 * v, filter: { type: "highpass", from: 1200 }, tremolo: { rate: 18, depth: 0.5 } });
  },
  "seek.parede": (s, v, p) => {
    s.noise({ dur: 0.3, gain: 0.42 * v, filter: { type: "lowpass", from: 600 * p, to: 150 } });
    s.tone({ type: "sine", from: 110 * p, to: 45, dur: 0.5, gain: 0.4 * v });
  },
  halt: (s, v) => {
    for (let i = 0; i < 3; i++)
      s.tone({ type: "square", from: i % 2 ? 330 : 220, dur: 0.16, gain: 0.14 * v, delay: i * 0.14, filter: { type: "lowpass", from: 1500 } });
    s.noise({ dur: 0.5, gain: 0.12 * v, filter: { type: "bandpass", from: 1500, q: 4 } });
  },
  coracao: (s, v) => {
    s.tone({ type: "sine", from: 72, to: 38, dur: 0.28, gain: 0.42 * v, attack: 0.02 });
    s.tone({ type: "sine", from: 66, to: 34, dur: 0.26, gain: 0.3 * v, delay: 0.24, attack: 0.02 });
  },
  morte: (s, v) => {
    s.tone({ type: "triangle", from: 440, to: 180, dur: 1.1, gain: 0.24 * v });
    s.tone({ type: "sawtooth", from: 220, to: 70, dur: 1.4, gain: 0.18 * v, filter: { type: "lowpass", from: 900, to: 200 } });
    s.noise({ dur: 1.2, gain: 0.16 * v, delay: 0.1, filter: { type: "lowpass", from: 700, to: 120 } });
  },
  elevador: (s, v) => {
    s.tone({ type: "sine", from: 1046, dur: 0.9, gain: 0.2 * v, attack: 0.005 });
    s.tone({ type: "sine", from: 1568, dur: 1.1, gain: 0.14 * v, delay: 0.12 });
  },
  tremor: (s, v) => {
    s.noise({ dur: 2.4, gain: 0.3 * v, filter: { type: "lowpass", from: 220, to: 90 }, tremolo: { rate: 3, depth: 0.35 } });
    s.tone({ type: "sine", from: 46, to: 30, dur: 2.4, gain: 0.28 * v });
  },
  vento: (s, v) => s.noise({ dur: 2.6, gain: 0.16 * v, filter: { type: "bandpass", from: 520, to: 380, q: 1.2 }, tremolo: { rate: 0.6, depth: 0.4 } }),
  drone: (s, v) => {
    s.tone({ type: "sawtooth", from: 58, dur: 2.8, gain: 0.09 * v, filter: { type: "lowpass", from: 240 } });
    s.tone({ type: "sawtooth", from: 87, dur: 2.8, gain: 0.05 * v, detune: 12, filter: { type: "lowpass", from: 300 } });
  },
  vidro: (s, v) => {
    s.noise({ dur: 0.25, gain: 0.36 * v, filter: { type: "highpass", from: 3600 } });
    for (let i = 0; i < 4; i++)
      s.tone({ type: "triangle", from: 2400 + i * 700, to: 1600, dur: 0.24, gain: 0.08 * v, delay: 0.06 * i });
  },
  trovao: (s, v) => {
    s.noise({ dur: 2.6, gain: 0.36 * v, filter: { type: "lowpass", from: 900, to: 80 } });
    s.tone({ type: "sine", from: 60, to: 28, dur: 2.8, gain: 0.34 * v });
  },
  acerto: (s, v) => {
    s.noise({ dur: 0.18, gain: 0.3 * v, filter: { type: "lowpass", from: 800, to: 200 } });
    s.tone({ type: "sine", from: 160, to: 70, dur: 0.24, gain: 0.28 * v });
  },
  vitoria: (s, v) => {
    [523, 659, 784, 1046].forEach((f, i) =>
      s.tone({ type: "triangle", from: f, dur: 0.5, gain: 0.18 * v, delay: i * 0.16 }),
    );
  },
  aranha: (s, v, p) => {
    for (let i = 0; i < 6; i++)
      s.noise({ dur: 0.05, gain: 0.16 * v, delay: i * 0.055, filter: { type: "highpass", from: 3200 * p } });
    s.tone({ type: "square", from: 180 * p, to: 90, dur: 0.3, gain: 0.1 * v, delay: 0.34, filter: { type: "lowpass", from: 900 } });
  },
  susto: (s, v) => {
    s.noise({ dur: 0.5, gain: 0.34 * v, filter: { type: "highpass", from: 700, to: 4200 } });
    [180, 240, 150].forEach((f, i) =>
      s.tone({ type: "sawtooth", from: f, to: f * 1.6, dur: 0.34, gain: 0.26 * v, delay: i * 0.05 }),
    );
  },
  snare: (s, v) => {
    s.noise({ dur: 0.22, gain: 0.3 * v, filter: { type: "bandpass", from: 900, to: 2600, q: 3 } });
    s.tone({ type: "square", from: 420, to: 260, dur: 0.2, gain: 0.14 * v, filter: { type: "lowpass", from: 1600 } });
  },
  dupe: (s, v, p) => {
    s.tone({ type: "sine", from: 640 * p, to: 180, dur: 0.5, gain: 0.2 * v, vibrato: { rate: 12, depth: 30 } });
    s.noise({ dur: 0.4, gain: 0.1 * v, delay: 0.1, filter: { type: "bandpass", from: 1400, to: 500, q: 4 } });
  },
  vulto: (s, v) => {
    s.noise({ dur: 0.9, gain: 0.14 * v, filter: { type: "bandpass", from: 220, to: 1200, q: 1.6 }, tremolo: { rate: 6, depth: 0.7 } });
    s.tone({ type: "sine", from: 90, to: 62, dur: 1, gain: 0.1 * v, filter: { type: "lowpass", from: 500 } });
  },
  tosse: (s, v) => {
    for (let i = 0; i < 3; i++)
      s.noise({ dur: 0.12, gain: 0.22 * v, delay: i * 0.18, filter: { type: "bandpass", from: 420, to: 900, q: 2 } });
  },
};
const intervalLoops: Record<string, { gap: number; sound: string }> = {
  coracao: { gap: 1, sound: "coracao" },
  tambores: { gap: 0.34, sound: "seek.tambor" },
  "passos.figura": { gap: 0.62, sound: "figura.passo" },
  alarme: { gap: 1.5, sound: "eletrico" },
  aranha: { gap: 0.42, sound: "aranha" },
};
export class AudioEngine {
  ctx: Ctx | null = null;
  master: GainNode | null = null;
  private volume = 0.9;
  private loops = new Map<
    string,
    { stop: () => void; gain: GainNode; timer: number | null }
  >();
  private last = new Map<string, number>();
  private started = 0;
  private window = 0;
  get available() {
    return typeof window !== "undefined" && "AudioContext" in window;
  }
  private ensure() {
    if (!this.available) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
        const resume = () => void this.ctx?.resume().catch(() => {});
        window.addEventListener("pointerdown", resume);
        window.addEventListener("keydown", resume);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.volume;
  }
  /** Limita a quantidade de vozes por segundo para scripts barulhentos não travarem o áudio. */
  private budget() {
    const now = Date.now();
    if (now - this.window > 1000) {
      this.window = now;
      this.started = 0;
    }
    if (this.started >= 40) return false;
    this.started++;
    return true;
  }
  play(name: string, volume = 1, pitch = 1) {
    const recipe = recipes[name] ?? recipes.clique;
    if (!Number.isFinite(volume) || volume <= 0 || !this.budget()) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = Date.now();
    if (now - (this.last.get(name) ?? 0) < 25) return;
    this.last.set(name, now);
    try {
      recipe(
        new Synth(ctx, this.master),
        Math.min(1.4, volume),
        Math.max(0.4, Math.min(2.5, pitch)),
      );
    } catch {}
  }
  loop(name: string, volume = 1) {
    if (!Number.isFinite(volume)) return;
    if (volume <= 0 || !name) return this.stop(name);
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const existing = this.loops.get(name);
    if (existing) {
      existing.gain.gain.value = Math.min(1.2, volume);
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = Math.min(1.2, volume);
    gain.connect(this.master);
    const interval = intervalLoops[name];
    if (interval) {
      const timer = window.setInterval(
        () => this.play(interval.sound, gain.gain.value * 0.9),
        interval.gap * 1000,
      );
      this.play(interval.sound, gain.gain.value * 0.9);
      this.loops.set(name, {
        gain,
        timer,
        stop: () => window.clearInterval(timer),
      });
      return;
    }
    const stop = this.continuous(ctx, gain, name);
    this.loops.set(name, { gain, timer: null, stop });
  }
  /** Camadas contínuas (vento, drone) montam nós próprios e ficam tocando até o stop. */
  private continuous(ctx: Ctx, out: GainNode, name: string) {
    const nodes: { stop?: () => void; node: AudioNode }[] = [];
    const source = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x3fffffff - 1) * 0.8;
    }
    source.buffer = buffer;
    source.loop = true;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = name === "vento" ? 0.07 : 0.05;
    lfoGain.gain.value = name === "vento" ? 500 : 60;
    nodes.push({ node: source, stop: () => source.stop() }, { node: lfo, stop: () => lfo.stop() }, { node: lfoGain });
    if (name === "vento") {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 480;
      filter.Q.value = 1.1;
      lfo.connect(lfoGain).connect(filter.frequency);
      source.connect(filter).connect(out);
      nodes.push({ node: filter });
    } else {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 260;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 57;
      const osc2 = ctx.createOscillator();
      osc2.type = "sawtooth";
      osc2.frequency.value = 86;
      osc2.detune.value = 9;
      source.connect(filter);
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(out);
      lfo.connect(lfoGain).connect(out.gain);
      nodes.push({ node: filter }, { node: osc, stop: () => osc.stop() }, { node: osc2, stop: () => osc2.stop() });
    }
    try {
      for (const entry of nodes)
        if ("start" in entry.node) (entry.node as AudioBufferSourceNode).start();
    } catch {}
    return () => {
      for (const entry of nodes) {
        try {
          entry.stop?.();
        } catch {}
        try {
          entry.node.disconnect();
        } catch {}
      }
      try {
        out.disconnect();
      } catch {}
    };
  }
  stop(name: string) {
    const entry = this.loops.get(name);
    if (!entry) return;
    if (entry.timer !== null) window.clearInterval(entry.timer);
    entry.stop();
    try {
      entry.gain.disconnect();
    } catch {}
    this.loops.delete(name);
  }
  stopAll() {
    for (const name of [...this.loops.keys()]) this.stop(name);
  }
  dispose() {
    this.stopAll();
    try {
      void this.ctx?.close();
    } catch {}
    this.ctx = null;
    this.master = null;
  }
}
