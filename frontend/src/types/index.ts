/**
 * Code Masters Round 2 - Core TypeScript Definitions
 * Standalone Python Debugging Platform
 */

export type ParticipantStatus = 'Ready' | 'In Progress' | 'Submitted' | 'Disqualified';
export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface Participant {
  id: string;
  fullName: string;
  vtuNumber: string;
  email: string;
  status: ParticipantStatus;
  isDisqualified: boolean;
  disqualificationReason?: string;
  warningsCount: number;
  round2Score: number | null;
  extraTimeMinutes?: number;
  extra_time_minutes?: number;
  submittedAt?: string;
  lastActive?: string;
  createdAt: string;
  activeSubmission?: Submission;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'super_admin';
}

export interface TestCase {
  id: string;
  questionId?: string;
  inputData: string;
  expectedOutput: string;
  isHidden: boolean;
  marks: number;
  orderIndex?: number;
}

export interface TestCaseResult {
  testCaseId: string;
  passed: boolean;
  status: 'Passed' | 'Failed' | 'Error' | 'Timeout';
  inputData: string;
  expectedOutput: string; // '[HIDDEN TEST CASE]' if hidden
  actualOutput: string;
  executionTimeMs: number;
  errorMessage?: string;
  isHidden: boolean;
  marks: number;
  scoreAwarded: number;
  errorLine?: number;
  error_line?: number;
  errorType?: string;
  error_type?: string;
  errorTip?: string;
  error_tip?: string;
}

export interface ErrorSummary {
  error_line?: number;
  error_type?: string;
  error_tip?: string;
}

export interface DebuggingQuestion {
  id: string;
  questionNumber: number;
  title: string;
  problemStatement: string;
  description: string;
  difficulty: QuestionDifficulty;
  language: string;
  starterCode?: string;
  buggyCode: string;
  marks: number;
  timeLimitSeconds: number;
  memoryLimitMb: number;
  isActive?: boolean;
  testCases: TestCase[];
}

export interface Submission {
  id: string;
  participantId: string;
  participantName?: string;
  vtuNumber?: string;
  participantEmail?: string;
  questionId: string;
  questionTitle?: string;
  code: string;
  language: string;
  status: 'Submitted' | 'Auto-Submitted' | 'Disqualified';
  score: number;
  maxScore: number;
  passedCases: number;
  totalCases: number;
  executionTimeMs: number;
  submittedAt: string;
  executionResults?: TestCaseResult[];
}

export interface CompetitionSettings {
  id: number;
  competitionName: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  isActive: boolean;
  maxWarnings: number;
  autoSubmitOnExpire: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  participantId: string;
  fullName: string;
  vtuNumber: string;
  email: string;
  score: number;
  maxScore: number;
  submittedAt?: string;
  passedCases?: number;
  totalCases?: number;
  executionTimeMs?: number;
  status: string;
  isDisqualified: boolean;
}

export interface WarningRecord {
  warningId: string;
  warningsCount: number;
  maxWarnings: number;
  isDisqualified: boolean;
  reason: string;
  message: string;
}

export interface AdminTelemetry {
  totalParticipants: number;
  activeParticipants: number;
  submittedParticipants: number;
  pendingParticipants: number;
  disqualifiedParticipants: number;
  totalQuestions: number;
  totalSubmissions: number;
  averageScore: number;
}
