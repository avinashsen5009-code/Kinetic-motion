export interface PathCommand {
  type: string;
  values: number[];
}

/**
 * Parses an SVG path data string (`d`) into structured commands.
 */
export function parseSvgPath(d: string): PathCommand[] {
  if (!d || typeof d !== 'string') return [];
  const commands: PathCommand[] = [];
  const cmdRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let match: RegExpExecArray | null;

  while ((match = cmdRegex.exec(d)) !== null) {
    const type = match[1];
    const argsStr = match[2].trim();
    if (!argsStr) {
      commands.push({ type, values: [] });
      continue;
    }
    const numRegex = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
    const values: number[] = [];
    let numMatch: RegExpExecArray | null;
    while ((numMatch = numRegex.exec(argsStr)) !== null) {
      values.push(parseFloat(numMatch[0]));
    }
    commands.push({ type, values });
  }
  return commands;
}

/**
 * Interpolates between two compatible SVG paths `d1` and `d2` at `t` in [0, 1].
 * If paths have identical command structures, smoothly interpolates every coordinate.
 * Otherwise falls back to a clean threshold switch at t = 0.5.
 */
export function interpolateSvgPath(d1: string, d2: string, t: number): string {
  if (!d2 || t <= 0) return d1;
  if (!d1 || t >= 1) return d2;

  const cmds1 = parseSvgPath(d1);
  const cmds2 = parseSvgPath(d2);

  if (cmds1.length !== cmds2.length || cmds1.length === 0) {
    return t < 0.5 ? d1 : d2;
  }

  const resultParts: string[] = [];
  for (let i = 0; i < cmds1.length; i++) {
    const c1 = cmds1[i];
    const c2 = cmds2[i];
    if (c1.type !== c2.type || c1.values.length !== c2.values.length) {
      return t < 0.5 ? d1 : d2;
    }
    const interpVals = c1.values.map((v1, idx) => {
      const v2 = c2.values[idx];
      const v = v1 + (v2 - v1) * t;
      return Number(v.toFixed(2));
    });
    resultParts.push(`${c1.type} ${interpVals.join(' ')}`);
  }

  return resultParts.join(' ');
}

/**
 * Caches compiled Path2D instances so the renderer doesn't re-parse SVG path strings 60 times/sec.
 */
const path2DCache = new Map<string, Path2D>();

export function getCachedPath2D(d: string): Path2D {
  let cached = path2DCache.get(d);
  if (!cached) {
    cached = new Path2D(d);
    if (path2DCache.size > 500) {
      path2DCache.clear();
    }
    path2DCache.set(d, cached);
  }
  return cached;
}

/**
 * Estimates total path length for an SVG path string so that `drawProgress` (0..1)
 * works deterministically in pure Canvas 2D using `setLineDash`.
 */
const pathLengthCache = new Map<string, number>();

export function getEstimatedPathLength(d: string): number {
  if (!d) return 0;
  const cached = pathLengthCache.get(d);
  if (cached !== undefined) return cached;

  // Use browser SVGPathElement geometry calculation when available in DOM
  if (typeof document !== 'undefined') {
    try {
      const svgNs = 'http://www.w3.org/2000/svg';
      const pathEl = document.createElementNS(svgNs, 'path');
      pathEl.setAttribute('d', d);
      const len = pathEl.getTotalLength();
      if (Number.isFinite(len) && len > 0) {
        pathLengthCache.set(d, len);
        return len;
      }
    } catch {
      // Fallback to analytical approximation below
    }
  }

  // Analytical fallback
  const cmds = parseSvgPath(d);
  let total = 0;
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;

  for (const cmd of cmds) {
    const v = cmd.values;
    switch (cmd.type) {
      case 'M':
        if (v.length >= 2) {
          curX = v[0];
          curY = v[1];
          startX = curX;
          startY = curY;
        }
        break;
      case 'L':
        for (let i = 0; i + 1 < v.length; i += 2) {
          total += Math.hypot(v[i] - curX, v[i + 1] - curY);
          curX = v[i];
          curY = v[i + 1];
        }
        break;
      case 'H':
        if (v.length >= 1) {
          total += Math.abs(v[0] - curX);
          curX = v[0];
        }
        break;
      case 'V':
        if (v.length >= 1) {
          total += Math.abs(v[0] - curY);
          curY = v[0];
        }
        break;
      case 'Q':
        for (let i = 0; i + 3 < v.length; i += 4) {
          const chord = Math.hypot(v[i + 2] - curX, v[i + 3] - curY);
          const controlNet =
            Math.hypot(v[i] - curX, v[i + 1] - curY) +
            Math.hypot(v[i + 2] - v[i], v[i + 3] - v[i + 1]);
          total += (chord + controlNet) / 2;
          curX = v[i + 2];
          curY = v[i + 3];
        }
        break;
      case 'C':
        for (let i = 0; i + 5 < v.length; i += 6) {
          const chord = Math.hypot(v[i + 4] - curX, v[i + 5] - curY);
          const controlNet =
            Math.hypot(v[i] - curX, v[i + 1] - curY) +
            Math.hypot(v[i + 2] - v[i], v[i + 3] - v[i + 1]) +
            Math.hypot(v[i + 4] - v[i + 2], v[i + 5] - v[i + 3]);
          total += (chord + controlNet) / 2;
          curX = v[i + 4];
          curY = v[i + 5];
        }
        break;
      case 'Z':
      case 'z':
        total += Math.hypot(startX - curX, startY - curY);
        curX = startX;
        curY = startY;
        break;
      default:
        total += 120;
    }
  }

  const finalLen = Math.max(total, 1);
  pathLengthCache.set(d, finalLen);
  return finalLen;
}
