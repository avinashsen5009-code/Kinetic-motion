# KineticJSON Studio — Blank Screen Fix & Mobile-First Transformation

Resolves the blank white screen issue on mobile and deployed preview URLs by replacing zero-dimension desktop-locked flex containers with safe dynamic viewport sizing (`100dvh`), an explicit mobile-compatible JSON editor surface, and a top-level runtime error boundary. Simultaneously transforms KineticJSON Studio into a responsive, touch-ergonomic **mobile-first** application with a 4-tab bottom navigation bar on mobile (`Stage`, `JSON Editor`, `Inspector`, `Export`), full multi-pane studio layout on desktop (`lg:`), a 16:9 / 9:16 (YouTube Shorts) aspect ratio toggle, quick-insert primitive chips, and touch sliders that directly update the underlying JSON specification.

## User Review & Critical Decisions

> [!IMPORTANT]
> All three mobile-first design and workflow decisions have been confirmed and incorporated into this plan:

- **Confirmed Decision 1 (Mobile Navigation Architecture)**: On smartphone and compact viewports (`< 1024px`), the interface uses a fixed **4-tab bottom navigation bar** (`Stage`, `JSON Editor`, `Inspector`, `Export`) within the natural thumb zone, while expanding cleanly to the full split-pane studio layout on desktop (`lg:`).
- **Confirmed Decision 2 (Canvas Aspect Ratio Support)**: Keeps **16:9 (1920×1080)** as the default standard YouTube format and adds a one-tap **9:16 (1080×1920 YouTube Shorts)** aspect ratio toggle that updates the logical canvas and video export resolution.
- **Confirmed Decision 3 (Mobile Touch Editing Helpers)**: Adds a horizontal **Quick-Insert Primitive Bar** (`+ Stick Figure`, `+ Shape`, `+ Text`, `+ Arrow`, `+ Counter`, `+ Keyframe`) and **Touch Property Sliders** (`X`, `Y`, `Scale`, `Rotation`, `Opacity`) that mutate and stay 100% synchronized with the raw JSON specification.

---

## 1. Overview & Core Concept

- **Root Cause & Fix for the Blank Screen**:
  1. **Viewport Collapse on Mobile**: Previously, the left JSON editor had a hardcoded width (`w-[480px]`) inside a non-wrapping horizontal flex container (`overflow-hidden`), pushing the entire right 16:9 canvas stage off-screen (`0px` width) on mobile devices and causing `ResizeObserver` to measure `0×0`.
  2. **Transparent Textarea Rendering Quirks**: Using `text-transparent` over a `<pre>` backdrop can render blank or misaligned on mobile WebKit/Blink viewports; we will provide a clean, high-contrast line-numbered editor mode with optional syntax preview so code is always 100% visible and editable on every mobile and desktop browser.
  3. **Production Server & Error Boundary Resilience**: We will add a top-level React Error Boundary with a one-tap `"Reset to Default Scene"` recovery action and configure a production `server.ts` static/SPA server so Cloud Run (`npm start`) serves the compiled bundle reliably.
- **Target Audience / Persona**: YouTube explainer creators, motion designers, and technical storytellers who want to author, tweak, preview, and export deterministic JSON-driven animations from either a smartphone or a desktop workstation.
- **Key Value**: Full creative control over primitive vector geometry and keyframe animations with zero fixed templates, accessible anywhere with one-handed mobile ergonomics and desktop studio power.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Stage & Playback Flow (Tab 1 — `Stage`)**: Users immediately see the responsive 16:9 (1920×1080) or 9:16 (1080×1920) canvas centered in the viewport, paired with touch-friendly transport controls (`Play/Pause`, frame-step, scrubber), sample scene switcher (`Scene 01`, `Scene 02`, `Scene 03`), and a quick **16:9 / 9:16** aspect toggle.
  2. **Touch-Assisted JSON Authoring Flow (Tab 2 — `JSON Editor`)**: Users can type or paste raw JSON, tap **Quick-Insert Primitive** buttons to append valid primitive JSON blocks (custom stick figure, rounded rect, curved arrow, text reveal, animated counter) directly into `elements`, and tap **Render Scene** to validate and preview.
  3. **Interactive Touch Inspector Flow (Tab 3 — `Inspector`)**: Users tap any node in the Scene Graph hierarchy to highlight it on the canvas and adjust its `x`, `y`, `scale`, `rotation`, and `opacity` using 44px-tall touch sliders that immediately write the updated coordinates back into the raw JSON string.
  4. **1080p Video & Project Export Flow (Tab 4 — `Export`)**: Users select container (`MP4 H.264` or `WebM VP9`), frame rate (`30 FPS` or `60 FPS`), and orientation (`1920×1080` or `1080×1920`), watch real-time frame encoding progress, and download the video clip or `.kinetic-project.json` file.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Precision dark-room motion graphics studio optimized for both outdoor mobile legibility and desktop focus.
  - *Color Palette & Mood*:
    - Dominant Canvas (60%): Deep Obsidian (`#090D16`) and Midnight Slate (`#0B101B`).
    - Structural Surfaces (30%): Elevated Slate (`#0F172A`) with `1px solid #1E293B` hairline dividers.
    - Accent Budget (10%): Electric Cyan (`#38BDF8`) for primary CTAs, active tabs, and timeline playheads; Emerald (`#22C55E`) for valid schema status; Amber (`#F59E0B`) and Crimson (`#EF4444`) paired with explicit text labels for diagnostics.
  - *Typography & Hierarchy*:
    - Display & Headings: `Outfit` (600–700 weight).
    - UI Controls & Prose: `Plus Jakarta Sans` (400–600 weight).
    - Code, Timecodes & Telemetry: `JetBrains Mono` with strict `font-variant-numeric: tabular-nums`.
  - *Touch Target & Sticky Cap Discipline*:
    - Every interactive button, tab item, scrubber handle, and list row enforces a minimum **`44×44px` touch hitbox** (`min-h-[44px] min-w-[44px]`).
    - Compact mobile top header (`48px`) + fixed bottom navigation bar (`56px`) respect the **15% mobile sticky cap**, leaving over 85% of the viewport open for the stage and editors.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Mobile-First Responsive Workspace with Desktop Expansion**
  - *Chosen Approach*: Single-active-pane view switched via a fixed 4-tab bottom bar on `< 1024px` viewports; full side-by-side split workspace (`JSON Editor + Touch Helpers` on left, `Stage + Timeline + Drawer` on right) on `lg:` (`>= 1024px`) viewports.
  - *Why*: Prevents horizontal flex overflow and 0px canvas collapse on phones while preserving simultaneous code-and-stage visibility on desktop monitors.
  - *Alternatives Considered*: Stacking all 4 panels vertically on a long scrolling mobile page was rejected because scrolling inside a multi-hundred-line JSON editor conflicts with page scrolling on touch devices.
