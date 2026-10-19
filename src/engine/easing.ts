import { CubicBezierTuple, EasingDefinition } from '../types/scene';

/**
 * Solves cubic-bezier(p1x, p1y, p2x, p2y) at progress t in [0, 1]
 * using Newton-Raphson with bisection fallback for deterministic accuracy.
 */
export function evaluateCubicBezier(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  t: number
): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (p1x === p1y && p2x === p2y) return t; // Linear

  const cx = 3.0 * p1x;
  const bx = 3.0 * (p2x - p1x) - cx;
  const ax = 1.0 - cx - bx;

  const cy = 3.0 * p1y;
  const by = 3.0 * (p2y - p1y) - cy;
  const ay = 1.0 - cy - by;

  const sampleCurveX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleCurveY = (u: number) => ((ay * u + by) * u + cy) * u;
  const sampleCurveDerivativeX = (u: number) => (3.0 * ax * u + 2.0 * bx) * u + cx;

  // Solve for parameter u given x = t
  let u = t;
  for (let i = 0; i < 8; i++) {
    const x2 = sampleCurveX(u) - t;
    if (Math.abs(x2) < 1e-6) {
      return sampleCurveY(u);
    }
    const d2 = sampleCurveDerivativeX(u);
    if (Math.abs(d2) < 1e-6) break;
    u = u - x2 / d2;
  }

  // Fallback to bisection
  let u0 = 0.0;
  let u1 = 1.0;
  u = t;
  for (let i = 0; i < 12; i++) {
    const x2 = sampleCurveX(u);
    if (Math.abs(x2 - t) < 1e-6) break;
    if (t > x2) u0 = u;
    else u1 = u;
    u = (u1 - u0) * 0.5 + u0;
  }

  return sampleCurveY(u);
}

export function evaluateEasing(easing: EasingDefinition | undefined, rawT: number): number {
  const t = Math.max(0, Math.min(1, rawT));
  if (!easing || easing === 'linear') return t;

  if (Array.isArray(easing) && easing.length === 4) {
    const [x1, y1, x2, y2] = easing as CubicBezierTuple;
    return evaluateCubicBezier(x1, y1, x2, y2, t);
  }

  switch (easing) {
    case 'easeInQuad':
      return t * t;
    case 'easeOutQuad':
      return 1 - (1 - t) * (1 - t);
    case 'easeInOutQuad':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'easeInCubic':
      return t * t * t;
    case 'easeOutCubic':
      return 1 - Math.pow(1 - t, 3);
    case 'easeInOutCubic':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'easeOutQuart':
      return 1 - Math.pow(1 - t, 4);
    case 'easeInOutQuart':
      return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
    case 'easeOutBack': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case 'easeInOutBack': {
      const c1 = 1.70158;
      const c2 = c1 * 1.525;
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }
    case 'easeOutElastic': {
      if (t === 0 || t === 1) return t;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    case 'spring': {
      // Critically damped spring approximation with slight overshoot
      return 1 - Math.exp(-6.5 * t) * Math.cos(9 * t);
    }
    case 'step':
      return t < 1 ? 0 : 1;
    default:
      return t;
  }
}

interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

const NAMED_COLORS: Record<string, string> = {
  transparent: 'rgba(0,0,0,0)',
  white: '#ffffff',
  black: '#000000',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  cyan: '#06b6d4',
  slate: '#64748b',
};

export function parseColorString(colorStr: string): RGBAColor | null {
  const s = colorStr.trim().toLowerCase();
  const mapped = NAMED_COLORS[s] || s;

  if (mapped.startsWith('#')) {
    const hex = mapped.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  const rgbaMatch = mapped.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/
  );
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      a: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    };
  }

  return null;
}

export function interpolateColor(fromColor: string, toColor: string, progress: number): string {
  const c1 = parseColorString(fromColor);
  const c2 = parseColorString(toColor);
  if (!c1 || !c2) {
    return progress < 0.5 ? fromColor : toColor;
  }
  const r = Math.round(c1.r + (c2.r - c1.r) * progress);
  const g = Math.round(c1.g + (c2.g - c1.g) * progress);
  const b = Math.round(c1.b + (c2.b - c1.b) * progress);
  const a = Number((c1.a + (c2.a - c1.a) * progress).toFixed(3));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
