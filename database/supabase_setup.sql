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

-- Backward compatibility migration for existing instances
ALTER TABLE participants ADD COLUMN IF NOT EXISTS extra_time_minutes INT NOT NULL DEFAULT 0;

-- Index for participant lookups
CREATE INDEX IF NOT EXISTS idx_participants_vtu ON participants(vtu_number);
CREATE INDEX IF NOT EXISTS idx_participants_email ON participants(email);
CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(status);

-- 1b. Participant Logins Table (Dedicated table for participant credentials & tracking)
CREATE TABLE IF NOT EXISTS participant_logins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    vtu_number TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_plain TEXT NOT NULL,
    password_hash TEXT,
    last_login_at TIMESTAMPTZ,
    login_count INT NOT NULL DEFAULT 0,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast participant lookup
CREATE INDEX IF NOT EXISTS idx_participant_logins_vtu ON participant_logins(vtu_number);
CREATE INDEX IF NOT EXISTS idx_participant_logins_email ON participant_logins(email);


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
    marks INT NOT NULL DEFAULT 20,
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


-- ============================================================================
-- CODE MASTERS ROUND 2 - ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Security Policies for Supabase / PostgreSQL
-- ============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE round2_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE round2_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE round2_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE round2_execution_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE round2_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE round2_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_logins ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins
        WHERE auth_user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- PARTICIPANTS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Participant can view their own record
CREATE POLICY "Participants can view own profile"
ON participants FOR SELECT
USING (auth.uid() = auth_user_id OR is_admin());

-- Participant can update their own last_active timestamp
CREATE POLICY "Participants can update own profile"
ON participants FOR UPDATE
USING (auth.uid() = auth_user_id OR is_admin())
WITH CHECK (auth.uid() = auth_user_id OR is_admin());

-- Admins have full access to participants
CREATE POLICY "Admins full access to participants"
ON participants FOR ALL
USING (is_admin());

-- ----------------------------------------------------------------------------
-- ADMINS TABLE POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Admins can view admins"
ON admins FOR SELECT
USING (is_admin());

-- ----------------------------------------------------------------------------
-- ROUND 2 QUESTIONS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Anyone authenticated can view active questions
CREATE POLICY "Participants can view active questions"
ON round2_questions FOR SELECT
USING (is_active = TRUE OR is_admin());

-- Only admins can insert, update, or delete questions
CREATE POLICY "Admins full management of questions"
ON round2_questions FOR ALL
USING (is_admin());

-- ----------------------------------------------------------------------------
-- ROUND 2 TEST CASES TABLE POLICIES (CRITICAL: HIDDEN TEST CASE ISOLATION)
-- ----------------------------------------------------------------------------
-- Participants can ONLY view public test cases. Hidden test cases are completely blocked!
CREATE POLICY "Participants can only view public test cases"
ON round2_test_cases FOR SELECT
USING (is_hidden = FALSE OR is_admin());

-- Only admins can manage test cases
CREATE POLICY "Admins full management of test cases"
ON round2_test_cases FOR ALL
USING (is_admin());

-- ----------------------------------------------------------------------------
-- ROUND 2 SUBMISSIONS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Participants can view only their own submissions
CREATE POLICY "Participants can view own submissions"
ON round2_submissions FOR SELECT
USING (
    participant_id IN (
        SELECT id FROM participants WHERE auth_user_id = auth.uid()
    ) OR is_admin()
);

-- Submissions are inserted and scored by the backend (service-role) or admin
CREATE POLICY "Admins full access to submissions"
ON round2_submissions FOR ALL
USING (is_admin());

-- ----------------------------------------------------------------------------
-- ROUND 2 EXECUTION RESULTS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Participants can view only execution results of their own submissions where test case is not hidden
CREATE POLICY "Participants can view own non-hidden execution results"
ON round2_execution_results FOR SELECT
USING (
    submission_id IN (
        SELECT s.id FROM round2_submissions s
        JOIN participants p ON s.participant_id = p.id
        WHERE p.auth_user_id = auth.uid()
    ) AND (is_hidden = FALSE OR is_admin())
);

