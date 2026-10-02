import re
from typing import Optional, Dict, Any
from fastapi import Request, Header, HTTPException, Depends
from backend.repositories.user_repository import user_repository
from backend.utils.logging import logger

def extract_token_from_request(request: Request, authorization: Optional[str] = None) -> Optional[str]:
    """Extracts bearer token from Authorization header or cookie."""
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    cookie_token = request.cookies.get("seespeak_auth_token")
    if cookie_token:
        return cookie_token.strip()
    return None

def get_current_user_optional(
    request: Request,
    authorization: Optional[str] = Header(None)
) -> Optional[Dict[str, Any]]:
    """Returns authenticated user dictionary if valid session exists; otherwise returns None."""
    token = extract_token_from_request(request, authorization)
    if not token:
        return None
    try:
        user = user_repository.get_user_by_session_token(token)
        return user
    except Exception as e:
        logger.warning(f"[AUTH_DEPS] Error verifying session token: {e}")
        return None

def get_current_user_required(
    request: Request,
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """Requires an authenticated user session; raises 401 if unauthenticated or expired."""
    user = get_current_user_optional(request, authorization)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please log in to access this resource."
        )
    return user
