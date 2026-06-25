/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Emotion, HandData } from '../types';

export const EMOTIONS = {
  deepblue: {
    name: '深海蓝',
    color: [20, 50, 120],
    backgroundColor: [5, 10, 25],
    melodyOsc: 'sine',
    droneOsc: 'sine',
    droneNote: 'C1',
    chords: [['C3','G3'], ['A2','E3'], ['F2','C3'], ['G2','D3']],
    bpm: 55,
    reverbDecay: 8,
    reverbWet: 0.8,
    filterFreq: 400,
    hasDrums: false,
    hasNoise: true,
    noiseType: 'brown' as const,
    drumPattern: [] as number[]
  },
  magma: {
    name: '岩浆红',
    color: [200, 50, 20],
    backgroundColor: [25, 5, 5],
    melodyOsc: 'sawtooth',
    droneOsc: 'pulse',
    droneNote: 'E1',
    chords: [['E3','G3','B3'], ['D3','F3','A3'], ['C3','E3','G3'], ['B2','D3','F3']],
    bpm: 135,
    reverbDecay: 2,
    reverbWet: 0.3,
    filterFreq: 2000,
    hasDrums: true,
    drumPattern: [1,0,1,0, 1,1,0,1],
    hasNoise: false
  },
  sakura: {
    name: '樱花粉',
    color: [255, 180, 200],
    backgroundColor: [20, 15, 18],
    melodyOsc: 'triangle',
    droneOsc: 'triangle',
    droneNote: 'C2',
    chords: [['C4','E4','G4'], ['A3','C4','E4'], ['F3','A3','C4'], ['G3','B3','D4']],
    bpm: 85,
    reverbDecay: 6,
    reverbWet: 0.7,
    filterFreq: 1500,
    hasDrums: false,
    hasNoise: false,
    drumPattern: [] as number[]
  },
  rust: {
    name: '锈绿',
    color: [80, 100, 60],
    backgroundColor: [10, 15, 10],
    melodyOsc: 'square',
    droneOsc: 'sawtooth',
    droneNote: 'C1',
    chords: [['C3','F3'], ['C3','G3'], ['C3','Eb3'], ['C3','Bb2']],
    bpm: 95,
    reverbDecay: 3,
    reverbWet: 0.5,
    filterFreq: 800,
    hasDrums: true,
    drumPattern: [1,0,0,1, 0,1,0,0, 1,0,1,0, 0,0,1,1],
    hasNoise: true,
    noiseType: 'brown' as const
  },
  heartbeat: {
    name: '心跳红',
    color: [180, 30, 30],
    backgroundColor: [15, 5, 5],
    melodyOsc: 'sine',
    droneOsc: 'sine',
    droneNote: 'C2',
    chords: [['C3','Eb3','G3'], ['C3','E3','G3'], ['C3','F3','A3'], ['C3','Eb3','Ab3']],
    bpm: 72,
    reverbDecay: 4,
    reverbWet: 0.6,
    filterFreq: 600,
    hasDrums: true,
    drumPattern: [1,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,0,1],
    hasNoise: false
  },
  fog: {
    name: '雾白',
    color: [220, 220, 230],
    backgroundColor: [18, 18, 22],
    melodyOsc: 'sine',
    droneOsc: 'sine',
    droneNote: 'C3',
    chords: [['C3'], ['E3'], ['G3'], ['B3']],
    bpm: 40,
    reverbDecay: 10,
    reverbWet: 1.0,
    filterFreq: 400,
    hasDrums: false,
    hasNoise: true,
    noiseType: 'pink' as const,
    drumPattern: [] as number[]
  }
} as const;

const getEmotionKey = (id: string): string => {
  if (id === 'deep-sea' || id === 'deepblue') return 'deepblue';
  if (id === 'lava-red' || id === 'magma') return 'magma';
  if (id === 'sakura-pink' || id === 'sakura') return 'sakura';
  if (id === 'rust-green' || id === 'rust') return 'rust';
  if (id === 'heart-red' || id === 'heartbeat') return 'heartbeat';
  if (id === 'mist-white' || id === 'fog') return 'fog';
  return 'deepblue'; // fallback
};

