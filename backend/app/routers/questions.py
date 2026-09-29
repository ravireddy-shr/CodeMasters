from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import db
from app.core.security import get_current_participant_optional
from app.models.schemas import QuestionPublicResponse

router = APIRouter(prefix="/questions", tags=["Questions"])

@router.get("", response_model=List[QuestionPublicResponse])
async def get_all_active_questions(current_user: Optional[dict] = Depends(get_current_participant_optional)):
    """
    Returns ALL active Round 2 debugging questions uploaded by admin.
    CRITICAL: Hidden test cases are NEVER exposed to participants here!
    """
    questions = db.list_questions(active_only=True, include_hidden=False)
    return questions

@router.get("/active", response_model=QuestionPublicResponse)
async def get_active_question(current_user: Optional[dict] = Depends(get_current_participant_optional)):
    """
    Returns the first active Round 2 debugging question.
    """
    q = db.get_active_question(include_hidden=False)
    if not q:
        raise HTTPException(status_code=404, detail="No active debugging problem configured yet.")
    return q

@router.get("/{question_id}", response_model=QuestionPublicResponse)
async def get_question_by_id(question_id: str, current_user: Optional[dict] = Depends(get_current_participant_optional)):
    q = db.get_question_by_id(question_id, include_hidden=False)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    if not q.get("is_active") and (not current_user or current_user.get("role") not in ["admin", "super_admin"]):
        raise HTTPException(status_code=403, detail="Question is not currently active")
    return q
