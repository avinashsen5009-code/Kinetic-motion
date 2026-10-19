# MotionJSON Studio — JSON-Driven Motion Graphics Scene Renderer for YouTube

A deterministic, composable vector motion-graphics engine and web studio built with **React** and **TypeScript**. Converts user-authored JSON scene specifications (`schemaVersion: "1.0"`) into animated **1920 × 1080 (16:9)** motion-graphics scenes and exports playable **WebM** and **MP4 (H.264)** video clips.

---

## 1. Architecture Overview

The application is cleanly separated into 9 deterministic subsystems:

1. **JSON Parsing & Schema Validation (`src/engine/validator.ts`)**
   - Reports exact 1-based line and column locations for JSON syntax errors.
   - Validates scene dimensions, frame rate (`30` or `60` FPS), duration, primitive geometry fields, keyframe timestamps, and easing curves.
   - Emits explicit `UNKNOWN_*_PROPERTY` warnings with line numbers whenever unsupported properties appear.
   - Performs depth-first cycle detection across reusable `defs` and `use` symbol references (`CIRCULAR_DEF_REFERENCE`).
2. **Scene Graph Construction (`src/engine/sceneGraph.ts`)**
   - Resolves `defs` / `use` symbol instances with deep per-child property overrides (`overrides`) and z-index layer sorting.
3. **Geometry & Vector Rendering (`src/engine/renderer.ts`)**
   - Anti-aliased Canvas 2D vector primitives: `rect`, `circle`, `ellipse`, `arc`, `line`, `polyline` (with cardinal spline smoothing), `polygon` (including regular polygons and star/gear primitives), `path` (full SVG `M,L,H,V,C,S,Q,Z` cubic/quadratic normalization), `connector` / `arrow` (straight, curved, orthogonal, cubic routing with arrowheads and live flow particles), and `chart` (`bar`, `horizontalBar`, `line`, `area`, `donut`, `scatter`).
   - Supports `trimStart` and `trimEnd` (`0..1`) partial path drawing and cubic Bézier shape morphing (`morphTo` + `morphProgress`).
   - Supports restrained 2.5D depth extrusion (`depth25d: { extrudeX, extrudeY, extrudeColor, tiltX, tiltY, elevation }`) and clipping masks (`clip`).
4. **Typography & Text Layout (`src/engine/renderer.ts`)**
   - Multi-line and word-wrapped typography (`maxWidth`), alignment (`left`, `center`, `right`, `top`, `middle`, `bottom`), background pills (`backgroundBox`), character/word/line/typewriter `reveal` animations, and animated numeric `counter` displays.
5. **Transformation & Grouping Hierarchy (`src/engine/renderer.ts`)**
   - Full nested `group` affine transformations (`x`, `y`, `z`, `pivotX`, `pivotY`, `scale`, `scaleX`, `scaleY`, `rotation`, `skewX`, `skewY`, multiplicative `opacity`).
6. **Deterministic Animation Timeline (`src/engine/timeline.ts`)**
   - Frame-accurate state evaluation `computeElementStateAtTime(el, t, duration)` with Newton-Raphson `cubic-bezier(x1, y1, x2, y2)` solver, analytical `spring`, `steps(N)`, and standard easings.
   - When animation properties are omitted, elements remain completely static at their base transform and style.
7. **Interactive 16:9 Preview Studio (`src/App.tsx`)**
   - Logical coordinate space mapped proportionally to a fixed `1920 × 1080` (16:9) stage with `Fit` and `Zoom` controls, coordinate grid overlay, broadcast safe-area guides (`90%` / `80%`), frame-by-frame stepping, and a live Scene Graph Inspector.
8. **Video Frame Rendering & Encoding (`src/engine/videoExporter.ts` & `scripts/render_scene_video.py`)**
   - In-browser `1920 × 1080` video export (`WebM` VP9/VP8 and `MP4` H.264 where supported by browser `MediaRecorder`) at configurable `30 FPS` or `60 FPS`.
   - Local headless Chromium + FFmpeg CLI script (`scripts/render_scene_video.py`) for lossless frame-accurate `H.264 yuv420p` MP4 encoding.
9. **Project Import & Export (`src/engine/videoExporter.ts`)**
   - Saves and reopens `.mgscene.json` project files (preserving raw JSON, resolution, FPS, export settings, font requirements, and schema/renderer versions) as well as standalone `.json` scene files.

---

## 2. Local Setup & Running Instructions

### Option A: Standard Vite + React + TypeScript Development Server

```bash
# 1. Install dependencies (React 18, Lucide Icons, Tailwind CSS, Vite, TypeScript)
npm install

# 2. Start the local studio server
npm run dev
```

### Option B: Deterministic Offline 1080p MP4 Video Rendering via CLI (Headless Chromium + FFmpeg)

When browser-only `MediaRecorder` export is constrained by real-time capture pacing or browser codec support, run the included deterministic frame-by-frame CLI renderer:

```bash
python3 scripts/render_scene_video.py \
  --input src/samples/scene1_stick_explainer.json \
  --output scene1_1080p.mp4 \
  --fps 30
```

---

## 3. Sample Pure-Primitive Scenes Included

- `src/samples/scene1_stick_explainer.json` — **How Gradient Descent Tunes a Network** (Articulated stick figure constructed from primitives, reusable neuron symbols, synapse connectors, and live bar chart).
- `src/samples/scene2_cloud_architecture.json` — **Global Zero-Trust Edge Mesh & Replication** (Isometric grid, 2.5D extruded server nodes, orthogonal connectors, and radial SLA gauges).
- `src/samples/scene3_renewable_telemetry.json` — **Grid-Scale Solar & Offshore Wind Surge** (Rotating vector wind turbine blades, multi-year area chart, donut chart, and live GW counter).
- `src/samples/scene4_kinetic_morph.json` — **Vector Path Morphing & 2.5D Kinetic Opener** (60 FPS SVG cubic-bezier path morphing, concentric trim-path rings, and kinetic typography).
