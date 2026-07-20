"""
NOC Dashboard Service
======================
 Generates real-time Network Operations Center data including:
 - Network devices (routers, switches) with live metrics
 - Interface traffic utilization
 - Topology with links between devices
 - Congestion alerts and events
 - SHAP-based root cause analysis
 - Recommended actions
"""
import random
import time
import numpy as np
from datetime import datetime, timezone
from typing import Dict, Any, List
from app.utils.logger import logger


# ===== Network Topology Definition =====
# Routers / Switches → NetFlow Collector → AI Model → RCA → Dashboard

NETWORK_DEVICES = [
    {
        "id": "R1",
        "name": "Core Router R1",
        "type": "Router",
        "model": "Cisco ISR 4451",
        "ip": "10.0.1.1",
        "location": "Data Center - Rack A1",
        "role": "Core",
        "status": "online",
        "cpu_usage": 45.2,
        "memory_usage": 62.8,
        "temperature": 38,
        "uptime_hours": 1824,
        "interfaces": [
            {"name": "Gi0/0", "utilization": 78.5, "status": "active", "throughput_in": 850, "throughput_out": 620, "bandwidth_capacity": 1000},
            {"name": "Gi0/1", "utilization": 92.3, "status": "congested", "throughput_in": 920, "throughput_out": 780, "bandwidth_capacity": 1000},
            {"name": "Gi0/2", "utilization": 45.0, "status": "active", "throughput_in": 410, "throughput_out": 380, "bandwidth_capacity": 1000},
            {"name": "Te0/0", "utilization": 88.7, "status": "warning", "throughput_in": 8800, "throughput_out": 7600, "bandwidth_capacity": 10000},
        ],
    },
    {
        "id": "R2",
        "name": "Edge Router R2",
        "type": "Router",
        "model": "Cisco ISR 4331",
        "ip": "10.0.1.2",
        "location": "Data Center - Rack A2",
        "role": "Edge",
        "status": "online",
        "cpu_usage": 38.5,
        "memory_usage": 54.2,
        "temperature": 35,
        "uptime_hours": 1248,
        "interfaces": [
            {"name": "Gi0/0", "utilization": 55.0, "status": "active", "throughput_in": 550, "throughput_out": 480, "bandwidth_capacity": 1000},
            {"name": "Gi0/1", "utilization": 32.0, "status": "active", "throughput_in": 320, "throughput_out": 290, "bandwidth_capacity": 1000},
            {"name": "Gi0/2", "utilization": 68.5, "status": "active", "throughput_in": 685, "throughput_out": 590, "bandwidth_capacity": 1000},
        ],
    },
    {
        "id": "SW1",
        "name": "Distribution Switch SW1",
        "type": "Switch",
        "model": "Cisco Catalyst 9300",
        "ip": "10.0.2.1",
        "location": "Data Center - Rack B1",
        "role": "Distribution",
        "status": "online",
        "cpu_usage": 28.4,
        "memory_usage": 41.6,
        "temperature": 32,
        "uptime_hours": 2160,
        "interfaces": [
            {"name": "Gi1/0/1", "utilization": 62.0, "status": "active", "throughput_in": 620, "throughput_out": 580, "bandwidth_capacity": 1000},
            {"name": "Gi1/0/2", "utilization": 18.5, "status": "active", "throughput_in": 185, "throughput_out": 165, "bandwidth_capacity": 1000},
            {"name": "Gi1/0/3", "utilization": 71.2, "status": "active", "throughput_in": 712, "throughput_out": 645, "bandwidth_capacity": 1000},
            {"name": "Gi1/0/4", "utilization": 95.8, "status": "congested", "throughput_in": 958, "throughput_out": 820, "bandwidth_capacity": 1000},
        ],
    },
    {
        "id": "SW2",
        "name": "Access Switch SW2",
        "type": "Switch",
        "model": "Cisco Catalyst 2960",
        "ip": "10.0.2.2",
        "location": "Office Floor 1",
        "role": "Access",
        "status": "warning",
        "cpu_usage": 72.1,
        "memory_usage": 68.3,
        "temperature": 41,
        "uptime_hours": 960,
        "interfaces": [
            {"name": "Fa0/1", "utilization": 45.0, "status": "active", "throughput_in": 450, "throughput_out": 380, "bandwidth_capacity": 1000},
            {"name": "Fa0/2", "utilization": 88.0, "status": "warning", "throughput_in": 880, "throughput_out": 720, "bandwidth_capacity": 1000},
            {"name": "Fa0/3", "utilization": 32.0, "status": "active", "throughput_in": 320, "throughput_out": 280, "bandwidth_capacity": 1000},
        ],
    },
    {
        "id": "FW1",
        "name": "Firewall FW1",
        "type": "Firewall",
        "model": "Fortinet FortiGate 100F",
        "ip": "10.0.0.1",
        "location": "DMZ",
        "role": "Security",
        "status": "online",
        "cpu_usage": 52.0,
        "memory_usage": 58.4,
        "temperature": 39,
        "uptime_hours": 1440,
        "interfaces": [
            {"name": "port1", "utilization": 68.0, "status": "active", "throughput_in": 680, "throughput_out": 540, "bandwidth_capacity": 1000},
            {"name": "port2", "utilization": 42.0, "status": "active", "throughput_in": 420, "throughput_out": 380, "bandwidth_capacity": 1000},
        ],
    },
]

