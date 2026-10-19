// ============================================================================
// Module 5: Professional Vector, Typography, Diagram & 2.5D Canvas Renderer
// ============================================================================

import {
  ClipSpec,
  GradientSpec,
  SceneElement,
  SceneSpec,
} from './schema';
import { BuiltSceneGraph } from './sceneGraph';
import {
  CubicSegment,
  ComputedElementState,
  clamp,
  computeCameraStateAtTime,
  computeElementStateAtTime,
  interpolateSvgPaths,
  lerpNumber,
  parseSvgPathToCubics,
  splitCubicSegment,
} from './timeline';

export interface RenderOptions {
  targetWidth: number;
  targetHeight: number;
  showSafeMargins?: boolean;
  showCoordinateGrid?: boolean;
  selectedElementId?: string | null;
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Renders a complete frame of the BuiltSceneGraph at deterministic timestamp `t` (in seconds)
 * onto the provided CanvasRenderingContext2D.
 */
export function renderSceneFrame(
  ctx: CanvasRenderingContext2D,
  graph: BuiltSceneGraph,
  t: number,
  options: RenderOptions
): void {
  const { scene, layers } = graph;
  const outW = options.targetWidth;
  const outH = options.targetHeight;
  const logicalW = scene.width || 1920;
  const logicalH = scene.height || 1080;

  ctx.save();
  ctx.clearRect(0, 0, outW, outH);

  // Predictable aspect-ratio preserving mapping from logical coordinate space to 16:9 output
  const scale = Math.min(outW / logicalW, outH / logicalH);
  const offsetX = (outW - logicalW * scale) * 0.5;
  const offsetY = (outH - logicalH * scale) * 0.5;

  // Clip strictly to the logical canvas viewport so no unintended overflow leaks outside
  ctx.beginPath();
  ctx.rect(offsetX, offsetY, logicalW * scale, logicalH * scale);
  ctx.clip();

  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // 1. Render Background
  renderBackground(ctx, scene, t, logicalW, logicalH);

  // 2. Apply Scene Camera Transform
  const cam = computeCameraStateAtTime(scene.camera, t);
  ctx.save();
  const cx = logicalW * 0.5;
  const cy = logicalH * 0.5;
  ctx.translate(cx, cy);
  if (cam.zoom !== 1) ctx.scale(cam.zoom, cam.zoom);
  if (cam.rotation !== 0) ctx.rotate(cam.rotation * DEG_TO_RAD);
  if (cam.tiltX !== 0 || cam.tiltY !== 0) {
    const cosX = Math.cos(clamp(cam.tiltX, -60, 60) * DEG_TO_RAD);
    const sinY = Math.sin(clamp(cam.tiltY, -60, 60) * 0.35 * DEG_TO_RAD);
    ctx.transform(1, sinY * 0.25, -sinY * 0.35, cosX, 0, 0);
  }
  ctx.translate(-cx - cam.x, -cy - cam.y);

  // 3. Render Background Shapes (if any)
  if (scene.background?.shapes && scene.background.shapes.length > 0) {
    for (const bgShape of scene.background.shapes) {
      renderElementHierarchy(
        ctx,
        bgShape,
        t,
        scene.duration,
        1,
        options.selectedElementId
      );
    }
  }

  // 4. Render Scene Layers & Elements in deterministic z-order
  for (const layer of layers) {
    if (layer.visible === false) continue;
    const layerOpacity = clamp(layer.opacity ?? 1, 0, 1);
    if (layerOpacity <= 1e-4) continue;

    ctx.save();
    if (layer.blendMode) {
      ctx.globalCompositeOperation = layer.blendMode;
    }
    if (layer.clip) {
      applyClipSpec(ctx, layer.clip);
    }

    for (const el of layer.elements) {
      renderElementHierarchy(
        ctx,
        el,
        t,
        scene.duration,
        layerOpacity,
        options.selectedElementId
      );
    }
    ctx.restore();
  }

  ctx.restore(); // Restore Camera

  // 5. Optional Foreground Vignette
  if (scene.background?.vignette && (scene.background.vignette.intensity ?? 0) > 0) {
    const vig = scene.background.vignette;
    const intensity = clamp(vig.intensity ?? 0.35, 0, 1);
    const grad = ctx.createRadialGradient(
      logicalW * 0.5,
      logicalH * 0.5,
      Math.min(logicalW, logicalH) * 0.3,
      logicalW * 0.5,
      logicalH * 0.5,
      Math.hypot(logicalW, logicalH) * 0.55
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, vig.color || `rgba(0,0,0,${intensity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, logicalW, logicalH);
  }

  // 6. Optional Studio Overlay Guides (Preview Only — disabled during video export)
  if (options.showCoordinateGrid) {
    renderStudioCoordinateOverlay(ctx, logicalW, logicalH);
  }
  if (options.showSafeMargins) {
    renderBroadcastSafeMargins(ctx, logicalW, logicalH);
  }

  ctx.restore();
}

function renderBackground(
  ctx: CanvasRenderingContext2D,
  scene: SceneSpec,
  _t: number,
  w: number,
  h: number
): void {
  const bg = scene.background;
  if (!bg) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    return;
  }

  if (bg.gradient) {
    ctx.fillStyle = createCanvasGradient(ctx, bg.gradient, 0, 0, w, h);
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = bg.color || '#0f172a';
    ctx.fillRect(0, 0, w, h);
  }

  if (bg.grid && bg.grid.enabled) {
    const spacing = Math.max(16, bg.grid.spacing || 60);
    const majorEvery = bg.grid.majorEvery || 4;
    ctx.save();
    ctx.strokeStyle = bg.grid.color || '#334155';
    const baseOpacity = bg.grid.opacity ?? 0.25;

    if (bg.grid.isometric) {
      ctx.globalAlpha = baseOpacity;
      ctx.lineWidth = 1;
      const angle = 30 * DEG_TO_RAD;
      const dx = Math.cos(angle) * spacing;
      const dy = Math.sin(angle) * spacing;
      ctx.beginPath();
      for (let x = -w; x < w * 2; x += dx * 2) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + h / Math.tan(angle), h);
        ctx.moveTo(x, 0);
        ctx.lineTo(x - h / Math.tan(angle), h);
      }
      for (let y = 0; y <= h; y += dy * 2) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    } else {
      let idx = 0;
      for (let x = 0; x <= w; x += spacing) {
        ctx.beginPath();
        ctx.globalAlpha = idx % majorEvery === 0 ? baseOpacity * 1.6 : baseOpacity * 0.75;
        ctx.lineWidth = idx % majorEvery === 0 ? 1.5 : 1;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        idx++;
      }
      idx = 0;
      for (let y = 0; y <= h; y += spacing) {
        ctx.beginPath();
        ctx.globalAlpha = idx % majorEvery === 0 ? baseOpacity * 1.6 : baseOpacity * 0.75;
        ctx.lineWidth = idx % majorEvery === 0 ? 1.5 : 1;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        idx++;
      }
    }
    ctx.restore();
  }
}

function createCanvasGradient(
  ctx: CanvasRenderingContext2D,
  spec: GradientSpec,
  bx: number,
  by: number,
  bw: number,
  bh: number
): CanvasGradient {
  let grad: CanvasGradient;
  if (spec.type === 'radial') {
    const cx = spec.cx !== undefined ? spec.cx : bx + bw * 0.5;
    const cy = spec.cy !== undefined ? spec.cy : by + bh * 0.5;
    const r = spec.r !== undefined ? spec.r : Math.max(bw, bh) * 0.65;
    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, r));
  } else {
    if (
      spec.x1 !== undefined &&
      spec.y1 !== undefined &&
      spec.x2 !== undefined &&
      spec.y2 !== undefined
    ) {
      grad = ctx.createLinearGradient(spec.x1, spec.y1, spec.x2, spec.y2);
    } else {
      const angleRad = ((spec.angle ?? 135) - 90) * DEG_TO_RAD;
      const cx = bx + bw * 0.5;
      const cy = by + bh * 0.5;
      const r = Math.hypot(bw, bh) * 0.5;
      grad = ctx.createLinearGradient(
        cx - Math.cos(angleRad) * r,
        cy - Math.sin(angleRad) * r,
        cx + Math.cos(angleRad) * r,
        cy + Math.sin(angleRad) * r
      );
    }
  }

  if (Array.isArray(spec.stops)) {
    for (const stop of spec.stops) {
      grad.addColorStop(clamp(stop.offset, 0, 1), stop.color || '#ffffff');
    }
  }
  return grad;
}

function applyClipSpec(ctx: CanvasRenderingContext2D, clip: ClipSpec): void {
  ctx.beginPath();
  switch (clip.type) {
    case 'rect': {
      const x = clip.x ?? 0;
      const y = clip.y ?? 0;
      const w = clip.width ?? 1920;
      const h = clip.height ?? 1080;
      drawRoundedRectPath(ctx, x, y, w, h, clip.cornerRadius ?? 0);
      break;
    }
    case 'circle': {
      ctx.arc(clip.x ?? 0, clip.y ?? 0, Math.max(0, clip.radius ?? 100), 0, Math.PI * 2);
      break;
    }
    case 'ellipse': {
      ctx.ellipse(
        clip.x ?? 0,
        clip.y ?? 0,
        Math.max(0, clip.rx ?? 100),
        Math.max(0, clip.ry ?? 60),
        0,
        0,
        Math.PI * 2
      );
      break;
    }
    case 'polygon': {
      if (Array.isArray(clip.points) && clip.points.length >= 3) {
        ctx.moveTo(clip.points[0][0], clip.points[0][1]);
        for (let i = 1; i < clip.points.length; i++) {
          ctx.lineTo(clip.points[i][0], clip.points[i][1]);
        }
        ctx.closePath();
      }
      break;
    }
    case 'path': {
      if (clip.d) {
        const segs = parseSvgPathToCubics(clip.d);
        traceCubicSegments(ctx, segs, 0, 1);
      }
      break;
    }
  }
  ctx.clip();
}

/**
 * Renders an element and its children with full affine transform hierarchy, 2.5D depth, and styles.
 */
function renderElementHierarchy(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  t: number,
  sceneDuration: number,
  parentOpacity: number,
  selectedElementId?: string | null
): void {
  const state = computeElementStateAtTime(el, t, sceneDuration);
  if (!state.visible) return;

  const effectiveOpacity = clamp(parentOpacity * state.opacity, 0, 1);
  if (effectiveOpacity <= 1e-4) return;

  ctx.save();

  if (el.blendMode) {
    ctx.globalCompositeOperation = el.blendMode;
  }

  // 2.5D Elevation Parallax Offset
  const zOffset = state.z * 0.15;
  ctx.translate(state.x + zOffset, state.y - zOffset);

  if (state.rotation !== 0) {
    ctx.rotate(state.rotation * DEG_TO_RAD);
  }
  if (state.skewX !== 0 || state.skewY !== 0) {
    ctx.transform(
      1,
      Math.tan(state.skewY * DEG_TO_RAD),
      Math.tan(state.skewX * DEG_TO_RAD),
      1,
      0,
      0
    );
  }
  // Restrained 2.5D perspective tilt when specified on the element
  if (state.tiltX !== 0 || state.tiltY !== 0) {
    const cosX = Math.cos(clamp(state.tiltX, -65, 65) * DEG_TO_RAD);
    const sinY = Math.sin(clamp(state.tiltY, -65, 65) * 0.4 * DEG_TO_RAD);
    ctx.transform(1, sinY * 0.3, -sinY * 0.35, cosX, 0, 0);
  }
  if (state.scaleX !== 1 || state.scaleY !== 1) {
    ctx.scale(state.scaleX, state.scaleY);
  }
  if (state.pivotX !== 0 || state.pivotY !== 0) {
    ctx.translate(-state.pivotX, -state.pivotY);
  }

  if (el.clip) {
    applyClipSpec(ctx, el.clip);
  }

  if (state.clipWipeProgress !== undefined) {
    const w = state.width || 600;
    const h = state.height || 400;
    ctx.beginPath();
    ctx.rect(-w, -h, w * 2 * state.clipWipeProgress, h * 2);
    ctx.clip();
  }

  ctx.globalAlpha = effectiveOpacity;

  // Render 2.5D Extrusion Slices behind the primitive if extrudeX / extrudeY are non-zero
  if (
    (Math.abs(state.extrudeX) > 0.25 || Math.abs(state.extrudeY) > 0.25) &&
    el.type !== 'group' &&
    el.type !== 'use'
  ) {
    const steps = Math.min(24, Math.max(4, Math.ceil(Math.hypot(state.extrudeX, state.extrudeY) / 1.5)));
    const extColor = el.depth25d?.extrudeColor || '#1e293b';
    const shadowState: ComputedElementState = {
      ...state,
      fill: state.fill !== 'none' ? extColor : 'none',
      stroke: state.stroke !== 'none' ? extColor : 'none',
    };
    for (let s = steps; s >= 1; s--) {
      const frac = s / steps;
      ctx.save();
      ctx.translate(state.extrudeX * frac, state.extrudeY * frac);
      renderPrimitiveGeometry(ctx, el, shadowState, t, true);
      ctx.restore();
    }
  }

  // Apply Shadow or Glow
  if (el.shadow) {
    ctx.shadowColor = el.shadow.color || 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = el.shadow.blur ?? 16;
    ctx.shadowOffsetX = el.shadow.offsetX ?? 0;
    ctx.shadowOffsetY = el.shadow.offsetY ?? 8;
  } else if (el.glow) {
    ctx.shadowColor = el.glow.color || '#38bdf8';
    ctx.shadowBlur = el.glow.strength ?? 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else if (el.depth25d?.elevation && el.depth25d.elevation > 0) {
    const elev = el.depth25d.elevation;
    ctx.shadowColor = 'rgba(0,0,0,0.38)';
    ctx.shadowBlur = elev * 1.4;
    ctx.shadowOffsetX = elev * 0.35;
    ctx.shadowOffsetY = elev * 0.75;
  }

  // Render Primitive
  renderPrimitiveGeometry(ctx, el, state, t, false);

  // Reset shadow before children
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Render Children if group
  if (Array.isArray(el.children) && el.children.length > 0) {
    for (const child of el.children) {
      renderElementHierarchy(
        ctx,
        child,
        t,
        sceneDuration,
        effectiveOpacity,
        selectedElementId
      );
    }
  }

  // Highlight selected element in Studio Preview if requested
  if (selectedElementId && el.id === selectedElementId) {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    const bw = state.width || (state.radius ? state.radius * 2 : 120);
    const bh = state.height || (state.radius ? state.radius * 2 : 120);
    ctx.strokeRect(-bw * 0.5 - 6, -bh * 0.5 - 6, bw + 12, bh + 12);
    ctx.restore();
  }

  ctx.restore();
}

function applyFillAndStroke(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  state: ComputedElementState,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  isExtrudePass: boolean
): void {
  const hasFill =
    (state.fill && state.fill !== 'none' && state.fill !== 'transparent') ||
    (!isExtrudePass && !!el.fillGradient);
  const hasStroke =
    state.strokeWidth > 0 &&
    ((state.stroke && state.stroke !== 'none' && state.stroke !== 'transparent') ||
      (!isExtrudePass && !!el.strokeGradient));

  if (hasFill) {
    if (!isExtrudePass && el.fillGradient) {
      ctx.fillStyle = createCanvasGradient(ctx, el.fillGradient, bx, by, bw, bh);
    } else {
      ctx.fillStyle = state.fill;
    }
    ctx.fill();
  }

  // Clear shadow before stroke if fill already cast the shadow
  if (hasFill && hasStroke) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  if (!isExtrudePass && el.outline && el.outline.width > 0) {
    ctx.save();
    ctx.strokeStyle = el.outline.color || '#ffffff';
    ctx.lineWidth = state.strokeWidth + el.outline.width * 2;
    ctx.lineCap = el.strokeCap || 'round';
    ctx.lineJoin = el.strokeJoin || 'round';
    ctx.stroke();
    ctx.restore();
  }

  if (hasStroke) {
    if (!isExtrudePass && el.strokeGradient) {
      ctx.strokeStyle = createCanvasGradient(ctx, el.strokeGradient, bx, by, bw, bh);
    } else {
      ctx.strokeStyle = state.stroke;
    }
    ctx.lineWidth = state.strokeWidth;
    ctx.lineCap = el.strokeCap || 'round';
    ctx.lineJoin = el.strokeJoin || 'round';
    if (Array.isArray(el.strokeDash) && el.strokeDash.length > 0) {
      ctx.setLineDash(el.strokeDash);
      ctx.lineDashOffset = state.strokeDashOffset;
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
  }
}

export function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | [number, number, number, number]
): void {
  const maxR = Math.min(Math.abs(w), Math.abs(h)) * 0.5;
  let rTL = 0,
    rTR = 0,
    rBR = 0,
    rBL = 0;
  if (Array.isArray(radius)) {
    rTL = clamp(radius[0] || 0, 0, maxR);
    rTR = clamp(radius[1] || 0, 0, maxR);
    rBR = clamp(radius[2] || 0, 0, maxR);
    rBL = clamp(radius[3] || 0, 0, maxR);
  } else {
    const r = clamp(radius || 0, 0, maxR);
    rTL = rTR = rBR = rBL = r;
  }

  ctx.moveTo(x + rTL, y);
  ctx.lineTo(x + w - rTR, y);
  if (rTR > 0) ctx.quadraticCurveTo(x + w, y, x + w, y + rTR);
  ctx.lineTo(x + w, y + h - rBR);
  if (rBR > 0) ctx.quadraticCurveTo(x + w, y + h, x + w - rBR, y + h);
  ctx.lineTo(x + rBL, y + h);
  if (rBL > 0) ctx.quadraticCurveTo(x, y + h, x, y + h - rBL);
  ctx.lineTo(x, y + rTL);
  if (rTL > 0) ctx.quadraticCurveTo(x, y, x + rTL, y);
  ctx.closePath();
}

/**
 * Traces normalized CubicSegments onto Canvas 2D context with exact trimStart..trimEnd partial path support.
 */
export function traceCubicSegments(
  ctx: CanvasRenderingContext2D,
  segments: CubicSegment[],
  trimStart: number,
  trimEnd: number
): {
  startPoint?: [number, number];
  startAngle?: number;
  endPoint?: [number, number];
  endAngle?: number;
} {
  if (segments.length === 0) return {};
  const t0 = clamp(Math.min(trimStart, trimEnd), 0, 1);
  const t1 = clamp(Math.max(trimStart, trimEnd), 0, 1);
  if (t1 - t0 <= 1e-5) return {};

  const totalLen = segments.reduce((acc, s) => acc + s.length, 0);
  if (totalLen <= 1e-5) return {};

  const startDist = t0 * totalLen;
  const endDist = t1 * totalLen;

  let accum = 0;
  let started = false;
  let startPoint: [number, number] | undefined;
  let startAngle: number | undefined;
  let endPoint: [number, number] | undefined;
  let endAngle: number | undefined;

  for (const seg of segments) {
    const segStart = accum;
    const segEnd = accum + seg.length;
    accum = segEnd;

    if (segEnd < startDist || segStart > endDist || seg.length <= 1e-6) {
      continue;
    }

    const localT0 = clamp((startDist - segStart) / seg.length, 0, 1);
    const localT1 = clamp((endDist - segStart) / seg.length, 0, 1);
    if (localT1 - localT0 <= 1e-5) continue;

    let activeSeg = seg;
    if (localT0 > 0 && localT1 < 1) {
      const [, right] = splitCubicSegment(seg, localT0);
      const remT = (localT1 - localT0) / (1 - localT0);
      const [mid] = splitCubicSegment(right, remT);
      activeSeg = mid;
    } else if (localT0 > 0) {
      const [, right] = splitCubicSegment(seg, localT0);
      activeSeg = right;
    } else if (localT1 < 1) {
      const [left] = splitCubicSegment(seg, localT1);
      activeSeg = left;
    }

    if (!started || activeSeg.moveBefore) {
      ctx.moveTo(activeSeg.x0, activeSeg.y0);
      if (!started) {
        startPoint = [activeSeg.x0, activeSeg.y0];
        startAngle = Math.atan2(
          activeSeg.cp1y - activeSeg.y0,
          activeSeg.cp1x - activeSeg.x0
        );
      }
      started = true;
    }

    ctx.bezierCurveTo(
      activeSeg.cp1x,
      activeSeg.cp1y,
      activeSeg.cp2x,
      activeSeg.cp2y,
      activeSeg.x,
      activeSeg.y
    );

    endPoint = [activeSeg.x, activeSeg.y];
    const dy = activeSeg.y - activeSeg.cp2y;
    const dx = activeSeg.x - activeSeg.cp2x;
    endAngle =
      Math.hypot(dx, dy) > 1e-4
        ? Math.atan2(dy, dx)
        : Math.atan2(activeSeg.y - activeSeg.y0, activeSeg.x - activeSeg.x0);
  }

  return { startPoint, startAngle, endPoint, endAngle };
}

function renderPrimitiveGeometry(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  state: ComputedElementState,
  t: number,
  isExtrudePass: boolean
): void {
  switch (el.type) {
    case 'group':
    case 'use':
      break;

    case 'rect': {
      const w = state.width;
      const h = state.height;
      const ax = el.anchorX !== undefined ? el.anchorX : 0.5;
      const ay = el.anchorY !== undefined ? el.anchorY : 0.5;
      const rx = -w * ax;
      const ry = -h * ay;

      ctx.beginPath();
      if (state.trimStart > 0 || state.trimEnd < 1) {
        const d = `M ${rx} ${ry} L ${rx + w} ${ry} L ${rx + w} ${ry + h} L ${rx} ${ry + h} Z`;
        const segs = parseSvgPathToCubics(d);
        traceCubicSegments(ctx, segs, state.trimStart, state.trimEnd);
      } else {
        drawRoundedRectPath(ctx, rx, ry, w, h, el.cornerRadius ?? 0);
      }
      applyFillAndStroke(ctx, el, state, rx, ry, w, h, isExtrudePass);
      break;
    }

    case 'circle': {
      const r = Math.max(0, state.radius);
      const startDeg = (el.startAngle ?? 0) + state.trimStart * 360;
      const endDeg = (el.endAngle ?? 360) * state.trimEnd;
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        r,
        startDeg * DEG_TO_RAD,
        endDeg * DEG_TO_RAD,
        el.anticlockwise ?? false
      );
      if (Math.abs(endDeg - startDeg) >= 359.9) {
        ctx.closePath();
      }
      applyFillAndStroke(ctx, el, state, -r, -r, r * 2, r * 2, isExtrudePass);
      break;
    }

    case 'ellipse': {
      const rx = Math.max(0, el.rx ?? 60);
      const ry = Math.max(0, el.ry ?? 40);
      const startDeg = (el.startAngle ?? 0) + state.trimStart * 360;
      const endDeg = (el.endAngle ?? 360) * state.trimEnd;
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        rx,
        ry,
        0,
        startDeg * DEG_TO_RAD,
        endDeg * DEG_TO_RAD,
        el.anticlockwise ?? false
      );
      applyFillAndStroke(ctx, el, state, -rx, -ry, rx * 2, ry * 2, isExtrudePass);
      break;
    }

    case 'arc': {
      const outerR = Math.max(0, state.radius);
      const innerR = Math.max(0, el.innerRadius ?? 0);
      const sRad = ((el.startAngle ?? -90) + state.trimStart * 360) * DEG_TO_RAD;
      const eRad =
        ((el.startAngle ?? -90) +
          ((el.endAngle ?? 180) - (el.startAngle ?? -90)) * state.trimEnd) *
        DEG_TO_RAD;

      ctx.beginPath();
      if (innerR > 0) {
        ctx.arc(0, 0, outerR, sRad, eRad, false);
        ctx.arc(0, 0, innerR, eRad, sRad, true);
        ctx.closePath();
      } else {
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, outerR, sRad, eRad, false);
        ctx.closePath();
      }
      applyFillAndStroke(
        ctx,
        el,
        state,
        -outerR,
        -outerR,
        outerR * 2,
        outerR * 2,
        isExtrudePass
      );
      break;
    }

    case 'line': {
      const x1 = el.x1 ?? 0;
      const y1 = el.y1 ?? 0;
      const x2 = el.x2 ?? 100;
      const y2 = el.y2 ?? 0;
      const sx = lerpNumber(x1, x2, state.trimStart);
      const sy = lerpNumber(y1, y2, state.trimStart);
      const ex = lerpNumber(x1, x2, state.trimEnd);
      const ey = lerpNumber(y1, y2, state.trimEnd);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      applyFillAndStroke(
        ctx,
        el,
        state,
        Math.min(x1, x2),
        Math.min(y1, y2),
        Math.abs(x2 - x1) || 1,
        Math.abs(y2 - y1) || 1,
        isExtrudePass
      );
      break;
    }

    case 'polyline':
    case 'polygon': {
      let pts: [number, number][] = [];
      if (Array.isArray(el.points) && el.points.length >= 2) {
        pts = el.points;
      } else if (el.type === 'polygon' && (el.sides ?? 0) >= 3) {
        const sides = Math.floor(el.sides || 5);
        const outerR = state.radius || 60;
        const innerR = el.innerRadius;
        const step = (Math.PI * 2) / (innerR ? sides * 2 : sides);
        const count = innerR ? sides * 2 : sides;
        for (let i = 0; i < count; i++) {
          const r = innerR && i % 2 === 1 ? innerR : outerR;
          const a = i * step - Math.PI * 0.5;
          pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
      }

      if (pts.length < 2) break;
      const isClosed = el.type === 'polygon' || el.closed === true;
      const d = buildPathFromPoints(pts, isClosed, el.smooth === true, el.tension ?? 0.35);
      const segs = parseSvgPathToCubics(d);
      ctx.beginPath();
      traceCubicSegments(ctx, segs, state.trimStart, state.trimEnd);
      if (isClosed && state.trimStart <= 0 && state.trimEnd >= 1) {
        ctx.closePath();
      }
      const bounds = computePointsBounds(pts);
      applyFillAndStroke(
        ctx,
        el,
        state,
        bounds.x,
        bounds.y,
        bounds.w,
        bounds.h,
        isExtrudePass
      );
      break;
    }

    case 'path': {
      let dString = el.d || '';
      if (!dString && Array.isArray(el.commands)) {
        dString = el.commands
          .map((c) => `${c.cmd} ${(c.pts || []).join(' ')}`)
          .join(' ');
      }
      if (!dString) break;

      const segs =
        el.morphTo && state.morphProgress > 0
          ? interpolateSvgPaths(dString, el.morphTo, state.morphProgress)
          : parseSvgPathToCubics(dString);

      ctx.beginPath();
      traceCubicSegments(ctx, segs, state.trimStart, state.trimEnd);
      applyFillAndStroke(ctx, el, state, -200, -200, 400, 400, isExtrudePass);
      break;
    }

    case 'connector':
    case 'arrow': {
      renderConnectorPrimitive(ctx, el, state, t, isExtrudePass);
      break;
    }

    case 'text': {
      renderTextPrimitive(ctx, el, state, isExtrudePass);
      break;
    }

    case 'callout': {
      renderCalloutPrimitive(ctx, el, state, isExtrudePass);
      break;
    }

    case 'chart': {
      renderChartPrimitive(ctx, el, state, isExtrudePass);
      break;
    }

    case 'grid': {
      const gw = state.width || 600;
      const gh = state.height || 400;
      const spacing = Math.max(12, el.gridSpacing || 40);
      ctx.save();
      ctx.strokeStyle = state.stroke !== 'none' ? state.stroke : '#334155';
      ctx.lineWidth = state.strokeWidth || 1;
      ctx.beginPath();
      for (let x = -gw * 0.5; x <= gw * 0.5; x += spacing) {
        ctx.moveTo(x, -gh * 0.5);
        ctx.lineTo(x, gh * 0.5);
      }
      for (let y = -gh * 0.5; y <= gh * 0.5; y += spacing) {
        ctx.moveTo(-gw * 0.5, y);
        ctx.lineTo(gw * 0.5, y);
      }
      ctx.stroke();
      ctx.restore();
      break;
    }
  }
}

function buildPathFromPoints(
  pts: [number, number][],
  closed: boolean,
  smooth: boolean,
  tension: number
): string {
  if (pts.length === 0) return '';
  if (!smooth || pts.length < 3) {
    const parts = [`M ${pts[0][0]} ${pts[0][1]}`];
    for (let i = 1; i < pts.length; i++) {
      parts.push(`L ${pts[i][0]} ${pts[i][1]}`);
    }
    if (closed) parts.push('Z');
    return parts.join(' ');
  }

  // Cardinal spline / Catmull-Rom to Cubic Bezier conversion
  const list = closed
    ? [pts[pts.length - 1], ...pts, pts[0], pts[1]]
    : [pts[0], ...pts, pts[pts.length - 1]];

  const parts = [`M ${pts[0][0]} ${pts[0][1]}`];
  const count = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < count; i++) {
    const p0 = list[i];
    const p1 = list[i + 1];
    const p2 = list[i + 2];
    const p3 = list[i + 3];

    const cp1x = p1[0] + ((p2[0] - p0[0]) * tension) / 3;
    const cp1y = p1[1] + ((p2[1] - p0[1]) * tension) / 3;
    const cp2x = p2[0] - ((p3[0] - p1[0]) * tension) / 3;
    const cp2y = p2[1] - ((p3[1] - p1[1]) * tension) / 3;

    parts.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2[0]} ${p2[1]}`);
  }
  if (closed) parts.push('Z');
  return parts.join(' ');
}

function computePointsBounds(pts: [number, number][]): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [px, py] of pts) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  return {
    x: minX,
    y: minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY),
  };
}

