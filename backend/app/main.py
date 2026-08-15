import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import health, requirements, websocket
from app.services.depth_estimator import depth_estimator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Digital Dimension Tracking Backend...")
    # Load Depth Anything V2 model once on startup in background task or startup hook
    try:
        loop = asyncio.get_running_loop()
        # Run model loading in executor so server startup is non-blocking
        await loop.run_in_executor(None, depth_estimator.load_model, settings.MODEL_ID)
    except Exception as e:
        logger.error(f"Error loading depth model during startup: {e}")
    
    yield
    logger.info("Shutting down Digital Dimension Tracking Backend...")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS configuration for frontend application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(requirements.router, prefix="/api", tags=["Requirements"])
app.include_router(websocket.router, tags=["WebSocket"])

@app.get("/")
async def root():
    return {
        "title": settings.APP_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "status": "online"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
