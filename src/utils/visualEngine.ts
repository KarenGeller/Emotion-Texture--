/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Emotion, HandData } from '../types';
import { audioEngine } from './audioEngine';

interface GrowingElement {
  index: number;
  startTime: number;
  targetScale: any; // THREE.Vector3
  targetPosition: any; // THREE.Vector3
  targetRotation: any; // THREE.Euler
  targetColor: any; // THREE.Color
}

interface Particle {
  position: any; // THREE.Vector3
  velocity: any; // THREE.Vector3
  color: any; // THREE.Color
  size: number;
  age: number;
  maxAge: number;
  active: boolean;
}

class GestureTrail {
  public points: any[] = [];        // 3D路径点
  public maxPoints = 200;    // 最多记录200个点
  public lastPoint: any = null;
  public minDistance = 0.5;  // 最小采样距离（避免过密）

  addPoint(x: number, y: number, spread: number, gestureVelocity: number, currentEmotion: Emotion) {
    const THREE = (window as any).THREE;
    if (!THREE) return null;

    // 将手势2D坐标转换为3D世界坐标
    const worldPoint = new THREE.Vector3(
      (x - 0.5) * 20,           // X: 左右
      (y - 0.5) * 10,           // Y: 上下（高度）
      this.points.length * 0.5   // Z: 深度（沿路径前进）
    );
    
    // 计算与上一个点的距离
    if (this.lastPoint) {
      const dist = worldPoint.distanceTo(this.lastPoint);
      if (dist < this.minDistance) return null; // 太近不记录
    }
    
    // 记录手势数据
    worldPoint.userData = {
      spread: spread,              // 张开度 = 建筑粗细
      velocity: gestureVelocity,   // 速度 = 生长速度
      timestamp: Date.now(),
      emotion: currentEmotion
    };
    
    this.points.push(worldPoint);
    this.lastPoint = worldPoint;
    
    // 限制长度
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }
    
    return worldPoint;
  }
  
  getPath() {
    return this.points;
  }
  
  getDirectionAt(index: number) {
    const THREE = (window as any).THREE;
    if (!THREE) return null;

    // 计算某点的切线方向（用于建筑朝向）
    if (index <= 0) return new THREE.Vector3(0, 0, 1);
    if (index >= this.points.length - 1) {
      const prev = this.points[index - 1];
      const curr = this.points[index];
      return curr.clone().sub(prev).normalize();
    }
    const prev = this.points[index - 1];
    const next = this.points[index + 1];
    return next.clone().sub(prev).normalize();
  }
  
  clear() {
    this.points = [];
    this.lastPoint = null;
  }
}

class TrailArchitecture {
  public trail: GestureTrail;
  public structures: any;
  private scene: any;
  public growthIndex = 0;       // 当前生长到第几个点
  public growthSpeed = 2;       // 每秒生长2个点
  public lastGrowthTime = 0;

  constructor(scene: any) {
    this.scene = scene;
    const THREE = (window as any).THREE;
    this.trail = new GestureTrail();
    this.structures = new THREE.Group();
    if (this.scene && THREE) {
      this.scene.add(this.structures);
    }
    this.lastGrowthTime = Date.now();
  }
  
  updateGesture(x: number, y: number, spread: number, velocity: number, currentEmotion: Emotion) {
    // 记录手势轨迹
    const point = this.trail.addPoint(x, y, spread, velocity, currentEmotion);
    if (point) {
      console.log('轨迹点:', this.trail.points.length, '位置:', point.x.toFixed(1), point.y.toFixed(1), point.z.toFixed(1));
    }
  }
  
  updateGrowth() {
    const now = Date.now();
    const elapsed = (now - this.lastGrowthTime) / 1000;
    
    if (elapsed < 1 / this.growthSpeed) return;
    this.lastGrowthTime = now;
    
    // 沿轨迹生长建筑
    while (this.growthIndex < this.trail.points.length) {
      const point = this.trail.points[this.growthIndex];
      this.growStructureAt(point, this.growthIndex);
      this.growthIndex++;
    }
  }
  
  growStructureAt(point: any, index: number) {
    const data = point.userData;
    
    // 获取路径方向
    const direction = this.trail.getDirectionAt(index);
    
    // 建筑类型由手势特征决定
    const structureType = this.determineType(data, direction);
    
    // 创建建筑
    const mesh = this.createStructure(structureType, point, direction, data);
    if (mesh) {
      this.structures.add(mesh);
      
      // 生长动画
      mesh.scale.set(0, 0, 0);
      this.animateGrowth(mesh, data.spread);
    }
  }
  
  determineType(data: any, direction: any) {
    const spread = data.spread;
    const velocity = data.velocity;
    
    if (spread > 0.7 && velocity > 0.5) return 'tower';      // 张开+快速 = 高塔
    if (spread > 0.7 && velocity < 0.3) return 'dome';      // 张开+慢速 = 穹顶
    if (spread < 0.3 && velocity > 0.5) return 'bridge';     // 捏合+快速 = 桥梁
    if (spread < 0.3 && velocity < 0.3) return 'node';       // 捏合+慢速 = 节点
    return 'column';                                          // 默认 = 柱子
  }
  
  createStructure(type: string, point: any, direction: any, data: any) {
    const THREE = (window as any).THREE;
    if (!THREE) return null;

    const size = 0.5 + data.spread * 2;
    const height = 1 + data.velocity * 5;
    
    // Map emotion color safely
    let colorHex = '#ffffff';
    if (data.emotion) {
      if (data.emotion.colors && data.emotion.colors[1]) {
        colorHex = data.emotion.colors[1];
      } else if (data.emotion.color) {
        colorHex = data.emotion.color;
      }
    }
    const color = new THREE.Color(colorHex);
    
    let geometry, material;
    
    switch(type) {
      case 'tower':
        // 高塔：细长，向上
        geometry = new THREE.CylinderGeometry(size * 0.3, size * 0.5, height * 3, 8);
        material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.8,
          roughness: 0.2,
          metalness: 0.8
        });
        break;
        
      case 'dome':
        // 穹顶：圆润，包容
        geometry = new THREE.SphereGeometry(size * 1.5, 16, 16);
        material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.4,
          roughness: 0.1,
          metalness: 0.3,
          transparent: true,
          opacity: 0.7
        });
        break;
        
      case 'bridge':
        // 桥梁：连接，延伸
        geometry = new THREE.BoxGeometry(size * 4, size * 0.2, size * 0.5);
        material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.6,
          roughness: 0.5,
          metalness: 0.7
        });
        break;
        
      case 'node':
        // 节点：核心，汇聚
        geometry = new THREE.IcosahedronGeometry(size * 0.8, 1);
        material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: new THREE.Color(1, 1, 1),
          emissiveIntensity: 1.0,
          roughness: 0.0,
          metalness: 1.0
        });
        break;
        
      default: // column
        // 柱子：基础，支撑
        geometry = new THREE.BoxGeometry(size, height, size);
        material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.3,
          roughness: 0.6,
          metalness: 0.4
        });
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(point);
    
    // 朝向路径方向
    if (direction) {
      const target = point.clone().add(direction);
      mesh.lookAt(target);
    }
    
    // 用户数据用于动画
    mesh.userData = {
      type: type,
      birthTime: Date.now(),
      targetScale: 1,
      pulseSpeed: 0.002 + Math.random() * 0.003
    };
    
    return mesh;
  }
  
  animateGrowth(mesh: any, spread: number) {
    const target = 0.5 + spread * 1.5;
    const duration = 500; // 0.5秒生长动画
    
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 弹性缓出
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentScale = ease * target;
      
      if (mesh && mesh.scale) {
        mesh.scale.set(currentScale, currentScale, currentScale);
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }
  
  update() {
    // 持续生长
    this.updateGrowth();
    
    // 更新已有建筑的动画
    const now = Date.now();
    if (this.structures && this.structures.children) {
      this.structures.children.forEach((mesh: any) => {
        const age = now - mesh.userData.birthTime;
        
        // 脉冲呼吸
        const pulse = 1 + Math.sin(age * mesh.userData.pulseSpeed) * 0.05;
        if (mesh.scale && mesh.scale.x > 0) {
          mesh.scale.multiplyScalar(pulse / mesh.scale.x); // 保持比例
        }
        
        // 老的建筑逐渐降低发光
        if (age > 10000 && mesh.material && mesh.material.emissiveIntensity !== undefined) {
          mesh.material.emissiveIntensity *= 0.999;
        }
      });
    }
  }
  
  clear() {
    this.trail.clear();
    this.growthIndex = 0;
    
    // 清理所有建筑
    if (this.structures) {
      while(this.structures.children.length > 0) {
        const mesh = this.structures.children[0];
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m: any) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
        this.structures.remove(mesh);
      }
    }
  }

  dispose() {
    this.clear();
    if (this.scene && this.structures) {
      this.scene.remove(this.structures);
    }
  }
}

class CameraFollow {
  public targetPosition: any;
  public lookAtTarget: any;
  public smoothSpeed = 0.05;

  constructor() {
    const THREE = (window as any).THREE;
    if (THREE) {
      this.targetPosition = new THREE.Vector3(0, 0, 10);
      this.lookAtTarget = new THREE.Vector3(0, 0, 0);
    }
  }
  
  update(trail: GestureTrail, camera: any) {
    const THREE = (window as any).THREE;
    if (!THREE || !camera || trail.points.length < 2) return;
    
    // 相机跟随轨迹末端
    const lastPoint = trail.points[trail.points.length - 1];
    const secondLast = trail.points[trail.points.length - 2];
    
    // 计算相机位置：在轨迹后方、上方
    const direction = lastPoint.clone().sub(secondLast).normalize();
    const cameraOffset = direction.clone().multiplyScalar(-8);  // 后方8单位
    cameraOffset.y += 5;  // 上方5单位
    cameraOffset.x += 3;  // 右侧3单位
    
    this.targetPosition.copy(lastPoint).add(cameraOffset);
    this.lookAtTarget.copy(lastPoint);
    
    // 平滑移动
    camera.position.lerp(this.targetPosition, this.smoothSpeed);
    
    // 平滑看向
    const currentLookAt = new THREE.Vector3(0, 0, -1);
    currentLookAt.applyQuaternion(camera.quaternion);
    currentLookAt.lerp(this.lookAtTarget, this.smoothSpeed);
    camera.lookAt(currentLookAt);
  }
  
  reset(camera: any) {
    if (camera) {
      camera.position.set(0, -32, 24);
      camera.lookAt(0, 4, 0);
    }
  }
}

const getEmotionKey = (id: string): string => {
  if (id === 'deep-sea' || id === 'deepblue') return 'deepblue';
  if (id === 'lava-red' || id === 'magma') return 'magma';
  if (id === 'sakura-pink' || id === 'sakura') return 'sakura';
  if (id === 'rust-green' || id === 'rust') return 'rust';
  if (id === 'heart-red' || id === 'heartbeat') return 'heartbeat';
  if (id === 'mist-white' || id === 'fog') return 'fog';
  return 'deepblue'; // fallback
};

export class VisualEngine {
  private canvas: HTMLCanvasElement;
  private renderer: any = null;
  private scene: any = null;
  private camera: any = null;
  private mesh: any = null;
  private wireframeMesh: any = null;
  private material: any = null;
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // New private properties for dynamic grid, point lights, and growthSystem
  private pointLight: any = null;
  private growthSystem: TrailArchitecture | null = null;
  private cameraFollow: CameraFollow | null = null;

  // Gesture velocity state
  private lastGestureTime = 0;
  private lastGestureX = 0.5;
  private lastGestureY = 0.5;

  // Parameters
  private startTime = Date.now();
  private handDataRef: React.MutableRefObject<HandData>;
  private getAudioEnergy: () => number;
  private currentEmotion: Emotion;

  // FPS tracking
  private lastTime = Date.now();
  private frameCount = 0;
  private onFpsUpdate: (fps: number) => void;

  // Accumulative architecture properties
  public mode: 'free' | 'accumulate' = 'free';
  private architectureMesh: any = null;
  private instanceCount = 0;
  private MAX_INSTANCES = 1000;
  private lastSpawnTime = 0;
  private startAccumulateTime = 0;
  private accumulatedAge = 0; // age in seconds
  private lastPosition: any = null;
  private lastColor: any = null;
  private growingElements: GrowingElement[] = [];
  private customStructures: any[] = [];
  private lastGesturePos: any = null;

  // Particles
  private particles: Particle[] = [];
  private particleGeometry: any = null;
  private particleMaterial: any = null;
  private particlePoints: any = null;

  // Callback for architecture updates
  private onArchUpdate?: (count: number, age: number) => void;

  // Background and lighting elements for visibility
  private backgroundGeometry: any = null;
  private backgroundMaterial: any = null;
  private backgroundPoints: any = null;
  private backgroundParticleCount = 1000;
  private bgParticleData: any[] = [];
  private lastSpread = 0.5;

  constructor(
    canvas: HTMLCanvasElement,
    emotion: Emotion,
    handDataRef: React.MutableRefObject<HandData>,
    getAudioEnergy: () => number,
    onFpsUpdate: (fps: number) => void,
    onArchUpdate?: (count: number, age: number) => void
  ) {
    this.canvas = canvas;
    this.currentEmotion = emotion;
    this.handDataRef = handDataRef;
    this.getAudioEnergy = getAudioEnergy;
    this.onFpsUpdate = onFpsUpdate;
    this.onArchUpdate = onArchUpdate;

    this.init();
  }

  private init() {
    const THREE = (window as any).THREE;
    if (!THREE) {
      console.error('Three.js is not loaded on the window object.');
      return;
    }

    const width = this.canvas.clientWidth || 1280;
    const height = this.canvas.clientHeight || 720;

    // 1. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true // Crucial for MediaRecorder capturing canvas!
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Performance cap

    // 2. Scene
    this.scene = new THREE.Scene();

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, -32, 24);
    this.camera.lookAt(0, 4, 0);

    // 4. Custom Shader Material
    const hexToRgb = (hex: string) => {
      const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
      return result
        ? new THREE.Vector3(
            parseInt(result[1], 16) / 255,
            parseInt(result[2], 16) / 255,
            parseInt(result[3], 16) / 255
          )
        : new THREE.Vector3(0, 0, 0);
    };

    const color1 = hexToRgb(this.currentEmotion.colors[0]);
    const color2 = hexToRgb(this.currentEmotion.colors[1]);

