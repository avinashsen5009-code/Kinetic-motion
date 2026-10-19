import React from 'react';
import { SceneNode } from '../types/scene';
import {
  UserPlus,
  Square,
  ArrowUpRight,
  Type,
  Hash,
  Sparkles,
} from 'lucide-react';

interface QuickInsertBarProps {
  onInsertPrimitive: (newNode: SceneNode) => void;
  canvasWidth: number;
  canvasHeight: number;
}

export const QuickInsertBar: React.FC<QuickInsertBarProps> = ({
  onInsertPrimitive,
  canvasWidth,
  canvasHeight,
}) => {
  const cx = Math.round(canvasWidth / 2);
  const cy = Math.round(canvasHeight / 2);
  const suffix = Math.floor(100 + Math.random() * 900);

  const insertStickFigure = () => {
    const node: SceneNode = {
      id: `stickFigure_${suffix}`,
      name: 'Custom Stick Figure',
      type: 'group',
      x: cx,
      y: cy + 60,
      scale: 1,
      animations: [
        {
          property: 'y',
          from: cy + 120,
          to: cy + 60,
          start: 0.1,
          duration: 0.7,
          easing: 'easeOutBack',
        },
      ],
      children: [
        {
          id: `head_${suffix}`,
          type: 'circle',
          x: 0,
          y: -110,
          r: 34,
          fill: '#0F172A',
          stroke: '#38BDF8',
          strokeWidth: 7,
        },
        {
          id: `spine_${suffix}`,
          type: 'line',
          x1: 0,
          y1: -76,
          x2: 0,
          y2: 65,
          stroke: '#F8FAFC',
          strokeWidth: 9,
          lineCap: 'round',
        },
        {
          id: `legs_${suffix}`,
          type: 'polyline',
          points: [
            [-36, 155],
            [0, 65],
            [36, 155],
          ],
          stroke: '#CBD5E1',
          strokeWidth: 8,
          lineCap: 'round',
          lineJoin: 'round',
        },
        {
          id: `waveArm_${suffix}`,
          type: 'line',
          x1: 0,
          y1: -50,
          x2: 68,
          y2: -95,
          stroke: '#38BDF8',
          strokeWidth: 8,
          lineCap: 'round',
          animations: [
            {
              property: 'rotation',
              from: -15,
              to: 20,
              start: 0.4,
              duration: 0.8,
              easing: 'easeInOutQuad',
            },
          ],
        },
      ],
    };
    onInsertPrimitive(node);
  };

  const insertShapeCard = () => {
    const node: SceneNode = {
      id: `rectCard_${suffix}`,
      type: 'rect',
      x: cx,
      y: cy,
      width: 320,
      height: 160,
      anchorX: 0.5,
      anchorY: 0.5,
      rx: 18,
      fill: '#1E293B',
      stroke: '#38BDF8',
      strokeWidth: 3,
      extrude25D: {
        depthX: 0,
        depthY: 10,
        color: '#090D16',
        steps: 8,
      },
      animations: [
        {
          property: 'scale',
          from: 0,
          to: 1,
          start: 0.1,
          duration: 0.65,
          easing: 'easeOutBack',
        },
      ],
    };
    onInsertPrimitive(node);
  };

  const insertArrowConnector = () => {
    const node: SceneNode = {
      id: `arrowLine_${suffix}`,
      type: 'line',
      x: 0,
      y: 0,
      x1: Math.round(cx - 220),
      y1: cy,
      x2: Math.round(cx + 220),
      y2: cy,
      curveOffset: -45,
      stroke: '#34D399',
      strokeWidth: 5,
      startMarker: 'circle',
      endMarker: 'arrow',
      drawProgress: 0,
      animations: [
        {
          property: 'drawProgress',
          from: 0,
          to: 1,
          start: 0.2,
          duration: 0.8,
          easing: 'easeInOutCubic',
        },
      ],
    };
    onInsertPrimitive(node);
  };

  const insertKineticText = () => {
    const node: SceneNode = {
      id: `titleText_${suffix}`,
      type: 'text',
      x: cx,
      y: Math.round(cy - 180),
      text: 'New Explainer Callout',
      fontFamily: 'Outfit',
      fontSize: 48,
      fontWeight: 700,
      textAlign: 'center',
      verticalAlign: 'middle',
      fill: '#F8FAFC',
      animations: [
        {
          property: 'textReveal',
          from: 0,
          to: 1,
          start: 0.15,
          duration: 0.9,
          easing: 'easeOutCubic',
        },
      ],
    };
    onInsertPrimitive(node);
  };

  const insertAnimatedCounter = () => {
    const node: SceneNode = {
      id: `metricCounter_${suffix}`,
      type: 'counter',
      x: cx,
      y: Math.round(cy + 180),
      value: 0,
      decimals: 1,
      prefix: '+',
      suffix: '%',
      fontFamily: 'JetBrains Mono',
      fontSize: 54,
      fontWeight: 700,
      textAlign: 'center',
      verticalAlign: 'middle',
      fill: '#38BDF8',
      animations: [
        {
          property: 'value',
          from: 0,
          to: 148.5,
          start: 0.2,
          duration: 1.4,
          easing: 'easeOutQuart',
        },
      ],
    };
    onInsertPrimitive(node);
  };

  const insertMorphPath = () => {
    const node: SceneNode = {
      id: `morphStar_${suffix}`,
      type: 'path',
      x: cx,
      y: cy,
      d: 'M 0 -90 L 28 -28 L 90 0 L 28 28 L 0 90 L -28 28 L -90 0 L -28 -28 Z',
      morphTo: 'M 0 -80 L 58 -58 L 80 0 L 58 58 L 0 80 L -58 58 L -80 0 L -58 -58 Z',
      morphProgress: 0,
      fill: '#818CF8',
      stroke: '#F8FAFC',
      strokeWidth: 3,
      animations: [
        {
          property: 'morphProgress',
          from: 0,
          to: 1,
          start: 0.3,
          duration: 1.2,
          easing: 'easeInOutCubic',
        },
      ],
    };
    onInsertPrimitive(node);
  };

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0B101B] border-b border-slate-800/90 overflow-x-auto no-scrollbar shrink-0">
      <span className="text-[11px] font-medium text-slate-400 mr-1 whitespace-nowrap shrink-0">
        Quick-Insert JSON:
      </span>
      <button
        type="button"
        onClick={insertStickFigure}
        className="min-h-[36px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-[0.98] text-xs font-medium text-slate-200 border border-slate-700/80 transition-all whitespace-nowrap shrink-0"
      >
        <UserPlus className="w-3.5 h-3.5 text-sky-400" />
        <span>+ Stick Figure</span>
      </button>
      <button
        type="button"
        onClick={insertShapeCard}
        className="min-h-[36px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-[0.98] text-xs font-medium text-slate-200 border border-slate-700/80 transition-all whitespace-nowrap shrink-0"
      >
        <Square className="w-3.5 h-3.5 text-emerald-400" />
        <span>+ 2.5D Box</span>
      </button>
      <button
        type="button"
        onClick={insertArrowConnector}
        className="min-h-[36px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-[0.98] text-xs font-medium text-slate-200 border border-slate-700/80 transition-all whitespace-nowrap shrink-0"
      >
        <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
        <span>+ Arrow</span>
      </button>
      <button
        type="button"
        onClick={insertKineticText}
        className="min-h-[36px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-[0.98] text-xs font-medium text-slate-200 border border-slate-700/80 transition-all whitespace-nowrap shrink-0"
      >
        <Type className="w-3.5 h-3.5 text-purple-400" />
        <span>+ Text</span>
      </button>
      <button
        type="button"
        onClick={insertAnimatedCounter}
        className="min-h-[36px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-[0.98] text-xs font-medium text-slate-200 border border-slate-700/80 transition-all whitespace-nowrap shrink-0"
      >
        <Hash className="w-3.5 h-3.5 text-sky-400" />
        <span>+ Counter</span>
      </button>
      <button
        type="button"
        onClick={insertMorphPath}
        className="min-h-[36px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-[0.98] text-xs font-medium text-slate-200 border border-slate-700/80 transition-all whitespace-nowrap shrink-0"
      >
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        <span>+ Morph Path</span>
      </button>
    </div>
  );
};
