import sys
import os
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, Dict, Any
from app.core.database import db
from app.core.security import get_current_participant_optional
from app.models.schemas import CodeRunRequest, CodeRunResponse

# Add execution engine path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "execution-engine", "app")))
from runner import execute_test_suite

router = APIRouter(prefix="/code", tags=["Code Execution"])

@router.post("/run", response_model=CodeRunResponse)
async def run_code(payload: CodeRunRequest, current_user: Optional[Dict[str, Any]] = Depends(get_current_participant_optional)):
    if current_user:
        participant_id = current_user.get("sub")
        if participant_id:
            participant = db.get_participant_by_id(participant_id)
            if participant and participant.get("is_disqualified"):
                raise HTTPException(status_code=403, detail="Participant is disqualified from executing code")

    question = db.get_question_by_id(payload.question_id, include_hidden=False)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Fetch PUBLIC test cases only
    public_cases = [tc for tc in question.get("test_cases", []) if not tc.get("is_hidden")]
    if not public_cases:
        public_cases = [tc for tc in db.get_test_cases(question["id"], include_hidden=False) if not tc.get("is_hidden")]
    if not public_cases:
        raise HTTPException(status_code=400, detail="No public test cases configured for this question.")

    # Execute code in isolated sandbox
    exec_result = execute_test_suite(
        code=payload.code,
        test_cases=public_cases,
        time_limit_seconds=float(question.get("time_limit_seconds", 3.0)),
        stop_on_first_error=False,
    )

    return exec_result
