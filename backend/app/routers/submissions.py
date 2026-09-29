import sys
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import db
from app.core.security import get_current_participant
from app.models.schemas import CodeSubmitRequest, CodeSubmitResponse

# Add execution engine path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "execution-engine", "app")))
from runner import execute_test_suite

router = APIRouter(prefix="/submissions", tags=["Submissions"])

@router.post("/submit", response_model=CodeSubmitResponse)
async def submit_code(payload: CodeSubmitRequest, current_user: dict = Depends(get_current_participant)):
    participant_id = current_user.get("sub")
    participant = db.get_participant_by_id(participant_id) if participant_id else None
    if not participant and current_user.get("vtu_number"):
        participant = db.get_participant_by_email_or_vtu(current_user["vtu_number"])
        if participant:
            participant_id = participant["id"]
    if not participant:
        conn = db.get_connection()
        row = conn.execute("SELECT * FROM participants ORDER BY updated_at DESC LIMIT 1").fetchone()
        conn.close()
        if row:
            participant = dict(row)
            participant_id = participant["id"]
    if not participant:
        raise HTTPException(status_code=404, detail="Participant record not found")

    if participant.get("is_disqualified"):
        raise HTTPException(status_code=403, detail="Participant is disqualified")

    # Check if already submitted and not unlocked
    existing_sub = db.get_submission_by_participant(participant_id, payload.question_id)
    if existing_sub and participant.get("status") == "Submitted" and not payload.is_auto_submit:
        raise HTTPException(
            status_code=400,
            detail="You have already submitted Round 2. Submissions are final unless unlocked by an administrator."
        )

    # Check competition settings
    settings = db.get_settings()
    if not settings.get("is_active"):
        raise HTTPException(status_code=400, detail="Round 2 competition is currently closed.")

    question = db.get_question_by_id(payload.question_id, include_hidden=True)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Retrieve ALL authorized test cases (INCLUDING HIDDEN)
    all_cases = db.get_test_cases(question["id"], include_hidden=True)
    if not all_cases:
        all_cases = question.get("test_cases", [])
    if not all_cases:
        raise HTTPException(status_code=400, detail="No test cases configured for this question.")

    # Execute against ALL test cases
    exec_result = execute_test_suite(
        code=payload.code,
        test_cases=all_cases,
        time_limit_seconds=float(question.get("time_limit_seconds", 3.0)),
        stop_on_first_error=False,
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    sub_data = {
        "participant_id": participant_id,
        "question_id": payload.question_id,
        "code": payload.code,
        "language": payload.language,
        "status": "Auto-Submitted" if payload.is_auto_submit else "Submitted",
        "score": exec_result["score_awarded"],
        "max_score": exec_result["max_score"],
        "passed_cases": exec_result["passed_count"],
        "total_cases": exec_result["total_test_cases"],
        "execution_time_ms": exec_result["total_execution_time_ms"],
        "submitted_at": now_iso,
    }

    # Save to database (submission + execution results)
    saved_sub = db.save_submission(sub_data, exec_result["detailed_results_for_admin"])

    return {
        "submission_id": saved_sub["id"],
        "status": saved_sub["status"],
        "score": saved_sub["score"],
        "max_score": saved_sub["max_score"],
        "passed_cases": saved_sub["passed_cases"],
        "total_cases": saved_sub["total_cases"],
        "submitted_at": saved_sub["submitted_at"],
        "execution_results": exec_result["results"],  # Sanitized results for participant!
        "total_active_questions": saved_sub.get("total_active_questions", 1),
        "submitted_questions_count": saved_sub.get("submitted_questions_count", 1),
        "total_accumulated_score": saved_sub.get("total_accumulated_score", saved_sub["score"]),
        "is_all_submitted": saved_sub.get("is_all_submitted", False),
        "participant_status": saved_sub.get("participant_status", "In Progress"),
    }

@router.get("/progress")
async def get_my_progress(current_user: dict = Depends(get_current_participant)):
    """Returns the participant's step-by-step submission progress across all active questions."""
    return db.get_participant_submissions_summary(current_user["sub"])

@router.post("/finish-contest")
async def finish_contest(current_user: dict = Depends(get_current_participant)):
    """Participant explicitly completes the contest and finalizes their assessment."""
    return db.finish_participant_contest(current_user["sub"])

@router.get("/my")
async def get_my_submission(question_id: str, current_user: dict = Depends(get_current_participant)):
    sub = db.get_submission_by_participant(current_user["sub"], question_id)
    if not sub:
        return None
    return sub
