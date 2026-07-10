"""
Authentication Service
======================
JWT issuance, verification, password validation, role checks.
"""
import jwt
import datetime as dt
from typing import Optional, Dict, Any, Tuple
from flask import current_app
from werkzeug.security import check_password_hash

from app.extensions import db
from app.models.user import User, RoleEnum
from app.utils.errors import (
    AuthenticationError, AuthorizationError, ValidationError, NotFoundError,
)
from app.utils.logger import logger
from app.models.system_log import ActivityLog


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def generate_access_token(user: User) -> str:
    """Generate a short-lived JWT access token."""
    now = _utcnow()
    expires_in = current_app.config["JWT_ACCESS_TOKEN_EXPIRES"]
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role.value,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + expires_in).timestamp()),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")


def generate_refresh_token(user: User) -> str:
    """Generate a long-lived JWT refresh token."""
    now = _utcnow()
    expires_in = current_app.config["JWT_REFRESH_TOKEN_EXPIRES"]
    payload = {
        "sub": str(user.id),
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int((now + expires_in).timestamp()),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")


def decode_token(token: str) -> Dict[str, Any]:
    """Decode & validate a JWT. Raises AuthenticationError on failure."""
    try:
        payload = jwt.decode(
            token, current_app.config["JWT_SECRET_KEY"], algorithms=["HS256"]
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token has expired.")
    except jwt.InvalidTokenError:
        raise AuthenticationError("Invalid token.")


def authenticate_user(username_or_email: str, password: str) -> Tuple[User, str, str]:
    """Authenticate user -> return (user, access_token, refresh_token)."""
    user = User.query.filter(
        (User.username == username_or_email) | (User.email == username_or_email)
    ).first()
    if not user or not user.check_password(password):
        raise AuthenticationError("Invalid credentials.")
    if not user.is_active:
        raise AuthenticationError("Account is deactivated.")

    user.last_login_at = _utcnow()
    user.failed_login_count = 0
    db.session.commit()

    access = generate_access_token(user)
    refresh = generate_refresh_token(user)
    logger.info(f"User authenticated: {user.username}")
    return user, access, refresh


def register_user(
    username: str,
    email: str,
    password: str,
    full_name: Optional[str] = None,
    role: str = "viewer",
) -> User:
    """Register a new user."""
    if User.query.filter((User.username == username) | (User.email == email)).first():
        raise ValidationError("Username or email already exists.")
    if len(password) < 8:
        raise ValidationError("Password must be at least 8 characters long.")

    try:
        role_enum = RoleEnum(role)
    except ValueError:
        raise ValidationError(f"Invalid role: {role}. Must be admin/researcher/viewer.")

    user = User(
        username=username,
        email=email,
        full_name=full_name,
        role=role_enum,
        is_active=True,
        is_verified=False,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    logger.info(f"User registered: {username} (role={role})")
    return user


def get_user_from_token(token: str) -> User:
    """Decode token and return the User object."""
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise AuthenticationError("Wrong token type.")
    user_id = int(payload["sub"])
    user = User.query.get(user_id)
    if not user or not user.is_active:
        raise AuthenticationError("User not found or inactive.")
    return user


def refresh_access_token(refresh_token: str) -> Tuple[str, str]:
    """Issue a new access token from a refresh token."""
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise AuthenticationError("Not a refresh token.")
    user_id = int(payload["sub"])
    user = User.query.get(user_id)
    if not user or not user.is_active:
        raise AuthenticationError("User not found or inactive.")
    return generate_access_token(user), generate_refresh_token(user)


def require_role(user: User, *allowed_roles: str) -> None:
    """Raise AuthorizationError if user's role is not allowed."""
    if user.role.value not in allowed_roles:
        raise AuthorizationError(
            f"Role '{user.role.value}' is not allowed. Required: {', '.join(allowed_roles)}"
        )


def log_activity(
    user_id: Optional[int],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    description: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    status: str = "success",
    metadata: Optional[Dict] = None,
) -> None:
    """Record an activity log entry."""
    try:
        log = ActivityLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            status=status,
            metadata_json=metadata or {},
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        logger.warning(f"Failed to log activity: {e}")
        db.session.rollback()
