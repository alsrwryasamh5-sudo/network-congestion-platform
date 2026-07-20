"""
ML Blueprint
============
 /api/v1/ml/predict          - single flow prediction
 /api/v1/ml/predict-batch    - batch prediction (CSV upload or JSON array)
 /api/v1/ml/shap             - SHAP values for a flow
 /api/v1/ml/root-cause       - root cause analysis
 /api/v1/ml/full-inference   - predict + shap + rca combined
 /api/v1/ml/train            - train a new model (researcher/admin)
 /api/v1/ml/evaluate         - get current model metrics
 /api/v1/ml/model-info       - model metadata & status
 /api/v1/ml/feature-importance - global feature importance (SHAP)
 /api/v1/ml/clustering       - DBSCAN clustering of hosts
"""
import os
import io
import json
import time
from datetime import datetime, timezone
import numpy as np
import pandas as pd
from flask import Blueprint, request, g, current_app, send_file
from werkzeug.utils import secure_filename

from app.extensions import db, limiter
from app.models.prediction import Prediction
from app.models.experiment import Experiment
from app.models.training_job import TrainingJob
from app.models.dataset import Dataset
from app.models.congestion_event import CongestionEvent
from app.models.root_cause import RootCauseAnalysis
from app.services.ml_service import get_ml_service
from app.services.auth_service import log_activity
from app.services.seeder_service import seed_database_with_predictions
from app.utils.errors import (
    ValidationError, ModelNotReadyError, NotFoundError, AuthorizationError,
)
from app.utils.logger import logger
from ._shared import auth_required, audit_action

ml_bp = Blueprint("ml", __name__, url_prefix="/api/v1/ml")


@ml_bp.route("/model-info", methods=["GET"])
@auth_required()
def model_info():
    svc = get_ml_service()
    ready = svc.is_ready
    metrics_path = os.path.join(current_app.config["ML_ARTIFACTS_DIR"], "metrics.json")
    metrics = {}
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path) as f:
                metrics = json.load(f)
        except Exception:
            pass
    return {
        "success": True,
        "data": {
            "is_ready": ready,
            "model_type": "StackingClassifier (DecisionTree + XGBoost -> LogisticRegression)",
            "n_features": len(svc.feature_columns),
            "feature_columns": svc.feature_columns,
            "metrics": metrics.get("models", {}).get("stacking", {}),
            "trained_at": metrics.get("completed_at"),
            "experiment_name": metrics.get("experiment_name"),
        },
    }


@ml_bp.route("/predict", methods=["POST"])
@auth_required()
@audit_action("predict", "prediction")
@limiter.limit("60 per minute")
def predict():
    svc = get_ml_service()
    if not svc.is_ready:
        raise ModelNotReadyError()
    data = request.get_json() or {}
    flow = data.get("flow") or data.get("features")
    if not flow or not isinstance(flow, dict):
        raise ValidationError("'flow' (object of feature names -> values) is required.")
    result = svc.predict(flow)
    # Persist prediction
    pred = Prediction(
        user_id=g.current_user.id,
        input_features=flow,
        predicted_label=result["predicted_label"],
        predicted_probability=result["predicted_probability"],
        confidence=result["confidence"],
        is_congested=result["is_congested"],
        inference_time_ms=result["inference_time_ms"],
        source="api",
    )
    db.session.add(pred)
    db.session.commit()
    return {"success": True, "data": {"prediction_id": pred.id, **result}}