CREATE POLICY "Admins full access to execution results"
ON round2_execution_results FOR ALL
USING (is_admin());

-- ----------------------------------------------------------------------------
-- ROUND 2 WARNINGS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Participants can view their own warnings
CREATE POLICY "Participants can view own warnings"
ON round2_warnings FOR SELECT
USING (
    participant_id IN (
        SELECT id FROM participants WHERE auth_user_id = auth.uid()
    ) OR is_admin()
);

-- Participants can log warnings against their own profile
CREATE POLICY "Participants can insert own warnings"
ON round2_warnings FOR INSERT
WITH CHECK (
    participant_id IN (
        SELECT id FROM participants WHERE auth_user_id = auth.uid()
    ) OR is_admin()
);

CREATE POLICY "Admins full access to warnings"
ON round2_warnings FOR ALL
USING (is_admin());

-- ----------------------------------------------------------------------------
-- ROUND 2 SETTINGS TABLE POLICIES
-- ----------------------------------------------------------------------------
-- Everyone can read competition settings/timers
CREATE POLICY "Anyone can view competition settings"
ON round2_settings FOR SELECT
USING (TRUE);

-- Only admins can update settings
CREATE POLICY "Admins can update competition settings"
ON round2_settings FOR ALL
USING (is_admin());



-- ============================================================================
-- REALTIME PUBLICATION (Instant Reflection on Student Dashboard)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'round2_questions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE round2_questions;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'round2_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE round2_settings;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'participant_logins'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE participant_logins;
  END IF;
END $$;

-- Public read and management policies for questions, test cases, and settings
DROP POLICY IF EXISTS "Public can view active questions" ON round2_questions;
CREATE POLICY "Public can view active questions"
ON round2_questions FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public can view public test cases" ON round2_test_cases;
CREATE POLICY "Public can view public test cases"
ON round2_test_cases FOR SELECT
TO anon, authenticated
USING (is_hidden = FALSE);

DROP POLICY IF EXISTS "Public can view settings" ON round2_settings;
CREATE POLICY "Public can view settings"
ON round2_settings FOR SELECT
TO anon, authenticated
USING (TRUE);

-- Participant Logins & Participants Access Policies
DROP POLICY IF EXISTS "Allow anon insert participant_logins" ON participant_logins;
CREATE POLICY "Allow anon insert participant_logins"
ON participant_logins FOR INSERT
TO anon, authenticated
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow anon view participant_logins" ON participant_logins;
CREATE POLICY "Allow anon view participant_logins"
ON participant_logins FOR SELECT
TO anon, authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Allow anon update participant_logins" ON participant_logins;
CREATE POLICY "Allow anon update participant_logins"
ON participant_logins FOR UPDATE
TO anon, authenticated
USING (TRUE)
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow anon insert participants" ON participants;
CREATE POLICY "Allow anon insert participants"
ON participants FOR INSERT
TO anon, authenticated
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow anon view participants" ON participants;
CREATE POLICY "Allow anon view participants"
ON participants FOR SELECT
TO anon, authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Allow anon update participants" ON participants;
CREATE POLICY "Allow anon update participants"
ON participants FOR UPDATE
TO anon, authenticated
USING (TRUE)
WITH CHECK (TRUE);

-- Admin & Anon management policies for full editor support from Admin Portal
DROP POLICY IF EXISTS "Allow anon full management of questions" ON round2_questions;
CREATE POLICY "Allow anon full management of questions"
ON round2_questions FOR ALL
TO anon, authenticated
USING (TRUE)
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow anon full management of test cases" ON round2_test_cases;
CREATE POLICY "Allow anon full management of test cases"
ON round2_test_cases FOR ALL
TO anon, authenticated
USING (TRUE)
WITH CHECK (TRUE);


-- ============================================================================
-- SEED DATA: 5 OFFICIAL ROUND 2 QUESTIONS (20 MARKS EACH, 100 MARKS TOTAL)
-- From Code Masters Python Debugging Challenge Official Question Paper
-- ============================================================================

