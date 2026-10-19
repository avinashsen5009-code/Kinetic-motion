import React from 'react';
import { SceneNode } from '../types/scene';
import { Sliders, Trash2 } from 'lucide-react';

interface TouchPropertySlidersProps {
  selectedNode: SceneNode | null;
  canvasWidth: number;
  canvasHeight: number;
  onUpdateNodeProperty: (
    nodeId: string,
    prop: 'x' | 'y' | 'scale' | 'rotation' | 'opacity',
    value: number
  ) => void;
  onDeleteNode: (nodeId: string) => void;
}

export const TouchPropertySliders: React.FC<TouchPropertySlidersProps> = ({
  selectedNode,
  canvasWidth,
  canvasHeight,
  onUpdateNodeProperty,
  onDeleteNode,
}) => {
  if (!selectedNode) {
    return (
      <div className="px-4 py-3 bg-[#090D16] border-b border-slate-800 text-xs text-slate-400 flex items-center gap-2">
        <Sliders className="w-4 h-4 text-sky-400 shrink-0" />
        <span>
          Tap any element row below to adjust its X, Y, Scale, Rotation, or Opacity with touch sliders (auto-syncs to JSON).
        </span>
      </div>
    );
  }

  const xVal = Math.round(selectedNode.x ?? 0);
  const yVal = Math.round(selectedNode.y ?? 0);
  const scaleVal = Number((selectedNode.scale ?? 1).toFixed(2));
  const rotVal = Math.round(selectedNode.rotation ?? 0);
  const opacityVal = Number((selectedNode.opacity ?? 1).toFixed(2));

  return (
    <div className="p-3.5 bg-[#090D16] border-b border-slate-800 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <Sliders className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-semibold text-white font-mono">
            {selectedNode.id}
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-sky-400 font-mono">{selectedNode.type}</span>
        </div>
        <button
          type="button"
          onClick={() => onDeleteNode(selectedNode.id)}
          className="min-h-[34px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/60 text-xs font-medium transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Remove Element</span>
        </button>
      </div>

      {/* Responsive Grid of Touch Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs font-mono tabular-nums">
        {/* X Position */}
        <div className="bg-[#0F172A] px-3 py-2 rounded-xl border border-slate-800 flex flex-col gap-1.5">
          <div className="flex justify-between text-slate-300">
            <span>X Pos</span>
            <span className="text-sky-300">{xVal}px</span>
          </div>
          <input
            type="range"
            min={-400}
            max={canvasWidth + 200}
            step={5}
            value={xVal}
            onChange={(e) =>
              onUpdateNodeProperty(selectedNode.id, 'x', Number(e.target.value))
            }
            className="w-full h-2 accent-sky-400 cursor-pointer"
          />
        </div>

        {/* Y Position */}
        <div className="bg-[#0F172A] px-3 py-2 rounded-xl border border-slate-800 flex flex-col gap-1.5">
          <div className="flex justify-between text-slate-300">
            <span>Y Pos</span>
            <span className="text-sky-300">{yVal}px</span>
          </div>
          <input
            type="range"
            min={-400}
            max={canvasHeight + 200}
            step={5}
            value={yVal}
            onChange={(e) =>
              onUpdateNodeProperty(selectedNode.id, 'y', Number(e.target.value))
            }
            className="w-full h-2 accent-sky-400 cursor-pointer"
          />
        </div>

        {/* Scale */}
        <div className="bg-[#0F172A] px-3 py-2 rounded-xl border border-slate-800 flex flex-col gap-1.5">
          <div className="flex justify-between text-slate-300">
            <span>Scale</span>
            <span className="text-sky-300">{scaleVal}x</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={3.0}
            step={0.05}
            value={scaleVal}
            onChange={(e) =>
              onUpdateNodeProperty(
                selectedNode.id,
                'scale',
                Number(e.target.value)
              )
            }
            className="w-full h-2 accent-sky-400 cursor-pointer"
          />
        </div>

        {/* Rotation */}
        <div className="bg-[#0F172A] px-3 py-2 rounded-xl border border-slate-800 flex flex-col gap-1.5">
          <div className="flex justify-between text-slate-300">
            <span>Rotation</span>
            <span className="text-sky-300">{rotVal}°</span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={rotVal}
            onChange={(e) =>
              onUpdateNodeProperty(
                selectedNode.id,
                'rotation',
                Number(e.target.value)
              )
            }
            className="w-full h-2 accent-sky-400 cursor-pointer"
          />
        </div>

        {/* Opacity */}
        <div className="bg-[#0F172A] px-3 py-2 rounded-xl border border-slate-800 flex flex-col gap-1.5">
          <div className="flex justify-between text-slate-300">
            <span>Opacity</span>
            <span className="text-sky-300">{Math.round(opacityVal * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacityVal}
            onChange={(e) =>
              onUpdateNodeProperty(
                selectedNode.id,
                'opacity',
                Number(e.target.value)
              )
            }
            className="w-full h-2 accent-sky-400 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
