// ============================================================================
// Module 8: MotionJSON Studio — Main React + TypeScript Application
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Eye,
  FileCode,
  FileJson,
  Film,
  FolderOpen,
  Grid,
  Layers,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  SkipBack,
  SkipForward,
  Sparkles,
  StepBack,
  StepForward,
  Trash2,
  Video,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { SceneSpec, ValidationIssue, ValidationResult } from './schema';
import { validateSceneJson } from './validator';
import { BuiltSceneGraph, buildSceneGraph, SceneGraphNode } from './sceneGraph';
import { computeElementStateAtTime } from './timeline';
import { renderSceneFrame } from './renderer';
import {
  exportSceneToVideo,
  getSupportedVideoMimeTypes,
  parseProjectOrSceneFile,
  serializeProjectFile,
  VideoExportProgress,
  VideoExportResult,
} from './videoExporter';
import { SAMPLE_SCENES } from './sampleScenes';

const INITIAL_JSON = JSON.stringify(SAMPLE_SCENES[0].spec, null, 2);

const DIAGNOSTIC_TEST_JSON = JSON.stringify(
  {
    schemaVersion: '1.0',
    id: 'diagnostic-warning-demo',
    title: 'Validation & Unknown Property Demo Scene',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 4.0,
    unknownTopLevelProp: 'triggers-warning',
    background: {
      color: '#0f172a',
    },
    elements: [
      {
        id: 'demo-circle',
        type: 'circle',
        x: 960,
        y: 540,
        radius: 140,
        fill: '#38bdf8',
        stroke: '#f8fafc',
        strokeWidth: 6,
        unsupportedMagicEffect: true,
        keyframes: [
          { time: 0, scale: 0.5, opacity: 0.4 },
          { time: 2.0, scale: 1.15, opacity: 1, easing: 'easeOutBack' },
          { time: 4.0, scale: 1.0, opacity: 1, easing: 'easeInOutCubic' },
        ],
      },
      {
        id: 'demo-label',
        type: 'text',
        x: 960,
        y: 800,
        text: 'Unknown properties produce actionable warnings without crashing',
        fontSize: 28,
        fontWeight: 700,
        fill: '#f8fafc',
      },
    ],
  },
  null,
  2
);

