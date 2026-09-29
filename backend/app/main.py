from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import auth, questions, code_run, submissions, warnings, admin, settings as settings_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Standalone Backend & Secure Execution Engine for Code Masters Round 2 Python Debugging Challenge",
)

# CORS Middleware allowing frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For competition environments & Vercel deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(questions.router, prefix=settings.API_V1_STR)
app.include_router(code_run.router, prefix=settings.API_V1_STR)
app.include_router(submissions.router, prefix=settings.API_V1_STR)
app.include_router(warnings.router, prefix=settings.API_V1_STR)
app.include_router(settings_router.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)

@app.on_event("startup")
async def startup_event():
    import threading
    from app.core.database import db
    from app.core.supabase_sync import supabase_sync

    def do_sync():
        try:
            res = supabase_sync.sync_all_from_local_db(db)
            print(f"[Supabase Sync] Startup sync result: {res}")
        except Exception as e:
            print(f"[Supabase Sync] Startup sync error: {e}")

    threading.Thread(target=do_sync, daemon=True).start()

@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "service": "Code Masters Round 2 API",
        "version": settings.VERSION,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
