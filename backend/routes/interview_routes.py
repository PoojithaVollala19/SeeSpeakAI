import os
import shutil
import uuid
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from backend.repositories.interview_repository import interview_repository
from backend.services.interview_evaluator import evaluate_interview_session
from backend.services.resume_parser import ResumeParser
from backend.utils.logging import logger

router = APIRouter(tags=["interviews"])

RESUME_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "resumes")
os.makedirs(RESUME_UPLOAD_DIR, exist_ok=True)

class CreateInterviewRequest(BaseModel):
    interview_type: str = "Technical Software Engineer"
    language: str = "en"
    user_id: Optional[str] = "default_user"
    job_role: Optional[str] = None
    experience_level: Optional[str] = None
    difficulty: Optional[str] = None
    job_description: Optional[str] = None
    resume_context: Optional[Dict[str, Any]] = None
    experience_metrics: Optional[Dict[str, Any]] = None

@router.post("/api/interviews/upload-resume")
@router.post("/api/interview/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    """Uploads and parses candidate resume (PDF, DOCX, TXT), extracting structured skills, projects, and summary."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No resume file uploaded")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".docx", ".doc", ".txt", ".md"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported resume format '{ext}'. Please upload a PDF, DOCX, or TXT file."
        )

    safe_name = f"resume_{uuid.uuid4().hex[:8]}_{file.filename}"
    file_path = os.path.join(RESUME_UPLOAD_DIR, safe_name)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save resume file {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save resume file: {str(e)}")

    try:
        parsed_data = ResumeParser.parse_file(file_path, file.filename)
        logger.info(f"Successfully parsed resume: {file.filename} (Candidate: {parsed_data.get('candidate_name')}, {len(parsed_data.get('skills', []))} skills)")
        return {
            "status": "success",
            "filename": file.filename,
            "parsed": parsed_data
        }
    except Exception as e:
        logger.error(f"Error parsing resume {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse resume: {str(e)}")

class UpdateTranscriptRequest(BaseModel):
    transcript: List[Dict[str, Any]]
    experience_metrics: Optional[Dict[str, Any]] = None

class CompleteInterviewRequest(BaseModel):
    duration: Optional[int] = None
    duration_seconds: Optional[int] = None
    transcript: Optional[List[Dict[str, Any]]] = None
    experience_metrics: Optional[Dict[str, Any]] = None

from backend.utils.auth_deps import get_current_user_optional
from fastapi import Depends

@router.post("/api/interviews/sessions")
@router.post("/api/interview/sessions")
def create_interview_session(
    req: CreateInterviewRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    metrics = req.experience_metrics or {}
    if req.job_role:
        metrics["job_role"] = req.job_role
    if req.experience_level:
        metrics["experience_level"] = req.experience_level
    if req.difficulty:
        metrics["difficulty"] = req.difficulty
    if req.job_description:
        metrics["job_description"] = req.job_description
    if req.resume_context:
        metrics["resume_context"] = req.resume_context

    effective_user_id = user["id"] if user else (req.user_id or "default_user")

    return interview_repository.create_session(
        interview_type=req.interview_type,
        language=req.language,
        user_id=effective_user_id,
        experience_metrics=metrics
    )

@router.get("/api/interviews/sessions")
@router.get("/api/interview/sessions")
def list_interview_sessions(
    user_id: Optional[str] = Query(None),
    limit: int = Query(50),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    effective_user_id = user["id"] if user else user_id
    return interview_repository.list_sessions(user_id=effective_user_id, limit=limit)

@router.get("/api/interviews/sessions/{session_id}")
@router.get("/api/interview/sessions/{session_id}")
def get_interview_session(
    session_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    uid = user["id"] if user else None
    sess = interview_repository.get_session(session_id, user_id=uid)
    if not sess:
        raise HTTPException(status_code=404, detail="Interview session not found")
    return sess

@router.post("/api/interviews/sessions/{session_id}/transcript")
@router.post("/api/interview/sessions/{session_id}/transcript")
def update_transcript(
    session_id: str,
    req: UpdateTranscriptRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    uid = user["id"] if user else None
    sess = interview_repository.get_session(session_id, user_id=uid)
    if not sess:
        raise HTTPException(status_code=404, detail="Interview session not found")
    interview_repository.update_transcript(
        session_id=session_id,
        transcript_turns=req.transcript,
        experience_metrics=req.experience_metrics
    )
    return {"status": "success", "session_id": session_id, "transcript": req.transcript}

@router.post("/api/interviews/sessions/{session_id}/complete")
@router.post("/api/interview/sessions/{session_id}/complete")
def complete_interview(
    session_id: str,
    req: CompleteInterviewRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    uid = user["id"] if user else None
    sess = interview_repository.get_session(session_id, user_id=uid)
    if not sess:
        raise HTTPException(status_code=404, detail="Interview session not found")

    # If transcript passed in request, update it
    current_transcript = req.transcript if req.transcript is not None else sess.get("transcript", [])
    current_metrics = req.experience_metrics if req.experience_metrics is not None else sess.get("experience_metrics", {})
    if req.transcript is not None:
        interview_repository.update_transcript(session_id, current_transcript, current_metrics)

    # Evaluate interview
    evaluation = evaluate_interview_session(
        interview_type=sess.get("interview_type", "General Interview"),
        language=sess.get("language", "en"),
        transcript=current_transcript,
        experience_metrics=current_metrics
    )

    duration = req.duration or req.duration_seconds
    completed_session = interview_repository.complete_session(
        session_id=session_id,
        evaluation=evaluation,
        duration_seconds=duration,
        experience_metrics=current_metrics
    )
    return completed_session

@router.get("/api/debug/interview/{session_id}/prompt")
async def debug_interview_prompt(session_id: str):
    """Debug endpoint returning the composed interview prompt with sanitized resume & JD character counts."""
    from backend.routes.websocket_routes import load_prompt_for_mode
    from backend.services.interview_blueprint import generate_interview_blueprint, format_blueprint_for_prompt

    sess = interview_repository.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Interview session not found")

    metrics = sess.get("experience_metrics") or {}
    job_role = metrics.get("job_role") or "Software Engineer"
    experience_level = metrics.get("experience_level") or "Standard"
    interview_type = sess.get("interview_type") or "Technical & Coding"
    difficulty = metrics.get("difficulty") or "Medium"
    job_description = metrics.get("job_description") or ""
    resume_context = metrics.get("resume_context") or {}
    language = sess.get("language") or "en"

    blueprint = await generate_interview_blueprint(
        role=job_role,
        level=experience_level,
        interview_type=interview_type,
        resume_profile=resume_context,
        jd_text=job_description
    )
    blueprint_prompt = format_blueprint_for_prompt(blueprint)

    composed_prompt = load_prompt_for_mode(
        mode="ai-interview",
        conv_id=None,
        language=language,
        interview_type=interview_type,
        job_role=job_role,
        experience_level=experience_level,
        difficulty=difficulty,
        job_description=f"[Job Description sanitized: {len(job_description)} chars]",
        resume_context={"sanitized_summary": f"[Resume context sanitized: {len(str(resume_context))} chars]"},
        blueprint_prompt=blueprint_prompt
    )

    return {
        "session_id": session_id,
        "job_role": job_role,
        "experience_level": experience_level,
        "interview_type": interview_type,
        "language": language,
        "composed_prompt": composed_prompt,
        "blueprint": blueprint.model_dump()
    }

