"""
ML Service
===========
 Loads trained artifacts, exposes predict/train/evaluate/shap/rca helpers.
"""
import os
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple

from flask import current_app

from app.utils.logger import logger
from app.utils.errors import ModelNotReadyError
from app.ml.pipeline import (
    engineer_qos_features,
    compute_congestion_score,
    prepare_training_data,
    train_full_pipeline,
    predict_single,
    compute_shap_values,
    root_cause_analysis,
    DEFAULT_FEATURE_COLUMNS,
)


class MLService:
    """Singleton-like service that loads & caches ML artifacts."""

    def __init__(self):
        self._model = None
        self._scaler = None
        self._iso_model = None
        self._iso_scaler = None
        self._baseline_stats: Optional[Dict[str, float]] = None
        self._feature_columns: Optional[List[str]] = None
        self._shap_explainer = None
        self._loaded = False

    # ---------------------------------------------------------------- load
    def load(self, force: bool = False) -> bool:
        """Load all artifacts from disk. Returns True if successful."""
        if self._loaded and not force:
            return True

        artifacts_dir = current_app.config["ML_ARTIFACTS_DIR"]
        try:
            model_path = current_app.config["MODEL_PATH"]
            scaler_path = current_app.config["SCALER_PATH"]
            iso_model_path = current_app.config["ISO_MODEL_PATH"]
            iso_scaler_path = current_app.config["ISO_SCALER_PATH"]
            baseline_path = current_app.config["BASELINE_STATS_PATH"]
            feature_cols_path = current_app.config["FEATURE_COLUMNS_PATH"]
            shap_explainer_path = current_app.config["SHAP_EXPLAINER_PATH"]

            if not os.path.exists(model_path) or not os.path.exists(scaler_path):
                logger.warning("ML artifacts not found. Model not ready.")
                self._loaded = False
                return False

            self._model = joblib.load(model_path)
            self._scaler = joblib.load(scaler_path)
            self._feature_columns = (
                joblib.load(feature_cols_path) if os.path.exists(feature_cols_path) else DEFAULT_FEATURE_COLUMNS
            )
            if os.path.exists(baseline_path):
                self._baseline_stats = joblib.load(baseline_path)
            if os.path.exists(iso_model_path):
                self._iso_model = joblib.load(iso_model_path)
            if os.path.exists(iso_scaler_path):
                self._iso_scaler = joblib.load(iso_scaler_path)
            if os.path.exists(shap_explainer_path):
                try:
                    self._shap_explainer = joblib.load(shap_explainer_path)
                except Exception as e:
                    logger.warning(f"SHAP explainer load failed: {e}")
            self._loaded = True
            logger.info(f"ML artifacts loaded. Features: {len(self._feature_columns)}")
            return True
        except Exception as e:
            logger.error(f"Failed to load ML artifacts: {e}", exc_info=True)
            self._loaded = False
            return False

    @property
    def is_ready(self) -> bool:
        if not self._loaded:
            return self.load()
        return True

    @property
    def feature_columns(self) -> List[str]:
        return self._feature_columns or DEFAULT_FEATURE_COLUMNS

    # ---------------------------------------------------------------- predict
    def predict(self, input_row: Dict[str, Any]) -> Dict[str, Any]:
        if not self.is_ready:
            # Try auto-train on first request
            self._auto_train_if_needed()
            if not self.is_ready:
                raise ModelNotReadyError()
        import time
        t0 = time.perf_counter()
        result = predict_single(
            self._model, self._scaler, self._feature_columns, input_row
        )
        result["inference_time_ms"] = (time.perf_counter() - t0) * 1000
        return result

    def _auto_train_if_needed(self) -> None:
        """Auto-train on synthetic data if no model is loaded (lazy init)."""
        if self.is_ready:
            return
        try:
            logger.info("Auto-training model on synthetic data (first request)...")
            from app.ml.data_loader import generate_synthetic_data
            df = generate_synthetic_data(n_samples=2000)
            self.train(df, experiment_name="auto_initial")
            logger.info("Auto-training complete.")
        except Exception as e:
            logger.error(f"Auto-training failed: {e}", exc_info=True)

    # ---------------------------------------------------------------- shap
    def explain(self, input_row: Dict[str, Any], top_k: int = 10) -> Dict[str, Any]:
        if not self.is_ready:
            raise ModelNotReadyError()
        return compute_shap_values(
            self._shap_explainer, self._scaler, self._feature_columns, input_row, top_k
        )

    # ---------------------------------------------------------------- rca
    def root_cause(
        self,
        input_row: Dict[str, Any],
        predicted_label: int,
        cluster_id: int = 0,
    ) -> Dict[str, Any]:
        return root_cause_analysis(
            input_row, predicted_label, cluster_id, self._baseline_stats
        )

    # ---------------------------------------------------------------- train
    def train(self, df: pd.DataFrame, experiment_name: str = "stacking_default") -> Dict[str, Any]:
        """Train the full pipeline and persist artifacts."""
        artifacts_dir = current_app.config["ML_ARTIFACTS_DIR"]
        metrics = train_full_pipeline(df, artifacts_dir, experiment_name)
        # Reload after training
        self.load(force=True)
        return metrics

    # ---------------------------------------------------------------- full inference
    def full_inference(self, input_row: Dict[str, Any]) -> Dict[str, Any]:
        """Combined prediction + SHAP + RCA in one call."""
        pred = self.predict(input_row)
        shap_result = self.explain(input_row)
        rca = self.root_cause(input_row, pred["predicted_label"])
        return {
            "prediction": pred,
            "shap": shap_result,
            "root_cause": rca,
        }


# Singleton accessor
_ml_service: Optional[MLService] = None


def get_ml_service() -> MLService:
    global _ml_service
    if _ml_service is None:
        _ml_service = MLService()
    return _ml_service
