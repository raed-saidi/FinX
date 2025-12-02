# pipelines/steps/save_processed_step.py
from pathlib import Path
from typing import Any, Dict
import pandas as pd
import joblib
from zenml.steps import step


@step
def save_processed_data_step(
    prices: pd.DataFrame,
    returns_clipped: pd.DataFrame,
    clip_thresholds: Dict[str, Any],
    features_all: pd.DataFrame,
    features_scaled: pd.DataFrame,
    scaler_features: Any,
    scaler_regime: Any,
    kmeans_regime: Any,
    scaling_stats: Dict[str, Any],
    output_dir: str = "./data/processed",
) -> None:
    """
    Save processed artifacts (prices, returns, features, scalers, regimes).
    """
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    # Save DataFrames
    prices.to_parquet(out / "prices.parquet")
    returns_clipped.to_parquet(out / "returns_clipped.parquet")
    features_all.to_parquet(out / "features_all.parquet")
    features_scaled.to_parquet(out / "features_scaled.parquet")
    print(" âœ“ Saved processed parquet files.")

    # Save thresholds and stats
    try:
        import json
        with open(out / "clip_thresholds.json", "w", encoding="utf-8") as f:
            json.dump(clip_thresholds, f, indent=2, default=str)
        with open(out / "scaling_stats.json", "w", encoding="utf-8") as f:
            json.dump(scaling_stats, f, indent=2, default=str)
        print(" âœ“ Saved thresholds and scaling stats.")
    except Exception as e:
        print(f" ! Failed to save JSON metadata: {e}")

    # Save scalers and kmeans with joblib if possible
    try:
        if scaler_features is not None:
            joblib.dump(scaler_features, out / "scaler_features.joblib")
        if scaler_regime is not None:
            joblib.dump(scaler_regime, out / "scaler_regime.joblib")
        if kmeans_regime is not None:
            joblib.dump(kmeans_regime, out / "kmeans_regime.joblib")
        print(" âœ“ Saved scalers and clustering models (joblib).")
    except Exception as e:
        print(f" ! Failed to joblib.dump scalers/regime models: {e}")