-- Clean old dev test data so foreign keys and question IDs link cleanly
DELETE FROM round2_warnings;
DELETE FROM round2_execution_results;
DELETE FROM round2_submissions;
DELETE FROM round2_test_cases;
DELETE FROM round2_questions;
DELETE FROM participant_logins;
DELETE FROM participants;

-- Seed Official Admin (Prof. Kalaichelvi T)
DELETE FROM admins WHERE email != 'kalaichelvit@veltech.edu.in';
INSERT INTO admins (id, email, full_name, role)
VALUES ('c0000000-0000-0000-0000-000000000001', 'kalaichelvit@veltech.edu.in', 'Prof. Kalaichelvi T', 'super_admin')
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

-- ----------------------------------------------------------------------------
-- QUESTION 1: Even & Odd Number Counter (Easy - 20 Marks)
-- ----------------------------------------------------------------------------
INSERT INTO round2_questions (id, question_number, title, problem_statement, description, difficulty, language, starter_code, buggy_code, marks, time_limit_seconds, memory_limit_mb, is_active)
VALUES (
    'a1111111-1111-1111-1111-111111111111',
    1,
    'Even & Odd Number Counter',
    'A program receives a list of integers and must count how many numbers are even and how many are odd.',
    'Debug the loop and condition so every number is checked exactly once. The program should print the two counts.

Input:
A list of integers.

Output:
Print the number of even values and odd values in the format:
Even: <count>
Odd: <count>',
    'Easy',
    'python',
    'numbers = [12, 7, 4, 9, 18, 5, 10]

even = 0
odd = 0

for n in numbers:
    if n % 2 == 1:
        even += 1
    else:
        odd += 1

print("Even:", even)
print("Odd:", odd)',
    'numbers = [12, 7, 4, 9, 18, 5, 10]

even = 0
odd = 0

for n in numbers:
    if n % 2 == 1:
        even += 1
    else:
        odd += 1

print("Even:", even)
print("Odd:", odd)',
    20,
    3.0,
    128,
    TRUE
) ON CONFLICT (question_number) DO UPDATE SET
    title = EXCLUDED.title,
    buggy_code = EXCLUDED.buggy_code,
    starter_code = EXCLUDED.starter_code,
    problem_statement = EXCLUDED.problem_statement,
    marks = EXCLUDED.marks;

INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'b1111111-1111-1111-1111-111111111111',
    (SELECT id FROM round2_questions WHERE question_number = 1),
    '[12, 7, 4, 9, 18, 5, 10]',
    'Even: 4
Odd: 3',
    FALSE,
    10,
    0
) ON CONFLICT (id) DO NOTHING;

INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'b1111111-1111-1111-1111-111111111112',
    (SELECT id FROM round2_questions WHERE question_number = 1),
    '[2, 4, 6, 8, 10]',
    'Even: 5
Odd: 0',
    TRUE,
    10,
    1
) ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- QUESTION 2: Student Average Function (Medium - 20 Marks)
-- ----------------------------------------------------------------------------
INSERT INTO round2_questions (id, question_number, title, problem_statement, description, difficulty, language, starter_code, buggy_code, marks, time_limit_seconds, memory_limit_mb, is_active)
VALUES (
    'a2222222-2222-2222-2222-222222222222',
    2,
    'Student Average Function',
    'A student result program uses a function to calculate total, average, and pass/fail status from a list of marks.',
    'Debug the function so it returns the correct average. A student passes only when the average is at least 40.

Input:
A list of integer marks.

Output:
Print Total, Average (2 decimal places), and Result in the format:
Total: <total>
Average: <average>
Result: <PASS/FAIL>',
    'Medium',
    'python',
    'def calculate_result(marks):
    total = 0
    for mark in marks:
        total += marks
    average = total / len(marks)
    if average > 40:
        result = "PASS"
    else:
        result = "FAIL"
    return total, average, result

marks = [35, 45, 50, 40, 30]
total, average, result = calculate_result(marks)

print("Total:", total)
print("Average:", round(average, 2))
print("Result:", result)',
    'def calculate_result(marks):
    total = 0
    for mark in marks:
        total += marks
    average = total / len(marks)
    if average > 40:
        result = "PASS"
    else:
        result = "FAIL"
    return total, average, result

marks = [35, 45, 50, 40, 30]
total, average, result = calculate_result(marks)

print("Total:", total)
print("Average:", round(average, 2))
print("Result:", result)',
    20,
    3.0,
    128,
    TRUE
) ON CONFLICT (question_number) DO UPDATE SET
    title = EXCLUDED.title,
    buggy_code = EXCLUDED.buggy_code,
    starter_code = EXCLUDED.starter_code,
    problem_statement = EXCLUDED.problem_statement,
    marks = EXCLUDED.marks;

INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'b2222222-2222-2222-2222-222222222221',
    (SELECT id FROM round2_questions WHERE question_number = 2),
    '[35, 45, 50, 40, 30]',
    'Total: 200
Average: 40.0
Result: PASS',
    FALSE,
    10,
    0
) ON CONFLICT (id) DO NOTHING;

INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'b2222222-2222-2222-2222-222222222222',
    (SELECT id FROM round2_questions WHERE question_number = 2),
    '[80, 70, 90, 60, 50]',
    'Total: 350
Average: 70.0
Result: PASS',
    TRUE,
    10,
    1
) ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- QUESTION 3: Student Dictionary Lookup (Medium - 20 Marks)
-- ----------------------------------------------------------------------------
INSERT INTO round2_questions (id, question_number, title, problem_statement, description, difficulty, language, starter_code, buggy_code, marks, time_limit_seconds, memory_limit_mb, is_active)
VALUES (
    'a3333333-3333-3333-3333-333333333333',
    3,
    'Student Dictionary Lookup',
    'A student-record program stores names and marks in a dictionary. It should display the requested student''s mark and convert the name to uppercase.',
    'Debug the dictionary access and string operation. The requested key exists in the given test cases.

Input:
A dictionary of student names and marks, plus a student name to search.

Output:
Print the student''s uppercase name and mark in the format:
Name: <UPPERCASE_NAME>
Mark: <mark>',
    'Medium',
    'python',
    'students = {
    "Ravi": 78,
    "Anu": 85,
    "Kiran": 69
}

name = "Anu"

print("Name:", students[name].upper())
print("Mark:", students[name])',
    'students = {
    "Ravi": 78,
    "Anu": 85,
    "Kiran": 69
}

name = "Anu"

print("Name:", students[name].upper())
print("Mark:", students[name])',
    20,
    3.0,
    128,
    TRUE
) ON CONFLICT (question_number) DO UPDATE SET
    title = EXCLUDED.title,
    buggy_code = EXCLUDED.buggy_code,
    starter_code = EXCLUDED.starter_code,
    problem_statement = EXCLUDED.problem_statement,
    marks = EXCLUDED.marks;

INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'b3333333-3333-3333-3333-333333333331',
    (SELECT id FROM round2_questions WHERE question_number = 3),
    'students={"Ravi": 78, "Anu": 85, "Kiran": 69}; name="Anu"',
    'Name: ANU
Mark: 85',
    FALSE,
    10,
    0
) ON CONFLICT (id) DO NOTHING;

INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'b3333333-3333-3333-3333-333333333332',
    (SELECT id FROM round2_questions WHERE question_number = 3),
    'students={"Ravi": 78, "Anu": 85, "Kiran": 69}; name="Ravi"',
    'Name: RAVI
