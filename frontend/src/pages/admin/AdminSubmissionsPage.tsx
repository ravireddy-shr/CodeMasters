import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { api } from '../../services/apiClient';
import { Submission } from '../../types';
import { FileCheck, Code2, CheckCircle2, XCircle, Clock, Eye, Search } from 'lucide-react';

interface AdminSubmissionsPageProps {
  onNavigate: (path: string) => void;
}

export const AdminSubmissionsPage: React.FC<AdminSubmissionsPageProps> = ({ onNavigate }) => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubmissions = async () => {
    try {
      const data = await api.adminListSubmissions();
      setSubmissions(data);
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const filtered = submissions.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      (s.participant_name || '').toLowerCase().includes(q) ||
      (s.vtu_number || '').toLowerCase().includes(q) ||
      (s.question_title || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--nav-height))' }}>
      <AdminSidebar currentPath="/admin/submissions" onNavigate={onNavigate} />

      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Round 2 Submissions & Code Inspection</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              Inspect authoritative participant code, pass/fail counts, execution times, and test diagnostics.
            </p>
          </div>

          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '38px' }}
              placeholder="Search by name, VTU number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {submissions.length === 0 ? (
          <EmptyState
            title="No Submissions Recorded"
            description="No participant solutions have been submitted yet. When participants submit their Python code, evaluations will appear here."
            icon={<FileCheck size={36} color="#3b82f6" />}
          />
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>VTU Number</th>
                  <th>Problem</th>
                  <th>Score</th>
                  <th>Test Suite</th>
                  <th>Execution Time</th>
                  <th>Submitted At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{s.participant_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.participant_email}</div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#00f5a0', fontWeight: 700 }}>
                        {s.vtu_number}
                      </span>
                    </td>
                    <td>{s.question_title}</td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: s.score === s.max_score ? '#10b981' : '#f59e0b', fontSize: '0.95rem' }}>
                        {s.score} / {s.max_score}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        {s.passed_cases} / {s.total_cases} Passed
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {s.execution_time_ms ? `${s.execution_time_ms}ms` : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleTimeString() : '—'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => setSelectedSubmission(s)}
                        className="btn btn-secondary btn-sm"
                      >
                        <Eye size={13} />
                        Inspect Code
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Code & Evaluation Results Inspection Modal */}
        {selectedSubmission && (
          <Modal
            isOpen={Boolean(selectedSubmission)}
            onClose={() => setSelectedSubmission(null)}
            title={`Code Inspection — ${selectedSubmission.participant_name} (${selectedSubmission.vtu_number})`}
            maxWidth="880px"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Submission Summary Banner */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(7, 11, 20, 0.85)',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Challenge</div>
                  <div style={{ fontWeight: 700, color: '#fff' }}>{selectedSubmission.question_title}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Official Score</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 800, color: '#00f5a0' }}>
                    {selectedSubmission.score} / {selectedSubmission.max_score} marks
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Execution</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#93c5fd' }}>
                    {selectedSubmission.passed_cases}/{selectedSubmission.total_cases} passed ({selectedSubmission.execution_time_ms}ms)
                  </div>
                </div>
              </div>

              {/* Submitted Python Code */}
              <div>
                <h4 style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Code2 size={16} color="#00d9f5" />
                  Submitted Python Solution
                </h4>
                <pre
                  style={{
                    background: '#090e1c',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    color: '#e2e8f0',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88rem',
                    lineHeight: '1.6',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {selectedSubmission.code}
                </pre>
              </div>

              {/* Per-Test-Case Sandbox Results (Admin can see Hidden Test Cases as well!) */}
              <div>
                <h4 style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '10px' }}>
                  Detailed Test Case Execution Breakdown
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                  {(selectedSubmission.execution_results || []).map((res: any, idx: number) => (
                    <div
                      key={res.id || idx}
                      style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: res.status === 'Passed' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px 16px',
                        fontSize: '0.82rem',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {res.status === 'Passed' ? <CheckCircle2 size={15} color="#10b981" /> : <XCircle size={15} color="#ef4444" />}
                          <span style={{ fontWeight: 700, color: res.status === 'Passed' ? '#10b981' : '#ef4444' }}>
                            Test Case {idx + 1} {res.is_hidden ? '(Concealed / Hidden)' : '(Public)'} — {res.status}
                          </span>
                        </div>
                        <span style={{ color: 'var(--text-muted)' }}>{res.execution_time_ms}ms</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Expected:</div>
                          <div style={{ color: '#00f5a0' }}>{res.expected_output || '(empty)'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Actual:</div>
                          <div style={{ color: res.status === 'Passed' ? '#00f5a0' : '#f87171' }}>{res.actual_output || '(no output)'}</div>
                        </div>
                      </div>

                      {res.error_message && (
                        <div style={{ marginTop: '6px', color: '#f87171', fontSize: '0.75rem' }}>
                          Error: {res.error_message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setSelectedSubmission(null)} className="btn btn-secondary">
                  Close Inspection
                </button>
              </div>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
};
