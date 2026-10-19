import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Download,
  Upload,
  Check,
  Copy,
  AlertCircle,
  AlertTriangle,
  Grid,
  Shield,
  Wand2,
  Trash2,
  FolderDown,
  FileJson,
  Film,
  Layers,
  Code2,
  Tv,
  Smartphone,
  Monitor,
  BookOpen,
  CheckCircle2,
  FileCode,
} from 'lucide-react';
import {
  SceneNode,
  SceneProjectFile,
  SceneSpecification,
  ValidationIssue,
} from './types/scene';
import { SAMPLE_SCENES } from './samples/sampleScenes';
import { validateSceneJson } from './engine/validator';
import { renderSceneFrame } from './engine/renderer';
import { evaluateNodeAtTime } from './engine/timeline';
import {
  exportSceneToVideo,
  isWebCodecsMp4Supported,
  VideoExportResult,
} from './engine/videoExporter';
import {
  AcceptanceTestResult,
  runMandatoryAcceptanceTests,
} from './engine/acceptanceTests';
import { generateStandaloneHtmlBundle } from './engine/standaloneExporter';
import { JsonCodeEditor } from './components/JsonCodeEditor';
import { SchemaDocsModal } from './components/SchemaDocsModal';
import { AcceptanceModal } from './components/AcceptanceModal';
import { QuickInsertBar } from './components/QuickInsertBar';
import { TouchPropertySliders } from './components/TouchPropertySliders';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AndroidApkModal } from './components/AndroidApkModal';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';

type MobileTab = 'stage' | 'editor' | 'inspector' | 'export';
type BottomTab = 'inspector' | 'diagnostics' | 'export';

