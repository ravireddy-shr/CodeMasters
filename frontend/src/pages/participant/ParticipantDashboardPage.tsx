import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { api } from '../../services/apiClient';
import { supabase } from '../../utils/supabase';
import {
  Trophy,
  Award,
  ShieldAlert,
  CheckCircle2,
  Code2,
  Clock,
  ArrowRight,
  User,
  Laptop,
  AlertTriangle,
  Lock,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface ParticipantDashboardPageProps {
  onNavigate: (path: string) => void;
}

export const ParticipantDashboardPage: React.FC<ParticipantDashboardPageProps> = ({ onNavigate }) => {
  const { participant, refreshParticipant } = useAuth();
  const [questions, setQuestions] = useState<any[]>([]);
  const [competitionSettings, setCompetitionSettings] = useState<any>(null);
  const [userProgress, setUserProgress] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      await refreshParticipant();

      // Query questions: First try Supabase directly, then fallback to API
      let allQuestions: any[] = [];
      try {
        const { data: supaQuestions, error: supaErr } = await supabase
          .from('round2_questions')
          .select('*, round2_test_cases(*)')
          .eq('is_active', true)
          .order('question_number', { ascending: true });

        if (!supaErr && supaQuestions && supaQuestions.length > 0) {
          allQuestions = supaQuestions.map((q: any) => ({
            id: q.id,
            question_number: q.question_number,
            title: q.title,
            problem_statement: q.problem_statement,
            description: q.description,
            difficulty: q.difficulty,
            language: q.language || 'python',
            starter_code: q.starter_code,
            buggy_code: q.buggy_code,
            marks: q.marks,
            time_limit_seconds: q.time_limit_seconds,
            memory_limit_mb: q.memory_limit_mb,
            is_active: q.is_active,
            test_cases: (q.round2_test_cases || []).map((tc: any) => ({
              id: tc.id,
              input_data: tc.input_data,
              expected_output: tc.expected_output,
              is_hidden: tc.is_hidden,
              marks: tc.marks,
            })),
          }));
        } else {
          allQuestions = await api.getAllQuestions().catch(() => []);
        }
      } catch {
        allQuestions = await api.getAllQuestions().catch(() => []);
      }

      const [settings, progress] = await Promise.all([
        api.getSettings().catch(() => null),
        api.getMyProgress().catch(() => null),
      ]);
      setQuestions(allQuestions || []);
      setCompetitionSettings(settings);
      setUserProgress(progress);
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Supabase Realtime Subscription for Instant Updates
    const channel = supabase
      .channel('student_dashboard_questions_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'round2_questions' },
        (payload) => {
          console.log('[Supabase Realtime] Questions updated:', payload);
          loadDashboardData();
        }
      )
      .subscribe();

    // Auto-refresh periodically so admin question uploads reflect automatically as secondary fallback
    const interval = setInterval(loadDashboardData, 10000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  if (!participant) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: '40px' }}>
          <AlertTriangle size={48} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.75rem', marginBottom: '8px' }}>Authentication Required</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Please log in with your VTU credentials to access the Code Masters Round 2 dashboard.
          </p>
          <button onClick={() => onNavigate('/participant/login')} className="btn btn-primary">
            Go to Participant Login
          </button>
        </div>
      </div>
    );
  }

  const isSubmitted = participant.status === 'Submitted' || Boolean(userProgress?.is_all_submitted);
  const isDisqualified = participant.isDisqualified;

  return (
    <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '32px 24px 80px' }}>
      {/* Laptop / Desktop Recommended Alert */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 18px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          color: '#93c5fd',
          fontSize: '0.85rem',
          marginBottom: '24px',
        }}
      >
        <Laptop size={18} style={{ flexShrink: 0 }} />
        <span>
          <strong>Notice:</strong> For optimal code inspection and Monaco Editor ergonomics, a laptop or desktop computer is strongly recommended.
        </span>
      </div>

      {/* Participant Profile Banner */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          padding: '24px 32px',
          marginBottom: '32px',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(13, 20, 36, 0.98) 100%)',
          border: '1px solid rgba(0, 245, 160, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00f5a0 0%, #00d9f5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#070b14',
              boxShadow: '0 0 20px rgba(0, 245, 160, 0.3)',
            }}
          >
            <User size={28} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.65rem' }}>{participant.fullName}</h2>
              <StatusBadge status={participant.status} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '0.85rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#00f5a0', fontWeight: 700 }}>
                {participant.vtuNumber}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {participant.email}
              </span>
            </div>
          </div>
        </div>

        <div>
          {!isSubmitted && !isDisqualified ? (
            <button
              onClick={() => onNavigate('/participant/coding')}
              className="btn btn-primary"
            >
              Enter Coding Arena
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => onNavigate('/participant/coding')}
              className="btn btn-secondary btn-sm"
            >
              View Submission Details
            </button>
          )}
        </div>
      </div>

      {/* 4 Metric Telemetry Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '36px',
        }}
      >
        {/* Score */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Round 2 Total Score
            </span>
            <Trophy size={18} color="#00f5a0" />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: isSubmitted ? '#00f5a0' : 'var(--text-muted)' }}>
            {isSubmitted ? `${participant.round2Score ?? userProgress?.total_score ?? 0} / 100` : '— / 100'}
          </div>
          <div style={{ fontSize: '0.72rem', color: isSubmitted ? '#00f5a0' : 'var(--text-muted)', marginTop: '4px' }}>
            {isSubmitted ? 'All questions evaluated' : `${userProgress?.submitted_count || 0} of ${questions.length || 5} submitted (unlocks on finish)`}
          </div>
        </div>

        {/* Stage */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Current Stage
            </span>
            <Award size={18} color="#00d9f5" />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: '#00d9f5' }}>
            Round 02
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Python Code Debugging (100 Marks)
          </div>
        </div>

        {/* Warnings */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Warnings Active
            </span>
            <ShieldAlert size={18} color={participant.warningsCount > 0 ? '#ef4444' : '#f59e0b'} />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.6rem',
              fontWeight: 800,
              color: participant.warningsCount > 0 ? '#ef4444' : '#00f5a0',
            }}
          >
            {participant.warningsCount} / {competitionSettings?.max_warnings || 3}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {participant.warningsCount === 0 ? 'Clean integrity status' : 'Proctoring warnings recorded'}
          </div>
        </div>

        {/* Progression */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Questions Completed
            </span>
            <Layers size={18} color="#a855f7" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
            {userProgress?.submitted_count || 0} / {questions.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isSubmitted ? 'All 5 questions finalized' : 'Step-by-step progress'}
          </div>
        </div>
      </div>

      {/* Written Results Dashboard (Only shown when all questions are submitted) */}
      {isSubmitted && userProgress?.submissions && userProgress.submissions.length > 0 && (
        <div
          className="glass-card"
          style={{
            padding: '28px 32px',
            marginBottom: '36px',
            background: 'linear-gradient(135deg, rgba(16, 24, 40, 0.95) 0%, rgba(13, 20, 36, 0.98) 100%)',
            border: '1px solid rgba(0, 245, 160, 0.35)',
            boxShadow: '0 10px 30px rgba(0, 245, 160, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={24} color="#00f5a0" />
                <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#fff' }}>Round 2 Official Written Results</h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '6px 0 0' }}>
                All {userProgress.submitted_count} questions have been authoritatively evaluated based on hidden & public test cases.
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Score Earned</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.4rem', fontWeight: 800, color: '#00f5a0' }}>
                {userProgress.total_score} / 100
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Problem #</th>
                  <th style={{ padding: '10px 12px' }}>Problem Title</th>
                  <th style={{ padding: '10px 12px' }}>Test Cases Passed</th>
                  <th style={{ padding: '10px 12px' }}>Marks Earned</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {userProgress.submissions.map((sub: any, idx: number) => (
                  <tr key={sub.question_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: '#00d9f5', fontWeight: 700 }}>
                      Problem {sub.question_number || idx + 1}
                    </td>
                    <td style={{ padding: '12px', color: '#fff', fontWeight: 600 }}>
                      {sub.question_title}
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: sub.passed_cases === sub.total_cases ? '#00f5a0' : '#f59e0b' }}>
                        {sub.passed_cases} / {sub.total_cases}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#00f5a0' }}>
                      {sub.score} / {sub.marks || 20}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: sub.score > 0 ? 'rgba(0, 245, 160, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: sub.score > 0 ? '#00f5a0' : '#ef4444',
                          border: sub.score > 0 ? '1px solid rgba(0, 245, 160, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                        }}
                      >
                        {sub.score === sub.marks ? 'ALL PASSED' : (sub.score > 0 ? 'PARTIAL' : 'FAILED')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assessment In Progress Alert with Step-by-Step Resume Button */}
      {!isSubmitted && (
        <div
          className="glass-card"
          style={{
            padding: '24px 28px',
            marginBottom: '36px',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="#00d9f5" />
              <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>Assessment In Progress</h4>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(0, 217, 245, 0.15)',
                  border: '1px solid rgba(0, 217, 245, 0.3)',
                  color: '#00d9f5',
                }}
              >
                Step {Math.min((userProgress?.submitted_count || 0) + 1, questions.length || 5)} of {questions.length || 5}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '6px 0 0' }}>
              {userProgress?.submitted_count || 0} of {questions.length} questions submitted. Your total marks (out of 100) will be revealed here once all questions are completed.
            </p>
          </div>

          <button
            onClick={() => onNavigate('/participant/coding')}
            className="btn btn-primary"
            style={{ minWidth: '180px' }}
          >
            Resume Assessment
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Synchronized Questions Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ fontSize: '1.35rem', margin: 0, color: '#fff' }}>Round 2 Challenges</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 0' }}>
            All problems uploaded by event organizers appear here automatically. Select a problem to start debugging.
          </p>
        </div>

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(0, 245, 160, 0.1)',
            border: '1px solid rgba(0, 245, 160, 0.25)',
            color: '#00f5a0',
          }}
        >
          {questions.length} Active Challenges
        </span>
      </div>

      {questions.length === 0 ? (
        <EmptyState
          title="No Questions Configured Yet"
          description="The organizers have not uploaded or activated problems for Round 2 yet. Please stay on this screen; questions will automatically populate once uploaded in the admin portal."
          icon={<Code2 size={36} color="#00d9f5" />}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {questions.map((q, idx) => {
            const publicCases = (q.test_cases || q.testCases || []).filter((tc: any) => !tc.is_hidden && !tc.isHidden);

            return (
              <div
                key={q.id}
                className="glass-card glass-card-interactive"
                style={{
                  padding: '24px 28px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#00d9f5',
                          background: 'rgba(0, 217, 245, 0.12)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(0, 217, 245, 0.3)',
                        }}
                      >
                        PROBLEM {q.question_number || idx + 1}
                      </span>

                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: q.difficulty === 'Easy' ? 'rgba(16, 185, 129, 0.12)' : (q.difficulty === 'Hard' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)'),
                          border: q.difficulty === 'Easy' ? '1px solid rgba(16, 185, 129, 0.3)' : (q.difficulty === 'Hard' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'),
                          color: q.difficulty === 'Easy' ? '#10b981' : (q.difficulty === 'Hard' ? '#ef4444' : '#f59e0b'),
                        }}
                      >
                        {q.difficulty}
                      </span>

                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#93c5fd' }}>
                        {q.marks} Marks
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.35rem', color: '#fff', marginBottom: '8px' }}>
                      {q.title}
                    </h3>

                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '14px', maxWidth: '850px' }}>
                      {q.problem_statement || q.problemStatement || q.description}
                    </p>

                    <div style={{ display: 'flex', gap: '20px', fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      <span>Public Test Cases: <strong style={{ color: '#fff' }}>{publicCases.length}</strong></span>
                      <span>•</span>
                      <span>Language: <strong style={{ color: '#00f5a0' }}>Python 3.12</strong></span>
                      <span>•</span>
                      <span>Timeout: <strong style={{ color: '#fff' }}>{q.time_limit_seconds || 3}s</strong></span>
                    </div>
                  </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '8px' }}>
                      {userProgress?.submissions_map?.[q.id] && (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(0, 245, 160, 0.12)',
                            border: '1px solid rgba(0, 245, 160, 0.3)',
                            color: '#00f5a0',
                            fontWeight: 700,
                          }}
                        >
                          ✓ Submitted {isSubmitted ? `(${userProgress.submissions_map[q.id].score} / ${q.marks} pts)` : ''}
                        </span>
                      )}
                      <button
                        onClick={() => onNavigate(`/participant/coding#q=${q.id}`)}
                        className={`btn ${userProgress?.submissions_map?.[q.id] ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ minWidth: '160px' }}
                      >
                        {isSubmitted ? 'View Problem' : (userProgress?.submissions_map?.[q.id] ? 'Review Problem' : `Solve Problem ${q.question_number || idx + 1}`)}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
