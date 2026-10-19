export type EasingName =
  | 'linear'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeOutQuart'
  | 'easeInOutQuart'
  | 'easeOutBack'
  | 'easeInOutBack'
  | 'easeOutElastic'
  | 'spring'
  | 'step';

export type CubicBezierTuple = [number, number, number, number];

export type EasingDefinition = EasingName | CubicBezierTuple;

export interface GradientStop {
  offset: number; // 0 to 1
  color: string;
}

export interface GradientFill {
  type: 'linear' | 'radial';
  angle?: number; // degrees for linear gradient (default 135)
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  r?: number;
  stops: GradientStop[];
}

export type FillValue = string | GradientFill;

export interface ShadowEffect {
  color: string;
  blur: number;
  offsetX?: number;
  offsetY?: number;
}

export interface Extrude25DEffect {
  depthX: number;
  depthY: number;
  color: string;
  steps?: number;
}

export interface ClipRegion {
  type: 'rect' | 'circle' | 'ellipse' | 'path';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rx?: number;
  r?: number;
  d?: string;
}

export type AnimatableProperty =
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'r'
  | 'rx'
  | 'ry'
  | 'x1'
  | 'y1'
  | 'x2'
  | 'y2'
  | 'scale'
  | 'scaleX'
  | 'scaleY'
  | 'rotation'
  | 'skewX'
  | 'skewY'
  | 'opacity'
  | 'strokeWidth'
  | 'drawProgress'
  | 'textReveal'
  | 'morphProgress'
  | 'value'
  | 'fill'
  | 'stroke'
  | 'extrudeDepthX'
  | 'extrudeDepthY';

export interface AnimationTrack {
  property: AnimatableProperty;
  from?: number | string;
  to: number | string;
  start: number; // seconds from scene start
  duration: number; // seconds
  easing?: EasingDefinition;
}

export type SceneElementType =
  | 'group'
  | 'use'
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'polygon'
  | 'path'
  | 'arc'
  | 'grid'
  | 'text'
  | 'counter';

export interface MarkerStyle {
  type: 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond' | 'bar';
  size?: number;
  color?: string;
}

export interface SceneNode {
  id: string;
  name?: string;
  type: SceneElementType;

  // Symbol reference (when type === 'use')
  ref?: string;
  overrides?: Record<string, Partial<SceneNode>>;

  // Spatial & Transform
  x?: number;
  y?: number;
  rotation?: number; // degrees
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  skewX?: number;
  skewY?: number;
  anchorX?: number; // 0 to 1 or pixel offset depending on element, default 0 for rect, center for circle
  anchorY?: number;
  originX?: number; // Explicit pivot override in local coordinates
  originY?: number;
  opacity?: number;
  zIndex?: number;

  // Visibility Window
  visibleFrom?: number; // seconds
  visibleUntil?: number; // seconds

  // Geometry properties
  width?: number;
  height?: number;
  r?: number;
  rx?: number;
  ry?: number;
  innerRadius?: number; // For arc / donut primitives
  startAngle?: number; // degrees for arc
  endAngle?: number; // degrees for arc

  // Line / Connector properties
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  points?: Array<[number, number] | { x: number; y: number }>;
  startMarker?: MarkerStyle | 'arrow' | 'circle' | 'diamond' | 'none';
  endMarker?: MarkerStyle | 'arrow' | 'circle' | 'diamond' | 'none';
  curveOffset?: number; // Optional quadratic curve bow for connectors

  // Path & Morphing
  d?: string; // SVG Path string (M, L, H, V, C, S, Q, A, Z)
  morphTo?: string; // Target SVG Path string for shape morphing
  morphProgress?: number; // 0 to 1
  drawProgress?: number; // 0 to 1 for stroke trim path reveal
  drawOffset?: number; // 0 to 1 offset

  // Grid primitive properties
  cellWidth?: number;
  cellHeight?: number;
  subdivisions?: number;

  // Text & Counter properties
  text?: string;
  value?: number; // For 'counter' numeric display
  decimals?: number;
  prefix?: string;
  suffix?: string;
  useGrouping?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  letterSpacing?: number; // pixels
  lineHeight?: number; // multiplier (e.g., 1.3)
  maxWidth?: number;
  textReveal?: number; // 0 to 1
  textRevealMode?: 'chars' | 'words' | 'lines' | 'clip';

  // Styling & Effects
  fill?: FillValue;
  stroke?: FillValue;
  strokeWidth?: number;
  strokeDash?: number[];
  strokeDashOffset?: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  shadow?: ShadowEffect;
  extrude25D?: Extrude25DEffect;
  clip?: ClipRegion;
  blendMode?: GlobalCompositeOperation;

  // Hierarchy & Animations
  children?: SceneNode[];
  animations?: AnimationTrack[];
}

export interface BackgroundSpec {
  color?: string;
  gradient?: GradientFill;
  grid?: {
    enabled: boolean;
    spacing?: number;
    color?: string;
    opacity?: number;
    majorEvery?: number;
  };
  vignette?: {
    enabled: boolean;
    color?: string;
    intensity?: number;
  };
}

export interface SceneTransitionSpec {
  in?: {
    type: 'fade' | 'wipeLeft' | 'wipeRight' | 'wipeUp' | 'iris' | 'zoom';
    duration: number;
    color?: string;
  };
  out?: {
    type: 'fade' | 'wipeLeft' | 'wipeRight' | 'wipeUp' | 'iris' | 'zoom';
    duration: number;
    color?: string;
  };
}

export interface SceneSpecification {
  schemaVersion: string;
  meta: {
    title: string;
    description?: string;
    author?: string;
    width: number; // Logical coordinate width (mapped to 1920x1080)
    height: number; // Logical coordinate height
    fps: 30 | 60;
    duration: number; // Total duration in seconds
  };
  background?: BackgroundSpec;
  transitions?: SceneTransitionSpec;
  defs?: Record<string, SceneNode>; // Reusable symbol definitions
  elements: SceneNode[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  scene: SceneSpecification | null;
  issues: ValidationIssue[];
}

export interface SceneProjectFile {
  projectFormat: 'kinetic-json-scene-project';
  schemaVersion: string;
  rendererVersion: string;
  savedAt: string;
  exportSettings: {
    format: 'mp4' | 'webm';
    fps: 30 | 60;
    resolution: '1920x1080';
  };
  fontsRequired: string[];
  rawJson: string;
  scene: SceneSpecification;
}
