"""MLflow-enabled XGBoost training pipeline for per-asset models."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Dict, Tuple

import joblib
import mlflow
import mlflow.xgboost
import numpy as np
import pandas as pd
from xgboost import XGBRegressor


ASSETS = [
    "AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "AMZN", "META",
    "SPY", "QQQ", "EFA", "IEF", "HYG", "BIL", "INTC", "AMD",
]


def _read_split(asset_dir: Path, split: str) -> Tuple[pd.DataFrame, pd.Series]:
    """Read train/val/test split for one asset from CSV or parquet."""
    x_csv = asset_dir / f"X_{split}.csv"
    x_parquet = asset_dir / f"X_{split}.parquet"
    y_csv = asset_dir / f"y_{split}.csv"
    y_parquet = asset_dir / f"y_{split}.parquet"

    if x_csv.exists():
        x_df = pd.read_csv(x_csv, index_col=0)
    elif x_parquet.exists():
        x_df = pd.read_parquet(x_parquet)
    else:
        raise FileNotFoundError(f"Missing X_{split} for {asset_dir.name}")

    if y_csv.exists():
        y_df = pd.read_csv(y_csv, index_col=0)
    elif y_parquet.exists():
        y_df = pd.read_parquet(y_parquet)
    else:
        raise FileNotFoundError(f"Missing y_{split} for {asset_dir.name}")

    if isinstance(y_df, pd.DataFrame):
        numeric_cols = y_df.select_dtypes(include=[np.number]).columns.tolist()
        if numeric_cols:
            y = y_df[numeric_cols[0]]
        else:
            y = y_df.iloc[:, 0]
    else:
        y = y_df

    return x_df, y.astype(float)


def _compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Compute financial and regression metrics for model tracking."""
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)

    mse = float(np.mean((y_true - y_pred) ** 2))
    rmse = float(np.sqrt(mse))
    mae = float(np.mean(np.abs(y_true - y_pred)))

    direction_true = np.sign(y_true)
    direction_pred = np.sign(y_pred)
    accuracy = float(np.mean(direction_true == direction_pred))

    strategy_returns = direction_pred * y_true
    win_rate = float(np.mean(strategy_returns > 0))

    ret_std = float(np.std(strategy_returns))
    sharpe_ratio = 0.0 if ret_std == 0 else float((np.mean(strategy_returns) / ret_std) * np.sqrt(252.0))

    return {
        "loss": mse,
        "rmse": rmse,
        "mae": mae,
        "accuracy": accuracy,
        "win_rate": win_rate,
        "sharpe_ratio": sharpe_ratio,
    }


def train_with_mlflow(
    data_root: str = "data/exported_data/per_asset",
    experiment_name: str = "finx-xgboost-training",
) -> Dict[str, Dict[str, float]]:
    """Train all per-asset XGBoost models and log full MLflow lineage."""
    tracking_uri = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
    model_registry_name = os.getenv("MLFLOW_MODEL_REGISTRY_NAME", "finx-xgboost-best")

    mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment(experiment_name)

    data_root_path = Path(data_root)
    results: Dict[str, Dict[str, float]] = {}
    model_store: Dict[str, XGBRegressor] = {}

    base_params = {
        "n_estimators": int(os.getenv("XGB_N_ESTIMATORS", "400")),
        "max_depth": int(os.getenv("XGB_MAX_DEPTH", "6")),
        "learning_rate": float(os.getenv("XGB_LEARNING_RATE", "0.03")),
        "subsample": float(os.getenv("XGB_SUBSAMPLE", "0.9")),
        "colsample_bytree": float(os.getenv("XGB_COLSAMPLE_BYTREE", "0.9")),
        "min_child_weight": float(os.getenv("XGB_MIN_CHILD_WEIGHT", "1.0")),
        "reg_alpha": float(os.getenv("XGB_REG_ALPHA", "0.0")),
        "reg_lambda": float(os.getenv("XGB_REG_LAMBDA", "1.0")),
        "objective": "reg:squarederror",
        "random_state": 42,
        "n_jobs": 4,
    }

    with mlflow.start_run(run_name="xgboost-multi-asset"):
        mlflow.log_params({
            "tracking_uri": tracking_uri,
            "assets_count": len(ASSETS),
            "registry_name": model_registry_name,
        })

        for asset in ASSETS:
            asset_dir = data_root_path / asset
            if not asset_dir.exists():
                continue

            x_train, y_train = _read_split(asset_dir, "train")
            x_val, y_val = _read_split(asset_dir, "val")

            with mlflow.start_run(run_name=f"xgb-{asset}", nested=True):
                mlflow.log_param("asset", asset)
                mlflow.log_params(base_params)
                mlflow.log_param("train_rows", int(len(x_train)))
                mlflow.log_param("val_rows", int(len(x_val)))
                mlflow.log_param("n_features", int(x_train.shape[1]))

                model = XGBRegressor(**base_params)
                model.fit(x_train, y_train)

                val_pred = model.predict(x_val)
                metrics = _compute_metrics(y_val.values, val_pred)
                mlflow.log_metrics(metrics)

                mlflow.xgboost.log_model(model, artifact_path=f"models/{asset}")

                model_path = asset_dir / f"{asset}_trained_model.joblib"
                joblib.dump(model, model_path)
                mlflow.log_artifact(str(model_path), artifact_path="local_models")

                results[asset] = metrics
                model_store[asset] = model

        if not results:
            raise RuntimeError("No assets were trained. Ensure exported per-asset splits are available.")

        best_asset = max(results.items(), key=lambda kv: kv[1]["sharpe_ratio"])[0]
        best_metrics = results[best_asset]
        mlflow.log_param("best_asset", best_asset)
        mlflow.log_metrics({f"best_{k}": v for k, v in best_metrics.items()})

        mlflow.xgboost.log_model(
            model_store[best_asset],
            artifact_path="best_model",
            registered_model_name=model_registry_name,
        )

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train FinX XGBoost models with MLflow tracking")
    parser.add_argument("--data-root", default="data/exported_data/per_asset")
    parser.add_argument("--experiment", default="finx-xgboost-training")
    args = parser.parse_args()

    output = train_with_mlflow(data_root=args.data_root, experiment_name=args.experiment)
    print("Training complete. Assets trained:", len(output))
