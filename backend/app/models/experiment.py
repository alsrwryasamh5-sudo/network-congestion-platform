"""Experiment tracking model."""
from datetime import datetime, timezone
from app.extensions import db


class Experiment(db.Model):
    __tablename__ = "experiments"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    dataset_id = db.Column(db.Integer, db.ForeignKey("datasets.id"))
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    # config
    model_type = db.Column(db.String(64))  # stacking, xgboost, decision_tree
    hyperparameters = db.Column(db.JSON)
    feature_columns = db.Column(db.JSON)
    # results
    metrics = db.Column(db.JSON)  # {accuracy, f1, auc, precision, recall}
    confusion_matrix = db.Column(db.JSON)  # [[tn,fp],[fn,tp]]
    status = db.Column(db.String(32), default="created")  # created, running, completed, failed
    artifact_paths = db.Column(db.JSON)  # {model, scaler, ...}
    started_at = db.Column(db.DateTime(timezone=True))
    completed_at = db.Column(db.DateTime(timezone=True))
    duration_seconds = db.Column(db.Float)
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    dataset = db.relationship("Dataset", backref="experiments")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "dataset_id": self.dataset_id,
            "user_id": self.user_id,
            "model_type": self.model_type,
            "hyperparameters": self.hyperparameters,
            "feature_columns": self.feature_columns,
            "metrics": self.metrics,
            "confusion_matrix": self.confusion_matrix,
            "status": self.status,
            "artifact_paths": self.artifact_paths,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_seconds": self.duration_seconds,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
