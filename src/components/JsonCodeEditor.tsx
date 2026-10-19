import React, { useMemo, useRef, useState } from 'react';
import { ValidationIssue } from '../types/scene';
import { Eye, Edit3 } from 'lucide-react';

interface JsonCodeEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  issues: ValidationIssue[];
  onCursorLineChange?: (line: number) => void;
}

/**
 * High-performance, mobile-first JSON code editor.
 * Memoized (`React.memo`) so 60fps canvas playback never triggers re-renders of the code editor.
 */
export const JsonCodeEditor: React.FC<JsonCodeEditorProps> = React.memo(
  ({ value, onChange, issues, onCursorLineChange }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const [viewHighlighted, setViewHighlighted] = useState<boolean>(false);

    const lines = useMemo(() => value.split('\n'), [value]);

    const issuesByLine = useMemo(() => {
      const map = new Map<number, ValidationIssue>();
      for (const issue of issues) {
        if (issue.line) {
          const existing = map.get(issue.line);
          if (!existing || issue.severity === 'error') {
            map.set(issue.line, issue);
          }
        }
      }
      return map;
    }, [issues]);

    const highlightedHtml = useMemo(() => {
      if (!viewHighlighted) return '';
      return highlightJsonSyntax(value);
    }, [value, viewHighlighted]);

    const handleScroll = () => {
      if (!textareaRef.current || !gutterRef.current) return;
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const el = e.currentTarget;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const nextVal = value.substring(0, start) + '  ' + value.substring(end);
        onChange(nextVal);
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = start + 2;
        });
      }
    };

    const handleSelectOrClick = () => {
      if (!textareaRef.current || !onCursorLineChange) return;
      const pos = textareaRef.current.selectionStart;
      const currentLine = value.slice(0, pos).split('\n').length;
      onCursorLineChange(currentLine);
    };

    return (
      <div className="relative flex flex-col flex-1 min-h-[260px] bg-[#090D16] font-mono text-[13px] leading-[21px] select-text overflow-hidden">
        <div className="absolute top-2 right-3 z-10 flex items-center">
          <button
            type="button"
            onClick={() => setViewHighlighted((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-sans font-medium shadow-md transition-colors whitespace-nowrap"
          >
            {viewHighlighted ? (
              <>
                <Edit3 className="w-3 h-3 text-sky-400" />
                <span>Edit Raw JSON</span>
              </>
            ) : (
              <>
                <Eye className="w-3 h-3 text-sky-400" />
                <span>Syntax View</span>
              </>
            )}
          </button>
        </div>

        {viewHighlighted ? (
          <div
            onClick={() => setViewHighlighted(false)}
            className="flex-1 overflow-auto py-3 px-4 cursor-text"
          >
            <pre
              className="m-0 font-mono text-[13px] leading-[21px] whitespace-pre"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </div>
        ) : (
          <div className="relative flex flex-1 min-h-0 overflow-hidden">
            {/* Line Number Gutter */}
            <div
              ref={gutterRef}
              className="w-11 shrink-0 py-3 bg-[#0B101B] border-r border-slate-800/80 text-right pr-2 select-none overflow-hidden text-slate-500 tabular-nums"
            >
              {lines.map((_, i) => {
                const lineNum = i + 1;
                const lineIssue = issuesByLine.get(lineNum);
                return (
                  <div
                    key={lineNum}
                    title={
                      lineIssue
                        ? `${lineIssue.severity.toUpperCase()}: ${lineIssue.message}`
                        : undefined
                    }
                    className={`h-[21px] flex items-center justify-end ${
                      lineIssue?.severity === 'error'
                        ? 'text-red-400 font-bold bg-red-950/50 -mr-2 pr-2'
                        : lineIssue?.severity === 'warning'
                        ? 'text-amber-400 font-bold bg-amber-950/40 -mr-2 pr-2'
                        : ''
                    }`}
                  >
                    <span>{lineNum}</span>
                  </div>
                );
              })}
            </div>

            {/* High-Contrast Native Editable Textarea */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onScroll={handleScroll}
              onKeyDown={handleKeyDown}
              onClick={handleSelectOrClick}
              onKeyUp={handleSelectOrClick}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              aria-label="Scene JSON Specification Editor"
              className="code-input flex-1 w-full h-full m-0 py-3 px-3.5 bg-[#090D16] text-slate-100 caret-sky-400 resize-none border-0 focus:outline-none overflow-auto whitespace-pre font-mono text-[13px] leading-[21px] selection:bg-sky-500/30"
            />
          </div>
        )}
      </div>
    );
  }
);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightJsonSyntax(jsonStr: string): string {
  const escaped = escapeHtml(jsonStr);
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          const keyPart = match.slice(0, -1);
          return `<span class="text-sky-300">${keyPart}</span><span class="text-slate-400">:</span>`;
        }
        return `<span class="text-emerald-300">${match}</span>`;
      }
      if (/true|false/.test(match)) {
        return `<span class="text-amber-300">${match}</span>`;
      }
      if (/null/.test(match)) {
        return `<span class="text-slate-400">${match}</span>`;
      }
      return `<span class="text-purple-300">${match}</span>`;
    }
  );
}
