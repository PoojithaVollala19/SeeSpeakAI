import re
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Header, Request, status, Response
from pydantic import BaseModel
from backend.repositories.user_repository import user_repository
from backend.utils.logging import logger

router = APIRouter(prefix="/api/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

def extract_token_from_request(request: Request, authorization: Optional[str] = None) -> Optional[str]:
    """Extracts bearer token from Authorization header or cookie."""
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    cookie_token = request.cookies.get("seespeak_auth_token")
    if cookie_token:
        return cookie_token.strip()
    return None

@router.post("/register")
def register(req: RegisterRequest, response: Response):
    """Registers a new user account, creates a session, and returns auth token."""
    clean_name = req.name.strip()
    clean_email = req.email.strip().lower()
    clean_pw = req.password

    if not clean_name:
        raise HTTPException(status_code=400, detail="Full name is required.")
    if not clean_email or "@" not in clean_email or not re.match(r"[^@]+@[^@]+\.[^@]+", clean_email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if len(clean_pw) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    try:
        user = user_repository.create_user(name=clean_name, email=clean_email, password=clean_pw)
        session_token = user_repository.create_session(user["id"])

        # Also set HTTP-only cookie for enhanced browser security
        response.set_cookie(
            key="seespeak_auth_token",
            value=session_token,
            max_age=14 * 24 * 3600,
            httponly=True,
            samesite="lax",
            secure=False # Set to False for local development
        )

        return {
            "success": True,
            "user": user,
            "token": session_token
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[AUTH] Registration error: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while creating your account. Please try again.")

@router.post("/login")
def login(req: LoginRequest, response: Response):
    """Validates user credentials, creates a session, and returns user details and token."""
    clean_email = req.email.strip().lower()
    clean_pw = req.password

    if not clean_email or not clean_pw:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    user = user_repository.authenticate_user(email=clean_email, password=clean_pw)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    session_token = user_repository.create_session(user["id"])

    response.set_cookie(
        key="seespeak_auth_token",
        value=session_token,
        max_age=14 * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=False
    )

    return {
        "success": True,
        "user": user,
        "token": session_token
    }

@router.post("/logout")
def logout(request: Request, response: Response, authorization: Optional[str] = Header(None)):
    """Logs out user by invalidating the active session token and clearing cookies."""
    token = extract_token_from_request(request, authorization)
    if token:
        user_repository.delete_session(token)

    response.delete_cookie("seespeak_auth_token")
    return {"success": True, "message": "Logged out successfully."}

@router.get("/me")
def get_current_user(request: Request, authorization: Optional[str] = Header(None)):
    """Returns profile for currently authenticated user; returns 401 if unauthenticated/expired."""
    token = extract_token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    user = user_repository.get_user_by_session_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")

    return {
        "success": True,
        "user": user
    }

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    """Generates a secure password reset token for valid email."""
    clean_email = req.email.strip().lower()
    if not clean_email:
        raise HTTPException(status_code=400, detail="Email is required.")

    reset_token = user_repository.create_password_reset(clean_email)
    # Always return a generic success message so attacker cannot enumerate existing emails
    return {
        "success": True,
        "message": "If an account exists with this email, password reset instructions have been generated.",
        # Provide token in dev/demo response so user can test reset flow immediately without email server
        "reset_token": reset_token
    }

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    """Resets user password with valid reset token."""
    clean_pw = req.password
    clean_token = req.token.strip()

    if not clean_token:
        raise HTTPException(status_code=400, detail="Reset token is required.")
    if len(clean_pw) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    try:
        success = user_repository.reset_password(token=clean_token, new_password=clean_pw)
        if not success:
            raise HTTPException(status_code=400, detail="Invalid or expired password reset token.")
        return {
            "success": True,
            "message": "Password has been updated successfully. Please log in with your new password."
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[AUTH] Reset password error: {e}")
        raise HTTPException(status_code=500, detail="Could not update password. Please try again.")
