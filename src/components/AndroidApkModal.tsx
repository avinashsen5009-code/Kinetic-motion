import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Download,
  Check,
  Copy,
  FileCode,
  ShieldCheck,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadStandaloneHtml: () => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({
  isOpen,
  onClose,
  onDownloadStandaloneHtml,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyCommand = (id: string, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 1800);
  };

  const capacitorCommands = `# 1. Install Capacitor Android in your project folder
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "KineticJSON Studio" "com.kineticjson.studio" --web-dir dist

# 2. Build the production bundle with all latest features
npm run build

# 3. Generate native Android project & compile APK
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 sm:p-6">
      <div className="w-full max-w-3xl max-h-[88dvh] flex flex-col bg-[#0F172A] border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#090D16]">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 font-display">
                Install Android App & Build Signed `.apk`
              </h2>
              <p className="text-xs text-slate-400">
                All features included: 16:9 & 9:16 Shorts, Touch Sliders, Quick-Insert Primitives & 60fps Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close Android APK modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm text-slate-300 leading-relaxed">
          {/* Option 1: Direct Native PWA Install (WebAPK on Android Chrome) */}
          <section className="bg-[#090D16] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <h3 className="text-sm font-semibold text-white font-display">
                  Method 1: Instant Android WebAPK Install (Zero Build Needed)
                </h3>
              </div>
              {isInstalled ? (
                <span className="text-xs font-mono text-emerald-400">
                  Installed on Device
                </span>
              ) : isInstallable ? (
                <button
                  onClick={install}
                  className="min-h-[38px] flex items-center gap-1.5 px-4 py-1.5 bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install App Now</span>
                </button>
              ) : null}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This app is configured with a full <strong>Progressive Web App (PWA) Manifest, 192px/512px Maskable Android Icons, and an Offline Service Worker</strong>. When you open this URL in Chrome on Android and tap <strong>Install App</strong> (or Chrome Menu <code className="text-slate-200">⋮ → Install app</code>), Android compiles and installs a real standalone <strong>WebAPK</strong> onto your phone&apos;s app drawer that works 100% offline in full-screen mode.
            </p>
            {isIOS && (
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs text-slate-300">
                <strong>On iPhone / iPad (Safari):</strong> Tap the <strong>Share</strong> icon in Safari&apos;s bottom bar and select <strong>Add to Home Screen</strong>.
              </div>
            )}
          </section>

          {/* Option 2: Generate a Standalone `.apk` File via PWABuilder or Capacitor */}
          <section className="bg-[#090D16] border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white font-display">
              Method 2: Download a Standalone `.apk` File in 60 Seconds (PWABuilder)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Because KineticJSON Studio now includes a compliant <code className="text-sky-300">manifest.webmanifest</code>, maskable 512×512 PNG icons, and an offline service worker:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
              <li>
                Copy your live app URL (or host the 1-file HTML on GitHub Pages).
              </li>
              <li>
                Open <strong>pwabuilder.com</strong> in your browser and paste your URL.
              </li>
              <li>
                Tap <strong>Package for stores → Android → Download Package</strong>. It immediately gives you a signed, installable <code className="text-emerald-300">KineticJSON.apk</code> file ready to sideload onto any Android phone.
              </li>
            </ol>
          </section>

          {/* Option 3: Capacitor Native Android Build */}
          <section className="bg-[#090D16] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white font-display">
                Method 3: Build Native Android `.apk` Locally with Capacitor
              </h3>
              <button
                onClick={() => copyCommand('cap', capacitorCommands)}
                className="min-h-[32px] flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                {copiedCmd === 'cap' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Commands</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400">
              If you download the project ZIP and have Node.js + Android Studio installed, run these commands to output <code className="text-emerald-300">android/app/build/outputs/apk/debug/app-debug.apk</code>:
            </p>
            <pre className="p-3 bg-[#060911] border border-slate-800 rounded-lg text-xs font-mono text-sky-300 overflow-x-auto">
              {capacitorCommands}
            </pre>
          </section>

          {/* Option 4: 1-File Standalone Offline HTML */}
          <section className="bg-[#090D16] border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white font-display">
                Method 4: Portable Single-File `index.html` (All Updates Included)
              </h3>
              <p className="text-xs text-slate-400">
                Downloads a single self-contained file with 16:9 & 9:16 Shorts toggle, Quick-Insert Primitives, Touch Sliders, and 60fps playback.
              </p>
            </div>
            <button
              onClick={onDownloadStandaloneHtml}
              className="min-h-[40px] flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-700/60 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              <FileCode className="w-4 h-4" />
              <span>Download 1-File HTML</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};
