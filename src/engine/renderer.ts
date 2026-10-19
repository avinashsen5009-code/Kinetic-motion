import {
  ClipRegion,
  FillValue,
  MarkerStyle,
  SceneNode,
  SceneSpecification,
} from '../types/scene';
import { getCachedPath2D, getEstimatedPathLength } from './pathUtils';
import { EvaluatedNodeState, evaluateNodeAtTime } from './timeline';

export interface RenderOptions {
  targetWidth?: number; // Default 1920
  targetHeight?: number; // Default 1080
  showSafeGuides?: boolean;
  showCoordinateGrid?: boolean;
  selectedNodeId?: string | null;
}

/**
 * Renders a complete frame of `scene` at deterministic timestamp `timeSec` onto `ctx`.
 */
export function renderSceneFrame(
  ctx: CanvasRenderingContext2D,
  scene: SceneSpecification,
  timeSec: number,
  options: RenderOptions = {}
): void {
  const targetWidth = options.targetWidth ?? 1920;
  const targetHeight = options.targetHeight ?? 1080;
  const logicalWidth = scene.meta.width || 1920;
  const logicalHeight = scene.meta.height || 1080;

  ctx.save();
  ctx.clearRect(0, 0, targetWidth, targetHeight);

  // Map logical coordinate system to output 16:9 canvas predictably
  const scaleX = targetWidth / logicalWidth;
  const scaleY = targetHeight / logicalHeight;
  ctx.scale(scaleX, scaleY);

  // 1. Render Background
  renderBackground(ctx, scene, logicalWidth, logicalHeight);

  // 2. Sort top-level elements by zIndex (preserving declaration order for equal zIndex)
  const sortedElements = [...scene.elements].map((el, idx) => ({ el, idx }));
  sortedElements.sort((a, b) => {
    const zA = a.el.zIndex ?? 0;
    const zB = b.el.zIndex ?? 0;
    return zA !== zB ? zA - zB : a.idx - b.idx;
  });

  // 3. Render Scene Graph Hierarchy
  const defs = scene.defs || {};
  for (const item of sortedElements) {
    renderNodeHierarchy(
      ctx,
      item.el,
      timeSec,
      defs,
      new Set<string>(),
      options.selectedNodeId
    );
  }

  // 4. Optional Scene Entrance / Exit Transitions
  renderSceneTransitions(ctx, scene, timeSec, logicalWidth, logicalHeight);

  // 5. Optional Studio Overlays (Safe Area Guides / Coordinate Grid in Preview Only)
  if (options.showCoordinateGrid) {
    renderStudioOverlayGrid(ctx, logicalWidth, logicalHeight);
  }
  if (options.showSafeGuides) {
    renderBroadcastSafeGuides(ctx, logicalWidth, logicalHeight);
  }

  ctx.restore();
}