# Network topology links between devices
TOPOLOGY_LINKS = [
    {"from": "R1", "to": "R2", "label": "10G Te0/0", "utilization": 88.7, "status": "warning"},
    {"from": "R1", "to": "SW1", "label": "1G Gi0/1", "utilization": 92.3, "status": "congested"},
    {"from": "R1", "to": "FW1", "label": "1G Gi0/0", "utilization": 78.5, "status": "active"},
    {"from": "SW1", "to": "SW2", "label": "1G Gi1/0/4", "utilization": 95.8, "status": "congested"},
    {"from": "R2", "to": "SW1", "label": "1G Gi0/2", "utilization": 45.0, "status": "active"},
    {"from": "FW1", "to": "R2", "label": "1G port1", "utilization": 68.0, "status": "active"},
]

# Known contributing hosts for RCA
CONTRIBUTING_HOSTS = [
    {"ip": "192.168.1.20", "mac": "00:1A:2B:3C:4D:50", "hostname": "WS-ADMIN-01", "traffic_contribution": 78.4, "culprit_score": 92.5, "reason": "High Throughput + Packet Loss"},
    {"ip": "192.168.1.45", "mac": "00:1A:2B:3C:4D:65", "hostname": "WS-DEV-12", "traffic_contribution": 54.2, "culprit_score": 78.3, "reason": "Excessive Connections + High IAT"},
    {"ip": "10.0.99.50", "mac": "00:1A:2B:3C:4D:99", "hostname": "UNKNOWN-DEVICE", "traffic_contribution": 41.8, "culprit_score": 88.1, "reason": "Suspicious Burst Pattern + Retransmissions"},
    {"ip": "192.168.2.30", "mac": "00:1A:2B:3C:4D:30", "hostname": "IoT-CAM-01", "traffic_contribution": 28.5, "culprit_score": 45.2, "reason": "Continuous Streaming Traffic"},
    {"ip": "192.168.1.100", "mac": "00:1A:2B:3C:4D:10", "hostname": "SRV-DB-01", "traffic_contribution": 35.7, "culprit_score": 62.8, "reason": "Database Backup + Large Transfers"},
]

SHAP_FEATURES = [
    {"feature": "DST_TO_SRC_IAT_STDDEV", "importance": 51.91, "direction": "positive"},
    {"feature": "SRC_TO_DST_IAT_AVG", "importance": 22.64, "direction": "positive"},
    {"feature": "SRC_TO_DST_IAT_STDDEV", "importance": 17.28, "direction": "positive"},
    {"feature": "DST_TO_SRC_IAT_AVG", "importance": 3.32, "direction": "positive"},
    {"feature": "DST_TO_SRC_SECOND_BYTES", "importance": 0.85, "direction": "negative"},
    {"feature": "FLOW_DURATION_MILLISECONDS", "importance": 0.80, "direction": "positive"},
    {"feature": "SRC_TO_DST_IAT_MAX", "importance": 0.72, "direction": "positive"},
    {"feature": "L4_DST_PORT", "importance": 0.69, "direction": "negative"},
    {"feature": "DURATION_OUT", "importance": 0.51, "direction": "positive"},
    {"feature": "NUM_PKTS_UP_TO_128_BYTES", "importance": 0.38, "direction": "negative"},
]

# In-memory state
_noc_state = {
    "started_at": datetime.now(timezone.utc),
    "alert_timeline": [],
    "traffic_history": [],  # for time-series charts
    "congestion_events": [],
    "total_packets_processed": 0,
    "total_flows_analyzed": 0,
}