class AudioEngine {
  private tone: any = null;
  private isAudioStarted = false;
  private isInitialized = false;

  private currentEmotion: any = null;
  private activeEmotion: Emotion | null = null;
  private visualEngineInstance: any = null;
  private chordIndex = 0;

  // Synths
  private melodySynth: any = null;
  private droneSynth: any = null;
  private drumSynth: any = null;
  private noiseSynth: any = null;
  private currentDrumPattern: number[] = [];

  // Trackers
  private activeSynths: any[] = [];
  private activeEffects: any[] = [];
  private activeLoops: any[] = [];
  private layers: any = {};

  // Effects & Routing Nodes
  private panner: any = null;
  private reverb: any = null;
  private filter: any = null;
  private analyser: any = null;
  private recorderDest: any = null;

  // Smoothed gesture state
  private smoothedX = 0.5;
  private smoothedY = 0.5;
  private smoothedSpread = 0.5;

  private lastNote: string | null = null;
  private lastDensityLevel: number | null = null;
  private lastInstruments: string[] = [];
  private lastRotation = 0;
  private lastShape: string | null = null;

  constructor() {
    // Lazy loaded Tone
  }

  public getAnalyser() {
    return this.analyser;
  }

  public getRecorderDest() {
    return this.recorderDest;
  }

  public getMelodySynth() {
    return this.melodySynth;
  }

  public getDroneSynth() {
    return this.droneSynth;
  }

  public getDrumSynth() {
    return this.drumSynth;
  }

  public getNoiseSynth() {
    return this.noiseSynth;
  }

  private validateAudioChain() {
    if (!this.tone) return;
    console.log('=== 音频链检查 ===');
    console.log('AudioContext状态:', this.tone.context.state);
    console.log('Transport状态:', this.tone.getTransport().state);
    console.log('Destination音量:', this.tone.getDestination().volume.value);
    
    [this.melodySynth, this.droneSynth, this.drumSynth].forEach((synth, i) => {
      if (synth) {
        console.log(`合成器${i}:`, 
          '音量=', synth.volume ? synth.volume.value : 'N/A',
          '连接=', synth.toDestination ? '有' : '无'
        );
      } else {
        console.log(`合成器${i}: 未初始化`);
      }
    });
  }

  private logAudioTrigger(gesture: { x: number; y: number; spread: number }, note: string) {
    if (!this.tone) return;
    console.log('音频触发:', {
      情绪: this.currentEmotion ? this.currentEmotion.name : '无',
      音符: note,
      手势X: gesture.x.toFixed(2),
      手势Y: gesture.y.toFixed(2),
      张开度: gesture.spread.toFixed(2),
      时间: this.tone.now()
    });
  }

  public setVisualEngine(ve: any) {
    this.visualEngineInstance = ve;
  }

  private ensureTone() {
    if (this.tone) return;
    if (typeof window !== 'undefined' && (window as any).Tone) {
      this.tone = (window as any).Tone;
    } else {
      throw new Error('Tone.js is not loaded on the window object.');
    }
  }

  public async startAudio() {
    this.ensureTone();
    if (!this.isAudioStarted) {
      await this.tone.start();
      this.isAudioStarted = true;
      console.log('AudioContext状态:', this.tone.context.state);
    }
    
    const ctx = this.tone.getContext();
    if (ctx && ctx.rawContext && ctx.rawContext.resume) {
      await ctx.rawContext.resume();
    }
    if (ctx && ctx.state !== 'running' && ctx.resume) {
      await ctx.resume();
    }
    console.log('AudioContext最终状态:', this.tone.context.state);
  }

