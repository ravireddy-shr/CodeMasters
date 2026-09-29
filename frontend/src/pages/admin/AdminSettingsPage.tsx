import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { api } from '../../services/apiClient';
import { supabase } from '../../utils/supabase';
import { Sliders, Save, Clock, ShieldAlert, CheckCircle2, Plus, Minus, Zap } from 'lucide-react';

interface AdminSettingsPageProps {
  onNavigate: (path: string) => void;
}

export const AdminSettingsPage: React.FC<AdminSettingsPageProps> = ({ onNavigate }) => {
  const [competitionName, setCompetitionName] = useState('Code Masters Round 2 - Python Debugging Challenge');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [maxWarnings, setMaxWarnings] = useState(3);
  const [isActive, setIsActive] = useState(true);
  const [autoSubmitOnExpire, setAutoSubmitOnExpire] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const s = await api.getSettings();
        if (s) {
          setCompetitionName(s.competition_name || s.competitionName);
          setDurationMinutes(s.duration_minutes || s.durationMinutes || 90);
          setMaxWarnings(s.max_warnings || s.maxWarnings || 3);
          setIsActive(s.is_active !== undefined ? s.is_active : s.isActive);
          setAutoSubmitOnExpire(s.auto_submit_on_expire !== undefined ? s.auto_submit_on_expire : true);
        }
      } catch {
        // handled
      }
    };
    fetchSettings();
  }, []);

  const handleQuickAdjust = async (delta: number) => {
    const newDuration = Math.max(5, durationMinutes + delta);
    setDurationMinutes(newDuration);
    setIsSaving(true);
    setMessage('');
    try {
      await api.adminAdjustTime(delta);
      try {
        await supabase.from('round2_settings').update({ duration_minutes: newDuration }).neq('id', '00000000-0000-0000-0000-000000000000');
      } catch {
        // ignore supabase sync errors if local only
      }
      setMessage(`Exam duration adjusted by ${delta > 0 ? '+' : ''}${delta} minutes (New duration: ${newDuration} mins). Participants' timers updated.`);
    } catch (err: any) {
      alert(`Adjustment error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreset = async (presetMinutes: number) => {
    setDurationMinutes(presetMinutes);
    setIsSaving(true);
    setMessage('');
    try {
      await api.adminUpdateSettings({ duration_minutes: presetMinutes });
      try {
        await supabase.from('round2_settings').update({ duration_minutes: presetMinutes }).neq('id', '00000000-0000-0000-0000-000000000000');
      } catch {
        // ignore
      }
      setMessage(`Contest duration preset applied: ${presetMinutes} minutes (${Math.floor(presetMinutes / 60)}h ${presetMinutes % 60}m).`);
    } catch (err: any) {
      alert(`Preset error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    try {
      await api.adminUpdateSettings({
        competition_name: competitionName,
        duration_minutes: Number(durationMinutes),
        max_warnings: Number(maxWarnings),
        is_active: isActive,
        auto_submit_on_expire: autoSubmitOnExpire,
      });
      try {
        await supabase.from('round2_settings').update({
          competition_name: competitionName,
          duration_minutes: Number(durationMinutes),
          max_warnings: Number(maxWarnings),
          is_active: isActive,
          auto_submit_on_expire: autoSubmitOnExpire,
        }).neq('id', '00000000-0000-0000-0000-000000000000');
      } catch {
        // ignore
      }
      setMessage('Competition settings updated successfully across databases & realtime channels.');
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--nav-height))' }}>
      <AdminSidebar currentPath="/admin/settings" onNavigate={onNavigate} />

      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Contest Settings & Authoritative Timers</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Control Round 2 timer duration, proctoring warning tolerance, and competition active status.
          </p>
        </div>

        {message && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '24px',
              maxWidth: '680px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{ maxWidth: '680px' }} className="glass-card">
          <div style={{ padding: '28px' }}>
            <div className="form-group">
              <label className="form-label">Competition Name</label>
              <input
                type="text"
                className="form-input"
                value={competitionName}
                onChange={(e) => setCompetitionName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Exam Duration (Minutes)</label>
                  <span style={{ fontSize: '0.78rem', color: '#00f5a0', fontFamily: 'var(--font-mono)' }}>
                    {Math.floor(durationMinutes / 60)}h {durationMinutes % 60}m
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <Clock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="number"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    min={5}
                    max={360}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Max Allowed Warnings</label>
                <div style={{ position: 'relative' }}>
                  <ShieldAlert size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="number"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    value={maxWarnings}
                    onChange={(e) => setMaxWarnings(Number(e.target.value))}
                    min={1}
                    max={10}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Quick Live Adjustments & Presets */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-sm)', padding: '16px', margin: '14px 0 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Zap size={14} color="#00f5a0" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Live Time Controls (Instant Realtime Sync)
                </span>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Quick Add / Subtract Exam Duration:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: '+5m', val: 5 },
                    { label: '+10m', val: 10 },
                    { label: '+15m', val: 15 },
                    { label: '+30m', val: 30 },
                    { label: '-5m', val: -5 },
                    { label: '-10m', val: -10 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleQuickAdjust(btn.val)}
                      className={`btn btn-sm ${btn.val > 0 ? 'btn-secondary' : 'btn-outline'}`}
                      style={{ fontSize: '0.78rem', padding: '4px 10px', height: 'auto' }}
                    >
                      {btn.val > 0 ? <Plus size={12} /> : <Minus size={12} />}
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Duration Presets:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { label: '45 mins', val: 45 },
                    { label: '1 Hour (60m)', val: 60 },
                    { label: '1.5 Hours (90m - Standard)', val: 90 },
                    { label: '2 Hours (120m)', val: 120 },
                    { label: '3 Hours (180m)', val: 180 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      disabled={isSaving}
                      onClick={() => handlePreset(preset.val)}
                      className={`btn btn-sm ${durationMinutes === preset.val ? 'btn-primary' : 'btn-outline'}`}
                      style={{ fontSize: '0.75rem', padding: '4px 9px', height: 'auto' }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ margin: '20px 0 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#00f5a0' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>Contest Active & Live</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    When unchecked, participants cannot start new debugging sessions or submit solutions.
                  </div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoSubmitOnExpire}
                  onChange={(e) => setAutoSubmitOnExpire(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#00f5a0' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>Auto-Submit on Timer Expiry</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Automatically submit and score the participant's current buffer when countdown reaches zero.
                  </div>
                </div>
              </label>
            </div>

            <button type="submit" disabled={isSaving} className="btn btn-primary">
              <Save size={15} />
              {isSaving ? 'Updating...' : 'Save Settings to Database'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
