from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from backend.repositories.conversation_repository import conversation_repository
from backend.utils.auth_deps import get_current_user_optional

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

class CreateConversationRequest(BaseModel):
    feature: str = "chat"
    mode: str = "general"
    language: str = "en"
    title: Optional[str] = None

class UpdateTitleRequest(BaseModel):
    title: str

@router.get("")
def list_conversations(
    q: Optional[str] = Query(None, description="Search term for title or content"),
    feature: Optional[str] = Query(None, description="Filter by feature ID"),
    feature_id: Optional[str] = Query(None, description="Filter by feature ID alias"),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    selected_feature = feature or feature_id
    user_id = user["id"] if user else ""
    return conversation_repository.list_conversations(
        feature=selected_feature,
        query=q,
        user_id=user_id
    )

@router.post("")
def create_conversation(
    req: CreateConversationRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    user_id = user["id"] if user else ""
    return conversation_repository.create_conversation(
        feature=req.feature,
        mode=req.mode,
        language=req.language,
        title=req.title,
        user_id=user_id
    )

@router.get("/{conv_id}")
def get_conversation(
    conv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    user_id = user["id"] if user else None
    conv = conversation_repository.get_conversation(conv_id, user_id=user_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

@router.patch("/{conv_id}")
def rename_conversation(
    conv_id: str,
    req: UpdateTitleRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    user_id = user["id"] if user else None
    success = conversation_repository.update_title(conv_id, req.title, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found or rename failed")
    return {"status": "success", "title": req.title}

class FavoriteRequest(BaseModel):
    is_favorite: Optional[bool] = None

@router.post("/{conv_id}/favorite")
@router.patch("/{conv_id}/favorite")
def toggle_favorite(
    conv_id: str,
    req: Optional[FavoriteRequest] = None,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    requested_state = req.is_favorite if req else None
    user_id = user["id"] if user else None
    result = conversation_repository.toggle_favorite(conv_id, requested_state, user_id=user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return result

@router.delete("/{conv_id}")
def delete_conversation(
    conv_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    user_id = user["id"] if user else None
    success = conversation_repository.delete_conversation(conv_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "success", "id": conv_id}
