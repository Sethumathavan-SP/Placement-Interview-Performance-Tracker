import os
import uuid
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

SECURE_COOKIES = os.getenv("SECURE_COOKIES", "false").lower() == "true"


def create_access_token(user_data: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_data["uuid"],
        "gmail": user_data["gmail"],
        "role": user_data["role"],
        "department": user_data.get("department") or "CSE",
        "type": "access",
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_data: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_data["uuid"],
        "gmail": user_data["gmail"],
        "role": user_data["role"],
        "department": user_data.get("department") or "CSE",
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_password_reset_token(user_data: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_data["uuid"],
        "gmail": user_data["gmail"],
        "type": "password_reset",
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_csrf_token() -> str:
    return secrets.token_hex(32)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(token)
    if payload["type"] != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    from db import is_token_blacklisted
    if is_token_blacklisted(payload["jti"]):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    return {
        "uuid": payload["sub"],
        "gmail": payload["gmail"],
        "role": payload["role"],
        "department": payload.get("department", "CSE"),
    }


def require_role(*allowed_roles):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker


class CSRFMiddleware(BaseHTTPMiddleware):
    EXEMPT_PATHS = {"/api/login", "/api/refresh", "/api/password-reset/request", "/api/password-reset/confirm"}

    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            if request.url.path not in self.EXEMPT_PATHS:
                csrf_cookie = request.cookies.get("csrf_token")
                csrf_header = request.headers.get("X-CSRF-Token")
                if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "CSRF validation failed"},
                    )
        return await call_next(request)
