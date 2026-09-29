from datetime import timedelta
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import db
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, get_current_participant, get_current_admin
)
from app.core.config import settings
from app.models.schemas import (
    ParticipantLoginRequest, ParticipantRegisterRequest,
    AdminLoginRequest, AuthTokenResponse
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/participant/register", response_model=AuthTokenResponse)
async def register_participant(payload: ParticipantRegisterRequest):
    existing = db.get_participant_by_email_or_vtu(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="A participant with this email already exists")

    existing_vtu = db.get_participant_by_email_or_vtu(payload.vtu_number)
    if existing_vtu:
        raise HTTPException(status_code=400, detail="A participant with this VTU number already exists")

    pwd_hash = get_password_hash(payload.password)
    participant = db.create_participant(
        full_name=payload.full_name,
        vtu_number=payload.vtu_number,
        email=payload.email,
        password_hash=pwd_hash,
        password_plain=payload.password,
    )

    token = create_access_token({
        "sub": participant["id"],
        "email": participant["email"],
        "vtu_number": participant["vtu_number"],
        "full_name": participant["full_name"],
        "type": "participant",
    })

    # Strip password hash before returning
    participant.pop("password_hash", None)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_type": "participant",
        "user": participant,
    }

@router.post("/participant/login", response_model=AuthTokenResponse)
async def login_participant(payload: ParticipantLoginRequest):
    participant = db.get_participant_by_email_or_vtu(payload.email_or_vtu)
    if not participant:
        raise HTTPException(status_code=401, detail="Participant record not found with provided identifier")

    if participant.get("is_disqualified"):
        raise HTTPException(status_code=403, detail=f"Disqualified: {participant.get('disqualification_reason', 'Violation of contest rules')}")

    # Check password
    stored_hash = participant.get("password_hash")
    if stored_hash and not verify_password(payload.password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid password")

    # Update last_active in participants and record login in participant_logins
    db.update_participant(participant["id"], {"status": "In Progress" if participant["status"] == "Ready" else participant["status"]})
    db.update_participant_last_login(participant["id"])
    updated_p = db.get_participant_by_id(participant["id"])

    token = create_access_token({
        "sub": participant["id"],
        "email": participant["email"],
        "vtu_number": participant["vtu_number"],
        "full_name": participant["full_name"],
        "type": "participant",
    })

    updated_p.pop("password_hash", None)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_type": "participant",
        "user": updated_p,
    }

@router.get("/participant/me")
async def get_participant_me(current_user: dict = Depends(get_current_participant)):
    participant = db.get_participant_by_id(current_user["sub"])
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    participant.pop("password_hash", None)
    # Check if they have an active submission
    active_q = db.get_active_question(include_hidden=False)
    if active_q:
        participant["active_submission"] = db.get_submission_by_participant(participant["id"], active_q["id"])
    return participant

@router.post("/admin/login", response_model=AuthTokenResponse)
async def login_admin(payload: AdminLoginRequest):
    email = payload.email.strip().lower()
    # Check if official admin credentials
    if email == settings.ADMIN_DEFAULT_EMAIL.lower() and payload.password == settings.ADMIN_DEFAULT_PASSWORD:
        admin_data = db.get_admin_by_email(email)
        if not admin_data:
            admin_data = db.create_admin(email, "Prof. Kalaichelvi T", get_password_hash(payload.password), "super_admin")
    else:
        admin_data = db.get_admin_by_email(email)
        if not admin_data or not verify_password(payload.password, admin_data.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="Invalid admin credentials")

    token = create_access_token({
        "sub": admin_data["id"],
        "email": admin_data["email"],
        "role": admin_data.get("role", "admin"),
        "full_name": admin_data.get("full_name", "Admin"),
        "type": "admin",
    })

    admin_data.pop("password_hash", None)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_type": "admin",
        "user": admin_data,
    }

@router.get("/admin/me")
async def get_admin_me(current_user: dict = Depends(get_current_admin)):
    admin = db.get_admin_by_email(current_user["email"])
    if not admin:
        return current_user
    admin.pop("password_hash", None)
    return admin
