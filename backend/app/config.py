"""
Application Configuration
=========================
 Centralized configuration management using environment variables.
 All secrets must come from env vars - NEVER hardcode.
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

# backend/ directory (parent of app/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Config:
    """Base configuration."""

    # --- App ---
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    APP_NAME = "Network Congestion Detection Platform"
    APP_VERSION = "1.0.0"
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    DEBUG = os.getenv("DEBUG", "False").lower() == "true"

    # --- Database ---
    POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB = os.getenv("POSTGRES_DB", "congestion_db")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Note: pool_size/max_overflow only valid for PostgreSQL/MySQL, not SQLite
    SQLALCHEMY_ENGINE_OPTIONS = (
        {
            "pool_pre_ping": True,
            "pool_recycle": 280,
            "pool_size": 10,
            "max_overflow": 20,
        }
        if os.getenv("DATABASE_URL", "").startswith("postgresql")
        else {"pool_pre_ping": True}
    )

    # --- JWT ---
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        minutes=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "60"))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "30"))
    )

    # --- Redis / Cache ---
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CACHE_TYPE = os.getenv("CACHE_TYPE", "SimpleCache")
    CACHE_REDIS_URL = REDIS_URL
    CACHE_DEFAULT_TIMEOUT = 300

    # --- Rate Limiting ---
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_DEFAULT = os.getenv("RATELIMIT_DEFAULT", "200 per hour")

    # --- ML Artifacts ---
    ML_ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
    MODEL_PATH = os.path.join(ML_ARTIFACTS_DIR, "stacking_model.joblib")
    SCALER_PATH = os.path.join(ML_ARTIFACTS_DIR, "scaler.joblib")
    ISO_MODEL_PATH = os.path.join(ML_ARTIFACTS_DIR, "iso_model.joblib")
    ISO_SCALER_PATH = os.path.join(ML_ARTIFACTS_DIR, "iso_scaler.joblib")
    BASELINE_STATS_PATH = os.path.join(ML_ARTIFACTS_DIR, "baseline_stats.joblib")
    FEATURE_COLUMNS_PATH = os.path.join(ML_ARTIFACTS_DIR, "feature_columns.joblib")
    SHAP_EXPLAINER_PATH = os.path.join(ML_ARTIFACTS_DIR, "shap_explainer.joblib")

    # --- Kaggle ---
    KAGGLE_API_TOKEN = os.getenv("KAGGLE_API_TOKEN", "")
    KAGGLE_DATASET = os.getenv("KAGGLE_DATASET", "ndayisabae/nf-unsw-nb15-v3")

    # --- CORS ---
    CORS_ORIGINS = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
    ).split(",")

    # --- Pagination ---
    DEFAULT_PAGE_SIZE = int(os.getenv("DEFAULT_PAGE_SIZE", "20"))
    MAX_PAGE_SIZE = int(os.getenv("MAX_PAGE_SIZE", "100"))

    # --- Logging ---
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"


class DevelopmentConfig(Config):
    DEBUG = True
    ENVIRONMENT = "development"


class ProductionConfig(Config):
    DEBUG = False
    ENVIRONMENT = "production"


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    DEBUG = True


config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config():
    env = os.getenv("FLASK_ENV", "development")
    return config_map.get(env, DevelopmentConfig)
