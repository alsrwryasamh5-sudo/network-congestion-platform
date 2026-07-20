"""
Custom Exception Classes & Error Handlers
==========================================
"""
from typing import Any, Dict, Optional
from flask import jsonify


class AppError(Exception):
    """Base application error."""

    status_code: int = 400
    error_code: str = "APP_ERROR"
    message: str = "An application error occurred."

    def __init__(
        self,
        message: Optional[str] = None,
        status_code: Optional[int] = None,
        error_code: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message or self.message)
        if message is not None:
            self.message = message
        if status_code is not None:
            self.status_code = status_code
        if error_code is not None:
            self.error_code = error_code
        self.payload = payload or {}

    def to_dict(self) -> Dict[str, Any]:
        body = {
            "success": False,
            "error": {
                "code": self.error_code,
                "message": self.message,
            },
        }
        if self.payload:
            body["error"]["details"] = self.payload
        return body


class ValidationError(AppError):
    status_code = 422
    error_code = "VALIDATION_ERROR"
    message = "Input validation failed."


class AuthenticationError(AppError):
    status_code = 401
    error_code = "AUTHENTICATION_ERROR"
    message = "Authentication required."


class AuthorizationError(AppError):
    status_code = 403
    error_code = "AUTHORIZATION_ERROR"
    message = "Insufficient permissions."


class NotFoundError(AppError):
    status_code = 404
    error_code = "NOT_FOUND"
    message = "Resource not found."


class ConflictError(AppError):
    status_code = 409
    error_code = "CONFLICT"
    message = "Resource conflict."


class RateLimitExceededError(AppError):
    status_code = 429
    error_code = "RATE_LIMIT_EXCEEDED"
    message = "Too many requests."


class ModelNotReadyError(AppError):
    status_code = 503
    error_code = "MODEL_NOT_READY"
    message = "ML model is not loaded. Please train or upload a model first."


def register_error_handlers(app):
    """Register error handlers on the Flask app."""

    @app.errorhandler(AppError)
    def handle_app_error(err: AppError):
        return jsonify(err.to_dict()), err.status_code

    @app.errorhandler(400)
    def handle_bad_request(err):
        return jsonify({
            "success": False,
            "error": {"code": "BAD_REQUEST", "message": str(err)},
        }), 400

    @app.errorhandler(401)
    def handle_unauthorized(err):
        return jsonify({
            "success": False,
            "error": {"code": "UNAUTHORIZED", "message": "Authentication required."},
        }), 401

    @app.errorhandler(403)
    def handle_forbidden(err):
        return jsonify({
            "success": False,
            "error": {"code": "FORBIDDEN", "message": "Access denied."},
        }), 403

    @app.errorhandler(404)
    def handle_not_found(err):
        return jsonify({
            "success": False,
            "error": {"code": "NOT_FOUND", "message": "Resource not found."},
        }), 404

    @app.errorhandler(429)
    def handle_rate_limit(err):
        return jsonify({
            "success": False,
            "error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests. Slow down."},
        }), 429

    @app.errorhandler(500)
    def handle_server_error(err):
        app.logger.exception("Unhandled server error")
        return jsonify({
            "success": False,
            "error": {"code": "INTERNAL_ERROR", "message": "Internal server error."},
        }), 500

    @app.errorhandler(Exception)
    def handle_unexpected(err):
        app.logger.exception("Unexpected exception")
        # Rollback any failed database transaction
        try:
            from app.extensions import db
            db.session.rollback()
        except Exception:
            pass
        return jsonify({
            "success": False,
            "error": {
                "code": "UNEXPECTED_ERROR",
                "message": "An unexpected error occurred.",
                "detail": str(err)[:200] if app.debug else None,
            },
        }), 500
