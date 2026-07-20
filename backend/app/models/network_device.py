"""Network Device model - represents routers, switches, firewalls."""
from datetime import datetime, timezone
from app.extensions import db


class NetworkDevice(db.Model):
    __tablename__ = "network_devices"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    device_type = db.Column(db.String(32), nullable=False)  # Router, Switch, Firewall
    vendor = db.Column(db.String(64), default="Other")  # Cisco, MikroTik, Juniper, Other
    ip_address = db.Column(db.String(64), nullable=False, index=True)
    location = db.Column(db.String(128))
    status = db.Column(db.String(16), default="offline")  # online, offline, warning, error
    # Collector config
    netflow_enabled = db.Column(db.Boolean, default=True)
    ipfix_enabled = db.Column(db.Boolean, default=False)
    snmp_enabled = db.Column(db.Boolean, default=True)
    collector_ip = db.Column(db.String(64))
    export_port = db.Column(db.Integer, default=2055)
    snmp_community = db.Column(db.String(128), default="public")
    # Live metrics (updated by collector)
    cpu_usage = db.Column(db.Float, default=0.0)
    memory_usage = db.Column(db.Float, default=0.0)
    temperature = db.Column(db.Float, default=0.0)
    uptime_hours = db.Column(db.Integer, default=0)
    last_seen = db.Column(db.DateTime(timezone=True))
    # Metadata
    interfaces = db.Column(db.JSON, default=list)  # list of interface dicts
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    congestion_events = db.relationship("CongestionEvent", backref="device", lazy="dynamic",
                                        foreign_keys="CongestionEvent.device_id")
    alerts = db.relationship("DeviceAlert", backref="device", lazy="dynamic")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "device_type": self.device_type,
            "vendor": self.vendor,
            "ip_address": self.ip_address,
            "location": self.location,
            "status": self.status,
            "netflow_enabled": self.netflow_enabled,
            "ipfix_enabled": self.ipfix_enabled,
            "snmp_enabled": self.snmp_enabled,
            "collector_ip": self.collector_ip,
            "export_port": self.export_port,
            "snmp_community": self.snmp_community,
            "cpu_usage": self.cpu_usage,
            "memory_usage": self.memory_usage,
            "temperature": self.temperature,
            "uptime_hours": self.uptime_hours,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "interfaces": self.interfaces or [],
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class DeviceAlert(db.Model):
    __tablename__ = "device_alerts"

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey("network_devices.id"), index=True)
    interface = db.Column(db.String(64))
    alert_type = db.Column(db.String(64))  # congestion, down, high_cpu, high_memory
    severity = db.Column(db.String(16))  # low, medium, high, critical
    message = db.Column(db.Text)
    recommendation = db.Column(db.Text)
    cause = db.Column(db.Text)
    confidence = db.Column(db.Float, default=0.0)
    is_active = db.Column(db.Boolean, default=True)
    detected_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    resolved_at = db.Column(db.DateTime(timezone=True))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "device_id": self.device_id,
            "device_name": self.device.name if self.device else None,
            "interface": self.interface,
            "alert_type": self.alert_type,
            "severity": self.severity,
            "message": self.message,
            "recommendation": self.recommendation,
            "cause": self.cause,
            "confidence": self.confidence,
            "is_active": self.is_active,
            "detected_at": self.detected_at.isoformat() if self.detected_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }
