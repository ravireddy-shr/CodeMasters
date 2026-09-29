import React from 'react';
import { Send, AlertTriangle, Loader2 } from 'lucide-react';

interface SubmissionConfirmModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  questionNumber?: number;
  questionTitle?: string;
  marks?: number;
  isFinalQuestion?: boolean;
}

export const SubmissionConfirmModal: React.FC<SubmissionConfirmModalProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  isSubmitting,
  questionNumber = 1,
  questionTitle = '',
  marks = 20,
  isFinalQuestion = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{
          maxWidth: '520px',
          border: '1px solid rgba(0, 245, 160, 0.4)',
          background: '#0d1424',
          padding: '32px 28px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(0, 245, 160, 0.15)',
            border: '2px solid #00f5a0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
            color: '#00f5a0',
          }}
        >
          <Send size={28} />
        </div>

        <h3 style={{ fontSize: '1.45rem', color: '#fff', marginBottom: '8px' }}>
          Submit Problem #{questionNumber} ({marks} Marks)?
        </h3>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '22px' }}>
          {isFinalQuestion
            ? 'This is your final question! Once evaluated, your overall Round 2 score out of 100 will be finalized.'
            : `Your Python code for Problem #${questionNumber} will be evaluated against all test cases. You will then proceed step-by-step to the next problem.`}
        </p>

        <div
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            color: '#f59e0b',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textAlign: 'left',
            marginBottom: '26px',
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>Important:</strong> Final submission cannot be modified or re-submitted after confirmation unless unlocked by an administrator.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn btn-outline"
            style={{ minWidth: '120px' }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ minWidth: '150px' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Evaluating Tests...
              </>
            ) : (
              <>
                <Send size={15} />
                Yes, Submit Code
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
