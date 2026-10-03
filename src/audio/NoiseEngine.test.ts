import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../domain/noise';
import { NoiseEngine } from './NoiseEngine';

const graphs = vi.hoisted(() => [] as { start: ReturnType<typeof vi.fn>; rampOutput: ReturnType<typeof vi.fn> }[]);

// The real graph needs a full Web Audio implementation; the engine only orchestrates it.
vi.mock('./audioGraph', () => ({
  volumeToGain: (volume: number) => volume / 100,
  NoiseGraph: vi.fn().mockImplementation(() => {
    const graph = {
      output: { connect: vi.fn() },
      apply: vi.fn(),
      start: vi.fn(),
      rampOutput: vi.fn(),
      setOutputLevel: vi.fn(),
      dispose: vi.fn(),
    };
    graphs.push(graph);
    return graph;
  }),
}));

class FakeAudioContext extends EventTarget {
  static last: FakeAudioContext | null = null;
  /** When true, resume() waits until the test calls `pendingResume`. */
  static holdResume = false;
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = {};
  pendingResume: (() => void) | null = null;

  constructor() {
    super();
    FakeAudioContext.last = this;
  }

  resume(): Promise<void> {
    if (!FakeAudioContext.holdResume) {
      this.setState('running');
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.pendingResume = () => {
        this.setState('running');
        resolve();
      };
    });
  }

  suspend(): Promise<void> {
    this.setState('suspended');
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.setState('closed');
    return Promise.resolve();
  }

  setState(state: AudioContextState): void {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

const context = () => FakeAudioContext.last!;

describe('NoiseEngine', () => {
  beforeEach(() => {
    graphs.length = 0;
    FakeAudioContext.last = null;
    FakeAudioContext.holdResume = false;
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reports an interruption by the system and fades in from silence on the next play', async () => {
    const onInterrupted = vi.fn();
    const engine = new NoiseEngine(DEFAULT_CONFIG, onInterrupted);
    await engine.play();
    expect(engine.isPlaying).toBe(true);

    context().setState('suspended');
    expect(onInterrupted).toHaveBeenCalledTimes(1);
    expect(engine.isPlaying).toBe(false);

    await engine.play();
    expect(engine.isPlaying).toBe(true);
    expect(graphs[0]!.rampOutput).toHaveBeenLastCalledWith(DEFAULT_CONFIG.volume / 100, 0, expect.any(Number), 0);
  });

  it('does not treat its own suspend after stop() as an interruption', async () => {
    vi.useFakeTimers();
    const onInterrupted = vi.fn();
    const engine = new NoiseEngine(DEFAULT_CONFIG, onInterrupted);
    await engine.play();
    engine.stop();
    await vi.runAllTimersAsync();

    expect(context().state).toBe('suspended');
    expect(onInterrupted).not.toHaveBeenCalled();
  });

  it('stays stopped when disposed while the context is resuming', async () => {
    FakeAudioContext.holdResume = true;
    const engine = new NoiseEngine(DEFAULT_CONFIG);
    const playing = engine.play();
    await engine.dispose();
    context().pendingResume!();
    await playing;

    expect(engine.isPlaying).toBe(false);
    expect(graphs[0]!.start).not.toHaveBeenCalled();
  });
});
