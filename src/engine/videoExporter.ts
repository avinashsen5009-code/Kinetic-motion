import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { SceneSpecification } from '../types/scene';
import { renderSceneFrame } from './renderer';

export interface VideoExportOptions {
  format: 'mp4' | 'webm';
  fps: 30 | 60;
  width?: number; // Default 1920
  height?: number; // Default 1080
  bitrate?: number; // Default 10_000_000 (10 Mbps for crisp 1080p vector graphics)
  onProgress?: (progress: {
    currentFrame: number;
    totalFrames: number;
    percent: number;
    phase: 'rendering' | 'encoding' | 'finalizing';
    elapsedMs: number;
  }) => void;
  signal?: AbortSignal;
}

export interface VideoExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  totalFrames: number;
  durationSec: number;
  fps: number;
  resolution: string;
  pipelineUsed: 'webcodecs-mp4' | 'mediarecorder-webm' | 'mediarecorder-mp4';
}

export function isWebCodecsMp4Supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'VideoEncoder' in window &&
    'VideoFrame' in window
  );
}

/**
 * Exports a complete animated video clip (1920x1080) of `scene` from t=0 to t=duration.
 * Guarantees deterministic frame rendering and ensures the final frame captures the exact end state.
 */
export async function exportSceneToVideo(
  scene: SceneSpecification,
  options: VideoExportOptions
): Promise<VideoExportResult> {
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const fps = options.fps;
  const durationSec = Math.max(0.5, scene.meta.duration || 5);
  // Total frames includes frame 0 through final frame at exact durationSec
  const totalFrames = Math.max(2, Math.round(durationSec * fps));
  const bitrate = options.bitrate ?? 10_000_000;

  // Ensure webfonts are ready before frame 0
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }

  const slugTitle = (scene.meta.title || 'scene')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Try deterministic WebCodecs H.264 MP4 pipeline first when MP4 is requested
  if (options.format === 'mp4' && isWebCodecsMp4Supported()) {
    try {
      return await exportWithWebCodecsMp4(
        scene,
        width,
        height,
        fps,
        durationSec,
        totalFrames,
        bitrate,
        slugTitle,
        options
      );
    } catch (err) {
      if (options.signal?.aborted) throw err;
      console.warn(
        'WebCodecs H.264 encoder unavailable or rejected config; falling back to MediaRecorder pipeline:',
        err
      );
    }
  }

  // Browser MediaRecorder deterministic frame-stepped pipeline (WebM VP9/VP8 or MP4)
  return await exportWithMediaRecorder(
    scene,
    width,
    height,
    fps,
    durationSec,
    totalFrames,
    bitrate,
    slugTitle,
    options
  );
}

