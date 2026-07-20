"""
Device Management Service
==========================
 Manages network devices (routers, switches, firewalls).
 Generates realistic live metrics for each device.
 Provides data for NOC dashboard, interface monitoring, and alerts.
"""
import random
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.extensions import db
from app.models.network_device import NetworkDevice, DeviceAlert
from app.utils.logger import logger


# Default interface templates per device type
DEVICE_INTERFACE_TEMPLATES = {
    "Router": [
        {"name": "Gi0/0", "bandwidth_capacity": 1000},
        {"name": "Gi0/1", "bandwidth_capacity": 1000},
        {"name": "Gi0/2", "bandwidth_capacity": 1000},
        {"name": "Te0/0", "bandwidth_capacity": 10000},
    ],
    "Switch": [
        {"name": "Gi1/0/1", "bandwidth_capacity": 1000},
        {"name": "Gi1/0/2", "bandwidth_capacity": 1000},
        {"name": "Gi1/0/3", "bandwidth_capacity": 1000},
        {"name": "Gi1/0/4", "bandwidth_capacity": 1000},
        {"name": "Gi1/0/5", "bandwidth_capacity": 1000},
    ],
    "Firewall": [
        {"name": "port1", "bandwidth_capacity": 1000},
        {"name": "port2", "bandwidth_capacity": 1000},
        {"name": "port3", "bandwidth_capacity": 1000},
    ],
}


def _vary(value: float, delta: float = 5.0, min_val: float = 0, max_val: float = 100) -> float:
    """Apply random variation to a metric."""
    return round(max(min_val, min(max_val, value + random.uniform(-delta, delta))), 1)


def create_device(data: Dict[str, Any]) -> NetworkDevice:
    """Create a new network device."""
    device_type = data.get("device_type", "Router")
    # Generate default interfaces based on type
    template = DEVICE_INTERFACE_TEMPLATES.get(device_type, DEVICE_INTERFACE_TEMPLATES["Router"])
    interfaces = [
        {
            "name": t["name"],
            "bandwidth_capacity": t["bandwidth_capacity"],
            "utilization": 0.0,
            "status": "down",
            "throughput_in": 0.0,
            "throughput_out": 0.0,
            "packet_loss": 0.0,
            "latency_ms": 0.0,
            "jitter_ms": 0.0,
        }
        for t in template
    ]

    device = NetworkDevice(
        name=data["name"],
        device_type=device_type,
        vendor=data.get("vendor", "Other"),
        ip_address=data["ip_address"],
        location=data.get("location", ""),
        status="offline",
        netflow_enabled=data.get("netflow_enabled", True),
        ipfix_enabled=data.get("ipfix_enabled", False),
        snmp_enabled=data.get("snmp_enabled", True),
        collector_ip=data.get("collector_ip", "10.0.0.100"),
        export_port=data.get("export_port", 2055),
        snmp_community=data.get("snmp_community", "public"),
        interfaces=interfaces,
        notes=data.get("notes", ""),
    )
    db.session.add(device)
    db.session.commit()
    logger.info(f"Device created: {device.name} ({device.ip_address})")
    return device


def update_device(device_id: int, data: Dict[str, Any]) -> NetworkDevice:
    """Update an existing device."""
    device = NetworkDevice.query.get(device_id)
    if not device:
        raise ValueError(f"Device {device_id} not found")

    for field in ["name", "device_type", "vendor", "ip_address", "location",
                  "netflow_enabled", "ipfix_enabled", "snmp_enabled",
                  "collector_ip", "export_port", "snmp_community", "notes"]:
        if field in data:
            setattr(device, field, data[field])

    db.session.commit()
    logger.info(f"Device updated: {device.name}")
    return device


def delete_device(device_id: int) -> bool:
    """Delete a device."""
    device = NetworkDevice.query.get(device_id)
    if not device:
        return False
    name = device.name
    db.session.delete(device)
    db.session.commit()
    logger.info(f"Device deleted: {name}")
    return True


def get_device(device_id: int) -> Optional[NetworkDevice]:
    return NetworkDevice.query.get(device_id)


def list_devices() -> List[NetworkDevice]:
    return NetworkDevice.query.order_by(NetworkDevice.created_at.desc()).all()


