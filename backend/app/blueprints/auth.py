"""
Auth Blueprint
==============
 /api/v1/auth/register
 /api/v1/auth/login
 /api/v1/auth/refresh
 /api/v1/auth/me
 /api/v1/auth/logout
 /api/v1/auth/forgot-password
 /api/v1/auth/change-password
"""
from flask import Blueprint, request, g, current_app
from app.extensions import db, limiter
from app.models.user import User, RoleEnum
from app.services.auth_service import (
    authenticate_user, register_user, generate_access_token,
    generate_refresh_token, refresh_access_token, get_user_from_token,
    log_activity,
)
from app.utils.errors import ValidationError, AuthenticationError, NotFoundError
from app.utils.logger import logger
from ._shared import auth_required

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("5 per minute")
def register():
    data = request.get_json() or {}
    required = ["username", "email", "password"]
    for field in required:
        if not data.get(field):
            raise ValidationError(f"Field '{field}' is required.")
    user = register_user(
        username=data["username"],
        email=data["email"],
        password=data["password"],
        full_name=data.get("full_name"),
        role=data.get("role", "viewer"),
    )
    access = generate_access_token(user)
    refresh = generate_refresh_token(user)
    log_activity(user.id, "register", "user", user.id, "User registered")
    return {
        "success": True,
        "message": "User registered successfully.",
        "data": {
            "user": user.to_dict(),
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "Bearer",
        },
    }, 201


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    data = request.get_json() or {}
    if not data.get("username") or not data.get("password"):
        raise ValidationError("Username and password are required.")
    user, access, refresh = authenticate_user(data["username"], data["password"])
    log_activity(user.id, "login", "user", user.id, "User logged in",
                 ip_address=request.remote_addr)
    return {
        "success": True,
        "message": "Login successful.",
        "data": {
            "user": user.to_dict(),
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "Bearer",
            "expires_in": int(current_app.config["JWT_ACCESS_TOKEN_EXPIRES"].total_seconds()),
        },
    }


@auth_bp.route("/refresh", methods=["POST"])
@limiter.limit("30 per hour")
def refresh():
    data = request.get_json() or {}
    refresh_token = data.get("refresh_token")
    if not refresh_token:
        raise ValidationError("refresh_token is required.")
    access, new_refresh = refresh_access_token(refresh_token)
    return {
        "success": True,
        "data": {
            "access_token": access,
            "refresh_token": new_refresh,
            "token_type": "Bearer",
        },
    }


@auth_bp.route("/me", methods=["GET"])
@auth_required()
def me():
    return {"success": True, "data": g.current_user.to_dict()}


@auth_bp.route("/logout", methods=["POST"])
@auth_required()
def logout():
    log_activity(g.current_user.id, "logout", "user", g.current_user.id, "User logged out")
    return {"success": True, "message": "Logged out successfully."}


@auth_bp.route("/change-password", methods=["POST"])
@auth_required()
def change_password():
    data = request.get_json() or {}
    if not data.get("current_password") or not data.get("new_password"):
        raise ValidationError("current_password and new_password are required.")
    user = g.current_user
    if not user.check_password(data["current_password"]):
        raise AuthenticationError("Current password is incorrect.")
    if len(data["new_password"]) < 8:
        raise ValidationError("New password must be at least 8 characters.")
    user.set_password(data["new_password"])
    db.session.commit()
    log_activity(user.id, "change_password", "user", user.id, "Password changed")
    return {"success": True, "message": "Password updated successfully."}


@auth_bp.route("/forgot-password", methods=["POST"])
@limiter.limit("3 per hour")
def forgot_password():
    data = request.get_json() or {}
    email = data.get("email")
    if not email:
        raise ValidationError("email is required.")
    user = User.query.filter_by(email=email).first()
    # Always return success to prevent email enumeration
    if user:
        logger.info(f"Password reset requested for {email}")
    return {
        "success": True,
        "message": "If the email exists, a reset link has been sent.",
    }
