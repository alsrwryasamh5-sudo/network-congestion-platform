"""
Shared decorators & helpers
"""
from functools import wraps
from typing import Optional, List, Tuple
from flask import request, g, current_app
from app.services.auth_service import get_user_from_token, require_role, log_activity
from app.utils.errors import AuthenticationError, AuthorizationError


def get_bearer_token() -> Optional[str]:
    """Extract Bearer token from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def auth_required(roles: Optional[Tuple[str, ...]] = None):
    """Decorator: require a valid JWT. Optionally restrict to roles."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            token = get_bearer_token()
            if not token:
                raise AuthenticationError("Missing Authorization header.")
            user = get_user_from_token(token)
            if roles:
                require_role(user, *roles)
            g.current_user = user
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def audit_action(action: str, resource_type: Optional[str] = None):
    """Decorator: log the API call as an activity entry."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = getattr(g, "current_user", None)
            try:
                result = fn(*args, **kwargs)
                log_activity(
                    user_id=user.id if user else None,
                    action=action,
                    resource_type=resource_type,
                    description=f"{request.method} {request.path}",
                    ip_address=request.remote_addr,
                    user_agent=request.headers.get("User-Agent", "")[:500],
                    status="success",
                )
                return result
            except Exception as e:
                log_activity(
                    user_id=user.id if user else None,
                    action=action,
                    resource_type=resource_type,
                    description=f"{request.method} {request.path} -> {type(e).__name__}",
                    ip_address=request.remote_addr,
                    user_agent=request.headers.get("User-Agent", "")[:500],
                    status="failure",
                )
                raise

        return wrapper

    return decorator


def paginated(model_query, schema_fn, page: int = 1, per_page: int = 20):
    """Apply pagination to a SQLAlchemy query."""
    page = max(1, page)
    per_page = min(max(1, per_page), 100)
    result = model_query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "items": [schema_fn(item) for item in result.items],
        "pagination": {
            "page": result.page,
            "per_page": result.per_page,
            "total": result.total,
            "pages": result.pages,
            "has_next": result.has_next,
            "has_prev": result.has_prev,
        },
    }
