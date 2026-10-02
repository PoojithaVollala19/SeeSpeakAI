import os
import uuid
import shutil
from typing import Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from backend.repositories.conversation_repository import conversation_repository, normalize_feature_id
from backend.utils.logging import logger

router = APIRouter(prefix="/api/upload", tags=["upload"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Strict allowed extensions by workspace feature
FEATURE_ALLOWED_EXTENSIONS = {
    "document-analysis": [".pdf", ".docx", ".doc", ".txt", ".md"],
    "visual-intelligence": [".jpg", ".jpeg", ".png", ".webp", ".svg", ".txt", ".md"],
    "video-audio-review": [".mp4", ".mov", ".webm", ".mp3", ".wav", ".m4a", ".ogg"],
    "data-study": [".csv", ".xlsx", ".xls", ".json", ".pdf", ".txt", ".docx"],
}

FEATURE_FRIENDLY_NAMES = {
    "document-analysis": "Document Analysis (PDF, DOCX, TXT)",
    "visual-intelligence": "Visual Intelligence (JPG, PNG, WEBP)",
    "video-audio-review": "Video & Audio Review (MP4, MOV, WEBM, MP3, WAV, M4A)",
    "data-study": "Data & Study Assistant (CSV, XLSX, JSON, PDF, TXT)",
}

from backend.utils.auth_deps import get_current_user_optional
from fastapi import Depends

@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    conversation_id: Optional[str] = Form(None),
    feature: Optional[str] = Form("document"),
    language: Optional[str] = Form("en"),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Empty filename provided")

    canonical_feature = normalize_feature_id(feature)
    ext = os.path.splitext(file.filename)[1].lower()

    # Feature-specific format validation
    allowed_exts = FEATURE_ALLOWED_EXTENSIONS.get(canonical_feature)
    if allowed_exts and ext not in allowed_exts:
        friendly = FEATURE_FRIENDLY_NAMES.get(canonical_feature, canonical_feature)
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}' for {friendly}. Please upload only supported formats: {', '.join(allowed_exts)}"
        )

    user_id = user["id"] if user else ""

    # If no conversation exists yet, create one for this upload
    if not conversation_id or conversation_id.strip() == "":
        conv = conversation_repository.create_conversation(
            feature=canonical_feature,
            mode="general",
            language=language or "en",
            user_id=user_id
        )
        conversation_id = conv["id"]
        conversation_repository.generate_smart_title(conversation_id, filename=file.filename)
    else:
        existing = conversation_repository.get_conversation(conversation_id)
        if not existing:
            conv = conversation_repository.create_conversation(
                feature=canonical_feature,
                mode="general",
                language=language or "en",
                user_id=user_id
            )
            conversation_id = conv["id"]
        if existing and existing.get("title") in ["New Conversation", "Conversation"]:
            conversation_repository.generate_smart_title(conversation_id, filename=file.filename)

    # Save file to uploads directory
    safe_name = f"{uuid.uuid4().hex[:10]}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_size = os.path.getsize(file_path)
    except Exception as e:
        logger.error(f"Error saving uploaded file {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    mime_type = file.content_type or "application/octet-stream"

    # Extract metadata (page count for PDF, row count for CSV, etc.)
    page_count = None
    row_count = None
    if ext == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            page_count = len(reader.pages)
        except Exception:
            pass
    elif ext == ".csv":
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as cf:
                row_count = sum(1 for _ in cf) - 1
        except Exception:
            pass

    # Add file reference to DB with explicit feature scope
    file_record = conversation_repository.add_file(
        conv_id=conversation_id,
        filename=file.filename,
        file_path=file_path,
        mime_type=mime_type,
        size_bytes=file_size,
        feature=canonical_feature
    )

    if page_count is not None:
        file_record["page_count"] = page_count
    if row_count is not None:
        file_record["row_count"] = max(0, row_count)
    file_record["status"] = "ready"
    file_record["url"] = f"/uploads/{safe_name}"

    logger.info(f"File uploaded successfully: {file.filename} ({file_size} bytes, feature={canonical_feature}) -> {file_path}")
    return file_record

@router.delete("/{file_id}")
def delete_file(file_id: str):
    file_rec = conversation_repository.get_file(file_id)
    if not file_rec:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = file_rec.get("file_path")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            logger.warning(f"Failed to delete file from disk: {e}")

    deleted = conversation_repository.delete_file(file_id)
    return {"status": "deleted", "file_id": file_id, "success": True}
