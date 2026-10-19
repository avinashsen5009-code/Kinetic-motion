import { SceneSpecification } from '../types/scene';

export interface SampleSceneEntry {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  spec: SceneSpecification;
}

/**
 * Sample Scene 1: Articulated Vector Character & System Architecture Explainer
 * Demonstrates:
 * - Custom stick figure constructed purely from primitive geometry (circles, lines, paths, nested hierarchical limb joints).
 * - Reusable symbol definitions (`defs` + `use` with overrides) for server nodes.
 * - Animated connectors with arrowheads (`drawProgress` + `endMarker: "arrow"`).
 * - Character-by-character kinetic typography and animated numeric counter.
 */
export const SAMPLE_CHARACTER_EXPLAINER: SceneSpecification = {
  schemaVersion: '1.0',
  meta: {
    title: 'Zero-Trust Edge Gateway Explainer',
    description:
      'Constructs an articulated presenter character from raw primitives alongside a multi-node cloud architecture diagram.',
    author: 'KineticJSON Studio',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 6,
  },
  background: {
    gradient: {
      type: 'linear',
      angle: 135,
      stops: [
        { offset: 0, color: '#090D16' },
        { offset: 0.55, color: '#0F172A' },
        { offset: 1, color: '#131C31' },
      ],
    },
    grid: {
      enabled: true,
      spacing: 60,
      color: '#334155',
      opacity: 0.16,
      majorEvery: 4,
    },
    vignette: {
      enabled: true,
      color: 'rgba(5, 8, 17, 0.55)',
      intensity: 0.5,
    },
  },
  transitions: {
    in: { type: 'fade', duration: 0.35, color: '#090D16' },
    out: { type: 'fade', duration: 0.4, color: '#090D16' },
  },
  defs: {
    serviceNode: {
      id: 'serviceNodeRoot',
      type: 'group',
      children: [
        {
          id: 'nodeCard',
          type: 'rect',
          width: 280,
          height: 116,
          anchorX: 0.5,
          anchorY: 0.5,
          rx: 14,
          fill: '#1E293B',
          stroke: '#38BDF8',
          strokeWidth: 2.5,
          extrude25D: {
            depthX: 0,
            depthY: 8,
            color: '#090D16',
            steps: 8,
          },
          shadow: {
            color: 'rgba(15, 23, 42, 0.65)',
            blur: 20,
            offsetY: 10,
          },
        },
        {
          id: 'nodeStatusRing',
          type: 'circle',
          x: -102,
          y: 0,
          r: 18,
          fill: 'rgba(56, 189, 248, 0.14)',
          stroke: '#38BDF8',
          strokeWidth: 2.5,
        },
        {
          id: 'nodeStatusCore',
          type: 'circle',
          x: -102,
          y: 0,
          r: 7,
          fill: '#38BDF8',
        },
        {
          id: 'nodeTitle',
          type: 'text',
          x: -66,
          y: -14,
          text: 'EDGE WORKER',
          fontFamily: 'Outfit',
          fontSize: 22,
          fontWeight: 700,
          fill: '#F8FAFC',
          verticalAlign: 'middle',
        },
        {
          id: 'nodeSub',
          type: 'text',
          x: -66,
          y: 18,
          text: 'TLS 1.3 Verified',
          fontFamily: 'JetBrains Mono',
          fontSize: 15,
          fontWeight: 500,
          fill: '#94A3B8',
          verticalAlign: 'middle',
        },
      ],
    },
  },
  elements: [
    // Header Section
    {
      id: 'headerGroup',
      type: 'group',
      x: 120,
      y: 88,
      children: [
        {
          id: 'kickerLine',
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 68,
          y2: 0,
          stroke: '#38BDF8',
          strokeWidth: 4,
          animations: [
            { property: 'drawProgress', from: 0, to: 1, start: 0.1, duration: 0.5, easing: 'easeOutCubic' },
          ],
        },
        {
          id: 'kickerLabel',
          type: 'text',
          x: 84,
          y: 0,
          text: 'SYSTEM ARCHITECTURE EXPLAINER · SCENE 01',
          fontFamily: 'JetBrains Mono',
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: 1.5,
          fill: '#38BDF8',
          verticalAlign: 'middle',
          animations: [
            { property: 'opacity', from: 0, to: 1, start: 0.2, duration: 0.5, easing: 'easeOutQuad' },
          ],
        },
        {
          id: 'mainHeadline',
          type: 'text',
          x: 0,
          y: 34,
          text: 'How Zero-Trust Request Routing Works',
          fontFamily: 'Outfit',
          fontSize: 54,
          fontWeight: 700,
          fill: '#F8FAFC',
          animations: [
            { property: 'textReveal', from: 0, to: 1, start: 0.25, duration: 1.1, easing: 'easeOutCubic' },
          ],
        },
      ],
    },

    // Floor Baseline
    {
      id: 'stageFloorLine',
      type: 'line',
      x: 120,
      y: 910,
      x1: 0,
      y1: 0,
      x2: 1680,
      y2: 0,
      stroke: '#334155',
      strokeWidth: 2,
      animations: [
        { property: 'drawProgress', from: 0, to: 1, start: 0.1, duration: 0.9, easing: 'easeInOutCubic' },
      ],
    },

    // Articulated Stick-Figure Presenter (Constructed 100% from primitive geometry & nested transforms)
    {
      id: 'characterPresenter',
      name: 'Articulated Stick Figure',
      type: 'group',
      x: 340,
      y: 660,
      animations: [
        { property: 'x', from: 210, to: 340, start: 0.2, duration: 1.0, easing: 'easeOutBack' },
        { property: 'opacity', from: 0, to: 1, start: 0.15, duration: 0.5, easing: 'easeOutQuad' },
      ],
      children: [
        // Ground shadow ellipse
        {
          id: 'charShadow',
          type: 'ellipse',
          x: 0,
          y: 250,
          rx: 68,
          ry: 14,
          fill: 'rgba(2, 6, 23, 0.65)',
          animations: [
            { property: 'scaleX', from: 0.5, to: 1, start: 0.2, duration: 1.0, easing: 'easeOutBack' },
          ],
        },
        // Left Leg
        {
          id: 'leftLeg',
          type: 'polyline',
          points: [
            [0, 80],
            [-28, 165],
            [-36, 246],
            [-54, 246],
          ],
          stroke: '#E2E8F0',
          strokeWidth: 10,
          lineCap: 'round',
          lineJoin: 'round',
        },
        // Right Leg
        {
          id: 'rightLeg',
          type: 'polyline',
          points: [
            [0, 80],
            [28, 165],
            [36, 246],
            [56, 246],
          ],
          stroke: '#E2E8F0',
          strokeWidth: 10,
          lineCap: 'round',
          lineJoin: 'round',
        },
        // Torso Spine
        {
          id: 'torsoSpine',
          type: 'line',
          x1: 0,
          y1: -65,
          x2: 0,
          y2: 80,
          stroke: '#F8FAFC',
          strokeWidth: 12,
          lineCap: 'round',
        },
        // Collar Accent Path
        {
          id: 'collarTie',
          type: 'polygon',
          points: [
            [-12, -56],
            [12, -56],
            [6, 14],
            [0, 26],
            [-6, 14],
          ],
          fill: '#38BDF8',
        },
        // Left Arm (resting on hip)
        {
          id: 'leftArm',
          type: 'polyline',
          points: [
            [0, -52],
            [-46, 0],
            [-18, 52],
          ],
          stroke: '#CBD5E1',
          strokeWidth: 9,
          lineCap: 'round',
          lineJoin: 'round',
        },
        // Right Arm Hierarchy (Shoulder -> Elbow -> Pointer Wand)
        {
          id: 'rightShoulderGroup',
          type: 'group',
          x: 4,
          y: -52,
          rotation: 25,
          animations: [
            { property: 'rotation', from: 38, to: -26, start: 0.7, duration: 0.9, easing: 'easeOutBack' },
            { property: 'rotation', from: -26, to: -42, start: 2.3, duration: 0.8, easing: 'easeInOutCubic' },
            { property: 'rotation', from: -42, to: -18, start: 3.7, duration: 0.8, easing: 'easeInOutCubic' },
          ],
          children: [
            {
              id: 'upperRightArm',
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 68,
              y2: 12,
              stroke: '#F8FAFC',
              strokeWidth: 9,
              lineCap: 'round',
            },
            {
              id: 'rightForearmGroup',
              type: 'group',
              x: 68,
              y: 12,
              rotation: -15,
              animations: [
                { property: 'rotation', from: 10, to: -28, start: 0.8, duration: 0.8, easing: 'easeOutCubic' },
                { property: 'rotation', from: -28, to: -8, start: 2.3, duration: 0.8, easing: 'easeInOutCubic' },
              ],
              children: [
                {
                  id: 'forearmLine',
                  type: 'line',
                  x1: 0,
                  y1: 0,
                  x2: 64,
                  y2: -18,
                  stroke: '#F8FAFC',
                  strokeWidth: 8,
                  lineCap: 'round',
                },
                {
                  id: 'handCircle',
                  type: 'circle',
                  x: 66,
                  y: -18,
                  r: 8,
                  fill: '#38BDF8',
                },
                // Laser Pointer Wand
                {
                  id: 'pointerWand',
                  type: 'line',
                  x1: 66,
                  y1: -18,
                  x2: 135,
                  y2: -48,
                  stroke: '#F43F5E',
                  strokeWidth: 4,
                  animations: [
                    { property: 'drawProgress', from: 0, to: 1, start: 1.1, duration: 0.4, easing: 'easeOutQuad' },
                  ],
                },
              ],
            },
          ],
        },
        // Head Group
        {
          id: 'headGroup',
          type: 'group',
          x: 0,
          y: -116,
          animations: [
            { property: 'rotation', from: -8, to: 5, start: 0.8, duration: 1.2, easing: 'easeInOutQuad' },
            { property: 'rotation', from: 5, to: 0, start: 2.4, duration: 1.0, easing: 'easeInOutQuad' },
          ],
          children: [
            {
              id: 'headCircle',
              type: 'circle',
              r: 40,
              fill: '#0F172A',
              stroke: '#F8FAFC',
              strokeWidth: 8,
            },
            // Eyes
            {
              id: 'eyeLeft',
              type: 'circle',
              x: 6,
              y: -8,
              r: 4.5,
              fill: '#38BDF8',
            },
            {
              id: 'eyeRight',
              type: 'circle',
              x: 24,
              y: -8,
              r: 4.5,
              fill: '#38BDF8',
            },
            // Expressive Smile Path
            {
              id: 'smilePath',
              type: 'path',
              d: 'M 4 10 Q 16 22 26 8',
              stroke: '#F8FAFC',
              strokeWidth: 4,
              lineCap: 'round',
            },
          ],
        },
        // Character Caption Tag
        {
          id: 'presenterLabel',
          type: 'text',
          x: 0,
          y: 282,
          text: 'CLIENT REQUEST ORIGIN',
          fontFamily: 'JetBrains Mono',
          fontSize: 15,
          fontWeight: 600,
          textAlign: 'center',
          fill: '#94A3B8',
        },
      ],
    },

    // Central Gateway Shield Hub
    {
      id: 'gatewayHubGroup',
      type: 'group',
      x: 920,
      y: 540,
      scale: 0,
      animations: [
        { property: 'scale', from: 0, to: 1, start: 1.0, duration: 0.75, easing: 'easeOutBack' },
      ],
      children: [
        {
          id: 'gatewayOuterHalo',
          type: 'circle',
          r: 122,
          fill: 'rgba(56, 189, 248, 0.06)',
          stroke: '#1E293B',
          strokeWidth: 2,
        },
        {
          id: 'gatewayOrbitArc',
          type: 'arc',
          r: 106,
          startAngle: -90,
          endAngle: 230,
          stroke: '#38BDF8',
          strokeWidth: 4,
          strokeDash: [12, 8],
          animations: [
            { property: 'rotation', from: 0, to: 180, start: 1.0, duration: 5.0, easing: 'linear' },
          ],
        },
        {
          id: 'gatewayHexShield',
          type: 'polygon',
          points: [
            [0, -82],
            [72, -41],
            [72, 41],
            [0, 82],
            [-72, 41],
            [-72, -41],
          ],
          fill: '#0F172A',
          stroke: '#38BDF8',
          strokeWidth: 4,
          extrude25D: {
            depthX: 0,
            depthY: 10,
            color: '#0284C7',
            steps: 10,
          },
        },
        // Morphing Lock-to-Checkmark Vector Path inside Shield
        {
          id: 'gatewayCheckPath',
          type: 'path',
          d: 'M -26 4 L -6 24 L 30 -16',
          stroke: '#22C55E',
          strokeWidth: 7,
          lineCap: 'round',
          lineJoin: 'round',
          drawProgress: 0,
          animations: [
            { property: 'drawProgress', from: 0, to: 1, start: 1.65, duration: 0.55, easing: 'easeOutCubic' },
          ],
        },
        {
          id: 'gatewayLabel',
          type: 'text',
          x: 0,
          y: 148,
          text: 'AUTH POLICY ENGINE',
          fontFamily: 'Outfit',
          fontSize: 20,
          fontWeight: 700,
          textAlign: 'center',
          fill: '#F8FAFC',
        },
      ],
    },

    // Animated Vector Connector: Presenter -> Gateway
    {
      id: 'connOriginToGateway',
      type: 'line',
      x1: 510,
      y1: 540,
      x2: 780,
      y2: 540,
      curveOffset: -45,
      stroke: '#38BDF8',
      strokeWidth: 4,
      startMarker: 'circle',
      endMarker: 'arrow',
      drawProgress: 0,
      animations: [
        { property: 'drawProgress', from: 0, to: 1, start: 1.3, duration: 0.65, easing: 'easeInOutCubic' },
      ],
    },
    {
      id: 'packetBadge1',
      type: 'text',
      x: 645,
      y: 482,
      text: 'JWT + mTLS Handshake',
      fontFamily: 'JetBrains Mono',
      fontSize: 15,
      fontWeight: 600,
      textAlign: 'center',
      fill: '#38BDF8',
      opacity: 0,
      animations: [
        { property: 'opacity', from: 0, to: 1, start: 1.5, duration: 0.4, easing: 'easeOutQuad' },
      ],
    },

    // 3 Downstream Microservice Nodes instantiated from `defs.serviceNode` via `use`
    {
      id: 'serviceInstanceTop',
      type: 'use',
      ref: 'serviceNode',
      x: 1520,
      y: 330,
      opacity: 0,
      overrides: {
        nodeTitle: { text: 'IDENTITY VAULT' },
        nodeSub: { text: 'latency: 4.2 ms' },
        nodeCard: { stroke: '#38BDF8' },
      },
      animations: [
        { property: 'opacity', from: 0, to: 1, start: 2.2, duration: 0.45, easing: 'easeOutQuad' },
        { property: 'x', from: 1580, to: 1520, start: 2.2, duration: 0.55, easing: 'easeOutBack' },
      ],
    },
    {
      id: 'serviceInstanceMid',
      type: 'use',
      ref: 'serviceNode',
      x: 1520,
      y: 540,
      opacity: 0,
      overrides: {
        nodeTitle: { text: 'BILLING LEDGER' },
        nodeSub: { text: 'AES-256 Enclave' },
        nodeCard: { stroke: '#22C55E' },
        nodeStatusRing: { stroke: '#22C55E', fill: 'rgba(34, 197, 94, 0.15)' },
        nodeStatusCore: { fill: '#22C55E' },
      },
      animations: [
        { property: 'opacity', from: 0, to: 1, start: 2.5, duration: 0.45, easing: 'easeOutQuad' },
        { property: 'x', from: 1580, to: 1520, start: 2.5, duration: 0.55, easing: 'easeOutBack' },
      ],
    },
    {
      id: 'serviceInstanceBot',
      type: 'use',
      ref: 'serviceNode',
      x: 1520,
      y: 750,
      opacity: 0,
      overrides: {
        nodeTitle: { text: 'AUDIT STREAM' },
        nodeSub: { text: 'Immutable Log' },
        nodeCard: { stroke: '#A855F7' },
        nodeStatusRing: { stroke: '#A855F7', fill: 'rgba(168, 85, 247, 0.15)' },
        nodeStatusCore: { fill: '#A855F7' },
      },
      animations: [
        { property: 'opacity', from: 0, to: 1, start: 2.8, duration: 0.45, easing: 'easeOutQuad' },
        { property: 'x', from: 1580, to: 1520, start: 2.8, duration: 0.55, easing: 'easeOutBack' },
      ],
    },

    // Connectors from Gateway to Downstream Services
    {
      id: 'routeTop',
      type: 'line',
      x1: 1055,
      y1: 495,
      x2: 1360,
      y2: 330,
      curveOffset: -35,
      stroke: '#38BDF8',
      strokeWidth: 3.5,
      endMarker: 'arrow',
      drawProgress: 0,
      animations: [
        { property: 'drawProgress', from: 0, to: 1, start: 2.35, duration: 0.55, easing: 'easeOutCubic' },
      ],
    },
    {
      id: 'routeMid',
      type: 'line',
      x1: 1065,
      y1: 540,
      x2: 1360,
      y2: 540,
      stroke: '#22C55E',
      strokeWidth: 3.5,
      endMarker: 'arrow',
      drawProgress: 0,
      animations: [
        { property: 'drawProgress', from: 0, to: 1, start: 2.65, duration: 0.55, easing: 'easeOutCubic' },
      ],
    },
    {
      id: 'routeBot',
      type: 'line',
      x1: 1055,
      y1: 585,
      x2: 1360,
      y2: 750,
      curveOffset: 35,
      stroke: '#A855F7',
      strokeWidth: 3.5,
      endMarker: 'arrow',
      drawProgress: 0,
      animations: [
        { property: 'drawProgress', from: 0, to: 1, start: 2.95, duration: 0.55, easing: 'easeOutCubic' },
      ],
    },

    // Bottom Throughput Telemetry Callout Card
    {
      id: 'throughputCallout',
      type: 'group',
      x: 920,
      y: 835,
      opacity: 0,
      animations: [
        { property: 'opacity', from: 0, to: 1, start: 3.2, duration: 0.5, easing: 'easeOutQuad' },
        { property: 'y', from: 865, to: 835, start: 3.2, duration: 0.5, easing: 'easeOutCubic' },
      ],
      children: [
        {
          id: 'calloutBg',
          type: 'rect',
          width: 440,
          height: 86,
          anchorX: 0.5,
          anchorY: 0.5,
          rx: 12,
          fill: 'rgba(15, 23, 42, 0.92)',
          stroke: '#334155',
          strokeWidth: 2,
        },
        {
          id: 'counterMetric',
          type: 'counter',
          x: -185,
          y: 0,
          value: 0,
          decimals: 1,
          suffix: '%',
          fontFamily: 'JetBrains Mono',
          fontSize: 36,
          fontWeight: 700,
          fill: '#22C55E',
          verticalAlign: 'middle',
          animations: [
            { property: 'value', from: 0, to: 99.9, start: 3.3, duration: 1.5, easing: 'easeOutQuart' },
          ],
        },
        {
          id: 'calloutDesc',
          type: 'text',
          x: -35,
          y: 0,
          text: 'VERIFIED PACKET INTEGRITY\nSub-5ms Edge Inspection',
          fontFamily: 'Plus Jakarta Sans',
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1.35,
          fill: '#E2E8F0',
          verticalAlign: 'middle',
        },
      ],
    },
  ],
};