def _vary(value: float, delta: float = 5.0, min_val: float = 0, max_val: float = 100) -> float:
    """Apply random variation to a metric value."""
    new_val = value + random.uniform(-delta, delta)
    return round(max(min_val, min(max_val, new_val)), 1)


def get_noc_status() -> Dict[str, Any]:
    """Get complete NOC dashboard data - real-time network status."""
    now = datetime.now(timezone.utc)
    uptime = (now - _noc_state["started_at"]).total_seconds()

    # Update device metrics with random variation (simulating live data)
    for device in NETWORK_DEVICES:
        device["cpu_usage"] = _vary(device["cpu_usage"], 3.0, 5, 100)
        device["memory_usage"] = _vary(device["memory_usage"], 2.0, 20, 95)
        device["temperature"] = _vary(device["temperature"], 1.0, 25, 55)

        for iface in device["interfaces"]:
            old_util = iface["utilization"]
            iface["utilization"] = _vary(iface["utilization"], 8.0, 5, 100)
            # Update status based on utilization
            if iface["utilization"] >= 90:
                iface["status"] = "congested"
            elif iface["utilization"] >= 75:
                iface["status"] = "warning"
            else:
                iface["status"] = "active"
            # Update throughput based on utilization
            iface["throughput_in"] = round(iface["utilization"] * iface["bandwidth_capacity"] / 100 * random.uniform(0.9, 1.0), 1)
            iface["throughput_out"] = round(iface["utilization"] * iface["bandwidth_capacity"] / 100 * random.uniform(0.7, 0.9), 1)

    # Update topology link utilization
    for link in TOPOLOGY_LINKS:
        link["utilization"] = _vary(link["utilization"], 5.0, 5, 100)
        if link["utilization"] >= 90:
            link["status"] = "congested"
        elif link["utilization"] >= 75:
            link["status"] = "warning"
        else:
            link["status"] = "active"

    # Calculate network health summary
    all_interfaces = [iface for dev in NETWORK_DEVICES for iface in dev["interfaces"]]
    total_interfaces = len(all_interfaces)
    congested_ifaces = sum(1 for i in all_interfaces if i["status"] == "congested")
    warning_ifaces = sum(1 for i in all_interfaces if i["status"] == "warning")
    active_ifaces = sum(1 for i in all_interfaces if i["status"] == "active")

    avg_utilization = sum(i["utilization"] for i in all_interfaces) / total_interfaces
    total_throughput_in = sum(i["throughput_in"] for i in all_interfaces)
    total_throughput_out = sum(i["throughput_out"] for i in all_interfaces)
    total_throughput = total_throughput_in + total_throughput_out

    avg_latency = round(np.mean([20 + i["utilization"] * 0.8 for i in all_interfaces]), 2)
    avg_jitter = round(np.mean([5 + i["utilization"] * 0.3 for i in all_interfaces]), 2)
    avg_packet_loss = round(np.mean([0.1 + max(0, i["utilization"] - 70) * 0.05 for i in all_interfaces]), 3)

    # Determine overall network status
    if congested_ifaces >= 3 or avg_packet_loss > 2:
        network_status = "Critical"
        status_color = "#EF4444"
    elif congested_ifaces >= 1 or warning_ifaces >= 3:
        network_status = "Warning"
        status_color = "#F59E0B"
    else:
        network_status = "Healthy"
        status_color = "#10B981"

    # Update traffic history (keep last 60 points = 5 minutes at 5s intervals)
    traffic_point = {
        "timestamp": now.isoformat(),
        "throughput_in": round(total_throughput_in, 1),
        "throughput_out": round(total_throughput_out, 1),
        "avg_latency": avg_latency,
        "avg_jitter": avg_jitter,
        "packet_loss": avg_packet_loss,
        "utilization": round(avg_utilization, 1),
    }
    _noc_state["traffic_history"].append(traffic_point)
    _noc_state["traffic_history"] = _noc_state["traffic_history"][-60:]

    # Generate new congestion events and alerts
    _noc_state["total_packets_processed"] += random.randint(50000, 150000)
    _noc_state["total_flows_analyzed"] += random.randint(100, 500)

    for iface in all_interfaces:
        if iface["status"] == "congested" and random.random() < 0.3:
            device_name = next(d["name"] for d in NETWORK_DEVICES if iface in d["interfaces"])
            alert = {
                "id": f"alert_{int(time.time() * 1000)}_{random.randint(1000, 9999)}",
                "timestamp": now.isoformat(),
                "time": now.strftime("%H:%M:%S"),
                "device": device_name,
                "interface": iface["name"],
                "problem": "High Congestion Detected",
                "severity": "critical",
                "action": "Auto-Throttle Activated",
                "confidence": round(random.uniform(88, 98), 1),
                "utilization": iface["utilization"],
            }
            _noc_state["alert_timeline"].insert(0, alert)

    # Keep only last 30 alerts
    _noc_state["alert_timeline"] = _noc_state["alert_timeline"][:30]

    # Active congestion events
    active_congestion = []
    for dev in NETWORK_DEVICES:
        for iface in dev["interfaces"]:
            if iface["status"] == "congested":
                active_congestion.append({
                    "device": dev["name"],
                    "device_id": dev["id"],
                    "interface": iface["name"],
                    "utilization": iface["utilization"],
                    "severity": "critical" if iface["utilization"] >= 90 else "high",
                    "confidence": round(random.uniform(85, 98), 1),
                    "congestion_probability": round(random.uniform(0.85, 0.98), 3),
                    "detected_at": now.isoformat(),
                })

    # SHAP features (with slight variation)
    shap_features = [
        {**f, "importance": round(f["importance"] * random.uniform(0.95, 1.05), 2)}
        for f in SHAP_FEATURES
    ]

    # Recommended actions for top contributors
    recommendations = []
    for host in CONTRIBUTING_HOSTS[:3]:
        if host["culprit_score"] >= 85:
            action = "Block"
            priority = "critical"
            color = "#EF4444"
        elif host["culprit_score"] >= 70:
            action = "Throttle Bandwidth"
            priority = "high"
            color = "#F59E0B"
        elif host["culprit_score"] >= 50:
            action = "Monitor"
            priority = "medium"
            color = "#0EA5E9"
        else:
            action = "Allow"
            priority = "low"
            color = "#10B981"

        recommendations.append({
            "host": host["ip"],
            "hostname": host["hostname"],
            "culprit_score": host["culprit_score"],
            "action": action,
            "priority": priority,
            "color": color,
            "reason": host["reason"],
            "traffic_contribution": host["traffic_contribution"],
        })

    return {
        "timestamp": now.isoformat(),
        "uptime_seconds": int(uptime),
        # Network Health Overview
        "network_health": {
            "status": network_status,
            "status_color": status_color,
            "active_interfaces": active_ifaces,
            "warning_interfaces": warning_ifaces,
            "congested_interfaces": congested_ifaces,
            "total_interfaces": total_interfaces,
            "congestion_events": len(active_congestion),
            "avg_latency_ms": avg_latency,
            "avg_jitter_ms": avg_jitter,
            "packet_loss_rate": avg_packet_loss,
            "total_throughput_mbps": round(total_throughput, 1),
            "throughput_in": round(total_throughput_in, 1),
            "throughput_out": round(total_throughput_out, 1),
            "avg_utilization": round(avg_utilization, 1),
            "total_devices": len(NETWORK_DEVICES),
            "online_devices": sum(1 for d in NETWORK_DEVICES if d["status"] == "online"),
            "warning_devices": sum(1 for d in NETWORK_DEVICES if d["status"] == "warning"),
        },
        # Device Monitoring
        "devices": NETWORK_DEVICES,
        # Topology
        "topology": {
            "nodes": [{"id": d["id"], "name": d["name"], "type": d["type"], "ip": d["ip"], "status": d["status"], "role": d["role"]} for d in NETWORK_DEVICES],
            "links": TOPOLOGY_LINKS,
        },
        # Real-time traffic history
        "traffic_history": _noc_state["traffic_history"][-30:],
        # Congestion Detection
        "congestion_events": active_congestion,
        # RCA - Top Contributing Hosts
        "top_contributors": CONTRIBUTING_HOSTS,
        # SHAP Features
        "shap_features": shap_features,
        # Recommended Actions
        "recommendations": recommendations,
        # Alert Timeline
        "alert_timeline": _noc_state["alert_timeline"][:15],
        # Statistics
        "stats": {
            "total_packets_processed": _noc_state["total_packets_processed"],
            "total_flows_analyzed": _noc_state["total_flows_analyzed"],
            "total_alerts": len(_noc_state["alert_timeline"]),
        },
    }
