"""Prediction records."""
from datetime import datetime, timezone
from app.extensions import db


class Prediction(db.Model):
    __tablename__ = "predictions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    experiment_id = db.Column(db.Integer, db.ForeignKey("experiments.id"))
    # input
    input_features = db.Column(db.JSON)  # raw input row
    # output
    predicted_label = db.Column(db.Integer)  # 0 normal, 1 congested
    predicted_probability = db.Column(db.Float)
    confidence = db.Column(db.Float)
    is_congested = db.Column(db.Boolean, default=False)
    congestion_score = db.Column(db.Float)
    # shap
    shap_values = db.Column(db.JSON)  # {feature: shap_value}
    top_features = db.Column(db.JSON)  # [{feature, value, shap, contribution}]
    # rca
    root_cause_summary = db.Column(db.Text)
    mitigation_recommendation = db.Column(db.Text)
    severity = db.Column(db.String(32))  # low, medium, high, critical
    # metadata
    source = db.Column(db.String(32), default="api")  # api, upload, batch
    inference_time_ms = db.Column(db.Float)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    experiment = db.relationship("Experiment", backref="predictions")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "experiment_id": self.experiment_id,
            "input_features": self.input_features,
            "predicted_label": self.predicted_label,
            "predicted_probability": self.predicted_probability,
            "confidence": self.confidence,
            "is_congested": self.is_congested,
            "congestion_score": self.congestion_score,
            "shap_values": self.shap_values,
            "top_features": self.top_features,
            "root_cause_summary": self.root_cause_summary,
            "mitigation_recommendation": self.mitigation_recommendation,
            "severity": self.severity,
            "source": self.source,
            "inference_time_ms": self.inference_time_ms,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
