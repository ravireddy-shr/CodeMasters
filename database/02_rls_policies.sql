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