export default function App() {
  const initialSpec = SAMPLE_SCENES[0].spec;
  const [rawJson, setRawJson] = useState<string>(() =>
    JSON.stringify(initialSpec, null, 2)
  );
  const [activeScene, setActiveScene] = useState<SceneSpecification>(initialSpec);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [cursorLine, setCursorLine] = useState<number>(1);

  // Mobile-First Navigation State (< 1024px)
  const [mobileTab, setMobileTab] = useState<MobileTab>('stage');

  // Playback & Timeline State
  // CRITICAL PERFORMANCE FIX: During 60fps playback, we drive the canvas, scrubber, and timecode
  // directly via refs inside requestAnimationFrame so React does NOT re-render the full DOM 60 times/sec!
  const currentTimeRef = useRef<number>(0);
  const [inspectorTime, setInspectorTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [loopPlayback, setLoopPlayback] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Canvas Viewport & Aspect Ratio (16:9 Standard 1920x1080 vs 9:16 Shorts 1080x1920)
  const [aspectMode, setAspectMode] = useState<'16:9' | '9:16'>('16:9');
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [showSafeGuides, setShowSafeGuides] = useState<boolean>(false);
  const [showCoordinateGrid, setShowCoordinateGrid] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Desktop Drawer & Modals
  const [bottomTab, setBottomTab] = useState<BottomTab>('inspector');
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);
  const [isAcceptanceOpen, setIsAcceptanceOpen] = useState<boolean>(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState<boolean>(false);
  const [acceptanceResults, setAcceptanceResults] = useState<AcceptanceTestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Video Export State
  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm'>(() =>
    isWebCodecsMp4Supported() ? 'mp4' : 'webm'
  );
  const [exportFps, setExportFps] = useState<30 | 60>(30);
  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{
    currentFrame: number;
    totalFrames: number;
    percent: number;
    phase: string;
    elapsedMs: number;
  } | null>(null);
  const [lastExportResult, setLastExportResult] = useState<VideoExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  // Direct DOM refs for zero-lag 60fps canvas & timeline updates
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const scrubberInputRef = useRef<HTMLInputElement>(null);
  const timecodeSpanRef = useRef<HTMLSpanElement>(null);
  const frameReadoutSpanRef = useRef<HTMLSpanElement>(null);
  const viewportContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewportBounds, setViewportBounds] = useState<{ width: number; height: number }>({
    width: 360,
    height: 240,
  });

  // Output target resolution based on active aspect mode (16:9 1920x1080 or 9:16 1080x1920)
  const targetDimensions = useMemo(() => {
    const isVertical =
      aspectMode === '9:16' || activeScene.meta.height > activeScene.meta.width;
    return isVertical
      ? { width: 1080, height: 1920, label: '1080×1920 (9:16 Shorts)' }
      : { width: 1920, height: 1080, label: '1920×1080 (16:9 HD)' };
  }, [aspectMode, activeScene.meta.width, activeScene.meta.height]);

  const totalFrames = Math.round(activeScene.meta.duration * activeScene.meta.fps);

  // Measure viewport container reliably across mobile & desktop tabs
  useEffect(() => {
    const el = viewportContainerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 20 && rect.height > 20) {
        setViewportBounds({ width: rect.width, height: rect.height });
      }
    };
    measure();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 20 && height > 20) {
          setViewportBounds({ width, height });
        }
      }
    });
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [mobileTab, aspectMode]);

  // Calculate responsive display dimensions for the 16:9 or 9:16 canvas
  const canvasDisplaySize = useMemo(() => {
    const pad = 20;
    const availW = Math.max(220, viewportBounds.width - pad);
    const availH = Math.max(150, viewportBounds.height - pad);
    const aspect = targetDimensions.width / targetDimensions.height;

    let fitW = availW;
    let fitH = availW / aspect;
    if (fitH > availH) {
      fitH = availH;
      fitW = availH * aspect;
    }

    if (zoomMode === 'fit') {
      return {
        width: Math.max(180, Math.round(fitW)),
        height: Math.max(101, Math.round(fitH)),
        scalePercent: Math.max(10, Math.round((fitW / targetDimensions.width) * 100)),
      };
    }

    return {
      width: Math.round(targetDimensions.width * zoomMode),
      height: Math.round(targetDimensions.height * zoomMode),
      scalePercent: Math.round(zoomMode * 100),
    };
  }, [viewportBounds, zoomMode, targetDimensions]);

  // Helper to paint a single frame and update scrubber/timecode DOM directly without React lag
  const paintFrameAndSyncTransport = useCallback(
    (timeSec: number) => {
      currentTimeRef.current = timeSec;
      const canvas = previewCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderSceneFrame(ctx, activeScene, timeSec, {
            targetWidth: targetDimensions.width,
            targetHeight: targetDimensions.height,
            showSafeGuides,
            showCoordinateGrid,
            selectedNodeId,
          });
        }
      }

      if (scrubberInputRef.current) {
        scrubberInputRef.current.value = String(timeSec);
      }
      if (timecodeSpanRef.current) {
        timecodeSpanRef.current.textContent = `${timeSec.toFixed(2)}s / ${activeScene.meta.duration.toFixed(1)}s`;
      }
      if (frameReadoutSpanRef.current) {
        const fIdx = Math.min(totalFrames, Math.round(timeSec * activeScene.meta.fps));
        frameReadoutSpanRef.current.textContent = `F${String(fIdx).padStart(3, '0')}/${String(totalFrames).padStart(3, '0')}`;
      }
    },
    [
      activeScene,
      targetDimensions,
      showSafeGuides,
      showCoordinateGrid,
      selectedNodeId,
      totalFrames,
    ]
  );

  // Seek to an exact timestamp (used by scrubber, step buttons, restart)
  const seekToTime = useCallback(
    (nextTime: number) => {
      const clamped = Math.max(0, Math.min(activeScene.meta.duration, nextTime));
      paintFrameAndSyncTransport(clamped);
      setInspectorTime(clamped);
    },
    [activeScene.meta.duration, paintFrameAndSyncTransport]
  );

  // Explicit "Render Scene" action: validates JSON and updates the rendered scene
  const handleRenderScene = useCallback(
    (jsonToValidate?: string, switchMobileToStage = false) => {
      const targetJson = jsonToValidate !== undefined ? jsonToValidate : rawJson;
      const res = validateSceneJson(targetJson);
      setValidationIssues(res.issues);

      if (res.valid && res.scene) {
        setActiveScene(res.scene);
        setExportFps(res.scene.meta.fps);
        setAspectMode(
          res.scene.meta.height > res.scene.meta.width ? '9:16' : '16:9'
        );
        setIsDirty(false);
        if (currentTimeRef.current > res.scene.meta.duration) {
          currentTimeRef.current = 0;
          setInspectorTime(0);
        }
        if (switchMobileToStage) {
          setMobileTab('stage');
        }
        if (res.issues.length > 0) {
          setBottomTab('diagnostics');
        }
      } else {
        setBottomTab('diagnostics');
        setIsPlaying(false);
      }
    },
    [rawJson]
  );

  // Toggle between 16:9 (1920x1080) and 9:16 (1080x1920 YouTube Shorts)
  const handleToggleAspectMode = (nextMode: '16:9' | '9:16') => {
    setAspectMode(nextMode);
    const nextW = nextMode === '16:9' ? 1920 : 1080;
    const nextH = nextMode === '16:9' ? 1080 : 1920;

    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && typeof parsed === 'object' && parsed.meta) {
        parsed.meta.width = nextW;
        parsed.meta.height = nextH;
        const updatedJson = JSON.stringify(parsed, null, 2);
        setRawJson(updatedJson);
        handleRenderScene(updatedJson);
      }
    } catch {
      setActiveScene((prev) => ({
        ...prev,
        meta: { ...prev.meta, width: nextW, height: nextH },
      }));
    }
  };

  // Quick-insert a composable primitive directly into JSON `elements`
  const handleInsertPrimitive = (newNode: SceneNode) => {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && Array.isArray(parsed.elements)) {
        parsed.elements.push(newNode);
        const updatedJson = JSON.stringify(parsed, null, 2);
        setRawJson(updatedJson);
        handleRenderScene(updatedJson);
        setSelectedNodeId(newNode.id);
      }
    } catch {
      const nextScene: SceneSpecification = {
        ...activeScene,
        elements: [...activeScene.elements, newNode],
      };
      const updatedJson = JSON.stringify(nextScene, null, 2);
      setRawJson(updatedJson);
      handleRenderScene(updatedJson);
      setSelectedNodeId(newNode.id);
    }
  };

  // Update a node's property via Touch Sliders and synchronize back to rawJson
  const handleUpdateNodeProperty = (
    nodeId: string,
    prop: 'x' | 'y' | 'scale' | 'rotation' | 'opacity',
    value: number
  ) => {
    const mutateNodes = (nodes: SceneNode[]): SceneNode[] =>
      nodes.map((n) => {
        if (n.id === nodeId) {
          const updated: SceneNode = { ...n, [prop]: value };
          if (Array.isArray(updated.animations)) {
            updated.animations = updated.animations.map((tr) =>
              tr.property === prop ? { ...tr, to: value } : tr
            );
          }
          return updated;
        }
        if (Array.isArray(n.children)) {
          return { ...n, children: mutateNodes(n.children) };
        }
        return n;
      });

    const nextScene: SceneSpecification = {
      ...activeScene,
      elements: mutateNodes(activeScene.elements),
    };
    const updatedJson = JSON.stringify(nextScene, null, 2);
    setActiveScene(nextScene);
    setRawJson(updatedJson);
    setIsDirty(false);
  };

  // Delete a node from the Scene Graph via Touch Inspector
  const handleDeleteNode = (nodeId: string) => {
    const filterNodes = (nodes: SceneNode[]): SceneNode[] =>
      nodes
        .filter((n) => n.id !== nodeId)
        .map((n) =>
          Array.isArray(n.children)
            ? { ...n, children: filterNodes(n.children) }
            : n
        );

    const nextScene: SceneSpecification = {
      ...activeScene,
      elements: filterNodes(activeScene.elements),
    };
    const updatedJson = JSON.stringify(nextScene, null, 2);
    setActiveScene(nextScene);
    setRawJson(updatedJson);
    setSelectedNodeId(null);
    setIsDirty(false);
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(rawJson);
      const formatted = JSON.stringify(parsed, null, 2);
      setRawJson(formatted);
    } catch {
      handleRenderScene(rawJson);
    }
  };

  const handleClearScene = () => {
    const w = aspectMode === '16:9' ? 1920 : 1080;
    const h = aspectMode === '16:9' ? 1080 : 1920;
    const minimalSpec: SceneSpecification = {
      schemaVersion: '1.0',
      meta: {
        title: 'Custom Blank Scene',
        width: w,
        height: h,
        fps: 30,
        duration: 4,
      },
      background: {
        color: '#090D16',
        grid: { enabled: true, spacing: 80, color: '#1E293B', opacity: 0.25 },
      },
      elements: [
        {
          id: 'headlineText',
          type: 'text',
          x: Math.round(w / 2),
          y: Math.round(h / 2),
          text: 'Define Your Motion Scene in JSON',
          fontFamily: 'Outfit',
          fontSize: aspectMode === '16:9' ? 54 : 42,
          fontWeight: 700,
          textAlign: 'center',
          verticalAlign: 'middle',
          fill: '#F8FAFC',
          animations: [
            {
              property: 'textReveal',
              from: 0,
              to: 1,
              start: 0.1,
              duration: 1.2,
              easing: 'easeOutCubic',
            },
          ],
        },
      ],
    };
    const nextJson = JSON.stringify(minimalSpec, null, 2);
    setRawJson(nextJson);
    handleRenderScene(nextJson);
    seekToTime(0);
  };

  const handleLoadSample = (sampleId: string) => {
    const found = SAMPLE_SCENES.find((s) => s.id === sampleId);
    if (!found) return;
    const formatted = JSON.stringify(found.spec, null, 2);
    setRawJson(formatted);
    setActiveScene(found.spec);
    setExportFps(found.spec.meta.fps);
    setAspectMode('16:9');
    setValidationIssues([]);
    setIsDirty(false);
    setSelectedNodeId(null);
    currentTimeRef.current = 0;
    setInspectorTime(0);
    setIsPlaying(true);
  };

  // Zero-Lag 60fps requestAnimationFrame Loop (bypasses React state re-renders!)
  useEffect(() => {
    // Always paint current frame immediately when dependencies change
    paintFrameAndSyncTransport(currentTimeRef.current);

    if (!isPlaying || isExportingVideo) return;

    let rafId: number;
    let lastPerf = performance.now();
    let lastInspectorSync = lastPerf;
    const duration = Math.max(0.5, activeScene.meta.duration || 5);

    const tick = (now: number) => {
      const dt = ((now - lastPerf) / 1000) * playbackSpeed;
      lastPerf = now;

      let next = currentTimeRef.current + dt;
      if (next >= duration) {
        if (loopPlayback) {
          next = 0;
        } else {
          paintFrameAndSyncTransport(duration);
          setInspectorTime(duration);
          setIsPlaying(false);
          return;
        }
      }

      paintFrameAndSyncTransport(next);

      // Throttle React state update for the Inspector table to 4 times/sec (every 250ms)
      if (now - lastInspectorSync > 250) {
        setInspectorTime(next);
        lastInspectorSync = now;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    isPlaying,
    isExportingVideo,
    activeScene,
    loopPlayback,
    playbackSpeed,
    paintFrameAndSyncTransport,
  ]);

  // Flatten scene graph for the Element & Keyframe Inspector
  const flattenedNodes = useMemo(() => {
    const list: Array<{ node: SceneNode; depth: number }> = [];
    const walk = (nodes: SceneNode[], depth: number) => {
      for (const n of nodes) {
        list.push({ node: n, depth });
        if (Array.isArray(n.children) && n.children.length > 0) {
          walk(n.children, depth + 1);
        }
      }
    };
    walk(activeScene.elements || [], 0);
    return list;
  }, [activeScene]);

  const selectedNodeObj = useMemo(() => {
    if (!selectedNodeId) return null;
    const found = flattenedNodes.find((item) => item.node.id === selectedNodeId);
    return found ? found.node : null;
  }, [flattenedNodes, selectedNodeId]);

  const handleCopyErrorReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      sceneTitle: activeScene.meta.title,
      valid: !validationIssues.some((i) => i.severity === 'error'),
      issueCount: validationIssues.length,
      issues: validationIssues,
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 1800);
  };

  // Download Single-File Standalone `index.html` (Zero folders needed for GitHub upload!)
  const handleDownloadStandaloneHtml = () => {
    const htmlContent = generateStandaloneHtmlBundle(activeScene, rawJson);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    triggerDownload(blob, 'index.html');
  };

  // Export Project File (.kinetic-project.json) or standalone Scene JSON
  const handleSaveProjectFile = (rawOnly: boolean) => {
    const slug = (activeScene.meta.title || 'scene')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');

    if (rawOnly) {
      const blob = new Blob([rawJson], { type: 'application/json' });
      triggerDownload(blob, `${slug}-scene.json`);
      return;
    }

    const fontsSet = new Set<string>(['Outfit', 'Plus Jakarta Sans', 'JetBrains Mono']);
    flattenedNodes.forEach(({ node }) => {
      if (node.fontFamily) fontsSet.add(node.fontFamily);
    });

    const projectFile: SceneProjectFile = {
      projectFormat: 'kinetic-json-scene-project',
      schemaVersion: activeScene.schemaVersion || '1.0',
      rendererVersion: '1.0.0',
      savedAt: new Date().toISOString(),
      exportSettings: {
        format: exportFormat,
        fps: exportFps,
        resolution: '1920x1080',
      },
      fontsRequired: Array.from(fontsSet),
      rawJson,
      scene: activeScene,
    };

    const blob = new Blob([JSON.stringify(projectFile, null, 2)], {
      type: 'application/json',
    });
    triggerDownload(blob, `${slug}.kinetic-project.json`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      try {
        const parsed = JSON.parse(content);
        if (parsed.projectFormat === 'kinetic-json-scene-project' && parsed.rawJson) {
          setRawJson(parsed.rawJson);
          if (parsed.exportSettings?.fps) setExportFps(parsed.exportSettings.fps);
          if (parsed.exportSettings?.format) setExportFormat(parsed.exportSettings.format);
          handleRenderScene(parsed.rawJson, true);
        } else {
          const formatted = JSON.stringify(parsed, null, 2);
          setRawJson(formatted);
          handleRenderScene(formatted, true);
        }
        seekToTime(0);
      } catch {
        setRawJson(content);
        handleRenderScene(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleStartVideoExport = async () => {
    const check = validateSceneJson(rawJson);
    setValidationIssues(check.issues);
    if (!check.valid || !check.scene) {
      setBottomTab('diagnostics');
      setMobileTab('inspector');
      return;
    }

    setActiveScene(check.scene);
    setIsDirty(false);
    setIsPlaying(false);
    setIsExportingVideo(true);
    setExportError(null);
    setLastExportResult(null);
    setBottomTab('export');
    setMobileTab('export');

    const abortController = new AbortController();
    exportAbortRef.current = abortController;

    try {
      const result = await exportSceneToVideo(check.scene, {
        format: exportFormat,
        fps: exportFps,
        width: targetDimensions.width,
        height: targetDimensions.height,
        signal: abortController.signal,
        onProgress: (prog) => {
          setExportProgress(prog);
          const t = Math.min(
            check.scene!.meta.duration,
            (prog.currentFrame / prog.totalFrames) * check.scene!.meta.duration
          );
          paintFrameAndSyncTransport(t);
        },
      });
      setLastExportResult(result);
      seekToTime(check.scene.meta.duration);
      triggerDownload(result.blob, result.filename);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExportingVideo(false);
      exportAbortRef.current = null;
    }
  };

  const handleCancelExport = () => {
    exportAbortRef.current?.abort();
  };

  const handleRunAcceptanceSuite = async () => {
    setIsAcceptanceOpen(true);
    setIsRunningTests(true);
    const res = await runMandatoryAcceptanceTests(activeScene);
    setAcceptanceResults(res);
    setIsRunningTests(false);
  };

  const handleEditorChange = useCallback((val: string) => {
    setRawJson(val);
    setIsDirty(true);
  }, []);

  const errorCount = validationIssues.filter((i) => i.severity === 'error').length;
  const warningCount = validationIssues.filter((i) => i.severity === 'warning').length;

  return (
    <ErrorBoundary onResetScene={() => handleLoadSample('character-explainer')}>
      <div className="flex flex-col h-dvh w-full bg-[#090D16] text-slate-100 select-none overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportFile}
          className="hidden"
        />

        {/* Top Bar Contract: 3 Zones separated by gap-8 */}
        <header className="h-[52px] flex items-center justify-between gap-4 lg:gap-8 px-4 lg:px-6 bg-[#090D16] border-b border-slate-800/90 shrink-0 z-30">
          {/* Zone 1: Single text element Brand wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setMobileTab('stage');
            }}
            className="text-base lg:text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
          >
            KineticJSON Studio
          </a>

          {/* Zone 2: 4–5 single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <a
              href="#character-scene"
              onClick={(e) => {
                e.preventDefault();
                handleLoadSample('character-explainer');
              }}
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Character Scene
            </a>
            <a
              href="#analytics-scene"
              onClick={(e) => {
                e.preventDefault();
                handleLoadSample('data-benchmark');
              }}
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Analytics Scene
            </a>
            <a
              href="#morph-scene"
              onClick={(e) => {
                e.preventDefault();
                handleLoadSample('vector-morph-opener');
              }}
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Morph Scene
            </a>
            <a
              href="#specification"
              onClick={(e) => {
                e.preventDefault();
                setIsDocsOpen(true);
              }}
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Specification
            </a>
            <a
              href="#android-apk"
              onClick={(e) => {
                e.preventDefault();
                if (isInstallable && !isInstalled) {
                  install();
                } else {
                  setIsApkModalOpen(true);
                }
              }}
              className="text-sky-400 hover:text-sky-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Android APK
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action Button */}
          <div className="flex items-center shrink-0">
            <button
              onClick={handleStartVideoExport}
              disabled={isExportingVideo}
              className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 active:scale-[0.98] disabled:opacity-50 rounded-lg transition-all whitespace-nowrap shrink-0"
            >
              {isExportingVideo ? 'Exporting Clip...' : 'Export 1080p Video'}
            </button>
          </div>
        </header>

        {/* Main Responsive Workspace */}
        <div className="flex flex-1 min-h-0 overflow-hidden pb-14 lg:pb-0">
          {/* LEFT PANE: JSON Editor & Project Controls */}
          <aside
            className={`${
              mobileTab === 'editor' ? 'flex w-full' : 'hidden'
            } lg:flex lg:w-[460px] xl:w-[540px] flex-col border-r border-slate-800/90 bg-[#0B101B] shrink-0 min-h-0`}
          >
            {/* Editor Action Toolbar */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800/90 bg-[#0F172A] overflow-x-auto no-scrollbar shrink-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleRenderScene(rawJson, true)}
                  className={`min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isDirty
                      ? 'bg-sky-400 text-slate-950 hover:bg-sky-300'
                      : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Render Scene</span>
                </button>

                <button
                  onClick={handleFormatJson}
                  title="Format JSON indentation"
                  className="min-h-[38px] flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Format</span>
                </button>

                <button
                  onClick={handleClearScene}
                  title="Reset to minimal JSON scene"
                  className="min-h-[38px] flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>

              {/* Project Save / Open / Single-File HTML Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Open saved .kinetic-project.json or .json scene file"
                  className="min-h-[38px] flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Open</span>
                </button>
                <button
                  onClick={() => handleSaveProjectFile(false)}
                  title="Save complete project file (.kinetic-project.json)"
                  className="min-h-[38px] flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <FolderDown className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
                <button
                  onClick={handleDownloadStandaloneHtml}
                  title="Download 1-file index.html (No folders needed — upload directly to GitHub Pages)"
                  className="min-h-[38px] flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:text-white bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>1-File HTML</span>
                </button>
              </div>
            </div>

            {/* Quick-Insert Composable Primitives Bar */}
            <QuickInsertBar
              onInsertPrimitive={handleInsertPrimitive}
              canvasWidth={activeScene.meta.width || 1920}
              canvasHeight={activeScene.meta.height || 1080}
            />

            {/* Sample Scene Selector Bar */}
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-slate-800/80 bg-[#090D16] text-xs shrink-0">
              <span className="text-slate-400 font-medium whitespace-nowrap shrink-0">
                Load Example:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {SAMPLE_SCENES.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => handleLoadSample(s.id)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      activeScene.meta.title === s.spec.meta.title
                        ? 'bg-slate-800 text-sky-300 border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    Scene 0{idx + 1}
                  </button>
                ))}
                <button
                  onClick={() => setIsDocsOpen(true)}
                  className="min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 whitespace-nowrap shrink-0"
                >
                  <BookOpen className="w-3 h-3 text-sky-400" />
                  <span>Docs</span>
                </button>
              </div>
            </div>

            {/* Memoized Code Editor Surface */}
            <JsonCodeEditor
              value={rawJson}
              onChange={handleEditorChange}
              issues={validationIssues}
              onCursorLineChange={setCursorLine}
            />

            {/* Editor Footer Metadata Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800/90 bg-[#0F172A] text-xs text-slate-400 tabular-nums shrink-0">
              <div className="flex items-center gap-2 truncate">
                <span>Line {cursorLine}</span>
                <span aria-hidden="true">·</span>
                <span>{rawJson.split('\n').length} lines</span>
                <span aria-hidden="true">·</span>
                <span>{isDirty ? 'Unsaved edits' : 'Synced'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {errorCount > 0 ? (
                  <button
                    onClick={() => {
                      setBottomTab('diagnostics');
                      setMobileTab('inspector');
                    }}
                    className="text-red-400 font-medium flex items-center gap-1 hover:underline"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errorCount} {errorCount === 1 ? 'Error' : 'Errors'}
                  </button>
                ) : warningCount > 0 ? (
                  <button
                    onClick={() => {
                      setBottomTab('diagnostics');
                      setMobileTab('inspector');
                    }}
                    className="text-amber-400 font-medium flex items-center gap-1 hover:underline"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {warningCount} {warningCount === 1 ? 'Warning' : 'Warnings'}
                  </button>
                ) : (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Schema Valid
                  </span>
                )}
              </div>
            </div>
          </aside>

          {/* RIGHT PANE: Stage, Transport Scrubber & Inspector/Export Drawer */}
          <main
            className={`${
              mobileTab !== 'editor' ? 'flex w-full' : 'hidden'
            } lg:flex flex-1 flex-col min-w-0 bg-[#090D16] overflow-hidden`}
          >
            {/* STAGE VIEWPORT & TRANSPORT */}
            <div
              className={`${
                mobileTab === 'stage' ? 'flex flex-1' : 'hidden'
              } lg:flex lg:flex-1 flex-col min-h-0 overflow-hidden`}
            >
              {/* Canvas Viewport Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 lg:px-5 py-2 border-b border-slate-800/90 bg-[#0F172A] text-xs shrink-0">
                <div className="flex items-center gap-2 text-slate-300 truncate tabular-nums">
                  <span className="font-semibold text-white truncate max-w-[160px] sm:max-w-xs">
                    {activeScene.meta.title}
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="hidden sm:inline">{targetDimensions.label}</span>
                  <span aria-hidden="true" className="hidden sm:inline text-slate-600">·</span>
                  <span>{activeScene.meta.fps} FPS</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>{activeScene.meta.duration.toFixed(1)}s</span>
                </div>

                {/* Aspect Ratio Toggle & Viewport Zoom/Guides */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                  <div className="flex items-center gap-0.5 bg-[#090D16] p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleToggleAspectMode('16:9')}
                      className={`min-h-[30px] flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        aspectMode === '16:9'
                          ? 'bg-slate-800 text-sky-300'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>16:9</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAspectMode('9:16')}
                      className={`min-h-[30px] flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        aspectMode === '9:16'
                          ? 'bg-slate-800 text-sky-300'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>9:16 Shorts</span>
                    </button>
                  </div>

                  <div className="hidden sm:flex items-center gap-0.5 bg-[#090D16] p-0.5 rounded-lg border border-slate-800 tabular-nums">
                    <button
                      onClick={() => setZoomMode('fit')}
                      className={`min-h-[30px] px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        zoomMode === 'fit'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Fit ({canvasDisplaySize.scalePercent}%)
                    </button>
                    <button
                      onClick={() => setZoomMode(0.5)}
                      className={`min-h-[30px] px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        zoomMode === 0.5
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      50%
                    </button>
                    <button
                      onClick={() => setZoomMode(1)}
                      className={`min-h-[30px] px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        zoomMode === 1
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      100%
                    </button>
                  </div>

                  <button
                    onClick={() => setShowCoordinateGrid((v) => !v)}
                    title="Toggle coordinate ruler overlay"
                    className={`min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      showCoordinateGrid
                        ? 'bg-sky-950/60 border-sky-500/50 text-sky-300'
                        : 'bg-[#090D16] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Coords</span>
                  </button>

                  <button
                    onClick={() => setShowSafeGuides((v) => !v)}
                    title="Toggle YouTube 90% action-safe and 80% title-safe broadcast guides"
                    className={`min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      showSafeGuides
                        ? 'bg-sky-950/60 border-sky-500/50 text-sky-300'
                        : 'bg-[#090D16] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Safe Area</span>
                  </button>
                </div>
              </div>

              {/* Mobile Quick Example Switcher Strip */}
              <div className="flex lg:hidden items-center justify-between gap-2 px-3 py-2 bg-[#0B101B] border-b border-slate-800/80 text-xs overflow-x-auto no-scrollbar shrink-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  {SAMPLE_SCENES.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => handleLoadSample(s.id)}
                      className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        activeScene.meta.title === s.spec.meta.title
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          : 'bg-slate-900 text-slate-300 border border-slate-800'
                      }`}
                    >
                      Scene 0{idx + 1}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      if (isInstallable && !isInstalled) {
                        install();
                      } else {
                        setIsApkModalOpen(true);
                      }
                    }}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-sky-950/70 text-sky-300 border border-sky-700/60 text-xs font-medium whitespace-nowrap"
                  >
                    Get APK
                  </button>
                  <button
                    onClick={handleDownloadStandaloneHtml}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 text-xs font-medium whitespace-nowrap"
                  >
                    1-File HTML
                  </button>
                  <button
                    onClick={() => setIsDocsOpen(true)}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 text-xs font-medium whitespace-nowrap"
                  >
                    Spec
                  </button>
                </div>
              </div>

              {/* Stage Viewport Container */}
              <div
                ref={viewportContainerRef}
                className="relative flex-1 min-h-[200px] flex items-center justify-center overflow-auto bg-[#060911] p-2 sm:p-4"
              >
                <div
                  style={{
                    width: `${canvasDisplaySize.width}px`,
                    height: `${canvasDisplaySize.height}px`,
                  }}
                  className="relative shrink-0 shadow-2xl border border-slate-800 bg-[#090D16] overflow-hidden rounded-sm"
                >
                  <canvas
                    ref={previewCanvasRef}
                    width={targetDimensions.width}
                    height={targetDimensions.height}
                    className="w-full h-full block"
                  />
                </div>
              </div>

              {/* Deterministic Timeline Transport & Frame Scrubber (Direct ref updates for zero-lag 60fps) */}
              <div className="px-3 sm:px-5 py-2.5 bg-[#0F172A] border-t border-slate-800/90 flex flex-col gap-2 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        seekToTime(0);
                      }}
                      title="Jump to start (Frame 0)"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        seekToTime(currentTimeRef.current - 1 / activeScene.meta.fps);
                      }}
                      title="Step backward 1 frame"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (currentTimeRef.current >= activeScene.meta.duration) {
                          seekToTime(0);
                        }
                        setIsPlaying((p) => !p);
                      }}
                      className="min-h-[40px] flex items-center gap-1.5 px-4 py-1.5 bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4 h-4 fill-current" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>Play</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        seekToTime(currentTimeRef.current + 1 / activeScene.meta.fps);
                      }}
                      title="Step forward 1 frame"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Uncontrolled Ref-Driven Scrubber Input for silky 60fps motion */}
                  <div className="flex-1 min-w-[140px] flex items-center">
                    <input
                      ref={scrubberInputRef}
                      type="range"
                      min={0}
                      max={activeScene.meta.duration}
                      step={1 / activeScene.meta.fps}
                      defaultValue={0}
                      onChange={(e) => {
                        setIsPlaying(false);
                        seekToTime(parseFloat(e.target.value));
                      }}
                      aria-label="Timeline scrubber"
                      className="w-full accent-sky-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                  </div>

                  {/* Direct DOM Timecode & Frame Readout */}
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-300 tabular-nums shrink-0">
                    <span ref={timecodeSpanRef}>
                      0.00s / {activeScene.meta.duration.toFixed(1)}s
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span ref={frameReadoutSpanRef}>
                      F000/{String(totalFrames).padStart(3, '0')}
                    </span>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setLoopPlayback((l) => !l)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        loopPlayback
                          ? 'bg-slate-800 text-sky-300 border border-slate-700'
                          : 'text-slate-400 hover:text-white bg-slate-900'
                      }`}
                    >
                      Loop
                    </button>
                    <select
                      value={playbackSpeed}
                      onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                      aria-label="Playback speed"
                      className="min-h-[34px] bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded-lg border border-slate-700 focus:outline-none tabular-nums"
                    >
                      <option value={0.25}>0.25x</option>
                      <option value={0.5}>0.5x</option>
                      <option value={1}>1.0x</option>
                      <option value={1.5}>1.5x</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM / MOBILE STUDIO DRAWER */}
            <div
              className={`${
                mobileTab === 'inspector' || mobileTab === 'export'
                  ? 'flex flex-1'
                  : 'hidden'
              } lg:flex lg:h-64 flex-col border-t border-slate-800/90 bg-[#0B101B] shrink-0 min-h-0`}
            >
              <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2 border-b border-slate-800/80 bg-[#090D16] overflow-x-auto no-scrollbar shrink-0">
                <div className="flex items-center gap-1 bg-[#0F172A] p-0.5 rounded-lg border border-slate-800">
                  <button
                    onClick={() => {
                      setBottomTab('inspector');
                      if (mobileTab === 'export') setMobileTab('inspector');
                    }}
                    className={`min-h-[34px] flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      bottomTab === 'inspector' && mobileTab !== 'export'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Inspector & Touch Sliders ({flattenedNodes.length})</span>
                  </button>
                  <button
                    onClick={() => {
                      setBottomTab('diagnostics');
                      if (mobileTab === 'export') setMobileTab('inspector');
                    }}
                    className={`min-h-[34px] flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      bottomTab === 'diagnostics' && mobileTab !== 'export'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Diagnostics ({validationIssues.length})</span>
                  </button>
                  <button
                    onClick={() => {
                      setBottomTab('export');
                    }}
                    className={`min-h-[34px] flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      bottomTab === 'export' || mobileTab === 'export'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Video & GitHub Export</span>
                  </button>
                </div>

                {bottomTab === 'diagnostics' && (
                  <button
                    onClick={handleCopyErrorReport}
                    className="min-h-[34px] flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    {copiedReport ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Report</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Tab 1: Scene Graph & Interactive Touch Sliders */}
              {bottomTab === 'inspector' && mobileTab !== 'export' && (
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                  <TouchPropertySliders
                    selectedNode={selectedNodeObj}
                    canvasWidth={activeScene.meta.width || 1920}
                    canvasHeight={activeScene.meta.height || 1080}
                    onUpdateNodeProperty={handleUpdateNodeProperty}
                    onDeleteNode={handleDeleteNode}
                  />

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-[#0F172A] text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-4 font-medium">Element ID</th>
                          <th className="py-2 px-3 font-medium">Primitive</th>
                          <th className="py-2 px-3 font-medium text-right">Pos (X, Y)</th>
                          <th className="py-2 px-3 font-medium text-right">Scale / Rot</th>
                          <th className="py-2 px-3 font-medium text-right">Opacity</th>
                          <th className="py-2 px-4 font-medium">Keyframes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                        {flattenedNodes.map(({ node, depth }) => {
                          const live = evaluateNodeAtTime(node, inspectorTime);
                          const isSelected = selectedNodeId === node.id;
                          return (
                            <tr
                              key={`${node.id}-${depth}`}
                              onClick={() =>
                                setSelectedNodeId((prev) =>
                                  prev === node.id ? null : node.id
                                )
                              }
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-sky-950/50 text-sky-200'
                                  : 'hover:bg-slate-900/60 text-slate-300'
                              }`}
                            >
                              <td className="py-2.5 px-4">
                                <div
                                  style={{ paddingLeft: `${depth * 14}px` }}
                                  className="flex items-center gap-1.5"
                                >
                                  <span className="text-slate-500">
                                    {depth > 0 ? '└─' : ''}
                                  </span>
                                  <span className="font-semibold text-slate-100">
                                    {node.id}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-sky-400">{node.type}</td>
                              <td className="py-2.5 px-3 text-right text-slate-300">
                                {Math.round(live.x ?? 0)}, {Math.round(live.y ?? 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-300">
                                {live.effectiveScaleX.toFixed(2)}x ·{' '}
                                {Math.round(live.rotation ?? 0)}°
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-300">
                                {(live.effectiveOpacity * 100).toFixed(0)}%
                              </td>
                              <td className="py-2.5 px-4">
                                {Array.isArray(node.animations) &&
                                node.animations.length > 0 ? (
                                  <div className="flex items-center gap-2 flex-wrap font-sans">
                                    {node.animations.map((tr, idx) => {
                                      const activeNow =
                                        inspectorTime >= tr.start &&
                                        inspectorTime <= tr.start + tr.duration;
                                      return (
                                        <span
                                          key={idx}
                                          className={`text-[11px] font-mono ${
                                            activeNow
                                              ? 'text-sky-300 font-semibold'
                                              : 'text-slate-400'
                                          }`}
                                        >
                                          {tr.property} ({tr.start}s–
                                          {(tr.start + tr.duration).toFixed(1)}s)
                                          {idx < node.animations!.length - 1 ? ' · ' : ''}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-slate-600 font-sans">Static</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Validation Diagnostics */}
              {bottomTab === 'diagnostics' && mobileTab !== 'export' && (
                <div className="flex-1 overflow-y-auto p-4">
                  {validationIssues.length === 0 ? (
                    <div className="flex items-center justify-between px-4 py-3.5 bg-[#090D16] border border-slate-800 rounded-xl">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div>
                          <div className="text-sm font-semibold text-slate-100">
                            Zero Validation Errors or Unsupported Property Warnings
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Scene JSON conforms strictly to KineticJSON Schema v1.0. All primitives, symbol references, and keyframe tracks are valid.
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {validationIssues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start justify-between gap-4 px-4 py-3 rounded-xl border text-xs ${
                            issue.severity === 'error'
                              ? 'bg-red-950/25 border-red-800/60 text-red-200'
                              : 'bg-amber-950/25 border-amber-800/60 text-amber-200'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 font-mono">
                              <span className="uppercase font-bold">
                                {issue.severity}
                              </span>
                              <span>·</span>
                              <span>{issue.path}</span>
                              {issue.line && (
                                <>
                                  <span>·</span>
                                  <span>
                                    Line {issue.line}
                                    {issue.column ? `, Col ${issue.column}` : ''}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="text-slate-100 font-medium">
                              {issue.message}
                            </div>
                            {issue.suggestion && (
                              <div className="text-slate-400">
                                Suggestion: {issue.suggestion}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Full 1080p Video Export & Single-File GitHub HTML Export */}
              {(bottomTab === 'export' || mobileTab === 'export') && (
                <div className="flex-1 overflow-y-auto p-4 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2 max-w-xl">
                    <div className="text-sm font-semibold text-white">
                      {targetDimensions.label} Video & Single-File GitHub Exporter
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Export a full 1080p MP4/WebM video clip, or click <strong>Download 1-File index.html</strong> to get a zero-folder standalone HTML file that runs directly on GitHub Pages without any build step.
                    </p>
                    {exportError && (
                      <div className="text-xs text-red-400 font-medium">
                        Export Error: {exportError}
                      </div>
                    )}
                    {lastExportResult && !isExportingVideo && (
                      <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-400 font-mono tabular-nums pt-1">
                        <span>
                          Ready: {lastExportResult.filename} ({lastExportResult.resolution} ·{' '}
                          {lastExportResult.totalFrames} frames ·{' '}
                          {(lastExportResult.blob.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                        <button
                          onClick={() =>
                            triggerDownload(
                              lastExportResult.blob,
                              lastExportResult.filename
                            )
                          }
                          className="underline hover:text-emerald-300 font-sans font-semibold"
                        >
                          Download Again
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Export Configuration & Trigger */}
                  <div className="flex flex-wrap items-end gap-3 shrink-0">
                    {isExportingVideo && exportProgress ? (
                      <div className="w-full sm:w-auto flex items-center gap-4 bg-[#090D16] px-4 py-3 rounded-xl border border-slate-800 tabular-nums">
                        <div className="flex-1 sm:w-52 space-y-1.5">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-sky-400 uppercase">
                              {exportProgress.phase}
                            </span>
                            <span>{exportProgress.percent}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${exportProgress.percent}%` }}
                              className="h-full bg-sky-400 transition-all duration-75"
                            />
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            Frame {exportProgress.currentFrame} /{' '}
                            {exportProgress.totalFrames}
                          </div>
                        </div>
                        <button
                          onClick={handleCancelExport}
                          className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-red-300 bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-slate-400 font-medium">
                            Orientation
                          </label>
                          <select
                            value={aspectMode}
                            onChange={(e) =>
                              handleToggleAspectMode(
                                e.target.value as '16:9' | '9:16'
                              )
                            }
                            className="min-h-[42px] bg-[#090D16] text-slate-100 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none"
                          >
                            <option value="16:9">16:9 (1920×1080 YouTube)</option>
                            <option value="9:16">9:16 (1080×1920 Shorts)</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-slate-400 font-medium">
                            Container & Codec
                          </label>
                          <select
                            value={exportFormat}
                            onChange={(e) =>
                              setExportFormat(e.target.value as 'mp4' | 'webm')
                            }
                            className="min-h-[42px] bg-[#090D16] text-slate-100 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none"
                          >
                            <option value="mp4">MP4 (H.264 / AVC1)</option>
                            <option value="webm">WebM (VP9 / VP8)</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] text-slate-400 font-medium">
                            Frame Rate
                          </label>
                          <select
                            value={exportFps}
                            onChange={(e) =>
                              setExportFps(Number(e.target.value) as 30 | 60)
                            }
                            className="min-h-[42px] bg-[#090D16] text-slate-100 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none tabular-nums"
                          >
                            <option value={30}>30 FPS (Standard)</option>
                            <option value={60}>60 FPS (Smooth)</option>
                          </select>
                        </div>

                        <button
                          onClick={() => setIsApkModalOpen(true)}
                          className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-sky-300 bg-sky-950/60 hover:bg-sky-900/70 border border-sky-700/60 rounded-xl transition-all whitespace-nowrap shrink-0"
                        >
                          <Smartphone className="w-4 h-4" />
                          <span>Android APK / Install App</span>
                        </button>

                        <button
                          onClick={handleDownloadStandaloneHtml}
                          className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-700/60 rounded-xl transition-all whitespace-nowrap shrink-0"
                        >
                          <FileCode className="w-4 h-4" />
                          <span>Download 1-File index.html</span>
                        </button>

                        <button
                          onClick={handleStartVideoExport}
                          className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 active:scale-[0.98] rounded-xl transition-all whitespace-nowrap shrink-0"
                        >
                          <Download className="w-4 h-4" />
                          <span>Render & Download Video</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Fixed Mobile Bottom Navigation Bar (< 1024px) */}
        <nav
          aria-label="Mobile workspace navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-[#090D16]/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-4 items-center"
        >
          <button
            type="button"
            onClick={() => setMobileTab('stage')}
            className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
              mobileTab === 'stage'
                ? 'text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              Stage
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('editor')}
            className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
              mobileTab === 'editor'
                ? 'text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              JSON Editor
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBottomTab('inspector');
              setMobileTab('inspector');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
              mobileTab === 'inspector'
                ? 'text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              Inspector ({flattenedNodes.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBottomTab('export');
              setMobileTab('export');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
              mobileTab === 'export'
                ? 'text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              Export
            </span>
          </button>
        </nav>

        <SchemaDocsModal
          isOpen={isDocsOpen}
          onClose={() => setIsDocsOpen(false)}
        />

        <AcceptanceModal
          isOpen={isAcceptanceOpen}
          onClose={() => setIsAcceptanceOpen(false)}
          results={acceptanceResults}
          isRunning={isRunningTests}
          onRerun={handleRunAcceptanceSuite}
        />

        <AndroidApkModal
          isOpen={isApkModalOpen}
          onClose={() => setIsApkModalOpen(false)}
          onDownloadStandaloneHtml={handleDownloadStandaloneHtml}
        />

        {!isOnline && (
          <div className="fixed top-14 right-4 z-50 px-3 py-1.5 rounded-lg bg-amber-950/90 border border-amber-700 text-amber-200 text-xs font-medium shadow-lg">
            Offline Mode Active — Running from local service worker cache
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