function renderBackground(
  ctx: CanvasRenderingContext2D,
  scene: SceneSpecification,
  width: number,
  height: number
): void {
  const bg = scene.background;
  if (!bg) {
    ctx.fillStyle = '#0B1120';
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (bg.gradient) {
    ctx.fillStyle = resolveFillStyle(ctx, bg.gradient, 0, 0, width, height);
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = bg.color || '#0B1120';
    ctx.fillRect(0, 0, width, height);
  }

  if (bg.grid && bg.grid.enabled) {
    const spacing = Math.max(16, bg.grid.spacing || 60);
    const majorEvery = bg.grid.majorEvery || 4;
    ctx.save();
    ctx.strokeStyle = bg.grid.color || '#334155';
    const baseOpacity = bg.grid.opacity ?? 0.18;

    let colIdx = 0;
    for (let x = 0; x <= width; x += spacing) {
      ctx.globalAlpha = colIdx % majorEvery === 0 ? baseOpacity * 1.6 : baseOpacity;
      ctx.lineWidth = colIdx % majorEvery === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      colIdx++;
    }

    let rowIdx = 0;
    for (let y = 0; y <= height; y += spacing) {
      ctx.globalAlpha = rowIdx % majorEvery === 0 ? baseOpacity * 1.6 : baseOpacity;
      ctx.lineWidth = rowIdx % majorEvery === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      rowIdx++;
    }
    ctx.restore();
  }

  if (bg.vignette && bg.vignette.enabled) {
    const intensity = bg.vignette.intensity ?? 0.45;
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.25,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, bg.vignette.color || `rgba(0,0,0,${intensity})`);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

function renderNodeHierarchy(
  ctx: CanvasRenderingContext2D,
  rawNode: SceneNode,
  timeSec: number,
  defs: Record<string, SceneNode>,
  visitedRefs: Set<string>,
  selectedNodeId?: string | null
): void {
  const state = evaluateNodeAtTime(rawNode, timeSec);
  if (!state.isVisible) return;

  ctx.save();

  // Apply composite operation if specified
  if (state.blendMode) {
    ctx.globalCompositeOperation = state.blendMode;
  }

  // Multiply globalAlpha for nested opacity inheritance
  ctx.globalAlpha *= state.effectiveOpacity;

  // Apply local 2D affine transformations
  const tx = state.x ?? 0;
  const ty = state.y ?? 0;
  const ox = state.originX ?? 0;
  const oy = state.originY ?? 0;

  ctx.translate(tx + ox, ty + oy);

  if (state.rotation) {
    ctx.rotate((state.rotation * Math.PI) / 180);
  }

  if (state.skewX || state.skewY) {
    const sx = state.skewX ? Math.tan((state.skewX * Math.PI) / 180) : 0;
    const sy = state.skewY ? Math.tan((state.skewY * Math.PI) / 180) : 0;
    ctx.transform(1, sy, sx, 1, 0, 0);
  }

  if (state.effectiveScaleX !== 1 || state.effectiveScaleY !== 1) {
    ctx.scale(state.effectiveScaleX, state.effectiveScaleY);
  }

  if (ox !== 0 || oy !== 0) {
    ctx.translate(-ox, -oy);
  }

  // Optional Clip Region
  if (state.clip) {
    applyClipRegion(ctx, state.clip);
  }

  // Handle Symbol Instance (`use`)
  if (state.type === 'use' && state.ref) {
    const targetDef = defs[state.ref];
    if (targetDef && !visitedRefs.has(state.ref)) {
      const nextVisited = new Set(visitedRefs);
      nextVisited.add(state.ref);
      const clonedDef = applySymbolOverrides(targetDef, state.overrides);
      renderNodeHierarchy(ctx, clonedDef, timeSec, defs, nextVisited, selectedNodeId);
    }
    ctx.restore();
    return;
  }

  // Render 2.5D Extrusion shadow layers if configured
  if (
    state.extrude25D &&
    (Math.abs(state.effectiveExtrudeDepthX) > 0.2 ||
      Math.abs(state.effectiveExtrudeDepthY) > 0.2)
  ) {
    const steps = Math.min(32, Math.max(4, state.extrude25D.steps ?? 12));
    const dx = state.effectiveExtrudeDepthX;
    const dy = state.effectiveExtrudeDepthY;
    const extrudeColor = state.extrude25D.color || '#0F172A';

    for (let s = steps; s >= 1; s--) {
      const frac = s / steps;
      ctx.save();
      ctx.translate(dx * frac, dy * frac);
      const extrudeState: EvaluatedNodeState = {
        ...state,
        fill: state.fill ? extrudeColor : undefined,
        stroke: state.stroke ? extrudeColor : undefined,
        shadow: undefined,
      };
      renderPrimitiveGeometry(ctx, extrudeState);
      ctx.restore();
    }
  }

  // Apply Drop Shadow for main geometry pass
  if (state.shadow) {
    ctx.shadowColor = state.shadow.color || 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = state.shadow.blur ?? 12;
    ctx.shadowOffsetX = state.shadow.offsetX ?? 0;
    ctx.shadowOffsetY = state.shadow.offsetY ?? 6;
  }

  // Render Primitive Geometry
  renderPrimitiveGeometry(ctx, state);

  // Reset shadow before rendering children so children don't double-inherit shadow
  if (state.shadow) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // Render Nested Children (sorted by zIndex)
  if (Array.isArray(state.children) && state.children.length > 0) {
    const sortedChildren = [...state.children].map((el, idx) => ({ el, idx }));
    sortedChildren.sort((a, b) => {
      const zA = a.el.zIndex ?? 0;
      const zB = b.el.zIndex ?? 0;
      return zA !== zB ? zA - zB : a.idx - b.idx;
    });
    for (const childItem of sortedChildren) {
      renderNodeHierarchy(
        ctx,
        childItem.el,
        timeSec,
        defs,
        visitedRefs,
        selectedNodeId
      );
    }
  }

  // Optional selection highlight when inspected in studio UI
  if (selectedNodeId && state.id === selectedNodeId) {
    ctx.save();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    const bounds = getApproximateLocalBounds(state);
    ctx.strokeRect(bounds.x - 6, bounds.y - 6, bounds.w + 12, bounds.h + 12);
    ctx.restore();
  }

  ctx.restore();
}

function applySymbolOverrides(
  node: SceneNode,
  overrides?: Record<string, Partial<SceneNode>>
): SceneNode {
  if (!overrides) return node;
  const selfOverride = node.id && overrides[node.id] ? overrides[node.id] : {};
  const merged: SceneNode = {
    ...node,
    ...selfOverride,
  };
  if (Array.isArray(node.children)) {
    merged.children = node.children.map((c) => applySymbolOverrides(c, overrides));
  }
  return merged;
}

function applyClipRegion(ctx: CanvasRenderingContext2D, clip: ClipRegion): void {
  ctx.beginPath();
  if (clip.type === 'rect') {
    const x = clip.x ?? 0;
    const y = clip.y ?? 0;
    const w = clip.width ?? 200;
    const h = clip.height ?? 200;
    const rx = clip.rx ?? 0;
    if (rx > 0 && typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, rx);
    } else {
      ctx.rect(x, y, w, h);
    }
  } else if (clip.type === 'circle') {
    ctx.arc(clip.x ?? 0, clip.y ?? 0, Math.max(0, clip.r ?? 100), 0, Math.PI * 2);
  } else if (clip.type === 'ellipse') {
    ctx.ellipse(
      clip.x ?? 0,
      clip.y ?? 0,
      Math.max(0, (clip.width ?? 200) / 2),
      Math.max(0, (clip.height ?? 100) / 2),
      0,
      0,
      Math.PI * 2
    );
  } else if (clip.type === 'path' && clip.d) {
    const p = getCachedPath2D(clip.d);
    ctx.clip(p);
    return;
  }
  ctx.clip();
}

function renderPrimitiveGeometry(
  ctx: CanvasRenderingContext2D,
  state: EvaluatedNodeState
): void {
  const bounds = getApproximateLocalBounds(state);
  const drawProgress = Math.max(0, Math.min(1, state.drawProgress ?? 1));

  switch (state.type) {
    case 'group':
      break;

    case 'rect': {
      const w = Math.max(0, state.width ?? 100);
      const h = Math.max(0, state.height ?? 100);
      const ax = state.anchorX ?? 0;
      const ay = state.anchorY ?? 0;
      const rx = Math.max(0, state.rx ?? 0);
      const x0 = -w * ax;
      const y0 = -h * ay;

      ctx.beginPath();
      if (rx > 0 && typeof ctx.roundRect === 'function') {
        ctx.roundRect(x0, y0, w, h, rx);
      } else {
        ctx.rect(x0, y0, w, h);
      }
      const perim = 2 * (w + h);
      fillAndStrokeShape(ctx, state, x0, y0, w, h, perim, drawProgress);
      break;
    }

    case 'circle': {
      const r = Math.max(0, state.r ?? 50);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      const perim = 2 * Math.PI * r;
      fillAndStrokeShape(ctx, state, -r, -r, r * 2, r * 2, perim, drawProgress);
      break;
    }

    case 'ellipse': {
      const rx = Math.max(0, state.rx ?? (state.width ? state.width / 2 : 60));
      const ry = Math.max(0, state.ry ?? (state.height ? state.height / 2 : 40));
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      const perim = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
      fillAndStrokeShape(ctx, state, -rx, -ry, rx * 2, ry * 2, perim, drawProgress);
      break;
    }

    case 'arc': {
      const r = Math.max(0, state.r ?? 80);
      const innerR = Math.max(0, state.innerRadius ?? 0);
      const startRad = (((state.startAngle ?? -90) * Math.PI) / 180);
      const fullEndRad = (((state.endAngle ?? 180) * Math.PI) / 180);
      const currentEndRad = startRad + (fullEndRad - startRad) * drawProgress;

      ctx.beginPath();
      if (innerR > 0) {
        ctx.arc(0, 0, r, startRad, currentEndRad, false);
        ctx.arc(0, 0, innerR, currentEndRad, startRad, true);
        ctx.closePath();
      } else if (state.fill) {
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, startRad, currentEndRad, false);
        ctx.closePath();
      } else {
        ctx.arc(0, 0, r, startRad, currentEndRad, false);
      }
      fillAndStrokeShape(ctx, state, -r, -r, r * 2, r * 2, 0, 1);
      break;
    }

    case 'line': {
      const x1 = state.x1 ?? 0;
      const y1 = state.y1 ?? 0;
      const x2 = state.x2 ?? 100;
      const y2 = state.y2 ?? 0;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const curX2 = x1 + dx * drawProgress;
      const curY2 = y1 + dy * drawProgress;

      if (drawProgress <= 0.001) break;

      ctx.beginPath();
      ctx.moveTo(x1, y1);

      let endAngle = Math.atan2(dy, dx);
      const startAngle = Math.atan2(-dy, -dx);

      if (state.curveOffset && Math.abs(state.curveOffset) > 0.1) {
        const midX = (x1 + curX2) / 2;
        const midY = (y1 + curY2) / 2;
        const normLen = Math.hypot(dx, dy) || 1;
        const perpX = -dy / normLen;
        const perpY = dx / normLen;
        const cx = midX + perpX * state.curveOffset * drawProgress;
        const cy = midY + perpY * state.curveOffset * drawProgress;
        ctx.quadraticCurveTo(cx, cy, curX2, curY2);
        endAngle = Math.atan2(curY2 - cy, curX2 - cx);
      } else {
        ctx.lineTo(curX2, curY2);
      }

      applyStrokeSettings(ctx, state, Math.min(x1, x2), Math.min(y1, y2), Math.abs(dx) || 10, Math.abs(dy) || 10);
      ctx.stroke();

      // Render Start / End Markers (Arrowheads, circles, diamonds)
      if (state.startMarker && state.startMarker !== 'none') {
        renderLineMarker(ctx, state, state.startMarker, x1, y1, startAngle);
      }
      if (state.endMarker && state.endMarker !== 'none' && drawProgress > 0.05) {
        renderLineMarker(ctx, state, state.endMarker, curX2, curY2, endAngle);
      }
      break;
    }

    case 'polyline':
    case 'polygon': {
      const pts = normalizePoints(state.points);
      if (pts.length < 2) break;

      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      let totalLen = 0;
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
        totalLen += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      }
      if (state.type === 'polygon') {
        ctx.closePath();
        totalLen += Math.hypot(
          pts[0][0] - pts[pts.length - 1][0],
          pts[0][1] - pts[pts.length - 1][1]
        );
      }
      fillAndStrokeShape(
        ctx,
        state,
        bounds.x,
        bounds.y,
        bounds.w,
        bounds.h,
        totalLen,
        drawProgress
      );

      if (state.type === 'polyline' && state.endMarker && state.endMarker !== 'none' && drawProgress > 0.9) {
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
        renderLineMarker(ctx, state, state.endMarker, last[0], last[1], angle);
      }
      break;
    }

    case 'path': {
      const dStr = state.effectiveD || state.d;
      if (!dStr) break;
      const path2d = getCachedPath2D(dStr);
      const pathLen = drawProgress < 0.999 ? getEstimatedPathLength(dStr) : 0;

      if (state.fill && state.fill !== 'none') {
        ctx.fillStyle = resolveFillStyle(
          ctx,
          state.fill,
          bounds.x,
          bounds.y,
          bounds.w,
          bounds.h
        );
        ctx.fill(path2d);
      }

      if (state.stroke && state.stroke !== 'none' && (state.strokeWidth ?? 2) > 0) {
        ctx.save();
        applyStrokeSettings(ctx, state, bounds.x, bounds.y, bounds.w, bounds.h);
        if (drawProgress < 0.999 && pathLen > 0) {
          ctx.setLineDash([pathLen * drawProgress, pathLen * 2]);
          ctx.lineDashOffset = -(state.drawOffset ?? 0) * pathLen;
        }
        ctx.stroke(path2d);
        ctx.restore();
      }
      break;
    }

    case 'grid': {
      const w = state.width ?? 400;
      const h = state.height ?? 300;
      const cw = Math.max(10, state.cellWidth ?? 50);
      const ch = Math.max(10, state.cellHeight ?? 50);
      const ax = state.anchorX ?? 0;
      const ay = state.anchorY ?? 0;
      const x0 = -w * ax;
      const y0 = -h * ay;

      ctx.save();
      applyStrokeSettings(ctx, state, x0, y0, w, h);
      ctx.beginPath();
      for (let x = x0; x <= x0 + w + 0.5; x += cw) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y0 + h * drawProgress);
      }
      for (let y = y0; y <= y0 + h + 0.5; y += ch) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + w * drawProgress, y);
      }
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'text':
    case 'counter': {
      renderTypography(ctx, state);
      break;
    }
  }
}

