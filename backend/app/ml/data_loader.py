"""
Data Loader
============
 Loads training data from CSV / Kaggle / synthetic generator.
"""
import os
import numpy as np
import pandas as pd
from typing import Optional
from app.utils.logger import logger


def load_training_data(csv_path: str) -> pd.DataFrame:
    """Load a CSV file with memory optimization (chunked + downcast)."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Training data not found: {csv_path}")

    chunks = []
    for chunk in pd.read_csv(csv_path, chunksize=300_000, low_memory=False):
        chunk = _optimize_dtypes(chunk)
        chunks.append(chunk)
    df = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()
    logger.info(f"Loaded {len(df):,} rows from {csv_path}")
    return df


def _optimize_dtypes(df: pd.DataFrame) -> pd.DataFrame:
    """Downcast numeric columns to reduce memory footprint."""
    for col in df.columns:
        col_data = df[col]
        if col_data.dtype.kind in "iu":
            mn, mx = col_data.min(), col_data.max()
            if mn >= 0:
                if mx < 255:
                    df[col] = col_data.astype(np.uint8)
                elif mx < 65535:
                    df[col] = col_data.astype(np.uint16)
                else:
                    df[col] = col_data.astype(np.uint32)
            else:
                if mn > -128 and mx < 127:
                    df[col] = col_data.astype(np.int8)
                elif mn > -32768 and mx < 32767:
                    df[col] = col_data.astype(np.int16)
                else:
                    df[col] = col_data.astype(np.int32)
        elif col_data.dtype.kind == "f":
            df[col] = col_data.astype(np.float32)
    return df


def generate_synthetic_data(n_samples: int = 5000, seed: int = 42) -> pd.DataFrame:
    """
    Generate a synthetic NF-UNSW-NB15-like dataset for demo / quick training.
    This is NOT a substitute for the real dataset but lets the platform boot
    without waiting for the 2.3M-row Kaggle download.
    """
    rng = np.random.default_rng(seed)
    n = max(n_samples, 1000)

    data = {
        "IPV4_SRC_ADDR": [f"10.0.{rng.integers(0, 255)}.{rng.integers(1, 254)}" for _ in range(n)],
        "IPV4_DST_ADDR": [f"192.168.{rng.integers(0, 255)}.{rng.integers(1, 254)}" for _ in range(n)],
        "PROTOCOL": rng.choice([6, 17, 1], size=n),
        "L4_SRC_PORT": rng.integers(1024, 65535, size=n),
        "L4_DST_PORT": rng.choice([80, 443, 22, 53, 25, 3389, 8080, 3306], size=n),
        "IN_BYTES": rng.lognormal(mean=5, sigma=1.5, size=n).astype(np.int32),
        "OUT_BYTES": rng.lognormal(mean=6, sigma=1.8, size=n).astype(np.int32),
        "IN_PKTS": rng.integers(1, 100, size=n),
        "OUT_PKTS": rng.integers(1, 100, size=n),
        "TCP_FLAGS": rng.integers(0, 256, size=n),
        "CLIENT_TCP_FLAGS": rng.integers(0, 256, size=n),
        "SERVER_TCP_FLAGS": rng.integers(0, 256, size=n),
        "FLOW_DURATION_MILLISECONDS": rng.integers(100, 60000, size=n),
        "SRC_TO_DST_IAT_AVG": rng.exponential(scale=50, size=n),
        "DST_TO_SRC_IAT_AVG": rng.exponential(scale=50, size=n),
        "SRC_TO_DST_IAT_STDDEV": rng.exponential(scale=30, size=n),
        "DST_TO_SRC_IAT_STDDEV": rng.exponential(scale=30, size=n),
        "SRC_TO_DST_IAT_MAX": rng.exponential(scale=200, size=n),
        "DST_TO_SRC_IAT_MAX": rng.exponential(scale=200, size=n),
        "SRC_TO_DST_IAT_MIN": rng.exponential(scale=5, size=n),
        "DST_TO_SRC_IAT_MIN": rng.exponential(scale=5, size=n),
        "SRC_TO_DST_AVG_THROUGHPUT": rng.lognormal(mean=8, sigma=1.2, size=n),
        "DST_TO_SRC_AVG_THROUGHPUT": rng.lognormal(mean=8, sigma=1.2, size=n),
        "SRC_TO_DST_SECOND_BYTES": rng.integers(0, 1500, size=n),
        "DST_TO_SRC_SECOND_BYTES": rng.integers(0, 1500, size=n),
        "DURATION_IN": rng.exponential(scale=2, size=n),
        "DURATION_OUT": rng.exponential(scale=3, size=n),
        "MIN_IP_PKT_LEN": rng.integers(40, 80, size=n),
        "MAX_IP_PKT_LEN": rng.integers(500, 1500, size=n),
        "MIN_TTL": rng.integers(30, 64, size=n),
        "MAX_TTL": rng.integers(64, 255, size=n),
        "TCP_WIN_MAX_IN": rng.integers(0, 65535, size=n),
        "TCP_WIN_MAX_OUT": rng.integers(0, 65535, size=n),
        "RETRANSMITTED_IN_PKTS": rng.integers(0, 10, size=n),
        "RETRANSMITTED_OUT_PKTS": rng.integers(0, 10, size=n),
        "RETRANSMITTED_IN_BYTES": rng.integers(0, 5000, size=n),
        "RETRANSMITTED_OUT_BYTES": rng.integers(0, 5000, size=n),
        "NUM_PKTS_UP_TO_128_BYTES": rng.integers(0, 50, size=n),
        "NUM_PKTS_128_TO_256_BYTES": rng.integers(0, 30, size=n),
        "NUM_PKTS_256_TO_512_BYTES": rng.integers(0, 30, size=n),
        "NUM_PKTS_512_TO_1024_BYTES": rng.integers(0, 30, size=n),
        "NUM_PKTS_1024_TO_1514_BYTES": rng.integers(0, 30, size=n),
        "LONGEST_FLOW_PKT": rng.integers(100, 1500, size=n),
        "SHORTEST_FLOW_PKT": rng.integers(40, 200, size=n),
        "L7_PROTO": rng.integers(0, 200, size=n),
        "DNS_QUERY_TYPE": rng.choice([1, 2, 28, 255], size=n),
        "DNS_TTL_ANSWER": rng.integers(0, 3600, size=n),
        "FTP_COMMAND_RET_CODE": rng.integers(0, 500, size=n),
        "ICMP_TYPE": rng.integers(0, 20, size=n),
        "ICMP_IPV4_TYPE": rng.integers(0, 20, size=n),
        "FLOW_START_MILLISECONDS": rng.integers(1_600_000_000_000, 1_700_000_000_000, size=n),
        "FLOW_END_MILLISECONDS": rng.integers(1_700_000_000_000, 1_800_000_000_000, size=n),
        "Label": rng.choice([0, 1], size=n, p=[0.7, 0.3]),
        "Attack": rng.choice(
            ["Benign", "Exploits", "DoS", "Fuzzers", "Reconnaissance", "Generic"],
            size=n, p=[0.7, 0.08, 0.06, 0.06, 0.05, 0.05],
        ),
    }
    df = pd.DataFrame(data)
    # Add NaNs to test imputation robustness
    for col in df.select_dtypes(include=[np.number]).columns:
        mask = rng.random(n) < 0.005
        df.loc[mask, col] = np.nan
    logger.info(f"Generated synthetic dataset: {n} rows x {len(df.columns)} cols")
    return df


def download_kaggle_dataset(target_dir: str) -> str:
    """
    Download the NF-UNSW-NB15-v3 dataset from Kaggle.
    Returns the path to the downloaded CSV.
    """
    os.environ.setdefault("KAGGLE_CONFIG_DIR", os.path.expanduser("~/.kaggle"))
    try:
        import kaggle
        from kaggle.api.kaggle_api_extended import KaggleApi
        api = KaggleApi()
        api.authenticate()
        dataset = os.getenv("KAGGLE_DATASET", "ndayisabae/nf-unsw-nb15-v3")
        os.makedirs(target_dir, exist_ok=True)
        logger.info(f"Downloading Kaggle dataset: {dataset}")
        api.dataset_download_files(dataset, path=target_dir, unzip=True)
        # Find the main CSV
        csv_files = [f for f in os.listdir(target_dir) if f.endswith(".csv")]
        if not csv_files:
            raise RuntimeError("No CSV files found after Kaggle download.")
        return os.path.join(target_dir, csv_files[0])
    except Exception as e:
        logger.error(f"Kaggle download failed: {e}")
        raise


def load_kaggle_dataset_sample(
    target_dir: str = "/tmp/kaggle_data",
    n_samples: int = 50000,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Download the NF-UNSW-NB15-v3 dataset from Kaggle and load a random sample.

    This is designed to work within Render's free tier memory constraints (512MB).
    The full dataset is 2.3M rows which would use ~1.5GB in memory, so we sample.

    Args:
        target_dir: Where to download/extract the dataset
        n_samples: Number of rows to sample (default 50,000)
        seed: Random seed for reproducibility

    Returns:
        DataFrame with n_samples rows from the real dataset
    """
    import subprocess

    # Step 1: Set up Kaggle credentials from environment variables
    kaggle_username = os.getenv("KAGGLE_USERNAME", "")
    kaggle_key = os.getenv("KAGGLE_KEY", "")
    kaggle_token = os.getenv("KAGGLE_API_TOKEN", "")

    if kaggle_username and kaggle_key:
        # Standard Kaggle auth
        kaggle_dir = os.path.expanduser("~/.kaggle")
        os.makedirs(kaggle_dir, exist_ok=True)
        kaggle_json = os.path.join(kaggle_dir, "kaggle.json")
        with open(kaggle_json, "w") as f:
            import json as _json
            _json.dump({"username": kaggle_username, "key": kaggle_key}, f)
        os.chmod(kaggle_json, 0o600)
        logger.info(f"Kaggle credentials written for user: {kaggle_username}")
    elif kaggle_token:
        # Token-based auth (newer format)
        kaggle_dir = os.path.expanduser("~/.kaggle")
        os.makedirs(kaggle_dir, exist_ok=True)
        token_file = os.path.join(kaggle_dir, "access_token")
        with open(token_file, "w") as f:
            f.write(kaggle_token)
        os.chmod(token_file, 0o600)
        os.environ["KAGGLE_API_TOKEN"] = kaggle_token
        logger.info("Kaggle token-based auth configured.")
    else:
        raise RuntimeError(
            "No Kaggle credentials found. Set KAGGLE_USERNAME + KAGGLE_KEY "
            "or KAGGLE_API_TOKEN environment variables."
        )

    # Step 2: Download the dataset
    csv_path = download_kaggle_dataset(target_dir)
    logger.info(f"Dataset downloaded to: {csv_path}")

    # Step 3: Read with chunking and sample
    logger.info(f"Reading dataset and sampling {n_samples} rows...")
    rng = np.random.default_rng(seed)

    # First pass: count total rows
    total_rows = 0
    for chunk in pd.read_csv(csv_path, chunksize=100_000, low_memory=False):
        total_rows += len(chunk)
    logger.info(f"Total rows in dataset: {total_rows:,}")

    # Calculate sampling probability
    sample_prob = min(n_samples / total_rows, 1.0)
    logger.info(f"Sampling probability: {sample_prob:.4f}")

    # Second pass: sample rows
    sampled_chunks = []
    sampled_count = 0
    for chunk in pd.read_csv(csv_path, chunksize=100_000, low_memory=False):
        # Downcast types to save memory
        chunk = _optimize_dtypes(chunk)
        # Random sample from this chunk
        n_to_take = int(len(chunk) * sample_prob)
        if n_to_take > 0:
            sampled = chunk.sample(n=n_to_take, random_state=seed)
            sampled_chunks.append(sampled)
            sampled_count += len(sampled)

    df = pd.concat(sampled_chunks, ignore_index=True) if sampled_chunks else pd.DataFrame()

    # If we got fewer than requested, that's fine
    # If we got more, trim
    if len(df) > n_samples:
        df = df.sample(n=n_samples, random_state=seed).reset_index(drop=True)

    logger.info(f"Sampled {len(df):,} rows from real dataset")

    # Clean up downloaded files to save disk space
    try:
        import shutil
        shutil.rmtree(target_dir, ignore_errors=True)
        logger.info("Cleaned up downloaded dataset files.")
    except Exception:
        pass

    return df


def load_csv_file_sample(
    file_path: str,
    n_samples: int = 50000,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Load a CSV file and sample N rows. Used for user-uploaded CSV files.
    """
    logger.info(f"Loading CSV: {file_path}, sampling {n_samples} rows...")

    # Count total rows
    total_rows = sum(1 for _ in open(file_path)) - 1  # minus header
    logger.info(f"Total rows in CSV: {total_rows:,}")

    sample_prob = min(n_samples / total_rows, 1.0) if total_rows > 0 else 1.0

    sampled_chunks = []
    for chunk in pd.read_csv(file_path, chunksize=100_000, low_memory=False):
        chunk = _optimize_dtypes(chunk)
        n_to_take = max(1, int(len(chunk) * sample_prob))
        if n_to_take > 0:
            sampled = chunk.sample(n=min(n_to_take, len(chunk)), random_state=seed)
            sampled_chunks.append(sampled)

    df = pd.concat(sampled_chunks, ignore_index=True) if sampled_chunks else pd.DataFrame()

    if len(df) > n_samples:
        df = df.sample(n=n_samples, random_state=seed).reset_index(drop=True)

    logger.info(f"Loaded {len(df):,} sampled rows from CSV")
    return df
