"""
Live CSV Ingestion Service
============================
 Accepts real-time network flow data from external devices in CSV format.
 Supports:
  1. Single CSV file upload → process all rows
  2. Streaming CSV chunks (for continuous feeding)
  3. HTTP POST with raw CSV body (for devices that POST flows)
  4. Auto-detection of NetFlow v3 / NF-UNSW-NB15 columns

 Each ingested flow is:
  - Parsed into a feature dict
  - Run through the ML model for prediction
  - Stored in the database (Prediction + CongestionEvent + RCA)
  - Added to the live monitoring feed
"""
import os
import io
import time
import json
import csv
import threading
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Iterator
import pandas as pd
import numpy as np

from app.extensions import db
from app.models.prediction import Prediction
from app.models.congestion_event import CongestionEvent
from app.models.root_cause import RootCauseAnalysis
from app.models.notification import Notification
from app.utils.logger import logger


# In-memory ingestion state
_ingestion_state = {
    "started_at": datetime.now(timezone.utc),
    "total_ingested": 0,
    "total_processed": 0,
    "total_congested": 0,
    "total_blocked": 0,
    "last_ingest_time": None,
    "active_devices": {},  # device_id -> {last_seen, flows_sent, status}
    "recent_ingested": [],  # last 100 ingested flows
    "is_streaming": False,
    "stream_buffer": [],
}

# Lock for thread-safe state updates
_lock = threading.Lock()


