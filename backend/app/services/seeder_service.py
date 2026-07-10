"""
DB Seeder Service
==================
 After training completes, generates realistic predictions, congestion events,
 root cause analyses, and notifications based on the trained model.
 This fills the dashboard with real, meaningful data instead of empty charts.
"""
import os
import time
import random
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from app.extensions import db
from app.models.user import User
from app.models.prediction import Prediction
from app.models.congestion_event import CongestionEvent
from app.models.root_cause import RootCauseAnalysis
from app.models.notification import Notification
from app.models.experiment import Experiment
from app.services.ml_service import get_ml_service
from app.ml.data_loader import generate_synthetic_data
from app.utils.logger import logger


# Realistic host profiles for network simulation
HOST_PROFILES = [
    {"ip_prefix": "10.0.1.", "type": "Web Server", "baseline_volume": "medium"},
    {"ip_prefix": "10.0.2.", "type": "Database Server", "baseline_volume": "high"},
    {"ip_prefix": "10.0.3.", "type": "File Server", "baseline_volume": "medium"},
    {"ip_prefix": "10.0.99.", "type": "Suspicious Host", "baseline_volume": "high"},
    {"ip_prefix": "192.168.1.", "type": "Internal Workstation", "baseline_volume": "low"},
    {"ip_prefix": "192.168.2.", "type": "IoT Device", "baseline_volume": "low"},
    {"ip_prefix": "172.16.1.", "type": "Application Server", "baseline_volume": "medium"},
    {"ip_prefix": "172.16.2.", "type": "Mail Server", "baseline_volume": "medium"},
]

PROTOCOLS = [
    {"id": 6, "name": "TCP", "weight": 0.55},
    {"id": 17, "name": "UDP", "weight": 0.30},
    {"id": 1, "name": "ICMP", "weight": 0.15},
]

COMMON_PORTS = [80, 443, 22, 53, 25, 3389, 8080, 3306, 5432, 21, 23, 161, 162, 5060, 9000]

ATTACK_TYPES = ["Benign", "Exploits", "DoS", "Fuzzers", "Reconnaissance", "Generic", "Worms", "Backdoor"]


