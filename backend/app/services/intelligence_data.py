"""
Network Intelligence Service
=============================
 Provides the reference analytics data from the original notebook analysis.
 This data represents the real findings from the NF-UNSW-NB15-v3 dataset
 analysis (2.3M flows, 25 time windows, 329 unique hosts).
"""

# Reference data from the original notebook (Last_OP.ipynb)
# These are the actual computed values from the academic analysis

NETWORK_OVERVIEW = {
    "summary_cards": {
        "total_flows_25_windows": 4355,
        "total_hosts": 329,
        "culprit_hosts": 213,
        "normal_hosts": 116,
        "high_risk_ratio": 64.74,
        "model_accuracy": 97.00,
    },
    "host_distribution": [
        {"name": "Culprit Hosts", "value": 213, "color": "#EF4444"},
        {"name": "Normal Hosts", "value": 116, "color": "#10B981"},
    ],
    "quality_improvement": [
        {"metric": "Latency", "value": 67.33, "color": "#0EA5E9"},
        {"metric": "Jitter", "value": 83.77, "color": "#8B5CF6"},
        {"metric": "Packet Loss", "value": 59.02, "color": "#F59E0B"},
        {"metric": "QoS Restoration", "value": 64.74, "color": "#10B981"},
    ],
}

CULPRIT_MONITORING = {
    "summary_cards": {
        "critical_nodes": 213,
        "attack_nodes": 56,
        "heavy_users": 157,
        "highest_rca": 100.0,
    },
    "culprit_table": [
        {"ip": "175.45.176.0", "rca_score": 100.0, "device_type": "⚠️ Culprit Source", "behavior": "Exploits", "action": "Immediate Block"},
        {"ip": "175.45.176.1", "rca_score": 100.0, "device_type": "⚠️ Culprit Source", "behavior": "Fuzzers", "action": "Immediate Block"},
        {"ip": "175.45.176.2", "rca_score": 100.0, "device_type": "⚠️ Culprit Source", "behavior": "DoS", "action": "Immediate Block"},
        {"ip": "175.45.176.3", "rca_score": 100.0, "device_type": "⚠️ Culprit Source", "behavior": "Reconnaissance", "action": "Immediate Block"},
        {"ip": "175.45.176.3", "rca_score": 92.4, "device_type": "⚠️ Culprit Source", "behavior": "Fuzzers", "action": "Immediate Block"},
        {"ip": "59.166.0.4", "rca_score": 100.0, "device_type": "⚠️ Culprit Source", "behavior": "Benign (Heavy User)", "action": "Throttle Bandwidth 50%"},
        {"ip": "59.166.0.0", "rca_score": 98.9, "device_type": "⚠️ Culprit Source", "behavior": "Benign (Heavy User)", "action": "Throttle Bandwidth 50%"},
        {"ip": "59.166.0.7", "rca_score": 89.2, "device_type": "⚠️ Culprit Source", "behavior": "Benign (Heavy User)", "action": "Throttle Bandwidth 50%"},
        {"ip": "192.168.241.243", "rca_score": 85.0, "device_type": "⚠️ Culprit Source", "behavior": "Benign (Heavy User)", "action": "Throttle Bandwidth 50%"},
        {"ip": "10.40.85.1", "rca_score": 85.0, "device_type": "⚠️ Culprit Source", "behavior": "Benign (Heavy User)", "action": "Throttle Bandwidth 50%"},
        {"ip": "10.40.182.1", "rca_score": 65.0, "device_type": "Normal Host", "behavior": "Benign", "action": "Allow Connection"},
        {"ip": "149.171.126.16", "rca_score": 20.0, "device_type": "Normal Host", "behavior": "Benign", "action": "Allow Connection"},
    ],
}

THREAT_DISTRIBUTION = {
    "threat_sources": [
        {"name": "Heavy Users", "value": 157, "color": "#F59E0B"},
        {"name": "Cyber Attacks", "value": 56, "color": "#EF4444"},
    ],
    "attack_categories": [
        {"type": "Exploits", "count": 18},
        {"type": "Fuzzers", "count": 18},
        {"type": "Generic", "count": 8},
        {"type": "Reconnaissance", "count": 9},
        {"type": "DoS", "count": 3},
    ],
}

TRAFFIC_INTELLIGENCE = {
    "top_features": [
        {"feature": "DST_TO_SRC_IAT_STDDEV", "importance": 51.91},
        {"feature": "SRC_TO_DST_IAT_AVG", "importance": 22.64},
        {"feature": "SRC_TO_DST_IAT_STDDEV", "importance": 17.28},
        {"feature": "DST_TO_SRC_IAT_AVG", "importance": 3.32},
        {"feature": "DST_TO_SRC_SECOND_BYTES", "importance": 0.85},
        {"feature": "FLOW_DURATION_MILLISECONDS", "importance": 0.80},
        {"feature": "SRC_TO_DST_IAT_MAX", "importance": 0.72},
        {"feature": "L4_DST_PORT", "importance": 0.69},
        {"feature": "DURATION_OUT", "importance": 0.51},
        {"feature": "NUM_PKTS_UP_TO_128_BYTES", "importance": 0.38},
    ],
}

MITIGATION_EFFECTIVENESS = {
    "summary_cards": {
        "bandwidth_saved": "3.39 MB",
        "latency_reduction": 67.33,
        "jitter_reduction": 83.77,
        "packet_loss_reduction": 59.02,
        "qos_restoration": 64.74,
    },
    "behavior_comparison": [
        {"metric": "Latency (ms)", "normal": 196.48, "culprit": 278.55},
        {"metric": "Jitter (ms)", "normal": 51.29, "culprit": 218.27},
        {"metric": "Inbound Duration (s)", "normal": 2408, "culprit": 3523},
        {"metric": "Outbound Duration (s)", "normal": 329, "culprit": 1265},
    ],
}

AI_MODEL_STATUS = {
    "model": "Hybrid Stacking",
    "architecture": "DecisionTree + XGBoost → LogisticRegression",
    "accuracy": 97.00,
    "f1_score": 0.8645,
    "roc_auc": 0.8977,
    "precision": 0.86,
    "recall": 0.87,
    "training_samples": 2365477,
    "features": 44,
    "cv_folds": 5,
}

GLOBAL_INDICATORS = {
    "network_risk_level": "High",
    "active_congestion_events": 25,
    "average_rca_score": 82.6,
    "top_contributor_ip": "59.166.0.4",
    "last_detection_time": "09:38:35",
    "processing_time": "25 Analysis Windows",
    "total_flows_analyzed": 4355,
    "unique_hosts_monitored": 329,
}


def get_full_intelligence_report() -> dict:
    """Return the complete intelligence report combining all sections."""
    return {
        "network_overview": NETWORK_OVERVIEW,
        "culprit_monitoring": CULPRIT_MONITORING,
        "threat_distribution": THREAT_DISTRIBUTION,
        "traffic_intelligence": TRAFFIC_INTELLIGENCE,
        "mitigation_effectiveness": MITIGATION_EFFECTIVENESS,
        "ai_model_status": AI_MODEL_STATUS,
        "global_indicators": GLOBAL_INDICATORS,
    }
