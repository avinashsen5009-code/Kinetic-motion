// ============================================================================
// Module 1: JSON Scene Specification & TypeScript Schema Definitions (v1.0)
// ============================================================================

export type EasingName =
  | 'linear'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeInQuart'
  | 'easeOutQuart'
  | 'easeInOutQuart'
  | 'easeInBack'
  | 'easeOutBack'
  | 'easeInOutBack'
  | 'easeOutElastic'
  | 'easeOutBounce'
  | 'spring'
  | 'stepStart'
  | 'stepEnd';

export type EasingSpec =
  | EasingName
  | ['cubic-bezier', number, number, number, number]
  | ['steps', number];

export interface GradientStop {
  offset: number; // 0 to 1
  color: string;
}

export interface GradientSpec {
  type: 'linear' | 'radial';
  angle?: number; // degrees for linear gradient
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  r?: number;
  stops: GradientStop[];
}

export interface ShadowSpec {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface GlowSpec {
  color: string;
  strength: number;
}

export interface OutlineSpec {
  color: string;
  width: number;
  offset?: number;
}

export interface Depth25DSpec {
  extrudeX?: number;
  extrudeY?: number;
  extrudeColor?: string;
  tiltX?: number; // degrees (-60 to 60)
  tiltY?: number; // degrees (-60 to 60)
  elevation?: number; // z-elevation shadow & parallax offset
}

export interface ClipSpec {
  type: 'rect' | 'circle' | 'ellipse' | 'polygon' | 'path';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  cornerRadius?: number;
  radius?: number;
  rx?: number;
  ry?: number;
  points?: [number, number][];
  d?: string;
}

export interface KeyframeSpec {
  time: number; // seconds from scene start (0 <= time <= duration)
  easing?: EasingSpec;
  x?: number;
  y?: number;
  z?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  skewX?: number;
  skewY?: number;
  opacity?: number;
  width?: number;
  height?: number;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDashOffset?: number;
  trimStart?: number; // 0..1
  trimEnd?: number; // 0..1
  textProgress?: number; // 0..1
  dataProgress?: number; // 0..1
  morphProgress?: number; // 0..1
  extrudeX?: number;
  extrudeY?: number;
  tiltX?: number;
  tiltY?: number;
  counterValue?: number;
}

export interface TrackPoint<T = number | string> {
  time: number;
  value: T;
  easing?: EasingSpec;
}

export interface EntranceSpec {
  type:
    | 'fade'
    | 'scaleUp'
    | 'pop'
    | 'slideLeft'
    | 'slideRight'
    | 'slideUp'
    | 'slideDown'
    | 'drawStroke'
    | 'typewriter'
    | 'wipeRight';
  duration: number;
  delay?: number;
  easing?: EasingSpec;
  distance?: number;
}

export interface ExitSpec {
  type:
    | 'fade'
    | 'scaleDown'
    | 'slideLeft'
    | 'slideRight'
    | 'slideUp'
    | 'slideDown'
    | 'eraseStroke';
  duration: number;
  startTime?: number;
  easing?: EasingSpec;
  distance?: number;
}

export interface PathCommandSpec {
  cmd: 'M' | 'L' | 'H' | 'V' | 'Q' | 'C' | 'Z';
  pts: number[];
}

export interface TextRevealSpec {
  mode: 'chars' | 'words' | 'lines' | 'typewriter';
  progress?: number; // 0..1 (can be animated via keyframe textProgress)
  stagger?: number;
  cursor?: boolean;
  cursorColor?: string;
}

export interface CounterSpec {
  from: number;
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  formatThousands?: boolean;
}

export interface TextBoxSpec {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  padding?: number | [number, number];
  cornerRadius?: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  value2?: number;
  color?: string;
}

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
}

export interface FlowParticleSpec {
  count: number;
  speed: number; // cycles per second
  radius?: number;
  color?: string;
}

export type ElementType =
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
  | 'connector'
  | 'arrow'
  | 'text'
  | 'callout'
  | 'chart'
  | 'grid';

export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'lighter';

export interface SceneElement {
  id: string;
  name?: string;
  type: ElementType;
  visible?: boolean;
  startTime?: number;
  endTime?: number;
  zIndex?: number;
  blendMode?: BlendMode;

  // Transform properties
  x?: number;
  y?: number;
  z?: number;
  pivotX?: number;
  pivotY?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  skewX?: number;
  skewY?: number;
  opacity?: number;

  // Styling properties
  fill?: string;
  fillGradient?: GradientSpec;
  stroke?: string;
  strokeGradient?: GradientSpec;
  strokeWidth?: number;
  strokeCap?: 'butt' | 'round' | 'square';
  strokeJoin?: 'miter' | 'round' | 'bevel';
  strokeDash?: number[];
  strokeDashOffset?: number;
  trimStart?: number;
  trimEnd?: number;
  shadow?: ShadowSpec;
  glow?: GlowSpec;
  outline?: OutlineSpec;
  depth25d?: Depth25DSpec;
  clip?: ClipSpec;