def _generate_realistic_flow(rng: random.Random, congested: bool = False) -> Dict[str, Any]:
    """Generate a realistic NetFlow v3 flow dict."""
    profile = rng.choice(HOST_PROFILES)
    src_ip = f"{profile['ip_prefix']}{rng.randint(2, 254)}"
    dst_ip = f"192.168.{rng.randint(10, 50)}.{rng.randint(2, 254)}"

    proto = rng.choices(
        [(p["id"], p["name"]) for p in PROTOCOLS],
        weights=[p["weight"] for p in PROTOCOLS],
    )[0]

    if congested:
        # Congested flow: high IAT, high retransmits, low throughput
        flow = {
            "IPV4_SRC_ADDR": src_ip,
            "IPV4_DST_ADDR": dst_ip,
            "PROTOCOL": proto[0],
            "L4_SRC_PORT": rng.randint(1024, 65535),
            "L4_DST_PORT": rng.choice(COMMON_PORTS),
            "IN_BYTES": rng.randint(50000, 500000),
            "OUT_BYTES": rng.randint(100000, 1000000),
            "IN_PKTS": rng.randint(50, 500),
            "OUT_PKTS": rng.randint(100, 1000),
            "TCP_FLAGS": rng.randint(0, 255),
            "CLIENT_TCP_FLAGS": rng.randint(0, 255),
            "SERVER_TCP_FLAGS": rng.randint(0, 255),
            "FLOW_DURATION_MILLISECONDS": rng.randint(5000, 60000),
            "SRC_TO_DST_IAT_AVG": rng.uniform(150, 400),  # HIGH = congested
            "DST_TO_SRC_IAT_AVG": rng.uniform(100, 350),
            "SRC_TO_DST_IAT_STDDEV": rng.uniform(200, 500),  # HIGH = jitter
            "DST_TO_SRC_IAT_STDDEV": rng.uniform(150, 450),
            "SRC_TO_DST_IAT_MAX": rng.uniform(500, 2000),
            "DST_TO_SRC_IAT_MAX": rng.uniform(400, 1800),
            "SRC_TO_DST_IAT_MIN": rng.uniform(5, 30),
            "DST_TO_SRC_IAT_MIN": rng.uniform(5, 40),
            "SRC_TO_DST_AVG_THROUGHPUT": rng.uniform(2000, 10000),  # LOW = congested
            "DST_TO_SRC_AVG_THROUGHPUT": rng.uniform(1500, 8000),
            "SRC_TO_DST_SECOND_BYTES": rng.randint(800, 1500),
            "DST_TO_SRC_SECOND_BYTES": rng.randint(600, 1400),
            "DURATION_IN": rng.uniform(5, 30),
            "DURATION_OUT": rng.uniform(8, 40),
            "MIN_IP_PKT_LEN": rng.randint(40, 80),
            "MAX_IP_PKT_LEN": rng.randint(1200, 1500),
            "MIN_TTL": rng.randint(30, 64),
            "MAX_TTL": rng.randint(64, 255),
            "TCP_WIN_MAX_IN": rng.randint(0, 65535),
            "TCP_WIN_MAX_OUT": rng.randint(0, 65535),
            "RETRANSMITTED_IN_PKTS": rng.randint(5, 50),  # HIGH = loss
            "RETRANSMITTED_OUT_PKTS": rng.randint(8, 60),
            "RETRANSMITTED_IN_BYTES": rng.randint(3000, 30000),
            "RETRANSMITTED_OUT_BYTES": rng.randint(5000, 50000),
            "NUM_PKTS_UP_TO_128_BYTES": rng.randint(20, 100),
            "NUM_PKTS_128_TO_256_BYTES": rng.randint(10, 50),
            "NUM_PKTS_256_TO_512_BYTES": rng.randint(5, 30),
            "NUM_PKTS_512_TO_1024_BYTES": rng.randint(5, 25),
            "NUM_PKTS_1024_TO_1514_BYTES": rng.randint(10, 40),
            "LONGEST_FLOW_PKT": rng.randint(1200, 1500),
            "SHORTEST_FLOW_PKT": rng.randint(40, 100),
            "L7_PROTO": rng.randint(0, 200),
            "DNS_QUERY_TYPE": rng.choice([1, 2, 28, 255]),
            "DNS_TTL_ANSWER": rng.randint(0, 3600),
            "FTP_COMMAND_RET_CODE": rng.randint(0, 500),
            "ICMP_TYPE": rng.randint(0, 20),
            "ICMP_IPV4_TYPE": rng.randint(0, 20),
        }
    else:
        # Normal flow: low IAT, low retransmits, high throughput
        flow = {
            "IPV4_SRC_ADDR": src_ip,
            "IPV4_DST_ADDR": dst_ip,
            "PROTOCOL": proto[0],
            "L4_SRC_PORT": rng.randint(1024, 65535),
            "L4_DST_PORT": rng.choice(COMMON_PORTS),
            "IN_BYTES": rng.randint(500, 10000),
            "OUT_BYTES": rng.randint(800, 20000),
            "IN_PKTS": rng.randint(1, 50),
            "OUT_PKTS": rng.randint(2, 80),
            "TCP_FLAGS": rng.randint(0, 255),
            "CLIENT_TCP_FLAGS": rng.randint(0, 255),
            "SERVER_TCP_FLAGS": rng.randint(0, 255),
            "FLOW_DURATION_MILLISECONDS": rng.randint(100, 10000),
            "SRC_TO_DST_IAT_AVG": rng.uniform(5, 60),  # LOW = normal
            "DST_TO_SRC_IAT_AVG": rng.uniform(8, 80),
            "SRC_TO_DST_IAT_STDDEV": rng.uniform(2, 40),  # LOW = stable
            "DST_TO_SRC_IAT_STDDEV": rng.uniform(3, 50),
            "SRC_TO_DST_IAT_MAX": rng.uniform(50, 300),
            "DST_TO_SRC_IAT_MAX": rng.uniform(40, 280),
            "SRC_TO_DST_IAT_MIN": rng.uniform(1, 10),
            "DST_TO_SRC_IAT_MIN": rng.uniform(1, 12),
            "SRC_TO_DST_AVG_THROUGHPUT": rng.uniform(30000, 80000),  # HIGH = good
            "DST_TO_SRC_AVG_THROUGHPUT": rng.uniform(25000, 70000),
            "SRC_TO_DST_SECOND_BYTES": rng.randint(400, 1400),
            "DST_TO_SRC_SECOND_BYTES": rng.randint(300, 1200),
            "DURATION_IN": rng.uniform(0.5, 5),
            "DURATION_OUT": rng.uniform(0.8, 8),
            "MIN_IP_PKT_LEN": rng.randint(40, 80),
            "MAX_IP_PKT_LEN": rng.randint(800, 1500),
            "MIN_TTL": rng.randint(40, 64),
            "MAX_TTL": rng.randint(64, 255),
            "TCP_WIN_MAX_IN": rng.randint(10000, 65535),
            "TCP_WIN_MAX_OUT": rng.randint(10000, 65535),
            "RETRANSMITTED_IN_PKTS": rng.randint(0, 3),
            "RETRANSMITTED_OUT_PKTS": rng.randint(0, 4),
            "RETRANSMITTED_IN_BYTES": rng.randint(0, 2000),
            "RETRANSMITTED_OUT_BYTES": rng.randint(0, 3000),
            "NUM_PKTS_UP_TO_128_BYTES": rng.randint(5, 30),
            "NUM_PKTS_128_TO_256_BYTES": rng.randint(2, 15),
            "NUM_PKTS_256_TO_512_BYTES": rng.randint(1, 10),
            "NUM_PKTS_512_TO_1024_BYTES": rng.randint(1, 10),
            "NUM_PKTS_1024_TO_1514_BYTES": rng.randint(3, 20),
            "LONGEST_FLOW_PKT": rng.randint(800, 1500),
            "SHORTEST_FLOW_PKT": rng.randint(40, 100),
            "L7_PROTO": rng.randint(0, 200),
            "DNS_QUERY_TYPE": rng.choice([1, 2, 28, 255]),
            "DNS_TTL_ANSWER": rng.randint(0, 3600),
            "FTP_COMMAND_RET_CODE": 0,
            "ICMP_TYPE": rng.randint(0, 20),
            "ICMP_IPV4_TYPE": rng.randint(0, 20),
        }
    return flow


