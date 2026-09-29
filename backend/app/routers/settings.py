from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.database import db
from app.core.security import get_current_admin
from app.models.schemas import SettingsUpdateRequest

router = APIRouter(prefix="/settings", tags=["Settings"])

class TimeAdjustmentRequest(BaseModel):
    delta_minutes: int

@router.get("")
async def get_competition_settings():
    return db.get_settings()

@router.put("")
async def update_competition_settings(payload: SettingsUpdateRequest, current_admin: dict = Depends(get_current_admin)):
    data = payload.model_dump(exclude_unset=True)
    return db.update_settings(data)

@router.post("/adjust-time")
async def adjust_exam_duration(payload: TimeAdjustmentRequest, current_admin: dict = Depends(get_current_admin)):
    settings_data = db.get_settings()
    current_duration = settings_data.get("duration_minutes", 90)
    new_duration = max(5, current_duration + payload.delta_minutes)
    return db.update_settings({"duration_minutes": new_duration})