  public async playTestSound() {
    try {
      this.ensureTone();
      console.log('[DEBUG] playTestSound: 启动测试声音触发流程');
      
      await this.tone.start();
      const ctx = this.tone.getContext();
      if (ctx && ctx.rawContext && ctx.rawContext.resume) {
        await ctx.rawContext.resume();
      }
      
      this.tone.getDestination().volume.value = 0;
      
      const tempSynth = new this.tone.Synth().toDestination();
      tempSynth.triggerAttackRelease('C4', '1s');

      setTimeout(() => {
        try {
          tempSynth.dispose();
        } catch (e) {}
      }, 1500);
    } catch (e: any) {
      console.error('[DEBUG] playTestSound error:', e);
    }
  }

  public async init(emotion: Emotion) {
    this.ensureTone();
    await this.startAudio();

    this.activeEmotion = emotion;

    const emotionKey = getEmotionKey(emotion.id);
    await this.initAudio(emotionKey);
  }

  public async initAudio(emotionKey: string) {
    this.ensureTone();
    this.stop(); // Clear previous nodes

    if (!this.isAudioStarted) {
      await this.tone.start();
      this.isAudioStarted = true;
      console.log('AudioContext状态:', this.tone.context.state);
    }

    const cfg = EMOTIONS[emotionKey as keyof typeof EMOTIONS];
    if (!cfg) {
      console.error(`Invalid emotion key: ${emotionKey}`);
      return;
    }

    this.smoothedX = 0.5;
    this.smoothedY = 0.5;
    this.smoothedSpread = 0.5;

    // Reset master volume to 0 (unity gain) to prevent silence
    this.tone.getDestination().volume.value = 0;

    // Create custom routing destination for recording
    const ctx = this.tone.getContext();
    if (ctx && ctx.rawContext && ctx.rawContext.createMediaStreamDestination) {
      try {
        this.recorderDest = ctx.rawContext.createMediaStreamDestination();
      } catch (e) {
        console.warn('Could not create media stream destination:', e);
      }
    }

    this.analyser = new this.tone.Meter();
    this.analyser.toDestination(); // Main output via analyser

    this.currentEmotion = {
      ...cfg,
      chordProgression: cfg.chords,
      drumPattern: (cfg as any).drumPattern || [],
      bpm: cfg.bpm,
      notes: cfg.chords[0]
    };
    this.chordIndex = 0;

    // Create main outputs
    const masterVol = new this.tone.Volume(0);
    masterVol.connect(this.analyser);
    if (this.recorderDest) {
      masterVol.connect(this.recorderDest);
    }
    this.activeEffects.push(masterVol);

    // 1. Reverb & Filter
    this.reverb = new this.tone.Reverb({
      decay: cfg.reverbDecay || 4,
      wet: cfg.reverbWet || 0.5
    });
    this.reverb.connect(masterVol);
    this.activeEffects.push(this.reverb);

    this.filter = new this.tone.Filter(cfg.filterFreq || 1000, 'lowpass');
    this.filter.connect(this.reverb);
    this.activeEffects.push(this.filter);

    // Stereo Panner for melody / gesture panning
    this.panner = new this.tone.Panner(0);
    this.panner.connect(this.filter);
    this.activeEffects.push(this.panner);

    // 2. Melody PolySynth (Triangle/sine/sawtooth/square)
    this.melodySynth = new this.tone.PolySynth(this.tone.Synth, {
      oscillator: { type: cfg.melodyOsc || 'triangle' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.6, release: 1 }
    });
    this.melodySynth.connect(this.panner);
    this.melodySynth.volume.value = -5; // Loud and clear!
    this.activeSynths.push(this.melodySynth);

    // 3. Drone Synth
    this.droneSynth = new this.tone.Synth({
      oscillator: { type: cfg.droneOsc || 'sine' },
      envelope: { attack: 2, decay: 0.1, sustain: 1, release: 3 }
    });
    // Direct to reverb to keep low end centered
    this.droneSynth.connect(this.reverb);
    this.droneSynth.volume.value = -10;
    this.activeSynths.push(this.droneSynth);

    // 4. Drum Synth (if applicable)
    if (cfg.hasDrums) {
      this.drumSynth = new this.tone.MembraneSynth();
      // Route drums to filter to keep it tight
      this.drumSynth.connect(this.filter);
      this.drumSynth.volume.value = -8;
      this.activeSynths.push(this.drumSynth);
    }

    // 5. Noise Synth (if applicable)
    if (cfg.hasNoise) {
      this.noiseSynth = new this.tone.NoiseSynth({
        noise: { type: cfg.noiseType || 'pink' },
        envelope: { attack: 1, decay: 0.5, sustain: 0.8, release: 2 }
      });
      this.noiseSynth.connect(this.reverb);
      this.noiseSynth.volume.value = -20;
      this.activeSynths.push(this.noiseSynth);
    }

    // Standard layers map for updateParams compatibility
    this.layers = {
      drone: this.droneSynth,
      melody: this.melodySynth,
      rhythm: this.drumSynth,
      noise: this.noiseSynth,
      panner: this.panner,
      reverb: this.reverb,
      filter: this.filter
    };

    // Trigger drone attack note
    this.droneSynth.triggerAttack(cfg.droneNote || 'C2');

    // Schedule repeat on Tone.Transport
    this.tone.getTransport().cancel();
    this.tone.getTransport().bpm.value = cfg.bpm;

    let loopChordIdx = 0;
    const loopId = this.tone.getTransport().scheduleRepeat((time: number) => {
      const chord = cfg.chords[loopChordIdx % cfg.chords.length];
      if (this.melodySynth && chord) {
        this.melodySynth.triggerAttackRelease(chord, '2n', time);
      }

      // Drum pattern trigger
      if (this.drumSynth && cfg.hasDrums && (cfg as any).drumPattern) {
        const pattern = (cfg as any).drumPattern;
        if (pattern[loopChordIdx % pattern.length]) {
          this.drumSynth.triggerAttackRelease('C1', '8n', time);
        }
      }

      // Noise triggers
      if (this.noiseSynth && cfg.hasNoise && Math.random() > 0.5) {
        this.noiseSynth.triggerAttackRelease('2n', time);
      }

      loopChordIdx = (loopChordIdx + 1) % cfg.chords.length;
      this.chordIndex = loopChordIdx;
    }, '1n');

    this.activeLoops.push(loopId);

    this.tone.getTransport().start();
    this.isInitialized = true;

    this.validateAudioChain();
    console.log('情绪音频初始化:', emotionKey, {
      melody: this.melodySynth ? 'OK' : 'FAIL',
      drone: this.droneSynth ? 'OK' : 'FAIL',
      drum: this.drumSynth ? 'OK' : 'N/A',
      noise: this.noiseSynth ? 'OK' : 'N/A',
      bpm: cfg.bpm
    });
  }

