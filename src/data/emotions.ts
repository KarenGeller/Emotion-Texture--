/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Emotion } from '../types';

export const EMOTIONS: Emotion[] = [
  {
    id: 'deep-sea',
    name: '深海蓝',
    englishName: 'Deep Sea Blue',
    colors: ['#0a1628', '#1e3a5f'],
    description: '低频Drone+水声，水下遗迹建筑',
    droneFrequency: 55, // A1
    oscillatorType: 'sine',
    baseBPM: 72,
    notes: ['C3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'Eb4', 'G4'],
    bgSoundType: 'water',
    architectureStyle: 'ruins'
  },
  {
    id: 'lava-red',
    name: '岩浆红',
    englishName: 'Lava Red',
    colors: ['#2d0a0a', '#8b2500'],
    description: '失真吉他+工业鼓，火山熔岩管道',
    droneFrequency: 65.4, // C2
    oscillatorType: 'sawtooth',
    baseBPM: 132,
    notes: ['D3', 'Eb3', 'F#3', 'G3', 'Ab3', 'C4', 'Eb4', 'F#4'],
    bgSoundType: 'industrial',
    architectureStyle: 'pipes'
  },
  {
    id: 'sakura-pink',
    name: '樱花粉',
    englishName: 'Sakura Pink',
    colors: ['#f8e8e8', '#ffb7c5'],
    description: '钢琴+筝+风铃，日式枯山水',
    droneFrequency: 110, // A2
    oscillatorType: 'triangle',
    baseBPM: 85,
    notes: ['A3', 'B3', 'C4', 'E4', 'F4', 'A4', 'B4', 'C5'],
    bgSoundType: 'wind',
    architectureStyle: 'karesansui'
  },
  {
    id: 'rust-green',
    name: '锈绿',
    englishName: 'Rust Green',
    colors: ['#1a2f1a', '#4a6741'],
    description: '不规则节拍+金属打击，废弃工厂',
    droneFrequency: 73.4, // D2
    oscillatorType: 'square',
    baseBPM: 98,
    notes: ['C3', 'D3', 'E3', 'F#3', 'G#3', 'A#3', 'C4', 'D4'],
    bgSoundType: 'metal',
    architectureStyle: 'factory'
  },
  {
    id: 'heart-red',
    name: '心跳红',
    englishName: 'Heartbeat Red',
    colors: ['#1a0a0a', '#8b0000'],
    description: '心跳BPM+弦乐，血管网络',
    droneFrequency: 60, // B1-ish
    oscillatorType: 'sine',
    baseBPM: 60, // 60 bpm heartbeat
    notes: ['D3', 'F3', 'G3', 'A3', 'C4', 'D4', 'F4', 'A4'],
    bgSoundType: 'heart',
    architectureStyle: 'vascular'
  },
  {
    id: 'mist-white',
    name: '雾白',
    englishName: 'Mist White',
    colors: ['#3a3a45', '#9a9a9a'], // Darker backdrop gradient for contrast as specified by design rules (no low-contrast light on light)
    description: '白噪音+缥缈人声，云层迷宫',
    droneFrequency: 130.8, // C3
    oscillatorType: 'sine',
    baseBPM: 80,
    notes: ['F3', 'G3', 'A3', 'C4', 'D4', 'F4', 'G4', 'A4'],
    bgSoundType: 'mist',
    architectureStyle: 'clouds'
  }
];
