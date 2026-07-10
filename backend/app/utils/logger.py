"""
Structured Logging Utility
==========================
 Provides consistent JSON-structured logging across the app.
"""
import logging
import os
import sys
from datetime import datetime, timezone


class StructuredFormatter(logging.Formatter):
    """Custom formatter producing structured log lines."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        # Attach extra fields if present
        for key, value in record.__dict__.items():
            if key not in {
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "getMessage",
                "taskName",
            }:
                log_entry[key] = value
        # Plain text fallback for readability
        return (
            f"{log_entry['timestamp']} | {log_entry['level']:8s} | "
            f"{log_entry['logger']} | {log_entry['message']}"
        )


def setup_logger(name: str = "congestion_app", level: str | None = None) -> logging.Logger:
    """Configure and return a structured logger."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    log_level = level or os.getenv("LOG_LEVEL", "INFO")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter())
    logger.addHandler(handler)
    logger.propagate = False
    return logger


logger = setup_logger()
