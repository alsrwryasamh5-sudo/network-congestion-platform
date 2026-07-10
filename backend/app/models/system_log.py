"""System logs & activity logs."""
from datetime import datetime, timezone
from app.extensions import db


class SystemLog(db.Model):
    __tablename__ = "system_logs"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    level = db.Column(db.String(16), index=True)  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    logger_name = db.Column(db.String(128))
    module = db.Column(db.String(128))
    message = db.Column(db.Text)
    traceback = db.Column(db.Text)
    extra = db.Column(db.JSON)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "level": self.level,
            "logger_name": self.logger_name,
            "module": self.module,
            "message": self.message,
            "traceback": self.traceback,
            "extra": self.extra,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ActivityLog(db.Model):
    __tablename__ = "activity_logs"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    action = db.Column(db.String(128), nullable=False)  # login, predict, train, ...
    resource_type = db.Column(db.String(64))  # prediction, experiment, dataset, report
    resource_id = db.Column(db.Integer)
    description = db.Column(db.Text)
    ip_address = db.Column(db.String(64))
    user_agent = db.Column(db.String(512))
    status = db.Column(db.String(32), default="success")  # success, failure
    metadata_json = db.Column(db.JSON)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "description": self.description,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "status": self.status,
            "metadata": self.metadata_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
