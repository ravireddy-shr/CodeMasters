from typing import List, Optional, Any
from pydantic import BaseModel, EmailStr, Field

# -----------------------------------------------------------------------------
# AUTH SCHEMAS
# -----------------------------------------------------------------------------
class ParticipantLoginRequest(BaseModel):
    email_or_vtu: str
    password: str

class ParticipantRegisterRequest(BaseModel):
    full_name: str
    vtu_number: str
    email: str
    password: str

class AdminLoginRequest(BaseModel):
    email: str
    password: str

class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_type: str  # "participant" | "admin"
    user: Any

# -----------------------------------------------------------------------------
# QUESTION & TEST CASE SCHEMAS
# -----------------------------------------------------------------------------
class TestCaseBase(BaseModel):
    input_data: str
    expected_output: str
    is_hidden: bool = False
    marks: int = 20
    order_index: Optional[int] = 0

class TestCasePublicResponse(BaseModel):
    id: str
    question_id: str
    input_data: str
    expected_output: str
    is_hidden: bool = False
    marks: int

class TestCaseAdminResponse(BaseModel):
    id: str
    question_id: str
    input_data: str
    expected_output: str
    is_hidden: bool
    marks: int
    order_index: int

class QuestionCreateRequest(BaseModel):
    question_number: Optional[int] = None
    title: str
    problem_statement: str
    description: str
    difficulty: str = "Medium"
    language: str = "python"
    starter_code: Optional[str] = ""
    buggy_code: str
    marks: int = 100
    time_limit_seconds: float = 3.0
    memory_limit_mb: int = 128
    is_active: bool = True
    test_cases: List[TestCaseBase] = []

class QuestionUpdateRequest(BaseModel):
    title: str
    problem_statement: str
    description: str
    difficulty: str = "Medium"
    language: str = "python"
    starter_code: Optional[str] = ""
    buggy_code: str
    marks: int = 100
    time_limit_seconds: float = 3.0
    memory_limit_mb: int = 128
    is_active: bool = True
    test_cases: Optional[List[TestCaseBase]] = None

class QuestionPublicResponse(BaseModel):
    id: str
    question_number: int
    title: str
    problem_statement: str
    description: str
    difficulty: str
    language: str
    starter_code: Optional[str] = ""
    buggy_code: str
    marks: int
    time_limit_seconds: float
    memory_limit_mb: int
    test_cases: List[TestCasePublicResponse]

# -----------------------------------------------------------------------------
# CODE RUN & SUBMISSION SCHEMAS
# -----------------------------------------------------------------------------
class CodeRunRequest(BaseModel):
    question_id: str
    code: str
    language: str = "python"

class TestCaseResultPublic(BaseModel):
    test_case_id: str
    passed: bool
    status: str
    input_data: str
    expected_output: str
    actual_output: str
    execution_time_ms: float
    error_message: Optional[str] = None
    is_hidden: bool
    marks: int
    score_awarded: int
    error_line: Optional[int] = None
    error_type: Optional[str] = None
    error_tip: Optional[str] = None

class ErrorSummary(BaseModel):
    error_line: Optional[int] = None
    error_type: Optional[str] = None
    error_tip: Optional[str] = None

class CodeRunResponse(BaseModel):
    success: bool
    total_test_cases: int
    passed_count: int
    failed_count: int
    score_awarded: int
    max_score: int
    total_execution_time_ms: float
    results: List[TestCaseResultPublic]
    error_summary: Optional[ErrorSummary] = None

class CodeSubmitRequest(BaseModel):
    question_id: str
    code: str
    language: str = "python"
    is_auto_submit: bool = False

class CodeSubmitResponse(BaseModel):
    submission_id: str
    status: str
    score: int
    max_score: int
    passed_cases: int
    total_cases: int
    submitted_at: str
    execution_results: List[TestCaseResultPublic]
    total_active_questions: Optional[int] = 1
    submitted_questions_count: Optional[int] = 1
    total_accumulated_score: Optional[int] = None
    is_all_submitted: bool = False
    participant_status: str = "In Progress"

# -----------------------------------------------------------------------------
# WARNINGS & PROCTORING SCHEMAS
# -----------------------------------------------------------------------------
class WarningRequest(BaseModel):
    reason: str
    message: str

class WarningResponse(BaseModel):
    warning_id: str
    warnings_count: int
    max_warnings: int
    is_disqualified: bool
    reason: str
    message: str

# -----------------------------------------------------------------------------
# SETTINGS & ADMIN SCHEMAS
# -----------------------------------------------------------------------------
class SettingsUpdateRequest(BaseModel):
    competition_name: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    is_active: Optional[bool] = None
    max_warnings: Optional[int] = None
    auto_submit_on_expire: Optional[bool] = None

class ParticipantOverrideRequest(BaseModel):
    action: str  # 'disqualify' | 're_enable' | 'unlock_submission' | 'reset_warnings'
    reason: Optional[str] = None
