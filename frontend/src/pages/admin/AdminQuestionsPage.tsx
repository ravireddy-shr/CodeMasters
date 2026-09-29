import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { QuestionModal } from '../../components/admin/QuestionModal';
import { EmptyState } from '../../components/common/EmptyState';
import { api } from '../../services/apiClient';
import { supabase } from '../../utils/supabase';
import { DebuggingQuestion } from '../../types';
import { PlusCircle, Edit3, Trash2, Eye, EyeOff, Code2, Clock } from 'lucide-react';

interface AdminQuestionsPageProps {
  onNavigate: (path: string) => void;
}

export const AdminQuestionsPage: React.FC<AdminQuestionsPageProps> = ({ onNavigate }) => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<DebuggingQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQuestions = async () => {
    try {
      // 1. Try Supabase first so direct DB edits show up immediately
      let allQuestions: any[] = [];
      try {
        const { data: supaQuestions, error: supaErr } = await supabase
          .from('round2_questions')
          .select('*, round2_test_cases(*)')
          .order('question_number', { ascending: true });

        if (!supaErr && supaQuestions && supaQuestions.length > 0) {
          allQuestions = supaQuestions.map((q: any) => ({
            id: q.id,
            question_number: q.question_number,
            title: q.title,
            problem_statement: q.problem_statement || q.description,
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
          allQuestions = await api.adminListQuestions();
        }
      } catch {
        allQuestions = await api.adminListQuestions();
      }
      setQuestions(allQuestions || []);
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();

    // Subscribe to realtime updates on questions
    const channel = supabase
      .channel('admin_questions_realtime_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'round2_questions' },
        () => {
          fetchQuestions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreate = () => {
    setEditingQuestion(null);
    setIsModalOpen(true);
  };

  const handleEdit = (q: any) => {
    setEditingQuestion({
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
      timeLimitSeconds: q.time_limit_seconds,
      memoryLimitMb: q.memory_limit_mb,
      isActive: q.is_active,
      testCases: (q.test_cases || []).map((tc: any) => ({
        id: tc.id,
        inputData: tc.input_data,
        expectedOutput: tc.expected_output,
        isHidden: tc.is_hidden,
        marks: tc.marks,
      })),
    });
    setIsModalOpen(true);
  };

  const handleSave = async (payload: any) => {
    try {
      if (editingQuestion) {
        // Update via backend API
        try {
          await api.adminUpdateQuestion(editingQuestion.id, payload);
        } catch (apiErr) {
          console.warn('Backend update notice:', apiErr);
        }

        // Direct update in Supabase if linked
        try {
          await supabase
            .from('round2_questions')
            .update({
              title: payload.title,
              problem_statement: payload.problem_statement,
              description: payload.description,
              difficulty: payload.difficulty,
              starter_code: payload.starter_code,
              buggy_code: payload.buggy_code,
              marks: payload.marks,
              time_limit_seconds: payload.time_limit_seconds,
              is_active: payload.is_active,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingQuestion.id);

          // If test_cases are provided, update them
          if (payload.test_cases && payload.test_cases.length > 0) {
            await supabase.from('round2_test_cases').delete().eq('question_id', editingQuestion.id);
            const tcInserts = payload.test_cases.map((tc: any, idx: number) => ({
              question_id: editingQuestion.id,
              input_data: tc.input_data,
              expected_output: tc.expected_output,
              is_hidden: tc.is_hidden,
              marks: tc.marks,
              order_index: idx,
            }));
            await supabase.from('round2_test_cases').insert(tcInserts);
          }
        } catch (supaErr) {
          console.warn('Supabase direct update notice:', supaErr);
        }
      } else {
        await api.adminCreateQuestion(payload);
      }
    } catch (err: any) {
      alert(`Error saving question: ${err.message}`);
    } finally {
      await fetchQuestions();
    }
  };

  const handleDelete = async (questionId: string) => {
    if (window.confirm('Are you sure you want to delete this question? Associated submissions and test cases will also be removed.')) {
      try {
        await api.adminDeleteQuestion(questionId);
      } catch (e) {
        console.warn(e);
      }
      try {
        await supabase.from('round2_questions').delete().eq('id', questionId);
      } catch (e) {
        console.warn(e);
      }
      await fetchQuestions();
    }
  };

  const handleToggleActive = async (questionId: string) => {
    const target = questions.find((q) => q.id === questionId);
    const newActive = target ? !target.is_active : true;
    try {
      await api.adminToggleQuestionActive(questionId);
    } catch (e) {
      console.warn(e);
    }
    try {
      await supabase.from('round2_questions').update({ is_active: newActive }).eq('id', questionId);
    } catch (e) {
      console.warn(e);
    }
    await fetchQuestions();
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--nav-height))' }}>
      <AdminSidebar currentPath="/admin/questions" onNavigate={onNavigate} />

      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Round 2 — Debugging Question Management</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              Configure Python debugging challenges, provide starter/buggy code, and define public & concealed test cases.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px', alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(0, 245, 160, 0.1)',
                  border: '1px solid rgba(0, 245, 160, 0.25)',
                  color: '#00f5a0',
                }}
              >
                {questions.length} / 5 Questions Defined
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  color: '#93c5fd',
                }}
              >
                Total Marks: {questions.reduce((sum, q) => sum + (q.marks || 0), 0)} / 100
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={async () => {
                if (window.confirm('Seed the official 5 Round 2 prototype questions (20 marks each, 100 marks total)? Existing questions will remain active.')) {
                  try {
                    await api.adminSeedRound2Suite();
                    await fetchQuestions();
                    alert('Successfully seeded 5 Round 2 prototype questions!');
                  } catch (e: any) {
                    alert(`Seeding error: ${e.message}`);
                  }
                }
              }}
              className="btn btn-secondary"
            >
              <Code2 size={16} color="#00d9f5" />
              Seed 5 Prototype Questions (100 Marks)
            </button>
            <button onClick={handleCreate} className="btn btn-primary">
              <PlusCircle size={16} />
              Create Debugging Problem
            </button>
          </div>
        </div>

        {questions.length === 0 ? (
          <EmptyState
            title="No debugging problems configured"
            description="Round 2 currently has no active problems. Click 'Create Debugging Problem' to construct a Python challenge with test suites."
            icon={<Code2 size={36} color="#00f5a0" />}
            actionText="Create First Problem"
            onAction={handleCreate}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {questions.map((q) => {
              const testCases = q.test_cases || [];
              const hiddenCount = testCases.filter((tc: any) => tc.is_hidden).length;
              const publicCount = testCases.length - hiddenCount;

              return (
                <div key={q.id} className="glass-card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(0, 245, 160, 0.12)',
                            border: '1px solid rgba(0, 245, 160, 0.3)',
                            fontSize: '0.75rem',
                            fontFamily: 'var(--font-mono)',
                            color: '#00f5a0',
                            fontWeight: 700,
                          }}
                        >
                          {q.difficulty}
                        </span>

                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#93c5fd' }}>
                          {q.marks} Marks
                        </span>

                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: q.is_active ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            border: q.is_active ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                            fontSize: '0.72rem',
                            color: q.is_active ? '#10b981' : '#f87171',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {q.is_active ? 'PUBLISHED / ACTIVE' : 'DRAFT / INACTIVE'}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '8px' }}>
                        {q.title}
                      </h3>

                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '14px' }}>
                        {q.description}
                      </p>

                      <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
                        <span>Test Cases: <strong>{testCases.length}</strong> ({publicCount} Public, {hiddenCount} Hidden)</span>
                        <span>•</span>
                        <span>Timeout: <strong>{q.time_limit_seconds}s</strong></span>
                        <span>•</span>
                        <span>Language: <strong>{q.language}</strong></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleToggleActive(q.id)}
                        className={`btn btn-sm ${q.is_active ? 'btn-outline' : 'btn-primary'}`}
                        title={q.is_active ? 'Unpublish' : 'Publish'}
                      >
                        {q.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                        {q.is_active ? 'Unpublish' : 'Publish'}
                      </button>

                      <button onClick={() => handleEdit(q)} className="btn btn-secondary btn-sm" title="Edit Problem">
                        <Edit3 size={14} />
                        Edit
                      </button>

                      <button onClick={() => handleDelete(q.id)} className="btn btn-danger btn-sm" title="Delete Problem">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <QuestionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          initialQuestion={editingQuestion}
        />
      </main>
    </div>
  );
};
