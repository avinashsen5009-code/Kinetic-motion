import { AnimatableProperty, AnimationTrack, SceneNode } from '../types/scene';
import { evaluateEasing, interpolateColor } from './easing';
import { interpolateSvgPath } from './pathUtils';

export interface EvaluatedNodeState extends SceneNode {
  effectiveScaleX: number;
  effectiveScaleY: number;
  effectiveOpacity: number;
  effectiveExtrudeDepthX: number;
  effectiveExtrudeDepthY: number;
  effectiveD: string;
  isVisible: boolean;
}

const DEFAULT_NUMERIC_PROPS: Record<string, number> = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  r: 50,
  rx: 0,
  ry: 0,
  x1: 0,
  y1: 0,
  x2: 100,
  y2: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  skewX: 0,
  skewY: 0,
  opacity: 1,
  strokeWidth: 2,
  drawProgress: 1,
  textReveal: 1,
  morphProgress: 0,
  value: 0,
  extrudeDepthX: 0,
  extrudeDepthY: 0,
};

/**
 * Evaluates a single SceneNode's properties at deterministic timestamp `timeSec` (in seconds).
 * Rules when animation properties are omitted:
 * - Static properties defined on the node remain constant across the entire timeline.
 * - If an animation track specifies `from`, before the first track's `start` time on that property,
 *   the property holds the first track's `from` value (fill-backwards).
 * - After a track's `start + duration`, the property holds its `to` value (fill-forwards) until
 *   a subsequent track on the same property begins.
 */
export function evaluateNodeAtTime(node: SceneNode, timeSec: number): EvaluatedNodeState {
  const visibleFrom = node.visibleFrom ?? 0;
  const visibleUntil = node.visibleUntil ?? Infinity;
  const isVisible = timeSec >= visibleFrom - 1e-6 && timeSec <= visibleUntil + 1e-6;

  // Copy base properties
  const computed: Record<string, unknown> = { ...node };

  // Set initial extrude defaults from extrude25D object if present
  let extrudeDepthX = node.extrude25D?.depthX ?? 0;
  let extrudeDepthY = node.extrude25D?.depthY ?? 0;
  computed.extrudeDepthX = extrudeDepthX;
  computed.extrudeDepthY = extrudeDepthY;

  if (Array.isArray(node.animations) && node.animations.length > 0) {
    // Group tracks by property and sort chronologically by start time
    const tracksByProp = new Map<AnimatableProperty, AnimationTrack[]>();
    for (const track of node.animations) {
      const list = tracksByProp.get(track.property) || [];
      list.push(track);
      tracksByProp.set(track.property, list);
    }

    for (const [prop, tracks] of tracksByProp.entries()) {
      tracks.sort((a, b) => a.start - b.start);

      // Base fallback value from static node definition or default
      let currentVal: number | string =
        (computed[prop] as number | string | undefined) ??
        DEFAULT_NUMERIC_PROPS[prop] ??
        0;

      // Fill backwards if first track has an explicit `from` and timeSec <= firstTrack.start
      if (tracks[0].from !== undefined && timeSec <= tracks[0].start) {
        currentVal = tracks[0].from;
      } else {
        for (const track of tracks) {
          const fromVal = track.from !== undefined ? track.from : currentVal;
          const toVal = track.to;
          const end = track.start + track.duration;

          if (timeSec < track.start) {
            break;
          } else if (timeSec >= end || track.duration <= 0) {
            currentVal = toVal;
          } else {
            const rawProgress = (timeSec - track.start) / track.duration;
            const easedProgress = evaluateEasing(track.easing, rawProgress);

            if (typeof fromVal === 'number' && typeof toVal === 'number') {
              currentVal = fromVal + (toVal - fromVal) * easedProgress;
            } else if (typeof fromVal === 'string' && typeof toVal === 'string') {
              currentVal = interpolateColor(fromVal, toVal, easedProgress);
            } else {
              currentVal = easedProgress < 0.5 ? fromVal : toVal;
            }
            break;
          }
        }
      }

      computed[prop] = currentVal;
    }
  }

  const baseScale = typeof computed.scale === 'number' ? computed.scale : 1;
  const scaleX =
    (typeof computed.scaleX === 'number' ? computed.scaleX : 1) * baseScale;
  const scaleY =
    (typeof computed.scaleY === 'number' ? computed.scaleY : 1) * baseScale;

  const opacity = Math.max(
    0,
    Math.min(1, typeof computed.opacity === 'number' ? computed.opacity : 1)
  );

  extrudeDepthX = typeof computed.extrudeDepthX === 'number' ? computed.extrudeDepthX : 0;
  extrudeDepthY = typeof computed.extrudeDepthY === 'number' ? computed.extrudeDepthY : 0;

  const morphProgress = Math.max(
    0,
    Math.min(1, typeof computed.morphProgress === 'number' ? computed.morphProgress : 0)
  );

  let effectiveD = typeof computed.d === 'string' ? computed.d : '';
  if (effectiveD && typeof node.morphTo === 'string' && morphProgress > 0) {
    effectiveD = interpolateSvgPath(effectiveD, node.morphTo, morphProgress);
  }

  return {
    ...(computed as unknown as SceneNode),
    effectiveScaleX: scaleX,
    effectiveScaleY: scaleY,
    effectiveOpacity: opacity,
    effectiveExtrudeDepthX: extrudeDepthX,
    effectiveExtrudeDepthY: extrudeDepthY,
    effectiveD,
    isVisible: isVisible && opacity > 0.0001,
  };
}
