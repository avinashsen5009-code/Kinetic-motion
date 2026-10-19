// ============================================================================
// Module 6: Deterministic 1080p Video Exporter & Project File Manager
// ============================================================================

import { ProjectFile, SceneSpec } from './schema';
import { renderSceneFrame } from './renderer';
import { BuiltSceneGraph } from './sceneGraph';

export interface VideoExportConfig {
  width: number; // 1920
  height: number; // 1080
  fps: 30 | 60;
  preferredFormat: 'webm' | 'mp4';
  bitrateMbps: number;
}

export interface VideoExportProgress {
  phase: 'preparing' | 'rendering' | 'encoding' | 'complete' | 'error';
  currentFrame: number;
  totalFrames: number;
  percent: number;
  elapsedSeconds: number;
  mimeTypeUsed: string;
  message: string;
}

export interface VideoExportResult {
  blob: Blob;
  url: string;
  filename: string;
  mimeType: string;
  extension: 'webm' | 'mp4';
  totalFrames: number;
  duration: number;
  fps: number;
  width: number;
  height: number;
}

/**
 * Detects supported MediaRecorder MIME types in the current browser environment.
 */
export function getSupportedVideoMimeTypes(): {
  mp4Supported: boolean;
  webmSupported: boolean;
  bestMp4Mime: string | null;
  bestWebmMime: string | null;
} {
  if (typeof MediaRecorder === 'undefined') {
    return {
      mp4Supported: false,
      webmSupported: false,
      bestMp4Mime: null,
      bestWebmMime: null,
    };
  }

  const mp4Candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264',
    'video/mp4',
  ];
  const webmCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm;codecs=h264',
    'video/webm',
  ];

  const bestMp4Mime =
    mp4Candidates.find((m) => MediaRecorder.isTypeSupported(m)) || null;
  const bestWebmMime =
    webmCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || null;

  return {
    mp4Supported: !!bestMp4Mime,
    webmSupported: !!bestWebmMime,
    bestMp4Mime,
    bestWebmMime,
  };
}

/**
 * Deterministically renders every frame from frame 0 to totalFrames at exact 1920x1080 resolution
 * and encodes a complete downloadable video clip.
 */
