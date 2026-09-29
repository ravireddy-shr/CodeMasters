import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useExamTimer } from '../../hooks/useExamTimer';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { api } from '../../services/apiClient';
import { supabase } from '../../utils/supabase';
import { DebuggingQuestion, TestCaseResult } from '../../types';
import { ExamHeader } from '../../components/exam/ExamHeader';
import { WarningModal } from '../../components/exam/WarningModal';
import { DisqualificationModal } from '../../components/exam/DisqualificationModal';
import { SubmissionConfirmModal } from '../../components/exam/SubmissionConfirmModal';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import Editor from '@monaco-editor/react';
import {
  BookOpen,
  Code2,
  Terminal,
  Play,
  RotateCcw,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Lightbulb,
  Sparkles,
  ArrowRight,
  EyeOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Round2CodingPageProps {
  onNavigate: (path: string) => void;
}

export const Round2CodingPage: React.FC<Round2CodingPageProps> = ({ onNavigate }) => {
  const { participant, refreshParticipant } = useAuth();

  // Multi-question state
  const [questions, setQuestions] = useState<DebuggingQuestion[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [settings, setSettings] = useState<any>(null);

  // Per-question submissions map & step-by-step progress
  const [submissionsMap, setSubmissionsMap] = useState<Record<string, any>>({});
  const [isStepSuccessModalOpen, setIsStepSuccessModalOpen] = useState(false);
  const [stepSuccessData, setStepSuccessData] = useState<any>(null);

  // Per-question code buffer store: { [questionId]: code }
  const [codeBuffers, setCodeBuffers] = useState<Record<string, string>>({});

  // Execution state per question
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [executionResults, setExecutionResults] = useState<TestCaseResult[] | null>(null);
  const [errorSummary, setErrorSummary] = useState<any | null>(null);

  // Active right-pane console tab: 'testcases' | 'results' | 'advice'
  const [activeConsoleTab, setActiveConsoleTab] = useState<'testcases' | 'results' | 'advice'>('testcases');
  const [activeTestCaseIndex, setActiveTestCaseIndex] = useState<number>(0);

  // Left pane sub-tab: 'description' | 'examples' | 'hints'
  const [activeLeftTab, setActiveLeftTab] = useState<'description' | 'examples' | 'hints'>('description');

  // Modal states
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [finalSubmissionData, setFinalSubmissionData] = useState<any>(null);

  // Proctoring warnings
  const [activeWarning, setActiveWarning] = useState<{ reason: string; message: string; warningsCount: number } | null>(null);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [disqualificationReason, setDisqualificationReason] = useState('');

  // Initial load: Fetch all questions synchronized with Supabase & Admin
  useEffect(() => {
    const loadQuestionsAndSettings = async () => {
      try {
        await refreshParticipant();

        // Query questions: First try Supabase directly, then fallback to API
        let allQ: any[] = [];
        try {
          const { data: supaQ, error: supaErr } = await supabase
            .from('round2_questions')
            .select('*, round2_test_cases(*)')
            .eq('is_active', true)
            .order('question_number', { ascending: true });

          if (!supaErr && supaQ && supaQ.length > 0) {
            allQ = supaQ.map((q: any) => ({
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
            allQ = await api.getAllQuestions().catch(() => []);
          }
        } catch {
          allQ = await api.getAllQuestions().catch(() => []);
        }

        const [sett, progress] = await Promise.all([
          api.getSettings().catch(() => null),
          api.getMyProgress().catch(() => null),
        ]);

        const mappedQuestions: DebuggingQuestion[] = (allQ || []).map((q: any) => ({
          id: q.id,
          questionNumber: q.question_number,
          title: q.title,
          problemStatement: q.problem_statement || q.description,
          description: q.description,
          difficulty: q.difficulty,
          language: q.language || 'python',
          starterCode: q.starter_code,
          buggyCode: q.buggy_code,
          marks: q.marks,
          timeLimitSeconds: q.time_limit_seconds || 3.0,
          memoryLimitMb: q.memory_limit_mb || 128,
          testCases: (q.test_cases || []).map((tc: any) => ({
            id: tc.id,
            inputData: tc.input_data,
            expectedOutput: tc.expected_output,
            isHidden: tc.is_hidden,
            marks: tc.marks,
          })),
        }));

        setQuestions(mappedQuestions);
        setSettings(sett);

        // Store existing submissions map
        if (progress?.submissions_map) {
          setSubmissionsMap(progress.submissions_map);
        }

        // Initialize code buffers with buggyCode for each question
        const initialBuffers: Record<string, string> = {};
        mappedQuestions.forEach((q) => {
          initialBuffers[q.id] = q.buggyCode;
        });
        setCodeBuffers(initialBuffers);

        // Intelligently select active problem: URL hash or first unsubmitted problem
        let targetIdx = 0;
        const hashMatch = window.location.hash.match(/#q=([^&]+)/);
        if (hashMatch) {
          const found = mappedQuestions.findIndex((q) => q.id === hashMatch[1]);
          if (found !== -1) targetIdx = found;
        } else if (progress?.submissions_map) {
          const unsubmitted = mappedQuestions.findIndex((q) => !progress.submissions_map[q.id]);
          if (unsubmitted !== -1) targetIdx = unsubmitted;
        }
        setActiveQuestionIndex(targetIdx);

        if (participant?.status === 'Submitted' || progress?.is_all_submitted) {
          setIsSubmitted(true);
          setFinalScore(progress?.total_score ?? participant?.round2Score);
        }

        if (participant?.isDisqualified) {
          setIsDisqualified(true);
          setDisqualificationReason(participant.disqualificationReason || 'Accumulated proctoring warnings');
        }
      } catch {
        // error handled
      }
    };

    loadQuestionsAndSettings();

    // Supabase Realtime subscription for instant questions, settings, and participant extra time updates
    const channel = supabase
      .channel('student_coding_questions_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'round2_questions' },
        (payload) => {
          console.log('[Supabase Realtime] Coding page questions updated:', payload);
          loadQuestionsAndSettings();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'round2_settings' },
        (payload) => {
          console.log('[Supabase Realtime] Contest settings updated:', payload);
          loadQuestionsAndSettings();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants' },
        (payload) => {
          console.log('[Supabase Realtime] Participant profile/time updated:', payload);
          refreshParticipant();
        }
      )
      .subscribe();

    // Periodic heartbeat sync every 15s to guarantee timer & settings stay synchronized
    const syncInterval = setInterval(() => {
      refreshParticipant();
      api.getSettings().then((st) => {
        if (st) setSettings(st);
      }).catch(() => {});
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(syncInterval);
    };
  }, []);

  const activeQuestion: DebuggingQuestion | undefined = questions[activeQuestionIndex];
  const currentCode = activeQuestion ? (codeBuffers[activeQuestion.id] ?? activeQuestion.buggyCode) : '';

  const updateCurrentCode = (newCode: string) => {
    if (!activeQuestion) return;
    setCodeBuffers((prev) => ({
      ...prev,
      [activeQuestion.id]: newCode,
    }));
  };

  // Auto-submit when countdown hits zero
  const handleTimeExpired = async () => {
    if (!isSubmitted && activeQuestion && !isDisqualified) {
      try {
        const sub = await api.submitCode(activeQuestion.id, currentCode, true);
        setIsSubmitted(true);
        setFinalScore(sub.score);
        setFinalSubmissionData(sub);
        await refreshParticipant();
      } catch {
        // ignore
      }
    }
  };

  // Total calculated exam duration: contest base duration + individual extra time granted by admin
  const totalDurationMinutes = (settings?.duration_minutes || 90) + (participant?.extraTimeMinutes || participant?.extra_time_minutes || 0);

  // Exam timer
  const { formattedTime, isLowTime } = useExamTimer({
    initialMinutes: totalDurationMinutes,
    endTimeIso: settings?.end_time,
    isRunning: !isSubmitted && !isDisqualified && Boolean(activeQuestion),
    onTimeExpired: handleTimeExpired,
  });

  // Anti-cheat monitoring
  useAntiCheat({
    enabled: !isSubmitted && !isDisqualified && Boolean(activeQuestion),
    onWarning: (w) => {
      setActiveWarning({
        reason: w.reason,
        message: w.message,
        warningsCount: w.warningsCount,
      });
      refreshParticipant();
    },
    onDisqualified: (reason) => {
      setIsDisqualified(true);
      setDisqualificationReason(reason);
      refreshParticipant();
    },
  });

  // Run Code against Public Test Cases
  const handleRunCode = async () => {
    if (!activeQuestion || isRunning || isSubmitted) return;
    if (participant) {
      api.setParticipantInfo(participant.id, participant.vtuNumber);
    }
    setIsRunning(true);
    setActiveConsoleTab('results');
    try {
      const res = await api.runCode(activeQuestion.id, currentCode);
      setExecutionResults(res.results);
      setErrorSummary(res.error_summary);

      // If an error or mistake occurred, switch to results/advice
      if (!res.success && res.error_summary?.error_tip) {
        setActiveConsoleTab('advice');
      }
    } catch (err: any) {
      alert(`Run error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Step-by-Step Problem Submission
  const handleConfirmSubmit = async () => {
    if (!activeQuestion || isSubmitting) return;
    if (participant) {
      api.setParticipantInfo(participant.id, participant.vtuNumber);
    }
    setIsSubmitting(true);
    try {
      const res = await api.submitCode(activeQuestion.id, currentCode, false);
      setIsConfirmModalOpen(false);

      const updatedMap = {
        ...submissionsMap,
        [activeQuestion.id]: {
          ...res,
          question_title: activeQuestion.title,
          question_number: activeQuestion.questionNumber || activeQuestionIndex + 1,
          marks: activeQuestion.marks || 20,
        },
      };
      setSubmissionsMap(updatedMap);

      const submittedCount = Object.keys(updatedMap).length;
      const isAllDone = res.is_all_submitted || submittedCount >= questions.length;
      await refreshParticipant();

      if (isAllDone) {
        setIsSubmitted(true);
        const total = res.total_accumulated_score ?? Object.values(updatedMap).reduce((acc: number, item: any) => acc + (item.score || 0), 0);
        setFinalScore(total);
        setFinalSubmissionData(res);
        try {
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.6 },
          });
        } catch {
          // confetti
        }
      } else {
        // Find next unsubmitted problem
        let nextIdx = (activeQuestionIndex + 1) % questions.length;
        for (let i = 0; i < questions.length; i++) {
          const cand = (activeQuestionIndex + 1 + i) % questions.length;
          if (!updatedMap[questions[cand].id]) {
            nextIdx = cand;
            break;
          }
        }

        setStepSuccessData({
          questionNumber: activeQuestion.questionNumber || activeQuestionIndex + 1,
          title: activeQuestion.title,
          score: res.score,
          maxScore: res.max_score,
          passedCases: res.passed_cases,
          totalCases: res.total_cases,
          submittedCount,
          totalQuestions: questions.length,
          nextIndex: nextIdx,
        });
        setIsStepSuccessModalOpen(true);
      }
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!participant) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <h2>Authentication Required</h2>
        <button onClick={() => onNavigate('/participant/login')} className="btn btn-primary" style={{ marginTop: '16px' }}>
          Login to Enter Exam
        </button>
      </div>
    );
  }

  // Finalized Splash Screen (Shown ONLY after all questions are submitted)
  if (isSubmitted && finalScore !== null) {
    const totalMax = questions.reduce((sum, q) => sum + (q.marks || 20), 0) || 100;
    return (
      <div style={{ maxWidth: '780px', margin: '40px auto 80px', padding: '0 24px', textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: '40px 48px', border: '1px solid rgba(0, 245, 160, 0.4)' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'rgba(0, 245, 160, 0.15)',
              border: '2px solid #00f5a0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: '#00f5a0',
            }}
          >
            <CheckCircle2 size={42} />
          </div>

          <h2 style={{ fontSize: '2.1rem', marginBottom: '8px', color: '#fff' }}>Assessment Completed!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '28px' }}>
            All Round 2 Python debugging questions have been authoritatively evaluated based on hidden & public test cases.
          </p>

          <div
            style={{
              background: 'rgba(7, 11, 20, 0.85)',
              padding: '24px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '28px',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Final Aggregate Score
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '3.2rem', fontWeight: 800, color: '#00f5a0' }}>
              {finalScore} / {totalMax}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
              Completed all {questions.length} problems • 20 Marks Each (100 Marks Total)
            </div>
          </div>

          {/* Breakdown Table */}
          <div style={{ marginBottom: '32px', textAlign: 'left', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px' }}>Problem #</th>
                  <th style={{ padding: '8px' }}>Title</th>
                  <th style={{ padding: '8px' }}>Test Cases</th>
                  <th style={{ padding: '8px' }}>Score</th>
                  <th style={{ padding: '8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q, idx) => {
                  const sub = submissionsMap[q.id];
                  const qScore = sub ? sub.score : 0;
                  const passed = sub ? sub.passed_cases : 0;
                  const total = sub ? sub.total_cases : 0;

                  return (
                    <tr key={q.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', color: '#00d9f5', fontWeight: 700 }}>
                        Problem {q.questionNumber || idx + 1}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#fff', fontWeight: 600 }}>
                        {q.title}
                      </td>
                      <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)' }}>
                        {sub ? `${passed} / ${total}` : 'Not attempted'}
                      </td>
                      <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#00f5a0' }}>
                        {qScore} / {q.marks || 20}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: qScore === (q.marks || 20) ? 'rgba(0, 245, 160, 0.15)' : (qScore > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                            color: qScore === (q.marks || 20) ? '#00f5a0' : (qScore > 0 ? '#f59e0b' : '#ef4444'),
                            border: qScore === (q.marks || 20) ? '1px solid rgba(0, 245, 160, 0.3)' : (qScore > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'),
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                          }}
                        >
                          {qScore === (q.marks || 20) ? 'PASSED' : (qScore > 0 ? 'PARTIAL' : 'FAILED')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button onClick={() => onNavigate('/participant/dashboard')} className="btn btn-primary" style={{ minWidth: '220px' }}>
            View Dashboard & Results
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // If no questions are currently available
  if (questions.length === 0 || !activeQuestion) {
    return (
      <div style={{ maxWidth: '800px', margin: '80px auto', padding: '0 24px' }}>
        <EmptyState
          title="No Debugging Challenges Available"
          description="The organizers have not uploaded or published challenges for Round 2 yet. When questions are added in the admin dashboard, they will automatically reflect here."
          icon={<Code2 size={36} color="#00f5a0" />}
          actionText="Return to Dashboard"
          onAction={() => onNavigate('/participant/dashboard')}
        />
      </div>
    );
  }

  const publicTestCases = activeQuestion.testCases.filter((tc) => !tc.isHidden);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--nav-height))', overflow: 'hidden' }}>
      {/* Top Header */}
      <ExamHeader
        formattedTime={formattedTime}
        isLowTime={isLowTime}
        warningsCount={participant.warningsCount}
        maxWarnings={settings?.max_warnings || 3}
        onSubmitClick={() => setIsConfirmModalOpen(true)}
        onFinishContestClick={async () => {
          if (window.confirm('Finish the assessment now and finalize your total score out of 100?')) {
            try {
              const res = await api.finishContest();
              setIsSubmitted(true);
              setFinalScore(res.total_score);
              await refreshParticipant();
            } catch (e: any) {
              alert(`Error: ${e.message}`);
            }
          }
        }}
        isSubmitted={isSubmitted}
        activeQuestionNumber={activeQuestion?.questionNumber || activeQuestionIndex + 1}
        totalQuestions={questions.length}
        submittedCount={Object.keys(submissionsMap).length}
        isCurrentSubmitted={Boolean(activeQuestion && submissionsMap[activeQuestion.id])}
      />

      {/* Modern LeetCode / HackerRank 2-Pane Split Workspace */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          padding: '12px 16px',
          flex: 1,
          height: 'calc(100% - 64px)',
          overflow: 'hidden',
        }}
        className="leetcode-split-layout"
      >
        {/* ===================================================================
            LEFT PANE: Problem Statement, Constraints, Question Selector Tabs
            =================================================================== */}
        <aside
          className="glass-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(10, 16, 30, 0.95)',
          }}
        >
          {/* Question Switcher Tabs (LeetCode / HackerRank Style) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              background: 'rgba(15, 23, 42, 0.95)',
              borderBottom: '1px solid var(--border-subtle)',
              gap: '12px',
              overflowX: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} color="#00d9f5" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Problems:
              </span>

              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  disabled={activeQuestionIndex === 0}
                  onClick={() => {
                    const prev = Math.max(0, activeQuestionIndex - 1);
                    setActiveQuestionIndex(prev);
                    setExecutionResults(null);
                    setErrorSummary(null);
                    setActiveConsoleTab('testcases');
                  }}
                  className="btn btn-sm"
                  style={{
                    padding: '3px 6px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: 'var(--text-secondary)',
                    opacity: activeQuestionIndex === 0 ? 0.4 : 1,
                  }}
                  title="Previous Problem"
                >
                  <ChevronLeft size={14} />
                </button>

                {questions.map((q, idx) => {
                  const sub = submissionsMap[q.id];
                  const isProblemSubmitted = Boolean(sub);
                  const isActive = activeQuestionIndex === idx;

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setActiveQuestionIndex(idx);
                        setExecutionResults(null);
                        setErrorSummary(null);
                        setActiveConsoleTab('testcases');
                      }}
                      className="btn btn-sm"
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-mono)',
                        background: isActive
                          ? 'rgba(0, 245, 160, 0.2)'
                          : isProblemSubmitted
                          ? 'rgba(0, 245, 160, 0.08)'
                          : 'rgba(255, 255, 255, 0.04)',
                        borderColor: isActive
                          ? '#00f5a0'
                          : isProblemSubmitted
                          ? 'rgba(0, 245, 160, 0.4)'
                          : 'var(--border-subtle)',
                        color: isActive
                          ? '#00f5a0'
                          : isProblemSubmitted
                          ? '#00f5a0'
                          : 'var(--text-secondary)',
                        fontWeight: isActive ? 700 : 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {isProblemSubmitted && <CheckCircle2 size={12} color="#00f5a0" />}
                      #{q.questionNumber || idx + 1}
                      {isProblemSubmitted && <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>({sub.score}p)</span>}
                    </button>
                  );
                })}

                <button
                  disabled={activeQuestionIndex === questions.length - 1}
                  onClick={() => {
                    const next = Math.min(questions.length - 1, activeQuestionIndex + 1);
                    setActiveQuestionIndex(next);
                    setExecutionResults(null);
                    setErrorSummary(null);
                    setActiveConsoleTab('testcases');
                  }}
                  className="btn btn-sm"
                  style={{
                    padding: '3px 6px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: 'var(--text-secondary)',
                    opacity: activeQuestionIndex === questions.length - 1 ? 0.4 : 1,
                  }}
                  title="Next Problem"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: activeQuestion.difficulty === 'Easy' ? 'rgba(16, 185, 129, 0.12)' : (activeQuestion.difficulty === 'Hard' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)'),
                  border: activeQuestion.difficulty === 'Easy' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                  color: activeQuestion.difficulty === 'Easy' ? '#10b981' : (activeQuestion.difficulty === 'Hard' ? '#ef4444' : '#f59e0b'),
                  fontWeight: 700,
                }}
              >
                {activeQuestion.difficulty}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#93c5fd' }}>
                {activeQuestion.marks} Marks
              </span>
            </div>
          </div>

          {/* Left Sub-Tabs Navigation */}
          <div
            style={{
              display: 'flex',
              padding: '0 16px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'rgba(7, 11, 20, 0.8)',
              gap: '16px',
            }}
          >
            <button
              onClick={() => setActiveLeftTab('description')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeLeftTab === 'description' ? '2px solid #00f5a0' : '2px solid transparent',
                color: activeLeftTab === 'description' ? '#fff' : 'var(--text-muted)',
                padding: '10px 4px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <BookOpen size={14} />
              Description
            </button>

            <button
              onClick={() => setActiveLeftTab('examples')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeLeftTab === 'examples' ? '2px solid #00f5a0' : '2px solid transparent',
                color: activeLeftTab === 'examples' ? '#fff' : 'var(--text-muted)',
                padding: '10px 4px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Terminal size={14} />
              Input/Output & Constraints
            </button>

            <button
              onClick={() => setActiveLeftTab('hints')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeLeftTab === 'hints' ? '2px solid #00d9f5' : '2px solid transparent',
                color: activeLeftTab === 'hints' ? '#00d9f5' : 'var(--text-muted)',
                padding: '10px 4px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Lightbulb size={14} />
              Debugging Tips
            </button>
          </div>

          {/* Left Pane Content Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            {activeLeftTab === 'description' && (
              <div>
                <h2 style={{ fontSize: '1.45rem', marginBottom: '14px', color: '#fff' }}>
                  {activeQuestion.title}
                </h2>

                <div
                  style={{
                    fontSize: '0.92rem',
                    lineHeight: '1.7',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                    marginBottom: '24px',
                  }}
                >
                  {activeQuestion.problemStatement || activeQuestion.description}
                </div>

                {/* Buggy Code Notice */}
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 16px',
                    fontSize: '0.82rem',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Code Repair Challenge:</strong> The initial Python code loaded in the right editor contains deliberate logic or syntax bugs. Diagnose and fix the mistakes to satisfy all public and concealed test cases.
                  </div>
                </div>
              </div>
            )}

            {activeLeftTab === 'examples' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', color: '#fff', marginBottom: '8px' }}>Execution Constraints</h4>
                  <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.7', fontFamily: 'var(--font-mono)' }}>
                    <li>Language: Python 3.12 (Strict Sandbox)</li>
                    <li>Time Limit: {activeQuestion.timeLimitSeconds} seconds per test case</li>
                    <li>Memory Limit: {activeQuestion.memoryLimitMb} MB</li>
                    <li>Evaluation: Both Public and Hidden Test Suites</li>
                  </ul>
                </div>

                {publicTestCases.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '1rem', color: '#fff', marginBottom: '10px' }}>Sample Public Cases</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {publicTestCases.slice(0, 3).map((tc, idx) => (
                        <div
                          key={tc.id || idx}
                          style={{
                            background: 'rgba(7, 11, 20, 0.8)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '12px 14px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.82rem',
                          }}
                        >
                          <div style={{ color: '#00d9f5', fontWeight: 700, marginBottom: '6px' }}>
                            Example {idx + 1}
                          </div>
                          <div style={{ marginBottom: '4px', color: 'var(--text-muted)' }}>Input:</div>
                          <pre style={{ background: 'rgba(15, 23, 42, 0.9)', padding: '6px 10px', borderRadius: '4px', color: '#fff', marginBottom: '8px' }}>
                            {tc.inputData || '(empty)'}
                          </pre>
                          <div style={{ marginBottom: '4px', color: 'var(--text-muted)' }}>Output:</div>
                          <pre style={{ background: 'rgba(15, 23, 42, 0.9)', padding: '6px 10px', borderRadius: '4px', color: '#00f5a0' }}>
                            {tc.expectedOutput}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeLeftTab === 'hints' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    background: 'rgba(0, 217, 245, 0.08)',
                    border: '1px solid rgba(0, 217, 245, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px',
                  }}
                >
                  <h4 style={{ fontSize: '0.95rem', color: '#00d9f5', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Lightbulb size={16} />
                    Debugging Advice & Strategy
                  </h4>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                    1. Read the input format carefully: make sure you read lines from <code>sys.stdin</code> or <code>input()</code> correctly.<br />
                    2. Check loop indices: Python uses zero-based indexing (0 to n - 1).<br />
                    3. Click "Run Code" on the right. If any mistake is found, our smart diagnostic engine will highlight the exact line and give you an instant advice card!
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ===================================================================
            RIGHT PANE: Editor on Top, LeetCode Resizable/Collapsible Console Bottom
            =================================================================== */}
        <main
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            gap: '8px',
          }}
        >
          {/* Top Monaco Editor Container */}
          <div
            className="glass-card"
            style={{
              flex: 1,
              minHeight: '260px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: '#090e1c',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {/* Editor Action Toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                background: 'rgba(15, 23, 42, 0.95)',
                borderBottom: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700, color: '#00f5a0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00f5a0' }} />
                  solution.py
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  (Python 3.12 Sandbox)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => updateCurrentCode(activeQuestion.buggyCode)}
                  disabled={isRunning || isSubmitted}
                  className="btn btn-outline btn-sm"
                  title="Reset to original starting code"
                >
                  <RotateCcw size={12} />
                  Reset Code
                </button>

                <button
                  onClick={handleRunCode}
                  disabled={isRunning || isSubmitted}
                  className="btn btn-secondary btn-sm"
                  style={{ borderColor: '#00d9f5', color: '#00d9f5' }}
                >
                  {isRunning ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play size={12} fill="currentColor" />
                      Run Code
                    </>
                  )}
                </button>

                {!isSubmitted && (
                  <button
                    onClick={() => setIsConfirmModalOpen(true)}
                    disabled={isSubmitting || isRunning}
                    className="btn btn-primary btn-sm"
                  >
                    <Send size={12} />
                    {submissionsMap[activeQuestion.id]
                      ? `Update Problem #${activeQuestion.questionNumber || activeQuestionIndex + 1}`
                      : `Submit Problem #${activeQuestion.questionNumber || activeQuestionIndex + 1} (20 pts)`}
                  </button>
                )}

                {activeQuestionIndex < questions.length - 1 && (
                  <button
                    onClick={() => {
                      setActiveQuestionIndex(activeQuestionIndex + 1);
                      setExecutionResults(null);
                      setErrorSummary(null);
                      setActiveConsoleTab('testcases');
                    }}
                    className="btn btn-outline btn-sm"
                    title="Go to next question"
                  >
                    Next Problem
                    <ChevronRight size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Monaco Editor */}
            <div style={{ flex: 1, position: 'relative' }}>
              <Editor
                height="100%"
                language="python"
                theme="vs-dark"
                value={currentCode}
                onChange={(val) => updateCurrentCode(val || '')}
                options={{
                  readOnly: isSubmitted || isDisqualified,
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 4,
                  insertSpaces: true,
                  bracketPairColorization: { enabled: true },
                  padding: { top: 10, bottom: 10 },
                }}
                loading={
                  <div style={{ padding: '24px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Loading Monaco Python IDE...
                  </div>
                }
              />
            </div>
          </div>

          {/* Bottom Console (LeetCode/HackerRank Style) */}
          <div
            className="glass-card"
            style={{
              height: '240px',
              minHeight: '180px',
              display: 'flex',
              flexDirection: 'column',
              background: '#0a101e',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            {/* Console Tabs */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 14px',
                background: 'rgba(15, 23, 42, 0.9)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => setActiveConsoleTab('testcases')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeConsoleTab === 'testcases' ? '2px solid #00f5a0' : '2px solid transparent',
                    color: activeConsoleTab === 'testcases' ? '#fff' : 'var(--text-muted)',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Test Cases
                </button>

                <button
                  onClick={() => setActiveConsoleTab('results')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeConsoleTab === 'results' ? '2px solid #00f5a0' : '2px solid transparent',
                    color: activeConsoleTab === 'results' ? '#fff' : 'var(--text-muted)',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  Execution Results
                  {executionResults && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: executionResults.every((r) => r.passed) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: executionResults.every((r) => r.passed) ? '#10b981' : '#f87171',
                      }}
                    >
                      {executionResults.filter((r) => r.passed).length}/{executionResults.length}
                    </span>
                  )}
                </button>

                {errorSummary?.error_tip && (
                  <button
                    onClick={() => setActiveConsoleTab('advice')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: activeConsoleTab === 'advice' ? '2px solid #f59e0b' : '2px solid transparent',
                      color: activeConsoleTab === 'advice' ? '#f59e0b' : '#f59e0b',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      animation: 'pulse 1.5s infinite',
                    }}
                  >
                    <Lightbulb size={13} />
                    Mistake Advice
                    {errorSummary.error_line && <span>(Line {errorSummary.error_line})</span>}
                  </button>
                )}
              </div>
            </div>

            {/* Console Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
              {/* Tab 1: Test Cases Tab */}
              {activeConsoleTab === 'testcases' && (
                <div>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    {publicTestCases.map((tc, idx) => (
                      <button
                        key={tc.id || idx}
                        onClick={() => setActiveTestCaseIndex(idx)}
                        className="btn btn-sm"
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          background: activeTestCaseIndex === idx ? 'rgba(0, 217, 245, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                          borderColor: activeTestCaseIndex === idx ? '#00d9f5' : 'var(--border-subtle)',
                          color: activeTestCaseIndex === idx ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        Case {idx + 1}
                      </button>
                    ))}
                  </div>

                  {publicTestCases[activeTestCaseIndex] && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Input:</div>
                        <pre style={{ background: 'rgba(7, 11, 20, 0.9)', padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--border-subtle)', color: '#fff', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto' }}>
                          {publicTestCases[activeTestCaseIndex].inputData || '(empty)'}
                        </pre>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Expected Output:</div>
                        <pre style={{ background: 'rgba(7, 11, 20, 0.9)', padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--border-subtle)', color: '#00f5a0', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto' }}>
                          {publicTestCases[activeTestCaseIndex].expectedOutput}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Execution Results Tab */}
              {activeConsoleTab === 'results' && (
                <div>
                  {isRunning ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', gap: '10px', color: 'var(--text-secondary)' }}>
                      <Loader2 size={18} className="animate-spin" color="#00f5a0" />
                      <span>Running solution in sandbox...</span>
                    </div>
                  ) : !executionResults ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>
                      Click "Run Code" above to execute your solution against public test cases.
                    </div>
                  ) : (
                    <div>
                      {/* Status Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {executionResults.every((r) => r.passed) ? (
                            <span style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <CheckCircle2 size={16} /> All Public Test Cases Passed!
                            </span>
                          ) : (
                            <span style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <XCircle size={16} /> Tests Failed
                            </span>
                          )}
                        </div>

                        {errorSummary?.error_tip && (
                          <button
                            onClick={() => setActiveConsoleTab('advice')}
                            className="btn btn-outline btn-sm"
                            style={{ borderColor: '#f59e0b', color: '#f59e0b', fontSize: '0.75rem', padding: '3px 8px' }}
                          >
                            <Lightbulb size={12} />
                            View Line Tip
                          </button>
                        )}
                      </div>

                      {/* Cases view */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {executionResults.map((r, idx) => (
                          <div
                            key={r.testCaseId || idx}
                            style={{
                              background: 'rgba(7, 11, 20, 0.8)',
                              border: r.passed ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                              borderRadius: '4px',
                              padding: '8px 12px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 700, color: r.passed ? '#10b981' : '#ef4444' }}>
                                Case {idx + 1}: {r.status}
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.executionTimeMs}ms</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Expected: </span>
                                <span style={{ color: '#00f5a0' }}>{r.expectedOutput}</span>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Output: </span>
                                <span style={{ color: r.passed ? '#00f5a0' : '#f87171' }}>{r.actualOutput || '(none)'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Intelligent Error & Line-Specific Advice Tab */}
              {activeConsoleTab === 'advice' && (
                <div>
                  {errorSummary ? (
                    <div
                      style={{
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(239, 68, 68, 0.08) 100%)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '14px 18px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Lightbulb size={18} color="#f59e0b" />
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>
                            {errorSummary.error_line
                              ? `Mistake Detected on Line ${errorSummary.error_line}`
                              : 'Algorithm / Execution Advice'}
                          </span>
                        </div>

                        {errorSummary.error_type && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              color: '#f87171',
                              fontWeight: 700,
                            }}
                          >
                            {errorSummary.error_type}
                          </span>
                        )}
                      </div>

                      <p style={{ color: '#fef08a', fontSize: '0.88rem', lineHeight: '1.65', margin: 0 }}>
                        {errorSummary.error_tip}
                      </p>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>
                      No errors detected! Run your code to check for potential syntax or runtime mistakes.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Proctoring Warning Modal */}
      {activeWarning && (
        <WarningModal
          isOpen={Boolean(activeWarning)}
          reason={activeWarning.reason}
          message={activeWarning.message}
          warningNumber={activeWarning.warningsCount}
          maxWarnings={settings?.max_warnings || 3}
          onAcknowledge={() => setActiveWarning(null)}
        />
      )}

      {/* Disqualification Modal */}
      <DisqualificationModal
        isOpen={isDisqualified}
        reason={disqualificationReason}
        onExit={() => onNavigate('/participant/dashboard')}
      />

      {/* Submission Confirmation Modal */}
      <SubmissionConfirmModal
        isOpen={isConfirmModalOpen}
        isSubmitting={isSubmitting}
        onCancel={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmSubmit}
        questionNumber={activeQuestion?.questionNumber || activeQuestionIndex + 1}
        questionTitle={activeQuestion?.title || ''}
        marks={activeQuestion?.marks || 20}
        isFinalQuestion={questions.length > 0 && Object.keys(submissionsMap).length === questions.length - 1 && !submissionsMap[activeQuestion?.id || '']}
      />

      {/* Step-by-Step Question Solved Modal */}
      {isStepSuccessModalOpen && stepSuccessData && (
        <Modal
          isOpen={isStepSuccessModalOpen}
          onClose={() => setIsStepSuccessModalOpen(false)}
          title={`Problem #${stepSuccessData.questionNumber} Evaluated`}
          maxWidth="540px"
        >
          <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(0, 245, 160, 0.15)',
                border: '2px solid #00f5a0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#00f5a0',
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <h3 style={{ fontSize: '1.45rem', color: '#fff', marginBottom: '6px' }}>
              Problem #{stepSuccessData.questionNumber} Submitted!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Your solution has been authoritatively evaluated against all test cases.
            </p>

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                padding: '16px 20px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '20px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                textAlign: 'left',
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Score Awarded
                </span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 800, color: '#00f5a0' }}>
                  {stepSuccessData.score} / {stepSuccessData.maxScore} pts
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Test Cases Passed
                </span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 800, color: '#00d9f5' }}>
                  {stepSuccessData.passedCases} / {stepSuccessData.totalCases}
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '0.82rem',
                color: '#93c5fd',
                marginBottom: '24px',
              }}
            >
              Progress: <strong>{stepSuccessData.submittedCount} of {stepSuccessData.totalQuestions} Problems Completed</strong>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setIsStepSuccessModalOpen(false)}
                className="btn btn-secondary"
              >
                Review Current Problem
              </button>

              <button
                onClick={() => {
                  setIsStepSuccessModalOpen(false);
                  setActiveQuestionIndex(stepSuccessData.nextIndex);
                  setExecutionResults(null);
                  setErrorSummary(null);
                  setActiveConsoleTab('testcases');
                }}
                className="btn btn-primary"
              >
                Proceed to Problem #{stepSuccessData.nextIndex + 1}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        @media (max-width: 1024px) {
          .leetcode-split-layout {
            grid-template-columns: 1fr !important;
            height: auto !important;
            overflow-y: auto !important;
          }
        }
      `}</style>
    </div>
  );
};
