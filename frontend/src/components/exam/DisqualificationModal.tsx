import React from 'react';
import { Ban } from 'lucide-react';

interface DisqualificationModalProps {
  isOpen: boolean;
  reason: string;
  onExit: () => void;
}

export const DisqualificationModal: React.FC<DisqualificationModalProps> = ({
  isOpen,
  reason,
  onExit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{
          maxWidth: '520px',
          border: '1px solid rgba(239, 68, 68, 0.5)',
          background: '#0d1424',
          textAlign: 'center',
          padding: '40px 28px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#ef4444',
          }}
        >
          <Ban size={36} />
        </div>

        <h2 style={{ fontSize: '1.75rem', color: '#fff', marginBottom: '8px' }}>
          Assessment Disqualified
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>
          You have been disqualified from Code Masters Round 2 due to multiple proctoring infractions.
        </p>

        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            padding: '16px',
            borderRadius: 'var(--radius-sm)',
            color: '#f87171',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            marginBottom: '28px',
            textAlign: 'left',
          }}
        >
          <strong>Reason:</strong> {reason}
        </div>

        <button onClick={onExit} className="btn btn-secondary" style={{ width: '100%' }}>
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};
