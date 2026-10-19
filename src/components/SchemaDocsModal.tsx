import React from 'react';
import { X, Copy, Check } from 'lucide-react';

interface SchemaDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SchemaDocsModal: React.FC<SchemaDocsModalProps> = ({ isOpen, onClose }) => {
  const [copiedSnippet, setCopiedSnippet] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 1800);
  };

  const stickFigureSnippet = `{
  "id": "customStickFigure",
  "type": "group",
  "x": 450,
  "y": 600,
  "children": [
    { "id": "head", "type": "circle", "x": 0, "y": -110, "r": 36, "stroke": "#F8FAFC", "strokeWidth": 8 },
    { "id": "torso", "type": "line", "x1": 0, "y1": -74, "x2": 0, "y2": 70, "stroke": "#F8FAFC", "strokeWidth": 10 },
    {
      "id": "rightArmJoint",
      "type": "group",
      "x": 0,
      "y": -55,
      "animations": [
        { "property": "rotation", "from": 25, "to": -35, "start": 0.4, "duration": 0.8, "easing": "easeOutBack" }
      ],
      "children": [
        { "id": "upperArm", "type": "line", "x1": 0, "y1": 0, "x2": 85, "y2": -15, "stroke": "#38BDF8", "strokeWidth": 8 }
      ]
    }
  ]
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-6">
      <div className="w-full max-w-5xl max-h-[88vh] flex flex-col bg-[#0F172A] border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#090D16]">
          <div>
            <h2 className="text-lg font-bold text-slate-100 font-display">
              JSON Scene Specification & Local Rendering Reference (Schema v1.0)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Composable primitives, hierarchical transformations, deterministic keyframes, and video export guide
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close specification modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 text-sm text-slate-300 leading-relaxed">
          {/* Section 1: Root Structure */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-white font-display">
              01. Root Scene Specification Structure
            </h3>
            <p className="text-slate-400">
              Every JSON document defines one independent motion-graphics scene mapped onto a 16:9 output canvas (1920×1080). The renderer executes your exact coordinate, geometry, and keyframe instructions without substituting stock templates.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono bg-[#090D16] p-4 rounded-lg border border-slate-800">
              <div>
                <div className="text-sky-400 font-semibold mb-1">meta (Required)</div>
                <ul className="space-y-1 text-slate-400">
                  <li><span className="text-slate-200">title</span>: string — Scene title (used for export filename)</li>
                  <li><span className="text-slate-200">width</span>: number — Logical coordinate width (default 1920)</li>
                  <li><span className="text-slate-200">height</span>: number — Logical coordinate height (default 1080)</li>
                  <li><span className="text-slate-200">fps</span>: 30 | 60 — Deterministic timeline frame rate</li>
                  <li><span className="text-slate-200">duration</span>: number — Total clip length in seconds</li>
                </ul>
              </div>
              <div>
                <div className="text-sky-400 font-semibold mb-1">background, transitions & defs (Optional)</div>
                <ul className="space-y-1 text-slate-400">
                  <li><span className="text-slate-200">background</span>: color, linear/radial gradient, grid, vignette</li>
                  <li><span className="text-slate-200">transitions</span>: in/out fade, wipeLeft, wipeRight, wipeUp</li>
                  <li><span className="text-slate-200">defs</span>: Reusable named SceneNode symbol dictionary</li>
                  <li><span className="text-slate-200">elements</span>: Root array of SceneNode primitives & groups</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2: Composable Primitives */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-white font-display">
              02. Composable Visual Primitives (`type`)
            </h3>
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#090D16] text-slate-300 border-b border-slate-800">
                    <th className="py-2.5 px-4 font-semibold">Primitive Type</th>
                    <th className="py-2.5 px-4 font-semibold">Key Geometry Properties</th>
                    <th className="py-2.5 px-4 font-semibold">Description & Use Cases</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  <tr>
                    <td className="py-2 px-4 text-sky-400">group</td>
                    <td className="py-2 px-4 text-slate-300">x, y, rotation, scale, children, clip</td>
                    <td className="py-2 px-4 font-sans text-slate-400">Nested transformation hierarchy (character limbs, cards, diagrams).</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-sky-400">use</td>
                    <td className="py-2 px-4 text-slate-300">ref, overrides, x, y, scale</td>
                    <td className="py-2 px-4 font-sans text-slate-400">Instantiates a reusable symbol from `defs` with per-child property overrides.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-sky-400">rect</td>
                    <td className="py-2 px-4 text-slate-300">width, height, rx, anchorX, anchorY</td>
                    <td className="py-2 px-4 font-sans text-slate-400">Rectangles, rounded panels, animated bar chart columns (`anchorY: 1`).</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-sky-400">circle / ellipse</td>
                    <td className="py-2 px-4 text-slate-300">r, rx, ry, drawProgress</td>
                    <td className="py-2 px-4 font-sans text-slate-400">Character heads, joints, nodes, shadows, and animated stroke rings.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-sky-400">arc</td>
                    <td className="py-2 px-4 text-slate-300">r, innerRadius, startAngle, endAngle</td>
                    <td className="py-2 px-4 font-sans text-slate-400">Pie wedges, donut gauges, and orbital progress indicators.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-sky-400">line</td>
                    <td className="py-2 px-4 text-slate-300">x1, y1, x2, y2, curveOffset, endMarker</td>
                    <td className="py-2 px-4 font-sans text-slate-400">Straight or curved flowchart connectors with `arrow`, `circle`, or `diamond` markers.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-sky-400">polyline / polygon</td>
                    <td className="py-2 px-4 text-slate-300">points: [[x,y], ...], drawProgress</td>
                    <td className="py-2 px-4 font-sans text-slate-400">Multi-jointed limbs, trend lines, shields, and custom polygons.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-sky-400">path</td>
                    <td className="py-2 px-4 text-slate-300">d, morphTo, morphProgress, drawProgress</td>
                    <td className="py-2 px-4 font-sans text-slate-400">Full SVG Bézier paths (`M, L, C, Q, Z`) with path trimming and shape morphing.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-sky-400">text / counter</td>
                    <td className="py-2 px-4 text-slate-300">text, value, decimals, prefix, suffix, textReveal</td>
                    <td className="py-2 px-4 font-sans text-slate-400">Crisp typography (`chars`, `words`, `clip` reveals) and animated numeric counters.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Deterministic Animation Engine */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-white font-display">
              03. Deterministic Keyframe Timeline & Omitted Property Rules
            </h3>
            <p className="text-slate-400">
              Each element accepts an <code className="text-sky-300">animations</code> array containing tracks with <code className="text-slate-200">property</code>, optional <code className="text-slate-200">from</code>, required <code className="text-slate-200">to</code>, <code className="text-slate-200">start</code> (seconds), <code className="text-slate-200">duration</code> (seconds), and <code className="text-slate-200">easing</code>.
            </p>
            <div className="bg-[#090D16] p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
              <div>
                <span className="text-slate-200 font-semibold">Animatable Properties: </span>
                <span className="font-mono text-sky-300">
                  x, y, width, height, r, rx, ry, x1, y1, x2, y2, scale, scaleX, scaleY, rotation, skewX, skewY, opacity, strokeWidth, drawProgress, textReveal, morphProgress, value, fill, stroke, extrudeDepthX, extrudeDepthY
                </span>
              </div>
              <div>
                <span className="text-slate-200 font-semibold">Supported Easings: </span>
                <span className="font-mono text-emerald-300">
                  linear, easeInQuad, easeOutQuad, easeInOutQuad, easeInCubic, easeOutCubic, easeInOutCubic, easeOutQuart, easeInOutQuart, easeOutBack, easeInOutBack, easeOutElastic, spring, step
                </span>{' '}
                or custom cubic-bezier tuple <code className="text-purple-300">[x1, y1, x2, y2]</code>.
              </div>
              <div>
                <span className="text-slate-200 font-semibold">Behavior When Omitted: </span>
                <span className="text-slate-400">
                  If <code className="text-slate-200">animations</code> is omitted, the element remains static at its declared properties. If <code className="text-slate-200">from</code> is provided on the first track of a property, the element holds that initial state prior to <code className="text-slate-200">start</code>, interpolates to <code className="text-slate-200">to</code> over <code className="text-slate-200">duration</code>, and holds <code className="text-slate-200">to</code> afterward.
                </span>
              </div>
            </div>
          </section>

          {/* Section 4: Constructing Custom Characters from Primitives */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white font-display">
                04. Example: Articulated Stick Figure from Primitives
              </h3>
              <button
                onClick={() => copyText('stick', stickFigureSnippet)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
              >
                {copiedSnippet === 'stick' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Snippet</span>
                  </>
                )}
              </button>
            </div>
            <pre className="bg-[#090D16] p-4 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
              {stickFigureSnippet}
            </pre>
          </section>

          {/* Section 5: Video Export & Local FFmpeg Workflow */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-white font-display">
              05. Video Export Pipeline & Local FFmpeg Transcoding
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              The application exports full 1920×1080 video clips at 30 FPS or 60 FPS using two built-in pipelines:
              <br />
              1. <strong>Hardware-Accelerated H.264 MP4 (WebCodecs + mp4-muxer)</strong>: Renders every frame deterministically (`t = frame / fps`) into an offscreen 1920×1080 canvas and encodes directly to an `.mp4` container.
              <br />
              2. <strong>Universal Browser WebM (MediaRecorder VP9/VP8)</strong>: Fallback pipeline supported across all modern browsers. If you export WebM and wish to combine or transcode clips into ProRes or H.264 locally, run:
            </p>
            <pre className="bg-[#090D16] p-3 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300">
              ffmpeg -i scene-export-1080p-30fps.webm -c:v libx264 -pix_fmt yuv420p -crf 18 scene-final.mp4
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
};
