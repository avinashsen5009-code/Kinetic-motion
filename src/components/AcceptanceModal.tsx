import React from 'react';
import { X, CheckCircle2, AlertTriangle, Play } from 'lucide-react';
import { AcceptanceTestResult } from '../engine/acceptanceTests';

interface AcceptanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: AcceptanceTestResult[];
  isRunning: boolean;
  onRerun: () => void;
}

export const AcceptanceModal: React.FC<AcceptanceModalProps> = ({
  isOpen,
  onClose,
  results,
  isRunning,
  onRerun,
}) => {
  if (!isOpen) return null;

  const passedCount = results.filter((r) => r.passed).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-6">
      <div className="w-full max-w-4xl max-h-[86vh] flex flex-col bg-[#0F172A] border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#090D16]">
          <div>
            <h2 className="text-lg font-bold text-slate-100 font-display">
              Mandatory Renderer Verification Suite (13 Tests)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {results.length > 0
                ? `${passedCount} of ${results.length} acceptance tests passed`
                : 'Ready to execute automated verification'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onRerun}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isRunning ? 'Running Suite...' : 'Run Verification Suite'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Close verification modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
          {results.map((item) => (
            <div key={item.id} className="px-6 py-3.5 flex items-start gap-4 hover:bg-slate-900/40">
              <div className="mt-0.5 shrink-0">
                {item.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold text-slate-100">
                    {String(item.id).padStart(2, '0')}. {item.title}
                  </h3>
                  <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
                    {item.durationMs} ms · {item.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{item.requirement}</p>
                <p className="text-xs font-mono text-sky-300/90 mt-1.5 bg-[#090D16] px-3 py-1.5 rounded border border-slate-800">
                  {item.details}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
