from fastapi import APIRouter, HTTPException, Depends
from app.core.database import db
from app.core.security import get_current_participant
from app.models.schemas import WarningRequest, WarningResponse

router = APIRouter(prefix="/warnings", tags=["Anti-Cheat & Proctoring"])

@router.post("", response_model=WarningResponse)
async def report_warning(payload: WarningRequest, current_user: dict = Depends(get_current_participant)):
    participant_id = current_user["sub"]
    result = db.log_warning(
        participant_id=participant_id,
        reason=payload.reason,
        message=payload.message
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
