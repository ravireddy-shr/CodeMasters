import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { DebuggingQuestion, TestCase } from '../../types';
import { Plus, Trash2, Save, Eye, EyeOff } from 'lucide-react';

interface QuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
  initialQuestion?: DebuggingQuestion | null;
}

export const QuestionModal: React.FC<QuestionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialQuestion,
}) => {
  const [title, setTitle] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [buggyCode, setBuggyCode] = useState('');
  const [starterCode, setStarterCode] = useState('');
  const [marks, setMarks] = useState<number>(100);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number>(3.0);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialQuestion) {
      setTitle(initialQuestion.title);
      setProblemStatement(initialQuestion.problemStatement || initialQuestion.description);
      setDescription(initialQuestion.description);
      setDifficulty(initialQuestion.difficulty);
      setBuggyCode(initialQuestion.buggyCode);
      setStarterCode(initialQuestion.starterCode || '');
      setMarks(initialQuestion.marks);
      setTimeLimitSeconds(initialQuestion.timeLimitSeconds);
      setTestCases(initialQuestion.testCases || []);
    } else {
      setTitle('');
      setProblemStatement('');
      setDescription('');
      setDifficulty('Medium');
      setBuggyCode(`def solution(n):\n    # Broken logic here\n    return n + n\n\nif __name__ == '__main__':\n    import sys\n    n = int(sys.stdin.read().strip())\n    print(solution(n))`);
      setStarterCode(`def solution(n):\n    # Fix logic\n    pass\n\nif __name__ == '__main__':\n    import sys\n    n = int(sys.stdin.read().strip())\n    print(solution(n))`);
      setMarks(20);
      setTimeLimitSeconds(3.0);
      setTestCases([
        { id: `tc-1`, inputData: '5', expectedOutput: '25', isHidden: false, marks: 10 },
        { id: `tc-2`, inputData: '12', expectedOutput: '144', isHidden: true, marks: 10 },
      ]);
    }
    setError('');
  }, [initialQuestion, isOpen]);

  const handleAddTestCase = () => {
    setTestCases([
      ...testCases,
      {
        id: `tc-${Date.now()}`,
        inputData: '',
        expectedOutput: '',
        isHidden: false,
        marks: 20,
      },
    ]);
  };

  const handleRemoveTestCase = (index: number) => {
    setTestCases(testCases.filter((_, idx) => idx !== index));
  };

  const handleTestCaseChange = (index: number, field: keyof TestCase, value: any) => {
    const updated = [...testCases];
    (updated[index] as any)[field] = value;
    setTestCases(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Problem Title is required');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (!buggyCode.trim()) {
      setError('Buggy starting code is required');
      return;
    }
    if (testCases.length === 0) {
      setError('At least one test case is required');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await onSave({
        title: title.trim(),
        problem_statement: problemStatement.trim() || description.trim(),
        description: description.trim(),
        difficulty,
        language: 'python',
        starter_code: starterCode,
        buggy_code: buggyCode,
        marks: Number(marks),
        time_limit_seconds: Number(timeLimitSeconds),
        is_active: true,
        test_cases: testCases.map((tc, idx) => ({
          input_data: tc.inputData,
          expected_output: tc.expectedOutput,
          is_hidden: tc.isHidden,
          marks: Number(tc.marks),
          order_index: idx + 1,
        })),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save question');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialQuestion ? 'Edit Python Debugging Challenge' : 'Create Python Debugging Problem'}
      maxWidth="820px"
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error" style={{ marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Problem Title *</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Reverse Linked List or Matrix Transposition Bug"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Difficulty</label>
            <select
              className="form-select"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Problem Description & Constraints *</label>
          <textarea
            className="form-textarea"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain algorithmic requirements, input/output specifications, and constraints..."
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Buggy Python Code (Preloaded in Participant Monaco Editor) *</label>
          <textarea
            className="form-textarea"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
            rows={5}
            value={buggyCode}
            onChange={(e) => setBuggyCode(e.target.value)}
            placeholder="def broken_solution():\n    # code here"
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Total Marks</label>
            <input
              type="number"
              className="form-input"
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Timeout (Seconds)</label>
            <input
              type="number"
              step="0.5"
              className="form-input"
              value={timeLimitSeconds}
              onChange={(e) => setTimeLimitSeconds(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Test Cases Manager */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <label className="form-label" style={{ margin: 0 }}>
              Test Case Suite ({testCases.length})
            </label>
            <button type="button" onClick={handleAddTestCase} className="btn btn-outline btn-sm">
              <Plus size={14} /> Add Test Case
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
            {testCases.map((tc, idx) => (
              <div
                key={tc.id || idx}
                style={{
                  background: 'rgba(7, 11, 20, 0.75)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1.5fr 100px 90px 40px',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Input</div>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                    value={tc.inputData}
                    onChange={(e) => handleTestCaseChange(idx, 'inputData', e.target.value)}
                    placeholder="stdin input"
                  />
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Expected Output</div>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                    value={tc.expectedOutput}
                    onChange={(e) => handleTestCaseChange(idx, 'expectedOutput', e.target.value)}
                    placeholder="stdout"
                  />
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Marks</div>
                  <input
                    type="number"
                    className="form-input"
                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                    value={tc.marks}
                    onChange={(e) => handleTestCaseChange(idx, 'marks', Number(e.target.value))}
                  />
                </div>

                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Type</div>
                  <button
                    type="button"
                    onClick={() => handleTestCaseChange(idx, 'isHidden', !tc.isHidden)}
                    className={`btn btn-sm ${tc.isHidden ? 'btn-outline' : 'btn-secondary'}`}
                    style={{
                      padding: '6px 8px',
                      fontSize: '0.72rem',
                      width: '100%',
                      color: tc.isHidden ? '#f59e0b' : '#00f5a0',
                    }}
                  >
                    {tc.isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                    {tc.isHidden ? 'Hidden' : 'Public'}
                  </button>
                </div>

                <div style={{ paddingTop: '14px' }}>
                  <button
                    type="button"
                    onClick={() => handleRemoveTestCase(idx)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="btn btn-primary">
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save Question'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