  public updateParams(hand: HandData) {
    if (!this.isInitialized || !this.tone || !this.isAudioStarted || !this.melodySynth || !this.filter || !this.panner || !this.currentEmotion) return;

    const {
      x,
      y,
      spread,
      rotation = 0,
      extendedFingers = 5,
      speed = 0,
      acceleration = 0,
      direction = 'STATIC',
      shape = 'open'
    } = hand;

    // Smooth values for continuous controllers
    this.smoothedX += (x - this.smoothedX) * 0.15;
    this.smoothedY += (y - this.smoothedY) * 0.15;
    this.smoothedSpread += (spread - this.smoothedSpread) * 0.15;

    // Determine emotion key safely
    let emotionKey = 'deepblue';
    if (this.currentEmotion) {
      if (this.currentEmotion.name === '岩浆红') emotionKey = 'magma';
      else if (this.currentEmotion.name === '樱花粉') emotionKey = 'sakura';
      else if (this.currentEmotion.name === '锈绿') emotionKey = 'rust';
      else if (this.currentEmotion.name === '心跳红') emotionKey = 'heartbeat';
      else if (this.currentEmotion.name === '雾白') emotionKey = 'fog';
    }

    // 1. 旋律：Y轴 → 音高（量化到和弦内音符）
    const cfg = EMOTIONS[emotionKey as keyof typeof EMOTIONS];
    const scale = cfg.chords[0]; // 使用第一个和弦的音符
    const noteIdx = Math.floor((1 - y) * scale.length);
    const note = scale[Math.max(0, Math.min(scale.length - 1, noteIdx))];

    // 只有音符变化时才触发（避免重复）
    if (note !== this.lastNote) {
      // 转置到不同八度
      const octave = Math.floor(y * 2) + 3; // 3-4八度
      const fullNote = this.tone.Frequency(note).transpose(octave * 12);
      
      this.melodySynth.triggerAttackRelease(fullNote, '8n');
      this.logAudioTrigger({ x, y, spread }, fullNote.toString());
      this.lastNote = note;

      if (this.visualEngineInstance) {
        this.visualEngineInstance.growNoteColumn(x, y, fullNote.toString());
      }
    }

    // 2. 节奏：张开度 → 滤波器频率（明亮度）
    if (this.melodySynth && this.filter) {
      const freq = 200 + this.smoothedSpread * 4000;
      this.filter.frequency.rampTo(freq, 0.1);
    }

    // 3. 空间：X轴 → 声像
    if (this.panner) {
      this.panner.pan.rampTo((x - 0.5) * 2, 0.1);
    }

    // 4. 特殊触发：快速移动/高加速度 → 琶音/刮奏
    if (acceleration > 0.2) {
      const arpeggio = this.currentEmotion.chordProgression?.[0] || ['C3', 'E3', 'G3'];
      this.playArpeggio(arpeggio, direction);

      if (this.visualEngineInstance) {
        this.visualEngineInstance.createSonicBoom(x, y, acceleration);
      }
    }

    // 5. 特殊触发：捏合 → 暂停/留白
    if (shape === 'pinch' && this.lastShape !== 'pinch') {
      try {
        this.tone.getTransport().pause();
        this.activeSynths.forEach(synth => {
          if (synth && synth.volume) {
            synth.volume.rampTo(-99, 0.05);
          }
        });
        if (this.melodySynth) this.melodySynth.volume.rampTo(-99, 0.05);
        if (this.droneSynth) this.droneSynth.volume.rampTo(-99, 0.05);
        if (this.drumSynth) this.drumSynth.volume.rampTo(-99, 0.05);

        if (this.visualEngineInstance) {
          this.visualEngineInstance.createSilenceVoid(x, y);
        }

        setTimeout(() => {
          try {
            if (this.tone) {
              this.tone.getTransport().start();
            }
            this.activeSynths.forEach(synth => {
              if (synth && synth.volume) {
                synth.volume.rampTo(-10, 0.5); 
              }
            });
            if (this.melodySynth) this.melodySynth.volume.rampTo(-5, 0.5);
            if (this.droneSynth) this.droneSynth.volume.rampTo(-10, 0.5);
            if (this.drumSynth && cfg.hasDrums) this.drumSynth.volume.rampTo(-8, 0.5);

            if (this.visualEngineInstance) {
              this.visualEngineInstance.collapseVoid();
            }
          } catch (e) {}
        }, 1000);
      } catch (e) {}
    }
    this.lastShape = shape;

    // Debug print periodically
    if (Math.random() < 0.03) {
      console.log('手势音频映射:', {
        emotion: emotionKey,
        x: this.smoothedX.toFixed(2),
        y: this.smoothedY.toFixed(2), 
        spread: this.smoothedSpread.toFixed(2),
        shape,
        extendedFingers,
        speed: speed.toFixed(2),
        acceleration: acceleration.toFixed(2),
        direction
      });
    }
  }

