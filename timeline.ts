// ============================================================================
// Module 3: Deterministic Timeline, Easing, Path Morphing & Interpolation Engine
// ============================================================================

import {
  CameraSpec,
  EasingSpec,
  KeyframeSpec,
  SceneElement,
  TrackPoint,
} from './schema';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Solves cubic-bezier(x1, y1, x2, y2) at progress t in [0, 1] using Newton-Raphson + bisection fallback.
 */
export function solveCubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number
): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (x1 === y1 && x2 === y2) return t;

  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleCurveX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleCurveY = (u: number) => ((ay * u + by) * u + cy) * u;
  const sampleCurveDerivativeX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;

  let u = t;
  for (let i = 0; i < 8; i++) {
    const xErr = sampleCurveX(u) - t;
    if (Math.abs(xErr) < 1e-6) {
      return sampleCurveY(u);
    }
    const d = sampleCurveDerivativeX(u);
    if (Math.abs(d) < 1e-6) break;
    u -= xErr / d;
  }

  // Bisection fallback
  let lo = 0;
  let hi = 1;
  u = t;
  for (let i = 0; i < 12; i++) {
    const xVal = sampleCurveX(u);
    if (Math.abs(xVal - t) < 1e-6) break;
    if (t > xVal) lo = u;
    else hi = u;
    u = (lo + hi) * 0.5;
  }
  return sampleCurveY(u);
}

/**
 * Evaluates any EasingSpec at normalized progress t in [0, 1].
 */
export function evaluateEasing(tRaw: number, easing?: EasingSpec): number {
  const t = clamp(tRaw, 0, 1);
  if (!easing || easing === 'linear') return t;

  if (Array.isArray(easing)) {
    if (easing[0] === 'cubic-bezier') {
      return solveCubicBezier(easing[1], easing[2], easing[3], easing[4], t);
    }
    if (easing[0] === 'steps') {
      const steps = Math.max(1, Math.floor(easing[1]));
      return Math.min(1, Math.floor(t * steps) / steps);
    }
    return t;
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
    case 'easeInQuart':
      return t * t * t * t;
    case 'easeOutQuart':
      return 1 - Math.pow(1 - t, 4);
    case 'easeInOutQuart':
      return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
    case 'easeInBack': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return c3 * t * t * t - c1 * t * t;
    }
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
    case 'easeOutBounce': {
      const n1 = 7.5625;
      const d1 = 2.75;
      let u = t;
      if (u < 1 / d1) return n1 * u * u;
      if (u < 2 / d1) return n1 * (u -= 1.5 / d1) * u + 0.75;
      if (u < 2.5 / d1) return n1 * (u -= 2.25 / d1) * u + 0.9375;
      return n1 * (u -= 2.625 / d1) * u + 0.984375;
    }
    case 'spring': {
      // Critically damped / slight overshoot analytical spring
      return 1 - Math.exp(-6.5 * t) * Math.cos(9.5 * t);
    }
    case 'stepStart':
      return t > 0 ? 1 : 0;
    case 'stepEnd':
      return t >= 1 ? 1 : 0;
    default:
      return t;
  }
}

export function lerpNumber(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

/**
 * Parses hex (#rgb, #rrggbb, #rrggbbaa) or rgb/rgba strings into [r, g, b, a].
 */
export function parseColor(color: string): [number, number, number, number] | null {
  if (!color || typeof color !== 'string') return null;
  const s = color.trim();
  if (s === 'none' || s === 'transparent') return [0, 0, 0, 0];

  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
        1,
      ];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        1,
      ];
    }
    if (hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        parseInt(hex.slice(6, 8), 16) / 255,
      ];
    }
  }

  const rgbaMatch = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(s);
  if (rgbaMatch) {
    return [
      Number(rgbaMatch[1]),
      Number(rgbaMatch[2]),
      Number(rgbaMatch[3]),
      rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    ];
  }
  return null;
}

export function lerpColor(c1: string, c2: string, u: number): string {
  const p1 = parseColor(c1);
  const p2 = parseColor(c2);
  if (!p1 || !p2) return u < 0.5 ? c1 : c2;
  const r = Math.round(lerpNumber(p1[0], p2[0], u));
  const g = Math.round(lerpNumber(p1[1], p2[1], u));
  const b = Math.round(lerpNumber(p1[2], p2[2], u));
  const a = Number(lerpNumber(p1[3], p2[3], u).toFixed(3));
  if (a >= 0.999) {
    return `rgb(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(b, 0, 255)})`;
  }
  return `rgba(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(b, 0, 255)}, ${clamp(a, 0, 1)})`;
}

