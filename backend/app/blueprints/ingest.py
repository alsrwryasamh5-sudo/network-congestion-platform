"""
Ingestion Blueprint
====================
 Endpoints for ingesting real network flow data from external devices.

 /api/v1/ingest/csv         - Upload CSV file (multipart/form-data)
 /api/v1/ingest/raw         - POST raw CSV text
 /api/v1/ingest/flow        - POST single flow as JSON
 /api/v1/ingest/status      - GET ingestion status
 /api/v1/ingest/devices     - GET active devices list
 /api/v1/ingest/clear       - POST clear ingestion state
"""
import os
from datetime import datetime, timezone
from flask import Blueprint, request, g, jsonify
from werkzeug.utils import secure_filename

from app.extensions import limiter
from app.services.ingestion_service import (
    ingest_csv_text, ingest_flow, get_ingestion_status,
    clear_ingestion_state, parse_csv_file,
)
from app.utils.errors import ValidationError
from app.utils.logger import logger
from ._shared import auth_required, audit_action

ingest_bp = Blueprint("ingest", __name__, url_prefix="/api/v1/ingest")


@ingest_bp.route("/csv", methods=["POST"])
@auth_required()
@audit_action("ingest_csv", "prediction")
@limiter.limit("10 per hour")
def ingest_csv():
    """
    Upload a CSV file containing network flows.
    The file will be parsed, each row processed through the ML model,
    and results stored in the database + live feed.

    Form fields:
    - file: CSV file (required)
    - device_id: Device identifier (optional, default: filename)
    - max_flows: Maximum flows to process (optional, default: 1000)

    CSV should contain NetFlow v3 columns like:
    IPV4_SRC_ADDR, IPV4_DST_ADDR, PROTOCOL, L4_DST_PORT, IN_BYTES, OUT_BYTES,
    IN_PKTS, OUT_PKTS, FLOW_DURATION_MILLISECONDS, SRC_TO_DST_IAT_AVG, etc.
    """
    if "file" not in request.files:
        raise ValidationError("No file uploaded. Use 'file' field in multipart form.")

    file = request.files["file"]
    if not file.filename or not file.filename.endswith(".csv"):
        raise ValidationError("Please upload a .csv file.")

    device_id = request.form.get("device_id", file.filename.replace(".csv", ""))
    max_flows = int(request.form.get("max_flows", 1000))
    max_flows = min(max_flows, 5000)  # Hard cap

    # Read file content
    csv_text = file.read().decode("utf-8", errors="ignore")

    if not csv_text.strip():
        raise ValidationError("CSV file is empty.")

    logger.info(f"Ingesting CSV from device '{device_id}': {len(csv_text)} bytes, max {max_flows} flows")

    result = ingest_csv_text(
        csv_text=csv_text,
        device_id=device_id,
        user_id=g.current_user.id,
        max_flows=max_flows,
    )

    return {
        "success": True,
        "message": f"Ingested {result.get('total_processed', 0)} flows from {device_id}",
        "data": result,
    }


@ingest_bp.route("/raw", methods=["POST"])
@auth_required()
@audit_action("ingest_raw", "prediction")
@limiter.limit("30 per hour")
def ingest_raw():
    """
    Receive raw CSV text in the request body.
    Useful for devices that POST flow data via HTTP.

    Body: CSV text
    Query params:
    - device_id: Device identifier (required)
    - max_flows: Maximum flows (optional, default: 500)
    """
    device_id = request.args.get("device_id", "http_device")
    max_flows = int(request.args.get("max_flows", 500))

    csv_text = request.get_data(as_text=True)
    if not csv_text or not csv_text.strip():
        raise ValidationError("Request body is empty. Send CSV text.")

    logger.info(f"Raw ingestion from '{device_id}': {len(csv_text)} bytes")

    result = ingest_csv_text(
        csv_text=csv_text,
        device_id=device_id,
        user_id=g.current_user.id,
        max_flows=max_flows,
    )

    return {
        "success": True,
        "message": f"Ingested {result.get('total_processed', 0)} flows",
        "data": result,
    }