function fillAndStrokeShape(
  ctx: CanvasRenderingContext2D,
  state: EvaluatedNodeState,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  perimeter: number,
  drawProgress: number
): void {
  if (state.fill && state.fill !== 'none') {
    ctx.fillStyle = resolveFillStyle(ctx, state.fill, bx, by, bw, bh);
    ctx.fill();
  }

  if (state.stroke && state.stroke !== 'none' && (state.strokeWidth ?? 2) > 0) {
    ctx.save();
    applyStrokeSettings(ctx, state, bx, by, bw, bh);
    if (drawProgress < 0.999 && perimeter > 0) {
      ctx.setLineDash([perimeter * drawProgress, perimeter * 2]);
      ctx.lineDashOffset = -(state.drawOffset ?? 0) * perimeter;
    }
    ctx.stroke();
    ctx.restore();
  }
}

function applyStrokeSettings(
  ctx: CanvasRenderingContext2D,
  state: EvaluatedNodeState,
  bx: number,
  by: number,
  bw: number,
  bh: number
): void {
  if (state.stroke) {
    ctx.strokeStyle = resolveFillStyle(ctx, state.stroke, bx, by, bw, bh);
  }
  ctx.lineWidth = state.strokeWidth ?? 2;
  ctx.lineCap = state.lineCap || 'round';
  ctx.lineJoin = state.lineJoin || 'round';
  if (Array.isArray(state.strokeDash) && state.strokeDash.length > 0) {
    ctx.setLineDash(state.strokeDash);
    ctx.lineDashOffset = state.strokeDashOffset ?? 0;
  } else {
    ctx.setLineDash([]);
  }
}

