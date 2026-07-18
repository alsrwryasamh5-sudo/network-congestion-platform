"""
Live Network Simulator
======================
 Generates realistic real-time network traffic data for live monitoring.
 Simulates network flows, host activity, and congestion events as they
 would appear in a production network monitoring system.
"""
import random
import time
import numpy as np
from datetime import datetime, timezone
from typing import Dict, Any, List
from app.utils.logger import logger


# Simulated network hosts
NETWORK_HOSTS = [
    {"ip": "10.0.1.10", "name": "Web Server 01", "type": "Web Server", "zone": "DMZ"},
    {"ip": "10.0.1.11", "name": "Web Server 02", "type": "Web Server", "zone": "DMZ"},
    {"ip": "10.0.2.10", "name": "Database Primary", "type": "Database", "zone": "Internal"},
    {"ip": "10.0.2.11", "name": "Database Replica", "type": "Database", "zone": "Internal"},
    {"ip": "10.0.3.10", "name": "File Server", "type": "File Server", "zone": "Internal"},
    {"ip": "10.0.4.10", "name": "Mail Server", "type": "Mail Server", "zone": "DMZ"},
    {"ip": "10.0.5.10", "name": "DNS Server", "type": "DNS", "zone": "Internal"},
    {"ip": "10.0.99.50", "name": "Suspicious Host A", "type": "Unknown", "zone": "External"},
    {"ip": "10.0.99.51", "name": "Suspicious Host B", "type": "Unknown", "zone": "External"},
    {"ip": "192.168.1.20", "name": "Workstation-PC01", "type": "Workstation", "zone": "Office"},
    {"ip": "192.168.1.21", "name": "Workstation-PC02", "type": "Workstation", "zone": "Office"},
    {"ip": "192.168.2.30", "name": "IoT Camera 01", "type": "IoT Device", "zone": "IoT"},
    {"ip": "192.168.2.31", "name": "IoT Sensor 01", "type": "IoT Device", "zone": "IoT"},
    {"ip": "172.16.1.10", "name": "App Server 01", "type": "App Server", "zone": "Internal"},
    {"ip": "172.16.1.11", "name": "App Server 02", "type": "App Server", "zone": "Internal"},
    {"ip": "175.45.176.0", "name": "External Attacker", "type": "Attacker", "zone": "External"},
    {"ip": "59.166.0.4", "name": "Heavy User", "type": "Heavy User", "zone": "External"},
    {"ip": "149.171.126.16", "name": "Remote Client", "type": "Client", "zone": "External"},
]

PROTOCOLS = ["TCP", "UDP", "ICMP", "HTTPS", "HTTP", "SSH", "DNS", "SMTP"]
COMMON_PORTS = [80, 443, 22, 53, 25, 3389, 8080, 3306, 5432, 21, 5060]
ATTACK_TYPES = ["Benign", "Exploits", "DoS", "Fuzzers", "Reconnaissance", "Generic"]


# In-memory state for live monitoring
_live_state = {
    "started_at": datetime.now(timezone.utc),
    "total_flows_simulated": 0,
    "current_flows": [],
    "active_alerts": [],
    "history": [],  # last 60 data points
    "hosts_status": {},
}

# Initialize hosts status
for host in NETWORK_HOSTS:
    _live_state["hosts_status"][host["ip"]] = {
        **host,
        "status": "online",
        "flows_per_sec": random.uniform(5, 50),
        "bytes_in": 0,
        "bytes_out": 0,
        "latency_ms": random.uniform(10, 80),
        "packet_loss": random.uniform(0, 1),
        "threat_level": "low",
    }


def _generate_flow() -> Dict[str, Any]:
    """Generate a single realistic network flow."""
    src = random.choice(NETWORK_HOSTS)
    dst = random.choice(NETWORK_HOSTS)
    while dst["ip"] == src["ip"]:
        dst = random.choice(NETWORK_HOSTS)

    is_suspicious = src["type"] in ("Attacker", "Unknown") or dst["type"] in ("Attacker", "Unknown")
    is_heavy = src["type"] == "Heavy User" or "Database" in src["type"]

    proto = random.choice(PROTOCOLS)
    port = random.choice(COMMON_PORTS)

    if is_suspicious:
        bytes_out = random.randint(100000, 1000000)
        bytes_in = random.randint(50000, 500000)
        latency = random.uniform(150, 400)
        jitter = random.uniform(100, 300)
        packet_loss = random.uniform(2, 15)
        threat = random.choice(["Exploits", "DoS", "Reconnaissance", "Fuzzers"])
        risk_score = random.uniform(70, 100)
    elif is_heavy:
        bytes_out = random.randint(50000, 300000)
        bytes_in = random.randint(30000, 200000)
        latency = random.uniform(80, 200)
        jitter = random.uniform(40, 120)
        packet_loss = random.uniform(0.5, 3)
        threat = "Benign (Heavy User)"
        risk_score = random.uniform(40, 70)
    else:
        bytes_out = random.randint(1000, 50000)
        bytes_in = random.randint(500, 30000)
        latency = random.uniform(10, 80)
        jitter = random.uniform(5, 40)
        packet_loss = random.uniform(0, 1)
        threat = "Benign"
        risk_score = random.uniform(0, 40)

    return {
        "id": f"flow_{int(time.time() * 1000)}_{random.randint(1000, 9999)}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": src["ip"],
        "src_name": src["name"],
        "dst_ip": dst["ip"],
        "dst_name": dst["name"],
        "protocol": proto,
        "port": port,
        "bytes_in": bytes_in,
        "bytes_out": bytes_out,
        "latency_ms": round(latency, 2),
        "jitter_ms": round(jitter, 2),
        "packet_loss_pct": round(packet_loss, 2),
        "threat_type": threat,
        "risk_score": round(risk_score, 1),
        "status": "blocked" if risk_score >= 90 else "throttled" if risk_score >= 70 else "allowed",
    }