function copyTextSafe(text: string): boolean {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  } catch {
    // Fallback below
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function App() {
  // Editor & Active Rendered Scene State
  const [jsonInput, setJsonInput] = useState<string>(INITIAL_JSON);
  const [selectedSampleId, setSelectedSampleId] = useState<string>(SAMPLE_SCENES[0].id);
  const [validation, setValidation] = useState<ValidationResult>(() =>
    validateSceneJson(INITIAL_JSON)
  );
  const [activeScene, setActiveScene] = useState<SceneSpec>(() => SAMPLE_SCENES[0].spec);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Playback & Deterministic Timeline State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [loop, setLoop] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Viewport Display State
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [showSafeMargins, setShowSafeMargins] = useState<boolean>(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Bottom / Side Panels & Modals
  const [bottomTab, setBottomTab] = useState<'inspector' | 'diagnostics' | 'export'>('inspector');
  const [showDocsModal, setShowDocsModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Video Export State
  const [exportFps, setExportFps] = useState<30 | 60>(30);
  const [exportFormat, setExportFormat] = useState<'webm' | 'mp4'>('webm');
  const [exportBitrateMbps, setExportBitrateMbps] = useState<number>(12);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<VideoExportProgress | null>(null);
  const [exportedVideo, setExportedVideo] = useState<VideoExportResult | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exportAbortRef = useRef<{ aborted: boolean }>({ aborted: false });

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  }, []);

  // Build Scene Graph memoized from activeScene
  const sceneGraph: BuiltSceneGraph = useMemo(
    () => buildSceneGraph(activeScene),
    [activeScene]
  );

  const codecSupport = useMemo(() => getSupportedVideoMimeTypes(), []);

  // Collect all keyframe timestamps for timeline markers
  const keyframeMarkers = useMemo(() => {
    const times = new Set<number>();
    for (const node of sceneGraph.flatNodes) {
      if (Array.isArray(node.element.keyframes)) {
        for (const kf of node.element.keyframes) {
          if (typeof kf.time === 'number') {
            times.add(Number(kf.time.toFixed(2)));
          }
        }
      }
    }
    return Array.from(times).sort((a, b) => a - b);
  }, [sceneGraph]);

  // Render current frame onto the 1920x1080 preview canvas whenever currentTime, sceneGraph, or overlays change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderSceneFrame(ctx, sceneGraph, currentTime, {
      targetWidth: 1920,
      targetHeight: 1080,
      showCoordinateGrid: showGrid,
      showSafeMargins: showSafeMargins,
      selectedElementId,
    });
  }, [sceneGraph, currentTime, showGrid, showSafeMargins, selectedElementId]);

  // Deterministic Playback Loop via requestAnimationFrame
  useEffect(() => {
    if (!isPlaying || isExporting) return;

    let rafId = 0;
    let lastTs = performance.now();
    const duration = Math.max(0.1, activeScene.duration || 5);

    const tick = (now: number) => {
      const dt = ((now - lastTs) / 1000) * playbackSpeed;
      lastTs = now;

      setCurrentTime((prev) => {
        const next = prev + dt;
        if (next >= duration) {
          if (loop) {
            return next % duration;
          } else {
            setIsPlaying(false);
            return duration;
          }
        }
        return next;
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isExporting, activeScene.duration, loop, playbackSpeed]);

  // Validate and Render Scene when explicitly requested
  const handleRenderScene = useCallback(
    (customJson?: string) => {
      const targetJson = customJson !== undefined ? customJson : jsonInput;
      const res = validateSceneJson(targetJson);
      setValidation(res);

      if (res.valid && res.scene) {
        setActiveScene(res.scene);
        setIsDirty(false);
        if (res.scene.fps === 60 || res.scene.fps === 30) {
          setExportFps(res.scene.fps);
        }
        setCurrentTime((prev) => Math.min(prev, res.scene!.duration));
        if (res.warnings.length > 0) {
          setBottomTab('diagnostics');
          showToast(
            `Scene rendered with ${res.warnings.length} warning(s). Check Diagnostics.`
          );
        } else {
          showToast(`Rendered "${res.scene.title}" (${res.stats.elementCount} elements)`);
        }
      } else {
        setBottomTab('diagnostics');
        showToast(
          `Validation failed with ${res.errors.length} error(s). Fix issues to render.`
        );
      }
    },
    [jsonInput, showToast]
  );

  // Format JSON in editor
  const handleFormatJson = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonInput);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonInput(formatted);
      showToast('JSON formatted cleanly.');
    } catch (err: any) {
      const res = validateSceneJson(jsonInput);
      setValidation(res);
      setBottomTab('diagnostics');
      showToast('Cannot format invalid JSON — see syntax error line in Diagnostics.');
    }
  }, [jsonInput, showToast]);

  // Load Sample Scene
  const handleLoadSample = useCallback(
    (sampleId: string) => {
      const found = SAMPLE_SCENES.find((s) => s.id === sampleId);
      if (!found) return;
      setSelectedSampleId(sampleId);
      const formatted = JSON.stringify(found.spec, null, 2);
      setJsonInput(formatted);
      const res = validateSceneJson(formatted);
      setValidation(res);
      if (res.valid && res.scene) {
        setActiveScene(res.scene);
        setCurrentTime(0);
        setIsPlaying(true);
        setIsDirty(false);
        if (res.scene.fps === 60 || res.scene.fps === 30) {
          setExportFps(res.scene.fps);
        }
        showToast(`Loaded "${found.spec.title}"`);
      }
    },
    [showToast]
  );

  // Load Minimal Clean Scene on Clear
  const handleClearEditor = useCallback(() => {
    const minimal: SceneSpec = {
      schemaVersion: '1.0',
      id: 'custom-scene',
      title: 'Custom Blank Scene',
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 5.0,
      background: {
        color: '#0f172a',
        grid: { enabled: true, spacing: 60, color: '#334155', opacity: 0.2 },
      },
      elements: [
        {
          id: 'starter-title',
          type: 'text',
          x: 960,
          y: 540,
          text: 'Edit JSON to Construct Your Scene',
          fontSize: 48,
          fontWeight: 800,
          fill: '#f8fafc',
          entrance: { type: 'scaleUp', duration: 0.6, easing: 'easeOutBack' },
        },
      ],
    };
    const formatted = JSON.stringify(minimal, null, 2);
    setJsonInput(formatted);
    handleRenderScene(formatted);
  }, [handleRenderScene]);

  // Load Diagnostic Warning Demo
  const handleLoadDiagnosticDemo = useCallback(() => {
    setJsonInput(DIAGNOSTIC_TEST_JSON);
    handleRenderScene(DIAGNOSTIC_TEST_JSON);
  }, [handleRenderScene]);

  // Jump to Line in JSON Editor
  const jumpToEditorLine = useCallback((line?: number) => {
    if (!line || !editorRef.current) return;
    const ta = editorRef.current;
    const lines = ta.value.split('\n');
    const targetIdx = Math.max(0, Math.min(line - 1, lines.length - 1));
    let charOffset = 0;
    for (let i = 0; i < targetIdx; i++) {
      charOffset += lines[i].length + 1;
    }
    ta.focus();
    ta.setSelectionRange(charOffset, charOffset + (lines[targetIdx]?.length || 0));
    const lineHeightPx = 20;
    ta.scrollTop = Math.max(0, (targetIdx - 4) * lineHeightPx);
  }, []);

  // Copy Diagnostic Report
  const handleCopyErrorReport = useCallback(() => {
    const report = {
      timestamp: new Date().toISOString(),
      valid: validation.valid,
      sceneId: activeScene.id,
      stats: validation.stats,
      errors: validation.errors,
      warnings: validation.warnings,
    };
    copyTextSafe(JSON.stringify(report, null, 2));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
    showToast('Diagnostic report copied to clipboard.');
  }, [validation, activeScene.id, showToast]);

  // Save Project File (.mgscene.json)
  const handleSaveProjectFile = useCallback(() => {
    const content = serializeProjectFile(jsonInput, activeScene, {
      resolution: '1920x1080',
      fps: exportFps,
      format: exportFormat,
      bitrateMbps: exportBitrateMbps,
    });
    const blob = new Blob([content], { type: 'application/json' });
    const slug = (activeScene.id || 'scene').replace(/[^a-z0-9-_]/gi, '-');
    triggerBlobDownload(blob, `${slug}.mgscene.json`);
    showToast(`Saved project file "${slug}.mgscene.json"`);
  }, [jsonInput, activeScene, exportFps, exportFormat, exportBitrateMbps, showToast]);

  // Export Standalone Raw Scene JSON (.json)
  const handleExportRawJson = useCallback(() => {
    const blob = new Blob([jsonInput], { type: 'application/json' });
    const slug = (activeScene.id || 'scene').replace(/[^a-z0-9-_]/gi, '-');
    triggerBlobDownload(blob, `${slug}.json`);
    showToast(`Exported standalone scene "${slug}.json"`);
  }, [jsonInput, activeScene.id, showToast]);

  // Import Project or Scene JSON File
  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        const parsed = parseProjectOrSceneFile(text);
        setJsonInput(parsed.rawJson);
        if (parsed.exportSettings) {
          if (parsed.exportSettings.fps === 30 || parsed.exportSettings.fps === 60) {
            setExportFps(parsed.exportSettings.fps);
          }
          if (
            parsed.exportSettings.format === 'webm' ||
            parsed.exportSettings.format === 'mp4'
          ) {
            setExportFormat(parsed.exportSettings.format);
          }
          if (parsed.exportSettings.bitrateMbps) {
            setExportBitrateMbps(parsed.exportSettings.bitrateMbps);
          }
        }
        handleRenderScene(parsed.rawJson);
        showToast(
          parsed.isProjectFile
            ? `Reopened project "${file.name}" with preserved settings`
            : `Imported scene JSON "${file.name}"`
        );
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [handleRenderScene, showToast]
  );

  // Snapshot PNG Export
  const handleSnapshotPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const slug = (activeScene.id || 'scene').replace(/[^a-z0-9-_]/gi, '-');
      triggerBlobDownload(
        blob,
        `${slug}-frame-${Math.round(currentTime * (activeScene.fps || 30))}.png`
      );
      showToast('Exported 1920×1080 PNG frame snapshot.');
    }, 'image/png');
  }, [activeScene, currentTime, showToast]);

  // Full 1920x1080 Video Export Execution
  const handleStartVideoExport = useCallback(async () => {
    // First validate current JSON if dirty
    const res = validateSceneJson(jsonInput);
    setValidation(res);
    if (!res.valid || !res.scene) {
      setBottomTab('diagnostics');
      showToast('Fix JSON validation errors before exporting video.');
      return;
    }
    setActiveScene(res.scene);
    setIsDirty(false);
    setIsPlaying(false);
    setBottomTab('export');
    setIsExporting(true);
    exportAbortRef.current = { aborted: false };

    try {
      const graphToExport = buildSceneGraph(res.scene);
      const result = await exportSceneToVideo(
        graphToExport,
        {
          width: 1920,
          height: 1080,
          fps: exportFps,
          preferredFormat: exportFormat,
          bitrateMbps: exportBitrateMbps,
        },
        (prog) => {
          setExportProgress(prog);
          // Mirror current export timestamp onto main preview canvas
          const t =
            (prog.currentFrame / Math.max(1, prog.totalFrames)) *
            res.scene!.duration;
          setCurrentTime(t);
        },
        exportAbortRef.current
      );

      setExportedVideo(result);
      // Set main preview to final ending frame
      setCurrentTime(res.scene.duration);
      triggerBlobDownload(result.blob, result.filename);
      showToast(`Export complete: ${result.filename}`);
    } catch (err: any) {
      setExportProgress({
        phase: 'error',
        currentFrame: 0,
        totalFrames: 0,
        percent: 0,
        elapsedSeconds: 0,
        mimeTypeUsed: '',
        message: err?.message || 'Video export failed.',
      });
      showToast(`Export error: ${err?.message || 'Failed'}`);
    } finally {
      setIsExporting(false);
    }
  }, [jsonInput, exportFps, exportFormat, exportBitrateMbps, showToast]);

  const handleCancelVideoExport = useCallback(() => {
    exportAbortRef.current.aborted = true;
  }, []);

  // Frame Stepping Controls
  const fps = activeScene.fps || 30;
  const totalFrames = Math.max(1, Math.round(activeScene.duration * fps));
  const currentFrame = Math.min(
    totalFrames,
    Math.max(0, Math.round(currentTime * fps))
  );

  const stepFrames = useCallback(
    (deltaFrames: number) => {
      setIsPlaying(false);
      setCurrentTime((prev) => {
        const nextFrame = Math.max(
          0,
          Math.min(totalFrames, Math.round(prev * fps) + deltaFrames)
        );
        return Number((nextFrame / fps).toFixed(4));
      });
    },
    [fps, totalFrames]
  );

  // Selected Element Computed State for Inspector
  const selectedNode: SceneGraphNode | undefined = useMemo(() => {
    if (!selectedElementId) return sceneGraph.flatNodes[0];
    return (
      sceneGraph.flatNodes.find((n) => n.id === selectedElementId) ||
      sceneGraph.flatNodes[0]
    );
  }, [sceneGraph, selectedElementId]);

  const selectedComputedState = useMemo(() => {
    if (!selectedNode) return null;
    return computeElementStateAtTime(
      selectedNode.element,
      currentTime,
      activeScene.duration
    );
  }, [selectedNode, currentTime, activeScene.duration]);

  const editorLineCount = useMemo(
    () => Math.max(1, jsonInput.split('\n').length),
    [jsonInput]
  );

  const errorLinesSet = useMemo(() => {
    const s = new Set<number>();
    validation.errors.forEach((e) => {
      if (e.line) s.add(e.line);
    });
    return s;
  }, [validation.errors]);

  const warningLinesSet = useMemo(() => {
    const s = new Set<number>();
    validation.warnings.forEach((w) => {
      if (w.line) s.add(w.line);
    });
    return s;
  }, [validation.warnings]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Hidden File Input for Project / Scene Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.mgscene.json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          id="studio-toast"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-slate-900/95 border border-sky-500/50 text-sky-100 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-medium"
        >
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Studio Header */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 via-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">
                MotionJSON Studio
              </h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                16:9 Vector Engine v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Deterministic Composable Primitive Renderer • 1920×1080 YouTube Export
            </p>
          </div>
        </div>

        {/* Center Scene Preset & Project Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="sample-scene-select" className="text-xs text-slate-400 font-medium">
            Load Example:
          </label>
          <select
            id="sample-scene-select"
            value={selectedSampleId}
            onChange={(e) => handleLoadSample(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500"
          >
            {SAMPLE_SCENES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            id="btn-import-project"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Open .mgscene.json project or .json scene"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Open Project</span>
          </button>

          <button
            id="btn-save-project"
            type="button"
            onClick={handleSaveProjectFile}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Save .mgscene.json project file with settings & fonts"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400" />
            <span>Save Project</span>
          </button>

          <button
            id="btn-export-json"
            type="button"
            onClick={handleExportRawJson}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Download standalone scene .json"
          >
            <FileJson className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export JSON</span>
          </button>

          <button
            id="btn-open-docs"
            type="button"
            onClick={() => setShowDocsModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>JSON Spec & Docs</span>
          </button>

          <button
            id="btn-export-video-header"
            type="button"
            onClick={handleStartVideoExport}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-md shadow-sky-500/20 disabled:opacity-50 transition"
          >
            <Video className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting 1080p...' : 'Export 1080p Video'}</span>
          </button>
        </div>
      </header>

      {/* Main Split Studio Workspace */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
        {/* LEFT PANE: JSON Creative Specification Editor & Validation Status */}
        <section className="lg:col-span-5 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950 min-h-[460px]">
          {/* Editor Action Bar */}
          <div className="px-3 py-2 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold text-slate-200">
                Scene JSON Specification
              </span>
              {isDirty ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Modified • Click Render
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Synced
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                id="btn-render-scene"
                type="button"
                onClick={() => handleRenderScene()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Render Scene</span>
              </button>

              <button
                id="btn-format-json"
                type="button"
                onClick={handleFormatJson}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                title="Format & Indent JSON"
              >
                <Wand2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Format</span>
              </button>

              <button
                id="btn-test-warnings"
                type="button"
                onClick={handleLoadDiagnosticDemo}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition"
                title="Load scene with unknown properties to test warning diagnostics"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Test Diagnostics</span>
              </button>

              <button
                id="btn-clear-json"
                type="button"
                onClick={handleClearEditor}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 transition"
                title="Reset to minimal blank scene"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Code Editor with Synchronized Line Numbers & Error/Warning Indicators */}
          <div className="relative flex-1 flex min-h-[340px] overflow-hidden bg-[#070b14]">
            <div
              ref={gutterRef}
              aria-hidden="true"
              className="w-12 py-3 bg-slate-900/70 border-r border-slate-800/80 text-right pr-2.5 font-mono text-[11px] leading-[20px] text-slate-500 overflow-hidden select-none"
            >
              {Array.from({ length: editorLineCount }).map((_, idx) => {
                const ln = idx + 1;
                const isErr = errorLinesSet.has(ln);
                const isWarn = !isErr && warningLinesSet.has(ln);
                return (
                  <div
                    key={ln}
                    className={`h-[20px] px-1 rounded-sm ${
                      isErr
                        ? 'bg-rose-500/30 text-rose-300 font-bold'
                        : isWarn
                        ? 'bg-amber-500/25 text-amber-300 font-semibold'
                        : ''
                    }`}
                  >
                    {ln}
                  </div>
                );
              })}
            </div>

            <textarea
              id="json-scene-editor"
              ref={editorRef}
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setIsDirty(true);
              }}
              onScroll={(e) => {
                if (gutterRef.current) {
                  gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                }
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleRenderScene();
                }
              }}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              className="flex-1 p-3 bg-transparent text-sky-100 font-mono text-xs leading-[20px] focus:outline-none resize-none overflow-auto select-text"
              placeholder="Paste or author your scene JSON specification here..."
            />
          </div>

          {/* Validation Summary Footer Bar */}
          <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              {validation.valid ? (
                <span
                  id="validation-status-badge"
                  className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valid Scene Spec</span>
                </span>
              ) : (
                <span
                  id="validation-status-badge"
                  className="inline-flex items-center gap-1.5 text-rose-400 font-semibold"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>{validation.errors.length} Error(s)</span>
                </span>
              )}

              {validation.warnings.length > 0 && (
                <button
                  id="btn-view-warnings"
                  type="button"
                  onClick={() => setBottomTab('diagnostics')}
                  className="inline-flex items-center gap-1 text-amber-300 hover:underline"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{validation.warnings.length} Warning(s)</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
              <span>{validation.stats.elementCount} primitives</span>
              <span>•</span>
              <span>{validation.stats.defCount} defs</span>
              <span>•</span>
              <span>{validation.stats.keyframeCount} keyframes</span>
            </div>
          </div>
        </section>

        {/* RIGHT PANE: Fixed 16:9 Canvas Viewport, Deterministic Timeline & Inspector */}
        <section className="lg:col-span-7 flex flex-col bg-slate-950 min-h-0 overflow-hidden">
          {/* Viewport Controls Bar */}
          <div className="px-3 py-2 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200 truncate max-w-[240px]">
                {activeScene.title}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                Logical {activeScene.width}×{activeScene.height} → Output 1920×1080 (16:9)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                id="btn-zoom-fit"
                type="button"
                onClick={() => setZoomMode('fit')}
                className={`px-2 py-1 rounded text-xs font-medium border transition ${
                  zoomMode === 'fit'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                Fit
              </button>
              <button
                id="btn-zoom-out"
                type="button"
                onClick={() =>
                  setZoomMode((z) =>
                    Math.max(0.4, Number(((typeof z === 'number' ? z : 0.85) - 0.15).toFixed(2)))
                  )
                }
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-slate-400 min-w-[44px] text-center">
                {zoomMode === 'fit' ? 'AUTO' : `${Math.round(zoomMode * 100)}%`}
              </span>
              <button
                id="btn-zoom-in"
                type="button"
                onClick={() =>
                  setZoomMode((z) =>
                    Math.min(1.75, Number(((typeof z === 'number' ? z : 0.85) + 0.15).toFixed(2)))
                  )
                }
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                id="btn-toggle-grid"
                type="button"
                onClick={() => setShowGrid((v) => !v)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs transition ${
                  showGrid
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Toggle Coordinate Grid Overlay"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Grid</span>
              </button>

              <button
                id="btn-toggle-safe-area"
                type="button"
                onClick={() => setShowSafeMargins((v) => !v)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs transition ${
                  showSafeMargins
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Toggle YouTube / Broadcast 90% & 80% Safe Margins"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Safe Area</span>
              </button>

              <button
                id="btn-snapshot-png"
                type="button"
                onClick={handleSnapshotPng}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs"
                title="Download 1920x1080 PNG of current frame"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>PNG</span>
              </button>
            </div>
          </div>

          {/* 16:9 Canvas Stage Container */}
          <div className="relative bg-[#050811] flex items-center justify-center p-4 overflow-auto min-h-[290px] max-h-[460px] border-b border-slate-800">
            <div
              className="relative w-full transition-transform duration-150 flex items-center justify-center"
              style={{
                maxWidth: zoomMode === 'fit' ? '760px' : `${Math.round(760 * zoomMode)}px`,
                aspectRatio: '16 / 9',
              }}
            >
              <canvas
                id="scene-preview-canvas"
                ref={canvasRef}
                width={1920}
                height={1080}
                className="w-full h-full rounded-xl shadow-2xl border border-slate-800 bg-slate-950 block"
              />
            </div>
          </div>

          {/* Deterministic Timeline & Transport Controls */}
          <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-col gap-2">
            {/* Timeline Scrubber with Keyframe Diamonds */}
            <div className="relative flex items-center gap-3">
              <span
                id="timeline-timecode"
                className="font-mono text-xs text-sky-300 font-semibold min-w-[115px]"
              >
                {currentTime.toFixed(2)}s / {activeScene.duration.toFixed(2)}s
              </span>

              <div className="relative flex-1 flex items-center">
                <input
                  id="timeline-scrubber"
                  type="range"
                  min={0}
                  max={activeScene.duration}
                  step={0.01}
                  value={Math.min(currentTime, activeScene.duration)}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentTime( parseFloat(e.target.value) );
                  }}
                  className="w-full accent-sky-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
                {/* Keyframe Tick Markers below Scrubber */}
                <div className="pointer-events-none absolute -bottom-2 left-0 right-0 h-1.5">
                  {keyframeMarkers.map((kt) => {
                    const pct = Math.min(
                      100,
                      Math.max(0, (kt / Math.max(0.1, activeScene.duration)) * 100)
                    );
                    return (
                      <span
                        key={kt}
                        style={{ left: `${pct}%` }}
                        className="absolute w-1.5 h-1.5 -ml-0.5 rotate-45 bg-amber-400/80"
                        title={`Keyframe @ ${kt}s`}
                      />
                    );
                  })}
                </div>
              </div>

              <span
                id="timeline-frame-counter"
                className="font-mono text-xs text-slate-300 min-w-[135px] text-right"
              >
                Frame {currentFrame} / {totalFrames} ({fps}fps)
              </span>
            </div>

            {/* Transport Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <button
                  id="btn-jump-start"
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  title="Jump to First Frame (0.00s)"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>

                <button
                  id="btn-step-back"
                  type="button"
                  onClick={() => stepFrames(-1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  title="Step Backward 1 Frame"
                >
                  <StepBack className="w-3.5 h-3.5" />
                </button>

                <button
                  id="btn-play-pause"
                  type="button"
                  onClick={() => {
                    if (!isPlaying && currentTime >= activeScene.duration - 0.02) {
                      setCurrentTime(0);
                    }
                    setIsPlaying((p) => !p);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play</span>
                    </>
                  )}
                </button>

                <button
                  id="btn-step-forward"
                  type="button"
                  onClick={() => stepFrames(1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  title="Step Forward 1 Frame"
                >
                  <StepForward className="w-3.5 h-3.5" />
                </button>

                <button
                  id="btn-jump-end"
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentTime(activeScene.duration);
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  title="Jump to Final Frame (Ending State)"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  id="btn-toggle-loop"
                  type="button"
                  onClick={() => setLoop((l) => !l)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition ${
                    loop
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Loop</span>
                </button>

                <select
                  id="playback-speed-select"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                  title="Preview Playback Speed"
                >
                  <option value={0.25}>0.25× Speed</option>
                  <option value={0.5}>0.5× Speed</option>
                  <option value={1}>1.0× Speed</option>
                  <option value={1.5}>1.5× Speed</option>
                  <option value={2}>2.0× Speed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bottom Tabbed Studio Panel: Scene Graph Inspector | Diagnostics | 1080p Video Export */}
          <div className="flex-1 flex flex-col min-h-[210px] overflow-hidden bg-slate-950">
            <div className="px-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  id="tab-scene-inspector"
                  type="button"
                  onClick={() => setBottomTab('inspector')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
                    bottomTab === 'inspector'
                      ? 'border-sky-400 text-sky-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Scene Graph ({sceneGraph.flatNodes.length})</span>
                </button>

                <button
                  id="tab-diagnostics"
                  type="button"
                  onClick={() => setBottomTab('diagnostics')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
                    bottomTab === 'diagnostics'
                      ? 'border-sky-400 text-sky-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>
                    Validation & Diagnostics (
                    {validation.errors.length + validation.warnings.length})
                  </span>
                </button>

                <button
                  id="tab-video-export"
                  type="button"
                  onClick={() => setBottomTab('export')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
                    bottomTab === 'export'
                      ? 'border-sky-400 text-sky-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>1920×1080 Video Export</span>
                </button>
              </div>
            </div>

            {/* TAB 1: Scene Graph & Live Deterministic State Inspector */}
            {bottomTab === 'inspector' && (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-auto p-3 gap-3 text-xs">
                <div className="md:col-span-6 bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 overflow-auto max-h-[190px]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                    <span>Hierarchy & Primitives</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      Click to highlight on canvas
                    </span>
                  </div>
                  <div className="space-y-1">
                    {sceneGraph.flatNodes.map((node) => {
                      const isSel = selectedNode?.id === node.id;
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() =>
                            setSelectedElementId((prev) =>
                              prev === node.id ? null : node.id
                            )
                          }
                          style={{ paddingLeft: `${8 + node.depth * 14}px` }}
                          className={`w-full text-left py-1 pr-2 rounded-lg flex items-center justify-between transition ${
                            isSel
                              ? 'bg-sky-500/20 text-sky-200 border border-sky-500/40'
                              : 'hover:bg-slate-800/80 text-slate-300'
                          }`}
                        >
                          <span className="truncate font-medium">
                            {node.name || node.id}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 ml-2 shrink-0">
                            {node.type}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="md:col-span-6 bg-slate-900/60 border border-slate-800 rounded-xl p-3 overflow-auto max-h-[190px]">
                  {selectedNode && selectedComputedState ? (
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                        <div>
                          <span className="font-bold text-white">
                            {selectedNode.name}
                          </span>
                          <span className="ml-2 font-mono text-[10px] text-sky-400">
                            #{selectedNode.id}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                          t = {currentTime.toFixed(2)}s
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                        <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                          <span className="text-slate-500 block text-[10px]">Position</span>
                          <span>
                            {Math.round(selectedComputedState.x)},{' '}
                            {Math.round(selectedComputedState.y)}
                          </span>
                        </div>
                        <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                          <span className="text-slate-500 block text-[10px]">Scale</span>
                          <span>
                            {selectedComputedState.scaleX.toFixed(2)}×,{' '}
                            {selectedComputedState.scaleY.toFixed(2)}×
                          </span>
                        </div>
                        <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                          <span className="text-slate-500 block text-[10px]">Rotation</span>
                          <span>{selectedComputedState.rotation.toFixed(1)}°</span>
                        </div>
                        <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                          <span className="text-slate-500 block text-[10px]">Opacity</span>
                          <span>
                            {Math.round(selectedComputedState.opacity * 100)}%
                          </span>
                        </div>
                        <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                          <span className="text-slate-500 block text-[10px]">Trim Path</span>
                          <span>
                            {Math.round(selectedComputedState.trimStart * 100)}% →{' '}
                            {Math.round(selectedComputedState.trimEnd * 100)}%
                          </span>
                        </div>
                        <div className="bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                          <span className="text-slate-500 block text-[10px]">Fill / Stroke</span>
                          <span className="truncate block">
                            {selectedComputedState.fill} /{' '}
                            {selectedComputedState.stroke}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500">
                      Select an element from the Scene Graph to inspect its live interpolated state.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Validation & Copyable Error/Warning Diagnostics */}
            {bottomTab === 'diagnostics' && (
              <div className="flex-1 p-3 overflow-auto flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">
                      Schema & Syntax Diagnostics Report
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({validation.errors.length} errors, {validation.warnings.length}{' '}
                      warnings)
                    </span>
                  </div>

                  <button
                    id="btn-copy-error-report"
                    type="button"
                    onClick={handleCopyErrorReport}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs"
                  >
                    {copiedReport ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied Report</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-sky-400" />
                        <span>Copy Error Report</span>
                      </>
                    )}
                  </button>
                </div>

                {validation.errors.length === 0 &&
                validation.warnings.length === 0 ? (
                  <div
                    id="diagnostics-clean-box"
                    className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 flex items-center gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Zero syntax errors or unknown-property warnings. Scene specification conforms to Schema v1.0.
                    </span>
                  </div>
                ) : (
                  <div id="diagnostics-issue-list" className="space-y-1.5">
                    {[...validation.errors, ...validation.warnings].map(
                      (issue: ValidationIssue, idx: number) => (
                        <div
                          key={`${issue.code}-${idx}`}
                          className={`p-2.5 rounded-xl border flex items-start justify-between gap-3 ${
                            issue.severity === 'error'
                              ? 'bg-rose-950/35 border-rose-500/40 text-rose-200'
                              : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
                                  issue.severity === 'error'
                                    ? 'bg-rose-500/30 text-rose-200'
                                    : 'bg-amber-500/30 text-amber-200'
                                }`}
                              >
                                {issue.severity}: {issue.code}
                              </span>
                              <span className="font-mono text-[11px] opacity-80">
                                {issue.path}
                              </span>
                            </div>
                            <p className="text-xs font-medium">{issue.message}</p>
                            {issue.suggestion && (
                              <p className="text-[11px] opacity-75">
                                Tip: {issue.suggestion}
                              </p>
                            )}
                          </div>

                          {issue.line && (
                            <button
                              type="button"
                              onClick={() => jumpToEditorLine(issue.line)}
                              className="shrink-0 px-2 py-1 rounded bg-slate-900/90 hover:bg-slate-800 text-[11px] font-mono border border-slate-700"
                            >
                              Line {issue.line}
                              {issue.column ? `:${issue.column}` : ''}
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Full 1920x1080 Video Export Studio */}
            {bottomTab === 'export' && (
              <div className="flex-1 p-3 overflow-auto grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                <div className="md:col-span-7 space-y-2.5 bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">
                      Deterministic 1920×1080 Video Export Pipeline
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                      16:9 Full HD
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Container / Codec
                      </label>
                      <select
                        id="export-format-select"
                        value={exportFormat}
                        onChange={(e) =>
                          setExportFormat(e.target.value as 'webm' | 'mp4')
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100"
                      >
                        <option value="webm">WebM (VP9/VP8 Browser Native)</option>
                        <option value="mp4">
                          MP4 (H.264{' '}
                          {codecSupport.mp4Supported
                            ? 'Supported'
                            : 'Auto-Fallback to WebM'}
                          )
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Frame Rate
                      </label>
                      <select
                        id="export-fps-select"
                        value={exportFps}
                        onChange={(e) =>
                          setExportFps(Number(e.target.value) as 30 | 60)
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100"
                      >
                        <option value={30}>30 FPS (YouTube Standard)</option>
                        <option value={60}>60 FPS (High Motion)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Target Bitrate
                      </label>
                      <select
                        id="export-bitrate-select"
                        value={exportBitrateMbps}
                        onChange={(e) =>
                          setExportBitrateMbps(Number(e.target.value))
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100"
                      >
                        <option value={8}>8 Mbps (Standard)</option>
                        <option value={12}>12 Mbps (High HD)</option>
                        <option value={20}>20 Mbps (Master)</option>
                      </select>
                    </div>
                  </div>

                  {/* Export Progress or Trigger */}
                  {exportProgress && (
                    <div
                      id="video-export-progress-box"
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-sky-300">
                          {exportProgress.message}
                        </span>
                        <span className="font-mono text-slate-400">
                          {exportProgress.percent}% ({exportProgress.elapsedSeconds}s)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-150"
                          style={{ width: `${exportProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    {!isExporting ? (
                      <button
                        id="btn-start-video-export"
                        type="button"
                        onClick={handleStartVideoExport}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
                      >
                        <Video className="w-4 h-4" />
                        <span>
                          Render & Download {activeScene.duration}s Clip (1920×1080 @{' '}
                          {exportFps} FPS)
                        </span>
                      </button>
                    ) : (
                      <button
                        id="btn-cancel-video-export"
                        type="button"
                        onClick={handleCancelVideoExport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancel Export</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Column: Exported Video Player & Re-Download */}
                <div className="md:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
                  {exportedVideo ? (
                    <div id="exported-video-result" className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-400 truncate">
                          {exportedVideo.filename}
                        </span>
                        <a
                          id="btn-download-exported-video"
                          href={exportedVideo.url}
                          download={exportedVideo.filename}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[11px]"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </a>
                      </div>
                      <video
                        id="exported-video-player"
                        src={exportedVideo.url}
                        controls
                        loop
                        className="w-full rounded-lg border border-slate-800 max-h-[110px] bg-black"
                      />
                    </div>
                  ) : (
                    <div className="text-slate-400 space-y-1.5">
                      <p className="font-semibold text-slate-200">
                        Browser & Local FFmpeg Pipeline Notes
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        In-browser export steps through every frame from{' '}
                        <code className="text-sky-300">t = 0.00s</code> to{' '}
                        <code className="text-sky-300">
                          t = {activeScene.duration.toFixed(2)}s
                        </code>{' '}
                        at exact <code className="text-sky-300">1920×1080</code>{' '}
                        resolution. For offline 10-bit / CRF-16 H.264 MP4 encoding,
                        use the included Node + Headless Chromium + FFmpeg CLI script
                        documented in <strong>JSON Spec & Docs</strong>.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* JSON Specification & Local FFmpeg Documentation Modal */}
      {showDocsModal && (
        <div
          id="docs-modal-backdrop"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-sky-400" />
                <h2 className="text-base font-bold text-white">
                  JSON Scene Specification (v1.0) & Local FFmpeg Render Workflow
                </h2>
              </div>
              <button
                id="btn-close-docs"
                type="button"
                onClick={() => setShowDocsModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs leading-relaxed text-slate-300 select-text">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  1. Composable Scene Primitives (No Fixed Templates)
                </h3>
                <p>
                  Every scene is constructed from composable primitives:{' '}
                  <code className="text-sky-300">group</code>,{' '}
                  <code className="text-sky-300">use</code> (reusable{' '}
                  <code className="text-sky-300">defs</code> symbols with circular
                  reference protection), <code className="text-sky-300">rect</code>,{' '}
                  <code className="text-sky-300">circle</code>,{' '}
                  <code className="text-sky-300">ellipse</code>,{' '}
                  <code className="text-sky-300">arc</code>,{' '}
                  <code className="text-sky-300">line</code>,{' '}
                  <code className="text-sky-300">polyline</code>,{' '}
                  <code className="text-sky-300">polygon</code>,{' '}
                  <code className="text-sky-300">path</code> (SVG cubic/quadratic
                  curves with <code className="text-sky-300">morphTo</code> shape
                  morphing and <code className="text-sky-300">trimStart/trimEnd</code>{' '}
                  line drawing), <code className="text-sky-300">connector</code> /{' '}
                  <code className="text-sky-300">arrow</code>,{' '}
                  <code className="text-sky-300">text</code>,{' '}
                  <code className="text-sky-300">callout</code>, and{' '}
                  <code className="text-sky-300">chart</code>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-sky-300 mb-1">
                    Transform & 2.5D Depth Properties
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    <li>
                      <code>x, y, z, pivotX, pivotY</code> — Coordinates & custom
                      transform origin
                    </li>
                    <li>
                      <code>scale, scaleX, scaleY, rotation, skewX, skewY</code>
                    </li>
                    <li>
                      <code>opacity, visible, startTime, endTime, zIndex</code>
                    </li>
                    <li>
                      <code>depth25d: &#123; extrudeX, extrudeY, extrudeColor, tiltX, tiltY, elevation &#125;</code>
                    </li>
                    <li>
                      <code>clip: &#123; type: "rect"|"circle"|"polygon"|"path", ... &#125;</code>
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-emerald-300 mb-1">
                    Deterministic Keyframes & Easings
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    <li>
                      <code>keyframes: [&#123; time, x, y, scale, rotation, opacity, fill, trimEnd, ... &#125;]</code>
                    </li>
                    <li>
                      <code>tracks: &#123; propName: [&#123; time, value, easing &#125;] &#125;</code>
                    </li>
                    <li>
                      <code>easing</code>: <code>"linear"</code>,{' '}
                      <code>"easeInOutCubic"</code>, <code>"easeOutBack"</code>,{' '}
                      <code>"spring"</code>, or{' '}
                      <code>["cubic-bezier", x1, y1, x2, y2]</code>
                    </li>
                    <li>
                      Omitted animation properties remain strictly static — no
                      unsolicited motion is ever added.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <h4 className="font-bold text-amber-300 mb-1">
                  2. Local Deterministic FFmpeg H.264 MP4 Rendering Workflow
                </h4>
                <p className="text-[11px] mb-2">
                  While browser export encodes 1920×1080 WebM/MP4 directly via{' '}
                  <code>MediaRecorder</code>, you can also render exact frame-by-frame
                  lossless PNG sequences into an H.264 MP4 container locally using the
                  included CLI script:
                </p>
                <pre className="bg-slate-900 p-2.5 rounded-lg font-mono text-[11px] text-sky-200 overflow-x-auto">
                  {`# Render any JSON scene deterministically at 1920x1080 @ 30 or 60 FPS via Chromium + FFmpeg:
python3 scripts/render_scene_video.py --input src/samples/scene1_stick_explainer.json --output out.mp4 --fps 30`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
