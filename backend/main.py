import os
from dotenv import load_dotenv

# Load environment variables: check .env, .env.local, and parent .env.local
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.local"))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routes.history_routes import router as history_router
from backend.routes.upload_routes import router as upload_router, UPLOAD_DIR
from backend.routes.chat_routes import router as chat_router
from backend.routes.websocket_routes import router as websocket_router
from backend.routes.interview_routes import router as interview_router
from backend.routes.ticket_routes import router as ticket_router
from backend.routes.auth_routes import router as auth_router
from backend.routes.analytics_routes import router as analytics_router
from backend.utils.logging import logger

app = FastAPI(
    title="seeSpeak AI Backend",
    description="Real-time Voice + Multimodal AI Agent Backend",
    version="2.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploads
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include Routers
app.include_router(history_router)
app.include_router(upload_router)
app.include_router(chat_router)
app.include_router(websocket_router)
app.include_router(interview_router)
app.include_router(ticket_router)
app.include_router(auth_router)
app.include_router(analytics_router)

@app.get("/health")
@app.get("/api/health")
def health_check():
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    return {
        "status": "online",
        "service": "seeSpeak AI",
        "has_gemini_key": bool(gemini_key and len(gemini_key) > 5),
        "voice_mode": os.getenv("VOICE_MODE", "gemini" if gemini_key else "mock")
    }

# Unified single link serving: mount frontend dist if built
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    from fastapi.responses import FileResponse
    from fastapi import HTTPException
    
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend_assets")

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        if full_path.startswith(("api", "uploads", "docs", "openapi.json", "ws")):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

@app.on_event("startup")
async def startup_event():
    gemini_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    has_key = bool(gemini_key and len(gemini_key) > 5)
    is_placeholder = bool(not gemini_key or "your_" in gemini_key.lower() or len(gemini_key) < 10 or "placeholder" in gemini_key.lower())

    logger.info("==========================================")
    logger.info("   seeSpeak AI Backend Starting Up       ")
    logger.info("   Port: 8000 | WebSocket: /ws/session    ")
    if not has_key or is_placeholder:
        logger.warning("   [CONFIG] GEMINI_API_KEY is not configured or using placeholder.")
        logger.warning("   [CONFIG] Realtime voice pipeline will run with Mock fallback.")
        logger.warning("   [CONFIG] To enable Live Gemini, set GEMINI_API_KEY in backend/.env")
        logger.info("   [PROVIDER STATUS] MOCK REALTIME PROVIDER IS ACTIVE")
    else:
        logger.info(f"   [CONFIG] GEMINI_API_KEY detected (Length: {len(gemini_key)} chars)")
        logger.info("   [CONFIG] Realtime Live voice models ready.")
        logger.info("   [PROVIDER STATUS] Real Gemini Live Provider is ACTIVE")
    logger.info("==========================================")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
