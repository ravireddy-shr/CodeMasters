import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { StatsCard } from '../../components/admin/StatsCard';
import { api } from '../../services/apiClient';
import {
  Users,
  Code2,
  FileCheck,
  CheckCircle2,
  Ban,
  Trophy,
  Activity,
  PlusCircle,
  Eye,
  Sliders,
} from 'lucide-react';

interface AdminDashboardPageProps {
  onNavigate: (path: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.getAdminStats();
        setStats(data);
      } catch {
        // handled
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--nav-height))' }}>
      <AdminSidebar currentPath="/admin/dashboard" onNavigate={onNavigate} />

      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>
        {/* Top Banner */}
        <div
          className="glass-card"
          style={{
            padding: '24px 30px',
            marginBottom: '32px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(13, 20, 36, 0.98) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase' }}>
              COMMAND CENTER • ROUND 2
            </div>
            <h2 style={{ fontSize: '1.75rem', margin: '4px 0 6px', color: '#fff' }}>
              Round 2 Event Telemetry & Administration
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              Live proctoring telemetry, Python problem suite, authoritative server scoring, and participant overrides.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => onNavigate('/admin/questions')} className="btn btn-primary btn-sm">
              <PlusCircle size={15} />
              Manage Questions
            </button>
            <button onClick={() => onNavigate('/admin/submissions')} className="btn btn-royal btn-sm">
              <Eye size={15} />
              Inspect Submissions
            </button>
            <button onClick={() => onNavigate('/admin/settings')} className="btn btn-secondary btn-sm">
              <Sliders size={15} />
              Timers & Settings
            </button>
          </div>
        </div>

        {/* Real-Time Database Metrics (No Fake Data) */}
        <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Live Assessment Telemetry</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '36px',
          }}
        >
          <StatsCard
            label="Total Participants"
            value={stats?.total_participants}
            subtext="Registered in database"
            icon={<Users size={18} />}
            accentColor="#00d9f5"
          />

          <StatsCard
            label="Active in Exam"
            value={stats?.active_participants}
            subtext="Currently coding in IDE"
            icon={<Activity size={18} />}
            accentColor="#3b82f6"
          />

          <StatsCard
            label="Completed & Submitted"
            value={stats?.submitted_participants}
            subtext="Authoritative evaluations"
            icon={<CheckCircle2 size={18} />}
            accentColor="#10b981"
          />

          <StatsCard
            label="Disqualified"
            value={stats?.disqualified_participants}
            subtext="Proctoring infractions"
            icon={<Ban size={18} />}
            accentColor="#ef4444"
          />

          <StatsCard
            label="Debugging Problems"
            value={stats?.total_questions}
            subtext="Configured challenges"
            icon={<Code2 size={18} />}
            accentColor="#a855f7"
          />

          <StatsCard
            label="Total Submissions"
            value={stats?.total_submissions}
            subtext="Executed in sandbox"
            icon={<FileCheck size={18} />}
            accentColor="#f59e0b"
          />

          <StatsCard
            label="Average Score"
            value={stats?.average_score}
            subtext="Across all evaluated solutions"
            icon={<Trophy size={18} />}
            accentColor="#00f5a0"
          />
        </div>

        {/* Quick Guide */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h4 style={{ fontSize: '1.05rem', color: '#fff', marginBottom: '10px' }}>
            Round 2 Operational Workflow
          </h4>
          <ol style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.7' }}>
            <li><strong>Questions & Tests:</strong> Create Python debugging challenges and configure both public test cases (for practice runs) and hidden test cases (for authoritative scoring).</li>
            <li><strong>Settings & Timers:</strong> Configure assessment start time, duration (default 90 mins), and proctoring warning limits.</li>
            <li><strong>Submissions & Code Inspection:</strong> Inspect exact student solutions, execution times, and pass/fail diagnostics.</li>
            <li><strong>Participant Overrides:</strong> Disqualify, re-enable, or unlock student submissions as needed.</li>
          </ol>
        </div>
      </main>
    </div>
  );
};
