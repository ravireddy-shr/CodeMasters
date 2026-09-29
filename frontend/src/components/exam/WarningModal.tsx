import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface WarningModalProps {
  isOpen: boolean;
  reason: string;
  message: string;
  warningNumber: number;
  maxWarnings?: number;
  onAcknowledge: () => void;
}

export const WarningModal: React.FC<WarningModalProps> = ({
  isOpen,
  reason,
  message,
  warningNumber,
  maxWarnings = 3,
  onAcknowledge,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{
          maxWidth: '500px',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          background: '#0d1424',
          textAlign: 'center',
          padding: '32px 24px',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '2px solid #f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: '#f59e0b',
          }}
        >
          <ShieldAlert size={30} />
        </div>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: '#f59e0b',
            fontWeight: 700,
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}
        >
          Proctoring Warning {warningNumber} of {maxWarnings}
        </div>

        <h3 style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '12px' }}>
          {reason}
        </h3>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '24px' }}>
          {message}
        </p>

        <div
          style={{
            background: 'rgba(7, 11, 20, 0.75)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'left',
            marginBottom: '24px',
          }}
        >
          <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
          <span>
            Accumulating <strong>{maxWarnings} warnings</strong> will result in automatic contest disqualification.
          </span>
        </div>

        <button onClick={onAcknowledge} className="btn btn-primary" style={{ width: '100%' }}>
          I Understand & Return to Exam
        </button>
      </div>
    </div>
  );
};
