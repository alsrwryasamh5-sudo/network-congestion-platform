"""
Application Factory
===================
 Creates and configures the Flask application.
"""
import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

from app.config import get_config
from app.extensions import db, cache, cors, limiter
from app.utils.errors import register_error_handlers
from app.utils.logger import logger, setup_logger
from app.blueprints import auth_bp, ml_bp, dashboard_bp, reports_bp, admin_bp, system_bp, ingest_bp, devices_bp


def create_app(config_name: str = None) -> Flask:
    """Application factory."""
    load_dotenv()
    app = Flask(__name__)
    config = get_config()
    app.config.from_object(config)

    # Override config name if specified
    if config_name:
        from app.config import config_map
        app.config.from_object(config_map[config_name])

    # Adjust engine options based on actual URI (SQLite doesn't support pool_size)
    uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if uri.startswith("sqlite"):
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}
    else:
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
            "pool_pre_ping": True,
            "pool_recycle": 280,
            "pool_size": 10,
            "max_overflow": 20,
        }

    # --- Extensions ---
    db.init_app(app)
    cache.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}}, supports_credentials=True)
    limiter.init_app(app)

    # --- Logger ---
    setup_logger(level=app.config["LOG_LEVEL"])

    # --- Blueprints ---
    app.register_blueprint(auth_bp)
    app.register_blueprint(ml_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(system_bp)
    app.register_blueprint(ingest_bp)
    app.register_blueprint(devices_bp)

    # --- Error handlers ---
    register_error_handlers(app)

    # --- Request logging ---
    @app.before_request
    def log_request():
        logger.info(
            f"{request.method} {request.path} from {request.remote_addr}",
            extra={"path": request.path, "method": request.method},
        )

    # --- Health check at root ---
    @app.route("/api", methods=["GET"])
    @app.route("/api/v1", methods=["GET"])
    def api_root():
        return jsonify({
            "service": "Network Congestion Detection Platform",
            "version": app.config["APP_VERSION"],
            "docs": "/api/v1/system/health",
            "endpoints": [
                "/api/v1/auth/*",
                "/api/v1/ml/*",
                "/api/v1/dashboard/*",
                "/api/v1/reports/*",
                "/api/v1/admin/*",
                "/api/v1/system/*",
            ],
        })

    # --- Serve React frontend (SPA) ---
    import os as _os
    # Try multiple candidate paths (works for both local dev and Docker)
    candidate_paths = [
        "/frontend/dist",  # Docker production path
        _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), "..", "frontend", "dist")),  # Local dev
        _os.path.abspath(_os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), "frontend", "dist")),  # Backend-only
    ]
    frontend_dist = None
    for path in candidate_paths:
        if _os.path.exists(path):
            frontend_dist = path
            break

    if frontend_dist:
        from flask import send_from_directory

        @app.route("/", methods=["GET"])
        def index():
            return send_from_directory(frontend_dist, "index.html")

        @app.route("/<path:path>", methods=["GET"])
        def serve_static(path):
            # Don't intercept API requests
            if path.startswith("api/"):
                return jsonify({"error": "Not found", "path": path}), 404
            full = _os.path.join(frontend_dist, path)
            if _os.path.exists(full):
                return send_from_directory(frontend_dist, path)
            # SPA fallback - return index.html for client-side routing
            return send_from_directory(frontend_dist, "index.html")

        logger.info(f"Serving React frontend from {frontend_dist}")
    else:
        logger.warning("Frontend dist not found. Backend will serve API only.")

    # --- Create tables (development convenience) ---
    with app.app_context():
        try:
            db.create_all()
            logger.info("Database tables ensured.")
            # Seed default admin if no users exist
            from app.models.user import User, RoleEnum
            if User.query.count() == 0:
                admin = User(
                    username="admin",
                    email="admin@congestion.local",
                    full_name="System Administrator",
                    role=RoleEnum.ADMIN,
                    is_active=True,
                    is_verified=True,
                )
                admin.set_password("admin12345")
                db.session.add(admin)
                db.session.commit()
                logger.info("Default admin user created: admin / admin12345")
        except Exception as e:
            logger.warning(f"DB init skipped: {e}")

    # --- Preload ML service (auto-train in background if no artifacts exist) ---
    # NOTE: Auto-training is deferred to first request to avoid blocking startup
    # (Render's health check times out if the server takes too long to boot)
    with app.app_context():
        try:
            from app.services.ml_service import get_ml_service
            svc = get_ml_service()
            if svc.load():
                logger.info("ML model loaded at startup.")
            else:
                logger.warning("ML model not available. Will auto-train on first /api/v1/ml/* request.")
        except Exception as e:
            logger.warning(f"ML model preload failed: {e}")

    logger.info(f"App created: {app.config['APP_NAME']} v{app.config['APP_VERSION']}")
    return app
