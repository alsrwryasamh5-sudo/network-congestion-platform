"""User notifications."""
from datetime import datetime, timezone
from app.extensions import db


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    type = db.Column(db.String(64))  # info, success, warning, error, alert
    category = db.Column(db.String(64))  # system, congestion, training, report
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text)
    is_read = db.Column(db.Boolean, default=False, index=True)
    action_url = db.Column(db.String(1024))
    metadata_json = db.Column(db.JSON)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "type": self.type,
            "category": self.category,
            "title": self.title,
            "message": self.message,
            "is_read": self.is_read,
            "action_url": self.action_url,
            "metadata": self.metadata_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