function renderLineMarker(
  ctx: CanvasRenderingContext2D,
  state: EvaluatedNodeState,
  marker: MarkerStyle | 'arrow' | 'circle' | 'diamond' | 'none',
  x: number,
  y: number,
  angleRad: number
): void {
  const mObj: MarkerStyle =
    typeof marker === 'string' ? { type: marker } : marker;
  if (mObj.type === 'none') return;

  const strokeW = state.strokeWidth ?? 3;
  const size = mObj.size ?? Math.max(10, strokeW * 3.5);
  const color =
    mObj.color ||
    (typeof state.stroke === 'string' ? state.stroke : '#38BDF8');

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, strokeW * 0.8);
  ctx.setLineDash([]);

  if (mObj.type === 'arrow' || mObj.type === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(-size, -size * 0.55);
    ctx.lineTo(-size * 0.78, 0);
    ctx.lineTo(-size, size * 0.55);
    ctx.closePath();
    ctx.fill();
  } else if (mObj.type === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (mObj.type === 'diamond') {
    const r = size * 0.55;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(0, r * 0.65);
    ctx.lineTo(-r, 0);
    ctx.lineTo(0, -r * 0.65);
    ctx.closePath();
    ctx.fill();
  } else if (mObj.type === 'bar') {
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.6);
    ctx.lineTo(0, size * 0.6);
    ctx.stroke();
  }

  ctx.restore();
}

