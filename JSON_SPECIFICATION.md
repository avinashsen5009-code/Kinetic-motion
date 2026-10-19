# JSON-Driven Motion Graphics Scene Specification (`v1.0`)

## 1. Overview & Design Philosophy

The **Motion Graphics Scene Renderer** interprets a declarative JSON specification (`schemaVersion: "1.0"`) and renders a deterministic, frame-accurate animated scene at a logical **1920 × 1080 (16:9)** resolution.

- **Zero Predefined Templates or Fixed Asset Packs**: Every character, stick figure, diagram, icon, chart, and illustration is constructed from composable vector primitives (`group`, `use`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path`, `arc`, `connector`, `arrow`, `text`, `callout`, `chart`, `grid`).
- **Deterministic Timeline**: Given the same JSON input, resolution, FPS, and renderer version, every frame `f` at timestamp `t = (f / totalFrames) * duration` produces identical visual output.
- **Defined Default Animation Behavior**: When `keyframes`, `tracks`, `entrance`, and `exit` are omitted on an element, the element remains static at its base transform and style across `[startTime, endTime]`. The renderer never invents unsolicited motion.

---

## 2. Top-Level Scene Object (`SceneSpec`)

```json
{
  "schemaVersion": "1.0",
  "id": "my-explainer-scene",
  "title": "Scene 01: How Compilers Optimize Loops",
  "description": "Optional scene description",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "duration": 6.0,
  "fonts": [
    { "family": "Inter", "weights": [400, 600, 700, 800] }
  ],
  "camera": {
    "x": 0,
    "y": 0,
    "zoom": 1.0,
    "rotation": 0,
    "tiltX": 0,
    "tiltY": 0,
    "keyframes": []
  },
  "background": {
    "color": "#0f172a",
    "gradient": {
      "type": "linear",
      "angle": 135,
      "stops": [
        { "offset": 0, "color": "#090d16" },
        { "offset": 1, "color": "#1e1b4b" }
      ]
    },
    "grid": {
      "enabled": true,
      "spacing": 60,
      "color": "#38bdf8",
      "opacity": 0.12,
      "majorEvery": 4,
      "isometric": false
    },
    "vignette": { "intensity": 0.35 },
    "shapes": []
  },
  "defs": {},
  "layers": []
}
```

### Coordinate Mapping
- Logical `width` and `height` default to `1920 × 1080`.
- If a scene specifies another logical coordinate space (e.g., `1280 × 720` or `3840 × 2160`), the renderer maps it predictably and proportionally to the `1920 × 1080` output canvas without distortion or unintended clipping.

---

## 3. Reusable Symbols (`defs` and `use`) & Circular-Reference Safety

Reusable component hierarchies can be declared once under `"defs"` and instantiated anywhere in the scene using `"type": "use"`:

```json
"defs": {
  "customNode": {
    "id": "customNode",
    "type": "group",
    "children": [
      { "id": "ring", "type": "circle", "radius": 28, "fill": "#0f172a", "stroke": "#38bdf8", "strokeWidth": 4 },
      { "id": "dot", "type": "circle", "radius": 10, "fill": "#38bdf8" }
    ]
  }
}
```

Instantiate with `"type": "use"` and optional child property `overrides`:

```json
{
  "id": "node-instance-1",
  "type": "use",
  "ref": "customNode",
  "x": 640,
  "y": 400,
  "scale": 1.2,
  "overrides": {
    "ring": { "stroke": "#f472b6" },
    "dot": { "fill": "#f472b6" }
  }
}
```

- **Circular Reference Detection**: The validator traverses the `defs` dependency graph before scene graph construction and rejects direct (`A -> A`) or indirect (`A -> B -> A`) symbol cycles with an explicit `CIRCULAR_DEF_REFERENCE` error.

---

## 4. Composable Visual Primitives (`SceneElement`)

| `type` | Required / Key Geometry Properties | Description |
| :--- | :--- | :--- |
| `"group"` | `children: SceneElement[]` | Nested transformation hierarchy (`x`, `y`, `rotation`, `scaleX`, `scaleY`, `pivotX`, `pivotY`, `opacity`, `clip`). |
| `"use"` | `ref: string`, `overrides?: object` | Instantiates a reusable group or primitive defined in `scene.defs[ref]`. |
| `"rect"` | `width: number`, `height: number`, `cornerRadius?: number \| [tl,tr,br,bl]`, `anchorX?: number`, `anchorY?: number` | Rectangle or rounded card. Supports `trimStart`/`trimEnd` perimeter stroke drawing. |
| `"circle"` | `radius: number`, `startAngle?: number`, `endAngle?: number` | Circle or circular arc segment. |
| `"ellipse"` | `rx: number`, `ry: number`, `startAngle?: number`, `endAngle?: number` | Ellipse or elliptical arc. |
| `"arc"` | `radius: number`, `innerRadius?: number`, `startAngle?: number`, `endAngle?: number` | Pie sector, ring segment, or radial gauge. |
| `"line"` | `x1: number`, `y1: number`, `x2: number`, `y2: number` | Straight line segment supporting `trimStart` and `trimEnd` animated drawing. |
| `"polyline"` | `points: [number, number][]`, `closed?: boolean`, `smooth?: boolean`, `tension?: number` | Multi-point line or cardinal-spline curve. |
| `"polygon"` | `points: [number, number][]` OR `sides: number, radius: number, innerRadius?: number` | Arbitrary closed polygon, regular polygon, or star/gear primitive. |
| `"path"` | `d: string` (SVG path `M,L,H,V,C,S,Q,Z`) OR `commands: PathCommandSpec[]`, `morphTo?: string` | Full Bézier vector path with animated `trimStart`/`trimEnd` line drawing and cubic-segment `morphTo` interpolation. |
| `"connector"` / `"arrow"` | `from: [x,y]`, `to: [x,y]`, `routing?: "straight" \| "curved" \| "orthogonal" \| "cubic"`, `startHead?`, `endHead?`, `label?`, `flowParticles?` | Flowchart/diagram connector with arrowheads (`arrow`, `dot`, `diamond`, `bar`), midpoint badge, and animated flow particles. |
| `"text"` | `text: string` (or `counter`), `fontSize`, `fontWeight`, `align`, `maxWidth`, `backgroundBox`, `reveal` | Crisp multi-line typography with character/word/line reveals and animated numeric counters. |
| `"callout"` | `width: number`, `height: number`, `text: string`, `subtext?`, `tailTarget?: [x,y]`, `badgeText?` | Speech bubble or annotation callout with pointer tail and optional status pill. |
| `"chart"` | `chartType: "bar" \| "horizontalBar" \| "line" \| "area" \| "donut" \| "scatter"`, `width`, `height`, `data` | Vector-rendered quantitative chart with `dataProgress` (`0..1`) animation. |

---

## 5. Styling, Clipping & Restrained 2.5D Depth

Every element supports:
- `fill`: CSS color (`"#38bdf8"`, `"rgba(15,23,42,0.8)"`, or `"none"`)
- `fillGradient` / `strokeGradient`: `{ "type": "linear" | "radial", "angle": 135, "stops": [{ "offset": 0, "color": "..." }, ...] }`
- `stroke`, `strokeWidth`, `strokeCap` (`"round" | "butt" | "square"`), `strokeJoin` (`"round" | "miter" | "bevel"`), `strokeDash` (`[10, 6]`), `strokeDashOffset`
- `trimStart` (`0..1`), `trimEnd` (`0..1`): Partial vector stroke drawing for lines, paths, circles, rects, polygons, and connectors.
- `shadow`: `{ "color": "rgba(0,0,0,0.4)", "blur": 16, "offsetX": 0, "offsetY": 8 }`
- `glow`: `{ "color": "#38bdf8", "strength": 18 }`
- `outline`: `{ "color": "#ffffff", "width": 3 }`
- `depth25d`: `{ "extrudeX": 10, "extrudeY": 12, "extrudeColor": "#064e3b", "tiltX": 12, "tiltY": -8, "elevation": 16 }`
- `clip`: `{ "type": "rect" | "circle" | "ellipse" | "polygon" | "path", ... }`

---

## 6. Deterministic Animation & Easing Specification

Animations can be specified via `keyframes` (pose-based), `tracks` (independent property timelines), and `entrance` / `exit` transitions:

```json
"keyframes": [
  { "time": 0.0, "x": 200, "y": 540, "opacity": 0, "scale": 0.8 },
  { "time": 0.8, "x": 450, "y": 540, "opacity": 1, "scale": 1.0, "easing": ["cubic-bezier", 0.22, 1, 0.36, 1] },
  { "time": 2.5, "x": 450, "y": 480, "rotation": 15, "easing": "spring" }
]
```

### Supported Easings
- Standard: `"linear"`, `"easeInQuad"`, `"easeOutQuad"`, `"easeInOutQuad"`, `"easeInCubic"`, `"easeOutCubic"`, `"easeInOutCubic"`, `"easeInQuart"`, `"easeOutQuart"`, `"easeInOutQuart"`
- Physics & Overshoot: `"easeInBack"`, `"easeOutBack"`, `"easeInOutBack"`, `"easeOutElastic"`, `"easeOutBounce"`, `"spring"`
- Custom Cubic Bézier: `["cubic-bezier", x1, y1, x2, y2]`
- Discrete Stepped: `"stepStart"`, `"stepEnd"`, `["steps", N]`
