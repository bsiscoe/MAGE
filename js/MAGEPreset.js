export class MAGEPreset {
  constructor({
    controls = null,
    settings = null,
    state = null,
    intent = null,
    fx = null,
    visualizer = null,
    audioPath = null,
  } = {}) {
    this.controls = controls;
    this.settings = settings;
    this.state = state;
    this.intent = intent;
    this.fx = fx;
    this.visualizer = visualizer;
    this.audioPath = audioPath;
  }

  static from(input) {
    if (!input) {
      return null;
    }
    if (input instanceof MAGEPreset) {
      return input;
    }

    let data = input;
    if (typeof input === 'string') {
      try {
        data = JSON.parse(input);
      } catch {
        return null;
      }
    }
    if (!data || typeof data !== 'object') {
      return null;
    }

    return new MAGEPreset({
      controls: data.controls ?? null,
      settings: data.settings ?? null,
      state: data.state ?? null,
      intent: data.intent ?? null,
      fx: data.fx ?? null,
      visualizer: data.visualizer ?? null,
      audioPath: data.audioPath ?? data.audio ?? null,
    });
  }
}