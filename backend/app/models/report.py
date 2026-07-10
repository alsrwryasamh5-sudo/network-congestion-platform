"""Generated PDF reports metadata."""
from datetime import datetime, timezone
from app.extensions import db


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    title = db.Column(db.String(255), nullable=False)
    report_type = db.Column(db.String(64), default="executive")  # executive, technical, mitigation
    period_start = db.Column(db.DateTime(timezone=True))
    period_end = db.Column(db.DateTime(timezone=True))
    summary = db.Column(db.Text)
    metrics_snapshot = db.Column(db.JSON)
    file_path = db.Column(db.String(1024))
    file_size_kb = db.Column(db.Float)
    status = db.Column(db.String(32), default="generated")  # generated, failed
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "report_type": self.report_type,
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "summary": self.summary,
            "metrics_snapshot": self.metrics_snapshot,
            "file_path": self.file_path,
            "file_size_kb": self.file_size_kb,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
