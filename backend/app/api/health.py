from fastapi import APIRouter
from app.config import settings
from app.services.depth_estimator import depth_estimator

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.VERSION,
        "depth_model": {
            "ready": depth_estimator.is_ready,
            "model_name": depth_estimator.model_name or settings.MODEL_ID,
            "device": depth_estimator.device
        }
    }