- **Decision 2: Bidirectional Touch Sliders & Quick-Insert Primitives**
  - *Chosen Approach*: Touch sliders and quick-insert buttons mutate the parsed JSON AST and format it back into `rawJson` so the JSON specification remains the single source of truth.
  - *Why*: Respects the core architectural rule that the JSON is the complete creative specification—no hidden state outside the JSON.
- **Decision 3: Dual 16:9 (1920×1080) and 9:16 (1080×1920) Resolution Pipeline**
  - *Chosen Approach*: The renderer and video encoder dynamically read the target aspect mode (`1920×1080` default or `1080×1920` Shorts mode) from `scene.meta.width` / `scene.meta.height` and encode at the exact pixel dimensions.
  - *Why*: Allows creators to preview and export both standard horizontal YouTube explainers and vertical YouTube Shorts from the same composable primitive engine.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```
┌───────────────────────────────────────────────────────────────────────────┐
│                     Root Error Boundary & Safe Viewport                   │
├───────────────────────────────────────────────────────────────────────────┤
│  Top Bar Contract: Brand Wordmark  —  Navigation Links  —  Primary Action │
├───────────────────────────────────┬───────────────────────────────────────┤
│   Mobile View (< 1024px)          │   Desktop View (lg: >= 1024px)        │
│   Active Tab Content Area         │   Left Pane: JSON Editor & Helpers    │
│   ┌───────────────────────────┐   │   Right Pane: Stage + Scrubber        │
│   │ 1. Stage + Transport      │   │               + Bottom Inspector Tabs │
│   │ 2. JSON + Quick-Insert    │   └───────────────────────────────────────┘
│   │ 3. Inspector + Sliders    │                                           │
│   │ 4. 1080p Video Exporter   │                                           │
│   └───────────────────────────┘                                           │
│   Fixed Bottom 4-Tab Nav Bar                                              │
├───────────────────────────────────────────────────────────────────────────┤
│          Core Execution Engine (100% Deterministic & Template-Free)       │
│  ┌──────────────────┐  ┌────────────────────┐  ┌───────────────────────┐  │
│  │ Schema Validator │─▶│ Timeline Evaluator │─▶│ 2D Vector & 2.5D      │  │
│  │ (Line/Col Diag)  │  │ (Easings & Morphs) │  │ Canvas Renderer       │  │
│  └──────────────────┘  └────────────────────┘  └───────────┬───────────┘  │
│                                                            ▼              │
│                                                ┌───────────────────────┐  │
│                                                │ WebCodecs H.264 MP4 & │  │
│                                                │ MediaRecorder WebM    │  │
│                                                └───────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - **Aspect Ratio Switcher (`16:9` vs `9:16`)**: Updates `meta.width` and `meta.height` in `rawJson` (`1920×1080` or `1080×1920`), re-validates the scene, and adjusts the responsive stage aspect container and video exporter dimensions.
  - **Quick-Insert Primitive Bar**: Appends a clean, self-contained JSON primitive node (`Stick Figure Group`, `Rounded Rect`, `Curved Arrow`, `Kinetic Text`, `Animated Counter`) into the `elements` array of `rawJson`, triggers immediate validation/rendering, and selects the newly inserted element.
  - **Inspector Touch Sliders**: Selecting any element in the Scene Graph exposes touch sliders for `x`, `y`, `scale`, `rotation`, and `opacity` (plus keyframe track timing), updating the corresponding node in `rawJson` and re-rendering the canvas in real time.
  - **Cloud Run Production Server (`server.ts`)**: Express server configured on port `3000` serving Vite middleware in development and the compiled `dist/` bundle in production so shared/deployed URLs never render a blank page.