function renderTypography(
  ctx: CanvasRenderingContext2D,
  state: EvaluatedNodeState
): void {
  let rawText = state.text ?? '';
  if (state.type === 'counter') {
    const val = state.value ?? 0;
    const decimals = state.decimals ?? 0;
    const useGrouping = state.useGrouping ?? true;
    const formatted = val.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping,
    });
    rawText = `${state.prefix ?? ''}${formatted}${state.suffix ?? ''}`;
  }

  if (!rawText) return;

  const reveal = Math.max(0, Math.min(1, state.textReveal ?? 1));
  if (reveal <= 0.001) return;

  const revealMode = state.textRevealMode || 'chars';
  let visibleText = rawText;

  if (reveal < 0.999) {
    if (revealMode === 'chars') {
      const charCount = Math.ceil(rawText.length * reveal);
      visibleText = rawText.slice(0, charCount);
    } else if (revealMode === 'words') {
      const words = rawText.split(' ');
      const wordCount = Math.ceil(words.length * reveal);
      visibleText = words.slice(0, wordCount).join(' ');
    }
  }

  const fontSize = state.fontSize ?? 32;
  const fontWeight = state.fontWeight ?? 600;
  const fontStyle = state.fontStyle ?? 'normal';
  const fontFamily = state.fontFamily || 'Outfit, Plus Jakarta Sans, sans-serif';
  const lineHeightPx = fontSize * (state.lineHeight ?? 1.25);

  ctx.save();
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = state.textAlign || 'left';
  ctx.textBaseline =
    state.verticalAlign === 'middle'
      ? 'middle'
      : state.verticalAlign === 'bottom'
      ? 'bottom'
      : 'top';

  if (state.letterSpacing !== undefined && 'letterSpacing' in ctx) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${state.letterSpacing}px`;
  }

  // Word-wrapping and explicit newline support
  const lines = wrapTextLines(ctx, visibleText, state.maxWidth);
  const totalBlockHeight = lines.length * lineHeightPx;

  let startY = 0;
  if (state.verticalAlign === 'middle') {
    startY = -((lines.length - 1) * lineHeightPx) / 2;
  } else if (state.verticalAlign === 'bottom') {
    startY = -((lines.length - 1) * lineHeightPx);
  }

  if (revealMode === 'clip' && reveal < 0.999) {
    const maxW = state.maxWidth || 1600;
    ctx.beginPath();
    ctx.rect(-maxW, startY - fontSize, maxW * 2 * reveal, totalBlockHeight + fontSize * 2);
    ctx.clip();
  }

  const fillStyle = state.fill
    ? resolveFillStyle(ctx, state.fill, -200, startY, 400, totalBlockHeight)
    : '#F8FAFC';

  lines.forEach((line, idx) => {
    if (revealMode === 'lines' && idx / lines.length >= reveal) return;
    const lineY = startY + idx * lineHeightPx;

    if (state.stroke && state.stroke !== 'none' && (state.strokeWidth ?? 0) > 0) {
      ctx.strokeStyle = resolveFillStyle(
        ctx,
        state.stroke,
        -200,
        lineY,
        400,
        lineHeightPx
      );
      ctx.lineWidth = state.strokeWidth ?? 2;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, 0, lineY);
    }

    if (state.fill !== 'none') {
      ctx.fillStyle = fillStyle;
      ctx.fillText(line, 0, lineY);
    }
  });

  ctx.restore();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth?: number
): string[] {
  const rawParagraphs = text.split('\n');
  if (!maxWidth || maxWidth <= 0) {
    return rawParagraphs;
  }

  const lines: string[] = [];
  for (const para of rawParagraphs) {
    const words = para.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine || para === '') {
      lines.push(currentLine);
    }
  }
  return lines;
}

function resolveFillStyle(
  ctx: CanvasRenderingContext2D,
  fill: FillValue,
  bx: number,
  by: number,
  bw: number,
  bh: number
): string | CanvasGradient {
  if (typeof fill === 'string') return fill;

  if (fill.type === 'linear') {
    let x1 = fill.x1;
    let y1 = fill.y1;
    let x2 = fill.x2;
    let y2 = fill.y2;

    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
      const angleRad = (((fill.angle ?? 135) - 90) * Math.PI) / 180;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const radius = Math.hypot(bw, bh) / 2;
      x1 = cx - Math.cos(angleRad) * radius;
      y1 = cy - Math.sin(angleRad) * radius;
      x2 = cx + Math.cos(angleRad) * radius;
      y2 = cy + Math.sin(angleRad) * radius;
    }

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    for (const stop of fill.stops || []) {
      grad.addColorStop(Math.max(0, Math.min(1, stop.offset)), stop.color);
    }
    return grad;
  }

  if (fill.type === 'radial') {
    const cx = fill.cx ?? bx + bw / 2;
    const cy = fill.cy ?? by + bh / 2;
    const r = fill.r ?? Math.max(bw, bh) * 0.65;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, r));
    for (const stop of fill.stops || []) {
      grad.addColorStop(Math.max(0, Math.min(1, stop.offset)), stop.color);
    }
    return grad;
  }

  return '#FFFFFF';
}

function normalizePoints(
  points?: Array<[number, number] | { x: number; y: number }>
): Array<[number, number]> {
  if (!Array.isArray(points)) return [];
  return points.map((pt) => {
    if (Array.isArray(pt)) return [Number(pt[0]) || 0, Number(pt[1]) || 0];
    return [Number(pt.x) || 0, Number(pt.y) || 0];
  });
}

function getApproximateLocalBounds(state: EvaluatedNodeState): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  switch (state.type) {
    case 'rect':
    case 'grid': {
      const w = state.width ?? 100;
      const h = state.height ?? 100;
      return {
        x: -w * (state.anchorX ?? 0),
        y: -h * (state.anchorY ?? 0),
        w,
        h,
      };
    }
    case 'circle':
    case 'arc': {
      const r = state.r ?? 50;
      return { x: -r, y: -r, w: r * 2, h: r * 2 };
    }
    case 'ellipse': {
      const rx = state.rx ?? 60;
      const ry = state.ry ?? 40;
      return { x: -rx, y: -ry, w: rx * 2, h: ry * 2 };
    }
    case 'line': {
      const x1 = state.x1 ?? 0;
      const y1 = state.y1 ?? 0;
      const x2 = state.x2 ?? 100;
      const y2 = state.y2 ?? 0;
      return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: Math.max(20, Math.abs(x2 - x1)),
        h: Math.max(20, Math.abs(y2 - y1)),
      };
    }
    default:
      return {
        x: -100,
        y: -50,
        w: state.width ?? 240,
        h: state.height ?? 120,
      };
  }
}

function renderSceneTransitions(
  ctx: CanvasRenderingContext2D,
  scene: SceneSpecification,
  timeSec: number,
  width: number,
  height: number
): void {
  const tr = scene.transitions;
  if (!tr) return;

  if (tr.in && tr.in.duration > 0 && timeSec < tr.in.duration) {
    const p = Math.max(0, Math.min(1, timeSec / tr.in.duration));
    const color = tr.in.color || '#090D16';
    ctx.save();
    ctx.fillStyle = color;
    if (tr.in.type === 'fade') {
      ctx.globalAlpha = 1 - p;
      ctx.fillRect(0, 0, width, height);
    } else if (tr.in.type === 'wipeRight') {
      ctx.fillRect(width * p, 0, width * (1 - p), height);
    } else if (tr.in.type === 'wipeLeft') {
      ctx.fillRect(0, 0, width * (1 - p), height);
    } else if (tr.in.type === 'wipeUp') {
      ctx.fillRect(0, 0, width, height * (1 - p));
    }
    ctx.restore();
  }

  const totalDur = scene.meta.duration;
  if (tr.out && tr.out.duration > 0 && timeSec > totalDur - tr.out.duration) {
    const p = Math.max(
      0,
      Math.min(1, (timeSec - (totalDur - tr.out.duration)) / tr.out.duration)
    );
    const color = tr.out.color || '#090D16';
    ctx.save();
    ctx.fillStyle = color;
    if (tr.out.type === 'fade') {
      ctx.globalAlpha = p;
      ctx.fillRect(0, 0, width, height);
    } else if (tr.out.type === 'wipeRight') {
      ctx.fillRect(0, 0, width * p, height);
    } else if (tr.out.type === 'wipeLeft') {
      ctx.fillRect(width * (1 - p), 0, width * p, height);
    } else if (tr.out.type === 'wipeUp') {
      ctx.fillRect(0, height * (1 - p), width, height * p);
    }
    ctx.restore();
  }
}

function renderBroadcastSafeGuides(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.save();
  // Action safe (90%)
  const ax = width * 0.05;
  const ay = height * 0.05;
  const aw = width * 0.9;
  const ah = height * 0.9;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(ax, ay, aw, ah);

  // Title safe (80%)
  const tx = width * 0.1;
  const ty = height * 0.1;
  const tw = width * 0.8;
  const th = height * 0.8;
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
  ctx.strokeRect(tx, ty, tw, th);

  // Center crosshair
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(width / 2 - 20, height / 2);
  ctx.lineTo(width / 2 + 20, height / 2);
  ctx.moveTo(width / 2, height / 2 - 20);
  ctx.lineTo(width / 2, height / 2 + 20);
  ctx.stroke();
  ctx.restore();
}

function renderStudioOverlayGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
  ctx.font = '500 13px JetBrains Mono, monospace';
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 240) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    if (x > 0 && x < width) {
      ctx.fillText(`${x}`, x + 6, 18);
    }
  }

  for (let y = 0; y <= height; y += 180) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    if (y > 0 && y < height) {
      ctx.fillText(`${y}`, 8, y - 6);
    }
  }
  ctx.restore();
}
