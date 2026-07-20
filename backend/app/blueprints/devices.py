"""
Devices Blueprint
==================
 Endpoints for managing network devices (routers, switches, firewalls).

 /api/v1/devices              - GET list, POST create
 /api/v1/devices/<id>         - GET, PATCH, DELETE
 /api/v1/devices/<id>/metrics - GET live metrics
 /api/v1/devices/overview     - GET all devices overview
 /api/v1/devices/alerts       - GET active alerts
 /api/v1/devices/alerts/<id>/resolve - POST resolve alert
"""
from flask import Blueprint, request, g
from app.extensions import db, limiter
from app.services.device_service import (
    create_device, update_device, delete_device, get_device,
    list_devices, get_device_with_metrics, get_all_devices_overview,
    get_active_alerts, resolve_alert,
)
from app.utils.errors import ValidationError, NotFoundError
from app.utils.logger import logger
from ._shared import auth_required, audit_action

devices_bp = Blueprint("devices", __name__, url_prefix="/api/v1/devices")


@devices_bp.route("", methods=["GET"])
@auth_required()
def list_all_devices():
    """List all network devices."""
    devices = list_devices()
    return {"success": True, "data": [d.to_dict() for d in devices]}


@devices_bp.route("/overview", methods=["GET"])
@auth_required()
def overview():
    """Get overview of all devices with live metrics."""
    return {"success": True, "data": get_all_devices_overview()}


@devices_bp.route("", methods=["POST"])
@auth_required(roles=("admin", "researcher"))
@audit_action("create_device", "device")
@limiter.limit("20 per hour")
def create():
    """Create a new network device."""
    data = request.get_json() or {}

    # Validate required fields
    required = ["name", "device_type", "ip_address"]
    for field in required:
        if not data.get(field):
            raise ValidationError(f"Field '{field}' is required.")

    # Validate device_type
    if data["device_type"] not in ["Router", "Switch", "Firewall"]:
        raise ValidationError("device_type must be: Router, Switch, or Firewall")

    # Check IP uniqueness
    existing = NetworkDevice.query.filter_by(ip_address=data["ip_address"]).first()
    if existing:
        raise ValidationError(f"Device with IP {data['ip_address']} already exists.")

    try:
        device = create_device(data)
        return {"success": True, "message": f"Device '{device.name}' created", "data": device.to_dict()}, 201
    except Exception as e:
        logger.error(f"Device creation failed: {e}")
        raise ValidationError(str(e))


@devices_bp.route("/<int:device_id>", methods=["GET"])
@auth_required()
def get_one(device_id: int):
    """Get a specific device with live metrics."""
    data = get_device_with_metrics(device_id)
    if not data:
        raise NotFoundError("Device not found")
    return {"success": True, "data": data}


@devices_bp.route("/<int:device_id>", methods=["PATCH"])
@auth_required(roles=("admin", "researcher"))
@audit_action("update_device", "device")
def update(device_id: int):
    """Update a device."""
    data = request.get_json() or {}
    try:
        device = update_device(device_id, data)
        return {"success": True, "message": "Device updated", "data": device.to_dict()}
    except ValueError as e:
        raise NotFoundError(str(e))


@devices_bp.route("/<int:device_id>", methods=["DELETE"])
@auth_required(roles=("admin",))
@audit_action("delete_device", "device")
def delete(device_id: int):
    """Delete a device."""
    if delete_device(device_id):
        return {"success": True, "message": "Device deleted"}
    raise NotFoundError("Device not found")


@devices_bp.route("/<int:device_id>/metrics", methods=["GET"])
@auth_required()
def get_metrics(device_id: int):
    """Get live metrics for a device (updates metrics on each call)."""
    data = get_device_with_metrics(device_id)
    if not data:
        raise NotFoundError("Device not found")
    return {"success": True, "data": data}


@devices_bp.route("/alerts", methods=["GET"])
@auth_required()
def get_alerts():
    """Get active device alerts."""
    device_id = request.args.get("device_id", type=int)
    alerts = get_active_alerts(device_id)
    return {"success": True, "data": alerts}


@devices_bp.route("/alerts/<int:alert_id>/resolve", methods=["POST"])
@auth_required(roles=("admin", "researcher"))
def resolve_alert_endpoint(alert_id: int):
    """Resolve an alert."""
    if resolve_alert(alert_id):
        return {"success": True, "message": "Alert resolved"}
    raise NotFoundError("Alert not found")


# Import NetworkDevice for the uniqueness check
from app.models.network_device import NetworkDevice
