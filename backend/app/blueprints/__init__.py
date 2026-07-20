"""Blueprints package."""
from .auth import auth_bp
from .ml import ml_bp
from .dashboard import dashboard_bp
from .reports import reports_bp
from .admin import admin_bp
from .system import system_bp
from .ingest import ingest_bp

__all__ = ["auth_bp", "ml_bp", "dashboard_bp", "reports_bp", "admin_bp", "system_bp", "ingest_bp"]
