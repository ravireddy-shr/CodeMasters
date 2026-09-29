import React from 'react';
import { Clock, ShieldAlert, Send } from 'lucide-react';

interface ExamHeaderProps {
  formattedTime: string;
  isLowTime: boolean;
  warningsCount: number;
  maxWarnings?: number;
  onSubmitClick: () => void;
  onFinishContestClick?: () => void;
  isSubmitted: boolean;
  activeQuestionNumber?: number;
  totalQuestions?: number;
  submittedCount?: number;
  isCurrentSubmitted?: boolean;
}

export const ExamHeader: React.FC<ExamHeaderProps> = ({
  formattedTime,
  isLowTime,
  warningsCount,
  maxWarnings = 3,
  onSubmitClick,
  onFinishContestClick,
  isSubmitted,
  activeQuestionNumber = 1,
  totalQuestions = 5,
  submittedCount = 0,
  isCurrentSubmitted = false,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        background: 'rgba(10, 16, 30, 0.95)',
        borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(0, 245, 160, 0.12)',
              border: '1px solid rgba(0, 245, 160, 0.3)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '0.8rem',
              color: '#00f5a0',
            }}
          >
            ROUND 02
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>Python Code Debugging</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              100 Marks Total • 5 Questions (20 pts each)
            </span>
          </div>
        </div>

        {/* Step Indicator Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#93c5fd',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span>Problem <strong>{activeQuestionNumber}</strong> of {totalQuestions}</span>
          <span style={{ color: 'var(--border-subtle)' }}>|</span>
          <span style={{ color: '#00f5a0' }}>Completed: <strong>{submittedCount} / {totalQuestions}</strong></span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Anti-cheat Warnings Counter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            background: warningsCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(15, 23, 42, 0.8)',
            border: warningsCount > 0 ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-subtle)',
            color: warningsCount > 0 ? '#f87171' : 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
          }}
        >
          <ShieldAlert size={15} color={warningsCount > 0 ? '#ef4444' : '#64748b'} />
          <span>Warnings: <strong>{warningsCount} / {maxWarnings}</strong></span>
        </div>

        {/* Live Authoritative Countdown Timer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: 'var(--radius-sm)',
            background: isLowTime ? 'rgba(239, 68, 68, 0.15)' : 'rgba(15, 23, 42, 0.9)',
            border: isLowTime ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
            color: isLowTime ? '#ef4444' : '#00d9f5',
            fontFamily: 'var(--font-mono)',
            fontWeight: 800,
            fontSize: '1.15rem',
            animation: isLowTime ? 'pulse 1s infinite' : 'none',
          }}
        >
          <Clock size={16} />
          <span>{formattedTime}</span>
        </div>

        {/* Submit Problem Button */}
        {!isSubmitted && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onSubmitClick} className="btn btn-primary btn-sm">
              <Send size={14} />
              {isCurrentSubmitted ? `Update Problem #${activeQuestionNumber}` : `Submit Problem #${activeQuestionNumber} (20 pts)`}
            </button>

            {submittedCount >= totalQuestions && onFinishContestClick && (
              <button onClick={onFinishContestClick} className="btn btn-secondary btn-sm" style={{ borderColor: '#00f5a0', color: '#00f5a0' }}>
                Finish Assessment (100 pts)
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};
