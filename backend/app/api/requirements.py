from fastapi import APIRouter, HTTPException
from app.services.aicte_checker import aicte_checker
from app.models.schemas import RoomRequirement, RequirementsUpdateRequest

router = APIRouter()

@router.get("/requirements")
async def get_all_requirements():
    """
    Get all configured AICTE room requirement profiles.
    """
    return {
        "status": "success",
        "disclaimer": "The returned requirements are configurable infrastructure standards. Default values are demo placeholders.",
        "requirements": aicte_checker.get_all_requirements()
    }

@router.get("/requirements/{room_key}")
async def get_requirement_by_key(room_key: str):
    """
    Get specific AICTE room requirement by key (e.g., 'classroom', 'computer_lab').
    """
    req = aicte_checker.get_requirement(room_key)
    if not req:
        raise HTTPException(status_code=404, detail=f"Room requirement profile '{room_key}' not found.")
    return {
        "status": "success",
        "room_key": room_key,
        "requirement": req
    }

@router.post("/requirements")
async def update_requirement(payload: RequirementsUpdateRequest):
    """
    Update or create a room requirement standard profile.
    """
    updated = aicte_checker.update_requirement(payload.room_key, payload.requirements)
    return {
        "status": "success",
        "message": f"Successfully updated AICTE requirements for '{payload.room_key}'",
        "room_key": payload.room_key,
        "requirement": updated
    }