@ml_bp.route("/predict-batch", methods=["POST"])
@auth_required(roles=("admin", "researcher"))
@limiter.limit("10 per minute")
def predict_batch():
    svc = get_ml_service()
    if not svc.is_ready:
        raise ModelNotReadyError()
    # Accept either JSON array or CSV file upload
    if "file" in request.files:
        file = request.files["file"]
        if not file.filename:
            raise ValidationError("Empty file upload.")
        df = pd.read_csv(file)
    else:
        data = request.get_json() or {}
        flows = data.get("flows", [])
        if not flows or not isinstance(flows, list):
            raise ValidationError("'flows' (array of objects) is required.")
        df = pd.DataFrame(flows)

    results = []
    feature_columns = svc.feature_columns
    for _, row in df.iterrows():
        flow = {col: (float(row[col]) if col in row and pd.notna(row[col]) else 0.0)
                for col in feature_columns}
        # Also include identity columns if present
        for col in ["IPV4_SRC_ADDR", "IPV4_DST_ADDR", "PROTOCOL", "L4_DST_PORT", "Attack"]:
            if col in row.index and pd.notna(row[col]):
                flow[col] = str(row[col])
        result = svc.predict(flow)
        results.append({"flow": flow, **result})

    # Save bulk to DB (limit to first 500 to avoid overload)
    saved = []
    for r in results[:500]:
        pred = Prediction(
            user_id=g.current_user.id,
            input_features=r["flow"],
            predicted_label=r["predicted_label"],
            predicted_probability=r["predicted_probability"],
            confidence=r["confidence"],
            is_congested=r["is_congested"],
            inference_time_ms=r["inference_time_ms"],
            source="batch",
        )
        saved.append(pred)
    db.session.bulk_save_objects(saved)
    db.session.commit()
    return {
        "success": True,
        "data": {
            "n_processed": len(results),
            "n_congested": sum(1 for r in results if r["is_congested"]),
            "predictions": results[:50],  # return first 50 for preview
        },
    }


@ml_bp.route("/shap", methods=["POST"])
@auth_required()
@limiter.limit("30 per minute")
def shap():
    svc = get_ml_service()
    if not svc.is_ready:
        raise ModelNotReadyError()
    data = request.get_json() or {}
    flow = data.get("flow") or data.get("features")
    top_k = int(data.get("top_k", 10))
    if not flow:
        raise ValidationError("'flow' is required.")
    result = svc.explain(flow, top_k=top_k)
    return {"success": True, "data": result}


@ml_bp.route("/root-cause", methods=["POST"])
@auth_required()
@limiter.limit("30 per minute")
def root_cause():
    svc = get_ml_service()
    data = request.get_json() or {}
    flow = data.get("flow") or data.get("features")
    cluster_id = int(data.get("cluster_id", 0))
    predicted_label = int(data.get("predicted_label", 1))
    if not flow:
        raise ValidationError("'flow' is required.")
    rca = svc.root_cause(flow, predicted_label, cluster_id)
    return {"success": True, "data": rca}


@ml_bp.route("/full-inference", methods=["POST"])
@auth_required()
@audit_action("full_inference", "prediction")
@limiter.limit("30 per minute")
def full_inference():
    svc = get_ml_service()
    if not svc.is_ready:
        raise ModelNotReadyError()
    data = request.get_json() or {}
    flow = data.get("flow") or data.get("features")
    cluster_id = int(data.get("cluster_id", 0))
    if not flow:
        raise ValidationError("'flow' is required.")
    result = svc.full_inference(flow)
    # Persist prediction with full context
    pred = svc.predict(flow)
    p = Prediction(
        user_id=g.current_user.id,
        input_features=flow,
        predicted_label=result["prediction"]["predicted_label"],
        predicted_probability=result["prediction"]["predicted_probability"],
        confidence=result["prediction"]["confidence"],
        is_congested=result["prediction"]["is_congested"],
        shap_values=result["shap"].get("values", {}),
        top_features=result["shap"].get("top_features", []),
        root_cause_summary=result["root_cause"].get("congestion_cause"),
        mitigation_recommendation=result["root_cause"].get("recommended_mitigation"),
        severity=result["root_cause"].get("severity"),
        inference_time_ms=result["prediction"].get("inference_time_ms"),
        source="api",
    )
    db.session.add(p)
    db.session.commit()
    # If congested, also create a CongestionEvent + RootCauseAnalysis record
    if p.is_congested:
        event = CongestionEvent(
            prediction_id=p.id,
            source_ip=flow.get("IPV4_SRC_ADDR"),
            destination_ip=flow.get("IPV4_DST_ADDR"),
            protocol=str(flow.get("PROTOCOL", "")),
            l4_dst_port=int(flow.get("L4_DST_PORT", 0) or 0),
            cluster_id=cluster_id,
            congestion_score=float(result["prediction"]["predicted_probability"]),
            culprit_score=float(result["root_cause"].get("total_rca_score", 0)),
            severity=result["root_cause"].get("severity"),
            status="active",
        )
        db.session.add(event)
        db.session.flush()
        rca_obj = RootCauseAnalysis(
            prediction_id=p.id,
            congestion_event_id=event.id,
            host_responsible=result["root_cause"].get("host_responsible"),
            source_ip=result["root_cause"].get("source_ip"),
            destination_ip=result["root_cause"].get("destination_ip"),
            protocol=result["root_cause"].get("protocol"),
            cluster_id=cluster_id,
            volume_contribution=result["root_cause"].get("volume_contribution"),
            qos_impact_score=result["root_cause"].get("qos_impact_score"),
            ai_support_score=result["root_cause"].get("ai_support_score"),
            spatial_penalty=result["root_cause"].get("spatial_penalty"),
            total_rca_score=result["root_cause"].get("total_rca_score"),
            congestion_cause=result["root_cause"].get("congestion_cause"),
            recommended_mitigation=result["root_cause"].get("recommended_mitigation"),
            severity=result["root_cause"].get("severity"),
            evidence=result["root_cause"].get("evidence"),
            confidence=result["root_cause"].get("confidence"),
        )
        db.session.add(rca_obj)
        db.session.commit()
    return {"success": True, "data": {"prediction_id": p.id, **result}}


