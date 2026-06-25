/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Emotion, HandData, SystemParameters } from '../types';
import { audioEngine } from '../utils/audioEngine';
import { VisualEngine } from '../utils/visualEngine';
import { DoubleExponentialFilter, parseGesture } from '../utils/gestureFilter';
import {
  Camera as CameraIcon,
  Video,
  RefreshCw,
  Sliders,
  ChevronLeft,
  Volume2,
  Download,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Zap,
  Music,
  Activity,
  Cpu,
  Compass,
  X,
  Hand
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WorkspaceViewProps {
  emotion: Emotion;
  onBack: () => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ emotion, onBack }) => {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const visualEngineRef = useRef<VisualEngine | null>(null);
  const mediaRecorderRef = useRef<any | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Smooth gesture coordinates low-pass filter ref
  const handDataRef = useRef<HandData>({
    x: 0.5,
    y: 0.5,
    spread: 0.4,
    angle: 0,
    isActive: false
  });

  const filterRef = useRef<DoubleExponentialFilter>(new DoubleExponentialFilter(0.3, 0.1));

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fingerCountRef = useRef<number>(0);
  const latestHandResultsRef = useRef<any>(null);

  // States
  const [engineLoading, setEngineLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showStartButton, setShowStartButton] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [useTouchFallback, setUseTouchFallback] = useState(false);
  const [cameraZoomed, setCameraZoomed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fps, setFps] = useState(60);

  // Architectural Growth states
  const [growthMode, setGrowthMode] = useState<'free' | 'accumulate'>('free');
  const [grownCount, setGrownCount] = useState(0);
  const [archAge, setArchAge] = useState(0);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(15);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordingSuccess, setRecordingSuccess] = useState(false);

  // Dynamic parameters for UI display
  const [sysParams, setSysParams] = useState<SystemParameters>({
    bpm: emotion.baseBPM,
    pitch: 'C4',
    timbre: 'Glass',
    space: 'Center',
    lowEnergy: 0.05,
    fps: 60
  });

  // Touch simulation active points
  const [touchInfo, setTouchInfo] = useState({ x: 0.5, y: 0.5, spread: 0.4, angle: 0 });

  // Mobile UI adaptation and dragging states
  const [isMobile, setIsMobile] = useState(false);
  const [cameraDragging, setCameraDragging] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for 'D' key to toggle debug panel on mobile
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') {
        setShowDebug(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle global touch move during camera drag
  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (cameraDragging) {
        const preview = document.getElementById('camera-preview');
        if (preview && e.touches && e.touches.length > 0) {
          preview.style.right = 'auto';
          preview.style.left = `${e.touches[0].clientX - 40}px`;
          preview.style.top = `${e.touches[0].clientY - 30}px`;
        }
      }
    };
    const handleGlobalTouchEnd = () => {
      setCameraDragging(false);
    };

    if (cameraDragging) {
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }
    return () => {
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [cameraDragging]);

  // 1. Initial Loader Animation and Dynamic CDN scripts load
  useEffect(() => {
    let progress = 0;
    let scriptsLoaded = false;

    const interval = setInterval(() => {
      // Slow down progress towards 90% if scripts are not loaded yet
      if (progress < 90) {
        progress += Math.floor(Math.random() * 10) + 5;
        if (progress > 90) progress = 90;
      } else if (scriptsLoaded) {
        progress += 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setShowStartButton(true);
        }
      }
      setLoadingProgress(progress);
    }, 100);

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Skip if already in DOM or window object exists
        if (src.includes('three') && (window as any).THREE) { resolve(); return; }
        if (src.includes('tone') && (window as any).Tone) { resolve(); return; }
        if (src.includes('camera_utils') && (window as any).Camera) { resolve(); return; }
        if (src.includes('hands') && (window as any).Hands) { resolve(); return; }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve();
        script.onerror = (e) => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(script);
      });
    };

    const loadAllScripts = async () => {
      try {
        // Load Three.js and Tone.js first in parallel
        await Promise.all([
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'),
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js')
        ]);
        
        // Load MediaPipe scripts sequentially or in parallel
        try {
          await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
          await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
        } catch (mpErr) {
          console.warn('MediaPipe scripts failed to load. Enabling touch/mouse fallback mode.', mpErr);
          setUseTouchFallback(true);
        }

        scriptsLoaded = true;
      } catch (err) {
        console.error('Critical audio/visual CDN scripts failed to load:', err);
        // Even if some critical script fails, let's complete progress so we don't hang forever
        scriptsLoaded = true;
      }
    };

    loadAllScripts();

    return () => clearInterval(interval);
  }, []);

  // Explicitly activate AudioEngine on user click to comply with autoplay block policies
  const handleStartEngine = async () => {
    try {
      await audioEngine.startAudio();
      await audioEngine.init(emotion);
    } catch (err) {
      console.warn('Audio start delayed or failed, waiting for user gesture/touch interaction:', err);
    }
    setEngineLoading(false);
  };

  const handleModeChange = (mode: 'free' | 'accumulate') => {
    setGrowthMode(mode);
    if (visualEngineRef.current) {
      visualEngineRef.current.setMode(mode);
    }
  };

  // 2. Initialize Visuals once loading is done
  useEffect(() => {
    if (engineLoading) return;

    // Start Three.js Scene
    if (canvasRef.current) {
      visualEngineRef.current = new VisualEngine(
        canvasRef.current,
        emotion,
        handDataRef,
        () => audioEngine.getLowEnergy(),
        (fpsVal) => setFps(fpsVal),
        (count, age) => {
          setGrownCount(count);
          setArchAge(age);
        }
      );
      visualEngineRef.current.setMode(growthMode);
      audioEngine.setVisualEngine(visualEngineRef.current);
    }

    // Initialize Camera / MediaPipe Hands
    initHandsTracking();

    return () => {
      audioEngine.stop();
      if (visualEngineRef.current) {
        visualEngineRef.current.dispose();
        visualEngineRef.current = null;
      }
      stopCamera();
    };
  }, [engineLoading, emotion]);

  // Periodic parameter updates from handDataRef to UI
  useEffect(() => {
    if (engineLoading) return;

    const interval = setInterval(() => {
      const hand = handDataRef.current;
      const energy = audioEngine.getLowEnergy();

      // Pitch label determination
      let pitchLabel = 'C4';
      if (hand.y < 0.3) pitchLabel = 'Low (C3)';
      else if (hand.y > 0.7) pitchLabel = 'High (C5)';
      else pitchLabel = 'Mid (C4)';

      // Timbre label
      let timbreLabel: 'Glass' | 'Metal' | 'Neon' = 'Glass';
      if (hand.x < 0.33) timbreLabel = 'Glass';
      else if (hand.x < 0.66) timbreLabel = 'Metal';
      else timbreLabel = 'Neon';

      // Space label
      let spaceLabel = 'Center';
      if (hand.angle < -10) spaceLabel = 'Left Stereo + Reverb';
      else if (hand.angle > 10) spaceLabel = 'Right Stereo + Delay';

      // Dynamic calculated BPM based on stretch
      const calculatedBPM = Math.round(emotion.baseBPM + (hand.spread - 0.4) * 40);

      setSysParams({
        bpm: Math.max(50, Math.min(180, calculatedBPM)),
        pitch: pitchLabel,
        timbre: timbreLabel,
        space: spaceLabel,
        lowEnergy: parseFloat(energy.toFixed(3)),
        fps: fps
      });
    }, 150);

    return () => clearInterval(interval);
  }, [engineLoading, emotion, fps]);

  // 16ms high-frequency processing loop to ensure no gesture data or micro-motions are dropped
  useEffect(() => {
    if (engineLoading) return;

    const interval = setInterval(() => {
      const landmarks = latestHandResultsRef.current;
      if (landmarks) {
        const gesture = parseGesture(landmarks, filterRef.current);
        if (gesture) {
          fingerCountRef.current = gesture.extendedFingers;

          // Map rotation to angle in degrees, capped between -45 and 45 for compatibility
          let angleDeg = (gesture.rotation * 180) / Math.PI + 90;
          if (angleDeg > 180) angleDeg -= 360;
          if (angleDeg < -180) angleDeg += 360;
          const clampedAngle = Math.max(-45, Math.min(45, angleDeg));

          handDataRef.current = {
            x: gesture.x,
            y: gesture.y,
            spread: gesture.spread,
            angle: clampedAngle,
            isActive: true,
            rotation: gesture.rotation,
            extendedFingers: gesture.extendedFingers,
            speed: gesture.speed,
            acceleration: gesture.acceleration,
            direction: gesture.direction,
            shape: gesture.shape,
            vx: gesture.vx,
            vy: gesture.vy
          };

          // Update audio synthesis values
          audioEngine.updateParams(handDataRef.current);
        }
      } else {
        // If no hand is found on camera, slowly fade active status
        if (!useTouchFallback) {
          fingerCountRef.current = 0;
          handDataRef.current.isActive = false;
        }
      }
    }, 16);

    return () => clearInterval(interval);
  }, [engineLoading, useTouchFallback]);

  // 2.5 Auto-dismiss onboarding after 3.5 seconds
  useEffect(() => {
    if (!engineLoading && showOnboarding) {
      const timer = setTimeout(() => {
        setShowOnboarding(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [engineLoading, showOnboarding]);

  // 2.6 Ultra high performance requestAnimationFrame loop for real-time dimension HUD & status updates
  useEffect(() => {
    let rafId: number;

    const updateHUD = () => {
      const hand = handDataRef.current;
      const isActive = hand.isActive;

      const melodyVal = document.getElementById('hud-val-melody');
      const rhythmVal = document.getElementById('hud-val-rhythm');
      const timbreVal = document.getElementById('hud-val-timbre');
      const spaceVal = document.getElementById('hud-val-space');

      const cardMelody = document.getElementById('hud-card-melody');
      const cardRhythm = document.getElementById('hud-card-rhythm');
      const cardTimbre = document.getElementById('hud-card-timbre');
      const cardSpace = document.getElementById('hud-card-space');

      const statusIcon = document.getElementById('gesture-status-icon');
      const statusText = document.getElementById('gesture-status-text');
      const fingersContainer = document.getElementById('gesture-fingers-container');
      const fingersCount = document.getElementById('gesture-fingers');

      if (isActive) {
        // Update values
        let pitchLabel = 'C4 (中音)';
        if (hand.y < 0.3) pitchLabel = 'C3 (低音)';
        else if (hand.y > 0.7) pitchLabel = 'C5 (高音)';

        let rhythmLabel = '中等密度';
        if (hand.spread < 0.3) rhythmLabel = '稀疏点缀';
        else if (hand.spread > 0.6) rhythmLabel = '密集繁盛';

        let timbreLabel = '金属冷冽';
        if (hand.x < 0.33) timbreLabel = '玻璃温润';
        else if (hand.x > 0.66) timbreLabel = '霓虹明亮';

        let spaceLabel = '平衡居中';
        if (hand.angle < -12) spaceLabel = '左环绕(混响)';
        else if (hand.angle > 12) spaceLabel = '右环绕(延迟)';

        if (melodyVal) melodyVal.innerText = pitchLabel;
        if (rhythmVal) rhythmVal.innerText = rhythmLabel;
        if (timbreVal) timbreVal.innerText = timbreLabel;
        if (spaceVal) spaceVal.innerText = spaceLabel;

        // Apply active glows
        if (cardMelody) {
          cardMelody.style.borderColor = 'rgba(59, 130, 246, 0.5)';
          cardMelody.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.25)';
        }
        if (cardRhythm) {
          cardRhythm.style.borderColor = 'rgba(99, 102, 241, 0.5)';
          cardRhythm.style.boxShadow = '0 0 15px rgba(99, 102, 241, 0.25)';
        }
        if (cardTimbre) {
          cardTimbre.style.borderColor = 'rgba(16, 185, 129, 0.5)';
          cardTimbre.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.25)';
        }
        if (cardSpace) {
          cardSpace.style.borderColor = 'rgba(236, 72, 153, 0.5)';
          cardSpace.style.boxShadow = '0 0 15px rgba(236, 72, 153, 0.25)';
        }

        // Status Indicators
        if (statusIcon) { statusIcon.innerText = '✓'; statusIcon.className = 'text-emerald-400 text-xs font-bold'; }
        if (statusText) { statusText.innerText = '检测到手势'; statusText.className = 'text-emerald-400 font-bold'; }
        if (fingersContainer) fingersContainer.classList.remove('hidden');
        if (fingersCount) fingersCount.innerText = String(fingerCountRef.current);
      } else {
        // If inactive, show default labels and remove glows
        if (melodyVal) melodyVal.innerText = 'C4 (平衡)';
        if (rhythmVal) rhythmVal.innerText = '中等密度';
        if (timbreVal) timbreVal.innerText = '玻璃温润';
        if (spaceVal) spaceVal.innerText = '平衡居中';

        if (cardMelody) { cardMelody.style.borderColor = 'rgba(255, 255, 255, 0.05)'; cardMelody.style.boxShadow = 'none'; }
        if (cardRhythm) { cardRhythm.style.borderColor = 'rgba(255, 255, 255, 0.05)'; cardRhythm.style.boxShadow = 'none'; }
        if (cardTimbre) { cardTimbre.style.borderColor = 'rgba(255, 255, 255, 0.05)'; cardTimbre.style.boxShadow = 'none'; }
        if (cardSpace) { cardSpace.style.borderColor = 'rgba(255, 255, 255, 0.05)'; cardSpace.style.boxShadow = 'none'; }

        // Status Indicators
        if (statusIcon) { statusIcon.innerText = '✗'; statusIcon.className = 'text-red-500 text-xs font-bold'; }
        if (statusText) { statusText.innerText = '未检测到手势'; statusText.className = 'text-slate-400'; }
        if (fingersContainer) fingersContainer.classList.add('hidden');
      }

      rafId = requestAnimationFrame(updateHUD);
    };

    rafId = requestAnimationFrame(updateHUD);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Clean up previous video blob on unmount
  useEffect(() => {
    return () => {
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [recordedVideoUrl]);

  // Stop camera stream safely
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // 3. MediaPipe Hands setup with robust Fallback triggering
  const initHandsTracking = async () => {
    const Hands = (window as any).Hands;
    const Camera = (window as any).Camera;

    if (!Hands || !Camera || !videoRef.current) {
      console.warn('MediaPipe SDKs not yet fully loaded. Switching to Touch mode.');
      setUseTouchFallback(true);
      return;
    }

    try {
      // Create Hands instance
      const hands = new Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.3,
        minTrackingConfidence: 0.3
      });

      hands.onResults(onHandResults);

      // Let's use flexible and modern constraints with ideal settings
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };

        const mpCamera = new Camera(videoRef.current, {
          onFrame: async () => {
            try {
              if (videoRef.current && videoRef.current.readyState >= 2) {
                await hands.send({ image: videoRef.current });
              }
            } catch (err) {
              console.warn('MediaPipe hands.send error caught:', err);
            }
          },
          width: 640,
          height: 480
        });

        mpCamera.start();
        setCameraActive(true);
        setUseTouchFallback(false);
        setCameraError(null);
      }
    } catch (err: any) {
      console.error('Camera access or MediaPipe load failed:', err);
      let errorMsg = '未允许使用摄像头，已切换至触控模式。';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = '摄像头权限已被拒绝。请点击浏览器地址栏的摄像头图标授予权限，然后刷新重试，体验最震撼的手势追踪！';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = '未找到可用的摄像头设备，请确认设备已插入。';
      } else {
        errorMsg = `启动摄像头时出现错误: ${err.message || '未知错误'}`;
      }
      setCameraError(errorMsg);
      setUseTouchFallback(true);
    }
  };

  // Helper to count extended fingers based on landmarks
  const countFingers = (landmarks: any[]) => {
    if (!landmarks || landmarks.length < 21) return 0;
    let count = 0;
    
    // Index, Middle, Ring, Pinky tips: 8, 12, 16, 20
    // Corresponding PIP joints: 6, 10, 14, 18
    const tips = [8, 12, 16, 20];
    const joints = [6, 10, 14, 18];
    
    for (let i = 0; i < 4; i++) {
      if (landmarks[tips[i]].y < landmarks[joints[i]].y) {
        count++;
      }
    }
    
    // Thumb: Tip 4 is higher than joint 2
    if (landmarks[4].y < landmarks[2].y) {
      count++;
    }
    
    return count;
  };

  // 4. Low pass filter for hand landmarks smoothing
  const onHandResults = (results: any) => {
    // 调试代码：手势检测 (保留在最终代码中)
    console.log("手势检测:", results.multiHandLandmarks);

    // Update Preview Canvas
    const canvas = previewCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        // Draw video frame mirrored
        if (videoRef.current && videoRef.current.readyState >= 2) {
          ctx.save();
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, 0, 0, width, height);
          ctx.restore();
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, width, height);
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = 1;
          for (let i = 20; i < width; i += 20) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
          }
          for (let j = 20; j < height; j += 20) {
            ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(width, j); ctx.stroke();
          }
        }

        // Draw hand landmarks if detected
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = results.multiHandLandmarks[0];
          
          // Connection lines
          const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [0, 9], [9, 10], [10, 11], [11, 12],
            [0, 13], [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20],
            [5, 9], [9, 13], [13, 17]
          ];

          ctx.strokeStyle = '#10b981'; // Emerald for skeleton line
          ctx.lineWidth = 2.5;
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#10b981';
          
          for (const [p1, p2] of connections) {
            const pt1 = landmarks[p1];
            const pt2 = landmarks[p2];
            if (pt1 && pt2) {
              ctx.beginPath();
              ctx.moveTo((1 - pt1.x) * width, pt1.y * height);
              ctx.lineTo((1 - pt2.x) * width, pt2.y * height);
              ctx.stroke();
            }
          }
          
          ctx.shadowBlur = 0; // Reset

          // Draw dots
          for (let i = 0; i < landmarks.length; i++) {
            const pt = landmarks[i];
            const isTip = [4, 8, 12, 16, 20].includes(i);
            
            ctx.beginPath();
            ctx.arc((1 - pt.x) * width, pt.y * height, isTip ? 4 : 2.5, 0, 2 * Math.PI);
            ctx.fillStyle = isTip ? '#ef4444' : '#60a5fa'; // Red tips, Blue joints
            ctx.fill();
            
            if (isTip) {
              ctx.beginPath();
              ctx.arc((1 - pt.x) * width, pt.y * height, 6, 0, 2 * Math.PI);
              ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          }
        }
      }
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      latestHandResultsRef.current = results.multiHandLandmarks[0];
    } else {
      latestHandResultsRef.current = null;
    }
  };

  // 5. Fallback Touch controls
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (!useTouchFallback) return;
    updateTouchCoordinates(e);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!useTouchFallback) return;
    updateTouchCoordinates(e);
  };

  const handleTouchEnd = () => {
    if (!useTouchFallback) return;
    // Keep parameters but set inactive state
  };

  const updateTouchCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    let isMultiTouch = false;
    let touchDistance = 0.4;

    // Handle touch vs mouse
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;

      // Double finger pinch triggers Spread mapping
      if (e.touches.length > 1) {
        isMultiTouch = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Map distance to spread
        touchDistance = Math.min(1.0, Math.max(0.0, dist / 300));
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Normalized X (0-1), Y (0-1)
    const rawX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawY = Math.max(0, Math.min(1, isMobile ? (clientY - rect.top) / rect.height : 1.0 - (clientY - rect.top) / rect.height));

    // For mouse/single touch, spread and angle are adjustable via sliders
    // or can be simulated with secondary swipe movements
    const current = handDataRef.current;
    const alpha = 0.15; // responsive touch feedback

    // On mobile, double finger pinch = 0.8 (open/spread), single finger = 0.3 (closed)
    const newSpread = isMobile
      ? (isMultiTouch ? 0.8 : 0.3)
      : (isMultiTouch ? touchDistance : touchInfo.spread);

    handDataRef.current = {
      x: current.x * (1 - alpha) + rawX * alpha,
      y: current.y * (1 - alpha) + rawY * alpha,
      spread: current.spread * (1 - alpha) + newSpread * alpha,
      angle: current.angle * (1 - alpha) + touchInfo.angle * alpha,
      isActive: true,
      isTouchFallback: true
    };

    setTouchInfo((prev) => ({
      ...prev,
      x: rawX,
      y: rawY,
      spread: isMobile ? (isMultiTouch ? 0.8 : 0.3) : (isMultiTouch ? touchDistance : prev.spread)
    }));

    audioEngine.updateParams(handDataRef.current);
  };

  // Adjust touch parameters via slider panels
  const updateTouchProperty = (property: 'spread' | 'angle', val: number) => {
    setTouchInfo((prev) => {
      const updated = { ...prev, [property]: val };
      handDataRef.current = {
        ...handDataRef.current,
        [property]: val,
        isActive: true,
        isTouchFallback: true
      };
      audioEngine.updateParams(handDataRef.current);
      return updated;
    });
  };

  // 6. MediaRecorder capturing video & audio
  const startRecording = async () => {
    if (isRecording) return;

    // Restart Audio Context to ensure direct tracks are active
    await audioEngine.startAudio();

    const canvas = canvasRef.current;
    if (!canvas) return;

    recordedChunksRef.current = [];
    setIsRecording(true);
    setRecordingSeconds(15);
    setRecordedVideoUrl(null);
    setRecordingSuccess(false);

    try {
      // Capture 30fps canvas stream
      const canvasStream = (canvas as any).captureStream(30);
      const audioStream = audioEngine.getAudioStream();

      // Combine streams
      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((track: any) => combinedStream.addTrack(track));

      if (audioStream && audioStream.getAudioTracks().length > 0) {
        audioStream.getAudioTracks().forEach((track: any) => combinedStream.addTrack(track));
      } else {
        console.warn('Direct synth audio stream not found, recording silent video');
      }

      // Check supported recording format
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!(window as any).MediaRecorder || !MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000 // High quality 2.5 Mbps
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const videoUrl = URL.createObjectURL(blob);
        setRecordedVideoUrl(videoUrl);
        setRecordingSuccess(true);
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();

      // Start 15s Countdown
      const countdownInterval = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Recording initialization failed:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleReset = () => {
    // Reset positions to center parameters
    handDataRef.current = {
      x: 0.5,
      y: 0.5,
      spread: 0.4,
      angle: 0,
      isActive: false
    };
    setTouchInfo({ x: 0.5, y: 0.5, spread: 0.4, angle: 0 });
    audioEngine.updateParams(handDataRef.current);
    if (visualEngineRef.current) {
      visualEngineRef.current.updateEmotion(emotion);
      visualEngineRef.current.setMode(growthMode);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#020206] select-none text-white font-sans">
      {/* 1. Ethereal Splash Loader */}
      <AnimatePresence>
        {engineLoading && (
          <motion.div
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#05050a]"
          >
            <div className="max-w-md w-full px-8 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                className="w-16 h-16 rounded-full border-2 border-t-blue-500 border-r-indigo-500 border-b-transparent border-l-transparent mx-auto mb-6"
              />
              <h2 className="text-xl font-bold font-display tracking-widest text-slate-100 mb-2">
                正在启动情绪织体引擎...
              </h2>
              <p className="text-xs font-mono text-slate-400 mb-8">
                Initializing MediaPipe Hands & Tone.js Synthesis
              </p>
              
              {!showStartButton ? (
                <>
                  <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                    <motion.div
                      className="bg-gradient-to-right from-blue-500 to-indigo-500 h-full"
                      animate={{ width: `${loadingProgress}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-2 text-right">
                    {loadingProgress}%
                  </div>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <motion.button
                    whileHover={{ scale: 1.05, shadow: '0 0 20px rgba(59, 130, 246, 0.4)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStartEngine}
                    className="w-full px-8 py-4 rounded-xl bg-gradient-to-right from-blue-500 to-indigo-600 font-semibold text-white tracking-widest text-sm shadow-xl flex items-center gap-2.5 justify-center cursor-pointer glow-border"
                  >
                    <Zap className="w-4 h-4 animate-pulse text-yellow-300" />
                    <span>开启声音 • 进入「{emotion.name}」</span>
                  </motion.button>
                  <p className="text-[10px] text-slate-500 mt-4 leading-relaxed max-w-xs mx-auto">
                    💡 提示：点击按钮启动高精度声音艺术与视觉手势引擎。由于浏览器安全策略限制，音频发声必须由您手动点击开启。
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Mirror Camera Video for tracking */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        width="640"
        height="480"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* 2. Full-Screen Canvas Scene container */}
      <div
        className="w-full h-screen absolute inset-0 cursor-crosshair"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* 3. Overlay Interface UI Panels */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-20">
        
        {/* Header Bar */}
        <div className="flex justify-between items-start w-full pointer-events-auto">
          <div className="flex gap-3">
            {/* Back Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel text-xs text-slate-300 font-mono cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-slate-400" />
              <span>返回大厅</span>
            </motion.button>

            {/* Test Audio Button */}
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(59, 130, 246, 0.15)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => audioEngine.playTestSound()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel border border-blue-500/30 text-xs text-blue-300 font-mono cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-blue-400" />
              <span>测试声音 (Play C4)</span>
            </motion.button>
          </div>

          {/* Status badge and FPS info */}
          <div className="flex gap-3">
            {/* Tracking Mode Status */}
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl glass-panel text-xs font-mono border-white/5`}>
              <div className={`w-2 h-2 rounded-full ${cameraActive && !useTouchFallback ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{cameraActive && !useTouchFallback ? '摄像头手势捕捉中' : '模拟触控模式'}</span>
            </div>

            <div className="px-3 py-1.5 rounded-xl glass-panel text-xs font-mono text-slate-400">
              {fps} FPS
            </div>
          </div>
        </div>

        {/* Camera Permission / Access Error Alert banner */}
        <AnimatePresence>
          {cameraError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-4 rounded-xl glass-panel-light border-amber-500/20 text-amber-300 text-xs font-mono flex items-start gap-3 max-w-xl mx-auto pointer-events-auto"
            >
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-1">权限提示：</span>
                <p className="text-slate-300 leading-relaxed">{cameraError}</p>
                <p className="text-[10px] text-slate-400 mt-1.5">💡 提示：此时您依然可以通过在主屏幕任意位置滑动、拖拽进行模拟创作。</p>
              </div>
              <button
                onClick={() => setCameraError(null)}
                className="text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-all text-[10px] shrink-0"
              >
                我知道了
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left Side Parameters HUD (Heads-Up Display) */}
        <div className="flex flex-col md:flex-row justify-between items-end w-full gap-6 pointer-events-auto">
          <div className={`glass-panel p-5 rounded-2xl max-w-xs w-full border-white/10 flex flex-col gap-4 ${isMobile && !showDebug ? 'mobile-debug' : ''}`}>
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">Current Theme</span>
                <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: `linear-gradient(to right, ${emotion.colors[0]}, ${emotion.colors[1]})` }} />
                  {emotion.name}
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300">
                {emotion.architectureStyle.toUpperCase()}
              </span>
            </div>

            {/* Dynamic Telemetry stats */}
            <div className="flex flex-col gap-2.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">TEMPO:</span>
                <span className="text-indigo-300 font-bold">{sysParams.bpm} BPM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">PITCH (Y):</span>
                <span className="text-indigo-300">{sysParams.pitch}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TIMBRE (X):</span>
                <span className="text-indigo-300 font-bold">{sysParams.timbre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">SPACE (R):</span>
                <span className="text-indigo-300 max-w-[120px] text-right truncate">{sysParams.space}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">SOUND ENERGY:</span>
                <div className="w-24 bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-right from-indigo-400 to-pink-400 h-full transition-all duration-100"
                    style={{ width: `${Math.min(100, sysParams.lowEnergy * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Hint Box */}
            <div className="text-[10px] text-slate-400 bg-white/5 p-2 rounded-lg leading-relaxed flex gap-1.5 items-start">
              <HelpCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <span>
                {useTouchFallback 
                  ? '触控板：在屏幕上单指/鼠标拖动控制。使用下方滑块调节手掌张开度与倾角。' 
                  : '手势：在摄像头前展示单手，移近、张开或偏转手掌以感受声音与建筑的三维生长。'}
              </span>
            </div>
          </div>

          {/* Fallback Simulation Control Panel (Visible only when useTouchFallback is active) */}
          {useTouchFallback && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass-panel p-5 rounded-2xl max-w-sm w-full border-white/10 flex flex-col gap-4 ${isMobile && !showDebug ? 'mobile-debug' : ''}`}
            >
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-mono font-bold text-slate-200">触控辅助微调滑块</span>
              </div>

              <div className="flex flex-col gap-3.5">
                {/* Spread Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">五指张开度 (Rhythm 密度):</span>
                    <span className="text-indigo-300 font-bold">{(touchInfo.spread * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={touchInfo.spread}
                    onChange={(e) => updateTouchProperty('spread', parseFloat(e.target.value))}
                    className="w-full accent-blue-500 bg-slate-800 rounded-lg appearance-none h-1.5"
                  />
                </div>

                {/* Angle Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">手掌偏转倾角 (Space 声相):</span>
                    <span className="text-indigo-300 font-bold">{Math.round(touchInfo.angle)}°</span>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="1"
                    value={touchInfo.angle}
                    onChange={(e) => updateTouchProperty('angle', parseInt(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-800 rounded-lg appearance-none h-1.5"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Action Control Panel */}
          <div className="glass-panel p-4 rounded-2xl border-white/10 flex gap-3.5 items-center justify-center">
            {/* Record Trigger Button */}
            <motion.button
              whileHover={{ scale: isRecording ? 1.0 : 1.05 }}
              whileTap={{ scale: isRecording ? 1.0 : 0.95 }}
              onClick={startRecording}
              disabled={isRecording}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-mono text-sm font-bold shadow-lg transition-colors duration-300 ${
                isRecording
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gradient-to-right from-red-600 to-red-500 text-white hover:brightness-110'
              }`}
            >
              <Video className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
              <span>{isRecording ? `录制中 (${recordingSeconds}s)` : '录制 15s 短视频'}</span>
            </motion.button>

            {/* Mode Switch segmented control */}
            <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/5 font-mono text-xs">
              <button
                onClick={() => handleModeChange('free')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  growthMode === 'free'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                自由变化
              </button>
              <button
                onClick={() => handleModeChange('accumulate')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  growthMode === 'accumulate'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                累积生长
              </button>
            </div>

            {/* Reset Button */}
            <motion.button
              whileHover={{ scale: 1.05, rotate: 18 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-3 rounded-xl glass-panel text-slate-300 text-sm font-mono border-white/5"
              title="重置空间参数"
            >
              <RefreshCw className="w-4 h-4" />
              <span>重置</span>
            </motion.button>
          </div>

        </div>
      </div>

      {/* 3.5 Floating Interactive HUD overlays */}
      {/* Top-Left Floating Architectural HUD */}
      <div className="absolute top-20 left-6 flex flex-col gap-3 pointer-events-auto z-30">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-panel px-4 py-3.5 rounded-2xl border border-white/10 flex flex-col gap-2.5 min-w-[210px] bg-slate-950/45 backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-xs font-bold font-display tracking-widest text-white uppercase border-b border-white/5 pb-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>手势生长系统</span>
          </div>
          
          <div className="flex flex-col gap-1.5 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-[10px]">当前模式:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${growthMode === 'accumulate' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                {growthMode === 'accumulate' ? '累积生长' : '自由变化'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-[10px]">已生长结构:</span>
              <span className="text-white font-bold">{grownCount} / 1000 个</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 text-[10px]">建筑历史:</span>
              <span className="text-white font-bold">
                {Math.floor(archAge / 60)}:{(archAge % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Top-Right Floating Camera Preview & Hand Status */}
      {cameraActive && !useTouchFallback && (
        <div
          id="camera-preview"
          onTouchStart={() => isMobile && setCameraDragging(true)}
          className={isMobile ? "mobile-camera z-30 pointer-events-auto" : "absolute top-20 right-6 flex flex-col gap-3 pointer-events-auto items-end z-30"}
        >
          <motion.div
            layout
            onClick={() => !isMobile && setCameraZoomed(!cameraZoomed)}
            className={isMobile ? "w-full h-full relative" : "relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl cursor-pointer hover:border-white/40 transition-all bg-slate-950/50 backdrop-blur-md"}
            style={isMobile ? {} : {
              width: cameraZoomed ? 320 : 120,
              height: cameraZoomed ? 240 : 90,
            }}
          >
            {/* Live Dot Overlay */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded-full border border-white/5 text-[9px] font-mono font-bold tracking-wider text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
              <span>LIVE</span>
            </div>
            
            <canvas
              ref={previewCanvasRef}
              width={320}
              height={240}
              className="w-full h-full block"
              style={{ transform: 'scaleX(-1)' }} // Mirror the drawn skeleton canvas for intuitive feedback!
            />
          </motion.div>

          {/* Gesture Status Indicator below camera (desktop only) */}
          {!isMobile && (
            <motion.div
              layout
              className="glass-panel px-3.5 py-2 rounded-xl border border-white/10 flex flex-col gap-1 text-right min-w-[120px] font-mono bg-slate-950/40 backdrop-blur-md"
            >
              <div className="flex items-center justify-end gap-1.5 text-xs font-bold">
                <span id="gesture-status-icon" className="text-red-500 text-[10px]">✗</span>
                <span id="gesture-status-text" className="text-slate-400">未检测到手势</span>
              </div>
              <div id="gesture-fingers-container" className="text-[10px] text-slate-400 hidden">
                活跃手指：<span id="gesture-fingers" className="text-emerald-400 font-bold">0</span> 根
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Right Side Bottom Floating 4-Dimension Gesture HUD */}
      <div
        id="dimensions"
        className={isMobile ? "mobile-dimensions z-30 pointer-events-auto" : "absolute right-6 bottom-24 flex flex-col gap-3 z-30 pointer-events-auto items-end"}
      >
        {isMobile ? (
          <>
            {/* Melody */}
            <div className="dim-item active" id="hud-card-melody">
              <span className="dim-icon">🎵</span>
              <span id="hud-val-melody" className="truncate max-w-[80px]">C4</span>
            </div>
            {/* Rhythm */}
            <div className="dim-item active" id="hud-card-rhythm">
              <span className="dim-icon">🥁</span>
              <span id="hud-val-rhythm" className="truncate max-w-[80px]">中等</span>
            </div>
            {/* Timbre */}
            <div className="dim-item active" id="hud-card-timbre">
              <span className="dim-icon">🎹</span>
              <span id="hud-val-timbre" className="truncate max-w-[80px]">金属</span>
            </div>
            {/* Space */}
            <div className="dim-item active" id="hud-card-space">
              <span className="dim-icon">🌐</span>
              <span id="hud-val-space" className="truncate max-w-[80px]">平衡</span>
            </div>
          </>
        ) : (
          <>
            {/* Card 1: Melody */}
            <div
              id="hud-card-melody"
              className="w-[170px] h-[64px] rounded-xl glass-panel border border-white/5 p-2.5 flex items-center gap-3 transition-all duration-300 bg-slate-950/45 backdrop-blur-md"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Music className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0 font-sans">
                <div className="text-[10px] text-slate-400 font-medium">🎵 旋律 (Pitch)</div>
                <div id="hud-val-melody" className="text-xs font-bold text-white font-mono mt-0.5 truncate">C4 (中音)</div>
                <div className="text-[9px] text-blue-400/80 font-mono tracking-wider mt-0.5">上下移动</div>
              </div>
            </div>

            {/* Card 2: Rhythm */}
            <div
              id="hud-card-rhythm"
              className="w-[170px] h-[64px] rounded-xl glass-panel border border-white/5 p-2.5 flex items-center gap-3 transition-all duration-300 bg-slate-950/45 backdrop-blur-md"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0 font-sans">
                <div className="text-[10px] text-slate-400 font-medium">🥁 节奏 (Rhythm)</div>
                <div id="hud-val-rhythm" className="text-xs font-bold text-white font-mono mt-0.5 truncate">中等密度</div>
                <div className="text-[9px] text-indigo-400/80 font-mono tracking-wider mt-0.5">张合手掌</div>
              </div>
            </div>

            {/* Card 3: Timbre */}
            <div
              id="hud-card-timbre"
              className="w-[170px] h-[64px] rounded-xl glass-panel border border-white/5 p-2.5 flex items-center gap-3 transition-all duration-300 bg-slate-950/45 backdrop-blur-md"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0 font-sans">
                <div className="text-[10px] text-slate-400 font-medium">🎹 音色 (Timbre)</div>
                <div id="hud-val-timbre" className="text-xs font-bold text-white font-mono mt-0.5 truncate">金属冷冽</div>
                <div className="text-[9px] text-emerald-400/80 font-mono tracking-wider mt-0.5">左右移动</div>
              </div>
            </div>

            {/* Card 4: Space */}
            <div
              id="hud-card-space"
              className="w-[170px] h-[64px] rounded-xl glass-panel border border-white/5 p-2.5 flex items-center gap-3 transition-all duration-300 bg-slate-950/45 backdrop-blur-md"
            >
              <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4 text-pink-400" />
              </div>
              <div className="flex-1 min-w-0 font-sans">
                <div className="text-[10px] text-slate-400 font-medium">🌐 空间 (Space)</div>
                <div id="hud-val-space" className="text-xs font-bold text-white font-mono mt-0.5 truncate">平衡立体</div>
                <div className="text-[9px] text-pink-400/80 font-mono tracking-wider mt-0.5">倾斜手掌</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Onboarding Guide Overlay */}
      <AnimatePresence>
        {showOnboarding && !engineLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-md z-50 flex items-center justify-center p-6 pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1.0, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="max-w-md w-full glass-panel border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden bg-[#0d0e14]/90"
            >
              <button
                onClick={() => setShowOnboarding(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/5 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-14 h-14 rounded-full bg-blue-500/15 border border-blue-500/20 flex items-center justify-center mb-5">
                <Hand className="w-7 h-7 text-blue-400 animate-bounce" />
              </div>

              <h2 className="text-lg font-bold font-display tracking-widest text-white mb-2 uppercase">
                双生织体 • 手势控制指南
              </h2>
              <p className="text-[10px] text-slate-400 mb-6 font-mono tracking-wider uppercase">
                Gesture Interactions Guide
              </p>

              {/* Guide Grid */}
              <div className="grid grid-cols-2 gap-4 w-full mb-8 text-left">
                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 flex flex-col gap-1">
                  <div className="text-xs font-bold text-blue-400 flex items-center gap-1">
                    <span className="text-sm">↕</span>
                    <span>上下移动 ➔ 旋律</span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                    改变手掌高度以控制合成器音高，绘制高耸音符。
                  </p>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 flex flex-col gap-1">
                  <div className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                    <span className="text-sm">🖐</span>
                    <span>五指张合 ➔ 节奏</span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                    张开手掌使节奏密集，握合手掌使音韵疏松。
                  </p>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 flex flex-col gap-1">
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <span className="text-sm">↔</span>
                    <span>左右移动 ➔ 音色</span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                    改变左右位置以平滑控制温润与冷冽的声波材质。
                  </p>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 flex flex-col gap-1">
                  <div className="text-xs font-bold text-pink-400 flex items-center gap-1">
                    <span className="text-sm">⤾</span>
                    <span>手掌倾斜 ➔ 空间</span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                    左右偏转手掌，改变双声道效果器混响与延迟。
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowOnboarding(false)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-right from-blue-600 to-indigo-600 hover:brightness-110 font-semibold text-white tracking-widest text-xs shadow-lg transition-all cursor-pointer"
              >
                开始体验 (3s 后自动关闭)
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Active Recording progress ring/bar */}
      {isRecording && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-72 max-w-full">
          <div className="bg-black/70 backdrop-blur-md border border-red-500/20 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-2xl">
            <div className="flex items-center gap-2 text-xs text-red-400 font-mono font-bold uppercase animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-ping" />
              <span>REC • 正在记录情绪织体</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
              <motion.div
                className="bg-red-500 h-full"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 15, ease: 'linear' }}
              />
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              录制完成后将自动生成下载文件
            </div>
          </div>
        </div>
      )}

      {/* 5. Post-Recording Success Modal */}
      <AnimatePresence>
        {recordingSuccess && recordedVideoUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.92, y: 15 }}
              animate={{ scale: 1.0, y: 0 }}
              exit={{ scale: 0.92, y: 15 }}
              className="max-w-xl w-full glass-panel border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mb-5">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>

              <h2 className="text-2xl font-bold font-display tracking-tight text-white mb-2">
                情绪视频已成功织成！
              </h2>
              <p className="text-sm text-slate-400 max-w-sm mb-6">
                刚才你操纵「{emotion.name}」所激发的音频波形、参数轨迹与 3D 建筑生长，已完整渲染保存为本地视频。
              </p>

              {/* Video Preview */}
              <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10 mb-6 relative">
                <video
                  src={recordedVideoUrl}
                  controls
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3.5 w-full">
                <a
                  href={recordedVideoUrl}
                  download={`Emotion_Texture_${emotion.id}_${Date.now()}.webm`}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-right from-emerald-600 to-emerald-500 font-mono text-sm font-bold shadow-lg hover:brightness-110 transition-transform active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>下载视频</span>
                </a>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setRecordingSuccess(false);
                    setRecordedVideoUrl(null);
                  }}
                  className="flex-1 px-6 py-3.5 rounded-xl glass-panel text-slate-200 border-white/5 font-mono text-sm font-semibold hover:bg-white/10"
                >
                  再创作一次
                </motion.button>
              </div>

              <button
                onClick={onBack}
                className="mt-6 text-xs text-slate-500 hover:text-slate-300 font-mono transition-colors"
              >
                返回大厅，选择其他情绪
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
