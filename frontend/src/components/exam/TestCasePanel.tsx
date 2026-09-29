import React, { useState } from 'react';
import { TestCase, TestCaseResult } from '../../types';
import { CheckCircle2, XCircle, EyeOff, Terminal, Clock, Loader2 } from 'lucide-react';

interface TestCasePanelProps {
  testCases: TestCase[];
  results: TestCaseResult[] | null;
  isRunning: boolean;
  scoreAwarded?: number;
  maxScore?: number;
}

export const TestCasePanel: React.FC<TestCasePanelProps> = ({
  testCases,
  results,
  isRunning,
  scoreAwarded,
  maxScore,
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);

  const passedCount = results ? results.filter((r) => r.passed).length : 0;
  const totalCount = results ? results.length : testCases.length;

  return (
    <div
      className="glass-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '18px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={17} color="#00d9f5" />
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>Test Results & Cases</h4>
        </div>

        {results && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: passedCount === totalCount ? '#10b981' : '#f59e0b',
                background: passedCount === totalCount ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                border: passedCount === totalCount ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              Passed: {passedCount}/{totalCount}
            </span>

            {scoreAwarded !== undefined && maxScore !== undefined && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#00f5a0',
                }}
              >
                Score: {scoreAwarded}/{maxScore}
              </span>
            )}
          </div>
        )}
      </div>

      {isRunning ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            gap: '12px',
          }}
        >
          <Loader2 size={24} className="animate-spin" color="#00f5a0" />
          <span>Executing test cases against sandbox...</span>
        </div>
      ) : testCases.length === 0 && (!results || results.length === 0) ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>
          No public test cases configured for this question.
        </div>
      ) : (
        <>
          {/* Test Case Select Tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '14px', paddingBottom: '4px' }}>
            {(results || testCases).map((tc, idx) => {
              const res = results ? results[idx] : null;
              const isPassed = res ? res.passed : null;
              const isHidden = (tc as any).isHidden || (tc as any).is_hidden;

              return (
                <button
                  key={(tc as any).id || (tc as any).testCaseId || idx}
                  onClick={() => setActiveTab(idx)}
                  className="btn btn-sm"
                  style={{
                    background: activeTab === idx ? 'rgba(0, 217, 245, 0.15)' : 'rgba(15, 23, 42, 0.7)',
                    borderColor: activeTab === idx ? '#00d9f5' : 'var(--border-subtle)',
                    color: activeTab === idx ? '#fff' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    padding: '5px 10px',
                  }}
                >
                  {isPassed === true && <CheckCircle2 size={12} color="#10b981" />}
                  {isPassed === false && <XCircle size={12} color="#ef4444" />}
                  {isHidden && isPassed === null && <EyeOff size={12} color="var(--text-muted)" />}
                  <span>Case {idx + 1}</span>
                  {isHidden && <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>(Hidden)</span>}
                </button>
              );
            })}
          </div>

          {/* Active Test Case Detail */}
          {(() => {
            const list = results || testCases;
            const currentItem = list[activeTab] || list[0];
            if (!currentItem) return null;

            const res = results ? results[activeTab] : null;
            const isHidden = (currentItem as any).isHidden || (currentItem as any).is_hidden;
            const inputVal = (currentItem as any).inputData || (currentItem as any).input_data || (currentItem as any).input;
            const expectedVal = (currentItem as any).expectedOutput || (currentItem as any).expected_output;

            return (
              <div
                style={{
                  background: 'rgba(7, 11, 20, 0.85)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  padding: '14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Result Status Banner */}
                {res && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: res.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: res.passed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                      color: res.passed ? '#10b981' : '#ef4444',
                      fontWeight: 700,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {res.passed ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                      <span>{res.passed ? 'Test Case Passed' : `Test Case Failed (${res.status})`}</span>
                    </div>
                    {res.executionTimeMs && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <Clock size={12} />
                        <span>{res.executionTimeMs}ms</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Input */}
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Standard Input
                  </div>
                  <pre
                    style={{
                      background: 'rgba(15, 23, 42, 0.9)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      color: '#e2e8f0',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '120px',
                      overflowY: 'auto',
                    }}
                  >
                    {inputVal || '(empty)'}
                  </pre>
                </div>

                {/* Expected Output */}
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Expected Output
                  </div>
                  <pre
                    style={{
                      background: 'rgba(15, 23, 42, 0.9)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      color: isHidden ? '#f59e0b' : '#00f5a0',
                      fontStyle: isHidden ? 'italic' : 'normal',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '120px',
                      overflowY: 'auto',
                    }}
                  >
                    {isHidden ? '[HIDDEN TEST CASE - CONCEALED]' : (expectedVal || '(empty)')}
                  </pre>
                </div>

                {/* Actual Output */}
                {res && (
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Your Program Output
                    </div>
                    <pre
                      style={{
                        background: 'rgba(15, 23, 42, 0.9)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        color: res.passed ? '#00f5a0' : '#f87171',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '120px',
                        overflowY: 'auto',
                      }}
                    >
                      {res.actualOutput || '(no output produced)'}
                    </pre>
                  </div>
                )}

                {/* Error Message if any */}
                {res?.errorMessage && (
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#ef4444', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Diagnostic / Error Output
                    </div>
                    <pre
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#f87171',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '140px',
                        overflowY: 'auto',
                      }}
                    >
                      {res.errorMessage}
                    </pre>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
};
