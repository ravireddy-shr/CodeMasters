import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { api } from '../../services/apiClient';
import { supabase } from '../../utils/supabase';
import { Users, Search, RotateCcw, Unlock, Ban, UserCheck, ShieldAlert, Clock, Plus, X, Zap } from 'lucide-react';

interface AdminParticipantsPageProps {
  onNavigate: (path: string) => void;
}

interface ExtraTimeModalState {
  isOpen: boolean;
  mode: 'individual' | 'bulk';
  participant?: any;
  minutes: number;
  reason: string;
  isSubmitting: boolean;
}

export const AdminParticipantsPage: React.FC<AdminParticipantsPageProps> = ({ onNavigate }) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [modalState, setModalState] = useState<ExtraTimeModalState>({
    isOpen: false,
    mode: 'individual',
    participant: null,
    minutes: 10,
    reason: 'Proctor time extension',
    isSubmitting: false,
  });

  const fetchParticipants = async () => {
    try {
      const data = await api.adminListParticipants();
      setParticipants(data);
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
  }, []);

  const handleOverride = async (participantId: string, action: string, reason?: string) => {
    try {
      await api.adminOverrideParticipant(participantId, action, reason);
      await fetchParticipants();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleGrantExtraTimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalState((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const { mode, participant, minutes, reason } = modalState;
      if (mode === 'individual' && participant) {
        await api.adminAddParticipantExtraTime(participant.id, minutes, reason);
        try {
          const currentExtra = participant.extra_time_minutes || 0;
          await supabase
            .from('participants')
            .update({ extra_time_minutes: currentExtra + minutes })
            .eq('id', participant.id);
        } catch {
          // ignore supabase sync errors
        }
      } else {
        await api.adminBulkAddExtraTime(minutes, reason);
        try {
          const { data } = await supabase.from('participants').select('id, extra_time_minutes');
          if (data) {
            for (const p of data) {
              await supabase
                .from('participants')
                .update({ extra_time_minutes: (p.extra_time_minutes || 0) + minutes })
                .eq('id', p.id);
            }
          }
        } catch {
          // ignore
        }
      }
      await fetchParticipants();
      setModalState((prev) => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      alert(`Failed to grant extra time: ${err.message}`);
    } finally {
      setModalState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const filtered = participants.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.vtu_number || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--nav-height))' }}>
      <AdminSidebar currentPath="/admin/participants" onNavigate={onNavigate} />

      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Participant Management & Proctoring Overrides</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              Inspect registered student profiles, clear anti-cheat warnings, allocate extra time, and manage exam status.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() =>
                setModalState({
                  isOpen: true,
                  mode: 'bulk',
                  participant: null,
                  minutes: 10,
                  reason: 'Contest-wide proctor extra time',
                  isSubmitting: false,
                })
              }
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(0, 245, 160, 0.4)', color: '#00f5a0' }}
              title="Grant extra minutes to all participants at once"
            >
              <Clock size={15} />
              + Add Extra Time to ALL Participants
            </button>

            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                placeholder="Search by name, VTU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {participants.length === 0 ? (
          <EmptyState
            title="No Participants Registered"
            description="There are currently no participants in the database. When students register or log in, their profiles will populate here."
            icon={<Users size={36} color="var(--text-muted)" />}
          />
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>VTU Number</th>
                  <th>Registered Password</th>
                  <th>Status</th>
                  <th>Warnings</th>
                  <th>Extra Time</th>
                  <th>Round 2 Score</th>
                  <th>Submitted At</th>
                  <th>Administrative Overrides</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{p.full_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.email}</div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#00f5a0', fontWeight: 700 }}>
                        {p.vtu_number}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                        {p.password_plain || '••••••••'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Logins: {p.login_count || 1}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                      {p.is_disqualified && (
                        <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '2px' }}>
                          {p.disqualification_reason}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: p.warnings_count > 0 ? '#ef4444' : '#10b981',
                        }}
                      >
                        {p.warnings_count} active
                      </span>
                    </td>
                    <td>
                      {(p.extra_time_minutes || 0) > 0 ? (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: '#00f5a0',
                            fontWeight: 700,
                            background: 'rgba(0, 245, 160, 0.1)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(0, 245, 160, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.82rem',
                          }}
                        >
                          <Clock size={12} />
                          +{p.extra_time_minutes}m
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>0m</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#fff', fontSize: '1rem' }}>
                        {p.round2_score !== null ? `${p.round2_score} marks` : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {p.submitted_at ? new Date(p.submitted_at).toLocaleTimeString() : 'Not submitted'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Grant Individual Extra Time */}
                        <button
                          onClick={() =>
                            setModalState({
                              isOpen: true,
                              mode: 'individual',
                              participant: p,
                              minutes: 10,
                              reason: 'Proctor time extension',
                              isSubmitting: false,
                            })
                          }
                          className="btn btn-secondary btn-sm"
                          style={{ borderColor: 'rgba(0, 245, 160, 0.35)', color: '#00f5a0' }}
                          title={`Grant extra time to ${p.full_name}`}
                        >
                          <Clock size={13} />
                          + Time
                        </button>

                        {p.status === 'Submitted' && (
                          <button
                            onClick={() => handleOverride(p.id, 'unlock_submission')}
                            className="btn btn-outline btn-sm"
                            title="Unlock submission to allow participant to re-attempt"
                          >
                            <Unlock size={13} />
                            Unlock
                          </button>
                        )}

                        {p.warnings_count > 0 && (
                          <button
                            onClick={() => handleOverride(p.id, 'reset_warnings')}
                            className="btn btn-secondary btn-sm"
                            title="Reset warnings to 0"
                          >
                            <RotateCcw size={13} />
                            Reset Warnings
                          </button>
                        )}

                        {p.is_disqualified ? (
                          <button
                            onClick={() => handleOverride(p.id, 're_enable')}
                            className="btn btn-primary btn-sm"
                            title="Re-enable participant"
                          >
                            <UserCheck size={13} />
                            Re-enable
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const r = prompt('Enter reason for administrative disqualification:');
                              if (r) handleOverride(p.id, 'disqualify', r);
                            }}
                            className="btn btn-danger btn-sm"
                            title="Disqualify participant"
                          >
                            <Ban size={13} />
                            Disqualify
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Extra Time Grant Modal */}
        {modalState.isOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
          >
            <div
              className="glass-card"
              style={{
                width: '100%',
                maxWidth: '480px',
                padding: '28px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(0, 245, 160, 0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(0, 245, 160, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#00f5a0',
                    }}
                  >
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>
                      {modalState.mode === 'bulk'
                        ? 'Grant Time to ALL Participants'
                        : `Extra Time for ${modalState.participant?.full_name}`}
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {modalState.mode === 'bulk'
                        ? 'Extends timer for all registered students currently competing'
                        : `VTU: ${modalState.participant?.vtu_number} | Current Extra: +${modalState.participant?.extra_time_minutes || 0}m`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleGrantExtraTimeSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Select Extra Minutes to Add</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {[5, 10, 15, 20, 30].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setModalState((prev) => ({ ...prev, minutes: mins }))}
                        className={`btn btn-sm ${modalState.minutes === mins ? 'btn-primary' : 'btn-outline'}`}
                        style={{ flex: 1, minWidth: '60px' }}
                      >
                        +{mins}m
                      </button>
                    ))}
                  </div>

                  <div style={{ position: 'relative' }}>
                    <Clock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="number"
                      className="form-input"
                      style={{ paddingLeft: '38px' }}
                      value={modalState.minutes}
                      onChange={(e) => setModalState((prev) => ({ ...prev, minutes: Math.max(1, Number(e.target.value)) }))}
                      min={1}
                      max={180}
                      placeholder="Custom extra minutes"
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label className="form-label">Reason / Justification</label>
                  <input
                    type="text"
                    className="form-input"
                    value={modalState.reason}
                    onChange={(e) => setModalState((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="e.g., Proctor time compensation, system glitch"
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                    className="btn btn-outline"
                    disabled={modalState.isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={modalState.isSubmitting}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Clock size={15} />
                    {modalState.isSubmitting ? 'Granting Time...' : `Confirm & Grant +${modalState.minutes} Mins`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