export async function exportSceneToVideo(
  graph: BuiltSceneGraph,
  config: VideoExportConfig,
  onProgress: (p: VideoExportProgress) => void,
  abortSignal?: { aborted: boolean }
): Promise<VideoExportResult> {
  const startTimeMs = performance.now();
  const width = config.width || 1920;
  const height = config.height || 1080;
  const fps = config.fps || 30;
  const duration = Math.max(0.5, graph.scene.duration || 5);
  const totalFrames = Math.max(1, Math.round(duration * fps));

  const support = getSupportedVideoMimeTypes();
  let chosenMime = 'video/webm';
  let extension: 'webm' | 'mp4' = 'webm';

  if (config.preferredFormat === 'mp4' && support.bestMp4Mime) {
    chosenMime = support.bestMp4Mime;
    extension = 'mp4';
  } else if (support.bestWebmMime) {
    chosenMime = support.bestWebmMime;
    extension = 'webm';
  } else if (support.bestMp4Mime) {
    chosenMime = support.bestMp4Mime;
    extension = 'mp4';
  }

  onProgress({
    phase: 'preparing',
    currentFrame: 0,
    totalFrames,
    percent: 0,
    elapsedSeconds: 0,
    mimeTypeUsed: chosenMime,
    message: `Initializing ${width}×${height} @ ${fps} FPS video encoder (${chosenMime})...`,
  });

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const ctx = exportCanvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Could not initialize 2D rendering context for 1920x1080 export.');
  }

  // Use captureStream(fps) and drive frames deterministically from t = 0 to t = duration
  const stream = exportCanvas.captureStream(fps);
  const videoTrack = stream.getVideoTracks()[0] as any;

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: chosenMime,
    videoBitsPerSecond: Math.max(4_000_000, (config.bitrateMbps || 12) * 1_000_000),
  });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const recorderStopped = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const finalBlob = new Blob(chunks, { type: chosenMime });
      resolve(finalBlob);
    };
    recorder.onerror = (err) => {
      reject(err);
    };
  });

  // Render initial frame 0 before starting recorder so first frame is immediately populated
  renderSceneFrame(ctx, graph, 0, {
    targetWidth: width,
    targetHeight: height,
    showSafeMargins: false,
    showCoordinateGrid: false,
  });

  recorder.start(100);

  const frameIntervalMs = 1000 / fps;

  for (let frameIdx = 0; frameIdx <= totalFrames; frameIdx++) {
    if (abortSignal?.aborted) {
      if (recorder.state !== 'inactive') recorder.stop();
      stream.getTracks().forEach((tr) => tr.stop());
      throw new Error('Video export was cancelled by user.');
    }

    const t = Math.min(duration, (frameIdx / totalFrames) * duration);
    renderSceneFrame(ctx, graph, t, {
      targetWidth: width,
      targetHeight: height,
      showSafeMargins: false,
      showCoordinateGrid: false,
    });

    if (videoTrack && typeof videoTrack.requestFrame === 'function') {
      videoTrack.requestFrame();
    }

    const percent = Math.round((frameIdx / totalFrames) * 95);
    const elapsedSeconds = Number(((performance.now() - startTimeMs) / 1000).toFixed(1));

    if (frameIdx % 2 === 0 || frameIdx === totalFrames) {
      onProgress({
        phase: 'rendering',
        currentFrame: frameIdx,
        totalFrames,
        percent,
        elapsedSeconds,
        mimeTypeUsed: chosenMime,
        message: `Rendering frame ${frameIdx} / ${totalFrames} (t = ${t.toFixed(2)}s / ${duration.toFixed(2)}s)...`,
      });
    }

    // Pace deterministic frame emission so MediaRecorder timestamps match scene timeline accurately
    await new Promise((r) => setTimeout(r, Math.max(12, frameIntervalMs * 0.85)));
  }

  onProgress({
    phase: 'encoding',
    currentFrame: totalFrames,
    totalFrames,
    percent: 98,
    elapsedSeconds: Number(((performance.now() - startTimeMs) / 1000).toFixed(1)),
    mimeTypeUsed: chosenMime,
    message: 'Finalizing video container and flushing encoded bitstream...',
  });

  // Hold final ending frame briefly so encoder flushes final GOP cleanly
  await new Promise((r) => setTimeout(r, 120));
  if (recorder.state !== 'inactive') {
    recorder.stop();
  }
  stream.getTracks().forEach((tr) => tr.stop());

  const blob = await recorderStopped;
  const url = URL.createObjectURL(blob);
  const safeSlug = (graph.scene.title || graph.scene.id || 'motion-scene')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = `${safeSlug || 'scene'}-${width}x${height}-${fps}fps.${extension}`;

  onProgress({
    phase: 'complete',
    currentFrame: totalFrames,
    totalFrames,
    percent: 100,
    elapsedSeconds: Number(((performance.now() - startTimeMs) / 1000).toFixed(1)),
    mimeTypeUsed: chosenMime,
    message: `Exported ${filename} (${(blob.size / 1024).toFixed(1)} KB, ${totalFrames} frames @ ${fps} FPS).`,
  });

  return {
    blob,
    url,
    filename,
    mimeType: chosenMime,
    extension,
    totalFrames,
    duration,
    fps,
    width,
    height,
  };
}

/**
 * Serializes a SceneProject file (.mgscene.json) preserving original JSON, dimensions, FPS, fonts, and settings.
 */
export function serializeProjectFile(
  rawJson: string,
  scene: SceneSpec,
  exportSettings: ProjectFile['exportSettings']
): string {
  const project: ProjectFile = {
    projectFormat: 'mgscene-project',
    rendererVersion: '1.0.0',
    schemaVersion: scene.schemaVersion || '1.0',
    savedAt: new Date().toISOString(),
    exportSettings,
    fontRequirements: scene.fonts || [
      { family: 'Inter', weights: [400, 500, 600, 700] },
    ],
    rawJson,
    scene,
  };
  return JSON.stringify(project, null, 2);
}

/**
 * Parses either a `.mgscene.json` project file or a standalone raw scene `.json` file.
 */
export function parseProjectOrSceneFile(fileText: string): {
  rawJson: string;
  exportSettings?: ProjectFile['exportSettings'];
  isProjectFile: boolean;
} {
  try {
    const parsed = JSON.parse(fileText);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.projectFormat === 'mgscene-project' &&
      typeof parsed.rawJson === 'string'
    ) {
      return {
        rawJson: parsed.rawJson,
        exportSettings: parsed.exportSettings,
        isProjectFile: true,
      };
    }
  } catch {
    // Fall through and return raw text so validator can report exact syntax lines
  }
  return {
    rawJson: fileText,
    isProjectFile: false,
  };
}