  // Group / Symbol reference
  children?: SceneElement[];
  ref?: string; // for type: "use", references defs[ref]
  overrides?: Partial<SceneElement> & Record<string, Partial<SceneElement>>;

  // Rect / Box / Grid geometry
  width?: number;
  height?: number;
  cornerRadius?: number | [number, number, number, number];
  anchorX?: number; // 0..1 (default 0.5 for center or 0 for top-left if specified)
  anchorY?: number; // 0..1

  // Circle / Ellipse / Arc / Polygon geometry
  radius?: number;
  innerRadius?: number;
  rx?: number;
  ry?: number;
  startAngle?: number; // degrees
  endAngle?: number; // degrees
  anticlockwise?: boolean;
  sides?: number; // for regular polygon / star

  // Line / Polyline / Polygon / Path geometry
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  points?: [number, number][];
  closed?: boolean;
  smooth?: boolean;
  tension?: number;
  d?: string; // SVG path string
  commands?: PathCommandSpec[]; // Explicit structured path commands
  morphTo?: string; // Target SVG path string for shape morphing
  morphProgress?: number; // 0..1

  // Connector / Arrow properties
  from?: [number, number];
  to?: [number, number];
  routing?: 'straight' | 'curved' | 'orthogonal' | 'cubic';
  curvature?: number;
  controlPoints?: [number, number][];
  startHead?: 'none' | 'arrow' | 'dot' | 'diamond' | 'bar';
  endHead?: 'none' | 'arrow' | 'dot' | 'diamond' | 'bar';
  headSize?: number;
  label?: string;
  labelBg?: string;
  labelColor?: string;
  labelOffset?: number;
  flowParticles?: FlowParticleSpec;

  // Typography / Callout properties
  text?: string;
  subtext?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: 'normal' | 'italic';
  lineHeight?: number;
  letterSpacing?: number;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  maxWidth?: number;
  backgroundBox?: TextBoxSpec;
  reveal?: TextRevealSpec;
  textProgress?: number;
  counter?: CounterSpec;
  tailTarget?: [number, number];
  tailBaseWidth?: number;
  badgeText?: string;
  badgeColor?: string;

  // Chart properties
  chartType?: 'bar' | 'horizontalBar' | 'line' | 'area' | 'donut' | 'scatter';
  data?: ChartDataPoint[];
  series?: ChartSeries[];
  minValue?: number;
  maxValue?: number;
  showGrid?: boolean;
  showAxes?: boolean;
  showValues?: boolean;
  showLegend?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
  dataProgress?: number;
  barRadius?: number;

  // Grid element properties
  gridSpacing?: number;
  majorEvery?: number;
  isometric?: boolean;

  // Animation properties
  keyframes?: KeyframeSpec[];
  tracks?: Record<string, TrackPoint<any>[]>;
  entrance?: EntranceSpec;
  exit?: ExitSpec;
}

export interface LayerSpec {
  id: string;
  name?: string;
  visible?: boolean;
  opacity?: number;
  blendMode?: BlendMode;
  zIndex?: number;
  clip?: ClipSpec;
  elements: SceneElement[];
}

export interface BackgroundSpec {
  color?: string;
  gradient?: GradientSpec;
  grid?: {
    enabled: boolean;
    spacing?: number;
    color?: string;
    opacity?: number;
    majorEvery?: number;
    isometric?: boolean;
  };
  vignette?: {
    intensity?: number;
    color?: string;
  };
  shapes?: SceneElement[];
}

export interface CameraSpec {
  x?: number;
  y?: number;
  zoom?: number;
  rotation?: number;
  perspective?: number;
  tiltX?: number;
  tiltY?: number;
  keyframes?: Array<{
    time: number;
    x?: number;
    y?: number;
    zoom?: number;
    rotation?: number;
    tiltX?: number;
    tiltY?: number;
    easing?: EasingSpec;
  }>;
}

export interface FontRequirement {
  family: string;
  weights?: number[];
  fallback?: string;
}

export interface SceneSpec {
  schemaVersion?: string;
  id: string;
  title: string;
  description?: string;
  width: number; // Logical scene width (mapped to 1920x1080 output)
  height: number; // Logical scene height
  fps?: number; // Default 30 (supports 30 or 60)
  duration: number; // Seconds
  fonts?: FontRequirement[];
  camera?: CameraSpec;
  background?: BackgroundSpec;
  defs?: Record<string, SceneElement>;
  layers?: LayerSpec[];
  elements?: SceneElement[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  scene: SceneSpec | null;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  stats: {
    elementCount: number;
    layerCount: number;
    defCount: number;
    keyframeCount: number;
    duration: number;
    fps: number;
  };
}

export interface ProjectFile {
  projectFormat: 'mgscene-project';
  rendererVersion: string;
  schemaVersion: string;
  savedAt: string;
  exportSettings: {
    resolution: '1920x1080';
    fps: 30 | 60;
    format: 'webm' | 'mp4';
    bitrateMbps: number;
  };
  fontRequirements: FontRequirement[];
  rawJson: string;
  scene: SceneSpec;
}