def get_live_network_status() -> Dict[str, Any]:
    """
    Get current live network status.
    Generates new flows, updates host stats, and returns a snapshot.
    """
    now = datetime.now(timezone.utc)
    uptime_seconds = (now - _live_state["started_at"]).total_seconds()

    # Generate 3-8 new flows per call (simulating real-time traffic)
    n_new_flows = random.randint(3, 8)
    new_flows = [_generate_flow() for _ in range(n_new_flows)]
    _live_state["total_flows_simulated"] += n_new_flows

    # Keep only last 50 flows
    _live_state["current_flows"] = (new_flows + _live_state["current_flows"])[:50]

    # Generate alerts for high-risk flows
    for flow in new_flows:
        if flow["risk_score"] >= 80:
            alert = {
                "id": f"alert_{flow['id']}",
                "timestamp": flow["timestamp"],
                "type": "critical" if flow["risk_score"] >= 90 else "warning",
                "source_ip": flow["src_ip"],
                "source_name": flow["src_name"],
                "threat_type": flow["threat_type"],
                "risk_score": flow["risk_score"],
                "message": f"High-risk flow from {flow['src_ip']} ({flow['threat_type']})",
                "action_taken": flow["status"],
            }
            _live_state["active_alerts"] = ([alert] + _live_state["active_alerts"])[:20]

    # Update host statistics
    for ip, host in _live_state["hosts_status"].items():
        # Add some random variation
        host["flows_per_sec"] = max(1, host["flows_per_sec"] + random.uniform(-5, 5))
        host["bytes_in"] += random.randint(1000, 100000)
        host["bytes_out"] += random.randint(1000, 100000)
        host["latency_ms"] = max(5, host["latency_ms"] + random.uniform(-10, 10))
        host["packet_loss"] = max(0, host["packet_loss"] + random.uniform(-0.3, 0.3))

        # Update threat level based on host type
        if host["type"] == "Attacker":
            host["threat_level"] = "critical"
            host["status"] = "blocked"
        elif host["type"] == "Unknown":
            host["threat_level"] = random.choice(["high", "medium"])
            host["status"] = "monitored"
        elif host["type"] == "Heavy User":
            host["threat_level"] = "medium"
            host["status"] = "throttled"
        else:
            host["threat_level"] = "low"
            host["status"] = "online"

    # Add to history (keep last 60 points)
    history_point = {
        "timestamp": now.isoformat(),
        "total_flows": _live_state["total_flows_simulated"],
        "active_flows": len(_live_state["current_flows"]),
        "alerts_count": len(_live_state["active_alerts"]),
        "avg_latency": round(np.mean([h["latency_ms"] for h in _live_state["hosts_status"].values()]), 2),
        "avg_packet_loss": round(np.mean([h["packet_loss"] for h in _live_state["hosts_status"].values()]), 2),
        "total_throughput_mbps": round(
            sum(h["bytes_out"] + h["bytes_in"] for h in _live_state["hosts_status"].values()) / 1_000_000, 2
        ),
    }
    _live_state["history"].append(history_point)
    _live_state["history"] = _live_state["history"][-60:]

    # Calculate summary stats
    hosts = list(_live_state["hosts_status"].values())
    online_count = sum(1 for h in hosts if h["status"] == "online")
    blocked_count = sum(1 for h in hosts if h["status"] == "blocked")
    monitored_count = sum(1 for h in hosts if h["status"] == "monitored")

    return {
        "timestamp": now.isoformat(),
        "uptime_seconds": int(uptime_seconds),
        "summary": {
            "total_hosts": len(hosts),
            "online_hosts": online_count,
            "blocked_hosts": blocked_count,
            "monitored_hosts": monitored_count,
            "active_flows": len(_live_state["current_flows"]),
            "total_flows_simulated": _live_state["total_flows_simulated"],
            "active_alerts": len(_live_state["active_alerts"]),
            "avg_latency_ms": round(np.mean([h["latency_ms"] for h in hosts]), 2),
            "avg_packet_loss": round(np.mean([h["packet_loss"] for h in hosts]), 2),
            "total_throughput_mbps": history_point["total_throughput_mbps"],
            "network_risk_level": "High" if len(_live_state["active_alerts"]) > 5 else "Medium" if len(_live_state["active_alerts"]) > 2 else "Low",
        },
        "recent_flows": _live_state["current_flows"][:15],
        "active_alerts": _live_state["active_alerts"][:10],
        "hosts_status": list(_live_state["hosts_status"].values()),
        "history": _live_state["history"][-30:],
    }
# Live Monitoring - Last updated: Fri Jul 10 22:45:21 UTC 2026