def seed_database_with_predictions(
    n_predictions: int = 200,
    congested_ratio: float = 0.35,
    user_id: Optional[int] = None,
    hours_back: int = 72,
) -> Dict[str, Any]:
    """
    Generate N realistic predictions and store them in the database.
    Also creates congestion events, root cause analyses, and notifications
    for congested predictions.

    Args:
        n_predictions: Number of predictions to generate
        congested_ratio: Fraction of predictions that should be congested (0-1)
        user_id: User ID to associate predictions with (default: first admin)
        hours_back: Spread predictions over the last N hours

    Returns:
        Summary dict with counts
    """
    from app.services.ml_service import get_ml_service

    logger.info(f"Seeding database with {n_predictions} predictions (congested_ratio={congested_ratio})...")

    # Get user
    if user_id is None:
        user = User.query.filter_by(role="admin").first()
        if not user:
            user = User.query.first()
        if not user:
            logger.error("No users found in database. Cannot seed predictions.")
            return {"error": "No users found"}
        user_id = user.id

    # Get ML service
    svc = get_ml_service()
    if not svc.is_ready:
        logger.warning("ML model not ready. Training on synthetic data first...")
        try:
            from app.ml.data_loader import generate_synthetic_data
            df = generate_synthetic_data(n_samples=2000)
            svc.train(df, experiment_name="seed_prerequisite")
        except Exception as e:
            logger.error(f"Failed to train model for seeding: {e}")
            return {"error": f"Model training failed: {e}"}

    rng = random.Random(42)
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(hours=hours_back)

    n_congested = int(n_predictions * congested_ratio)
    n_normal = n_predictions - n_congested

    # Generate flows: mix of congested and normal
    flows = []
    for _ in range(n_congested):
        flows.append((True, _generate_realistic_flow(rng, congested=True)))
    for _ in range(n_normal):
        flows.append((False, _generate_realistic_flow(rng, congested=False)))
    rng.shuffle(flows)

    # Spread timestamps across hours_back
    time_step = timedelta(seconds=hours_back * 3600 / n_predictions)

    predictions_created = 0
    events_created = 0
    rca_created = 0
    notifications_created = 0
    errors = 0

    # Get protocol map
    proto_map = {p["id"]: p["name"] for p in PROTOCOLS}

    # Known culprit hosts (for diversity)
    known_culprits = set()

    for i, (expected_congested, flow) in enumerate(flows):
        try:
            # Run prediction
            pred_result = svc.predict(flow)
            shap_result = svc.explain(flow, top_k=5)
            rca = svc.root_cause(flow, pred_result["predicted_label"])

            timestamp = start_time + time_step * i

            # Create Prediction record
            pred = Prediction(
                user_id=user_id,
                input_features=flow,
                predicted_label=pred_result["predicted_label"],
                predicted_probability=pred_result["predicted_probability"],
                confidence=pred_result["confidence"],
                is_congested=pred_result["is_congested"],
                shap_values=shap_result.get("values", {}),
                top_features=shap_result.get("top_features", []),
                root_cause_summary=rca.get("congestion_cause"),
                mitigation_recommendation=rca.get("recommended_mitigation"),
                severity=rca.get("severity"),
                inference_time_ms=pred_result.get("inference_time_ms"),
                source="seed",
                       # Override created_at by setting it after add
            db.session.add(pred)
            db.session.flush()  # get pred.id
            # Update created_at manually
            pred.created_at = timestamp
            predictions_created += 1

            # If congested, create CongestionEvent + RootCauseAnalysis
            if pred.is_congested:
                src_ip = flow.get("IPV4_SRC_ADDR", "unknown")
                dst_ip = flow.get("IPV4_DST_ADDR", "unknown")
                proto_id = flow.get("PROTOCOL", 0)
                proto_name = proto_map.get(proto_id, str(proto_id))
                port = int(flow.get("L4_DST_PORT", 0) or 0)

                # Cluster ID: simulate DBSCAN
                cluster_id = rng.choice([-1, 0, 1, 2, 3], weights=[0.2, 0.4, 0.2, 0.1, 0.1])

                event = CongestionEvent(
                    prediction_id=pred.id,
                    source_ip=src_ip,
                    destination_ip=dst_ip,
                    protocol=proto_name,
                    l4_dst_port=port,
                    cluster_id=cluster_id,
                    congestion_score=float(pred_result["predicted_probability"]),
                    culprit_score=float(rca.get("total_rca_score", 0)),
                    severity=rca.get("severity"),
                    status=rng.choice(["active", "active", "mitigated"], weights=[0.6, 0.3, 0.1]),
                    detected_at=timestamp,
                    metadata_json={
                        "attack_type": rng.choice(["Benign", "Exploits", "DoS", "Reconnaissance"]),
                        "flow_duration_ms": flow.get("FLOW_DURATION_MILLISECONDS", 0),
                        "bytes_out": flow.get("OUT_BYTES", 0),
                    },
                )
                db.session.add(event)
                db.session.flush()
                events_created += 1

                rca_obj = RootCauseAnalysis(
                    prediction_id=pred.id,
                    congestion_event_id=event.id,
                    host_responsible=src_ip,
                    source_ip=src_ip,
                    destination_ip=dst_ip,
                    protocol=proto_name,
                    cluster_id=cluster_id,
                    volume_contribution=rca.get("volume_contribution"),
                    qos_impact_score=rca.get("qos_impact_score"),
                    ai_support_score=rca.get("ai_support_score"),
                    spatial_penalty=rca.get("spatial_penalty"),
                    total_rca_score=rca.get("total_rca_score"),
                    congestion_cause=rca.get("congestion_cause"),
                    recommended_mitigation=rca.get("recommended_mitigation"),
                    severity=rca.get("severity"),
                    evidence=rca.get("evidence"),
                    confidence=rca.get("confidence"),
                )
                db.session.add(rca_obj)
                rca_created += 1

                known_culprits.add(src_ip)

                # Create notification for critical events
                if rca.get("severity") in ("critical", "high") and rng.random() < 0.4:
                    notif = Notification(
                        user_id=user_id,
                        type="alert",
                        category="congestion",
                        title=f"Critical congestion from {src_ip}",
                        message=f"Host {src_ip} detected with culprit score {rca.get('total_rca_score', 0):.1f}/100. Severity: {rca.get('severity')}.",
                        is_read=rng.random() < 0.3,
                        action_url="/root-cause",
                        metadata_json={
                            "source_ip": src_ip,
                            "severity": rca.get("severity"),
                            "culprit_score": rca.get("total_rca_score"),
                        },
                        created_at=timestamp,
                    )
                    db.session.add(notif)
                    notifications_created += 1

            # Commit in batches of 50
            if (i + 1) % 50 == 0:
                db.session.commit()
                logger.info(f"Seeded {i + 1}/{n_predictions} predictions...")

        except Exception as e:
            errors += 1
            if errors <= 3:
                logger.warning(f"Error seeding prediction {i}: {e}")
            db.session.rollback()
            continue

    db.session.commit()
    logger.info(
        f"Seeding complete: {predictions_created} predictions, {events_created} events, "
        f"{rca_created} RCA records, {notifications_created} notifications, {errors} errors"
    )

    return {
        "predictions_created": predictions_created,
        "events_created": events_created,
        "rca_created": rca_created,
        "notifications_created": notifications_created,
        "unique_culprit_hosts": len(known_culprits),
        "errors": errors,
        "known_culprits": list(known_culprits)[:20],
    }