def update_device_live_metrics():
    """
    Update live metrics for all online devices.
    Called periodically to simulate real device monitoring.
    """
    devices = NetworkDevice.query.all()
    now = datetime.now(timezone.utc)

    for device in devices:
        # Simulate device being online if it has been created
        if device.status == "offline":
            device.status = "online"

        # Vary CPU, memory, temperature
        device.cpu_usage = _vary(device.cpu_usage or 45.0, 3.0, 5, 95)
        device.memory_usage = _vary(device.memory_usage or 55.0, 2.0, 20, 90)
        device.temperature = _vary(device.temperature or 38.0, 1.0, 25, 55)
        device.uptime_hours = (device.uptime_hours or 0) + 1
        device.last_seen = now

        # Update interfaces
        interfaces = device.interfaces or []
        for iface in interfaces:
            iface["utilization"] = _vary(iface.get("utilization", 30.0), 8.0, 5, 100)
            if iface["utilization"] >= 90:
                iface["status"] = "congested"
            elif iface["utilization"] >= 75:
                iface["status"] = "warning"
            else:
                iface["status"] = "up"

            cap = iface.get("bandwidth_capacity", 1000)
            iface["throughput_in"] = round(iface["utilization"] * cap / 100 * random.uniform(0.9, 1.0), 1)
            iface["throughput_out"] = round(iface["utilization"] * cap / 100 * random.uniform(0.7, 0.9), 1)
            iface["packet_loss"] = round(max(0, 0.1 + (iface["utilization"] - 70) * 0.05), 3) if iface["utilization"] > 70 else 0.0
            iface["latency_ms"] = round(20 + iface["utilization"] * 0.8, 2)
            iface["jitter_ms"] = round(5 + iface["utilization"] * 0.3, 2)

        device.interfaces = interfaces

        # Generate alerts for congested interfaces
        for iface in interfaces:
            if iface["status"] == "congested":
                # Check if alert already exists
                existing = DeviceAlert.query.filter_by(
                    device_id=device.id, interface=iface["name"], is_active=True
                ).first()
                if not existing:
                    alert = DeviceAlert(
                        device_id=device.id,
                        interface=iface["name"],
                        alert_type="congestion",
                        severity="critical" if iface["utilization"] >= 90 else "high",
                        message=f"High congestion detected on {iface['name']} ({iface['utilization']}% utilization)",
                        cause="High Throughput + Packet Loss",
                        recommendation="Throttle Bandwidth" if iface["utilization"] < 95 else "Block Traffic",
                        confidence=round(random.uniform(85, 98), 1),
                        is_active=True,
                    )
                    db.session.add(alert)

    db.session.commit()


def get_device_with_metrics(device_id: int) -> Dict[str, Any]:
    """Get a device with live metrics and interfaces."""
    device = NetworkDevice.query.get(device_id)
    if not device:
        return None

    # Update metrics on demand
    update_device_live_metrics()

    data = device.to_dict()
    # Add computed stats
    interfaces = device.interfaces or []
    data["interface_count"] = len(interfaces)
    data["up_interfaces"] = sum(1 for i in interfaces if i.get("status") in ["up", "warning", "congested"])
    data["congested_interfaces"] = sum(1 for i in interfaces if i.get("status") == "congested")
    data["total_throughput"] = round(sum(i.get("throughput_in", 0) + i.get("throughput_out", 0) for i in interfaces), 1)
    data["avg_utilization"] = round(sum(i.get("utilization", 0) for i in interfaces) / max(len(interfaces), 1), 1)
    return data


def get_all_devices_overview() -> Dict[str, Any]:
    """Get overview of all devices for dashboard."""
    update_device_live_metrics()
    devices = list_devices()
    total = len(devices)
    online = sum(1 for d in devices if d.status == "online")
    warning = sum(1 for d in devices if d.status == "warning")
    offline = sum(1 for d in devices if d.status == "offline")

    all_interfaces = []
    for d in devices:
        all_interfaces.extend(d.interfaces or [])

    congested = sum(1 for i in all_interfaces if i.get("status") == "congested")
    warning_ifaces = sum(1 for i in all_interfaces if i.get("status") == "warning")
    up_ifaces = sum(1 for i in all_interfaces if i.get("status") == "up")

    return {
        "total_devices": total,
        "online_devices": online,
        "warning_devices": warning,
        "offline_devices": offline,
        "total_interfaces": len(all_interfaces),
        "up_interfaces": up_ifaces,
        "warning_interfaces": warning_ifaces,
        "congested_interfaces": congested,
        "devices": [d.to_dict() for d in devices],
    }


def get_active_alerts(device_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get active alerts, optionally filtered by device."""
    query = DeviceAlert.query.filter_by(is_active=True)
    if device_id:
        query = query.filter_by(device_id=device_id)
    alerts = query.order_by(DeviceAlert.detected_at.desc()).limit(50).all()
    return [a.to_dict() for a in alerts]


def resolve_alert(alert_id: int) -> bool:
    """Mark an alert as resolved."""
    alert = DeviceAlert.query.get(alert_id)
    if not alert:
        return False
    alert.is_active = False
    alert.resolved_at = datetime.now(timezone.utc)
    db.session.commit()
    return True
