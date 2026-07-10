"""Background training jobs."""
from datetime import datetime, timezone
from app.extensions import db


class TrainingJob(db.Model):
    __tablename__ = "training_jobs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    experiment_id = db.Column(db.Integer, db.ForeignKey("experiments.id"))
    job_type = db.Column(db.String(64), default="full_pipeline")  # full_pipeline, retrain, incremental
    status = db.Column(db.String(32), default="queued", index=True)  # queued, running, completed, failed, cancelled
    progress = db.Column(db.Float, default=0.0)  # 0-100
    current_step = db.Column(db.String(255))
    started_at = db.Column(db.DateTime(timezone=True))
    completed_at = db.Column(db.DateTime(timezone=True))
    duration_seconds = db.Column(db.Float)
    result = db.Column(db.JSON)
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    user = db.relationship("User", backref="training_jobs")
    experiment = db.relationship("Experiment", backref="training_jobs")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "experiment_id": self.experiment_id,
            "job_type": self.job_type,
            "status": self.status,
            "progress": self.progress,
            "current_step": self.current_step,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_seconds": self.duration_seconds,
            "result": self.result,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