@ingest_bp.route("/flow", methods=["POST"])
@auth_required()
@limiter.limit("120 per minute")
def ingest_single_flow():
    """
    Ingest a single flow as JSON.
    Useful for real-time streaming from devices.

    Body: {
        "device_id": "router_01",
        "flow": {
            "IPV4_SRC_ADDR": "192.168.1.10",
            "IPV4_DST_ADDR": "10.0.0.5",
            "PROTOCOL": 6,
            ...
        }
    }
    """
    data = request.get_json() or {}
    device_id = data.get("device_id", "api_device")
    flow = data.get("flow")

    if not flow or not isinstance(flow, dict):
        raise ValidationError("'flow' (object) is required.")

    result = ingest_flow(
        flow=flow,
        device_id=device_id,
        user_id=g.current_user.id,
        persist=True,
    )

    if "error" in result:
        return {"success": False, "error": result["error"]}, 400

    return {"success": True, "data": result}


@ingest_bp.route("/status", methods=["GET"])
@auth_required()
def ingestion_status():
    """Get current ingestion status and statistics."""
    return {"success": True, "data": get_ingestion_status()}


@ingest_bp.route("/devices", methods=["GET"])
@auth_required()
def list_devices():
    """List all active devices that have sent flow data."""
    status = get_ingestion_status()
    return {"success": True, "data": {"devices": status["active_devices"], "total": status["device_count"]}}


@ingest_bp.route("/clear", methods=["POST"])
@auth_required(roles=("admin",))
def clear_state():
    """Clear ingestion state (admin only)."""
    result = clear_ingestion_state()
    return {"success": True, "data": result, "message": "Ingestion state cleared."}


@ingest_bp.route("/template", methods=["GET"])
@auth_required()
def csv_template():
    """
    Return a CSV template showing the expected column format.
    Useful for device administrators to configure their export.
    """
    template = """IPV4_SRC_ADDR,IPV4_DST_ADDR,PROTOCOL,L4_SRC_PORT,L4_DST_PORT,IN_BYTES,OUT_BYTES,IN_PKTS,OUT_PKTS,TCP_FLAGS,FLOW_DURATION_MILLISECONDS,SRC_TO_DST_IAT_AVG,DST_TO_SRC_IAT_AVG,SRC_TO_DST_IAT_STDDEV,DST_TO_SRC_IAT_STDDEV,SRC_TO_DST_AVG_THROUGHPUT,DST_TO_SRC_AVG_THROUGHPUT,TCP_WIN_MAX_IN,TCP_WIN_MAX_OUT,RETRANSMITTED_IN_PKTS,RETRANSMITTED_OUT_PKTS,MIN_IP_PKT_LEN,MAX_IP_PKT_LEN,MIN_TTL,MAX_TTL
192.168.1.100,10.0.0.5,6,54321,443,15240,8520,15,12,24,32000,45.3,38.7,28.1,22.5,28500,22500,64240,64240,0,0,52,1400,64,128
10.0.99.50,192.168.1.10,6,12345,80,485000,125000,550,180,24,58000,285.5,180.2,310.4,245.8,4200,3800,32768,16384,18,22,40,1500,30,64
"""
    return jsonify({
        "success": True,
        "data": {
            "content": template,
            "filename": "network_flows_template.csv",
            "columns": [
                "IPV4_SRC_ADDR", "IPV4_DST_ADDR", "PROTOCOL", "L4_SRC_PORT", "L4_DST_PORT",
                "IN_BYTES", "OUT_BYTES", "IN_PKTS", "OUT_PKTS", "TCP_FLAGS",
                "FLOW_DURATION_MILLISECONDS", "SRC_TO_DST_IAT_AVG", "DST_TO_SRC_IAT_AVG",
                "SRC_TO_DST_IAT_STDDEV", "DST_TO_SRC_IAT_STDDEV",
                "SRC_TO_DST_AVG_THROUGHPUT", "DST_TO_SRC_AVG_THROUGHPUT",
                "TCP_WIN_MAX_IN", "TCP_WIN_MAX_OUT",
                "RETRANSMITTED_IN_PKTS", "RETRANSMITTED_OUT_PKTS",
                "MIN_IP_PKT_LEN", "MAX_IP_PKT_LEN", "MIN_TTL", "MAX_TTL",
            ],
            "notes": [
                "Minimum required: IPV4_SRC_ADDR, IPV4_DST_ADDR, PROTOCOL",
                "Missing columns will be filled with 0",
                "Common aliases are supported (src_ip, dst_ip, proto, etc.)",
            ],
        },
    })
