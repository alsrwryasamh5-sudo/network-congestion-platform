"""Root cause analysis records."""
from datetime import datetime, timezone
from app.extensions import db


class RootCauseAnalysis(db.Model):
    __tablename__ = "root_cause_analyses"

    id = db.Column(db.Integer, primary_key=True)
    prediction_id = db.Column(db.Integer, db.ForeignKey("predictions.id"))
    congestion_event_id = db.Column(db.Integer, db.ForeignKey("congestion_events.id"))
    # culprit identification
    host_responsible = db.Column(db.String(64))  # source IP
    source_ip = db.Column(db.String(64))
    destination_ip = db.Column(db.String(64))
    protocol = db.Column(db.String(32))
    traffic_pattern = db.Column(db.String(128))
    cluster_id = db.Column(db.Integer)
    # components
    volume_contribution = db.Column(db.Float)
    qos_impact_score = db.Column(db.Float)
    ai_support_score = db.Column(db.Float)
    spatial_penalty = db.Column(db.Float)
    total_rca_score = db.Column(db.Float)
    # narrative
    congestion_cause = db.Column(db.Text)
    recommended_mitigation = db.Column(db.Text)
    severity = db.Column(db.String(32))
    evidence = db.Column(db.JSON)
    confidence = db.Column(db.Float)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    prediction = db.relationship("Prediction", backref="root_causes")
    congestion_event = db.relationship("CongestionEvent", backref="root_cause")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "prediction_id": self.prediction_id,
            "congestion_event_id": self.congestion_event_id,
            "host_responsible": self.host_responsible,
            "source_ip": self.source_ip,
            "destination_ip": self.destination_ip,
            "protocol": self.protocol,
            "traffic_pattern": self.traffic_pattern,
            "cluster_id": self.cluster_id,
            "volume_contribution": self.volume_contribution,
            "qos_impact_score": self.qos_impact_score,
            "ai_support_score": self.ai_support_score,
            "spatial_penalty": self.spatial_penalty,
            "total_rca_score": self.total_rca_score,
            "congestion_cause": self.congestion_cause,
            "recommended_mitigation": self.recommended_mitigation,
            "severity": self.severity,
            "evidence": self.evidence,
            "confidence": self.confidence,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