function renderConnectorPrimitive(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  state: ComputedElementState,
  t: number,
  isExtrudePass: boolean
): void {
  const from = el.from || [0, 0];
  const to = el.to || [200, 0];
  const routing = el.routing || 'straight';

  let d = '';
  if (routing === 'orthogonal') {
    const mx = (from[0] + to[0]) * 0.5;
    d = `M ${from[0]} ${from[1]} L ${mx} ${from[1]} L ${mx} ${to[1]} L ${to[0]} ${to[1]}`;
  } else if (routing === 'curved') {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const curv = el.curvature ?? 0.3;
    const cx = (from[0] + to[0]) * 0.5 - dy * curv;
    const cy = (from[1] + to[1]) * 0.5 + dx * curv;
    d = `M ${from[0]} ${from[1]} Q ${cx} ${cy} ${to[0]} ${to[1]}`;
  } else if (routing === 'cubic') {
    if (Array.isArray(el.controlPoints) && el.controlPoints.length >= 2) {
      const [c1, c2] = el.controlPoints;
      d = `M ${from[0]} ${from[1]} C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${to[0]} ${to[1]}`;
    } else {
      const mx = (from[0] + to[0]) * 0.5;
      d = `M ${from[0]} ${from[1]} C ${mx} ${from[1]} ${mx} ${to[1]} ${to[0]} ${to[1]}`;
    }
  } else {
    d = `M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}`;
  }

  const segs = parseSvgPathToCubics(d);
  ctx.beginPath();
  const traced = traceCubicSegments(ctx, segs, state.trimStart, state.trimEnd);

  const strokeColor = state.stroke !== 'none' ? state.stroke : '#38bdf8';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(1.5, state.strokeWidth || 3);
  ctx.lineCap = el.strokeCap || 'round';
  ctx.lineJoin = el.strokeJoin || 'round';
  if (Array.isArray(el.strokeDash) && el.strokeDash.length > 0) {
    ctx.setLineDash(el.strokeDash);
    ctx.lineDashOffset = state.strokeDashOffset;
  } else {
    ctx.setLineDash([]);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  const headSize = el.headSize || Math.max(10, (state.strokeWidth || 3) * 3.5);
  const endHead = el.endHead ?? (el.type === 'arrow' ? 'arrow' : 'none');
  const startHead = el.startHead ?? 'none';

  if (endHead !== 'none' && traced.endPoint && traced.endAngle !== undefined && state.trimEnd > 0.02) {
    drawConnectorHead(
      ctx,
      endHead,
      traced.endPoint[0],
      traced.endPoint[1],
      traced.endAngle,
      headSize,
      strokeColor
    );
  }

  if (startHead !== 'none' && traced.startPoint && traced.startAngle !== undefined) {
    drawConnectorHead(
      ctx,
      startHead,
      traced.startPoint[0],
      traced.startPoint[1],
      traced.startAngle + Math.PI,
      headSize,
      strokeColor
    );
  }

  // Animated flow particles along the connector
  if (!isExtrudePass && el.flowParticles && el.flowParticles.count > 0 && state.trimEnd > 0.1) {
    const pCount = Math.min(20, el.flowParticles.count);
    const speed = el.flowParticles.speed ?? 0.5;
    const pRadius = el.flowParticles.radius ?? Math.max(4, (state.strokeWidth || 3) * 1.5);
    const pColor = el.flowParticles.color || '#ffffff';

    for (let i = 0; i < pCount; i++) {
      const phase = ((t * speed + i / pCount) % 1 + 1) % 1;
      if (phase < state.trimStart || phase > state.trimEnd) continue;
      const pt = traceCubicSegments(ctx, segs, 0, phase).endPoint;
      if (pt) {
        ctx.save();
        ctx.fillStyle = pColor;
        ctx.shadowColor = pColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], pRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Midpoint connector label pill
  if (!isExtrudePass && el.label && state.trimEnd > 0.45) {
    const mid = traceCubicSegments(ctx, segs, 0, el.labelOffset ?? 0.5).endPoint;
    if (mid) {
      ctx.save();
      ctx.font = `600 ${el.fontSize || 14}px ${el.fontFamily || 'Inter, system-ui, sans-serif'}`;
      const metrics = ctx.measureText(el.label);
      const pw = metrics.width + 20;
      const ph = (el.fontSize || 14) + 12;
      ctx.fillStyle = el.labelBg || '#0f172a';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      drawRoundedRectPath(ctx, mid[0] - pw * 0.5, mid[1] - ph * 0.5, pw, ph, ph * 0.5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = el.labelColor || '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.label, mid[0], mid[1]);
      ctx.restore();
    }
  }
}

function drawConnectorHead(
  ctx: CanvasRenderingContext2D,
  kind: 'arrow' | 'dot' | 'diamond' | 'bar',
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  if (kind === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(-size, -size * 0.55);
    ctx.lineTo(-size * 0.72, 0);
    ctx.lineTo(-size, size * 0.55);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'dot') {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size * 0.6, -size * 0.45);
    ctx.lineTo(-size * 1.2, 0);
    ctx.lineTo(-size * 0.6, size * 0.45);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'bar') {
    ctx.lineWidth = Math.max(2, size * 0.22);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.55);
    ctx.lineTo(0, size * 0.55);
    ctx.stroke();
  }
  ctx.restore();
}

function renderTextPrimitive(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  state: ComputedElementState,
  isExtrudePass: boolean
): void {
  let rawText = el.text ?? '';
  if (el.counter) {
    const val = state.counterValue !== undefined ? state.counterValue : el.counter.to;
    const dec = el.counter.decimals ?? 0;
    let formatted = val.toFixed(dec);
    if (el.counter.formatThousands !== false) {
      const parts = formatted.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      formatted = parts.join('.');
    }
    rawText = `${el.counter.prefix ?? ''}${formatted}${el.counter.suffix ?? ''}`;
  }

  // Apply text reveal progress (chars, words, lines, typewriter)
  const revealMode = el.reveal?.mode;
  const progress = state.textProgress;
  let visibleText = rawText;

  if (revealMode === 'words') {
    const words = rawText.split(/(\s+)/);
    const count = Math.round(words.length * progress);
    visibleText = words.slice(0, count).join('');
  } else if (revealMode === 'lines') {
    const lines = rawText.split('\n');
    const count = Math.ceil(lines.length * progress);
    visibleText = lines.slice(0, count).join('\n');
  } else if (revealMode === 'chars' || revealMode === 'typewriter' || progress < 1) {
    const count = Math.round(rawText.length * progress);
    visibleText = rawText.slice(0, count);
  }

  const fontSize = Math.max(6, el.fontSize || 36);
  const fontWeight = el.fontWeight || 600;
  const fontStyle = el.fontStyle || 'normal';
  const fontFamily = el.fontFamily || 'Inter, system-ui, -apple-system, sans-serif';
  const lineHeight = (el.lineHeight || 1.28) * fontSize;
  const align = el.align || 'center';
  const vAlign = el.verticalAlign || 'middle';

  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  // Word wrapping if maxWidth is specified
  const rawLines = visibleText.split('\n');
  const wrappedLines: string[] = [];
  for (const rLine of rawLines) {
    if (el.maxWidth && el.maxWidth > 20) {
      const words = rLine.split(' ');
      let current = '';
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > el.maxWidth && current) {
          wrappedLines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      wrappedLines.push(current);
    } else {
      wrappedLines.push(rLine);
    }
  }

  const totalTextH = wrappedLines.length * lineHeight;
  let startY = 0;
  if (vAlign === 'top') {
    startY = lineHeight * 0.5;
  } else if (vAlign === 'bottom') {
    startY = -totalTextH + lineHeight * 0.5;
  } else {
    startY = -totalTextH * 0.5 + lineHeight * 0.5;
  }

  let maxLineW = 0;
  for (const l of wrappedLines) {
    const w = ctx.measureText(l).width;
    if (w > maxLineW) maxLineW = w;
  }

  // Optional background pill/box behind text
  if (!isExtrudePass && el.backgroundBox) {
    const pad = el.backgroundBox.padding ?? [18, 12];
    const padX = Array.isArray(pad) ? pad[0] : pad;
    const padY = Array.isArray(pad) ? pad[1] : pad;
    const bw = maxLineW + padX * 2;
    const bh = totalTextH + padY * 2;
    let bx = -bw * 0.5;
    if (align === 'left') bx = -padX;
    if (align === 'right') bx = -maxLineW - padX;
    const by = startY - lineHeight * 0.5 - padY;

    ctx.save();
    ctx.beginPath();
    drawRoundedRectPath(ctx, bx, by, bw, bh, el.backgroundBox.cornerRadius ?? 10);
    if (el.backgroundBox.fill && el.backgroundBox.fill !== 'none') {
      ctx.fillStyle = el.backgroundBox.fill;
      ctx.fill();
    }
    if (el.backgroundBox.stroke && el.backgroundBox.stroke !== 'none') {
      ctx.strokeStyle = el.backgroundBox.stroke;
      ctx.lineWidth = el.backgroundBox.strokeWidth ?? 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Render each text line
  const hasFill = state.fill && state.fill !== 'none';
  const hasStroke = state.stroke && state.stroke !== 'none' && state.strokeWidth > 0;

  wrappedLines.forEach((line, idx) => {
    const ly = startY + idx * lineHeight;
    if (hasStroke) {
      ctx.strokeStyle = state.stroke;
      ctx.lineWidth = state.strokeWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, 0, ly);
    }
    if (hasFill) {
      if (!isExtrudePass && el.fillGradient) {
        ctx.fillStyle = createCanvasGradient(
          ctx,
          el.fillGradient,
          -maxLineW * 0.5,
          startY - fontSize,
          maxLineW,
          totalTextH
        );
      } else {
        ctx.fillStyle = state.fill;
      }
      ctx.fillText(line, 0, ly);
    }
  });

  // Typewriter cursor if enabled
  if (
    !isExtrudePass &&
    (el.reveal?.cursor || revealMode === 'typewriter') &&
    progress > 0 &&
    progress < 1
  ) {
    const lastLine = wrappedLines[wrappedLines.length - 1] || '';
    const lastW = ctx.measureText(lastLine).width;
    const lastY = startY + (wrappedLines.length - 1) * lineHeight;
    let cx = lastW * 0.5 + 6;
    if (align === 'left') cx = lastW + 6;
    if (align === 'right') cx = 6;
    ctx.fillStyle = el.reveal?.cursorColor || '#38bdf8';
    ctx.fillRect(cx, lastY - fontSize * 0.45, 3, fontSize * 0.9);
  }
}

function renderCalloutPrimitive(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  state: ComputedElementState,
  isExtrudePass: boolean
): void {
  const w = state.width || 240;
  const h = state.height || 84;
  const rx = -w * 0.5;
  const ry = -h * 0.5;
  const cr = typeof el.cornerRadius === 'number' ? el.cornerRadius : 12;

  // Draw tail if tailTarget is defined (relative to callout center)
  if (Array.isArray(el.tailTarget) && el.tailTarget.length === 2) {
    const [tx, ty] = el.tailTarget;
    const baseW = el.tailBaseWidth || 22;
    ctx.beginPath();
    ctx.moveTo(-baseW * 0.5, 0);
    ctx.lineTo(tx, ty);
    ctx.lineTo(baseW * 0.5, 0);
    ctx.closePath();
    applyFillAndStroke(ctx, el, state, rx, ry, w, h, isExtrudePass);
  }

  // Draw callout box
  ctx.beginPath();
  drawRoundedRectPath(ctx, rx, ry, w, h, cr);
  applyFillAndStroke(ctx, el, state, rx, ry, w, h, isExtrudePass);

  if (isExtrudePass) return;

  // Badge pill if present
  let textOffsetY = 0;
  if (el.badgeText) {
    ctx.save();
    ctx.font = `700 11px ${el.fontFamily || 'Inter, system-ui, sans-serif'}`;
    const bw = ctx.measureText(el.badgeText).width + 16;
    const bh = 20;
    ctx.fillStyle = el.badgeColor || '#38bdf8';
    ctx.beginPath();
    drawRoundedRectPath(ctx, rx + 14, ry + 12, bw, bh, 6);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.badgeText, rx + 22, ry + 22);
    ctx.restore();
    textOffsetY = 10;
  }

  // Main callout text & subtext
  ctx.save();
  const titleSize = el.fontSize || 18;
  ctx.font = `700 ${titleSize}px ${el.fontFamily || 'Inter, system-ui, sans-serif'}`;
  ctx.fillStyle = el.labelColor || '#f8fafc';
  ctx.textAlign = el.align || 'left';
  ctx.textBaseline = 'middle';
  const tx = el.align === 'center' ? 0 : rx + 16;
  const ty = el.subtext ? textOffsetY - 8 : textOffsetY;
  ctx.fillText(el.text || '', tx, ty);

  if (el.subtext) {
    ctx.font = `500 ${Math.max(11, titleSize - 4)}px ${el.fontFamily || 'Inter, system-ui, sans-serif'}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(el.subtext, tx, ty + titleSize + 4);
  }
  ctx.restore();
}

function renderChartPrimitive(
  ctx: CanvasRenderingContext2D,
  el: SceneElement,
  state: ComputedElementState,
  isExtrudePass: boolean
): void {
  if (isExtrudePass) return;
  const w = state.width || 640;
  const h = state.height || 360;
  const x0 = -w * 0.5;
  const y0 = -h * 0.5;
  const data = el.data || [];
  const progress = state.dataProgress;
  const chartType = el.chartType || 'bar';

  ctx.save();

  // Optional chart card background
  if (state.fill && state.fill !== 'none') {
    ctx.beginPath();
    drawRoundedRectPath(ctx, x0, y0, w, h, el.cornerRadius ?? 16);
    ctx.fillStyle = state.fill;
    ctx.fill();
    if (state.stroke && state.stroke !== 'none' && state.strokeWidth > 0) {
      ctx.strokeStyle = state.stroke;
      ctx.lineWidth = state.strokeWidth;
      ctx.stroke();
    }
  }

  const padLeft = 64;
  const padRight = 32;
  const padTop = 36;
  const padBottom = 48;
  const plotX = x0 + padLeft;
  const plotY = y0 + padTop;
  const plotW = Math.max(40, w - padLeft - padRight);
  const plotH = Math.max(40, h - padTop - padBottom);

  const values = data.map((d) => d.value);
  const maxVal =
    el.maxValue !== undefined
      ? el.maxValue
      : Math.max(10, ...(values.length ? values : [100])) * 1.12;
  const minVal = el.minValue ?? 0;
  const valSpan = Math.max(1e-5, maxVal - minVal);

  if (chartType === 'donut') {
    const cx = 0;
    const cy = 0;
    const outerR = Math.min(w, h) * 0.28;
    const innerR = outerR * 0.58;
    const total = Math.max(1e-5, data.reduce((acc, d) => acc + Math.max(0, d.value), 0));
    let curAngle = -Math.PI * 0.5;
    const palette = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#fb7185'];

    data.forEach((d, idx) => {
      const sliceAngle = (Math.max(0, d.value) / total) * Math.PI * 2 * progress;
      const nextAngle = curAngle + sliceAngle;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, curAngle, nextAngle, false);
      ctx.arc(cx, cy, innerR, nextAngle, curAngle, true);
      ctx.closePath();
      ctx.fillStyle = d.color || palette[idx % palette.length];
      ctx.fill();

      if (el.showValues !== false && progress > 0.5 && sliceAngle > 0.25) {
        const midA = curAngle + sliceAngle * 0.5;
        const lx = cx + Math.cos(midA) * (outerR + 28);
        const ly = cy + Math.sin(midA) * (outerR + 28);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '600 13px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${d.label} (${Math.round(d.value * progress)}${el.valueSuffix || ''})`, lx, ly);
      }
      curAngle = nextAngle;
    });
    ctx.restore();
    return;
  }

  // Draw Gridlines & Y-Axis Labels
  if (el.showGrid !== false) {
    const steps = 4;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.lineWidth = 1;
    ctx.font = '500 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const gy = plotY + plotH - frac * plotH;
      const gVal = Math.round(minVal + frac * valSpan);
      ctx.beginPath();
      ctx.moveTo(plotX, gy);
      ctx.lineTo(plotX + plotW, gy);
      ctx.stroke();
      ctx.fillText(
        `${el.valuePrefix || ''}${gVal}${el.valueSuffix || ''}`,
        plotX - 10,
        gy
      );
    }
  }

  const palette = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#fb7185'];

  if (chartType === 'bar') {
    const count = Math.max(1, data.length);
    const slotW = plotW / count;
    const barW = Math.min(64, slotW * 0.62);

    data.forEach((d, idx) => {
      const norm = clamp((d.value - minVal) / valSpan, 0, 1) * progress;
      const bh = norm * plotH;
      const bx = plotX + idx * slotW + (slotW - barW) * 0.5;
      const by = plotY + plotH - bh;

      ctx.fillStyle = d.color || palette[idx % palette.length];
      ctx.beginPath();
      drawRoundedRectPath(ctx, bx, by, barW, Math.max(2, bh), [
        el.barRadius ?? 6,
        el.barRadius ?? 6,
        0,
        0,
      ]);
      ctx.fill();

      // X-axis label
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(d.label, bx + barW * 0.5, plotY + plotH + 10);

      // Value label above bar
      if (el.showValues !== false && progress > 0.15) {
        const curV = Math.round(d.value * progress);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '700 13px Inter, system-ui, sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
          `${el.valuePrefix || ''}${curV}${el.valueSuffix || ''}`,
          bx + barW * 0.5,
          by - 6
        );
      }
    });
  } else if (chartType === 'horizontalBar') {
    const count = Math.max(1, data.length);
    const slotH = plotH / count;
    const barH = Math.min(36, slotH * 0.62);

    data.forEach((d, idx) => {
      const norm = clamp((d.value - minVal) / valSpan, 0, 1) * progress;
      const bw = norm * plotW;
      const bx = plotX;
      const by = plotY + idx * slotH + (slotH - barH) * 0.5;

      ctx.fillStyle = d.color || palette[idx % palette.length];
      ctx.beginPath();
      drawRoundedRectPath(ctx, bx, by, Math.max(2, bw), barH, [
        0,
        el.barRadius ?? 6,
        el.barRadius ?? 6,
        0,
      ]);
      ctx.fill();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.label, plotX - 10, by + barH * 0.5);

      if (el.showValues !== false && progress > 0.15) {
        const curV = Math.round(d.value * progress);
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'left';
        ctx.fillText(
          `${el.valuePrefix || ''}${curV}${el.valueSuffix || ''}`,
          bx + bw + 8,
          by + barH * 0.5
        );
      }
    });
  } else if (chartType === 'line' || chartType === 'area' || chartType === 'scatter') {
    const count = Math.max(1, data.length);
    const pts: [number, number][] = data.map((d, idx) => {
      const px =
        count === 1 ? plotX + plotW * 0.5 : plotX + (idx / (count - 1)) * plotW;
      const norm = clamp((d.value - minVal) / valSpan, 0, 1);
      const py = plotY + plotH - norm * plotH;
      return [px, py];
    });

    if (pts.length >= 2 && chartType !== 'scatter') {
      const lineD = buildPathFromPoints(pts, false, el.smooth !== false, 0.3);
      const segs = parseSvgPathToCubics(lineD);

      if (chartType === 'area') {
        ctx.save();
        ctx.beginPath();
        const traced = traceCubicSegments(ctx, segs, 0, progress);
        if (traced.endPoint) {
          ctx.lineTo(traced.endPoint[0], plotY + plotH);
          ctx.lineTo(pts[0][0], plotY + plotH);
          ctx.closePath();
          const areaGrad = ctx.createLinearGradient(0, plotY, 0, plotY + plotH);
          areaGrad.addColorStop(0, 'rgba(56, 189, 248, 0.42)');
          areaGrad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
          ctx.fillStyle = areaGrad;
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.beginPath();
      traceCubicSegments(ctx, segs, 0, progress);
      ctx.strokeStyle = el.stroke && el.stroke !== 'none' ? state.stroke : '#38bdf8';
      ctx.lineWidth = state.strokeWidth || 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Draw data points & X labels
    pts.forEach(([px, py], idx) => {
      const itemFrac = count === 1 ? 0 : idx / (count - 1);
      if (itemFrac <= progress + 0.02) {
        ctx.fillStyle = data[idx].color || '#38bdf8';
        ctx.beginPath();
        ctx.arc(px, py, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (el.showValues !== false) {
          ctx.fillStyle = '#f8fafc';
          ctx.font = '700 12px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(
            `${el.valuePrefix || ''}${data[idx].value}${el.valueSuffix || ''}`,
            px,
            py - 10
          );
        }
      }

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(data[idx].label, px, plotY + plotH + 10);
    });
  }

  ctx.restore();
}

function renderStudioCoordinateOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
  ctx.font = '500 11px monospace';
  ctx.lineWidth = 1;

  for (let x = 0; x <= w; x += 240) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    if (x > 0 && x < w) ctx.fillText(`${x}`, x + 4, 14);
  }
  for (let y = 0; y <= h; y += 180) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    if (y > 0 && y < h) ctx.fillText(`${y}`, 6, y - 4);
  }
  ctx.restore();
}

function renderBroadcastSafeMargins(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  // Action Safe (90%)
  ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);
  // Title Safe (80%)
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
  ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
  ctx.restore();
}