/**
 * Sample Scene 2: Quantitative Data Analytics & Multi-Chart Motion Composition
 * Demonstrates a completely different visual composition:
 * - Animated multi-bar comparative chart with 2.5D extrusion.
 * - Radial donut gauge (`arc` with `innerRadius` and `drawProgress`).
 * - Polyline trend curve with animated stroke reveal.
 * - Animated tabular counters and callout annotations.
 */
export const SAMPLE_DATA_VISUALIZATION: SceneSpecification = {
  schemaVersion: '1.0',
  meta: {
    title: 'AI Inference Efficiency Benchmark',
    description:
      'Quantitative motion graphics scene featuring animated bar charts, a radial efficiency ring, and live counters.',
    author: 'KineticJSON Studio',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5.5,
  },
  background: {
    gradient: {
      type: 'linear',
      angle: 160,
      stops: [
        { offset: 0, color: '#080C14' },
        { offset: 1, color: '#111827' },
      ],
    },
    grid: {
      enabled: true,
      spacing: 80,
      color: '#1E293B',
      opacity: 0.25,
      majorEvery: 3,
    },
  },
  transitions: {
    in: { type: 'wipeRight', duration: 0.4, color: '#080C14' },
    out: { type: 'fade', duration: 0.35, color: '#080C14' },
  },
  elements: [
    // Title Block
    {
      id: 'chartHeader',
      type: 'group',
      x: 130,
      y: 95,
      children: [
        {
          id: 'tagLine',
          type: 'text',
          x: 0,
          y: 0,
          text: 'BENCHMARK REPORT · Q4 INFRASTRUCTURE TELEMETRY',
          fontFamily: 'JetBrains Mono',
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: 1.4,
          fill: '#F59E0B',
          animations: [
            { property: 'opacity', from: 0, to: 1, start: 0.1, duration: 0.4, easing: 'easeOutQuad' },
          ],
        },
        {
          id: 'chartMainTitle',
          type: 'text',
          x: 0,
          y: 32,
          text: 'Tokens Per Second vs. Memory Footprint',
          fontFamily: 'Outfit',
          fontSize: 52,
          fontWeight: 700,
          fill: '#F8FAFC',
          animations: [
            { property: 'textReveal', from: 0, to: 1, start: 0.2, duration: 0.9, easing: 'easeOutCubic' },
          ],
        },
      ],
    },

    // Left Panel: Bar & Trend Chart Coordinate Frame
    {
      id: 'chartPlotGroup',
      type: 'group',
      x: 130,
      y: 260,
      children: [
        {
          id: 'plotBackGrid',
          type: 'grid',
          width: 1020,
          height: 620,
          cellWidth: 170,
          cellHeight: 124,
          stroke: 'rgba(148, 163, 184, 0.16)',
          strokeWidth: 1.5,
          animations: [
            { property: 'drawProgress', from: 0, to: 1, start: 0.2, duration: 0.8, easing: 'easeOutCubic' },
          ],
        },
        // Y-Axis & X-Axis Lines
        {
          id: 'axesPath',
          type: 'polyline',
          points: [
            [0, 0],
            [0, 620],
            [1020, 620],
          ],
          stroke: '#64748B',
          strokeWidth: 3,
          animations: [
            { property: 'drawProgress', from: 0, to: 1, start: 0.3, duration: 0.7, easing: 'easeOutQuart' },
          ],
        },

        // Bar 1: FP32 Baseline
        {
          id: 'barFP32',
          type: 'rect',
          x: 110,
          y: 620,
          width: 120,
          height: 0,
          anchorX: 0,
          anchorY: 1,
          rx: 8,
          fill: '#475569',
          extrude25D: { depthX: 10, depthY: -6, color: '#1E293B', steps: 8 },
          animations: [
            { property: 'height', from: 0, to: 185, start: 0.6, duration: 0.85, easing: 'easeOutBack' },
          ],
        },
        {
          id: 'labelFP32',
          type: 'text',
          x: 170,
          y: 645,
          text: 'FP32 Base',
          fontFamily: 'JetBrains Mono',
          fontSize: 16,
          fontWeight: 600,
          textAlign: 'center',
          fill: '#94A3B8',
        },

        // Bar 2: BF16 Tensor
        {
          id: 'barBF16',
          type: 'rect',
          x: 350,
          y: 620,
          width: 120,
          height: 0,
          anchorX: 0,
          anchorY: 1,
          rx: 8,
          fill: '#0284C7',
          extrude25D: { depthX: 10, depthY: -6, color: '#0369A1', steps: 8 },
          animations: [
            { property: 'height', from: 0, to: 320, start: 0.8, duration: 0.85, easing: 'easeOutBack' },
          ],
        },
        {
          id: 'labelBF16',
          type: 'text',
          x: 410,
          y: 645,
          text: 'BF16 Flash',
          fontFamily: 'JetBrains Mono',
          fontSize: 16,
          fontWeight: 600,
          textAlign: 'center',
          fill: '#CBD5E1',
        },

        // Bar 3: INT8 Quantized
        {
          id: 'barINT8',
          type: 'rect',
          x: 590,
          y: 620,
          width: 120,
          height: 0,
          anchorX: 0,
          anchorY: 1,
          rx: 8,
          fill: '#38BDF8',
          extrude25D: { depthX: 10, depthY: -6, color: '#0284C7', steps: 8 },
          animations: [
            { property: 'height', from: 0, to: 445, start: 1.0, duration: 0.85, easing: 'easeOutBack' },
          ],
        },
        {
          id: 'labelINT8',
          type: 'text',
          x: 650,
          y: 645,
          text: 'INT8 fused',
          fontFamily: 'JetBrains Mono',
          fontSize: 16,
          fontWeight: 600,
          textAlign: 'center',
          fill: '#CBD5E1',
        },

        // Bar 4: FP4 Speculative
        {
          id: 'barFP4',
          type: 'rect',
          x: 830,
          y: 620,
          width: 120,
          height: 0,
          anchorX: 0,
          anchorY: 1,
          rx: 8,
          fill: {
            type: 'linear',
            angle: 180,
            stops: [
              { offset: 0, color: '#34D399' },
              { offset: 1, color: '#059669' },
            ],
          },
          extrude25D: { depthX: 10, depthY: -6, color: '#065F46', steps: 8 },
          animations: [
            { property: 'height', from: 0, to: 555, start: 1.2, duration: 0.95, easing: 'easeOutBack' },
          ],
        },
        {
          id: 'labelFP4',
          type: 'text',
          x: 890,
          y: 645,
          text: 'FP4 Kernel',
          fontFamily: 'JetBrains Mono',
          fontSize: 16,
          fontWeight: 700,
          textAlign: 'center',
          fill: '#34D399',
        },

        // Overlay Trend Curve
        {
          id: 'efficiencyTrendCurve',
          type: 'path',
          d: 'M 170 410 C 290 380 330 280 410 270 C 510 255 560 170 650 145 C 740 120 810 65 890 42',
          stroke: '#F59E0B',
          strokeWidth: 5,
          drawProgress: 0,
          animations: [
            { property: 'drawProgress', from: 0, to: 1, start: 1.8, duration: 1.1, easing: 'easeInOutCubic' },
          ],
        },
        // Peak Callout Marker
        {
          id: 'peakNodeCircle',
          type: 'circle',
          x: 890,
          y: 42,
          r: 10,
          fill: '#F59E0B',
          stroke: '#080C14',
          strokeWidth: 4,
          scale: 0,
          animations: [
            { property: 'scale', from: 0, to: 1, start: 2.8, duration: 0.4, easing: 'easeOutBack' },
          ],
        },
      ],
    },

    // Right Panel: Radial Donut Gauge & Key Metrics
    {
      id: 'radialPanelGroup',
      type: 'group',
      x: 1520,
      y: 540,
      opacity: 0,
      animations: [
        { property: 'opacity', from: 0, to: 1, start: 1.4, duration: 0.6, easing: 'easeOutQuad' },
      ],
      children: [
        {
          id: 'panelContainer',
          type: 'rect',
          width: 560,
          height: 620,
          anchorX: 0.5,
          anchorY: 0.5,
          rx: 20,
          fill: 'rgba(30, 41, 59, 0.55)',
          stroke: '#334155',
          strokeWidth: 2,
        },
        {
          id: 'gaugeTrackRing',
          type: 'arc',
          x: 0,
          y: -75,
          r: 155,
          innerRadius: 118,
          startAngle: -210,
          endAngle: 30,
          fill: '#1E293B',
        },
        {
          id: 'gaugeActiveArc',
          type: 'arc',
          x: 0,
          y: -75,
          r: 155,
          innerRadius: 118,
          startAngle: -210,
          endAngle: 12,
          fill: {
            type: 'linear',
            angle: 90,
            stops: [
              { offset: 0, color: '#38BDF8' },
              { offset: 1, color: '#34D399' },
            ],
          },
          drawProgress: 0,
          animations: [
            { property: 'drawProgress', from: 0, to: 1, start: 1.6, duration: 1.4, easing: 'easeOutQuart' },
          ],
        },
        {
          id: 'speedupCounter',
          type: 'counter',
          x: 0,
          y: -85,
          value: 1.0,
          decimals: 1,
          suffix: 'x',
          fontFamily: 'Outfit',
          fontSize: 64,
          fontWeight: 800,
          textAlign: 'center',
          verticalAlign: 'middle',
          fill: '#F8FAFC',
          animations: [
            { property: 'value', from: 1.0, to: 3.4, start: 1.6, duration: 1.4, easing: 'easeOutQuart' },
          ],
        },
        {
          id: 'speedupSublabel',
          type: 'text',
          x: 0,
          y: -22,
          text: 'THROUGHPUT GAIN',
          fontFamily: 'JetBrains Mono',
          fontSize: 15,
          fontWeight: 600,
          textAlign: 'center',
          fill: '#34D399',
        },
        // Divider line
        {
          id: 'panelDivider',
          type: 'line',
          x1: -210,
          y1: 95,
          x2: 210,
          y2: 95,
          stroke: '#334155',
          strokeWidth: 2,
        },
        // Secondary Counter: VRAM Saved
        {
          id: 'vramCounter',
          type: 'counter',
          x: 0,
          y: 165,
          value: 0,
          decimals: 0,
           prefix: '-',
          suffix: '% VRAM',
          fontFamily: 'JetBrains Mono',
          fontSize: 44,
          fontWeight: 700,
          textAlign: 'center',
          fill: '#38BDF8',
          animations: [
            { property: 'value', from: 0, to: 68, start: 2.0, duration: 1.3, easing: 'easeOutCubic' },
          ],
        },
        {
          id: 'vramCaption',
          type: 'text',
          x: 0,
          y: 225,
          text: 'Fits 70B parameters on a single 24GB GPU',
          fontFamily: 'Plus Jakarta Sans',
          fontSize: 18,
          fontWeight: 500,
          textAlign: 'center',
          fill: '#94A3B8',
        },
      ],
    },
  ],
};

