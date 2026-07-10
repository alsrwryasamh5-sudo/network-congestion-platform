"""Congestion events log."""
from datetime import datetime, timezone
from app.extensions import db


class CongestionEvent(db.Model):
    __tablename__ = "congestion_events"

    id = db.Column(db.Integer, primary_key=True)
    prediction_id = db.Column(db.Integer, db.ForeignKey("predictions.id"))
    source_ip = db.Column(db.String(64), index=True)
    destination_ip = db.Column(db.String(64), index=True)
    protocol = db.Column(db.String(32))
    l4_dst_port = db.Column(db.Integer)
    cluster_id = db.Column(db.Integer)
    congestion_score = db.Column(db.Float)
    culprit_score = db.Column(db.Float)
    severity = db.Column(db.String(32), index=True)
    status = db.Column(db.String(32), default="active")  # active, mitigated, resolved
    detected_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    mitigated_at = db.Column(db.DateTime(timezone=True))
    metadata_json = db.Column(db.JSON)

    prediction = db.relationship("Prediction", backref="congestion_events")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "prediction_id": self.prediction_id,
            "source_ip": self.source_ip,
            "destination_ip": self.destination_ip,
            "protocol": self.protocol,
            "l4_dst_port": self.l4_dst_port,
            "cluster_id": self.cluster_id,
            "congestion_score": self.congestion_score,
            "culprit_score": self.culprit_score,
            "severity": self.severity,
            "status": self.status,
            "detected_at": self.detected_at.isoformat() if self.detected_at else None,
            "mitigated_at": self.mitigated_at.isoformat() if self.mitigated_at else None,
            "metadata": self.metadata_json,
        }
