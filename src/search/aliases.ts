// Domain vocabulary. The corpus is written in engine words ("polyBlep",
// "clipperLimiter", "besselThomson"); people search in DSP words ("anti
// aliasing", "limiter", "linear phase"). Each group below is a set of terms
// that should reach each other -- membership is symmetric, so adding a word
// to a group makes it findable from every other word in that group.
//
// Keep entries single tokens (join multi-word terms: "groupdelay",
// "ringmod"), because queries are tokenized the same way and a two-word query
// also produces its glued form ("sine wave" -> "sinewave").
//
// Expansions are scored at a discount in the engine, so a literal hit always
// wins over an inferred one. That makes it safe to be generous here.

const SYNONYM_GROUPS: string[][] = [
  // --- waveforms ---
  ["sine", "sinusoid", "sin", "sinewave", "sincos", "sinewavetable", "robinsinusoid", "aliassine", "cosine", "quadrature"],
  ["saw", "sawtooth", "ramp", "antisaw", "supersaw", "hypersaw", "robinsupersaw", "unison", "detune"],
  ["square", "pulse", "rect", "rectangle", "pwm", "pulsewidth"],
  ["triangle", "tri"],
  ["noise", "random", "white", "pink", "brown", "hiss", "dither"],
  ["wavetable", "table", "morph", "frame", "wavetable2d", "wavetable3d"],
  ["additive", "harmonics", "partials", "fourier", "series", "additiveosc", "gpuadditive"],
  ["dsf", "discretesummation", "closedform", "harmonicseries"],

  // --- aliasing ---
  ["aliasing", "alias", "antialiasing", "nyquist", "foldover", "bandlimited", "polyblep", "blep", "blit", "aliasingwars"],
  ["oversampling", "upsample", "downsample", "decimate", "resample", "interpolation", "sinc"],

  // --- filters ---
  ["filter", "cutoff", "resonance", "eq", "equalizer", "tone", "shelf", "notch"],
  ["lowpass", "lpf", "lp", "highpass", "hpf", "hp", "bandpass", "bpf", "allpass"],
  ["bessel", "thomson", "besselthomson", "groupdelay", "linearphase", "maximallyflat"],
  ["butterworth", "chebyshev", "elliptic", "cauer", "iir", "biquad", "scientific", "cookbook", "rbj"],
  ["ladder", "moog", "transistor", "diode", "steiner", "sallenkey", "statevariable", "svf"],
  ["tb303", "acid", "303", "squelch"],
  ["formant", "vowel", "vocoder", "talkbox"],
  ["comb", "karplus", "string", "resonator", "physicalmodeling", "waveguide"],

  // --- time / space ---
  ["reverb", "room", "hall", "plate", "space", "ambience", "convolution", "impulseresponse", "ir", "reverbeffect", "soemreverb"],
  ["delay", "echo", "feedback", "tape", "pingpong", "delayeffect", "walldelay"],
  ["chorus", "flanger", "phaser", "ensemble", "doubler"],
  ["doppler", "pitchshift", "shifter", "movement", "velocity"],

  // --- dynamics ---
  ["limiter", "limit", "limiting", "ceiling", "lookahead", "clipper", "clip", "clipping", "softclip", "hardclip"],
  ["compressor", "compression", "expander", "gate", "ducking", "sidechain", "dynamics", "ratio", "threshold"],
  ["gain", "volume", "level", "amplitude", "trim", "attenuverter", "bias", "normalize"],
  ["saturation", "distortion", "drive", "overdrive", "fuzz", "waveshaper", "wavefolder", "fold", "crush", "bitcrush", "decimator"],

  // --- modulation ---
  ["envelope", "adsr", "attack", "decay", "sustain", "release", "ar", "ad", "contour"],
  ["vactrol", "opto", "optocoupler", "photoresistor", "ldr", "lag"],
  ["lfo", "modulator", "modulation", "mod", "cv", "control", "automation"],
  ["fm", "phasemodulation", "pm", "ringmod", "am", "amplitudemodulation", "sidebands"],
  ["sync", "hardsync", "oscillatorsync", "subsample"],

  // --- chaos / math ---
  ["chaos", "chaotic", "attractor", "strange", "lorenz", "chua", "henon", "logistic", "bifurcation", "fractal", "mandelbrot", "julia"],
  ["gravity", "orbit", "physics", "massspring", "damper", "pendulum", "simulation"],
  ["math", "equation", "formula", "function", "derivation", "algorithm"],

  // --- time base ---
  ["clock", "tempo", "bpm", "transport", "sequencer", "sequence", "step", "trigger", "gate", "divider", "arp", "arpeggiator"],
  ["rhythm", "groove", "pattern", "euclidean", "swing"],

  // --- pitch / music ---
  ["pitch", "tune", "tuning", "frequency", "hz", "cents", "octave", "semitone", "quantizer", "scale", "note", "midi", "keyboard"],
  ["chord", "harmony", "voicing", "progression", "arpeggio", "key"],

  // --- visual / video ---
  ["rgb", "rgba", "color", "colour", "hue", "saturation", "chroma", "palette", "gradient", "shader", "pixel", "raster", "picture", "video", "visual"],
  ["scope", "oscilloscope", "xy", "vector", "vectorscope", "lissajous", "trace", "display", "phosphor", "crt", "beam", "glow", "persistence"],
  ["oscillographics", "jerobeam", "oscilloscopemusic", "drawing", "shape"],

  // --- engine / performance ---
  ["simd", "vectorized", "performance", "optimization", "cpu", "efficiency", "wasm", "webassembly", "native"],
  ["patch", "preset", "project", "graph", "nodegraph", "modular", "rack"],
  ["sandbox", "playground", "editor", "demo", "live", "interactive", "try"],
  ["module", "node", "block", "unit", "component"],

  // --- io / routing ---
  ["portal", "router", "bus", "send", "return", "group", "submix"],
  ["stereo", "pan", "width", "midside", "mono", "channel", "spread"],
  ["sample", "sampler", "player", "audio", "file", "wav", "recording", "granular", "grain"],
  ["input", "output", "port", "wire", "cable", "connection", "signal"],

  // --- analysis ---
  ["spectrum", "spectral", "fft", "analyzer", "analysis", "meter", "multimeter", "readout", "monitor", "debug"],
  ["helmholtz", "pitchdetection", "autocorrelation", "yin"],

  // --- site vocabulary ---
  ["wiki", "article", "docs", "documentation", "guide", "explanation", "tutorial", "learn", "how", "theory", "reading"],
  ["source", "code", "github", "repo", "repository", "cpp", "implementation"],
];

const SYNONYMS: Map<string, string[]> = (() => {
  const byTerm = new Map<string, Set<string>>();
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) {
      const bucket = byTerm.get(term) || new Set<string>();
      for (const other of group) {
        if (other !== term) bucket.add(other);
      }
      byTerm.set(term, bucket);
    }
  }
  return new Map([...byTerm].map(([term, set]) => [term, [...set]]));
})();

/**
 * For each query term, the extra terms worth trying. Terms already typed by
 * the user are excluded so an expansion can never double-count a literal hit.
 */
export function expandQuery(terms: string[]): Map<string, string[]> {
  const typed = new Set(terms);
  const expansions = new Map<string, string[]>();
  for (const term of terms) {
    const related = SYNONYMS.get(term);
    if (!related) continue;
    const useful = related.filter((candidate) => !typed.has(candidate));
    if (useful.length) expansions.set(term, useful);
  }
  return expansions;
}

/** Every term the vocabulary knows -- used by tests and the "did you mean" UI. */
export function knownTerms(): string[] {
  return [...SYNONYMS.keys()];
}