/**
 * Normalized Cubic Segment for SVG Path Rendering, Trim-Path Drawing, and Shape Morphing.
 */
export interface CubicSegment {
  x0: number;
  y0: number;
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
  x: number;
  y: number;
  length: number;
  moveBefore: boolean;
}

function cubicPoint(
  x0: number,
  p1: number,
  p2: number,
  x: number,
  t: number
): number {
  const mt = 1 - t;
  return (
    mt * mt * mt * x0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * x
  );
}

function estimateCubicLength(
  x0: number,
  y0: number,
  cp1x: number,
  cp1y: number,
  cp2x: number,
  cp2y: number,
  x: number,
  y: number
): number {
  const steps = 12;
  let len = 0;
  let px = x0;
  let py = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const nx = cubicPoint(x0, cp1x, cp2x, x, t);
    const ny = cubicPoint(y0, cp1y, cp2y, y, t);
    len += Math.hypot(nx - px, ny - py);
    px = nx;
    py = ny;
  }
  return len;
}

/**
 * Parses an SVG path `d` string into normalized CubicSegments.
 * Supports M, m, L, l, H, h, V, v, C, c, S, s, Q, q, Z, z.
 */
export function parseSvgPathToCubics(d: string): CubicSegment[] {
  if (!d || typeof d !== 'string') return [];
  const tokens =
    d.match(/[a-df-zA-DF-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || [];
  const segments: CubicSegment[] = [];

  let i = 0;
  let cmd = '';
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let prevCpX = 0;
  let prevCpY = 0;
  let pendingMove = true;

  const nextNum = (): number => {
    const v = parseFloat(tokens[i++] || '0');
    return Number.isFinite(v) ? v : 0;
  };

  const addLineSegment = (nx: number, ny: number) => {
    const cp1x = curX + (nx - curX) / 3;
    const cp1y = curY + (ny - curY) / 3;
    const cp2x = curX + ((nx - curX) * 2) / 3;
    const cp2y = curY + ((ny - curY) * 2) / 3;
    const length = Math.hypot(nx - curX, ny - curY);
    segments.push({
      x0: curX,
      y0: curY,
      cp1x,
      cp1y,
      cp2x,
      cp2y,
      x: nx,
      y: ny,
      length,
      moveBefore: pendingMove,
    });
    pendingMove = false;
    curX = nx;
    curY = ny;
    prevCpX = nx;
    prevCpY = ny;
  };

  while (i < tokens.length) {
    const tok = tokens[i];
    if (/^[a-df-zA-DF-Z]$/.test(tok)) {
      cmd = tok;
      i++;
    }
    if (!cmd) break;

    switch (cmd) {
      case 'M': {
        curX = nextNum();
        curY = nextNum();
        startX = curX;
        startY = curY;
        prevCpX = curX;
        prevCpY = curY;
        pendingMove = true;
        cmd = 'L';
        break;
      }
      case 'm': {
        curX += nextNum();
        curY += nextNum();
        startX = curX;
        startY = curY;
        prevCpX = curX;
        prevCpY = curY;
        pendingMove = true;
        cmd = 'l';
        break;
      }
      case 'L': {
        addLineSegment(nextNum(), nextNum());
        break;
      }
      case 'l': {
        addLineSegment(curX + nextNum(), curY + nextNum());
        break;
      }
      case 'H': {
        addLineSegment(nextNum(), curY);
        break;
      }
      case 'h': {
        addLineSegment(curX + nextNum(), curY);
        break;
      }
      case 'V': {
        addLineSegment(curX, nextNum());
        break;
      }
      case 'v': {
        addLineSegment(curX, curY + nextNum());
        break;
      }
      case 'C': {
        const cp1x = nextNum();
        const cp1y = nextNum();
        const cp2x = nextNum();
        const cp2y = nextNum();
        const nx = nextNum();
        const ny = nextNum();
        const length = estimateCubicLength(curX, curY, cp1x, cp1y, cp2x, cp2y, nx, ny);
        segments.push({
          x0: curX,
          y0: curY,
          cp1x,
          cp1y,
          cp2x,
          cp2y,
          x: nx,
          y: ny,
          length,
          moveBefore: pendingMove,
        });
        pendingMove = false;
        prevCpX = cp2x;
        prevCpY = cp2y;
        curX = nx;
        curY = ny;
        break;
      }
      case 'c': {
        const cp1x = curX + nextNum();
        const cp1y = curY + nextNum();
        const cp2x = curX + nextNum();
        const cp2y = curY + nextNum();
        const nx = curX + nextNum();
        const ny = curY + nextNum();
        const length = estimateCubicLength(curX, curY, cp1x, cp1y, cp2x, cp2y, nx, ny);
        segments.push({
          x0: curX,
          y0: curY,
          cp1x,
          cp1y,
          cp2x,
          cp2y,
          x: nx,
          y: ny,
          length,
          moveBefore: pendingMove,
        });
        pendingMove = false;
        prevCpX = cp2x;
        prevCpY = cp2y;
        curX = nx;
        curY = ny;
        break;
      }
      case 'S': {
        const cp1x = 2 * curX - prevCpX;
        const cp1y = 2 * curY - prevCpY;
        const cp2x = nextNum();
        const cp2y = nextNum();
        const nx = nextNum();
        const ny = nextNum();
        const length = estimateCubicLength(curX, curY, cp1x, cp1y, cp2x, cp2y, nx, ny);
        segments.push({
          x0: curX,
          y0: curY,
          cp1x,
          cp1y,
          cp2x,
          cp2y,
          x: nx,
          y: ny,
          length,
          moveBefore: pendingMove,
        });
        pendingMove = false;
        prevCpX = cp2x;
        prevCpY = cp2y;
        curX = nx;
        curY = ny;
        break;
      }
      case 's': {
        const cp1x = 2 * curX - prevCpX;
        const cp1y = 2 * curY - prevCpY;
        const cp2x = curX + nextNum();
        const cp2y = curY + nextNum();
        const nx = curX + nextNum();
        const ny = curY + nextNum();
        const length = estimateCubicLength(curX, curY, cp1x, cp1y, cp2x, cp2y, nx, ny);
        segments.push({
          x0: curX,
          y0: curY,
          cp1x,
          cp1y,
          cp2x,
          cp2y,
          x: nx,
          y: ny,
          length,
          moveBefore: pendingMove,
        });
        pendingMove = false;
        prevCpX = cp2x;
        prevCpY = cp2y;
        curX = nx;
        curY = ny;
        break;
      }
      case 'Q': {
        const qx = nextNum();
        const qy = nextNum();
        const nx = nextNum();
        const ny = nextNum();
        const cp1x = curX + (2 / 3) * (qx - curX);
        const cp1y = curY + (2 / 3) * (qy - curY);
        const cp2x = nx + (2 / 3) * (qx - nx);
        const cp2y = ny + (2 / 3) * (qy - ny);
        const length = estimateCubicLength(curX, curY, cp1x, cp1y, cp2x, cp2y, nx, ny);
        segments.push({
          x0: curX,
          y0: curY,
          cp1x,
          cp1y,
          cp2x,
          cp2y,
          x: nx,
          y: ny,
          length,
          moveBefore: pendingMove,
        });
        pendingMove = false;
        prevCpX = qx;
        prevCpY = qy;
        curX = nx;
        curY = ny;
        break;
      }
      case 'q': {
        const qx = curX + nextNum();
        const qy = curY + nextNum();
        const nx = curX + nextNum();
        const ny = curY + nextNum();
        const cp1x = curX + (2 / 3) * (qx - curX);
        const cp1y = curY + (2 / 3) * (qy - curY);
        const cp2x = nx + (2 / 3) * (qx - nx);
        const cp2y = ny + (2 / 3) * (qy - ny);
        const length = estimateCubicLength(curX, curY, cp1x, cp1y, cp2x, cp2y, nx, ny);
        segments.push({
          x0: curX,
          y0: curY,
          cp1x,
          cp1y,
          cp2x,
          cp2y,
          x: nx,
          y: ny,
          length,
          moveBefore: pendingMove,
        });
        pendingMove = false;
        prevCpX = qx;
        prevCpY = qy;
        curX = nx;
        curY = ny;
        break;
      }
      case 'Z':
      case 'z': {
        if (Math.hypot(startX - curX, startY - curY) > 0.01) {
          addLineSegment(startX, startY);
        }
        curX = startX;
        curY = startY;
        cmd = '';
        break;
      }
      default: {
        // Skip unsupported command token gracefully
        cmd = '';
        break;
      }
    }
  }

  return segments;
}

/**
 * Splits a single CubicSegment at parameter t in [0, 1] using De Casteljau's algorithm.
 */
export function splitCubicSegment(
  seg: CubicSegment,
  t: number
): [CubicSegment, CubicSegment] {
  const u = clamp(t, 0, 1);
  const x01 = lerpNumber(seg.x0, seg.cp1x, u);
  const y01 = lerpNumber(seg.y0, seg.cp1y, u);
  const x12 = lerpNumber(seg.cp1x, seg.cp2x, u);
  const y12 = lerpNumber(seg.cp1y, seg.cp2y, u);
  const x23 = lerpNumber(seg.cp2x, seg.x, u);
  const y23 = lerpNumber(seg.cp2y, seg.y, u);

  const x012 = lerpNumber(x01, x12, u);
  const y012 = lerpNumber(y01, y12, u);
  const x123 = lerpNumber(x12, x23, u);
  const y123 = lerpNumber(y12, y23, u);

  const mx = lerpNumber(x012, x123, u);
  const my = lerpNumber(y012, y123, u);

  const left: CubicSegment = {
    x0: seg.x0,
    y0: seg.y0,
    cp1x: x01,
    cp1y: y01,
    cp2x: x012,
    cp2y: y012,
    x: mx,
    y: my,
    length: seg.length * u,
    moveBefore: seg.moveBefore,
  };
  const right: CubicSegment = {
    x0: mx,
    y0: my,
    cp1x: x123,
    cp1y: y123,
    cp2x: x23,
    cp2y: y23,
    x: seg.x,
    y: seg.y,
    length: seg.length * (1 - u),
    moveBefore: false,
  };
  return [left, right];
}

/**
 * Morphs between two SVG path strings by subdividing the shorter cubic list to match segment counts.
 */
export function interpolateSvgPaths(
  dFrom: string,
  dTo: string,
  progress: number
): CubicSegment[] {
  const u = clamp(progress, 0, 1);
  const segsA = parseSvgPathToCubics(dFrom);
  if (u <= 0 || !dTo) return segsA;
  const segsB = parseSvgPathToCubics(dTo);
  if (u >= 1 || segsA.length === 0) return segsB;
  if (segsB.length === 0) return segsA;

  const targetCount = Math.max(segsA.length, segsB.length);
  const normalizeCount = (list: CubicSegment[], count: number): CubicSegment[] => {
    const out = [...list];
    while (out.length < count) {
      // Split longest segment
      let maxIdx = 0;
      for (let i = 1; i < out.length; i++) {
        if (out[i].length > out[maxIdx].length) maxIdx = i;
      }
      const [left, right] = splitCubicSegment(out[maxIdx], 0.5);
      out.splice(maxIdx, 1, left, right);
    }
    return out;
  };

  const normA = normalizeCount(segsA, targetCount);
  const normB = normalizeCount(segsB, targetCount);

  return normA.map((a, idx) => {
    const b = normB[idx];
    const x0 = lerpNumber(a.x0, b.x0, u);
    const y0 = lerpNumber(a.y0, b.y0, u);
    const cp1x = lerpNumber(a.cp1x, b.cp1x, u);
    const cp1y = lerpNumber(a.cp1y, b.cp1y, u);
    const cp2x = lerpNumber(a.cp2x, b.cp2x, u);
    const cp2y = lerpNumber(a.cp2y, b.cp2y, u);
    const x = lerpNumber(a.x, b.x, u);
    const y = lerpNumber(a.y, b.y, u);
    return {
      x0,
      y0,
      cp1x,
      cp1y,
      cp2x,
      cp2y,
      x,
      y,
      length: lerpNumber(a.length, b.length, u),
      moveBefore: a.moveBefore,
    };
  });
}

/**
 * Computed state of an element at exact time t (seconds).
 */
export interface ComputedElementState {
  visible: boolean;
  x: number;
  y: number;
  z: number;
  pivotX: number;
  pivotY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  skewX: number;
  skewY: number;
  opacity: number;
  width: number;
  height: number;
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDashOffset: number;
  trimStart: number;
  trimEnd: number;
  textProgress: number;
  dataProgress: number;
  morphProgress: number;
  extrudeX: number;
  extrudeY: number;
  tiltX: number;
  tiltY: number;
  counterValue?: number;
  clipWipeProgress?: number;
}

/**
 * Evaluates a single property across sorted keyframes or tracks at time t.
 * When animation properties are omitted, returns baseValue deterministically.
 */
function evaluatePropertyTrack<T extends number | string>(
  propName: keyof KeyframeSpec,
  baseValue: T,
  keyframes: KeyframeSpec[] | undefined,
  tracks: Record<string, TrackPoint<any>[]> | undefined,
  t: number,
  isColor = false
): T {
  // Check explicit per-property track first
  let points: Array<{ time: number; value: T; easing?: EasingSpec }> = [];

  if (tracks && Array.isArray(tracks[propName as string]) && tracks[propName as string].length > 0) {
    points = tracks[propName as string]
      .filter((pt) => pt && typeof pt.time === 'number' && pt.value !== undefined)
      .slice()
      .sort((a, b) => a.time - b.time);
  } else if (Array.isArray(keyframes) && keyframes.length > 0) {
    points = keyframes
      .filter((kf) => kf && typeof kf.time === 'number' && kf[propName] !== undefined)
      .map((kf) => ({
        time: kf.time,
        value: kf[propName] as unknown as T,
        easing: kf.easing,
      }))
      .sort((a, b) => a.time - b.time);
  }

  if (points.length === 0) return baseValue;
  if (t <= points[0].time) return points[0].value;
  if (t >= points[points.length - 1].time) return points[points.length - 1].value;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (t >= p0.time && t <= p1.time) {
      const span = p1.time - p0.time;
      if (span <= 1e-6) return p1.value;
      const rawU = (t - p0.time) / span;
      const u = evaluateEasing(rawU, p1.easing || p0.easing);
      if (isColor && typeof p0.value === 'string' && typeof p1.value === 'string') {
        return lerpColor(p0.value, p1.value, u) as T;
      }
      if (typeof p0.value === 'number' && typeof p1.value === 'number') {
        return lerpNumber(p0.value, p1.value, u) as T;
      }
      return (u < 0.5 ? p0.value : p1.value) as T;
    }
  }

  return points[points.length - 1].value;
}

/**
 * Computes the complete deterministic state of a SceneElement at timestamp `t` (in seconds).
 */
export function computeElementStateAtTime(
  el: SceneElement,
  t: number,
  sceneDuration: number
): ComputedElementState {
  const startTime = el.startTime !== undefined ? el.startTime : 0;
  const endTime = el.endTime !== undefined ? el.endTime : sceneDuration;

  const baseVisible = el.visible !== false;
  const inTimeRange = t >= startTime - 1e-5 && t <= endTime + 1e-5;

  const baseScale = el.scale !== undefined ? el.scale : 1;
  const baseScaleX = el.scaleX !== undefined ? el.scaleX : baseScale;
  const baseScaleY = el.scaleY !== undefined ? el.scaleY : baseScale;

  // Evaluate uniform `scale` track if present
  const animScale = evaluatePropertyTrack<number>(
    'scale',
    baseScale,
    el.keyframes,
    el.tracks,
    t
  );
  const scaleMultiplier = baseScale !== 0 ? animScale / baseScale : animScale;

  let x = evaluatePropertyTrack<number>('x', el.x ?? 0, el.keyframes, el.tracks, t);
  let y = evaluatePropertyTrack<number>('y', el.y ?? 0, el.keyframes, el.tracks, t);
  const z = evaluatePropertyTrack<number>('z', el.z ?? 0, el.keyframes, el.tracks, t);
  let scaleX =
    evaluatePropertyTrack<number>('scaleX', baseScaleX, el.keyframes, el.tracks, t) *
    scaleMultiplier;
  let scaleY =
    evaluatePropertyTrack<number>('scaleY', baseScaleY, el.keyframes, el.tracks, t) *
    scaleMultiplier;
  const rotation = evaluatePropertyTrack<number>(
    'rotation',
    el.rotation ?? 0,
    el.keyframes,
    el.tracks,
    t
  );
  const skewX = evaluatePropertyTrack<number>(
    'skewX',
    el.skewX ?? 0,
    el.keyframes,
    el.tracks,
    t
  );
  const skewY = evaluatePropertyTrack<number>(
    'skewY',
    el.skewY ?? 0,
    el.keyframes,
    el.tracks,
    t
  );
  let opacity = evaluatePropertyTrack<number>(
    'opacity',
    el.opacity ?? 1,
    el.keyframes,
    el.tracks,
    t
  );
  const width = evaluatePropertyTrack<number>(
    'width',
    el.width ?? 100,
    el.keyframes,
    el.tracks,
    t
  );
  const height = evaluatePropertyTrack<number>(
    'height',
    el.height ?? 100,
    el.keyframes,
    el.tracks,
    t
  );
  const radius = evaluatePropertyTrack<number>(
    'radius',
    el.radius ?? 50,
    el.keyframes,
    el.tracks,
    t
  );

  const fill = evaluatePropertyTrack<string>(
    'fill',
    el.fill ?? 'none',
    el.keyframes,
    el.tracks,
    t,
    true
  );
  const stroke = evaluatePropertyTrack<string>(
    'stroke',
    el.stroke ?? 'none',
    el.keyframes,
    el.tracks,
    t,
    true
  );
  const strokeWidth = evaluatePropertyTrack<number>(
    'strokeWidth',
    el.strokeWidth ?? (el.stroke && el.stroke !== 'none' ? 2 : 0),
    el.keyframes,
    el.tracks,
    t
  );
  const strokeDashOffset = evaluatePropertyTrack<number>(
    'strokeDashOffset',
    el.strokeDashOffset ?? 0,
    el.keyframes,
    el.tracks,
    t
  );

  let trimStart = evaluatePropertyTrack<number>(
    'trimStart',
    el.trimStart ?? 0,
    el.keyframes,
    el.tracks,
    t
  );
  let trimEnd = evaluatePropertyTrack<number>(
    'trimEnd',
    el.trimEnd ?? 1,
    el.keyframes,
    el.tracks,
    t
  );
  let textProgress = evaluatePropertyTrack<number>(
    'textProgress',
    el.textProgress ?? el.reveal?.progress ?? 1,
    el.keyframes,
    el.tracks,
    t
  );
  const dataProgress = evaluatePropertyTrack<number>(
    'dataProgress',
    el.dataProgress ?? 1,
    el.keyframes,
    el.tracks,
    t
  );
  const morphProgress = evaluatePropertyTrack<number>(
    'morphProgress',
    el.morphProgress ?? 0,
    el.keyframes,
    el.tracks,
    t
  );
  const extrudeX = evaluatePropertyTrack<number>(
    'extrudeX',
    el.depth25d?.extrudeX ?? 0,
    el.keyframes,
    el.tracks,
    t
  );
  const extrudeY = evaluatePropertyTrack<number>(
    'extrudeY',
    el.depth25d?.extrudeY ?? 0,
    el.keyframes,
    el.tracks,
    t
  );
  const tiltX = evaluatePropertyTrack<number>(
    'tiltX',
    el.depth25d?.tiltX ?? 0,
    el.keyframes,
    el.tracks,
    t
  );
  const tiltY = evaluatePropertyTrack<number>(
    'tiltY',
    el.depth25d?.tiltY ?? 0,
    el.keyframes,
    el.tracks,
    t
  );

  let counterValue: number | undefined;
  if (el.counter) {
    counterValue = evaluatePropertyTrack<number>(
      'counterValue',
      el.counter.to,
      el.keyframes,
      el.tracks,
      t
    );
  }

  let clipWipeProgress: number | undefined;

  // Apply explicit Entrance transition if specified
  if (el.entrance && el.entrance.duration > 0) {
    const entStart = startTime + (el.entrance.delay ?? 0);
    if (t < entStart) {
      opacity = 0;
    } else if (t < entStart + el.entrance.duration) {
      const rawU = (t - entStart) / el.entrance.duration;
      const defaultEase =
        el.entrance.type === 'pop' ? 'easeOutBack' : 'easeOutCubic';
      const u = evaluateEasing(rawU, el.entrance.easing ?? defaultEase);
      const dist = el.entrance.distance ?? 80;

      switch (el.entrance.type) {
        case 'fade':
          opacity *= u;
          break;
        case 'scaleUp':
        case 'pop':
          opacity *= clamp(rawU * 2, 0, 1);
          scaleX *= u;
          scaleY *= u;
          break;
        case 'slideLeft':
          opacity *= u;
          x += (1 - u) * dist;
          break;
        case 'slideRight':
          opacity *= u;
          x -= (1 - u) * dist;
          break;
        case 'slideUp':
          opacity *= u;
          y += (1 - u) * dist;
          break;
        case 'slideDown':
          opacity *= u;
          y -= (1 - u) * dist;
          break;
        case 'drawStroke':
          trimEnd *= u;
          break;
        case 'typewriter':
          textProgress *= u;
          break;
        case 'wipeRight':
          clipWipeProgress = u;
          break;
      }
    }
  }

  // Apply explicit Exit transition if specified
  if (el.exit && el.exit.duration > 0) {
    const exitStart =
      el.exit.startTime !== undefined
        ? el.exit.startTime
        : endTime - el.exit.duration;
    if (t >= exitStart && t <= exitStart + el.exit.duration) {
      const rawU = (t - exitStart) / el.exit.duration;
      const u = evaluateEasing(rawU, el.exit.easing ?? 'easeInCubic');
      const dist = el.exit.distance ?? 80;

      switch (el.exit.type) {
        case 'fade':
          opacity *= 1 - u;
          break;
        case 'scaleDown':
          opacity *= 1 - u;
          scaleX *= 1 - u;
          scaleY *= 1 - u;
          break;
        case 'slideLeft':
          opacity *= 1 - u;
          x -= u * dist;
          break;
        case 'slideRight':
          opacity *= 1 - u;
          x += u * dist;
          break;
        case 'slideUp':
          opacity *= 1 - u;
          y -= u * dist;
          break;
        case 'slideDown':
          opacity *= 1 - u;
          y += u * dist;
          break;
        case 'eraseStroke':
          trimStart = clamp(trimStart + u * (1 - trimStart), 0, 1);
          break;
      }
    } else if (t > exitStart + el.exit.duration) {
      opacity = 0;
    }
  }

  return {
    visible: baseVisible && inTimeRange && opacity > 1e-4,
    x,
    y,
    z,
    pivotX: el.pivotX ?? 0,
    pivotY: el.pivotY ?? 0,
    scaleX,
    scaleY,
    rotation,
    skewX,
    skewY,
    opacity: clamp(opacity, 0, 1),
    width,
    height,
    radius,
    fill,
    stroke,
    strokeWidth: Math.max(0, strokeWidth),
    strokeDashOffset,
    trimStart: clamp(trimStart, 0, 1),
    trimEnd: clamp(trimEnd, 0, 1),
    textProgress: clamp(textProgress, 0, 1),
    dataProgress: clamp(dataProgress, 0, 1),
    morphProgress: clamp(morphProgress, 0, 1),
    extrudeX,
    extrudeY,
    tiltX,
    tiltY,
    counterValue,
    clipWipeProgress,
  };
}

/**
 * Evaluates scene camera transform at timestamp t.
 */
export function computeCameraStateAtTime(
  camera: CameraSpec | undefined,
  t: number
): {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
  tiltX: number;
  tiltY: number;
} {
  if (!camera) {
    return { x: 0, y: 0, zoom: 1, rotation: 0, tiltX: 0, tiltY: 0 };
  }
  const kfs = camera.keyframes as unknown as KeyframeSpec[] | undefined;
  return {
    x: evaluatePropertyTrack<number>('x', camera.x ?? 0, kfs, undefined, t),
    y: evaluatePropertyTrack<number>('y', camera.y ?? 0, kfs, undefined, t),
    zoom: evaluatePropertyTrack<number>(
      'scale',
      camera.zoom ?? 1,
      kfs?.map((k: any) => ({ ...k, scale: k.zoom })),
      undefined,
      t
    ),
    rotation: evaluatePropertyTrack<number>(
      'rotation',
      camera.rotation ?? 0,
      kfs,
      undefined,
      t
    ),
    tiltX: evaluatePropertyTrack<number>(
      'tiltX',
      camera.tiltX ?? 0,
      kfs,
      undefined,
      t
    ),
    tiltY: evaluatePropertyTrack<number>(
      'tiltY',
      camera.tiltY ?? 0,
      kfs,
      undefined,
      t
    ),
  };
}