Mark: 78',
    TRUE,
    10,
    1
) ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- QUESTION 4: Marks File Average (Hard - 20 Marks)
-- ----------------------------------------------------------------------------
INSERT INTO round2_questions (id, question_number, title, problem_statement, description, difficulty, language, starter_code, buggy_code, marks, time_limit_seconds, memory_limit_mb, is_active)
VALUES (
    'a4444444-4444-4444-4444-444444444444',
    4,
    'Marks File Average',
    'A small result utility reads marks from a text file, one mark per line, and calculates the average. Blank lines may occur.',
    'Debug the program so blank lines are ignored and the average is calculated from the valid numeric marks. Keep the solution compact; no advanced file-processing techniques are required.

Input:
A text file ''marks.txt'' containing one mark per line.

Output:
Print the number of marks and the average rounded to 2 decimal places in the format:
Count: <count>
Average: <average>',
    'Hard',
    'python',
    'def read_marks(filename):
    file = open(filename, "r")
    marks = []
    for line in file:
        marks.append(int(line))
    file.close()
    return marks

marks = read_marks("marks.txt")
average = sum(marks) / len(marks)

print("Count:", len(marks))
print("Average:", round(average, 2))',
    'def read_marks(filename):
    file = open(filename, "r")
    marks = []
    for line in file:
        marks.append(int(line))
    file.close()
    return marks

marks = read_marks("marks.txt")
average = sum(marks) / len(marks)

print("Count:", len(marks))
print("Average:", round(average, 2))',
    20,
    3.0,
    128,
    TRUE
) ON CONFLICT (question_number) DO UPDATE SET
    title = EXCLUDED.title,
    buggy_code = EXCLUDED.buggy_code,
    starter_code = EXCLUDED.starter_code,
    problem_statement = EXCLUDED.problem_statement,
    marks = EXCLUDED.marks;

INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'b4444444-4444-4444-4444-444444444441',
    (SELECT id FROM round2_questions WHERE question_number = 4),
    '70
80

90',
    'Count: 3
Average: 80.0',
    FALSE,
    10,
    0
) ON CONFLICT (id) DO NOTHING;

INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'b4444444-4444-4444-4444-444444444442',
    (SELECT id FROM round2_questions WHERE question_number = 4),
    '50
60
70
80',
    'Count: 4
Average: 65.0',
    TRUE,
    10,
    1
) ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- QUESTION 5: NumPy Marks Analysis (Hard - 20 Marks)
-- ----------------------------------------------------------------------------
INSERT INTO round2_questions (id, question_number, title, problem_statement, description, difficulty, language, starter_code, buggy_code, marks, time_limit_seconds, memory_limit_mb, is_active)
VALUES (
    'a5555555-5555-5555-5555-555555555555',
    5,
    'NumPy Marks Analysis',
    'A small marks-analysis program uses NumPy to find the highest mark and then places the marks into a Pandas DataFrame for display.',
    'Debug the NumPy maximum calculation and the DataFrame column construction. Keep the program short and use only basic NumPy/Pandas operations.

Input:
A one-dimensional NumPy array of marks.

Output:
Print the highest mark and a DataFrame containing the marks in the format:
Highest: <highest>
DataFrame Marks column contains: <mark1>, <mark2>, ...',
    'Hard',
    'python',
    'import numpy as np
import pandas as pd

marks = np.array([72, 88, 65, 91, 79])

highest = marks.min()
df = pd.DataFrame({"Marks": highest})

print("Highest:", highest)
print(df)',
    'import numpy as np
import pandas as pd

marks = np.array([72, 88, 65, 91, 79])

highest = marks.min()
df = pd.DataFrame({"Marks": highest})

print("Highest:", highest)
print(df)',
    20,
    3.0,
    128,
    TRUE
) ON CONFLICT (question_number) DO UPDATE SET
    title = EXCLUDED.title,
    buggy_code = EXCLUDED.buggy_code,
    starter_code = EXCLUDED.starter_code,
    problem_statement = EXCLUDED.problem_statement,
    marks = EXCLUDED.marks;

INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'b5555555-5555-5555-5555-555555555551',
    (SELECT id FROM round2_questions WHERE question_number = 5),
    '[72, 88, 65, 91, 79]',
    'Highest: 91
DataFrame Marks column contains: 72, 88, 65, 91, 79',
    FALSE,
    10,
    0
) ON CONFLICT (id) DO NOTHING;

INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'b5555555-5555-5555-5555-555555555552',
    (SELECT id FROM round2_questions WHERE question_number = 5),
    '[55, 60, 82, 74]',
    'Highest: 82
DataFrame Marks column contains: 55, 60, 82, 74',
    TRUE,
    10,
    1
) ON CONFLICT (id) DO NOTHING;
