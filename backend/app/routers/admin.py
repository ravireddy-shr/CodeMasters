from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import db
from app.core.security import get_current_admin
from app.models.schemas import (
    QuestionCreateRequest, QuestionUpdateRequest,
    ParticipantOverrideRequest
)

router = APIRouter(prefix="/admin", tags=["Admin Portal"])

@router.get("/stats")
async def get_stats(current_admin: dict = Depends(get_current_admin)):
    """Returns REAL telemetry stats directly from the database (no fake numbers)."""
    return db.get_admin_telemetry()

@router.get("/questions")
async def list_all_questions(current_admin: dict = Depends(get_current_admin)):
    return db.list_questions(active_only=False)

@router.post("/questions")
async def create_question(payload: QuestionCreateRequest, current_admin: dict = Depends(get_current_admin)):
    data = payload.model_dump()
    q = db.create_question(data)
    return q

@router.post("/questions/seed-round2-suite")
async def seed_round2_suite(current_admin: dict = Depends(get_current_admin)):
    """Seeds the 5 official Round 2 prototype questions (20 marks each, 100 marks total)."""
    suite = db.seed_round2_standard_suite()
    return {"message": "5 Round 2 Prototype Questions Seeded Successfully", "questions": suite}

@router.put("/questions/{question_id}")
async def update_question(question_id: str, payload: QuestionUpdateRequest, current_admin: dict = Depends(get_current_admin)):
    data = payload.model_dump(exclude_unset=True)
    q = db.update_question(question_id, data)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return q

@router.delete("/questions/{question_id}")
async def delete_question(question_id: str, current_admin: dict = Depends(get_current_admin)):
    success = db.delete_question(question_id)
    if not success:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"message": "Question deleted successfully"}

@router.post("/questions/{question_id}/toggle-active")
async def toggle_question_active(question_id: str, current_admin: dict = Depends(get_current_admin)):
    q = db.get_question_by_id(question_id, include_hidden=True)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    new_state = not q.get("is_active", True)
    updated = db.update_question(question_id, {"is_active": new_state})
    return updated

@router.get("/submissions")
async def list_submissions(current_admin: dict = Depends(get_current_admin)):
    return db.list_submissions()

@router.get("/participants")
async def list_participants(current_admin: dict = Depends(get_current_admin)):
    participants = db.list_participants()
    for p in participants:
        p.pop("password_hash", None)
    return participants

@router.post("/participants/{participant_id}/override")
async def override_participant(participant_id: str, payload: ParticipantOverrideRequest, current_admin: dict = Depends(get_current_admin)):
    p = db.get_participant_by_id(participant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Participant not found")

    action = payload.action.lower()
    if action == "disqualify":
        db.update_participant(participant_id, {
            "is_disqualified": 1,
            "disqualification_reason": payload.reason or "Administrative disqualification",
            "status": "Disqualified",
        })
    elif action == "re_enable":
        db.update_participant(participant_id, {
            "is_disqualified": 0,
            "disqualification_reason": None,
            "status": "Ready",
        })
    elif action == "reset_warnings":
        db.reset_warnings(participant_id)
    elif action == "unlock_submission":
        db.unlock_submission(participant_id)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown override action '{action}'")

    updated_p = db.get_participant_by_id(participant_id)
    updated_p.pop("password_hash", None)
    return updated_p

@router.get("/leaderboard")
async def get_leaderboard(current_admin: dict = Depends(get_current_admin)):
    return db.get_leaderboard()

from pydantic import BaseModel
from typing import Optional

class ExtraTimeRequest(BaseModel):
    extra_minutes: int
    reason: Optional[str] = "Proctor extra time grant"

@router.post("/participants/{participant_id}/extra-time")
async def add_participant_extra_time(participant_id: str, payload: ExtraTimeRequest, current_admin: dict = Depends(get_current_admin)):
    p = db.get_participant_by_id(participant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Participant not found")
    updated = db.add_participant_extra_time(participant_id, payload.extra_minutes, payload.reason or "")
    if not updated:
        raise HTTPException(status_code=404, detail="Failed to add extra time")
    updated.pop("password_hash", None)
    return updated

@router.post("/participants/bulk/extra-time")
async def bulk_add_extra_time(payload: ExtraTimeRequest, current_admin: dict = Depends(get_current_admin)):
    count = db.add_all_participants_extra_time(payload.extra_minutes)
    return {"message": f"Successfully granted +{payload.extra_minutes} minutes to {count} participants", "count": count}

@router.post("/sync-supabase")
async def trigger_supabase_sync(current_admin: dict = Depends(get_current_admin)):
    from app.core.supabase_sync import supabase_sync
    res = supabase_sync.sync_all_from_local_db(db)
    return {"message": "Supabase sync triggered", "results": res}

