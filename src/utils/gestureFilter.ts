/**
 * Double Exponential Smoothing Filter and Gesture Analysis Utilities
 */

export class DoubleExponentialFilter {
  public alpha: number;
  public beta: number;
  public x: number = 0.5;
  public dx: number = 0;
  public y: number = 0.5;
  public dy: number = 0;
  public spread: number = 0.5;
  public dspread: number = 0;
  public prevDx: number = 0;
  public prevDy: number = 0;

  constructor(alpha = 0.3, beta = 0.1) {
    this.alpha = alpha; // position smoothing
    this.beta = beta;   // velocity smoothing
  }

  public update(rawX: number, rawY: number, rawSpread: number) {
    // 1. Predict next state
    const predX = this.x + this.dx;
    const predY = this.y + this.dy;
    const predSpread = this.spread + this.dspread;

    // 2. Correct with actual measurement & update trend
    const residualX = rawX - predX;
    this.x = predX + this.alpha * residualX;
    this.prevDx = this.dx;
    this.dx = this.dx + this.beta * residualX;

    const residualY = rawY - predY;
    this.y = predY + this.alpha * residualY;
    this.prevDy = this.dy;
    this.dy = this.dy + this.beta * residualY;

    const residualSpread = rawSpread - predSpread;
    this.spread = predSpread + this.alpha * residualSpread;
    this.dspread = this.dspread + this.beta * residualSpread;

    return {
      x: this.x,
      y: this.y,
      spread: this.spread,
      vx: this.dx,
      vy: this.dy,
      vs: this.dspread,
      ax: this.dx - this.prevDx,
      ay: this.dy - this.prevDy
    };
  }
}

export function quantizeDirection(vx: number, vy: number): 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'STATIC' {
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed < 0.005) return 'STATIC';

  const angle = Math.atan2(vy, vx); // -PI to PI
  let deg = (angle * 180) / Math.PI;
  if (deg < 0) deg += 360;

  // Shift by 22.5 to center the intervals
  const index = Math.floor(((deg + 22.5) % 360) / 45);
  const dirs: ('E' | 'NE' | 'N' | 'NW' | 'W' | 'SW' | 'S' | 'SE')[] = [
    'E',
    'NE',
    'N',
    'NW',
    'W',
    'SW',
    'S',
    'SE'
  ];
  return dirs[index] || 'STATIC';
}

export function detectShape(
  landmarks: any[],
  spread: number,
  extendedFingers: number
): 'pinch' | 'fist' | 'open' | 'pointing' {
  if (!landmarks || landmarks.length < 21) return 'open';

  // Fist: very low spread or zero fingers extended
  if (extendedFingers === 0 || spread < 0.15) {
    return 'fist';
  }

  // Pinch: Thumb tip (4) close to index tip (8)
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  if (thumbTip && indexTip) {
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.06 && extendedFingers <= 2) {
      return 'pinch';
    }
  }

  // Pointing: Only index finger (8) is extended, others folded
  // index tip is 8, index PIP is 6
  if (extendedFingers === 1 && landmarks[8].y < landmarks[6].y) {
    return 'pointing';
  }

  return 'open';
}

export function parseGesture(landmarks: any[], filter: DoubleExponentialFilter) {
  if (!landmarks || landmarks.length < 21) {
    return null;
  }

  const wrist = landmarks[0];
  const middleTip = landmarks[12];

  // 1. Position mapping (wrist is highly stable)
  const rawX = 1.0 - wrist.x; // Mirrored for intuitive control
  const rawY = 1.0 - wrist.y;

  // 2. Spread calculation: average distance of fingertips to wrist
  const fingerTips = [4, 8, 12, 16, 20];
  let distSum = 0;
  fingerTips.forEach((tip) => {
    const dx = landmarks[tip].x - wrist.x;
    const dy = landmarks[tip].y - wrist.y;
    distSum += Math.sqrt(dx * dx + dy * dy);
  });
  const avgDist = distSum / 5;
  // Map 0.15 - 0.45 raw average distance to 0 - 1 normalized range
  const rawSpread = Math.max(0, Math.min(1, (avgDist - 0.15) / 0.3));

  // 3. Update filter to get filtered positions and velocities/accelerations
  const filtered = filter.update(rawX, rawY, rawSpread);

  // 4. Palm rotation angle from wrist to middle finger tip
  const rotation = Math.atan2(middleTip.y - wrist.y, middleTip.x - wrist.x);

  // 5. Extended fingers detection (index 8, middle 12, ring 16, pinky 20 vs their joint roots 6, 10, 14, 18)
  // landmarks are y-down, so finger tip y < joint root y means extended
  const extendedFingers = [8, 12, 16, 20].filter(
    (i) => landmarks[i].y < landmarks[i - 2].y
  ).length + (landmarks[4].y < landmarks[2].y ? 1 : 0);

  // 6. Velocity and Acceleration magnitude
  const speed = Math.sqrt(filtered.vx * filtered.vx + filtered.vy * filtered.vy);
  const acceleration = Math.sqrt(filtered.ax * filtered.ax + filtered.ay * filtered.ay);

  // 7. Direction quantization
  const direction = quantizeDirection(filtered.vx, filtered.vy);

  // 8. Shape detection
  const shape = detectShape(landmarks, filtered.spread, extendedFingers);

  return {
    x: filtered.x,
    y: filtered.y,
    spread: filtered.spread,
    rotation,
    extendedFingers,
    speed,
    acceleration,
    direction,
    shape,
    vx: filtered.vx,
    vy: filtered.vy
  };
}