  private playArpeggio(arpeggio: string[], direction: string) {
    if (!this.tone || !this.melodySynth) return;
    const now = this.tone.now();
    let notesToPlay = [...arpeggio];
    if (direction === 'S' || direction === 'SW' || direction === 'SE') {
      notesToPlay.reverse();
    }
    notesToPlay.forEach((note, idx) => {
      this.melodySynth.triggerAttackRelease(note, '16n', now + idx * 0.08);
    });
  }

  public triggerGrowthNote(x: number, y: number, spread: number) {
    if (!this.isInitialized || !this.tone || !this.isAudioStarted || !this.melodySynth || !this.currentEmotion) return;
    try {
      this.ensureTone();
      const chords = this.currentEmotion.chords;
      if (!chords || chords.length === 0) return;
      
      const chord = chords[this.chordIndex % chords.length];
      if (!chord || chord.length === 0) return;
      
      const noteIndex = Math.floor(x * chord.length);
      const baseNote = chord[Math.min(noteIndex, chord.length - 1)];
      const octave = Math.floor(y * 3) + 2; // 2-4 octaves
      
      const note = this.tone.Frequency(baseNote).transpose(octave * 12);
      
      const safeSpread = typeof spread === 'number' && !isNaN(spread) && spread >= 0 ? spread : 0.5;
      const duration = Math.max(0.05, 0.1 + safeSpread * 2);
      
      this.melodySynth.triggerAttackRelease(note, duration);
      this.logAudioTrigger({ x, y, spread: safeSpread }, note.toString());
    } catch (e) {
      console.error('triggerGrowthNote error:', e);
    }
  }

