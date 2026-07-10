"""
Dashboard Blueprint
===================
 Aggregated stats & analytics endpoints for the dashboard widgets.
"""
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, g
from sqlalchemy import func, desc

from app.extensions import db
from app.models.prediction import Prediction
from app.models.congestion_event import CongestionEvent
from app.models.user import User
from app.models.experiment import Experiment
from app.models.notification import Notification
from app.models.system_log import ActivityLog
from app.utils.errors import NotFoundError
from ._shared import auth_required

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/v1/dashboard")


@dashboard_bp.route("/overview", methods=["GET"])
@auth_required()
def overview():
    """Top-level stats cards."""
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)

    total_predictions = Prediction.query.count()
    congested_count = Prediction.query.filter(Prediction.is_congested == True).count()
    active_events = CongestionEvent.query.filter(CongestionEvent.status == "active").count()
    resolved_events = CongestionEvent.query.filter(CongestionEvent.status == "mitigated").count()
    predictions_24h = Prediction.query.filter(Prediction.created_at >= last_24h).count()
    users_count = User.query.count()
    experiments_count = Experiment.query.count()

    # Severity distribution
    severity_dist = (
        db.session.query(CongestionEvent.severity, func.count(CongestionEvent.id))
        .filter(CongestionEvent.detected_at >= last_7d)
        .group_by(CongestionEvent.severity)
        .all()
    )

    # Top congested source IPs
    top_ips = (
        db.session.query(
            CongestionEvent.source_ip,
            func.count(CongestionEvent.id).label("count"),
        )
        .filter(CongestionEvent.source_ip.isnot(None))
        .group_by(CongestionEvent.source_ip)
        .order_by(desc("count"))
        .limit(10)
        .all()
    )

    # Protocol distribution
    proto_dist = (
        db.session.query(CongestionEvent.protocol, func.count(CongestionEvent.id))
        .filter(CongestionEvent.detected_at >= last_7d)
        .group_by(CongestionEvent.protocol)
        .all()
    )

    # Daily prediction counts (last 7 days)
    daily_counts = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = Prediction.query.filter(
            Prediction.created_at >= day_start,
            Prediction.created_at < day_end,
        ).count()
        congested = Prediction.query.filter(
            Prediction.created_at >= day_start,
            Prediction.created_at < day_end,
            Prediction.is_congested == True,
        ).count()
        daily_counts.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "total": count,
            "congested": congested,
        })

    congestion_rate = (congested_count / total_predictions * 100) if total_predictions > 0 else 0

    return {
        "success": True,
        "data": {
            "total_predictions": total_predictions,
            "congested_count": congested_count,
            "congestion_rate": round(congestion_rate, 2),
            "active_events": active_events,
            "resolved_events": resolved_events,
            "predictions_24h": predictions_24h,
            "users_count": users_count,
            "experiments_count": experiments_count,
            "severity_distribution": {k or "unknown": v for k, v in severity_dist},
            "top_source_ips": [{"ip": ip, "count": c} for ip, c in top_ips],
            "protocol_distribution": {k or "unknown": v for k, v in proto_dist},
            "daily_counts": daily_counts,
        },
    }


@dashboard_bp.route("/network-health", methods=["GET"])
@auth_required()
def network_health():
    """Simulated network health metrics (in production, would come from real telemetry)."""
    import random
    rng = random.Random(42)
    now = datetime.now(timezone.utc)

    # Generate 24 data points (hourly) for each metric
    latency = [rng.gauss(45, 15) for _ in range(24)]
    packet_loss = [max(0, rng.gauss(0.5, 0.3)) for _ in range(24)]
    bandwidth = [rng.gauss(850, 100) for _ in range(24)]
    jitter = [max(0, rng.gauss(8, 3)) for _ in range(24)]
    hours = [(now - timedelta(hours=23 - i)).strftime("%H:00") for i in range(24)]

    return {
        "success": True,
        "data": {
            "labels": hours,
            "latency_ms": [{"value": round(v, 2), "status": "normal" if v < 60 else "warning" if v < 100 else "critical"} for v in latency],
            "packet_loss_pct": [round(v, 2) for v in packet_loss],
            "bandwidth_mbps": [round(v, 2) for v in bandwidth],
            "jitter_ms": [round(v, 2) for v in jitter],
            "current_health_score": round(rng.uniform(75, 95), 1),
        },
    }


@dashboard_bp.route("/system-load", methods=["GET"])
@auth_required(roles=("admin",))
def system_load():
    """System resource usage (CPU, RAM, Disk, GPU)."""
    import psutil
    import random
    cpu = psutil.cpu_percent(interval=0.5)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "success": True,
        "data": {
            "cpu_percent": cpu,
            "cpu_cores": psutil.cpu_count(),
            "ram_percent": ram.percent,
            "ram_total_gb": round(ram.total / (1024 ** 3), 2),
            "ram_used_gb": round(ram.used / (1024 ** 3), 2),
            "disk_percent": disk.percent,
            "disk_total_gb": round(disk.total / (1024 ** 3), 2),
            "disk_used_gb": round(disk.used / (1024 ** 3), 2),
            "gpu_percent": random.uniform(0, 30),  # placeholder if no GPU
        },
    }


@dashboard_bp.route("/congestion-timeline", methods=["GET"])
@auth_required()
def congestion_timeline():
    """Time-series of congestion events."""
    hours = int(request.args.get("hours", 24))
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=hours)

    events = (
        CongestionEvent.query
        .filter(CongestionEvent.detected_at >= since)
        .order_by(CongestionEvent.detected_at.asc())
        .all()
    )
    timeline = [
        {
            "timestamp": e.detected_at.isoformat() if e.detected_at else None,
            "source_ip": e.source_ip,
            "severity": e.severity,
            "culprit_score": e.culprit_score,
            "status": e.status,
        }
        for e in events
    ]
    return {"success": True, "data": {"hours": hours, "events": timeline, "total": len(timeline)}}


@dashboard_bp.route("/recent-predictions", methods=["GET"])
@auth_required()
def recent_predictions():
    """Latest predictions for the dashboard table."""
    limit = min(int(request.args.get("limit", 10)), 50)
    preds = (
        Prediction.query
        .order_by(Prediction.created_at.desc())
        .limit(limit)
        .all()
    )
    return {"success": True, "data": [p.to_dict() for p in preds]}


@dashboard_bp.route("/api-stats", methods=["GET"])
@auth_required(roles=("admin",))
def api_stats():
    """API call statistics from activity logs."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)
    logs = (
        db.session.query(
            ActivityLog.action,
            ActivityLog.status,
            func.count(ActivityLog.id).label("count"),
        )
        .filter(ActivityLog.created_at >= since)
        .group_by(ActivityLog.action, ActivityLog.status)
        .all()
    )
    return {
        "success": True,
        "data": {
            "actions": [
                {"action": a, "status": s, "count": c}
                for a, s, c in logs
            ],
        },
    }
