import React from 'react';
import Editor from '@monaco-editor/react';
import { RotateCcw, Play, Loader2 } from 'lucide-react';

interface CodeEditorViewProps {
  code: string;
  onChange: (val: string) => void;
  onResetCode: () => void;
  onRunCode: () => void;
  isRunning: boolean;
  isReadOnly?: boolean;
}

export const CodeEditorView: React.FC<CodeEditorViewProps> = ({
  code,
  onChange,
  onResetCode,
  onRunCode,
  isRunning,
  isReadOnly = false,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#090e1c',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}
    >
      {/* Editor Control Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 18px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#00f5a0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00f5a0' }} />
            solution.py
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            (Python 3.12 Runtime)
          </span>
        </div>

        {!isReadOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onResetCode}
              disabled={isRunning}
              className="btn btn-outline btn-sm"
              title="Reset to starter/buggy code"
            >
              <RotateCcw size={13} />
              Reset Buggy Code
            </button>

            <button
              onClick={onRunCode}
              disabled={isRunning}
              className="btn btn-primary btn-sm"
            >
              {isRunning ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Executing Sandbox...
                </>
              ) : (
                <>
                  <Play size={13} fill="currentColor" />
                  Run Code (Public Tests)
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Monaco Editor Component */}
      <div style={{ flex: 1, minHeight: '380px', position: 'relative' }}>
        <Editor
          height="100%"
          language="python"
          theme="vs-dark"
          value={code}
          onChange={(val) => onChange(val || '')}
          options={{
            readOnly: isReadOnly,
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            formatOnType: true,
            formatOnPaste: true,
            bracketPairColorization: { enabled: true },
            padding: { top: 12, bottom: 12 },
          }}
          loading={
            <div style={{ padding: '24px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Initializing Monaco Python environment...
            </div>
          }
        />
      </div>
    </div>
  );
};
