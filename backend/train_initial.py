"""
Initial model training script.
Generates synthetic data and trains the Stacking model so the platform
has a working model out of the box. Replace with real NF-UNSW-NB15 data
in production.
"""
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.ml.data_loader import generate_synthetic_data
from app.services.ml_service import get_ml_service
from app.utils.logger import logger


def main():
    app = create_app()
    with app.app_context():
        logger.info("=" * 60)
        logger.info("INITIAL MODEL TRAINING")
        logger.info("=" * 60)

        # Try to load existing model first
        svc = get_ml_service()
        if svc.is_ready:
            logger.info("Model already trained. Skipping.")
            return

        logger.info("Generating synthetic training data (5,000 rows)...")
        df = generate_synthetic_data(n_samples=5000)
        logger.info(f"Generated {len(df)} rows, {len(df.columns)} columns")

        logger.info("Training Stacking model...")
        metrics = svc.train(df, experiment_name="initial_synthetic")
        stacking = metrics["models"]["stacking"]
        logger.info("=" * 60)
        logger.info("TRAINING COMPLETE")
        logger.info(f"  Accuracy: {stacking['accuracy']:.4f}")
        logger.info(f"  F1-Score: {stacking['f1']:.4f}")
        logger.info(f"  ROC-AUC:  {stacking['auc']:.4f}")
        logger.info(f"  Duration: {metrics['duration_seconds']:.1f}s")
        logger.info("=" * 60)


if __name__ == "__main__":
    main()
