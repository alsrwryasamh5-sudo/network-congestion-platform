"""
ML Pipeline - Reproduces the original notebook logic
====================================================
 Faithful port of Last_OP.ipynb with persistence (joblib).
  - QoS feature engineering
  - Congestion score derivation (Z-score against IsolationForest baseline)
  - Stacking classifier (DecisionTree + XGBoost -> LogisticRegression)
  - SHAP TreeExplainer on the XGBoost base estimator
  - DBSCAN clustering per time window
  - Root Cause Analysis (Culprit Score)
"""
import os
import json
import numpy as np
import pandas as pd
import joblib
from datetime import datetime, timezone
from typing import Tuple, Dict, List, Optional, Any

from sklearn.ensemble import IsolationForest
from sklearn.tree import DecisionTreeClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import StackingClassifier
from sklearn.preprocessing import RobustScaler, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, f1_score, roc_auc_score,
    confusion_matrix, roc_curve, auc,
    precision_score, recall_score,
)
from sklearn.cluster import DBSCAN
from xgboost import XGBClassifier

try:
    import shap
    _SHAP_AVAILABLE = True
except Exception:
    _SHAP_AVAILABLE = False

from app.utils.logger import logger


# ---------------------------------------------------------------------------
# Constants — exactly matches the notebook
# ---------------------------------------------------------------------------
RANDOM_STATE = 42

# Columns that MUST be dropped before training (prevent leakage/identity/volume bias)
LEAKAGE_COLUMNS = [
    "IPV4_SRC_ADDR", "IPV4_DST_ADDR", "FLOW_START_MILLISECONDS",
    "FLOW_END_MILLISECONDS", "DNS_QUERY_ID",
    "Label", "Attack", "Congestion_Score",
    "Delay", "PacketLoss", "Jitter", "Avg_Throughput",  # derived -> leakage
    "IN_BYTES", "OUT_BYTES", "IN_PKTS", "OUT_PKTS",  # raw volume -> bias
]

# Default 44 features (will be recomputed from data)
DEFAULT_FEATURE_COLUMNS: List[str] = [
    "DST_TO_SRC_IAT_STDDEV", "SRC_TO_DST_IAT_AVG", "SRC_TO_DST_IAT_STDDEV",
    "DST_TO_SRC_IAT_AVG", "DST_TO_SRC_SECOND_BYTES", "FLOW_DURATION_MILLISECONDS",
    "SRC_TO_DST_IAT_MAX", "L4_DST_PORT", "DURATION_OUT", "NUM_PKTS_UP_TO_128_BYTES",
    "SRC_TO_DST_SECOND_BYTES", "RETRANSMITTED_OUT_PKTS", "DST_TO_SRC_AVG_THROUGHPUT",
    "SRC_TO_DST_AVG_THROUGHPUT", "MIN_IP_PKT_LEN", "DURATION_IN", "TCP_WIN_MAX_OUT",
    "PROTOCOL", "DST_TO_SRC_IAT_MAX", "DST_TO_SRC_IAT_MIN", "L7_PROTO", "TCP_FLAGS",
    "CLIENT_TCP_FLAGS", "SRC_TO_DST_IAT_MIN", "FTP_COMMAND_RET_CODE", "DNS_TTL_ANSWER",
    "DNS_QUERY_TYPE", "ICMP_IPV4_TYPE", "ICMP_TYPE", "TCP_WIN_MAX_IN", "MAX_IP_PKT_LEN",
    "NUM_PKTS_1024_TO_1514_BYTES", "NUM_PKTS_512_TO_1024_BYTES", "NUM_PKTS_256_TO_512_BYTES",
    "NUM_PKTS_128_TO_256_BYTES", "SERVER_TCP_FLAGS", "MIN_TTL", "MAX_TTL",
    "RETRANSMITTED_OUT_BYTES", "RETRANSMITTED_IN_PKTS", "RETRANSMITTED_IN_BYTES",
    "LONGEST_FLOW_PKT", "SHORTEST_FLOW_PKT", "L4_SRC_PORT",
]


