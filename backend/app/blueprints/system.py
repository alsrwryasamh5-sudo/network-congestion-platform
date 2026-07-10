"""
System Blueprint
=================
 /api/v1/system/health
 /api/v1/system/info
 /api/v1/system/version
"""
import os
import psutil
import platform
from datetime import datetime, timezone
from flask import Blueprint, request, g, current_app
from app.extensions import db
from app.models.user import User
from app.models.prediction import Prediction
from app.models.congestion_event import CongestionEvent
from app.services.ml_service import get_ml_service
from ._shared import auth_required

system_bp = Blueprint("system", __name__, url_prefix="/api/v1/system")


@system_bp.route("/health", methods=["GET"])
def health():
    """Public health check."""
    ml = get_ml_service()
    return {
        "success": True,
        "data": {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "network-congestion-api",
            "version": current_app.config.get("APP_VERSION", "1.0.0"),
            "ml_model_loaded": ml.is_ready,
            "database": _check_db(),
        },
    }


@system_bp.route("/info", methods=["GET"])
@auth_required()
def info():
    ml = get_ml_service()
    return {
        "success": True,
        "data": {
            "app_name": current_app.config["APP_NAME"],
            "version": current_app.config["APP_VERSION"],
            "environment": current_app.config["ENVIRONMENT"],
            "python_version": platform.python_version(),
            "platform": platform.platform(),
            "cpu_count": os.cpu_count(),
            "cpu_percent": psutil.cpu_percent(interval=0.5),
            "memory_total_gb": round(psutil.virtual_memory().total / (1024 ** 3), 2),
            "memory_percent": psutil.virtual_memory().percent,
            "ml_model_ready": ml.is_ready,
            "feature_count": len(ml.feature_columns),
        },
    }


@system_bp.route("/version", methods=["GET"])
def version():
    return {
        "success": True,
        "data": {
            "api_version": "v1",
            "app_version": current_app.config["APP_VERSION"],
            "build_date": "2026-01-01",
        },
    }


@system_bp.route("/stats", methods=["GET"])
@auth_required()
def stats():
    """Platform-wide statistics."""
    return {
        "success": True,
        "data": {
            "users": User.query.count(),
            "predictions": Prediction.query.count(),
            "congestion_events": CongestionEvent.query.count(),
            "active_events": CongestionEvent.query.filter_by(status="active").count(),
            "uptime_seconds": int(psutil.Process().create_time() - psutil.boot_time()),
        },
    }


def _check_db() -> str:
    try:
        db.session.execute(db.text("SELECT 1"))
        return "connected"
    except Exception:
        return "disconnected"
