#!/usr/bin/env python3
"""
Local Deterministic 1920x1080 Video Renderer CLI (Headless Chromium + FFmpeg)
Usage:
  python3 scripts/render_scene_video.py --input src/samples/scene1_stick_explainer.json --output out.mp4 --fps 30
"""
import argparse
import base64
import json
import os
import shutil
import subprocess
import tempfile
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def compile_engine_bundle(project_root: str) -> str:
    """Compiles the TypeScript engine modules into a standalone JS bundle via Babel."""
    js_script = f"""
    const fs = require("fs");
    const path = require("path");
    const babel = require("@babel/core");
    const root = {json.dumps(project_root)};
    const files = [
      "schema.ts",
      "validator.ts",
      "timeline.ts",
      "sceneGraph.ts",
      "renderer.ts",
      "videoExporter.ts",
      "sampleScenes.ts"
    ];
    let combined = "";
    for (const f of files) {{
      let src = fs.readFileSync(path.join(root, f), "utf8");
      src = src.replace(/import\\s+(?:type\\s+)?\\{{[^}}]*\\}}\\s+from\\s+['"][^'"]+['"];?\\n?/gm, "");
      src = src.replace(/^export\\s+/gm, "");
      combined += "\\n// " + f + "\\n" + src + "\\n";
    }}
    combined += "\\nwindow.MotionEngine = {{ validateSceneJson, buildSceneGraph, computeElementStateAtTime, renderSceneFrame, serializeProjectFile, parseProjectOrSceneFile, exportSceneToVideo, SAMPLE_SCENES }};\\n";
    const out = babel.transformSync(combined, {{
      filename: "engine_bundle.ts",
      presets: ["@babel/preset-typescript"]
    }});
    process.stdout.write(out.code);
    """
    env = os.environ.copy()
    env["NODE_PATH"] = "/usr/share/nodejs:/usr/lib/nodejs"
    res = subprocess.run(
        ["node", "-"],
        input=js_script,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    return res.stdout

def render_video(input_json_path: str, output_video_path: str, fps: int = 30, max_duration: float = None):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = script_dir
    engine_js = compile_engine_bundle(project_root)

    with open(input_json_path, "r", encoding="utf-8") as f:
        raw_json = f.read()

    tmp_dir = tempfile.mkdtemp(prefix="mgscene_render_")
    try:
        opts = Options()
        opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--window-size=1920,1080")
        driver = webdriver.Chrome(options=opts)

        try:
            driver.get("about:blank")
            driver.execute_script(
                """
                document.body.style.margin = '0';
                document.body.style.background = '#000';
                document.body.innerHTML = '<canvas id="render-canvas" width="1920" height="1080"></canvas>';
                const s = document.createElement('script');
                s.textContent = arguments[0];
                document.head.appendChild(s);
                """,
                engine_js,
            )
            init_res = driver.execute_script(
                """
                const raw = arguments[0];
                const parsed = window.MotionEngine.parseProjectOrSceneFile(raw);
                const val = window.MotionEngine.validateSceneJson(parsed.rawJson);
                if (!val.valid) return { valid: false, errors: val.errors };
                window.__activeGraph = window.MotionEngine.buildSceneGraph(val.scene);
                return { valid: true, duration: val.scene.duration, title: val.scene.title };
                """,
                raw_json,
            )
            if not init_res.get("valid"):
                raise RuntimeError(f"Scene validation failed: {init_res.get('errors')}")

            scene_duration = float(init_res["duration"])
            render_duration = min(scene_duration, max_duration) if max_duration else scene_duration
            total_frames = max(1, int(round(render_duration * fps)))

            for frame_idx in range(total_frames + 1):
                t = (frame_idx / total_frames) * scene_duration if not max_duration else (frame_idx / fps)
                data_url = driver.execute_script(
                    """
                    const t = arguments[0];
                    const canvas = document.getElementById("render-canvas");
                    const ctx = canvas.getContext("2d", { alpha: false });
                    window.MotionEngine.renderSceneFrame(ctx, window.__activeGraph, t, {
                      targetWidth: 1920,
                      targetHeight: 1080,
                      showSafeMargins: false,
                      showCoordinateGrid: false
                    });
                    return canvas.toDataURL("image/png");
                    """,
                    t,
                )
                b64_png = data_url.split(",", 1)[1]
                frame_file = os.path.join(tmp_dir, f"frame_{frame_idx:05d}.png")
                with open(frame_file, "wb") as pf:
                    pf.write(base64.b64decode(b64_png))

        finally:
            driver.quit()

        # Encode with FFmpeg
        ext = os.path.splitext(output_video_path)[1].lower()
        if ext == ".webm":
            cmd = [
                "ffmpeg", "-y",
                "-framerate", str(fps),
                "-i", os.path.join(tmp_dir, "frame_%05d.png"),
                "-c:v", "libvpx-vp9",
                "-b:v", "8M",
                "-pix_fmt", "yuv420p",
                output_video_path,
            ]
        else:
            cmd = [
                "ffmpeg", "-y",
                "-framerate", str(fps),
                "-i", os.path.join(tmp_dir, "frame_%05d.png"),
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "18",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                output_video_path,
            ]
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"Successfully rendered {total_frames + 1} frames to {output_video_path} (1920x1080 @ {fps} FPS)")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deterministic 1920x1080 JSON Motion Graphics Video Renderer")
    parser.add_argument("--input", required=True, help="Path to input .json or .mgscene.json file")
    parser.add_argument("--output", required=True, help="Path to output .mp4 or .webm file")
    parser.add_argument("--fps", type=int, default=30, choices=[30, 60], help="Frame rate (30 or 60)")
    args = parser.parse_args()
    render_video(args.input, args.output, args.fps)