async function exportWithWebCodecsMp4(
  scene: SceneSpecification,
  width: number,
  height: number,
  fps: 30 | 60,
  durationSec: number,
  totalFrames: number,
  bitrate: number,
  slugTitle: string,
  options: VideoExportOptions
): Promise<VideoExportResult> {
  const startTime = performance.now();

  // Test codec support for 1920x1080 H.264 High/Main/Baseline profile
  const candidateCodecs = [
    'avc1.640028', // High Profile Level 4.0 (supports 1080p)
    'avc1.4d002a', // Main Profile Level 4.2 (supports 1080p60)
    'avc1.420028', // Baseline Profile Level 4.0
  ];

  let selectedCodec = candidateCodecs[0];
  let supported = false;

  for (const codec of candidateCodecs) {
    const check = await VideoEncoder.isConfigSupported({
      codec,
      width,
      height,
      bitrate,
      framerate: fps,
    });
    if (check.supported) {
      selectedCodec = codec;
      supported = true;
      break;
    }
  }

  if (!supported) {
    throw new Error('H.264 VideoEncoder config not supported by this browser GPU/platform.');
  }

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width,
      height,
    },
    fastStart: 'in-memory',
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      encoderError = e instanceof Error ? e : new Error(String(e));
    },
  });

  encoder.configure({
    codec: selectedCodec,
    width,
    height,
    bitrate,
    framerate: fps,
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not initialize 1920x1080 2D rendering context.');

  const frameDurationMicros = Math.round(1_000_000 / fps);

  for (let frameIdx = 0; frameIdx <= totalFrames; frameIdx++) {
    if (options.signal?.aborted) {
      encoder.close();
      throw new Error('Video export cancelled by user.');
    }
    if (encoderError) {
      throw encoderError;
    }

    // Exact timestamp in seconds; final frame is clamped to exact durationSec
    const timeSec =
      frameIdx === totalFrames
        ? durationSec
        : Math.min(durationSec, frameIdx / fps);

    renderSceneFrame(ctx, scene, timeSec, {
      targetWidth: width,
      targetHeight: height,
    });

    const timestampMicros = Math.round(frameIdx * (1_000_000 / fps));
    const videoFrame = new VideoFrame(canvas, {
      timestamp: timestampMicros,
      duration: frameDurationMicros,
    });

    const isKeyFrame = frameIdx % fps === 0;
    encoder.encode(videoFrame, { keyFrame: isKeyFrame });
    videoFrame.close();

    // Yield periodically to keep UI responsive and prevent encoder queue overflow
    if (encoder.encodeQueueSize > 10) {
      await encoder.flush();
    } else if (frameIdx % 4 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }

    options.onProgress?.({
      currentFrame: Math.min(frameIdx + 1, totalFrames),
      totalFrames,
      percent: Math.min(96, Math.round(((frameIdx + 1) / (totalFrames + 1)) * 96)),
      phase: 'rendering',
      elapsedMs: performance.now() - startTime,
    });
  }

  options.onProgress?.({
    currentFrame: totalFrames,
    totalFrames,
    percent: 98,
    phase: 'finalizing',
    elapsedMs: performance.now() - startTime,
  });

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  const buffer = target.buffer;
  const blob = new Blob([buffer], { type: 'video/mp4' });

  options.onProgress?.({
    currentFrame: totalFrames,
    totalFrames,
    percent: 100,
    phase: 'finalizing',
    elapsedMs: performance.now() - startTime,
  });

  return {
    blob,
    filename: `${slugTitle}-1080p-${fps}fps.mp4`,
    mimeType: 'video/mp4',
    totalFrames,
    durationSec,
    fps,
    resolution: `${width}x${height}`,
    pipelineUsed: 'webcodecs-mp4',
  };
}

async function exportWithMediaRecorder(
  scene: SceneSpecification,
  width: number,
  height: number,
  fps: 30 | 60,
  durationSec: number,
  totalFrames: number,
  bitrate: number,
  slugTitle: string,
  options: VideoExportOptions
): Promise<VideoExportResult> {
  const startTime = performance.now();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not initialize 1920x1080 2D rendering context.');

  // Pick best supported MIME type
  const candidates =
    options.format === 'mp4'
      ? [
          'video/mp4;codecs=avc1.42E01E',
          'video/mp4;codecs=h264',
          'video/mp4',
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
        ]
      : [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
        ];

  let selectedMime = 'video/webm';
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      selectedMime = mime;
      break;
    }
  }

  const isMp4Output = selectedMime.includes('mp4');
  const ext = isMp4Output ? 'mp4' : 'webm';

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: selectedMime,
    videoBitsPerSecond: bitrate,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const recordingFinished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: selectedMime.split(';')[0] }));
    };
    recorder.onerror = (e) => {
      reject(new Error(`MediaRecorder error: ${String(e)}`));
    };
  });

  // Render initial frame 0 before starting recorder
  renderSceneFrame(ctx, scene, 0, { targetWidth: width, targetHeight: height });
  recorder.start(100);

  const frameIntervalMs = 1000 / fps;

  for (let frameIdx = 0; frameIdx <= totalFrames; frameIdx++) {
    if (options.signal?.aborted) {
      if (recorder.state !== 'inactive') recorder.stop();
      throw new Error('Video export cancelled by user.');
    }

    const frameStartPerf = performance.now();
    const timeSec =
      frameIdx === totalFrames
        ? durationSec
        : Math.min(durationSec, frameIdx / fps);

    renderSceneFrame(ctx, scene, timeSec, {
      targetWidth: width,
      targetHeight: height,
    });

    // Request frame on CanvasCaptureMediaStreamTrack if supported
    const videoTrack = stream.getVideoTracks()[0] as unknown as {
      requestFrame?: () => void;
    };
    if (videoTrack && typeof videoTrack.requestFrame === 'function') {
      videoTrack.requestFrame();
    }

    options.onProgress?.({
      currentFrame: Math.min(frameIdx + 1, totalFrames),
      totalFrames,
      percent: Math.min(97, Math.round(((frameIdx + 1) / (totalFrames + 1)) * 97)),
      phase: 'encoding',
      elapsedMs: performance.now() - startTime,
    });

    const elapsedFrame = performance.now() - frameStartPerf;
    const waitMs = Math.max(4, frameIntervalMs - elapsedFrame);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  // Hold final frame briefly so MediaRecorder flushes the ending state cleanly
  await new Promise((r) => setTimeout(r, 80));
  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());

  const blob = await recordingFinished;

  options.onProgress?.({
    currentFrame: totalFrames,
    totalFrames,
    percent: 100,
    phase: 'finalizing',
    elapsedMs: performance.now() - startTime,
  });

  return {
    blob,
    filename: `${slugTitle}-1080p-${fps}fps.${ext}`,
    mimeType: selectedMime.split(';')[0],
    totalFrames,
    durationSec,
    fps,
    resolution: `${width}x${height}`,
    pipelineUsed: isMp4Output ? 'mediarecorder-mp4' : 'mediarecorder-webm',
  };
}