  public getLowEnergy(): number {
    if (!this.analyser) return 0.05;
    try {
      const level = this.analyser.getValue();
      if (typeof level === 'number') {
        const energy = Math.max(0, (level + 80) / 80);
        return energy;
      }
    } catch (e) {}
    return 0.05;
  }

  public getAudioStream(): MediaStream | null {
    if (this.recorderDest) {
      return this.recorderDest.stream;
    }
    return null;
  }

  public stop() {
    this.isInitialized = false;

    // Clean up dynamic transport loops
    this.activeLoops.forEach(id => {
      try {
        if (this.tone) {
          this.tone.getTransport().clear(id);
        }
      } catch (e) {}
    });
    this.activeLoops = [];

    // Dispose all dynamic synths
    this.activeSynths.forEach(synth => {
      try {
        if (typeof synth.triggerRelease === 'function') {
          synth.triggerRelease();
        }
        synth.dispose();
      } catch (e) {}
    });
    this.activeSynths = [];

    // Dispose all dynamic effects
    this.activeEffects.forEach(fx => {
      try {
        fx.dispose();
      } catch (e) {}
    });
    this.activeEffects = [];

    this.layers = {};

    if (this.droneSynth) {
      try {
        this.droneSynth.triggerRelease();
        this.droneSynth.dispose();
      } catch (e) {}
      this.droneSynth = null;
    }
    if (this.melodySynth) {
      try { this.melodySynth.dispose(); } catch (e) {}
      this.melodySynth = null;
    }
    if (this.drumSynth) {
      try { this.drumSynth.dispose(); } catch (e) {}
      this.drumSynth = null;
    }
    if (this.noiseSynth) {
      try { this.noiseSynth.dispose(); } catch (e) {}
      this.noiseSynth = null;
    }
    if (this.panner) {
      try { this.panner.dispose(); } catch (e) {}
      this.panner = null;
    }
    if (this.reverb) {
      try { this.reverb.dispose(); } catch (e) {}
      this.reverb = null;
    }
    if (this.filter) {
      try { this.filter.dispose(); } catch (e) {}
      this.filter = null;
    }
    if (this.analyser) {
      try { this.analyser.dispose(); } catch (e) {}
      this.analyser = null;
    }

    if (this.tone) {
      try {
        this.tone.getTransport().stop();
        this.tone.getTransport().cancel();
      } catch (e) {}
    }

    this.recorderDest = null;
    this.currentEmotion = null;
  }
}

export const audioEngine = new AudioEngine();
