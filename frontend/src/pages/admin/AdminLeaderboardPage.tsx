import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { EmptyState } from '../../components/common/EmptyState';
import { api } from '../../services/apiClient';
import { LeaderboardEntry } from '../../types';
import { Trophy, Medal, Search, Clock, ArrowUpDown } from 'lucide-react';

interface AdminLeaderboardPageProps {
  onNavigate: (path: string) => void;
}

export const AdminLeaderboardPage: React.FC<AdminLeaderboardPageProps> = ({ onNavigate }) => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'time' | 'name'>('score');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await api.adminGetLeaderboard();
        setLeaderboard(data);
      } catch {
        // handled
      } finally {
        setIsLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const sorted = [...leaderboard].filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      (item.full_name || '').toLowerCase().includes(q) ||
      (item.vtu_number || '').toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (sortBy === 'score') {
      if (b.score !== a.score) return b.score - a.score;
      // Earlier submission timestamp breaks ties
      return new Date(a.submitted_at || 0).getTime() - new Date(b.submitted_at || 0).getTime();
    }
    if (sortBy === 'time') {
      return (a.execution_time_ms || 999999) - (b.execution_time_ms || 999999);
    }
    return (a.full_name || '').localeCompare(b.full_name || '');
  });

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--nav-height))' }}>
      <AdminSidebar currentPath="/admin/leaderboard" onNavigate={onNavigate} />

      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Round 2 Official Leaderboard</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              Rankings calculated strictly from evaluated test suites. Earlier submission timestamps break score ties.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                placeholder="Search participant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              onClick={() => setSortBy(sortBy === 'score' ? 'time' : 'score')}
              className="btn btn-secondary btn-sm"
              title="Toggle sort criteria"
            >
              <ArrowUpDown size={14} />
              Sort: {sortBy.toUpperCase()}
            </button>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <EmptyState
            title="Leaderboard is Currently Empty"
            description="No evaluated submissions recorded yet. As participants submit solutions, authoritative rankings will populate in real time."
            icon={<Trophy size={36} color="#00f5a0" />}
          />
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Rank</th>
                  <th>Participant</th>
                  <th>VTU Roll Number</th>
                  <th>Score</th>
                  <th>Cases Passed</th>
                  <th>Execution Time</th>
                  <th>Submission Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item, index) => {
                  const rank = index + 1;
                  return (
                    <tr key={item.participant_id || index}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {rank === 1 && <Medal size={18} color="#fbbf24" />}
                          {rank === 2 && <Medal size={18} color="#94a3b8" />}
                          {rank === 3 && <Medal size={18} color="#b45309" />}
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 800,
                              fontSize: '1rem',
                              color: rank <= 3 ? '#fff' : 'var(--text-muted)',
                            }}
                          >
                            #{rank}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{item.full_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.email}</div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', color: '#00f5a0', fontWeight: 700 }}>
                          {item.vtu_number}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 800,
                            fontSize: '1.1rem',
                            color: item.score === item.max_score ? '#10b981' : '#f59e0b',
                          }}
                        >
                          {item.score} / {item.max_score}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                          {item.passed_cases ?? '—'} / {item.total_cases ?? '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {item.execution_time_ms ? `${item.execution_time_ms}ms` : '—'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <Clock size={13} color="var(--text-muted)" />
                          <span>{item.submitted_at ? new Date(item.submitted_at).toLocaleTimeString() : '—'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};