    const vertexShader = `
      uniform float u_time;
      uniform float u_audioEnergy;
      uniform float u_handX;
      uniform float u_handY;
      uniform float u_spread;
      uniform float u_angle;

      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying float vElevation;

      void main() {
        vUv = uv;
        vNormal = normalMatrix * normal;

        // Scale coords for waves
        float distValX = (uv.x - 0.5) * 4.0 * 3.14159;
        float distValY = (uv.y - 0.5) * 4.0 * 3.14159;

        // Base wave height
        float height = sin(distValX + u_time * 0.8) * cos(distValY + u_time * 0.8);

        // Y positioning height effects: Grow spires if y > 0.7, sink if y < 0.3
        float spireFactor = 1.0;
        if (u_handY > 0.7) {
          spireFactor = 1.0 + (u_handY - 0.7) * 7.5;
          height = pow(abs(height), 1.8) * sign(height) * spireFactor;
        } else if (u_handY < 0.3) {
          spireFactor = u_handY / 0.3; // Sinks down towards 0
          height *= spireFactor;
        }

        // Spread density effect: add complex micro-structures as hand spreads wider
        float detailFreq = 4.0 + u_spread * 14.0;
        float detailAmp = 0.05 + u_spread * 0.45;
        height += sin(distValX * detailFreq + u_time * 1.5) * cos(distValY * detailFreq + u_time * 1.5) * detailAmp;

        // Audio energy scales overall elevation amplitude
        float elevation = height * (0.8 + u_audioEnergy * 4.5);

        vec3 pos = position;
        pos.z += elevation;

        // Horizontal distortion based on hand X position (shearing)
        float shearFactor = (u_handX - 0.5) * 8.0;
        pos.x += sin(pos.y * 0.15 + u_time) * shearFactor;

        vElevation = elevation;
        vPosition = pos;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform int u_materialType;
      uniform float u_audioEnergy;
      uniform float u_time;

      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying float vElevation;

      void main() {
        // Base gradient based on elevation
        float colorRatio = clamp((vElevation + 4.0) / 10.0, 0.0, 1.0);
        vec3 baseColor = mix(u_color1, u_color2, colorRatio);

        // Sound intensity amplifies brightness
        baseColor += vec3(0.12) * u_audioEnergy;

        vec3 finalColor = baseColor;

        // Rim/Edge glowing based on peaks
        float rimGlow = smoothstep(0.1, 3.5, vElevation) * 1.4;
        vec3 glow = u_color2 * rimGlow * (0.9 + u_audioEnergy * 0.6);

        if (u_materialType == 0) {
          // GLASS: Clean transparency, high fresnel glow highlights
          float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.5);
          finalColor = mix(baseColor * 0.9, vec3(1.0, 1.0, 1.0), fresnel * 0.85);
          finalColor += glow * 0.35;
        } 
        else if (u_materialType == 1) {
          // METAL: High specular sheen, shifting highlights
          float shimmer = abs(sin(vPosition.x * 0.25 + vPosition.y * 0.25 + u_time * 1.2));
          vec3 sheen = vec3(0.95, 0.9, 0.85) * pow(shimmer, 12.0) * 0.75;
          finalColor = baseColor * 0.65 + sheen + glow * 0.6;
        } 
        else {
          // NEON: Tech grid overlays, vibrant lines
          float gridX = step(0.96, sin(vPosition.x * 2.5));
          float gridY = step(0.96, sin(vPosition.y * 2.5));
          float grid = max(gridX, gridY);
          vec3 lineGlow = mix(vec3(0.0), u_color2 * 2.5, grid);
          finalColor = mix(baseColor * 0.25, lineGlow, grid);
          finalColor += glow * 1.5;
        }

        // Soft fade out towards the geometry boundary edge
        float borderFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x) *
                           smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);

        gl_FragColor = vec4(finalColor, borderFade * 0.95);
      }
    `;

