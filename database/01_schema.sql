-- ============================================================================
-- CODE MASTERS ROUND 2 - DATABASE SCHEMA
-- Standalone PostgreSQL / Supabase Schema for Python Debugging Challenge
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Participants Table
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- References auth.users(id) in Supabase if linked
    full_name TEXT NOT NULL,
    vtu_number TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ready' CHECK (status IN ('Ready', 'In Progress', 'Submitted', 'Disqualified')),
    is_disqualified BOOLEAN NOT NULL DEFAULT FALSE,
    disqualification_reason TEXT,
    warnings_count INT NOT NULL DEFAULT 0 CHECK (warnings_count >= 0),
    round2_score INT DEFAULT NULL,
    extra_time_minutes INT NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for participant lookups
CREATE INDEX IF NOT EXISTS idx_participants_vtu ON participants(vtu_number);
CREATE INDEX IF NOT EXISTS idx_participants_email ON participants(email);
CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(status);

-- 2. Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Round 2 Questions Table
CREATE TABLE IF NOT EXISTS round2_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_number INT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    problem_statement TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    language TEXT NOT NULL DEFAULT 'python',
    starter_code TEXT,
    buggy_code TEXT NOT NULL,
    marks INT NOT NULL DEFAULT 100,
    time_limit_seconds NUMERIC(4,2) NOT NULL DEFAULT 3.00,
    memory_limit_mb INT NOT NULL DEFAULT 128,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for question ordering & lookup
CREATE INDEX IF NOT EXISTS idx_questions_number ON round2_questions(question_number);
CREATE INDEX IF NOT EXISTS idx_questions_active ON round2_questions(is_active);

-- 4. Round 2 Test Cases Table
CREATE TABLE IF NOT EXISTS round2_test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES round2_questions(id) ON DELETE CASCADE,
    input_data TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    marks INT NOT NULL DEFAULT 20,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_cases_question ON round2_test_cases(question_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_hidden ON round2_test_cases(is_hidden);

-- 5. Round 2 Submissions Table
CREATE TABLE IF NOT EXISTS round2_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES round2_questions(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'python',
    status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Auto-Submitted', 'Disqualified')),
    score INT NOT NULL DEFAULT 0,
    max_score INT NOT NULL DEFAULT 100,
    passed_cases INT NOT NULL DEFAULT 0,
    total_cases INT NOT NULL DEFAULT 0,
    execution_time_ms NUMERIC(8,2) DEFAULT 0,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_participant_question_submission UNIQUE (participant_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_participant ON round2_submissions(participant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_question ON round2_submissions(question_id);
CREATE INDEX IF NOT EXISTS idx_submissions_score ON round2_submissions(score DESC, submitted_at ASC);

-- 6. Round 2 Execution Results Table (Detailed per-test-case results)
CREATE TABLE IF NOT EXISTS round2_execution_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES round2_submissions(id) ON DELETE CASCADE,
    test_case_id UUID NOT NULL REFERENCES round2_test_cases(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('Passed', 'Failed', 'Error', 'Timeout')),
    actual_output TEXT,
    expected_output TEXT,
    execution_time_ms NUMERIC(8,2),
    error_message TEXT,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exec_results_submission ON round2_execution_results(submission_id);

-- 7. Round 2 Warnings Table
CREATE TABLE IF NOT EXISTS round2_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    warning_number INT NOT NULL CHECK (warning_number >= 1),
    reason TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warnings_participant ON round2_warnings(participant_id);

-- 8. Round 2 Settings Table (Single-row configuration)
CREATE TABLE IF NOT EXISTS round2_settings (
    id INT PRIMARY KEY DEFAULT 1,
    competition_name TEXT NOT NULL DEFAULT 'Code Masters Round 2 - Python Debugging Challenge',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_minutes INT NOT NULL DEFAULT 90,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    max_warnings INT NOT NULL DEFAULT 3,
    auto_submit_on_expire BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_single_row CHECK (id = 1)
);

-- Insert default settings row if missing
INSERT INTO round2_settings (id, competition_name, duration_minutes, is_active, max_warnings, auto_submit_on_expire)
VALUES (1, 'Code Masters Round 2 - Python Debugging Challenge', 90, TRUE, 3, TRUE)
ON CONFLICT (id) DO NOTHING;
