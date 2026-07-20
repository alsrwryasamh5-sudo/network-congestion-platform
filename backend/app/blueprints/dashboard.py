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
from app.services.intelligence_data import get_full_intelligence_report
from app.services.live_monitor import get_live_network_status
from app.services.noc_service import get_noc_status
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
    """
    Network health metrics derived from actual predictions in the database.
    Aggregates latency, jitter, bandwidth, packet loss from prediction inputs.
    """
    now = datetime.now(timezone.utc)

    # Get predictions from the last 24 hours
    since = now - timedelta(hours=24)
    preds = (
        Prediction.query
        .filter(Prediction.created_at >= since)
        .order_by(Prediction.created_at.asc())
        .all()
    )

    # If no predictions, return empty structure
    if not preds:
        # Try to get older predictions (last 7 days) for demo
        since_7d = now - timedelta(days=7)
        preds = (
            Prediction.query
            .filter(Prediction.created_at >= since_7d)
            .order_by(Prediction.created_at.asc())
            .limit(500)
            .all()
        )

    if not preds:
        # Fallback: return zeros
        labels = [(now - timedelta(hours=23 - i)).strftime("%H:00") for i in range(24)]
        return {
            "success": True,
            "data": {
                "labels": labels,
                "latency_ms": [{"value": 0, "status": "normal"} for _ in range(24)],
                "packet_loss_pct": [0] * 24,
                "bandwidth_mbps": [0] * 24,
                "jitter_ms": [0] * 24,
                "current_health_score": 0,
                "source": "no_data",
            },
        }

    # Group predictions by hour (24 buckets)
    hourly_buckets = {i: [] for i in range(24)}
    for pred in preds:
        if pred.created_at:
            # Get hour offset from 23 hours ago
            hours_ago = int((now - pred.created_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600)
            bucket = 23 - hours_ago
            if 0 <= bucket < 24:
                hourly_buckets[bucket].append(pred)

    labels = []
    latency_ms = []
    packet_loss_pct = []
    bandwidth_mbps = []
    jitter_ms = []

    for i in range(24):
        time_label = (now - timedelta(hours=23 - i)).strftime("%H:00")
        labels.append(time_label)

        bucket_preds = hourly_buckets[i]
        if not bucket_preds:
            latency_ms.append({"value": 0, "status": "normal"})
            packet_loss_pct.append(0)
            bandwidth_mbps.append(0)
            jitter_ms.append(0)
            continue

        # Extract metrics from prediction inputs
        latencies = []
        jitters = []
        bandwidths = []
        losses = []
        for p in bucket_preds:
            features = p.input_features or {}
            # Compute delay (weighted IAT)
            in_pkts = float(features.get("IN_PKTS", 0) or 0)
            out_pkts = float(features.get("OUT_PKTS", 0) or 0)
            total_pkts = in_pkts + out_pkts
            if total_pkts > 0:
                src_iat = float(features.get("SRC_TO_DST_IAT_AVG", 0) or 0)
                dst_iat = float(features.get("DST_TO_SRC_IAT_AVG", 0) or 0)
                delay = (src_iat * in_pkts + dst_iat * out_pkts) / total_pkts
                latencies.append(delay)

                src_std = float(features.get("SRC_TO_DST_IAT_STDDEV", 0) or 0)
                dst_std = float(features.get("DST_TO_SRC_IAT_STDDEV", 0) or 0)
                jitter = (src_std * in_pkts + dst_std * out_pkts) / total_pkts
                jitters.append(jitter)

                src_thru = float(features.get("SRC_TO_DST_AVG_THROUGHPUT", 0) or 0)
                dst_thru = float(features.get("DST_TO_SRC_AVG_THROUGHPUT", 0) or 0)
                # Convert to Mbps (throughput is in bytes/sec typically)
                bw = (src_thru + dst_thru) * 8 / 1_000_000  # bytes/sec -> Mbps
                bandwidths.append(bw)

                ret_in = float(features.get("RETRANSMITTED_IN_PKTS", 0) or 0)
                ret_out = float(features.get("RETRANSMITTED_OUT_PKTS", 0) or 0)
                loss = (ret_in + ret_out) / (total_pkts + 1) * 100
                losses.append(loss)

        avg_latency = sum(latencies) / len(latencies) if latencies else 0
        avg_jitter = sum(jitters) / len(jitters) if jitters else 0
        avg_bw = sum(bandwidths) / len(bandwidths) if bandwidths else 0
        avg_loss = sum(losses) / len(losses) if losses else 0

        # Status based on thresholds
        if avg_latency < 60:
            status = "normal"
        elif avg_latency < 150:
            status = "warning"
        else:
            status = "critical"

        latency_ms.append({"value": round(avg_latency, 2), "status": status})
        packet_loss_pct.append(round(avg_loss, 2))
        bandwidth_mbps.append(round(avg_bw, 2))
        jitter_ms.append(round(avg_jitter, 2))

    # Current health score (0-100, higher = better)
    avg_latency_now = latency_ms[-1]["value"] if latency_ms else 0
    avg_loss_now = packet_loss_pct[-1] if packet_loss_pct else 0
    avg_jitter_now = jitter_ms[-1] if jitter_ms else 0

    # Health score formula: start at 100, subtract for bad metrics
    health_score = 100.0
    health_score -= min(avg_latency_now / 3, 40)  # latency penalty
    health_score -= min(avg_loss_now * 5, 30)      # loss penalty
    health_score -= min(avg_jitter_now / 5, 30)    # jitter penalty
    health_score = max(0, round(health_score, 1))

    return {
        "success": True,
        "data": {
            "labels": labels,
            "latency_ms": latency_ms,
            "packet_loss_pct": packet_loss_pct,
            "bandwidth_mbps": bandwidth_mbps,
            "jitter_ms": jitter_ms,
            "current_health_score": health_score,
            "source": "real_predictions",
            "predictions_analyzed": len(preds),
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


@dashboard_bp.route("/intelligence", methods=["GET"])
@auth_required()
def intelligence():
    """
    Full network intelligence report based on the original notebook analysis.
    Returns reference data from the NF-UNSW-NB15-v3 academic study.
    """
    return {
        "success": True,
        "data": get_full_intelligence_report(),
    }


@dashboard_bp.route("/live", methods=["GET"])
@auth_required()
def live_monitoring():
    """
    Real-time live network monitoring.
    Returns current network status with recent flows, alerts, and host states.
    Call this endpoint every 3-5 seconds for live updates.
    """
    return {
        "success": True,
        "data": get_live_network_status(),
    }


@dashboard_bp.route("/noc", methods=["GET"])
@auth_required()
def noc_dashboard():
    """
    NOC (Network Operations Center) dashboard data.
    Real-time network monitoring with devices, topology, congestion events,
    SHAP features, RCA, and alert timeline.
    Call this endpoint every 5 seconds for live NOC updates.
    """
    return {
        "success": True,
        "data": get_noc_status(),
    }

