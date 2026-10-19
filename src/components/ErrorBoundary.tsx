import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onResetScene?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error('KineticJSON Runtime Error:', error, errorInfo);
  }

  handleRecover = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (this.props.onResetScene) {
      this.props.onResetScene();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh w-full bg-[#090D16] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-bold font-display text-white">
                Scene Renderer Recovery
              </h1>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              An unexpected rendering error occurred while processing the current scene state.
            </p>
            {this.state.errorMessage && (
              <pre className="p-3 bg-[#090D16] border border-slate-800 rounded-lg text-xs font-mono text-red-300 overflow-x-auto">
                {this.state.errorMessage}
              </pre>
            )}
            <button
              onClick={this.handleRecover}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-sm rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset to Default Scene</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