/**
 * Sample Scene 3: Vector Path Morphing & 2.5D Kinetic Geometry Opener
 * Demonstrates:
 * - Compatible SVG path morphing (`d` -> `morphTo` driven by `morphProgress`).
 * - Custom cubic-bezier easing arrays (`[0.16, 1, 0.3, 1]`).
 * - Clip masks and multi-layer rotational geometry.
 */
export const SAMPLE_VECTOR_MORPH_OPENER: SceneSpecification = {
  schemaVersion: '1.0',
  meta: {
    title: 'Kinetic Vector Morph & 2.5D Chapter Opener',
    description:
      'Showcases SVG path morphing between geometric states, custom cubic-bezier easing curves, and 2.5D depth extrusion.',
    author: 'KineticJSON Studio',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 5,
  },
  background: {
    gradient: {
      type: 'radial',
      cx: 960,
      cy: 540,
      r: 1100,
      stops: [
        { offset: 0, color: '#1E1B4B' },
        { offset: 0.6, color: '#0F172A' },
        { offset: 1, color: '#060911' },
      ],
    },
    grid: {
      enabled: true,
      spacing: 96,
      color: '#6366F1',
      opacity: 0.14,
      majorEvery: 2,
    },
  },
  transitions: {
    in: { type: 'fade', duration: 0.3, color: '#060911' },
    out: { type: 'fade', duration: 0.35, color: '#060911' },
  },
  elements: [
    // Concentric Rotating Geometric Rings
    {
      id: 'centerStage',
      type: 'group',
      x: 960,
      y: 470,
      children: [
        {
          id: 'outerCompassRing',
          type: 'circle',
          r: 290,
          stroke: 'rgba(99, 102, 241, 0.35)',
          strokeWidth: 2,
          strokeDash: [16, 12],
          animations: [
            { property: 'rotation', from: 0, to: 120, start: 0, duration: 5, easing: 'linear' },
            { property: 'scale', from: 0.7, to: 1, start: 0, duration: 1.2, easing: [0.16, 1, 0.3, 1] },
          ],
        },
        {
          id: 'innerSquareFrame',
          type: 'rect',
          width: 340,
          height: 340,
          anchorX: 0.5,
          anchorY: 0.5,
          rx: 28,
          stroke: '#38BDF8',
          strokeWidth: 3,
          rotation: 45,
          animations: [
            { property: 'rotation', from: 0, to: 45, start: 0.2, duration: 1.4, easing: 'easeOutBack' },
            { property: 'drawProgress', from: 0, to: 1, start: 0.1, duration: 1.0, easing: 'easeOutCubic' },
          ],
        },
        // Morphing Vector Core (Diamond Star -> Octagonal Emblem)
        {
          id: 'morphingVectorCore',
          type: 'path',
          d: 'M 0 -150 L 45 -45 L 150 0 L 45 45 L 0 150 L -45 45 L -150 0 L -45 -45 Z',
          morphTo:
            'M 0 -130 L 92 -92 L 130 0 L 92 92 L 0 130 L -92 92 L -130 0 L -92 -92 Z',
          morphProgress: 0,
          fill: {
            type: 'linear',
            angle: 135,
            stops: [
              { offset: 0, color: '#38BDF8' },
              { offset: 1, color: '#818CF8' },
            ],
          },
          stroke: '#F8FAFC',
          strokeWidth: 4,
          extrude25D: {
            depthX: 0,
            depthY: 16,
            color: '#312E81',
            steps: 14,
          },
          animations: [
            { property: 'scale', from: 0, to: 1, start: 0.25, duration: 0.85, easing: 'easeOutBack' },
            {
              property: 'morphProgress',
              from: 0,
              to: 1,
              start: 1.3,
              duration: 1.4,
              easing: 'easeInOutCubic',
            },
            {
              property: 'rotation',
              from: -45,
              to: 0,
              start: 0.25,
              duration: 1.5,
              easing: [0.16, 1, 0.3, 1],
            },
          ],
        },
        // Center Emblem Number
        {
          id: 'chapterNumber',
          type: 'text',
          x: 0,
          y: 0,
          text: '03',
          fontFamily: 'Outfit',
          fontSize: 82,
          fontWeight: 800,
          textAlign: 'center',
          verticalAlign: 'middle',
          fill: '#090D16',
          opacity: 0,
          animations: [
            { property: 'opacity', from: 0, to: 1, start: 1.1, duration: 0.5, easing: 'easeOutQuad' },
            { property: 'scale', from: 0.5, to: 1, start: 1.1, duration: 0.6, easing: 'easeOutBack' },
          ],
        },
      ],
    },

    // Chapter Typography Below
    {
      id: 'chapterTitleGroup',
      type: 'group',
      x: 960,
      y: 865,
      children: [
        {
          id: 'chapterSubtitle',
          type: 'text',
          x: 0,
          y: -52,
          text: 'CHAPTER THREE · DETERMINISTIC VECTOR ENGINE',
          fontFamily: 'JetBrains Mono',
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: 2.5,
          textAlign: 'center',
          fill: '#818CF8',
          animations: [
            { property: 'opacity', from: 0, to: 1, start: 0.8, duration: 0.5, easing: 'easeOutQuad' },
          ],
        },
        {
          id: 'chapterMainHeading',
          type: 'text',
          x: 0,
          y: 0,
          text: 'Composable Geometry & Real-Time Path Morphing',
          fontFamily: 'Outfit',
          fontSize: 48,
          fontWeight: 700,
          textAlign: 'center',
          verticalAlign: 'middle',
          fill: '#F8FAFC',
          animations: [
            { property: 'textReveal', from: 0, to: 1, start: 1.0, duration: 1.2, easing: 'easeOutCubic' },
          ],
        },
      ],
    },
  ],
};

export const SAMPLE_SCENES: SampleSceneEntry[] = [
  {
    id: 'character-explainer',
    title: '01. Stick-Figure Presenter & Cloud Diagram',
    subtitle: 'Articulated character from primitives + reusable symbols + arrows',
    description:
      'Constructs a custom articulated presenter from raw circles, lines, and nested arm joints alongside a 3-node architecture diagram.',
    spec: SAMPLE_CHARACTER_EXPLAINER,
  },
  {
    id: 'data-benchmark',
    title: '02. Quantitative Benchmark & Radial Gauge',
    subtitle: '2.5D extruded bar chart + donut arc + animated counters',
    description:
      'Demonstrates a completely different layout built from rectangular bars, coordinate grids, cubic Bézier trend curves, and live counters.',
    spec: SAMPLE_DATA_VISUALIZATION,
  },
  {
    id: 'vector-morph-opener',
    title: '03. SVG Path Morphing & 2.5D Chapter Opener',
    subtitle: 'Compatible path interpolation + custom cubic-bezier easing',
    description:
      'Morphs a star polygon into an octagonal emblem with 2.5D extrusion layers, rotating dashed rings, and kinetic typography.',
    spec: SAMPLE_VECTOR_MORPH_OPENER,
  },
];