# Common column name aliases (device vendors use different names)
COLUMN_ALIASES = {
    # Source IP
    "src_ip": "IPV4_SRC_ADDR", "source_ip": "IPV4_SRC_ADDR", "srcaddr": "IPV4_SRC_ADDR",
    "src": "IPV4_SRC_ADDR", "src_addr": "IPV4_SRC_ADDR",
    # Destination IP
    "dst_ip": "IPV4_DST_ADDR", "dest_ip": "IPV4_DST_ADDR", "dstaddr": "IPV4_DST_ADDR",
    "dst": "IPV4_DST_ADDR", "dst_addr": "IPV4_DST_ADDR", "destination_ip": "IPV4_DST_ADDR",
    # Protocol
    "proto": "PROTOCOL", "protocol": "PROTOCOL", "protocol_number": "PROTOCOL",
    # Ports
    "src_port": "L4_SRC_PORT", "sport": "L4_SRC_PORT",
    "dst_port": "L4_DST_PORT", "dport": "L4_DST_PORT",
    # Bytes
    "in_bytes": "IN_BYTES", "ibytes": "IN_BYTES", "bytes_in": "IN_BYTES",
    "out_bytes": "OUT_BYTES", "obytes": "OUT_BYTES", "bytes_out": "OUT_BYTES",
    # Packets
    "in_pkts": "IN_PKTS", "ipkts": "IN_PKTS", "packets_in": "IN_PKTS",
    "out_pkts": "OUT_PKTS", "opkts": "OUT_PKTS", "packets_out": "OUT_PKTS",
    # Duration
    "duration": "FLOW_DURATION_MILLISECONDS", "flow_duration": "FLOW_DURATION_MILLISECONDS",
    "dur": "FLOW_DURATION_MILLISECONDS",
    # IAT
    "src_iat_avg": "SRC_TO_DST_IAT_AVG", "iat_src_avg": "SRC_TO_DST_IAT_AVG",
    "dst_iat_avg": "DST_TO_SRC_IAT_AVG", "iat_dst_avg": "DST_TO_SRC_IAT_AVG",
    "src_iat_std": "SRC_TO_DST_IAT_STDDEV", "iat_src_std": "SRC_TO_DST_IAT_STDDEV",
    "dst_iat_std": "DST_TO_SRC_IAT_STDDEV", "iat_dst_std": "DST_TO_SRC_IAT_STDDEV",
    # Throughput
    "src_throughput": "SRC_TO_DST_AVG_THROUGHPUT", "src_bw": "SRC_TO_DST_AVG_THROUGHPUT",
    "dst_throughput": "DST_TO_SRC_AVG_THROUGHPUT", "dst_bw": "DST_TO_SRC_AVG_THROUGHPUT",
    # TCP
    "tcp_flags": "TCP_FLAGS", "flags": "TCP_FLAGS",
    "tcp_win_in": "TCP_WIN_MAX_IN", "tcp_win_out": "TCP_WIN_MAX_OUT",
    # Retransmits
    "retrans_in": "RETRANSMITTED_IN_PKTS", "retrans_out": "RETRANSMITTED_OUT_PKTS",
}


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names to match the expected NF-UNSW-NB15 format."""
    # Build rename mapping
    rename_map = {}
    for col in df.columns:
        col_lower = col.lower().strip()
        if col in COLUMN_ALIASES:
            rename_map[col] = COLUMN_ALIASES[col]
        elif col_lower in COLUMN_ALIASES:
            rename_map[col] = COLUMN_ALIASES[col_lower]
        # Keep original if already correct (IPV4_SRC_ADDR, etc.)

    if rename_map:
        df = df.rename(columns=rename_map)
        logger.info(f"Normalized {len(rename_map)} columns: {list(rename_map.items())[:5]}...")
    return df


def parse_csv_text(csv_text: str) -> List[Dict[str, Any]]:
    """Parse CSV text into a list of flow dicts."""
    try:
        # Use pandas for robust CSV parsing
        df = pd.read_csv(io.StringIO(csv_text), low_memory=False)
        df = normalize_columns(df)
        # Convert to list of dicts, replacing NaN with 0
        records = df.fillna(0).to_dict(orient="records")
        return records
    except Exception as e:
        logger.error(f"CSV parsing failed: {e}")
        raise ValueError(f"Failed to parse CSV: {e}")


def parse_csv_file(file_path: str) -> List[Dict[str, Any]]:
    """Parse a CSV file into a list of flow dicts."""
    df = pd.read_csv(file_path, low_memory=False)
    df = normalize_columns(df)
    return df.fillna(0).to_dict(orient="records")


def ingest_flow(
    flow: Dict[str, Any],
    device_id: str = "manual_upload",
    user_id: Optional[int] = None,
    persist: bool = True,
) -> Dict[str, Any]:
    """
    Process a single flow:
    1. Run ML prediction
    2. Compute SHAP + RCA
    3. Store in DB (optional)
    4. Add to live feed

    Returns the processed result dict.
    """
    from app.services.ml_service import get_ml_service

    svc = get_ml_service()
    if not svc.is_ready:
        # Try auto-train
        svc._auto_train_if_needed()
        if not svc.is_ready:
            return {"error": "Model not ready", "flow": flow}

    try:
        # Run prediction
        pred_result = svc.predict(flow)
        shap_result = svc.explain(flow, top_k=5)
        rca = svc.root_cause(flow, pred_result["predicted_label"])

        # Build result
        src_ip = flow.get("IPV4_SRC_ADDR", "unknown")
        dst_ip = flow.get("IPV4_DST_ADDR", "unknown")
        proto = str(flow.get("PROTOCOL", "?"))
        port = int(flow.get("L4_DST_PORT", 0) or 0)

        result = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "device_id": device_id,
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "protocol": proto,
            "port": port,
            "predicted_label": pred_result["predicted_label"],
            "is_congested": pred_result["is_congested"],
            "confidence": pred_result["confidence"],
            "probability": pred_result["predicted_probability"],
            "inference_time_ms": pred_result.get("inference_time_ms", 0),
            "rca_score": rca.get("total_rca_score", 0),
            "severity": rca.get("severity", "low"),
            "mitigation": rca.get("recommended_mitigation", ""),
            "congestion_cause": rca.get("congestion_cause", ""),
            "top_features": shap_result.get("top_features", [])[:3],
            "status": "blocked" if rca.get("total_rca_score", 0) >= 75 else
                      "throttled" if rca.get("total_rca_score", 0) >= 50 else
                      "allowed",
        }

        # Persist to database
        if persist and user_id:
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
                source=f"device:{device_id}",
            )
            db.session.add(pred)
            db.session.flush()

            if pred.is_congested:
                event = CongestionEvent(
                    prediction_id=pred.id,
                    source_ip=src_ip,
                    destination_ip=dst_ip,
                    protocol=proto,
                    l4_dst_port=port,
                    congestion_score=float(pred_result["predicted_probability"]),
                    culprit_score=float(rca.get("total_rca_score", 0)),
                    severity=rca.get("severity"),
                    status="active",
                    detected_at=datetime.now(timezone.utc),
                    metadata_json={"device_id": device_id},
                )
                db.session.add(event)
                db.session.flush()

                rca_obj = RootCauseAnalysis(
                    prediction_id=pred.id,
                    congestion_event_id=event.id,
                    host_responsible=src_ip,
                    source_ip=src_ip,
                    destination_ip=dst_ip,
                    protocol=proto,
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

            db.session.commit()

        # Update ingestion state (thread-safe)
        with _lock:
            _ingestion_state["total_ingested"] += 1
            _ingestion_state["total_processed"] += 1
            if result["is_congested"]:
                _ingestion_state["total_congested"] += 1
            if result["status"] == "blocked":
                _ingestion_state["total_blocked"] += 1
            _ingestion_state["last_ingest_time"] = datetime.now(timezone.utc).isoformat()

            # Update device tracking
            if device_id not in _ingestion_state["active_devices"]:
                _ingestion_state["active_devices"][device_id] = {
                    "device_id": device_id,
                    "first_seen": datetime.now(timezone.utc).isoformat(),
                    "flows_sent": 0,
                    "flows_congested": 0,
                    "status": "active",
                }
            dev = _ingestion_state["active_devices"][device_id]
            dev["flows_sent"] += 1
            dev["last_seen"] = datetime.now(timezone.utc).isoformat()
            if result["is_congested"]:
                dev["flows_congested"] += 1

            # Add to recent ingested (keep last 100)
            _ingestion_state["recent_ingested"].insert(0, result)
            _ingestion_state["recent_ingested"] = _ingestion_state["recent_ingested"][:100]

        return result

    except Exception as e:
        logger.error(f"Flow ingestion failed: {e}", exc_info=True)
        with _lock:
            _ingestion_state["total_ingested"] += 1
        return {"error": str(e), "flow": flow}


def ingest_csv_text(
    csv_text: str,
    device_id: str = "csv_upload",
    user_id: Optional[int] = None,
    max_flows: int = 1000,
) -> Dict[str, Any]:
    """
    Ingest multiple flows from a CSV text.
    Returns summary of ingestion.
    """
    start_time = time.time()
    flows = parse_csv_text(csv_text)

    if not flows:
        return {"error": "No flows found in CSV", "processed": 0}

    # Limit to max_flows
    if len(flows) > max_flows:
        logger.info(f"CSV has {len(flows)} flows, limiting to {max_flows}")
        flows = flows[:max_flows]

    results = []
    errors = 0
    congested_count = 0

    for flow in flows:
        result = ingest_flow(flow, device_id=device_id, user_id=user_id, persist=True)
        if "error" in result:
            errors += 1
        else:
            results.append(result)
            if result.get("is_congested"):
                congested_count += 1

    duration = time.time() - start_time

    return {
        "device_id": device_id,
        "total_flows_received": len(flows),
        "total_processed": len(results),
        "total_congested": congested_count,
        "total_errors": errors,
        "processing_time_seconds": round(duration, 2),
        "flows_per_second": round(len(results) / duration, 1) if duration > 0 else 0,
        "recent_results": results[:20],  # Return first 20 for preview
    }


def get_ingestion_status() -> Dict[str, Any]:
    """Get current ingestion status."""
    with _lock:
        uptime = (datetime.now(timezone.utc) - _ingestion_state["started_at"]).total_seconds()
        return {
            "is_streaming": _ingestion_state["is_streaming"],
            "uptime_seconds": int(uptime),
            "total_ingested": _ingestion_state["total_ingested"],
            "total_processed": _ingestion_state["total_processed"],
            "total_congested": _ingestion_state["total_congested"],
            "total_blocked": _ingestion_state["total_blocked"],
            "congestion_rate": round(
                _ingestion_state["total_congested"] / max(_ingestion_state["total_processed"], 1) * 100, 2
            ),
            "last_ingest_time": _ingestion_state["last_ingest_time"],
            "active_devices": list(_ingestion_state["active_devices"].values()),
            "recent_flows": _ingestion_state["recent_ingested"][:30],
            "device_count": len(_ingestion_state["active_devices"]),
        }


def clear_ingestion_state() -> Dict[str, Any]:
    """Clear all ingestion state (for testing/reset)."""
    with _lock:
        old_count = _ingestion_state["total_ingested"]
        _ingestion_state["total_ingested"] = 0
        _ingestion_state["total_processed"] = 0
        _ingestion_state["total_congested"] = 0
        _ingestion_state["total_blocked"] = 0
        _ingestion_state["active_devices"] = {}
        _ingestion_state["recent_ingested"] = []
        _ingestion_state["started_at"] = datetime.now(timezone.utc)
        return {"cleared": True, "previous_total": old_count}
