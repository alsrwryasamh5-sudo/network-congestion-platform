"""User feedback."""
from datetime import datetime, timezone
from app.extensions import db


class Feedback(db.Model):
    __tablename__ = "feedback"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    prediction_id = db.Column(db.Integer, db.ForeignKey("predictions.id"))
    category = db.Column(db.String(64))  # prediction_accuracy, ui_ux, bug_report, feature_request
    rating = db.Column(db.Integer)  # 1-5
    message = db.Column(db.Text)
    contact_email = db.Column(db.String(255))
    status = db.Column(db.String(32), default="open")  # open, reviewed, resolved
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    prediction = db.relationship("Prediction", backref="feedbacks")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "prediction_id": self.prediction_id,
            "category": self.category,
            "rating": self.rating,
            "message": self.message,
            "contact_email": self.contact_email,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