# ---------------------------------------------------------------------------
# 1. QoS Feature Engineering (Cell 3 of the notebook)
# ---------------------------------------------------------------------------
def engineer_qos_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add Delay, Jitter, Avg_Throughput, PacketLoss weighted by packet counts."""
    df = df.copy()

    in_pkts = df.get("IN_PKTS", pd.Series(0, index=df.index))
    out_pkts = df.get("OUT_PKTS", pd.Series(0, index=df.index))
    total_pkts = in_pkts + out_pkts

    src_iat_avg = df.get("SRC_TO_DST_IAT_AVG", pd.Series(0, index=df.index))
    dst_iat_avg = df.get("DST_TO_SRC_IAT_AVG", pd.Series(0, index=df.index))
    src_iat_std = df.get("SRC_TO_DST_IAT_STDDEV", pd.Series(0, index=df.index))
    dst_iat_std = df.get("DST_TO_SRC_IAT_STDDEV", pd.Series(0, index=df.index))
    src_thru = df.get("SRC_TO_DST_AVG_THROUGHPUT", pd.Series(0, index=df.index))
    dst_thru = df.get("DST_TO_SRC_AVG_THROUGHPUT", pd.Series(0, index=df.index))
    ret_in_pkts = df.get("RETRANSMITTED_IN_PKTS", pd.Series(0, index=df.index))
    ret_out_pkts = df.get("RETRANSMITTED_OUT_PKTS", pd.Series(0, index=df.index))

    df["Delay"] = np.where(
        total_pkts > 0,
        ((src_iat_avg * in_pkts) + (dst_iat_avg * out_pkts)) / total_pkts,
        0.0,
    )
    df["Jitter"] = np.where(
        total_pkts > 0,
        ((src_iat_std * in_pkts) + (dst_iat_std * out_pkts)) / total_pkts,
        0.0,
    )
    df["Avg_Throughput"] = src_thru + dst_thru
    df["PacketLoss"] = (ret_in_pkts + ret_out_pkts) / (total_pkts + 1.0)
    return df


# ---------------------------------------------------------------------------
# 2. Congestion Score (IsolationForest baseline + Z-scores)
# ---------------------------------------------------------------------------
def compute_congestion_score(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    """Return (df_with_congestion_score, baseline_stats_dict)."""
    df = df.copy()
    win_in = df.get("TCP_WIN_MAX_IN", pd.Series(0, index=df.index))
    win_out = df.get("TCP_WIN_MAX_OUT", pd.Series(0, index=df.index))
    label_col = df.get("Label", pd.Series(0, index=df.index))

    pure_mask = (
        (label_col == 0)
        & (df["PacketLoss"] == 0)
        & (win_in > 0)
        & (win_out > 0)
        & (df["Avg_Throughput"] > 0)
    )
    pure_df = df.loc[pure_mask].copy()
    if pure_df.empty:
        # fallback: use all rows as baseline
        pure_df = df.copy()

    iso_features = ["Delay", "Jitter", "Avg_Throughput", "TCP_WIN_MAX_IN", "TCP_WIN_MAX_OUT"]
    iso_features = [c for c in iso_features if c in pure_df.columns]
    iso_scaler = StandardScaler()
    scaled_iso = iso_scaler.fit_transform(pure_df[iso_features].fillna(0))
    iso_model = IsolationForest(contamination=0.05, random_state=RANDOM_STATE, n_jobs=-1)
    inliers = iso_model.fit_predict(scaled_iso) == 1
    final_pure = pure_df.loc[inliers]

    baseline = {
        "delay_mean": float(final_pure["Delay"].mean()),
        "delay_std": float(final_pure["Delay"].std()),
        "jitter_mean": float(final_pure["Jitter"].mean()),
        "jitter_std": float(final_pure["Jitter"].std()),
        "thru_mean": float(final_pure["Avg_Throughput"].mean()),
        "thru_std": float(final_pure["Avg_Throughput"].std()),
        "loss_mean": float(final_pure["PacketLoss"].mean()),
        "out_bytes_mean": float(final_pure.get("OUT_BYTES", pd.Series(0)).mean()),
    }

    z_delay = (df["Delay"] - baseline["delay_mean"]) / (baseline["delay_std"] + 1e-6)
    z_jitter = (df["Jitter"] - baseline["jitter_mean"]) / (baseline["jitter_std"] + 1e-6)
    z_thru = (df["Avg_Throughput"] - baseline["thru_mean"]) / (baseline["thru_std"] + 1e-6)
    weight_loss = df["PacketLoss"] * 10.0
    df["Congestion_Score"] = (z_delay + z_jitter + weight_loss) - z_thru

    baseline["iso_scaler"] = iso_scaler
    baseline["iso_model"] = iso_model
    return df, baseline


# ---------------------------------------------------------------------------
# 3. Training Pipeline
# ---------------------------------------------------------------------------
def prepare_training_data(
    df: pd.DataFrame,
    test_size: float = 0.2,
    noise_rate: float = 0.027,
    quantile: float = 0.90,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, list, RobustScaler]:
    """Return X_train, X_test, y_train, y_test, feature_columns, scaler."""
    if "Congestion_Score" not in df.columns:
        df, _ = compute_congestion_score(df)

    y_actual = (df["Congestion_Score"] > df["Congestion_Score"].quantile(quantile)).astype(int)
    rng = np.random.default_rng(RANDOM_STATE)
    noise_mask = rng.random(len(y_actual)) < noise_rate
    y = y_actual.copy()
    y[noise_mask] = 1 - y[noise_mask]

    X_raw = df.drop(columns=[c for c in LEAKAGE_COLUMNS if c in df.columns], errors="ignore")
    X = X_raw.select_dtypes(include=[np.number]).copy()
    feature_columns = list(X.columns)

    X_train_raw, X_test_raw, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=RANDOM_STATE, stratify=y
    )
    scaler = RobustScaler()
    X_train_scaled = scaler.fit_transform(X_train_raw).astype(np.float32)
    X_test_scaled = scaler.transform(X_test_raw).astype(np.float32)
    return X_train_scaled, X_test_scaled, y_train.values, y_test.values, feature_columns, scaler


def build_stacking_model() -> StackingClassifier:
    """Build the exact StackingClassifier from the notebook."""
    dt_baseline = DecisionTreeClassifier(
        max_depth=3, min_samples_leaf=60, random_state=RANDOM_STATE
    )
    xgb_baseline = XGBClassifier(
        n_estimators=35, max_depth=3, learning_rate=0.06,
        random_state=RANDOM_STATE, eval_metric="logloss", n_jobs=-1,
    )
    meta_model = LogisticRegression(C=0.08, random_state=RANDOM_STATE)
    stacking_model = StackingClassifier(
        estimators=[("Decision_Tree", dt_baseline), ("XGBoost", xgb_baseline)],
        final_estimator=meta_model,
        cv=5,
        stack_method="predict_proba",
        n_jobs=-1,
    )
    return stacking_model


def train_full_pipeline(
    df: pd.DataFrame,
    artifacts_dir: str,
    experiment_name: str = "stacking_default",
) -> Dict[str, Any]:
    """End-to-end training -> save artifacts -> return metrics dict."""
    os.makedirs(artifacts_dir, exist_ok=True)
    started_at = datetime.now(timezone.utc)

    logger.info("Engineering QoS features...")
    df = engineer_qos_features(df)
    logger.info("Computing congestion score...")
    df, baseline = compute_congestion_score(df)

    logger.info("Preparing training data...")
    X_train, X_test, y_train, y_test, feature_columns, scaler = prepare_training_data(df)

    logger.info("Building & training Stacking model...")
    model = build_stacking_model()
    model.fit(X_train, y_train)

    # Metrics
    preds = model.predict(X_test)
    probs = model.predict_proba(X_test)[:, 1]
    accuracy = float(accuracy_score(y_test, preds))
    f1 = float(f1_score(y_test, preds))
    auc_score = float(roc_auc_score(y_test, probs))
    precision = float(precision_score(y_test, preds, zero_division=0))
    recall = float(recall_score(y_test, preds, zero_division=0))
    cm = confusion_matrix(y_test, preds).tolist()
    fpr, tpr, _ = roc_curve(y_test, probs)
    roc_curve_data = {"fpr": fpr.tolist(), "tpr": tpr.tolist()}

    # Also train the DT & XGB standalone for comparison
    dt_model = DecisionTreeClassifier(max_depth=3, min_samples_leaf=60, random_state=RANDOM_STATE)
    dt_model.fit(X_train, y_train)
    dt_metrics = {
        "accuracy": float(accuracy_score(y_test, dt_model.predict(X_test))),
        "f1": float(f1_score(y_test, dt_model.predict(X_test))),
        "auc": float(roc_auc_score(y_test, dt_model.predict_proba(X_test)[:, 1])),
    }
    xgb_model = XGBClassifier(
        n_estimators=35, max_depth=3, learning_rate=0.06,
        random_state=RANDOM_STATE, eval_metric="logloss", n_jobs=-1,
    )
    xgb_model.fit(X_train, y_train)
    xgb_metrics = {
        "accuracy": float(accuracy_score(y_test, xgb_model.predict(X_test))),
        "f1": float(f1_score(y_test, xgb_model.predict(X_test))),
        "auc": float(roc_auc_score(y_test, xgb_model.predict_proba(X_test)[:, 1])),
    }

    # SHAP explainer on the XGBoost base estimator inside the stacking ensemble
    shap_explainer = None
    if _SHAP_AVAILABLE:
        try:
            xgb_inside = model.named_estimators_["XGBoost"]
            shap_explainer = shap.TreeExplainer(xgb_inside)
            logger.info("SHAP TreeExplainer attached to XGBoost base estimator.")
        except Exception as e:
            logger.warning(f"SHAP explainer init failed: {e}")

    # Save artifacts
    model_path = os.path.join(artifacts_dir, "stacking_model.joblib")
    scaler_path = os.path.join(artifacts_dir, "scaler.joblib")
    iso_model_path = os.path.join(artifacts_dir, "iso_model.joblib")
    iso_scaler_path = os.path.join(artifacts_dir, "iso_scaler.joblib")
    baseline_path = os.path.join(artifacts_dir, "baseline_stats.joblib")
    feature_cols_path = os.path.join(artifacts_dir, "feature_columns.joblib")
    shap_explainer_path = os.path.join(artifacts_dir, "shap_explainer.joblib")
    metrics_path = os.path.join(artifacts_dir, "metrics.json")

    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(baseline.get("iso_model"), iso_model_path)
    joblib.dump(baseline.get("iso_scaler"), iso_scaler_path)
    # Strip the model/scaler objects before saving baseline stats (keep only numbers)
    baseline_stats_clean = {k: v for k, v in baseline.items() if k not in ("iso_model", "iso_scaler")}
    joblib.dump(baseline_stats_clean, baseline_path)
    joblib.dump(feature_columns, feature_cols_path)
    if shap_explainer is not None:
        joblib.dump(shap_explainer, shap_explainer_path)

    completed_at = datetime.now(timezone.utc)
    duration = (completed_at - started_at).total_seconds()

    metrics = {
        "experiment_name": experiment_name,
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat(),
        "duration_seconds": duration,
        "n_rows": int(len(df)),
        "n_features": len(feature_columns),
        "feature_columns": feature_columns,
        "models": {
            "decision_tree": dt_metrics,
            "xgboost": xgb_metrics,
            "stacking": {
                "accuracy": accuracy, "f1": f1, "auc": auc_score,
                "precision": precision, "recall": recall,
            },
        },
        "confusion_matrix": cm,
        "roc_curve": roc_curve_data,
        "artifacts": {
            "model": model_path,
            "scaler": scaler_path,
            "iso_model": iso_model_path,
            "iso_scaler": iso_scaler_path,
            "baseline_stats": baseline_path,
            "feature_columns": feature_cols_path,
            "shap_explainer": shap_explainer_path if shap_explainer is not None else None,
        },
    }
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2, default=str)

    logger.info(f"Training complete. Stacking accuracy={accuracy:.4f} f1={f1:.4f} auc={auc_score:.4f}")
    return metrics


# ---------------------------------------------------------------------------
# 4. Inference helpers
# ---------------------------------------------------------------------------
def predict_single(
    model,
    scaler,
    feature_columns: List[str],
    input_row: Dict[str, Any],
) -> Dict[str, Any]:
    """Run a single-flow prediction."""
    row_df = pd.DataFrame([input_row])
    # Ensure all expected feature columns exist
    for col in feature_columns:
        if col not in row_df.columns:
            row_df[col] = 0
    X = row_df[feature_columns].select_dtypes(include=[np.number]).fillna(0)
    # Re-align columns
    X = X.reindex(columns=feature_columns, fill_value=0)
    X_scaled = scaler.transform(X.values.astype(np.float32))
    pred = int(model.predict(X_scaled)[0])
    proba = float(model.predict_proba(X_scaled)[0, 1])
    return {
        "predicted_label": pred,
        "predicted_probability": proba,
        "confidence": max(proba, 1 - proba),
        "is_congested": bool(pred == 1),
    }


def compute_shap_values(
    shap_explainer,
    scaler,
    feature_columns: List[str],
    input_row: Dict[str, Any],
    top_k: int = 10,
) -> Dict[str, Any]:
    """Return SHAP values for a single flow."""
    if shap_explainer is None:
        return {"available": False, "values": {}, "top_features": []}
    row_df = pd.DataFrame([input_row])
    for col in feature_columns:
        if col not in row_df.columns:
            row_df[col] = 0
    X = row_df[feature_columns].reindex(columns=feature_columns, fill_value=0)
    X_scaled = scaler.transform(X.values.astype(np.float32))
    try:
        shap_values = shap_explainer.shap_values(X_scaled)
        if isinstance(shap_values, list):
            shap_values = shap_values[1] if len(shap_values) > 1 else shap_values[0]
        shap_arr = np.array(shap_values).flatten()
    except Exception as e:
        logger.warning(f"SHAP computation failed: {e}")
        return {"available": False, "values": {}, "top_features": []}

    feature_to_shap = {feature_columns[i]: float(shap_arr[i]) for i in range(len(feature_columns))}
    # Sort by absolute contribution
    sorted_items = sorted(feature_to_shap.items(), key=lambda kv: abs(kv[1]), reverse=True)
    top_features = [
        {"feature": k, "shap_value": v, "value": float(input_row.get(k, 0))}
        for k, v in sorted_items[:top_k]
    ]
    # Contribution percentages
    total_abs = sum(abs(v) for _, v in sorted_items) + 1e-9
    top_with_contribution = [
        {**tf, "contribution_pct": abs(tf["shap_value"]) / total_abs * 100}
        for tf in top_features
    ]
    return {
        "available": True,
        "values": feature_to_shap,
        "top_features": top_with_contribution,
    }


# ---------------------------------------------------------------------------
# 5. Root Cause Analysis (Culprit Score)
# ---------------------------------------------------------------------------
def root_cause_analysis(
    input_row: Dict[str, Any],
    prediction_label: int,
    cluster_id: int = 0,
    baseline_stats: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """Compute Culprit Score and recommended mitigation."""
    baseline = baseline_stats or {}
    out_bytes = float(input_row.get("OUT_BYTES", 0))
    delay = float(input_row.get("Delay", input_row.get("SRC_TO_DST_IAT_AVG", 0)))
    packet_loss = float(input_row.get("PacketLoss", 0))

    baseline_out = baseline.get("out_bytes_mean", 0) or 1e-6
    baseline_delay = baseline.get("delay_mean", 0) or 1e-6
    baseline_loss = baseline.get("loss_mean", 0)

    # 1) Volume contribution (<=35)
    surge_ratio = out_bytes / (baseline_out + 1e-6)
    volume_contribution = min(surge_ratio * 4.0, 35.0)

    # 2) QoS impact (<=30)
    delay_degradation = max(0, (delay - baseline_delay) / (baseline_delay + 1e-6))
    loss_degradation = 15.0 if packet_loss > (baseline_loss + 0.01) else 0.0
    qos_impact_score = min(delay_degradation * 5.0 + loss_degradation, 30.0)

    # 3) AI support (35 if predicted congested)
    ai_support_score = 35.0 if prediction_label == 1 else 0.0

    # 4) Spatial penalty
    if cluster_id == -1:
        spatial_penalty = 20.0
    elif cluster_id > 0:
        spatial_penalty = 15.0
    else:
        spatial_penalty = 0.0

    total_rca = min(volume_contribution + qos_impact_score + ai_support_score + spatial_penalty, 100.0)

    # Severity
    if total_rca >= 75:
        severity = "critical"
        mitigation = (
            "Block the source IP immediately or throttle bandwidth by 50%. "
            "Investigate attack signature and isolate the host from the network segment."
        )
    elif total_rca >= 50:
        severity = "high"
        mitigation = (
            "Throttle bandwidth by 25-50%. Apply QoS policy to deprioritize this host's traffic."
        )
    elif total_rca >= 25:
        severity = "medium"
        mitigation = "Monitor traffic pattern closely. Apply soft rate limiting if conditions worsen."
    else:
        severity = "low"
        mitigation = "Allow nominal connection. No immediate action required."

    return {
        "host_responsible": input_row.get("IPV4_SRC_ADDR", "unknown"),
        "source_ip": input_row.get("IPV4_SRC_ADDR"),
        "destination_ip": input_row.get("IPV4_DST_ADDR"),
        "protocol": input_row.get("PROTOCOL"),
        "cluster_id": cluster_id,
        "volume_contribution": volume_contribution,
        "qos_impact_score": qos_impact_score,
        "ai_support_score": ai_support_score,
        "spatial_penalty": spatial_penalty,
        "total_rca_score": total_rca,
        "severity": severity,
        "recommended_mitigation": mitigation,
        "congestion_cause": _narrative(input_row, total_rca, delay, packet_loss, surge_ratio),
        "evidence": {
            "out_bytes": out_bytes,
            "delay_ms": delay,
            "packet_loss": packet_loss,
            "surge_ratio": surge_ratio,
        },
        "confidence": min(total_rca / 100.0 + 0.1, 1.0),
    }


def _narrative(row, score, delay, loss, surge) -> str:
    """Generate a human-readable root-cause narrative."""
    parts = []
    if score >= 75:
        parts.append("This host is a confirmed congestion culprit.")
    elif score >= 50:
        parts.append("This host is a likely contributor to network congestion.")
    else:
        parts.append("This host shows normal traffic behavior.")

    if surge > 1.5:
        parts.append(f"Outbound traffic is {surge:.1f}x the network baseline, indicating a volume surge.")
    if delay > 200:
        parts.append(f"High latency detected ({delay:.1f} ms) suggesting queuing delays.")
    if loss > 0.05:
        parts.append(f"Packet loss rate of {loss*100:.1f}% indicates buffer overflow or link degradation.")

    if not parts[1:]:
        parts.append("All QoS metrics are within acceptable thresholds.")
    return " ".join(parts)


# ---------------------------------------------------------------------------
# 6. DBSCAN clustering helper
# ---------------------------------------------------------------------------
def cluster_hosts(host_profiles: pd.DataFrame, eps: float = 0.7, min_samples: int = 2) -> pd.DataFrame:
    """Apply DBSCAN clustering to host profile features."""
    if host_profiles.empty:
        return host_profiles
    features = ["OUT_BYTES", "Delay", "PacketLoss"]
    features = [c for c in features if c in host_profiles.columns]
    if not features:
        host_profiles["Cluster"] = 0
        return host_profiles
    scaler = RobustScaler()
    scaled = scaler.fit_transform(host_profiles[features].fillna(0))
    db = DBSCAN(eps=eps, min_samples=min_samples)
    host_profiles["Cluster"] = db.fit_predict(scaled)
    return host_profiles
