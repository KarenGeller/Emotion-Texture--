/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Emotion {
  id: string;
  name: string;
  englishName: string;
  colors: [string, string]; // [from, to] gradient
  description: string;
  droneFrequency: number;
  oscillatorType: 'sine' | 'triangle' | 'sawtooth' | 'square';
  baseBPM: number;
  notes: string[];
  bgSoundType: 'water' | 'industrial' | 'wind' | 'metal' | 'heart' | 'mist';
  architectureStyle: 'ruins' | 'pipes' | 'karesansui' | 'factory' | 'vascular' | 'clouds';
}

export interface HandData {
  x: number; // 0-1
  y: number; // 0-1
  spread: number; // 0-1 (normalized fingers to wrist)
  angle: number; // in degrees, -180 to 180
  isActive: boolean;
  isTouchFallback?: boolean;
  
  // Upgraded 8-signal gesture properties
  rotation?: number;
  extendedFingers?: number;
  speed?: number;
  acceleration?: number;
  direction?: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'STATIC';
  shape?: 'pinch' | 'fist' | 'open' | 'pointing';
  vx?: number;
  vy?: number;
}

export interface SystemParameters {
  bpm: number;
  pitch: string;
  timbre: 'Glass' | 'Metal' | 'Neon';
  space: string;
  lowEnergy: number;
  fps: number;
}