    // Uniform structures
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_audioEnergy: { value: 0 },
        u_handX: { value: 0.5 },
        u_handY: { value: 0.5 },
        u_spread: { value: 0.4 },
        u_angle: { value: 0 },
        u_color1: { value: color1 },
        u_color2: { value: color2 },
        u_materialType: { value: 0 } // Default: Glass
      },
      transparent: true,
      side: THREE.DoubleSide
    });

    // 5. Plane Geometry (Parametric Building Base)
    // 64x64 size with 128 segments to make peaks sharp and beautiful
    const geometry = new THREE.PlaneGeometry(64, 64, 128, 128);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    // 1. Ambient Light (Ensure sufficient intensity - Problem D)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Directional light
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    this.scene.add(dirLight);

    // 2. Emotion Color Point Light (Problem D)
    const hexToColor = (hex: string) => {
      const cleanHex = hex.replace('#', '');
      const r = parseInt(cleanHex.substring(0, 2), 16) || 255;
      const g = parseInt(cleanHex.substring(2, 4), 16) || 255;
      const b = parseInt(cleanHex.substring(4, 6), 16) || 255;
      return new THREE.Color(r / 255, g / 255, b / 255);
    };

    const emotionColor = hexToColor(this.currentEmotion.colors[1] || '#ffffff');
    this.pointLight = new THREE.PointLight(emotionColor, 0.5, 30);
    this.pointLight.position.set(0, 5, 0);
    this.scene.add(this.pointLight);

    // 3 & 4. Set background and fog (and dynamic GridHelper) based on emotion (Problem A)
    this.setBackground(getEmotionKey(this.currentEmotion.id));

    const style = this.currentEmotion?.architectureStyle || 'ruins';

    // 5. Ambient starfield/background particles
    this.initBackgroundParticles(style);

    // 6. Set up ResizeObserver to follow the canvas size container
    this.resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      this.resize(width, height);
    });
    this.resizeObserver.observe(this.canvas.parentElement || this.canvas);

    // Initialize Accumulative Architecture and Particles
    this.initArchitecture();
    this.initParticles();

    // Start render loop
    this.animate();
  }

  private lastFrameTime = Date.now();
  private prevX = 0.5;
  private prevY = 0.5;

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const THREE = (window as any).THREE;
    if (!THREE || !this.renderer || !this.scene || !this.camera) return;

    // Time calculations
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000;
    const deltaTime = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    const hand = this.handDataRef.current;
    const energy = this.getAudioEnergy();

    // 1. Update uniforms
    this.material.uniforms.u_time.value = elapsed;
    this.material.uniforms.u_audioEnergy.value = energy;
    this.material.uniforms.u_handX.value = hand.x;
    this.material.uniforms.u_handY.value = hand.y;
    this.material.uniforms.u_spread.value = hand.spread;
    this.material.uniforms.u_angle.value = hand.angle;

    // Map X to material types: x < 0.33 Glass(0), 0.33-0.66 Metal(1), > 0.66 Neon(2)
    let materialVal = 0;
    if (hand.x < 0.33) {
      materialVal = 0;
    } else if (hand.x < 0.66) {
      materialVal = 1;
    } else {
      materialVal = 2;
    }
    this.material.uniforms.u_materialType.value = materialVal;

    // 2. Camera / Scene Tilting based on Rotation Angle (Space Layer Perspective Offset)
    // Horizontal -> facing front; Tilt Left -> tilts camera left; Tilt Right -> tilts camera right
    const angleRad = (hand.angle * Math.PI) / 180;
    const tiltTargetX = -angleRad * 25.0; // perspective shift offset
    
    // Smoothly interpolate camera position and lookAt target to avoid jittering
    this.camera.position.x += (tiltTargetX - this.camera.position.x) * 0.1;
    this.camera.lookAt(this.camera.position.x * 0.5, 4, 0);

    // Gently rotate mesh as well for full volumetric view
    this.mesh.rotation.z = elapsed * 0.05 + (hand.x - 0.5) * 0.25;
    this.mesh.rotation.x = -Math.PI / 4.5 + (hand.y - 0.5) * 0.15;

    // 3. Accumulative growth logic
    if (this.mode === 'accumulate') {
      if (this.startAccumulateTime === 0) {
        this.startAccumulateTime = now;
      }
      this.accumulatedAge = (now - this.startAccumulateTime) / 1000;

      if (hand.isActive) {
        const velocity = this.calculateGestureVelocity(hand.x, hand.y);
        if (this.growthSystem) {
          this.growthSystem.updateGesture(hand.x, hand.y, hand.spread, velocity, this.currentEmotion);
        }
        this.updateGestureUI(hand.x, hand.y, hand.spread, velocity);
      } else {
        this.removeGestureUI();
      }

      if (this.growthSystem) {
        this.growthSystem.update();
        this.instanceCount = this.growthSystem.structures.children.length;
      }

      if (this.cameraFollow && this.growthSystem && this.growthSystem.trail.points.length > 2) {
        this.cameraFollow.update(this.growthSystem.trail, this.camera);
      }

      // Update callback with age and count
      if (this.onArchUpdate) {
        this.onArchUpdate(this.instanceCount, Math.floor(this.accumulatedAge));
      }
    } else {
      this.removeGestureUI();
    }

    // 4. Update animated growing elements (0.3s elastic animation)
    if (this.growingElements.length > 0 && this.architectureMesh) {
      this.growingElements = this.growingElements.filter(el => {
        const itemElapsed = now - el.startTime;
        const progress = Math.min(1.0, itemElapsed / 300); // 300ms duration
        
        // Elastic out easing
        const elasticOut = (t: number) => {
          if (t === 0) return 0;
          if (t === 1) return 1;
          return Math.sin(-13 * (t + 1) * Math.PI / 2) * Math.pow(2, -10 * t) + 1;
        };
        const eased = elasticOut(progress);
        
        // Scale starts from 0 to targetScale * eased
        const currentScale = el.targetScale.clone().multiplyScalar(eased);
        
        // Set matrix
        const matrix = new THREE.Matrix4();
        matrix.compose(el.targetPosition, new THREE.Quaternion().setFromEuler(el.targetRotation), currentScale);
        this.architectureMesh.setMatrixAt(el.index, matrix);
        
        // Color: interpolates from white to targetColor
        const white = new THREE.Color(1, 1, 1);
        const currentColor = white.clone().lerp(el.targetColor, progress);
        this.architectureMesh.setColorAt(el.index, currentColor);
        
        return progress < 1.0;
      });

      this.architectureMesh.instanceMatrix.needsUpdate = true;
      if (this.architectureMesh.instanceColor) {
        this.architectureMesh.instanceColor.needsUpdate = true;
      }
    }

    // 4.5 Update custom structures
    if (this.customStructures.length > 0) {
      this.customStructures = this.customStructures.filter(struct => {
        const elapsed = now - struct.birthTime;
        const progress = Math.min(1.0, elapsed / struct.duration);
        const keep = struct.update(progress, elapsed, deltaTime);
        if (!keep) {
          if (this.scene) {
            this.scene.remove(struct.group);
          }
          struct.group.traverse((child: any) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m: any) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
        }
        return keep;
      });
    }

    // 5. Update particles
    this.updateParticles(deltaTime);

    // Micro-structure generation from small active gesture shifts
    if (hand.isActive) {
      const gesture = {
        x: hand.x,
        y: hand.y,
        spread: hand.spread,
        vx: hand.vx || 0,
        vy: hand.vy || 0
      };
      const microEvent = this.generateMicroStructure(gesture);
      if (microEvent) {
        this.renderMicroStructure(microEvent);
      }
      this.lastSpread = hand.spread;
    }

    // Update background particles
    if (this.backgroundPoints && this.backgroundGeometry) {
      const posAttr = this.backgroundGeometry.attributes.position;
      const style = this.currentEmotion?.architectureStyle || 'ruins';

      for (let i = 0; i < this.backgroundParticleCount; i++) {
        const data = this.bgParticleData[i];
        let px = posAttr.getX(i);
        let py = posAttr.getY(i);
        let pz = posAttr.getZ(i);

        if (style === 'ruins') {
          // plankton: gentle floating drift
          px += data.driftX * deltaTime;
          py += data.driftY * deltaTime;
        } else if (style === 'pipes') {
          // sparks: rise upwards
          py += data.speed * 8 * deltaTime;
          px += Math.sin(elapsed * 2 + i) * 0.05;
          if (py > 50) py = -50;
        } else if (style === 'karesansui') {
          // cherry blossoms: drift down and sideways
          py -= data.speed * 2 * deltaTime;
          px += (data.driftX - 0.1) * deltaTime * 2;
          if (py < -50) py = 50;
          if (px < -50) px = 50;
        } else if (style === 'factory') {
          // dust: slow brownian motion
          px += (Math.random() - 0.5) * 0.02;
          py += (Math.random() - 0.5) * 0.02;
          pz += (Math.random() - 0.5) * 0.02;
        } else if (style === 'vascular') {
          // blood cells: pulsing speed
          const pulse = Math.sin(elapsed * 6) * 0.5 + 1.0;
          px += data.driftX * pulse * deltaTime;
          py += data.driftY * pulse * deltaTime;
        } else if (style === 'clouds') {
          // mist: drift down slowly
          py -= data.speed * 1 * deltaTime;
          if (py < -50) py = 50;
        }

        posAttr.setXYZ(i, px, py, pz);
      }
      posAttr.needsUpdate = true;
    }

    // Update speed tracker coords
    this.prevX = hand.x;
    this.prevY = hand.y;

    // 6. Render
    this.renderer.render(this.scene, this.camera);

    // FPS Counter calculation
    this.frameCount++;
    if (now - this.lastTime >= 1000) {
      this.onFpsUpdate(this.frameCount);
      this.frameCount = 0;
      this.lastTime = now;
    }
  };

  public updateEmotion(emotion: Emotion) {
    const THREE = (window as any).THREE;
    if (!THREE || !this.material) return;

    this.currentEmotion = emotion;

    const hexToRgb = (hex: string) => {
      const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
      return result
        ? new THREE.Vector3(
            parseInt(result[1], 16) / 255,
            parseInt(result[2], 16) / 255,
            parseInt(result[3], 16) / 255
          )
        : new THREE.Vector3(0, 0, 0);
    };

    const color1 = hexToRgb(emotion.colors[0]);
    const color2 = hexToRgb(emotion.colors[1]);

    this.material.uniforms.u_color1.value.copy(color1);
    this.material.uniforms.u_color2.value.copy(color2);

    // Update background color, fog and light color on emotion switch (Problem A & Problem D)
    const emotionKey = getEmotionKey(emotion.id);
    this.setBackground(emotionKey);

    if (this.pointLight) {
      const colorHex = emotion.colors && emotion.colors[1] ? emotion.colors[1] : '#ffffff';
      const color = new THREE.Color(colorHex);
      this.pointLight.color = color;
      this.pointLight.intensity = 0.5 + ((emotion as any).energy !== undefined ? (emotion as any).energy : 0.5) * 0.5;
    }
  }

  private setBackground(emotionKey: string) {
    const THREE = (window as any).THREE;
    if (!THREE || !this.scene) return;

    // 设置背景色（不是纯黑！）
    const EMOTION_BG_COLORS: Record<string, number[]> = {
      deepblue: [5, 10, 25],      // 深海蓝
      magma: [25, 5, 5],          // 岩浆红
      sakura: [20, 15, 18],       // 樱花粉
      rust: [10, 15, 10],         // 锈绿
      heartbeat: [15, 5, 5],      // 心跳红
      fog: [18, 18, 22]           // 雾白
    };

    const bgArr = EMOTION_BG_COLORS[emotionKey] || [5, 10, 25];
    const bgColor = new THREE.Color(bgArr[0] / 255, bgArr[1] / 255, bgArr[2] / 255);

    this.scene.background = bgColor;
    this.scene.fog = new THREE.Fog(bgColor, 20, 60);

    // Update lights color on emotion change
    const emotionColorHex = this.currentEmotion.colors && this.currentEmotion.colors[1]
      ? this.currentEmotion.colors[1]
      : '#ffffff';
    const emotionColor = new THREE.Color(emotionColorHex);

    this.scene.children.forEach((child: any) => {
      if (child.isDirectionalLight) {
        child.color.lerp(emotionColor, 0.3);
      }
    });
  }

  private initArchitecture() {
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      roughness: 0.3,
      metalness: 0.7
    });

    this.architectureMesh = new THREE.InstancedMesh(geometry, material, this.MAX_INSTANCES);
    this.architectureMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.architectureMesh.visible = false; // default mode is 'free'
    this.scene.add(this.architectureMesh);

    // Initialize all scales to 0 so they don't show at origin
    const dummyMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.MAX_INSTANCES; i++) {
      this.architectureMesh.setMatrixAt(i, dummyMatrix);
    }
    this.architectureMesh.instanceMatrix.needsUpdate = true;
  }

  private initParticles() {
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const particleCount = 300;
    this.particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i++) {
      positions[i] = 99999; // start off-screen
      colors[i] = 1;
    }

    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particlePoints = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.scene.add(this.particlePoints);

    this.particles = [];
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(),
        size: 0.4,
        age: 0,
        maxAge: 0,
        active: false
      });
    }
  }

  // --- Custom emotional generators ---
  private generateDeepBlueStructure(gesture: any) {
    const { x, y, spread, speed } = gesture;
    if (speed < 0.01) {
      return {
        type: 'coral_branch',
        branches: 2 + Math.floor(spread * 3),
        angle: Math.random() * Math.PI,
        length: 0.5 + spread * 2,
        curvature: 0.3,
        thickness: 0.1 + spread * 0.3,
        color: [10, 30, 80 + Math.random() * 40]
      };
    } else {
      return {
        type: 'fish_trail',
        trailLength: speed * 10,
        trailWidth: spread * 0.5,
        turbulence: speed * 2,
        color: [20, 50, 120]
      };
    }
  }

  private generateMagmaStructure(gesture: any) {
    const { x, y, spread, acceleration } = gesture;
    if (acceleration > 0.05) {
      return {
        type: 'eruption',
        origin: { x, y },
        force: acceleration * 5,
        fragments: 20 + Math.floor(spread * 30),
        color: [255, 80 + Math.random() * 100, 10],
        coolingTime: 2000
      };
    } else {
      return {
        type: 'lava_pipe',
        direction: { x, y },
        flowRate: spread * 3,
        viscosity: 0.8,
        surfaceCrust: Math.random() > 0.7,
        color: [200 + Math.random() * 55, 30, 5]
      };
    }
  }

  private generateSakuraStructure(gesture: any) {
    const { x, y, spread, speed } = gesture;
    if (speed < 0.01 && spread < 0.05) {
      return {
        type: 'stone_group',
        position: { x, y },
        stones: 3 + Math.floor(Math.random() * 3),
        size: 0.5 + spread,
        moss: Math.random() > 0.5,
        color: [240, 240, 245]
      };
    } else {
      return {
        type: 'sand_ripple',
        center: { x, y },
        radius: speed * 5,
        amplitude: spread * 0.3,
        decay: 0.95,
        color: [250, 240, 245]
      };
    }
  }

  private generateRustStructure(gesture: any) {
    const { x, y, spread, rotation, shape } = gesture;
    if (shape === 'pinch') {
      return {
        type: 'gear_mesh',
        position: { x, y },
        teeth: 8 + Math.floor(spread * 12),
        radius: 0.5 + spread,
        rotation: rotation || 0,
        rustLevel: 0.3 + Math.random() * 0.7,
        color: [60 + Math.random() * 40, 80, 50]
      };
    } else {
      return {
        type: 'industrial_pipe',
        from: this.lastGesturePos ? { x: this.lastGesturePos.x, y: this.lastGesturePos.y } : { x, y },
        to: { x, y },
        diameter: 0.2 + spread * 0.5,
        valves: Math.random() > 0.6 ? 1 : 0,
        leaks: Math.random() > 0.8 ? 1 : 0,
        color: [80, 90, 70]
      };
    }
  }

  private generateHeartbeatStructure(gesture: any) {
    const { x, y, spread, speed } = gesture;
    if (speed > 0.01) {
      return {
        type: 'vessel_fork',
        origin: { x, y },
        branches: 2,
        angle: Math.PI / 4 + Math.random() * Math.PI / 4,
        thickness: 0.1 + spread * 0.3,
        pulsePhase: (Date.now() % 1000) / 1000,
        color: [180 + Math.random() * 40, 20, 20]
      };
    } else {
      return {
        type: 'capillary_mesh',
        center: { x, y },
        density: spread * 50,
        pulseRate: 60 + spread * 40,
        oxygenation: 0.7 + Math.random() * 0.3,
        color: [200, 30, 30]
      };
    }
  }

  private generateFogStructure(gesture: any) {
    const { x, y, spread, rotation } = gesture;
    return {
      type: 'cloud_mass',
      position: { x, y },
      volume: spread * 5,
      density: 0.3 + Math.random() * 0.4,
      turbulence: (rotation || 0) * 2,
      drift: { x: Math.random() * 0.01, y: -0.01 },
      color: [230 + Math.random() * 20, 230 + Math.random() * 20, 240 + Math.random() * 10]
    };
  }

  // --- Unified render event system ---
  public renderEvent(event: any) {
    const THREE = (window as any).THREE;
    if (!THREE || !this.scene) return;

    const group = new THREE.Group();
    this.scene.add(group);

    let duration = 4000; // default duration
    let updateFn: (progress: number, elapsed: number, deltaTime: number) => boolean = () => true;

    switch (event.type) {
      case 'coral_branch': {
        const { branches, angle, length, curvature, thickness, color } = event;
        duration = 5000;
        const startPos = new THREE.Vector3((this.handDataRef.current.x - 0.5) * 24, (this.handDataRef.current.y - 0.5) * 16, -5);

        for (let i = 0; i < branches; i++) {
          const theta = (i / branches) * Math.PI * 2 + angle;
          const phi = Math.random() * Math.PI * 0.4;
          const endOffset = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * length,
            Math.cos(phi) * length,
            Math.sin(phi) * Math.sin(theta) * length
          );
          const midPos = startPos.clone().addScaledVector(endOffset, 0.5);
          midPos.x += (Math.random() - 0.5) * curvature * length;
          midPos.y += (Math.random() - 0.5) * curvature * length;
          midPos.z += (Math.random() - 0.5) * curvature * length;

          const endPos = startPos.clone().add(endOffset);
          const curve = new THREE.CatmullRomCurve3([startPos, midPos, endPos]);
          const tubeGeo = new THREE.TubeGeometry(curve, 12, thickness, 8, false);
          const tubeMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
            emissive: new THREE.Color(color[0]/255 * 0.2, color[1]/255 * 0.2, color[2]/255 * 0.5),
            roughness: 0.2,
            metalness: 0.9,
            transparent: true,
            opacity: 0.0
          });
          const branchMesh = new THREE.Mesh(tubeGeo, tubeMat);
          group.add(branchMesh);
        }

        updateFn = (progress: number) => {
          group.traverse((child: any) => {
            if (child.isMesh && child.material) {
              let alpha = 0.9;
              if (progress < 0.1) alpha = (progress / 0.1) * 0.9;
              else if (progress > 0.8) alpha = ((1.0 - progress) / 0.2) * 0.9;
              child.material.opacity = alpha;

              const pulse = Math.sin(progress * Math.PI * 5) * 0.5 + 0.5;
              child.material.emissive.setRGB(
                (color[0]/255) * 0.1 * pulse,
                (color[1]/255) * 0.1 * pulse,
                (color[2]/255) * 0.6 * pulse
              );
            }
          });
          return progress < 1.0;
        };
        break;
      }

      case 'fish_trail': {
        const { trailLength, trailWidth, turbulence, color } = event;
        duration = 3000;
        const startPos = new THREE.Vector3((this.handDataRef.current.x - 0.5) * 24, (this.handDataRef.current.y - 0.5) * 16, -5);
        const fishCount = 6;
        const fishMeshes: any[] = [];
        const fishPositions: any[] = [];
        const fishOffsets: any[] = [];

        for (let i = 0; i < fishCount; i++) {
          const coneGeo = new THREE.ConeGeometry(0.12, 0.4, 4);
          coneGeo.rotateX(Math.PI / 2);
          const coneMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
            transparent: true,
            opacity: 0.8
          });
          const mesh = new THREE.Mesh(coneGeo, coneMat);
          const offset = new THREE.Vector3(
            (Math.random() - 0.5) * trailWidth * 2,
            (Math.random() - 0.5) * trailWidth * 2,
            (Math.random() - 0.5) * 2
          );
          mesh.position.copy(startPos).add(offset);
          group.add(mesh);
          fishMeshes.push(mesh);
          fishPositions.push(mesh.position.clone());
          fishOffsets.push(offset);
        }

        updateFn = (progress: number) => {
          fishMeshes.forEach((mesh, idx) => {
            const sw = Math.sin(progress * Math.PI * 6 + idx) * turbulence * 0.5;
            const basePos = fishPositions[idx];
            mesh.position.x = basePos.x + progress * trailLength * 4;
            mesh.position.y = basePos.y + sw;
            mesh.position.z = basePos.z + Math.cos(progress * Math.PI * 4 + idx) * turbulence * 0.3;
            mesh.rotation.y = Math.PI / 2 + sw * 0.5;
            mesh.material.opacity = 0.8 * (1.0 - progress);
          });
          return progress < 1.0;
        };
        break;
      }

      case 'lava_pipe': {
        const { flowRate, color } = event;
        duration = 4000;
        const hand = this.handDataRef.current;
        const startPos = new THREE.Vector3((this.prevX - 0.5) * 24, (this.prevY - 0.5) * 16, -5);
        const endPos = new THREE.Vector3((hand.x - 0.5) * 24, (hand.y - 0.5) * 16, -5);
        const midPos = startPos.clone().lerp(endPos, 0.5);
        midPos.z += 1.0 + flowRate;

        const curve = new THREE.CatmullRomCurve3([startPos, midPos, endPos]);
        const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.4 + flowRate * 0.15, 12, false);

        const posAttr = tubeGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const px = posAttr.getX(i);
          const py = posAttr.getY(i);
          const pz = posAttr.getZ(i);
          const r = Math.sin(py * 3.0) * 0.15;
          posAttr.setX(i, px + (Math.random() - 0.5) * r);
          posAttr.setZ(i, pz + (Math.random() - 0.5) * r);
        }
        posAttr.needsUpdate = true;
        tubeGeo.computeVertexNormals();

        const tubeMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
          emissive: new THREE.Color(color[0]/255 * 0.8, color[1]/255 * 0.1, color[2]/255 * 0.0),
          roughness: 0.9,
          metalness: 0.1,
          transparent: true,
          opacity: 0.9
        });
        const pipeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        group.add(pipeMesh);

        updateFn = (progress: number) => {
          const wave = Math.sin(progress * Math.PI * 4) * 0.15 + 1.0;
          pipeMesh.scale.set(wave, wave, wave);
          const heat = Math.sin(progress * Math.PI * 4) * 0.3 + 0.7;
          tubeMat.emissive.setRGB(
            (color[0]/255) * 0.8 * heat,
            (color[1]/255) * 0.15 * heat,
            0.0
          );
          tubeMat.opacity = 0.9 * (1.0 - progress);
          return progress < 1.0;
        };
        break;
      }

      case 'eruption': {
        const { force, fragments, color, coolingTime } = event;
        duration = coolingTime || 2000;
        const hand = this.handDataRef.current;
        const startPos = new THREE.Vector3((hand.x - 0.5) * 24, (hand.y - 0.5) * 16, -5);
        const fragCount = Math.min(40, fragments);
        const fragMeshes: any[] = [];
        const fragVelocities: any[] = [];
        const fragColors: any[] = [];

        for (let i = 0; i < fragCount; i++) {
          const size = 0.1 + Math.random() * 0.3;
          const geo = Math.random() > 0.5 ? new THREE.DodecahedronGeometry(size) : new THREE.BoxGeometry(size, size, size);
          const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
            transparent: true,
            opacity: 1.0
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.copy(startPos);
          group.add(mesh);
          fragMeshes.push(mesh);
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI * 0.5;
          const speedVal = (0.5 + Math.random() * 1.5) * force * 3;
          const vel = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * speedVal,
            Math.cos(phi) * speedVal * 1.8,
            Math.sin(phi) * Math.sin(theta) * speedVal
          );
          fragVelocities.push(vel);
          fragColors.push(new THREE.Color(color[0]/255, color[1]/255, color[2]/255));
        }

        updateFn = (progress: number, elapsed: number, deltaTime: number) => {
          const gravity = -18.0;
          fragMeshes.forEach((mesh, idx) => {
            const vel = fragVelocities[idx];
            vel.y += gravity * deltaTime;
            mesh.position.addScaledVector(vel, deltaTime);
            mesh.rotation.x += 2 * deltaTime;
            mesh.rotation.y += 3 * deltaTime;

            if (mesh.position.y < -8.0) {
              mesh.position.y = -8.0;
              vel.y = -vel.y * 0.4;
              vel.x *= 0.8;
              vel.z *= 0.8;
            }

            const startC = fragColors[idx];
            const blackC = new THREE.Color(0.05, 0.05, 0.05);
            const coolFactor = Math.min(1.0, progress * 1.5);
            mesh.material.color.copy(startC).lerp(blackC, coolFactor);
            mesh.material.opacity = 1.0 - progress;
          });
          return progress < 1.0;
        };
        break;
      }

      case 'stone_group': {
        const { position, stones, size, moss, color } = event;
        duration = 6000;
        const startPos = new THREE.Vector3((position.x - 0.5) * 24, (position.y - 0.5) * 16, -5);
        const rockGroup = new THREE.Group();
        const mossGroup = new THREE.Group();
        group.add(rockGroup);
        group.add(mossGroup);

        const numStones = stones;
        for (let i = 0; i < numStones; i++) {
          const sSize = size * (0.6 + Math.random() * 0.7);
          const stoneGeo = new THREE.DodecahedronGeometry(sSize, 1);
          const posAttr = stoneGeo.attributes.position;
          for (let k = 0; k < posAttr.count; k++) {
            posAttr.setY(k, posAttr.getY(k) * (1.2 + Math.random() * 0.6));
          }
          stoneGeo.computeVertexNormals();

          const stoneMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true,
            transparent: true,
            opacity: 0.0
          });
          const stoneMesh = new THREE.Mesh(stoneGeo, stoneMat);
          stoneMesh.position.set(
            startPos.x + (Math.random() - 0.5) * size * 1.5,
            startPos.y + (Math.random() - 0.5) * size * 0.5,
            startPos.z + (Math.random() - 0.5) * size * 1.5
          );
          stoneMesh.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
          rockGroup.add(stoneMesh);

          if (moss) {
            const mossGeo = new THREE.IcosahedronGeometry(sSize * 0.6, 1);
            const mossMat = new THREE.MeshStandardMaterial({
              color: new THREE.Color(0.2, 0.45, 0.15),
              roughness: 1.0,
              flatShading: true,
              transparent: true,
              opacity: 0.0
            });
            const mossMesh = new THREE.Mesh(mossGeo, mossMat);
            mossMesh.position.copy(stoneMesh.position);
            mossMesh.position.y -= sSize * 0.3;
            mossMesh.scale.set(0.01, 0.01, 0.01);
            mossGroup.add(mossMesh);
          }
        }

        updateFn = (progress: number) => {
          rockGroup.traverse((child: any) => {
            if (child.isMesh && child.material) {
              let alpha = 1.0;
              if (progress < 0.2) alpha = progress / 0.2;
              else if (progress > 0.8) alpha = (1.0 - progress) / 0.2;
              child.material.opacity = alpha;
            }
          });
          mossGroup.traverse((child: any) => {
            if (child.isMesh) {
              const s = Math.min(1.2, progress * 4.0);
              child.scale.set(s, s, s);
              let alpha = 0.95;
              if (progress < 0.1) alpha = progress / 0.1;
              else if (progress > 0.8) alpha = (1.0 - progress) / 0.2;
              child.material.opacity = alpha;
            }
          });
          return progress < 1.0;
        };
        break;
      }

      case 'sand_ripple': {
        const { center, radius, amplitude, decay, color } = event;
        duration = 3000;
        const startPos = new THREE.Vector3((center.x - 0.5) * 24, (center.y - 0.5) * 16, -5);
        const rippleCount = 3;
        const ripples: any[] = [];

        for (let i = 0; i < rippleCount; i++) {
          const ringGeo = new THREE.RingGeometry(0.1, 1.2, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.0
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.copy(startPos);
          group.add(ring);
          ripples.push({
            mesh: ring,
            delay: i * 150,
            mat: ringMat
          });
        }

        updateFn = (progress: number, elapsed: number) => {
          ripples.forEach((rip) => {
            const activeElapsed = elapsed - rip.delay;
            if (activeElapsed < 0) return;
            const t = Math.min(1.0, activeElapsed / 1000);
            const scaleVal = t * radius * 10;
            rip.mesh.scale.set(scaleVal, scaleVal, 1);
            rip.mesh.position.z = -5 + Math.sin(t * Math.PI * 4) * amplitude * 5;
            rip.mat.opacity = 0.5 * (1.0 - t) * Math.pow(decay, t * 10);
          });
          return progress < 1.0;
        };
        break;
      }

      case 'gear_mesh': {
        const { position, teeth, radius, rotation, rustLevel, color } = event;
        duration = 5000;
        const startPos = new THREE.Vector3((position.x - 0.5) * 24, (position.y - 0.5) * 16, -5);

        const shape = new THREE.Shape();
        const innerRadius = radius * 0.7;
        const outerRadius = radius;
        const numTeeth = teeth;

        for (let i = 0; i < numTeeth; i++) {
          const angle1 = (i / numTeeth) * Math.PI * 2;
          const angle2 = ((i + 0.3) / numTeeth) * Math.PI * 2;
          const angle3 = ((i + 0.5) / numTeeth) * Math.PI * 2;
          const angle4 = ((i + 0.8) / numTeeth) * Math.PI * 2;
          const x1 = Math.cos(angle1) * innerRadius;
          const y1 = Math.sin(angle1) * innerRadius;
          const x2 = Math.cos(angle2) * outerRadius;
          const y2 = Math.sin(angle2) * outerRadius;
          const x3 = Math.cos(angle3) * outerRadius;
          const y3 = Math.sin(angle3) * outerRadius;
          const x4 = Math.cos(angle4) * innerRadius;
          const y4 = Math.sin(angle4) * innerRadius;
          if (i === 0) shape.moveTo(x1, y1);
          else shape.lineTo(x1, y1);
          shape.lineTo(x2, y2);
          shape.lineTo(x3, y3);
          shape.lineTo(x4, y4);
        }
        shape.closePath();

        const holePath = new THREE.Path();
        holePath.absarc(0, 0, radius * 0.25, 0, Math.PI * 2, true);
        shape.holes.push(holePath);

        const extrudeSettings = {
          depth: 0.3,
          bevelEnabled: true,
          bevelSegments: 2,
          steps: 1,
          bevelSize: 0.02,
          bevelThickness: 0.02
        };
        const gearGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        gearGeo.center();

        const baseRustColor = new THREE.Color(color[0]/255, color[1]/255, color[2]/255);
        const rustColorOrange = new THREE.Color(0.5, 0.2, 0.05);
        const finalColor = baseRustColor.clone().lerp(rustColorOrange, rustLevel);

        const gearMat = new THREE.MeshStandardMaterial({
          color: finalColor,
          roughness: 0.8,
          metalness: 0.95,
          transparent: true,
          opacity: 0.0
        });
        const gearMesh = new THREE.Mesh(gearGeo, gearMat);
        gearMesh.position.copy(startPos);
        group.add(gearMesh);

        this.burstParticles(startPos, new THREE.Color(0xffaa00));

        updateFn = (progress: number, elapsed: number) => {
          gearMesh.rotation.z = rotation + (elapsed / 1000) * 2.0;
          let scaleVal = 1.0;
          if (progress < 0.2) scaleVal = (progress / 0.2);
          else if (progress > 0.8) scaleVal = (1.0 - progress) / 0.2;
          gearMesh.scale.set(scaleVal, scaleVal, scaleVal);
          gearMat.opacity = Math.min(1.0, scaleVal * 0.95);
          return progress < 1.0;
        };
        break;
      }

      case 'industrial_pipe': {
        const { from, to, diameter, valves, leaks, color } = event;
        duration = 4000;
        const prevCoords = from || { x: this.prevX, y: this.prevY };
        const startPos = new THREE.Vector3((prevCoords.x - 0.5) * 24, (prevCoords.y - 0.5) * 16, -5);
        const endPos = new THREE.Vector3((to.x - 0.5) * 24, (to.y - 0.5) * 16, -5);

        const curve = new THREE.LineCurve3(startPos, endPos);
        const pipeGeo = new THREE.TubeGeometry(curve, 8, diameter, 8, false);
        const pipeMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
          roughness: 0.4,
          metalness: 0.8,
          transparent: true,
          opacity: 0.9
        });
        const pipeMesh = new THREE.Mesh(pipeGeo, pipeMat);
        group.add(pipeMesh);

        const valveMeshes: any[] = [];
        if (valves > 0) {
          const midPos = startPos.clone().lerp(endPos, 0.5);
          const torusGeo = new THREE.TorusGeometry(diameter * 1.8, diameter * 0.3, 8, 16);
          const torusMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.8, 0.1, 0.1),
            roughness: 0.5,
            metalness: 0.8
          });
          const torusMesh = new THREE.Mesh(torusGeo, torusMat);
          torusMesh.position.copy(midPos);
          const direction = endPos.clone().sub(startPos).normalize();
          torusMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
          group.add(torusMesh);
          valveMeshes.push(torusMesh);
        }

        const steamMeshes: any[] = [];
        const steamDirections: any[] = [];
        if (leaks > 0) {
          const leakPos = startPos.clone().lerp(endPos, 0.3 + Math.random() * 0.4);
          for (let k = 0; k < 12; k++) {
            const steamGeo = new THREE.SphereGeometry(0.1, 8, 8);
            const steamMat = new THREE.MeshBasicMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: 0.4
            });
            const steamMesh = new THREE.Mesh(steamGeo, steamMat);
            steamMesh.position.copy(leakPos);
            group.add(steamMesh);
            steamMeshes.push(steamMesh);
            steamDirections.push(new THREE.Vector3(
              (Math.random() - 0.5) * 1.5,
              2.5 + Math.random() * 2.0,
              (Math.random() - 0.5) * 1.5
            ));
          }
        }

        updateFn = (progress: number, elapsed: number, deltaTime: number) => {
          valveMeshes.forEach(mesh => {
            mesh.rotation.z += deltaTime * 2;
          });
          steamMeshes.forEach((steam, idx) => {
            const delayOffset = (idx * 0.08);
            const localProg = (progress + delayOffset) % 1.0;
            const dir = steamDirections[idx];
            const originLeak = startPos.clone().lerp(endPos, 0.5);
            steam.position.copy(originLeak).addScaledVector(dir, localProg);
            const scaleVal = 1.0 + localProg * 4.0;
            steam.scale.set(scaleVal, scaleVal, scaleVal);
            steam.material.opacity = 0.4 * (1.0 - localProg);
          });
          pipeMat.opacity = 0.9 * (1.0 - progress);
          return progress < 1.0;
        };
        break;
      }

      case 'vessel_fork': {
        const { origin, branches, angle, thickness, color } = event;
        duration = 4000;
        const startPos = new THREE.Vector3((origin.x - 0.5) * 24, (origin.y - 0.5) * 16, -5);
        const vesselMeshes: any[] = [];
        const vesselMaterials: any[] = [];

        for (let i = 0; i < branches; i++) {
          const dirAngle = (i === 0 ? 1 : -1) * angle;
          const endOffset = new THREE.Vector3(
            Math.sin(dirAngle) * 2.5,
            Math.cos(dirAngle) * 2.5,
            (Math.random() - 0.5) * 1.5
          );
          const endPos = startPos.clone().add(endOffset);
          const midPos = startPos.clone().lerp(endPos, 0.5);
          midPos.x += (Math.random() - 0.5) * 0.8;
          midPos.y += (Math.random() - 0.5) * 0.8;

          const curve = new THREE.CatmullRomCurve3([startPos, midPos, endPos]);
          const vesselGeo = new THREE.TubeGeometry(curve, 16, thickness, 8, false);
          const vesselMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
            emissive: new THREE.Color(color[0]/255 * 0.4, 0.0, 0.0),
            roughness: 0.1,
            metalness: 0.4,
            transparent: true,
            opacity: 0.9
          });
          const mesh = new THREE.Mesh(vesselGeo, vesselMat);
          group.add(mesh);
          vesselMeshes.push(mesh);
          vesselMaterials.push(vesselMat);
        }

        updateFn = (progress: number) => {
          const heartPulse = Math.sin(progress * Math.PI * 6) * 0.15 + 1.0;
          vesselMeshes.forEach((mesh, idx) => {
            mesh.scale.set(heartPulse, heartPulse, heartPulse);
            const pulseMat = vesselMaterials[idx];
            const lightVal = (Math.sin(progress * Math.PI * 6) * 0.5 + 0.5) * 0.6;
            pulseMat.emissive.setRGB(
              (color[0]/255) * (0.3 + lightVal),
              0.0,
              0.0
            );
            pulseMat.opacity = 0.9 * (1.0 - progress);
          });
          return progress < 1.0;
        };
        break;
      }

      case 'capillary_mesh': {
        const { center, density, pulseRate, oxygenation, color } = event;
        duration = 4000;
        const startPos = new THREE.Vector3((center.x - 0.5) * 24, (center.y - 0.5) * 16, -5);
        const count = Math.min(25, Math.floor(density / 2) + 5);
        const capillaryTubes: any[] = [];

        for (let i = 0; i < count; i++) {
          const endOffset = new THREE.Vector3(
            (Math.random() - 0.5) * 3.5,
            (Math.random() - 0.5) * 3.5,
            (Math.random() - 0.5) * 2.0
          );
          const cStart = startPos.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.5,
            0
          ));
          const cEnd = cStart.clone().add(endOffset);

          const curve = new THREE.LineCurve3(cStart, cEnd);
          const capGeo = new THREE.TubeGeometry(curve, 4, 0.04, 4, false);

          const arterialColor = new THREE.Color(0.85, 0.1, 0.1);
          const venousColor = new THREE.Color(0.4, 0.05, 0.3);
          const capColor = venousColor.clone().lerp(arterialColor, oxygenation);

          const capMat = new THREE.MeshBasicMaterial({
            color: capColor,
            transparent: true,
            opacity: 0.8
          });
          const capMesh = new THREE.Mesh(capGeo, capMat);
          group.add(capMesh);
          capillaryTubes.push({ mesh: capMesh, mat: capMat, baseColor: capColor });
        }

        updateFn = (progress: number) => {
          const beatPulse = Math.sin(progress * Math.PI * 10) * 0.5 + 0.5;
          capillaryTubes.forEach((cap) => {
            const pulseS = 0.8 + beatPulse * 0.4;
            cap.mesh.scale.set(pulseS, 1.0, pulseS);
            const flashColor = cap.baseColor.clone().multiplyScalar(0.5 + beatPulse * 0.6);
            cap.mat.color.copy(flashColor);
            cap.mat.opacity = 0.8 * (1.0 - progress);
          });
          return progress < 1.0;
        };
        break;
      }

      case 'cloud_mass': {
        const { position, volume, density, turbulence, drift, color } = event;
        duration = 5000;
        const startPos = new THREE.Vector3((position.x - 0.5) * 24, (position.y - 0.5) * 16, -5);
        const sphereCount = 10;
        const clouds: any[] = [];
        const cloudOffsets: any[] = [];
        const cloudSpeeds: number[] = [];

        for (let i = 0; i < sphereCount; i++) {
          const sRad = (0.4 + Math.random() * 0.8) * volume * 0.8;
          const cloudGeo = new THREE.SphereGeometry(sRad, 16, 16);
          const cloudMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
            transparent: true,
            opacity: 0.0,
            roughness: 1.0,
            metalness: 0.0
          });
          const mesh = new THREE.Mesh(cloudGeo, cloudMat);
          const offset = new THREE.Vector3(
            (Math.random() - 0.5) * volume * 1.5,
            (Math.random() - 0.5) * volume * 1.5,
            (Math.random() - 0.5) * volume
          );
          mesh.position.copy(startPos).add(offset);
          group.add(mesh);
          clouds.push({ mesh, mat: cloudMat });
          cloudOffsets.push(offset);
          cloudSpeeds.push(0.5 + Math.random() * 1.5);
        }

        const lightningGeo = new THREE.BufferGeometry();
        const lightningMat = new THREE.LineBasicMaterial({
          color: 0x88ccff,
          linewidth: 3,
          transparent: true,
          opacity: 0.0
        });
        const lightningLine = new THREE.Line(lightningGeo, lightningMat);
        group.add(lightningLine);

        updateFn = (progress: number, elapsed: number) => {
          const swirlAngle = progress * Math.PI * 0.5 * (1.0 + turbulence);
          clouds.forEach((cloud, idx) => {
            const offset = cloudOffsets[idx];
            const sp = cloudSpeeds[idx];
            const cosA = Math.cos(swirlAngle * sp);
            const sinA = Math.sin(swirlAngle * sp);
            const rotatedX = offset.x * cosA - offset.z * sinA;
            const rotatedZ = offset.x * sinA + offset.z * cosA;
            const driftY = progress * drift.y * 12;
            const driftX = progress * drift.x * 12;
            const cCenter = new THREE.Vector3((position.x - 0.5) * 24, (position.y - 0.5) * 16, -5);
            cloud.mesh.position.set(
              cCenter.x + rotatedX + driftX,
              cCenter.y + offset.y + driftY,
              cCenter.z + rotatedZ
            );
            let alpha = density * 0.3;
            if (progress < 0.15) alpha = (progress / 0.15) * density * 0.3;
            else if (progress > 0.8) alpha = ((1.0 - progress) / 0.2) * density * 0.3;
            cloud.mat.opacity = alpha;
          });

          const flashChance = Math.random();
          if (flashChance > 0.94 && progress > 0.2 && progress < 0.8) {
            const cloudA = clouds[Math.floor(Math.random() * clouds.length)].mesh.position;
            const cloudB = clouds[Math.floor(Math.random() * clouds.length)].mesh.position;
            const points = [];
            const steps = 6;
            for (let s = 0; s <= steps; s++) {
              const t = s / steps;
              const pt = cloudA.clone().lerp(cloudB, t);
              if (s > 0 && s < steps) {
                pt.x += (Math.random() - 0.5) * 0.8;
                pt.y += (Math.random() - 0.5) * 0.8;
                pt.z += (Math.random() - 0.5) * 0.8;
              }
              points.push(pt);
            }
            lightningGeo.setFromPoints(points);
            lightningGeo.attributes.position.needsUpdate = true;
            lightningMat.opacity = 0.9;
          } else {
            lightningMat.opacity *= 0.5;
          }
          return progress < 1.0;
        };
        break;
      }
    }

    const customStruct = {
      group,
      birthTime: Date.now(),
      duration,
      update: updateFn
    };
    this.customStructures.push(customStruct);
  }

  public spawnArchitecturalElement(x: number, y: number, spread: number) {
    const THREE = (window as any).THREE;
    if (!THREE) return;

    if (this.mode === 'accumulate' && this.growthSystem) {
      const velocity = this.calculateGestureVelocity(x, y);
      this.growthSystem.updateGesture(x, y, spread, velocity, this.currentEmotion);
      this.instanceCount = this.growthSystem.structures.children.length;
    } else {
      // In other modes or fallback, keep previous trigger structures or custom logic
      const currentHand = this.handDataRef.current;
      const speed = currentHand.speed !== undefined ? currentHand.speed : (Math.abs(x - this.prevX) + Math.abs(y - this.prevY));
      const acceleration = currentHand.acceleration !== undefined ? currentHand.acceleration : 0;
      const rotation = currentHand.rotation !== undefined ? currentHand.rotation : 0;
      const shape = currentHand.shape !== undefined ? currentHand.shape : 'open';

      const gesture = {
        x,
        y,
        spread,
        speed,
        acceleration,
        rotation,
        shape
      };

      let event: any = null;
      const style = this.currentEmotion?.architectureStyle || 'ruins';

      if (style === 'ruins') {
        event = this.generateDeepBlueStructure(gesture);
      } else if (style === 'pipes') {
        event = this.generateMagmaStructure(gesture);
      } else if (style === 'karesansui') {
        event = this.generateSakuraStructure(gesture);
      } else if (style === 'factory') {
        event = this.generateRustStructure(gesture);
      } else if (style === 'vascular') {
        event = this.generateHeartbeatStructure(gesture);
      } else if (style === 'clouds') {
        event = this.generateFogStructure(gesture);
      }

      if (event) {
        let type = 'deepblue';
        if (style === 'pipes') type = 'magma';
        else if (style === 'karesansui') type = 'sakura';
        else if (style === 'factory') type = 'rust';
        else if (style === 'vascular') type = 'heartbeat';
        else if (style === 'clouds') type = 'fog';

        this.renderStructure(type, event);
      }
      this.instanceCount++;
    }

    // Trigger musical feedback note
    audioEngine.triggerGrowthNote(x, y, spread);

    if (this.onArchUpdate) {
      this.onArchUpdate(this.instanceCount, Math.floor(this.accumulatedAge));
    }

    this.lastGesturePos = { x, y };
  }

  private burstParticles(position: any, color: any) {
    let activated = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.position.copy(position);

        // Radial outward velocities
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = 2.0 + Math.random() * 6.0;

        p.velocity.set(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          Math.cos(phi) * speed
        );

        p.color.copy(color);
        p.age = 0;
        p.maxAge = 0.5 + Math.random() * 0.8; // lifespan: 0.5 to 1.3 seconds

        activated++;
        if (activated >= 15) break;
      }
    }
  }

  private updateParticles(deltaTime: number) {
    const THREE = (window as any).THREE;
    if (!THREE || !this.particlePoints || !this.particleGeometry) return;

    const positionsAttr = this.particleGeometry.attributes.position;
    const colorsAttr = this.particleGeometry.attributes.color;

    const positions = positionsAttr.array as Float32Array;
    const colors = colorsAttr.array as Float32Array;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const i3 = i * 3;

      if (p.active) {
        p.age += deltaTime;
        if (p.age >= p.maxAge) {
          p.active = false;
          positions[i3] = 99999;
          positions[i3 + 1] = 99999;
          positions[i3 + 2] = 99999;
        } else {
          p.position.addScaledVector(p.velocity, deltaTime);

          positions[i3] = p.position.x;
          positions[i3 + 1] = p.position.y;
          positions[i3 + 2] = p.position.z;

          // Fade out based on age
          const progress = p.age / p.maxAge;
          const fadeColor = p.color.clone().multiplyScalar(1.0 - progress);
          colors[i3] = fadeColor.r;
          colors[i3 + 1] = fadeColor.g;
          colors[i3 + 2] = fadeColor.b;
        }
      } else {
        positions[i3] = 99999;
        positions[i3 + 1] = 99999;
        positions[i3 + 2] = 99999;
      }
    }

    positionsAttr.needsUpdate = true;
    colorsAttr.needsUpdate = true;
  }

  private addAudioVisualizerColumn(position: any, duration: number, color: any) {
    const THREE = (window as any).THREE;
    if (!THREE || !this.scene) return;

    const cylinderGeo = new THREE.CylinderGeometry(0.12, 0.12, 5, 8);
    const cylinderMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const cylinder = new THREE.Mesh(cylinderGeo, cylinderMat);
    cylinder.position.copy(position);
    cylinder.position.z += 2.5; // raise along the depth axis
    cylinder.rotation.x = Math.PI / 2;

    this.scene.add(cylinder);

    const spawnTime = Date.now();
    const anim = () => {
      const elapsed = (Date.now() - spawnTime) / 1000;
      const progress = elapsed / duration;
      if (progress >= 1.0) {
        if (this.scene) {
          this.scene.remove(cylinder);
        }
        cylinderGeo.dispose();
        cylinderMat.dispose();
      } else {
        cylinder.material.opacity = 0.6 * (1.0 - progress);
        cylinder.scale.set(1.0 - progress * 0.5, 1.0, 1.0 - progress * 0.5);
        if (this.renderer && this.scene && this.camera) {
          requestAnimationFrame(anim);
        } else {
          if (this.scene) {
            this.scene.remove(cylinder);
          }
          cylinderGeo.dispose();
          cylinderMat.dispose();
        }
      }
    };
    requestAnimationFrame(anim);
  }

  private addConnectionLine(startPos: any, endPos: any, colorStart: any, colorEnd: any) {
    const THREE = (window as any).THREE;
    if (!THREE || !this.scene) return;

    const geometry = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
    const blendedColor = new THREE.Color().addColors(colorStart, colorEnd).multiplyScalar(0.5);

    const material = new THREE.LineBasicMaterial({
      color: blendedColor,
      transparent: true,
      opacity: 0.7,
      linewidth: 2
    });

    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    const spawnTime = Date.now();
    const duration = 2000;
    const anim = () => {
      const elapsed = Date.now() - spawnTime;
      const progress = elapsed / duration;
      if (progress >= 1.0) {
        if (this.scene) {
          this.scene.remove(line);
        }
        geometry.dispose();
        material.dispose();
      } else {
        const audioVolume = this.getAudioEnergy();
        material.opacity = (0.7 * (1.0 - progress)) * (0.5 + audioVolume * 1.5);
        if (this.renderer && this.scene && this.camera) {
          requestAnimationFrame(anim);
        } else {
          if (this.scene) {
            this.scene.remove(line);
          }
          geometry.dispose();
          material.dispose();
        }
      }
    };
    requestAnimationFrame(anim);
  }

  private voidSphere: any = null;

  public growNoteColumn(x: number, y: number, note: string) {
    const THREE = (window as any).THREE;
    if (!THREE || !this.scene) return;

    // Convert note to color
    const noteToColor = (noteStr: string) => {
      const charCodeSum = noteStr.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const h = (charCodeSum * 33) % 360;
      return new THREE.Color(`hsl(${h}, 85%, 65%)`);
    };

    const midi = (window as any).Tone ? (window as any).Tone.Frequency(note).toMidi() : 60;
    const height = Math.max(1, (midi - 36) * 0.15);

    const cylinderGeo = new THREE.CylinderGeometry(0.25, 0.25, height, 8);
    const cylinderMat = new THREE.MeshStandardMaterial({
      color: noteToColor(note),
      transparent: true,
      opacity: 0.8,
      roughness: 0.2,
      metalness: 0.8
    });

    const cylinder = new THREE.Mesh(cylinderGeo, cylinderMat);
    const targetPos = new THREE.Vector3((x - 0.5) * 24, (y - 0.5) * 16, -5);
    cylinder.position.copy(targetPos);
    cylinder.position.z += height / 2; // raise
    cylinder.rotation.x = Math.PI / 2;

    this.scene.add(cylinder);

    const spawnTime = Date.now();
    const duration = 600; // 0.6 seconds
    
    const anim = () => {
      const elapsed = Date.now() - spawnTime;
      const progress = Math.min(1.0, elapsed / duration);
      
      // Elastic out easing
      const elasticOut = (t: number) => {
        if (t === 0) return 0;
        if (t === 1) return 1;
        return Math.sin(-13 * (t + 1) * Math.PI / 2) * Math.pow(2, -10 * t) + 1;
      };
      
      const eased = elasticOut(progress);
      cylinder.scale.set(1, eased, 1);
      
      if (progress < 1.0) {
        if (this.renderer && this.scene && this.camera) {
          requestAnimationFrame(anim);
        } else {
          if (this.scene) {
            this.scene.remove(cylinder);
          }
          cylinderGeo.dispose();
          cylinderMat.dispose();
        }
      } else {
        // Slow fade out after growth
        const fadeTime = Date.now();
        const fadeDuration = 2000;
        const fadeAnim = () => {
          const fadeElapsed = Date.now() - fadeTime;
          const fadeProgress = fadeElapsed / fadeDuration;
          if (fadeProgress >= 1.0) {
            if (this.scene) {
              this.scene.remove(cylinder);
            }
            cylinderGeo.dispose();
            cylinderMat.dispose();
          } else {
            cylinderMat.opacity = 0.8 * (1.0 - fadeProgress);
            if (this.renderer && this.scene && this.camera) {
              requestAnimationFrame(fadeAnim);
            } else {
              if (this.scene) {
                this.scene.remove(cylinder);
              }
              cylinderGeo.dispose();
              cylinderMat.dispose();
            }
          }
        };
        requestAnimationFrame(fadeAnim);
      }
    };
    requestAnimationFrame(anim);
  }

  public restructureBuilding(densityLevel: number) {
    const THREE = (window as any).THREE;
    if (!THREE || !this.architectureMesh) return;
    
    // Rearrange existing instanced elements to new grid coordinates to simulate restructuring
    const tempMatrix = new THREE.Matrix4();
    
    for (let i = 0; i < this.instanceCount; i++) {
      this.architectureMesh.getMatrixAt(i, tempMatrix);
      const positionOld = new THREE.Vector3();
      const rotationOld = new THREE.Quaternion();
      const scaleOld = new THREE.Vector3();
      tempMatrix.decompose(positionOld, rotationOld, scaleOld);
      
      // Animate / shift them slightly
      positionOld.x += (Math.random() - 0.5) * 3.0 * densityLevel;
      positionOld.y += (Math.random() - 0.5) * 3.0 * densityLevel;
      
      tempMatrix.compose(positionOld, rotationOld, scaleOld);
      this.architectureMesh.setMatrixAt(i, tempMatrix);
    }
    this.architectureMesh.instanceMatrix.needsUpdate = true;
    
    // Spawn a large burst of particles from center
    const centerPos = new THREE.Vector3(0, 0, -10);
    const burstColor = new THREE.Color(0x818cf8); // Indigo
    this.burstParticles(centerPos, burstColor);
  }

  public explodeMaterialChange(instruments: string[]) {
    const THREE = (window as any).THREE;
    if (!THREE) return;
    
    // Flashes the main mesh material or instanced colors to create a visual shock
    const flashColor = new THREE.Color(0xffffff);
    if (this.architectureMesh) {
      for (let i = 0; i < this.instanceCount; i++) {
        this.architectureMesh.setColorAt(i, flashColor);
      }
      if (this.architectureMesh.instanceColor) {
        this.architectureMesh.instanceColor.needsUpdate = true;
      }
    }
    
    // Trigger high intensity particle burst
    const burstPos = new THREE.Vector3(
      (this.handDataRef.current.x - 0.5) * 20,
      (this.handDataRef.current.y - 0.5) * 14,
      -5
    );
    this.burstParticles(burstPos, new THREE.Color(0x34d399)); // Emerald Green
  }

  public createSonicBoom(x: number, y: number, intensity: number) {
    const THREE = (window as any).THREE;
    if (!THREE || !this.scene) return;
    
    const ringGeo = new THREE.RingGeometry(0.1, 1, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e, // Rose pink
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    const ring = new THREE.Mesh(ringGeo, ringMat);
    const targetPos = new THREE.Vector3((x - 0.5) * 24, (y - 0.5) * 16, -5);
    ring.position.copy(targetPos);
    this.scene.add(ring);
    
    const spawnTime = Date.now();
    const duration = 600; // 0.6 seconds
    const maxScale = intensity * 15;
    
    const anim = () => {
      const elapsed = Date.now() - spawnTime;
      const progress = elapsed / duration;
      if (progress >= 1.0) {
        if (this.scene) {
          this.scene.remove(ring);
        }
        ringGeo.dispose();
        ringMat.dispose();
      } else {
        const scale = progress * maxScale;
        ring.scale.set(scale, scale, 1);
        ringMat.opacity = 0.8 * (1.0 - progress);
        
        if (this.renderer && this.scene && this.camera) {
          requestAnimationFrame(anim);
        } else {
          if (this.scene) {
            this.scene.remove(ring);
          }
          ringGeo.dispose();
          ringMat.dispose();
        }
      }
    };
    requestAnimationFrame(anim);
  }

  public createSilenceVoid(x: number, y: number) {
    const THREE = (window as any).THREE;
    if (!THREE || !this.scene) return;
    
    // Create a black/dark purple glowing sphere
    const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x05010a,
      transparent: true,
      opacity: 0.9,
      blending: THREE.NormalBlending
    });
    
    this.voidSphere = new THREE.Mesh(sphereGeo, sphereMat);
    const targetPos = new THREE.Vector3((x - 0.5) * 24, (y - 0.5) * 16, -5);
    this.voidSphere.position.copy(targetPos);
    this.scene.add(this.voidSphere);
    
    // Animate growth
    const spawnTime = Date.now();
    const duration = 500;
    const anim = () => {
      if (!this.voidSphere) return;
      const elapsed = Date.now() - spawnTime;
      const progress = Math.min(1, elapsed / duration);
      const scale = progress * 6; // grow to size 6
      this.voidSphere.scale.set(scale, scale, scale);
      
      // Spiral existing structures towards the void
      if (this.architectureMesh) {
        const tempMatrix = new THREE.Matrix4();
        for (let i = 0; i < this.instanceCount; i++) {
          this.architectureMesh.getMatrixAt(i, tempMatrix);
          const pos = new THREE.Vector3();
          const rot = new THREE.Quaternion();
          const scl = new THREE.Vector3();
          tempMatrix.decompose(pos, rot, scl);
          
          // Pull slightly towards voidCenter
          const dir = targetPos.clone().sub(pos);
          const dist = dir.length();
          if (dist < 15) {
            pos.addScaledVector(dir.normalize(), 0.1);
            // Spiral rotation
            const axis = new THREE.Vector3(0, 0, 1);
            rot.multiply(new THREE.Quaternion().setFromAxisAngle(axis, 0.05));
          }
          tempMatrix.compose(pos, rot, scl);
          this.architectureMesh.setMatrixAt(i, tempMatrix);
        }
        this.architectureMesh.instanceMatrix.needsUpdate = true;
      }
      
      if (progress < 1.0) {
        requestAnimationFrame(anim);
      }
    };
    requestAnimationFrame(anim);
  }

  public collapseVoid() {
    const THREE = (window as any).THREE;
    if (!THREE || !this.voidSphere) return;
    
    const spawnTime = Date.now();
    const duration = 400;
    const originalScale = this.voidSphere.scale.clone();
    
    const anim = () => {
      if (!this.voidSphere) return;
      const elapsed = Date.now() - spawnTime;
      const progress = elapsed / duration;
      if (progress >= 1.0) {
        if (this.scene) {
          this.scene.remove(this.voidSphere);
        }
        this.voidSphere.geometry.dispose();
        this.voidSphere.material.dispose();
        this.voidSphere = null;
        
        // Restructure back after collapse
        this.restructureBuilding(2);
      } else {
        const scale = originalScale.clone().multiplyScalar(1.0 - progress);
        this.voidSphere.scale.copy(scale);
        
        if (this.renderer && this.scene && this.camera) {
          requestAnimationFrame(anim);
        } else {
          if (this.scene) {
            this.scene.remove(this.voidSphere);
          }
          this.voidSphere.geometry.dispose();
          this.voidSphere.material.dispose();
          this.voidSphere = null;
        }
      }
    };
    requestAnimationFrame(anim);
  }

  public setMode(mode: 'free' | 'accumulate') {
    this.mode = mode;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // 清理自由变化模式的对象 (Problem C)
    if (this.mesh) {
      this.mesh.visible = (mode === 'free');
    }

    // 清理累积生长模式 (Problem C)
    if (this.growthSystem) {
      this.growthSystem.clear();
      this.growthSystem.dispose();
      this.growthSystem = null;
    }
    if (this.cameraFollow) {
      this.cameraFollow.reset(this.camera);
      this.cameraFollow = null;
    }
    this.removeGestureUI();

    if (mode === 'free') {
      // 自由变化：单一变形网格
      this.instanceCount = 0;
      this.accumulatedAge = 0;
      this.startAccumulateTime = 0;
      this.lastPosition = null;
      this.lastColor = null;
    } else if (mode === 'accumulate') {
      // 累积生长：初始化系统 (Problem B & C)
      this.initGrowthSystem();
      this.startAccumulateTime = Date.now();
      this.lastSpawnTime = Date.now();
    }

    if (this.onArchUpdate) {
      this.onArchUpdate(this.instanceCount, Math.floor(this.accumulatedAge));
    }

    console.log('切换模式:', mode);
  }

  private initGrowthSystem() {
    if (this.growthSystem) {
      this.growthSystem.dispose();
    }
    this.growthSystem = new TrailArchitecture(this.scene);
    this.cameraFollow = new CameraFollow();
  }

  private initBackgroundParticles(style: string) {
    const THREE = (window as any).THREE;
    if (!THREE || !this.scene) return;

    this.backgroundGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.backgroundParticleCount * 3);
    this.bgParticleData = [];

    // Particle styling based on emotion style
    let pColor = 0xffffff;
    if (style === 'ruins') pColor = 0x0088ff;       // bioluminescent plankton
    else if (style === 'pipes') pColor = 0xff3300;   // sparks
    else if (style === 'karesansui') pColor = 0xffb7c5; // cherry blossoms
    else if (style === 'factory') pColor = 0xaaccaa; // industrial dust
    else if (style === 'vascular') pColor = 0xff0033; // blood cells
    else if (style === 'clouds') pColor = 0xddddff;   // mist droplets

    for (let i = 0; i < this.backgroundParticleCount; i++) {
      const x = (Math.random() - 0.5) * 100;
      const y = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      this.bgParticleData.push({
        x, y, z,
        speed: 0.1 + Math.random() * 0.4,
        driftX: (Math.random() - 0.5) * 0.2,
        driftY: (Math.random() - 0.5) * 0.2,
        size: 0.05 + Math.random() * 0.15
      });
    }

    this.backgroundGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.backgroundMaterial = new THREE.PointsMaterial({
      color: pColor,
      size: 0.15,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.backgroundPoints = new THREE.Points(this.backgroundGeometry, this.backgroundMaterial);
    this.scene.add(this.backgroundPoints);
  }

  private getEmotionColor(): [number, number, number] {
    const hex = this.currentEmotion?.colors[1] || '#ffffff';
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 255;
    return [r, g, b];
  }

  private generateMicroStructure(gesture: any) {
    const { x, y, spread, vx, vy } = gesture;
    const activity = Math.abs(vx) + Math.abs(vy) + Math.abs(spread - this.lastSpread);
    if (activity > 0.01) {
      return {
        type: 'ripple',
        x, y,
        intensity: activity * 10,
        radius: 0,
        maxRadius: 1 + activity * 5,
        color: this.getEmotionColor().map(c => Math.min(255, c + Math.random() * 30)),
        duration: 1000 + activity * 2000
      };
    }
    return null;
  }

  private renderMicroStructure(event: any) {
    const THREE = (window as any).THREE;
    if (!THREE || !this.scene) return;

    const group = new THREE.Group();
    this.scene.add(group);

    const ringGeo = new THREE.RingGeometry(0.01, event.maxRadius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(event.color[0]/255, event.color[1]/255, event.color[2]/255),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set((event.x - 0.5) * 24, (event.y - 0.5) * 16, -4.9);
    group.add(ring);

    const customStruct = {
      group,
      birthTime: Date.now(),
      duration: event.duration,
      update: (progress: number) => {
        const scaleVal = progress;
        ring.scale.set(scaleVal, scaleVal, 1);
        ringMat.opacity = 0.4 * (1.0 - progress) * event.intensity;
        return progress < 1.0;
      }
    };
    this.customStructures.push(customStruct);
  }

  public renderStructure(type: string, event: any) {
    const THREE = (window as any).THREE;
    if (!THREE || !this.scene) return;

    const group = new THREE.Group();
    this.scene.add(group);

    let duration = 4000;
    let updateFn: (progress: number, elapsed: number, deltaTime: number) => boolean = () => true;

    switch (type) {
      case 'deepblue':
        ({ duration, updateFn } = this.renderDeepBlue(event, group));
        break;
      case 'magma':
        ({ duration, updateFn } = this.renderMagma(event, group));
        break;
      case 'sakura':
        ({ duration, updateFn } = this.renderSakura(event, group));
        break;
      case 'rust':
        ({ duration, updateFn } = this.renderRust(event, group));
        break;
      case 'heartbeat':
        ({ duration, updateFn } = this.renderHeartbeat(event, group));
        break;
      case 'fog':
        ({ duration, updateFn } = this.renderFog(event, group));
        break;
    }

    const customStruct = {
      group,
      birthTime: Date.now(),
      duration,
      update: updateFn
    };
    this.customStructures.push(customStruct);
  }

  private renderDeepBlue(event: any, group: any) {
    const THREE = (window as any).THREE;
    let duration = 5000;
    let updateFn = (progress: number) => true;

    if (event.type === 'fish_trail') {
      const { trailLength, trailWidth, turbulence, color } = event;
      duration = 3000;
      const startPos = new THREE.Vector3((this.handDataRef.current.x - 0.5) * 24, (this.handDataRef.current.y - 0.5) * 16, -5);
      const fishCount = 6;
      const fishMeshes: any[] = [];
      const fishPositions: any[] = [];

      for (let i = 0; i < fishCount; i++) {
        const coneGeo = new THREE.ConeGeometry(0.12, 0.4, 4);
        coneGeo.rotateX(Math.PI / 2);
        const coneMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
          transparent: true,
          opacity: 0.8,
          transmission: 0.3,
          roughness: 0.2
        });
        const mesh = new THREE.Mesh(coneGeo, coneMat);
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * trailWidth * 2,
          (Math.random() - 0.5) * trailWidth * 2,
          (Math.random() - 0.5) * 2
        );
        mesh.position.copy(startPos).add(offset);
        group.add(mesh);
        fishMeshes.push(mesh);
        fishPositions.push(mesh.position.clone());
      }

      updateFn = (progress: number) => {
        fishMeshes.forEach((mesh, idx) => {
          const sw = Math.sin(progress * Math.PI * 6 + idx) * turbulence * 0.5;
          const basePos = fishPositions[idx];
          mesh.position.x = basePos.x + progress * trailLength * 4;
          mesh.position.y = basePos.y + sw;
          mesh.position.z = basePos.z + Math.cos(progress * Math.PI * 4 + idx) * turbulence * 0.3;
          mesh.rotation.y = Math.PI / 2 + sw * 0.5;
          mesh.material.opacity = 0.8 * (1.0 - progress);
        });
        return progress < 1.0;
      };
    } else {
      const branches = event.branches || 3;
      const angle = event.angle || 0;
      const length = event.length || 2.0;
      const thickness = event.thickness || 0.15;
      const color = event.color || [10, 50, 150];
      const startPos = new THREE.Vector3((this.handDataRef.current.x - 0.5) * 24, (this.handDataRef.current.y - 0.5) * 16, -5);

      const lights: any[] = [];

      for (let i = 0; i < branches; i++) {
        const theta = (i / branches) * Math.PI * 2 + angle;
        const phi = Math.random() * Math.PI * 0.4;
        const endOffset = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * length,
          Math.cos(phi) * length,
          Math.sin(phi) * Math.sin(theta) * length
        );
        const midPos = startPos.clone().addScaledVector(endOffset, 0.5);
        midPos.x += (Math.random() - 0.5) * 0.3 * length;
        midPos.y += (Math.random() - 0.5) * 0.3 * length;
        midPos.z += (Math.random() - 0.5) * 0.3 * length;

        const endPos = startPos.clone().add(endOffset);
        const curve = new THREE.CatmullRomCurve3([startPos, midPos, endPos]);
        const tubeGeo = new THREE.TubeGeometry(curve, 20, thickness, 8, false);

        const tubeMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
          transparent: true,
          opacity: 0.6,
          transmission: 0.3,
          roughness: 0.2,
          emissive: new THREE.Color(0, 0.08, 0.2),
          emissiveIntensity: 0.5
        });

        const branchMesh = new THREE.Mesh(tubeGeo, tubeMat);
        group.add(branchMesh);

        const pulseLight = new THREE.PointLight(
          new THREE.Color(0, 0.4, 0.8),
          0,
          5
        );
        pulseLight.position.copy(endPos);
        group.add(pulseLight);
        lights.push(pulseLight);
      }

      updateFn = (progress: number) => {
        group.traverse((child: any) => {
          if (child.isMesh && child.material) {
            let alpha = 0.9;
            if (progress < 0.1) alpha = (progress / 0.1) * 0.9;
            else if (progress > 0.8) alpha = ((1.0 - progress) / 0.2) * 0.9;
            child.material.opacity = alpha;
          }
        });

        const pulse = Math.sin(progress * Math.PI * 5) * 0.5 + 0.5;
        lights.forEach(light => {
          light.intensity = pulse * 1.5 * (1.0 - progress);
        });

        return progress < 1.0;
      };
    }

    return { duration, updateFn };
  }

  private createJaggedShape(size: number) {
    const THREE = (window as any).THREE;
    const shape = new THREE.Shape();
    const pts = 8;
    for (let i = 0; i < pts; i++) {
      const angle = (i / pts) * Math.PI * 2;
      const r = size * (0.6 + Math.random() * 0.4);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }

  private renderMagma(event: any, group: any) {
    const THREE = (window as any).THREE;
    let duration = 4000;
    let updateFn = (progress: number, elapsed: number, deltaTime: number) => true;

    if (event.type === 'eruption') {
      const { force, fragments, color, coolingTime } = event;
      duration = coolingTime || 2000;
      const hand = this.handDataRef.current;
      const startPos = new THREE.Vector3((hand.x - 0.5) * 24, (hand.y - 0.5) * 16, -5);
      const fragCount = Math.min(40, fragments);
      const fragMeshes: any[] = [];
      const fragVelocities: any[] = [];
      const fragColors: any[] = [];

      for (let i = 0; i < fragCount; i++) {
        const size = 0.1 + Math.random() * 0.3;
        const geo = Math.random() > 0.5 ? new THREE.DodecahedronGeometry(size) : new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
          emissive: new THREE.Color(color[0]/255 * 0.8, color[1]/255 * 0.2, 0),
          emissiveIntensity: 1.5,
          transparent: true,
          opacity: 1.0
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(startPos);
        group.add(mesh);
        fragMeshes.push(mesh);

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.5;
        const speedVal = (0.5 + Math.random() * 1.5) * force * 3;
        const vel = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speedVal,
          Math.cos(phi) * speedVal * 1.8,
          Math.sin(phi) * Math.sin(theta) * speedVal
        );
        fragVelocities.push(vel);
        fragColors.push(new THREE.Color(color[0]/255, color[1]/255, color[2]/255));
      }

      updateFn = (progress: number, elapsed: number, deltaTime: number) => {
        const gravity = -18.0;
        fragMeshes.forEach((mesh, idx) => {
          const vel = fragVelocities[idx];
          vel.y += gravity * deltaTime;
          mesh.position.addScaledVector(vel, deltaTime);
          mesh.rotation.x += 2 * deltaTime;
          mesh.rotation.y += 3 * deltaTime;

          if (mesh.position.y < -8.0) {
            mesh.position.y = -8.0;
            vel.y = -vel.y * 0.4;
            vel.x *= 0.8;
            vel.z *= 0.8;
          }

          const startC = fragColors[idx];
          const blackC = new THREE.Color(0.05, 0.05, 0.05);
          const coolFactor = Math.min(1.0, progress * 1.5);
          mesh.material.color.copy(startC).lerp(blackC, coolFactor);
          mesh.material.emissiveIntensity = 1.5 * (1.0 - progress);
          mesh.material.opacity = 1.0 - progress;
        });
        return progress < 1.0;
      };
    } else {
      const flowRate = event.flowRate || 1.5;
      const color = event.color || [220, 50, 5];
      duration = 4000;
      const hand = this.handDataRef.current;
      const startPos = new THREE.Vector3((this.prevX - 0.5) * 24, (this.prevY - 0.5) * 16, -5);
      const endPos = new THREE.Vector3((hand.x - 0.5) * 24, (hand.y - 0.5) * 16, -5);
      const direction = endPos.clone().sub(startPos).normalize();
      const length = startPos.distanceTo(endPos) || 1.0;

      const jaggedShape = this.createJaggedShape(0.4 + flowRate * 0.1);
      const extrudeSettings = {
        depth: length,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 12,
        bevelSize: 0.05,
        bevelThickness: 0.05
      };

      const geometry = new THREE.ExtrudeGeometry(jaggedShape, extrudeSettings);

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
        emissive: new THREE.Color(1, 0.2, 0),
        emissiveIntensity: 2.0,
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0.9
      });

      material.onBeforeCompile = (shader: any) => {
        shader.uniforms.u_time = { value: 0 };
        material.userData.shader = shader;
        shader.vertexShader = 'uniform float u_time;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float heat = sin(position.z * 5.0 + u_time * 6.0) * 0.15;
          transformed += normal * heat;
          `
        );
      };

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(startPos);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
      group.add(mesh);

      updateFn = (progress: number, elapsed: number) => {
        if (material.userData.shader) {
          material.userData.shader.uniforms.u_time.value = elapsed / 1000;
        }
        const scaleVal = 1.0 + Math.sin(progress * Math.PI * 4) * 0.1;
        mesh.scale.set(scaleVal, scaleVal, 1.0);
        material.opacity = 0.9 * (1.0 - progress);
        material.emissiveIntensity = 2.0 * (1.0 - progress);
        return progress < 1.0;
      };
    }

    return { duration, updateFn };
  }

  private renderSakura(event: any, group: any) {
    const THREE = (window as any).THREE;
    let duration = 6000;
    let updateFn = (progress: number, elapsed: number, deltaTime: number) => true;

    if (event.type === 'sand_ripple') {
      const { center, radius, amplitude, decay, color } = event;
      duration = 3000;
      const startPos = new THREE.Vector3((center.x - 0.5) * 24, (center.y - 0.5) * 16, -5);
      const rippleCount = 3;
      const ripples: any[] = [];

      for (let i = 0; i < rippleCount; i++) {
        const ringGeo = new THREE.RingGeometry(0.1, 1.2, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.0
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(startPos);
        group.add(ring);
        ripples.push({
          mesh: ring,
          delay: i * 150,
          mat: ringMat
        });
      }

      updateFn = (progress: number, elapsed: number) => {
        ripples.forEach((rip) => {
          const activeElapsed = elapsed - rip.delay;
          if (activeElapsed < 0) return;
          const t = Math.min(1.0, activeElapsed / 1000);
          const scaleVal = t * radius * 10;
          rip.mesh.scale.set(scaleVal, scaleVal, 1);
          rip.mesh.position.z = -5 + Math.sin(t * Math.PI * 4) * amplitude * 5;
          rip.mat.opacity = 0.5 * (1.0 - t) * Math.pow(decay, t * 10);
        });
        return progress < 1.0;
      };
    } else {
      const { position, stones, size, moss, color } = event;
      const startPos = new THREE.Vector3((position.x - 0.5) * 24, (position.y - 0.5) * 16, -5);
      const rockGroup = new THREE.Group();
      const mossGroup = new THREE.Group();
      group.add(rockGroup);
      group.add(mossGroup);

      const numStones = stones || 3;
      for (let i = 0; i < numStones; i++) {
        const sSize = size * (0.5 + Math.random() * 0.5);
        const stoneGeo = new THREE.DodecahedronGeometry(sSize, 0);

        const stoneMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
          flatShading: true,
          transparent: true,
          opacity: 0.0
        });
        const stoneMesh = new THREE.Mesh(stoneGeo, stoneMat);
        stoneMesh.position.set(
          startPos.x + (Math.random() - 0.5) * size * 2,
          startPos.y + (Math.random() - 0.5) * size * 0.5,
          startPos.z + (Math.random() - 0.5) * size * 2
        );
        stoneMesh.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          0
        );
        rockGroup.add(stoneMesh);

        if (moss) {
          const mossGeo = new THREE.DodecahedronGeometry(sSize * 0.4, 0);
          const mossMat = new THREE.MeshLambertMaterial({
            color: new THREE.Color(0.25, 0.5, 0.2),
            flatShading: true,
            transparent: true,
            opacity: 0.0
          });
          const mossMesh = new THREE.Mesh(mossGeo, mossMat);
          mossMesh.position.copy(stoneMesh.position);
          mossMesh.position.y -= sSize * 0.4;
          mossMesh.scale.set(0.01, 0.01, 0.01);
          mossGroup.add(mossMesh);
        }
      }

      updateFn = (progress: number) => {
        rockGroup.traverse((child: any) => {
          if (child.isMesh && child.material) {
            let alpha = 1.0;
            if (progress < 0.2) alpha = progress / 0.2;
            else if (progress > 0.8) alpha = (1.0 - progress) / 0.2;
            child.material.opacity = alpha;
          }
        });
        mossGroup.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const s = Math.min(1.2, progress * 4.0);
            child.scale.set(s, s, s);
            let alpha = 0.95;
            if (progress < 0.1) alpha = progress / 0.1;
            else if (progress > 0.8) alpha = (1.0 - progress) / 0.2;
            child.material.opacity = alpha;
          }
        });
        return progress < 1.0;
      };
    }

    return { duration, updateFn };
  }

  private createRustTexture() {
    const THREE = (window as any).THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#888888';
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 2000; i++) {
        const x = Math.random() * 128;
        const y = Math.random() * 128;
        const size = 1 + Math.random() * 3;
        const val = Math.floor(Math.random() * 100);
        ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
        ctx.fillRect(x, y, size, size);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  }

  private renderRust(event: any, group: any) {
    const THREE = (window as any).THREE;
    let duration = 4000;
    let updateFn = (progress: number, elapsed: number, deltaTime: number) => true;

    if (event.type === 'gear_mesh') {
      const { position, teeth, radius, rotation, rustLevel, color } = event;
      duration = 5000;
      const startPos = new THREE.Vector3((position.x - 0.5) * 24, (position.y - 0.5) * 16, -5);

      const shape = new THREE.Shape();
      const innerRadius = radius * 0.7;
      const outerRadius = radius;
      const numTeeth = teeth || 10;

      for (let i = 0; i < numTeeth; i++) {
        const angle1 = (i / numTeeth) * Math.PI * 2;
        const angle2 = ((i + 0.3) / numTeeth) * Math.PI * 2;
        const angle3 = ((i + 0.5) / numTeeth) * Math.PI * 2;
        const angle4 = ((i + 0.8) / numTeeth) * Math.PI * 2;
        const x1 = Math.cos(angle1) * innerRadius;
        const y1 = Math.sin(angle1) * innerRadius;
        const x2 = Math.cos(angle2) * outerRadius;
        const y2 = Math.sin(angle2) * outerRadius;
        const x3 = Math.cos(angle3) * outerRadius;
        const y3 = Math.sin(angle3) * outerRadius;
        const x4 = Math.cos(angle4) * innerRadius;
        const y4 = Math.sin(angle4) * innerRadius;
        if (i === 0) shape.moveTo(x1, y1);
        else shape.lineTo(x1, y1);
        shape.lineTo(x2, y2);
        shape.lineTo(x3, y3);
        shape.lineTo(x4, y4);
      }
      shape.closePath();

      const holePath = new THREE.Path();
      holePath.absarc(0, 0, radius * 0.25, 0, Math.PI * 2, true);
      shape.holes.push(holePath);

      const extrudeSettings = {
        depth: 0.3,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.02,
        bevelThickness: 0.02
      };
      const gearGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      gearGeo.center();

      const baseRustColor = new THREE.Color(color[0]/255, color[1]/255, color[2]/255);
      const rustColorOrange = new THREE.Color(0.5, 0.2, 0.05);
      const finalColor = baseRustColor.clone().lerp(rustColorOrange, rustLevel);

      const gearMat = new THREE.MeshStandardMaterial({
        color: finalColor,
        roughness: 0.9,
        metalness: 0.6,
        bumpMap: this.createRustTexture(),
        bumpScale: 0.05,
        transparent: true,
        opacity: 0.0
      });
      const gearMesh = new THREE.Mesh(gearGeo, gearMat);
      gearMesh.position.copy(startPos);
      group.add(gearMesh);

      this.burstParticles(startPos, new THREE.Color(0xffaa00));

      updateFn = (progress: number, elapsed: number) => {
        gearMesh.rotation.z = rotation + (elapsed / 1000) * 1.5;
        let scaleVal = 1.0;
        if (progress < 0.2) scaleVal = (progress / 0.2);
        else if (progress > 0.8) scaleVal = (1.0 - progress) / 0.2;
        gearMesh.scale.set(scaleVal, scaleVal, scaleVal);
        gearMat.opacity = Math.min(1.0, scaleVal * 0.95);
        return progress < 1.0;
      };
    } else {
      const { from, to, diameter, valves, leaks, color } = event;
      duration = 4000;
      const prevCoords = from || { x: this.prevX, y: this.prevY };
      const startPos = new THREE.Vector3((prevCoords.x - 0.5) * 24, (prevCoords.y - 0.5) * 16, -5);
      const endPos = new THREE.Vector3((to.x - 0.5) * 24, (to.y - 0.5) * 16, -5);

      const curve = new THREE.LineCurve3(startPos, endPos);
      const pipeGeo = new THREE.TubeGeometry(curve, 10, diameter, 6, false);
      const pipeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
        roughness: 0.8,
        metalness: 0.4,
        transparent: true,
        opacity: 0.9
      });
      const pipeMesh = new THREE.Mesh(pipeGeo, pipeMat);
      group.add(pipeMesh);

      const valveMeshes: any[] = [];
      if (valves > 0) {
        const midPos = startPos.clone().lerp(endPos, 0.5);
        const torusGeo = new THREE.TorusGeometry(diameter * 1.8, diameter * 0.3, 8, 16);
        const torusMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0.8, 0.1, 0.1),
          roughness: 0.5,
          metalness: 0.8
        });
        const torusMesh = new THREE.Mesh(torusGeo, torusMat);
        torusMesh.position.copy(midPos);
        const direction = endPos.clone().sub(startPos).normalize();
        torusMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
        group.add(torusMesh);
        valveMeshes.push(torusMesh);
      }

      const steamMeshes: any[] = [];
      const steamDirections: any[] = [];
      if (leaks > 0) {
        const leakPos = startPos.clone().lerp(endPos, 0.3 + Math.random() * 0.4);
        for (let k = 0; k < 12; k++) {
          const steamGeo = new THREE.SphereGeometry(0.1, 8, 8);
          const steamMat = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.4
          });
          const steamMesh = new THREE.Mesh(steamGeo, steamMat);
          steamMesh.position.copy(leakPos);
          group.add(steamMesh);
          steamMeshes.push(steamMesh);
          steamDirections.push(new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            2.5 + Math.random() * 2.0,
            (Math.random() - 0.5) * 1.5
          ));
        }
      }

      updateFn = (progress: number, elapsed: number, deltaTime: number) => {
        valveMeshes.forEach(mesh => {
          mesh.rotation.z += deltaTime * 2;
        });
        steamMeshes.forEach((steam, idx) => {
          const delayOffset = (idx * 0.08);
          const localProg = (progress + delayOffset) % 1.0;
          const dir = steamDirections[idx];
          const originLeak = startPos.clone().lerp(endPos, 0.5);
          steam.position.copy(originLeak).addScaledVector(dir, localProg);
          const scaleVal = 1.0 + localProg * 4.0;
          steam.scale.set(scaleVal, scaleVal, scaleVal);
          steam.material.opacity = 0.4 * (1.0 - localProg);
        });
        pipeMat.opacity = 0.9 * (1.0 - progress);
        return progress < 1.0;
      };
    }

    return { duration, updateFn };
  }

  private renderHeartbeat(event: any, group: any) {
    const THREE = (window as any).THREE;
    let duration = 4000;
    let updateFn = (progress: number, elapsed: number, deltaTime: number) => true;

    if (event.type === 'capillary_mesh') {
      const { center, density, pulseRate, oxygenation, color } = event;
      const startPos = new THREE.Vector3((center.x - 0.5) * 24, (center.y - 0.5) * 16, -5);
      const count = Math.min(25, Math.floor(density / 2) + 5);
      const capillaryTubes: any[] = [];

      for (let i = 0; i < count; i++) {
        const endOffset = new THREE.Vector3(
          (Math.random() - 0.5) * 3.5,
          (Math.random() - 0.5) * 3.5,
          (Math.random() - 0.5) * 2.0
        );
        const cStart = startPos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5,
          0
        ));
        const cEnd = cStart.clone().add(endOffset);

        const curve = new THREE.LineCurve3(cStart, cEnd);
        const capGeo = new THREE.TubeGeometry(curve, 4, 0.04, 4, false);

        const arterialColor = new THREE.Color(0.85, 0.1, 0.1);
        const venousColor = new THREE.Color(0.4, 0.05, 0.3);
        const capColor = venousColor.clone().lerp(arterialColor, oxygenation);

        const capMat = new THREE.MeshPhysicalMaterial({
          color: capColor,
          roughness: 0.1,
          clearcoat: 1.0,
          transparent: true,
          opacity: 0.8
        });
        const capMesh = new THREE.Mesh(capGeo, capMat);
        group.add(capMesh);
        capillaryTubes.push({ mesh: capMesh, mat: capMat, baseColor: capColor });
      }

      updateFn = (progress: number) => {
        const beatPulse = Math.sin(progress * Math.PI * 10) * 0.5 + 0.5;
        capillaryTubes.forEach((cap) => {
          const pulseS = 0.8 + beatPulse * 0.4;
          cap.mesh.scale.set(pulseS, 1.0, pulseS);
          const flashColor = cap.baseColor.clone().multiplyScalar(0.5 + beatPulse * 0.6);
          cap.mat.color.copy(flashColor);
          cap.mat.opacity = 0.8 * (1.0 - progress);
        });
        return progress < 1.0;
      };
    } else {
      const { origin, branches, angle, thickness, color, pulsePhase } = event;
      const startPos = new THREE.Vector3((origin.x - 0.5) * 24, (origin.y - 0.5) * 16, -5);
      const vesselMeshes: any[] = [];
      const vesselMaterials: any[] = [];

      for (let i = 0; i < branches; i++) {
        const dirAngle = (i === 0 ? 1 : -1) * angle;
        const endOffset = new THREE.Vector3(
          Math.sin(dirAngle) * 2.5,
          Math.cos(dirAngle) * 2.5,
          (Math.random() - 0.5) * 1.5
        );
        const endPos = startPos.clone().add(endOffset);
        const midPos = startPos.clone().lerp(endPos, 0.5);
        midPos.x += (Math.random() - 0.5) * 0.8;
        midPos.y += (Math.random() - 0.5) * 0.8;

        const curve = new THREE.CatmullRomCurve3([startPos, midPos, endPos]);
        const vesselGeo = new THREE.TubeGeometry(curve, 30, thickness, 8, false);

        const vesselMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
          roughness: 0.1,
          clearcoat: 1.0,
          transparent: true,
          opacity: 0.8
        });

        const mesh = new THREE.Mesh(vesselGeo, vesselMat);
        mesh.userData.pulsePhase = pulsePhase || 0;
        group.add(mesh);
        vesselMeshes.push(mesh);
        vesselMaterials.push(vesselMat);
      }

      updateFn = (progress: number) => {
        const heartPulse = Math.sin(progress * Math.PI * 6 + (pulsePhase || 0)) * 0.15 + 1.0;
        vesselMeshes.forEach((mesh, idx) => {
          mesh.scale.set(heartPulse, heartPulse, heartPulse);
          const pulseMat = vesselMaterials[idx];
          pulseMat.opacity = 0.8 * (1.0 - progress);
        });
        return progress < 1.0;
      };
    }

    return { duration, updateFn };
  }

  private renderFog(event: any, group: any) {
    const THREE = (window as any).THREE;
    let duration = 5000;
    let updateFn = (progress: number, elapsed: number, deltaTime: number) => true;

    const { position, volume, density, turbulence, drift, color } = event;
    const startPos = new THREE.Vector3((position.x - 0.5) * 24, (position.y - 0.5) * 16, -5);
    const sphereCount = 10;
    const clouds: any[] = [];
    const cloudOffsets: any[] = [];
    const cloudSpeeds: number[] = [];

    for (let i = 0; i < sphereCount; i++) {
      const sRad = (0.4 + Math.random() * 0.8) * volume * 0.8;
      const cloudGeo = new THREE.SphereGeometry(sRad, 16, 16);
      const cloudMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color[0]/255, color[1]/255, color[2]/255),
        transparent: true,
        opacity: 0.0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(cloudGeo, cloudMat);
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * volume * 1.5,
        (Math.random() - 0.5) * volume * 1.5,
        (Math.random() - 0.5) * volume
      );
      mesh.position.copy(startPos).add(offset);
      group.add(mesh);
      clouds.push({ mesh, mat: cloudMat });
      cloudOffsets.push(offset);
      cloudSpeeds.push(0.5 + Math.random() * 1.5);
    }

    const lightningGeo = new THREE.BufferGeometry();
    const lightningMat = new THREE.LineBasicMaterial({
      color: 0xddf0ff,
      linewidth: 3,
      transparent: true,
      opacity: 0.0
    });
    const lightningLine = new THREE.Line(lightningGeo, lightningMat);
    group.add(lightningLine);

    updateFn = (progress: number, elapsed: number) => {
      const swirlAngle = progress * Math.PI * 0.5 * (1.0 + turbulence);
      clouds.forEach((cloud, idx) => {
        const offset = cloudOffsets[idx];
        const sp = cloudSpeeds[idx];
        const cosA = Math.cos(swirlAngle * sp);
        const sinA = Math.sin(swirlAngle * sp);
        const rotatedX = offset.x * cosA - offset.z * sinA;
        const rotatedZ = offset.x * sinA + offset.z * cosA;
        const driftY = progress * drift.y * 12;
        const driftX = progress * drift.x * 12;
        const cCenter = new THREE.Vector3((position.x - 0.5) * 24, (position.y - 0.5) * 16, -5);
        cloud.mesh.position.set(
          cCenter.x + rotatedX + driftX,
          cCenter.y + offset.y + driftY,
          cCenter.z + rotatedZ
        );
        let alpha = density * 0.5;
        if (progress < 0.15) alpha = (progress / 0.15) * density * 0.5;
        else if (progress > 0.8) alpha = ((1.0 - progress) / 0.2) * density * 0.5;
        cloud.mat.opacity = alpha;
      });

      const flashChance = Math.random();
      if (flashChance > 0.94 && progress > 0.2 && progress < 0.8 && clouds.length >= 2) {
        const cloudA = clouds[Math.floor(Math.random() * clouds.length)].mesh.position;
        const cloudB = clouds[Math.floor(Math.random() * clouds.length)].mesh.position;
        const points = [];
        const steps = 6;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const pt = cloudA.clone().lerp(cloudB, t);
          if (s > 0 && s < steps) {
            pt.x += (Math.random() - 0.5) * 0.8;
            pt.y += (Math.random() - 0.5) * 0.8;
            pt.z += (Math.random() - 0.5) * 0.8;
          }
          points.push(pt);
        }
        lightningGeo.setFromPoints(points);
        if (lightningGeo.attributes.position) {
          lightningGeo.attributes.position.needsUpdate = true;
        }
        lightningMat.opacity = 0.95;
      } else {
        lightningMat.opacity *= 0.5;
      }
      return progress < 1.0;
    };

    return { duration, updateFn };
  }

  private resize(width: number, height: number) {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  public dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (this.scene) {
        this.scene.remove(this.mesh);
      }
    }
    if (this.architectureMesh) {
      this.architectureMesh.geometry.dispose();
      this.architectureMesh.material.dispose();
      if (this.scene) {
        this.scene.remove(this.architectureMesh);
      }
    }
    if (this.growthSystem) {
      this.growthSystem.dispose();
      this.growthSystem = null;
    }
    if (this.particlePoints) {
      this.particleGeometry.dispose();
      this.particleMaterial.dispose();
      if (this.scene) {
        this.scene.remove(this.particlePoints);
      }
    }
    if (this.material) {
      this.material.dispose();
    }
    if (this.backgroundPoints) {
      if (this.backgroundGeometry) this.backgroundGeometry.dispose();
      if (this.backgroundMaterial) this.backgroundMaterial.dispose();
      if (this.scene) {
        this.scene.remove(this.backgroundPoints);
      }
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    this.canvas = null as any;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.mesh = null;
    this.material = null;
    this.removeGestureUI();
  }

  private calculateGestureVelocity(x: number, y: number): number {
    const now = Date.now();
    if (this.lastGestureTime === 0) {
      this.lastGestureTime = now;
      this.lastGestureX = x;
      this.lastGestureY = y;
      return 0;
    }

    const dt = (now - this.lastGestureTime) / 1000;
    if (dt < 0.001) return 0;
    
    const dx = x - this.lastGestureX;
    const dy = y - this.lastGestureY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const velocity = distance / dt;
    
    this.lastGestureX = x;
    this.lastGestureY = y;
    this.lastGestureTime = now;
    
    return Math.min(velocity, 5); // 限制最大速度
  }

  private updateGestureUI(x: number, y: number, spread: number, velocity: number) {
    let ui = document.getElementById('gesture-info');
    if (!ui) {
      ui = document.createElement('div');
      ui.id = 'gesture-info';
      document.body.appendChild(ui);
    }
    
    const determineType = (sp: number, vel: number) => {
      if (sp > 0.7 && vel > 0.5) return '高塔';
      if (sp > 0.7 && vel < 0.3) return '穹顶';
      if (sp < 0.3 && vel > 0.5) return '桥梁';
      if (sp < 0.3 && vel < 0.3) return '节点';
      return '柱子';
    };

    const getTypeColor = (t: string) => {
      const colors: Record<string, string> = { 
        '高塔': '#ff6b6b', 
        '穹顶': '#4ecdc4', 
        '桥梁': '#45b7d1', 
        '节点': '#f9ca24', 
        '柱子': '#6c5ce7' 
      };
      return colors[t] || '#fff';
    };

    const type = determineType(spread, velocity);
    const pointsCount = this.growthSystem ? this.growthSystem.trail.points.length : 0;
    
    ui.style.position = 'fixed';
    ui.style.bottom = '100px'; 
    ui.style.left = '24px';
    ui.style.zIndex = '9999';
    ui.style.pointerEvents = 'none';
    
    ui.innerHTML = `
      <div class="bg-black/85 backdrop-blur-md text-white border border-white/10 rounded-xl p-4 font-mono text-xs shadow-2xl flex flex-col gap-1.5 min-w-[210px] transition-all duration-300">
        <div class="text-white/40 text-[10px] font-sans tracking-wider uppercase mb-1">当前手势特征 (Gesture)</div>
        <div class="flex justify-between"><span>坐标:</span> <span class="text-white/80 font-medium">X:${x.toFixed(2)} Y:${y.toFixed(2)}</span></div>
        <div class="flex justify-between"><span>张开度:</span> <span class="text-white/80 font-medium">${(spread*100).toFixed(0)}% (${spread > 0.7 ? '宽' : spread < 0.3 ? '窄' : '中'})</span></div>
        <div class="flex justify-between"><span>移动速度:</span> <span class="text-white/80 font-medium">${velocity.toFixed(2)} (${velocity > 0.5 ? '快' : velocity < 0.3 ? '慢' : '中'})</span></div>
        <div class="flex justify-between items-center border-t border-white/10 mt-2.5 pt-2.5">
          <span>即将生成:</span>
          <span class="font-bold px-2 py-0.5 rounded text-[11px] tracking-wide" style="background: ${getTypeColor(type)}15; color: ${getTypeColor(type)}">${type}</span>
        </div>
        <div class="flex justify-between mt-1 text-white/50 text-[10px]">
          <span>轨迹点数:</span>
          <span>${pointsCount} / 200</span>
        </div>
      </div>
    `;
  }

  private removeGestureUI() {
    const ui = document.getElementById('gesture-info');
    if (ui && ui.parentNode) {
      ui.parentNode.removeChild(ui);
    }
  }
}