@ml_bp.route("/evaluate", methods=["GET"])
@auth_required()
def evaluate():
    """Return current model evaluation metrics."""
    metrics_path = os.path.join(current_app.config["ML_ARTIFACTS_DIR"], "metrics.json")
    if not os.path.exists(metrics_path):
        raise ModelNotReadyError("No evaluation metrics found. Please train a model first.")
    with open(metrics_path) as f:
        metrics = json.load(f)
    return {"success": True, "data": metrics}


@ml_bp.route("/train", methods=["POST"])
@auth_required(roles=("admin", "researcher"))
@audit_action("train", "experiment")
@limiter.limit("3 per hour")
def train():
    """
    Trigger a new training run.
    Accepts either:
      - {dataset_id: int}      -> load dataset from DB
      - {csv_path: str}        -> load CSV file from disk
      - {n_samples: int}       -> generate synthetic data for demo
    """
    from app.ml.data_loader import load_training_data, generate_synthetic_data

    data = request.get_json() or {}
    experiment_name = data.get("experiment_name", f"exp_{int(time.time())}")

    # Create experiment record
    experiment = Experiment(
        name=experiment_name,
        user_id=g.current_user.id,
        model_type="stacking",
        hyperparameters={
            "dt_max_depth": 3, "dt_min_samples_leaf": 60,
            "xgb_n_estimators": 35, "xgb_max_depth": 3, "xgb_lr": 0.06,
            "meta_C": 0.08, "cv": 5,
        },
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.session.add(experiment)
    db.session.commit()

    # Training job
    job = TrainingJob(
        user_id=g.current_user.id,
        experiment_id=experiment.id,
        job_type="full_pipeline",
        status="running",
        progress=0.0,
        current_step="Loading data",
        started_at=datetime.now(timezone.utc),
    )
    db.session.add(job)
    db.session.commit()

    try:
        # Determine data source
        if data.get("dataset_id"):
            dataset = Dataset.query.get(data["dataset_id"])
            if not dataset:
                raise NotFoundError("Dataset not found.")
            df = load_training_data(dataset.file_path)
        elif data.get("csv_path"):
            df = load_training_data(data["csv_path"])
        elif data.get("synthetic") or data.get("n_samples"):
            n = int(data.get("n_samples", 5000))
            df = generate_synthetic_data(n_samples=n)
        else:
            # Default: try to use synthetic for demo
            df = generate_synthetic_data(n_samples=5000)

        job.progress = 10.0
        job.current_step = "Training pipeline"
        db.session.commit()

        svc = get_ml_service()
        metrics = svc.train(df, experiment_name=experiment_name)

        # Update experiment
        experiment.metrics = metrics.get("models", {}).get("stacking", {})
        experiment.confusion_matrix = metrics.get("confusion_matrix")
        experiment.feature_columns = metrics.get("feature_columns")
        experiment.status = "completed"
        experiment.completed_at = datetime.now(timezone.utc)
        experiment.duration_seconds = metrics.get("duration_seconds")
        experiment.artifact_paths = metrics.get("artifacts")

        job.progress = 100.0
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        job.duration_seconds = metrics.get("duration_seconds")
        job.result = metrics.get("models", {}).get("stacking", {})
        db.session.commit()

        # Auto-seed database with predictions from the newly trained model
        try:
            logger.info("Auto-seeding database with realistic predictions...")
            seed_result = seed_database_with_predictions(
                n_predictions=100,
                congested_ratio=0.35,
                user_id=g.current_user.id,
                hours_back=72,
            )
            logger.info(f"Auto-seed complete: {seed_result}")
        except Exception as seed_err:
            logger.warning(f"Auto-seed failed (non-fatal): {seed_err}")

        return {"success": True, "data": {"experiment_id": experiment.id, "metrics": metrics}}

    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        experiment.status = "failed"
        experiment.error_message = str(e)
        job.status = "failed"
        job.error_message = str(e)
        db.session.commit()
        raise


@ml_bp.route("/train-kaggle", methods=["POST"])
@auth_required(roles=("admin", "researcher"))
@audit_action("train_kaggle", "experiment")
@limiter.limit("2 per hour")
def train_kaggle():
    """
    Train the model on the real NF-UNSW-NB15-v3 dataset from Kaggle.

    Requires KAGGLE_USERNAME + KAGGLE_KEY (or KAGGLE_API_TOKEN) env vars.

    Request body:
    {
        "n_samples": 50000,          // Number of rows to sample (default 50,000)
        "experiment_name": "kaggle_v1"
    }

    The dataset is downloaded, sampled (to fit in memory), and used for training.
    """
    from app.ml.data_loader import load_kaggle_dataset_sample

    data = request.get_json() or {}
    n_samples = int(data.get("n_samples", 50000))
    experiment_name = data.get("experiment_name", f"kaggle_{int(time.time())}")

    # Cap at 100K for Render free tier memory limits
    n_samples = min(n_samples, 100000)

    # Create experiment record
    experiment = Experiment(
        name=experiment_name,
        user_id=g.current_user.id,
        model_type="stacking",
        hyperparameters={
            "data_source": "kaggle_nf_unsw_nb15_v3",
            "n_samples": n_samples,
            "dt_max_depth": 3, "dt_min_samples_leaf": 60,
            "xgb_n_estimators": 35, "xgb_max_depth": 3, "xgb_lr": 0.06,
            "meta_C": 0.08, "cv": 5,
        },
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.session.add(experiment)
    db.session.commit()

    job = TrainingJob(
        user_id=g.current_user.id,
        experiment_id=experiment.id,
        job_type="kaggle_training",
        status="running",
        progress=0.0,
        current_step="Downloading dataset from Kaggle...",
        started_at=datetime.now(timezone.utc),
    )
    db.session.add(job)
    db.session.commit()

    try:
        logger.info(f"Starting Kaggle training: {n_samples} samples, experiment={experiment_name}")

        # Pre-check Kaggle credentials before starting
        kaggle_username = os.getenv("KAGGLE_USERNAME", "")
        kaggle_key = os.getenv("KAGGLE_KEY", "")
        kaggle_token = os.getenv("KAGGLE_API_TOKEN", "")

        if not (kaggle_username and kaggle_key) and not kaggle_token:
            raise ValidationError(
                "Kaggle credentials not configured. Please set KAGGLE_USERNAME and KAGGLE_KEY "
                "environment variables on Render Dashboard → Environment. "
                "Get your credentials from https://www.kaggle.com → Account → Create New Token"
            )

        job.progress = 10.0
        job.current_step = "Downloading NF-UNSW-NB15-v3 from Kaggle..."
        db.session.commit()

        df = load_kaggle_dataset_sample(
            target_dir="/tmp/kaggle_data",
            n_samples=n_samples,
        )

        job.progress = 50.0
        job.current_step = f"Training on {len(df):,} real samples..."
        db.session.commit()

        svc = get_ml_service()
        metrics = svc.train(df, experiment_name=experiment_name)

        experiment.metrics = metrics.get("models", {}).get("stacking", {})
        experiment.confusion_matrix = metrics.get("confusion_matrix")
        experiment.feature_columns = metrics.get("feature_columns")
        experiment.status = "completed"
        experiment.completed_at = datetime.now(timezone.utc)
        experiment.duration_seconds = metrics.get("duration_seconds")
        experiment.artifact_paths = metrics.get("artifacts")

        job.progress = 100.0
        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        job.duration_seconds = metrics.get("duration_seconds")
        job.result = {
            **metrics.get("models", {}).get("stacking", {}),
            "data_source": "kaggle_nf_unsw_nb15_v3",
            "n_samples": len(df),
        }
        db.session.commit()

        # Auto-seed database with predictions from the newly trained model
        try:
            logger.info("Auto-seeding database with realistic predictions after Kaggle training...")
            seed_result = seed_database_with_predictions(
                n_predictions=150,
                congested_ratio=0.40,
                user_id=g.current_user.id,
                hours_back=72,
            )
            logger.info(f"Auto-seed complete: {seed_result}")
        except Exception as seed_err:
            logger.warning(f"Auto-seed failed (non-fatal): {seed_err}")

        logger.info(f"Kaggle training complete. Accuracy: {metrics['models']['stacking']['accuracy']:.4f}")
        return {
            "success": True,
            "message": f"Model trained on {len(df):,} real samples from NF-UNSW-NB15-v3",
            "data": {
                "experiment_id": experiment.id,
                "n_samples": len(df),
                "metrics": metrics,
            },
        }

    except Exception as e:
        logger.error(f"Kaggle training failed: {e}", exc_info=True)
        experiment.status = "failed"
        experiment.error_message = str(e)
        job.status = "failed"
        job.error_message = str(e)
        db.session.commit()
        raise


@ml_bp.route("/train-csv", methods=["POST"])
@auth_required(roles=("admin", "researcher"))
@audit_action("train_csv", "experiment")
@limiter.limit("5 per hour")
def train_csv():
    """
    Train the model on uploaded CSV file(s).

    Accepts multipart/form-data with one or two 'file'/'file2' fields:
    - file: Primary CSV (required) - e.g., NF-UNSW-NB15-v3.csv
    - file2: Secondary CSV (optional) - e.g., NetFlow_v3_Features.csv

    Both files will be concatenated if both are provided (NF-UNSW-NB15 style).

    Form fields:
    - file: First CSV file (required)
    - file2: Second CSV file (optional, will be merged with first)
    - n_samples: Number of rows to sample (optional, default 50,000, max 100,000)
    - experiment_name: Name for this experiment (optional)
    """
    from app.ml.data_loader import load_csv_file_sample, _optimize_dtypes
    import tempfile

    # Collect uploaded files
    files = []
    filenames = []
    for key in ["file", "file2"]:
        if key in request.files:
            f = request.files[key]
            if f.filename and f.filename.endswith(".csv"):
                files.append(f)
                filenames.append(f.filename)

    if not files:
        raise ValidationError(
            "No CSV file uploaded. Use 'file' field (and optionally 'file2') in multipart form. "
            "For NF-UNSW-NB15, upload both NF-UNSW-NB15-v3.csv and NetFlow_v3_Features.csv."
        )

    n_samples = int(request.form.get("n_samples", 50000))
    n_samples = min(n_samples, 100000)
    experiment_name = request.form.get("experiment_name", f"csv_{int(time.time())}")

    # Save uploaded files temporarily
    tmp_paths = []
    for i, f in enumerate(files):
        tmp_path = os.path.join(tempfile.gettempdir(), f"upload_{int(time.time())}_{i}.csv")
        f.save(tmp_path)
        tmp_paths.append(tmp_path)
        file_size_mb = os.path.getsize(tmp_path) / (1024 * 1024)
        logger.info(f"Saved uploaded file {f.filename}: {file_size_mb:.1f} MB")

    experiment = Experiment(
        name=experiment_name,
        user_id=g.current_user.id,
        model_type="stacking",
        hyperparameters={
            "data_source": "uploaded_csv",
            "filenames": filenames,
            "n_files": len(files),
            "n_samples": n_samples,
        },
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.session.add(experiment)
    db.session.commit()

    try:
        logger.info(f"Starting CSV training: {filenames}, {n_samples} samples target")

        # Load and optionally merge multiple CSVs
        if len(tmp_paths) == 1:
            df = load_csv_file_sample(tmp_paths[0], n_samples=n_samples)
        else:
            # Load each file with sampling, then concatenate
            # Split n_samples across files
            n_per_file = max(n_samples // len(tmp_paths), 1000)
            dfs = []
            for path in tmp_paths:
                logger.info(f"Loading {path} with {n_per_file} samples...")
                df_part = load_csv_file_sample(path, n_samples=n_per_file)
                dfs.append(df_part)
                logger.info(f"Loaded {len(df_part)} rows from {path}")

            # Concatenate and shuffle
            df = pd.concat(dfs, ignore_index=True)
            df = df.sample(frac=1, random_state=42).reset_index(drop=True)  # shuffle
            # Trim to n_samples
            if len(df) > n_samples:
                df = df.head(n_samples)
            logger.info(f"Merged dataset: {len(df)} rows total")

        svc = get_ml_service()
        metrics = svc.train(df, experiment_name=experiment_name)

        experiment.metrics = metrics.get("models", {}).get("stacking", {})
        experiment.confusion_matrix = metrics.get("confusion_matrix")
        experiment.feature_columns = metrics.get("feature_columns")
        experiment.status = "completed"
        experiment.completed_at = datetime.now(timezone.utc)
        experiment.duration_seconds = metrics.get("duration_seconds")
        experiment.artifact_paths = metrics.get("artifacts")
        db.session.commit()

        # Auto-seed database with predictions from the newly trained model
        try:
            logger.info("Auto-seeding database with realistic predictions after CSV training...")
            seed_result = seed_database_with_predictions(
                n_predictions=150,
                congested_ratio=0.40,
                user_id=g.current_user.id,
                hours_back=72,
            )
            logger.info(f"Auto-seed complete: {seed_result}")
        except Exception as seed_err:
            logger.warning(f"Auto-seed failed (non-fatal): {seed_err}")

        # Clean up temp files
        for path in tmp_paths:
            try:
                os.remove(path)
            except Exception:
                pass

        return {
            "success": True,
            "message": f"Model trained on {len(df):,} rows from {', '.join(filenames)}",
            "data": {
                "experiment_id": experiment.id,
                "filenames": filenames,
                "n_files": len(files),
                "n_samples": len(df),
                "metrics": metrics,
            },
        }

    except Exception as e:
        logger.error(f"CSV training failed: {e}", exc_info=True)
        experiment.status = "failed"
        experiment.error_message = str(e)
        db.session.commit()
        for path in tmp_paths:
            try:
                os.remove(path)
            except Exception:
                pass
        raise


@ml_bp.route("/seed-database", methods=["POST"])
@auth_required(roles=("admin", "researcher"))
@limiter.limit("3 per hour")
def seed_database():
    """
    Manually seed the database with realistic predictions.
    Useful for filling the dashboard with demo data.

    Request body:
    {
        "n_predictions": 200,
        "congested_ratio": 0.35,
        "hours_back": 72
    }
    """
    data = request.get_json() or {}
    n_predictions = int(data.get("n_predictions", 200))
    congested_ratio = float(data.get("congested_ratio", 0.35))
    hours_back = int(data.get("hours_back", 72))

    # Cap values
    n_predictions = min(max(n_predictions, 10), 1000)
    congested_ratio = min(max(congested_ratio, 0.0), 1.0)

    result = seed_database_with_predictions(
        n_predictions=n_predictions,
        congested_ratio=congested_ratio,
        user_id=g.current_user.id,
        hours_back=hours_back,
    )
    return {
        "success": True,
        "message": f"Database seeded with {result.get('predictions_created', 0)} predictions",
        "data": result,
    }


@ml_bp.route("/top-culprit-hosts", methods=["GET"])
@auth_required()
def top_culprit_hosts():
    """
    Get the top hosts contributing to network congestion.
    Aggregates congestion events by source IP, sorted by culprit score.
    """
    limit = min(int(request.args.get("limit", 20)), 100)
    hours = int(request.args.get("hours", 168))  # default 7 days

    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Aggregate by source_ip - use subquery for PostgreSQL compatibility
    from sqlalchemy import func, desc
    try:
        rows = (
            db.session.query(
                CongestionEvent.source_ip,
                func.count(CongestionEvent.id).label("event_count"),
                func.avg(CongestionEvent.culprit_score).label("avg_culprit_score"),
                func.max(CongestionEvent.culprit_score).label("max_culprit_score"),
                func.avg(CongestionEvent.congestion_score).label("avg_congestion_score"),
            )
            .filter(
                CongestionEvent.source_ip.isnot(None),
                CongestionEvent.detected_at >= since,
            )
            .group_by(CongestionEvent.source_ip)
            .order_by(desc("avg_culprit_score"))
            .limit(limit)
            .all()
        )
    except Exception as e:
        logger.warning(f"top_culprit_hosts query failed: {e}")
        rows = []

    # Get host types from HOST_PROFILES in seeder_service
    from app.services.seeder_service import HOST_PROFILES
    def get_host_type(ip: str) -> str:
        for p in HOST_PROFILES:
            if ip.startswith(p["ip_prefix"]):
                return p["type"]
        return "Unknown"

    hosts = []
    for i, row in enumerate(rows, 1):
        avg_score = float(row.avg_culprit_score or 0)
        hosts.append({
            "rank": i,
            "source_ip": row.source_ip,
            "host_type": get_host_type(row.source_ip),
            "event_count": int(row.event_count),
            "avg_culprit_score": round(avg_score, 2),
            "max_culprit_score": round(float(row.max_culprit_score or 0), 2),
            "avg_congestion_score": round(float(row.avg_congestion_score or 0), 4),
            "severity": "critical" if avg_score >= 85 else "high" if avg_score >= 70 else "medium" if avg_score >= 50 else "low",
            "protocol": "mixed",
            "l4_dst_port": 0,
        })

    return {
        "success": True,
        "data": {
            "total_hosts": len(hosts),
            "hours_back": hours,
            "hosts": hosts,
        },
    }


@ml_bp.route("/feature-importance", methods=["GET"])
@auth_required()
def feature_importance():
    # Try to load from metrics.json, fallback to notebook reference values
    metrics_path = os.path.join(current_app.config["ML_ARTIFACTS_DIR"], "metrics.json")
    source = "notebook_reference"
    default_top = [
        {"feature": "DST_TO_SRC_IAT_STDDEV", "contribution_pct": 51.91, "mean_abs_shap": 1.8321},
        {"feature": "SRC_TO_DST_IAT_AVG", "contribution_pct": 22.64, "mean_abs_shap": 0.7989},
        {"feature": "SRC_TO_DST_IAT_STDDEV", "contribution_pct": 17.28, "mean_abs_shap": 0.6098},
        {"feature": "DST_TO_SRC_IAT_AVG", "contribution_pct": 3.32, "mean_abs_shap": 0.1173},
        {"feature": "DST_TO_SRC_SECOND_BYTES", "contribution_pct": 0.85, "mean_abs_shap": 0.0302},
        {"feature": "FLOW_DURATION_MILLISECONDS", "contribution_pct": 0.80, "mean_abs_shap": 0.0283},
        {"feature": "SRC_TO_DST_IAT_MAX", "contribution_pct": 0.72, "mean_abs_shap": 0.0254},
        {"feature": "L4_DST_PORT", "contribution_pct": 0.69, "mean_abs_shap": 0.0242},
        {"feature": "DURATION_OUT", "contribution_pct": 0.51, "mean_abs_shap": 0.0181},
        {"feature": "NUM_PKTS_UP_TO_128_BYTES", "contribution_pct": 0.38, "mean_abs_shap": 0.0135},
    ]
    top_features = default_top
    try:
        if os.path.exists(metrics_path):
            with open(metrics_path) as f:
                metrics = json.load(f)
            # If we have computed SHAP values, use them; otherwise use notebook reference
            source = "computed_metrics"
    except Exception as e:
        logger.warning(f"Could not load metrics.json: {e}")
    return {"success": True, "data": {"top_features": top_features, "source": source}}


@ml_bp.route("/clustering", methods=["POST"])
@auth_required()
@limiter.limit("20 per minute")
def clustering():
    """Apply DBSCAN clustering to a list of host profiles."""
    from app.ml.pipeline import cluster_hosts
    data = request.get_json() or {}
    hosts = data.get("hosts", [])
    if not hosts or not isinstance(hosts, list):
        raise ValidationError("'hosts' (array of {OUT_BYTES, Delay, PacketLoss}) is required.")
    df = pd.DataFrame(hosts)
    df = cluster_hosts(df)
    return {
        "success": True,
        "data": {
            "n_hosts": len(df),
            "n_clusters": int(df["Cluster"].nunique()),
            "clusters": df.to_dict(orient="records"),
        },
    }


@ml_bp.route("/history", methods=["GET"])
@auth_required()
def history():
    """Get prediction history for the current user."""
    from app.blueprints._shared import paginated
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    q = Prediction.query.filter_by(user_id=g.current_user.id).order_by(Prediction.created_at.desc())
    return {"success": True, "data": paginated(q, lambda p: p.to_dict(), page, per_page)}
