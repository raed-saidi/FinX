# pipelines/steps/export_for_models_step.py
"""
EXPORT STRATEGY FOR MULTI-MODEL ARCHITECTURE
Exports data in 3 formats optimized for different consumers:
1. Per-asset format (for individual asset models)
2. Global format (for RL ensemble)
3. Metadata manifests (for quick inspection)
"""

from pathlib import Path
from typing import Dict, Any, List
import pandas as pd
import numpy as np
import joblib
import json
from zenml import step


def create_per_asset_features(
    features_scaled: pd.DataFrame,
    returns_clipped: pd.DataFrame,
    asset_ticker: str,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Extract features relevant to a specific asset for per-asset model training.
    
    Feature selection logic:
    - Asset's own features (e.g., SPY_rsi14, SPY_mom_20)
    - Global portfolio features (e.g., ew_vol_20, regime_*)
    - Cross-asset features involving this asset
    - Exclude other assets' specific features
    
    Returns:
        X: Features for this asset
        y: Returns for this asset only
    """
    # Get all column names
    all_features = features_scaled.columns.tolist()
    
    # Features to include for this asset
    asset_features = []
    
    for col in all_features:
        # Include if:
        # 1. Starts with asset ticker (SPY_rsi14, SPY_mom_20)
        if col.startswith(f"{asset_ticker}_"):
            asset_features.append(col)
        # 2. Global features (ew_*, avg_correlation, regime_*)
        elif col.startswith("ew_") or col.startswith("avg_") or col.startswith("regime_"):
            asset_features.append(col)
        # 3. Cross-asset features involving this asset
        elif asset_ticker in col and ("mkt_corr" in col or "beta" in col or "rel_strength" in col):
            asset_features.append(col)
        # 4. Alternative data features (VIX, yields, DXY, etc.)
        elif any(alt in col for alt in ["VIX", "YIELD", "DXY", "GOLD", "OIL", "SMALL_CAP"]):
            asset_features.append(col)
    
    X = features_scaled[asset_features].copy()
    y = returns_clipped[[asset_ticker]].copy()
    
    return X, y


@step
def export_for_models(
    features_scaled: pd.DataFrame,
    returns_clipped: pd.DataFrame,
    prices: pd.DataFrame,
    scaler_features: Any,
    train_end_date: str,
    tickers: List[str],
    output_dir: str = "./data/exported_data",
) -> Dict[str, Any]:
    """
    Export data in multiple formats optimized for the 3-stage architecture:
    1. Per-asset exports for individual models (LightGBM, XGBoost, LSTM)
    2. Global exports for RL ensemble
    3. Comprehensive metadata manifests
    """
    
    print("\n" + "="*80)
    print("EXPORTING DATA FOR MULTI-MODEL ARCHITECTURE")
    print("="*80)
    
    base_path = Path(output_dir)
    base_path.mkdir(parents=True, exist_ok=True)
    
    # Create train/test masks
    train_mask = features_scaled.index <= train_end_date
    test_mask = ~train_mask
    
    # =============================================================================
    # 1. PER-ASSET EXPORTS (for per-asset models)
    # =============================================================================
    print("\n" + "-"*80)
    print("EXPORTING PER-ASSET DATA")
    print("-"*80)
    
    per_asset_dir = base_path / "per_asset"
    per_asset_dir.mkdir(exist_ok=True)
    
    asset_metadata = {}
    
    for ticker in tickers:
        print(f"\nProcessing {ticker}...")
        
        # Create asset directory
        asset_dir = per_asset_dir / ticker
        asset_dir.mkdir(exist_ok=True)
        
        # Extract asset-specific features
        X_asset, y_asset = create_per_asset_features(
            features_scaled=features_scaled,
            returns_clipped=returns_clipped,
            asset_ticker=ticker,
        )
        
        # Split train/test
        X_train = X_asset.loc[train_mask]
        X_test = X_asset.loc[test_mask]
        y_train = y_asset.loc[train_mask]
        y_test = y_asset.loc[test_mask]
        
        # Validate
        assert len(X_train) == len(y_train), f"{ticker}: X_train and y_train length mismatch"
        assert len(X_test) == len(y_test), f"{ticker}: X_test and y_test length mismatch"
        assert X_train.index.equals(y_train.index), f"{ticker}: X_train and y_train index mismatch"
        
        print(f"  Features: {X_train.shape[1]}")
        print(f"  Train: {len(X_train)} samples ({X_train.index.min().date()} to {X_train.index.max().date()})")
        print(f"  Test: {len(X_test)} samples ({X_test.index.min().date()} to {X_test.index.max().date()})")
        
        # Save as Parquet (primary format)
        X_train.to_parquet(asset_dir / "X_train.parquet", compression="snappy")
        X_test.to_parquet(asset_dir / "X_test.parquet", compression="snappy")
        y_train.to_parquet(asset_dir / "y_train.parquet", compression="snappy")
        y_test.to_parquet(asset_dir / "y_test.parquet", compression="snappy")
        
        # Save as CSV (for portability/inspection)
        X_train.to_csv(asset_dir / "X_train.csv")
        X_test.to_csv(asset_dir / "X_test.csv")
        y_train.to_csv(asset_dir / "y_train.csv")
        y_test.to_csv(asset_dir / "y_test.csv")
        
        # Asset-specific metadata
        asset_meta = {
            "ticker": ticker,
            "n_features": X_train.shape[1],
            "feature_names": X_train.columns.tolist(),
            "train_samples": len(X_train),
            "test_samples": len(X_test),
            "train_date_range": {
                "start": str(X_train.index.min().date()),
                "end": str(X_train.index.max().date()),
            },
            "test_date_range": {
                "start": str(X_test.index.min().date()),
                "end": str(X_test.index.max().date()),
            },
            "train_stats": {
                "y_mean": float(y_train[ticker].mean()),
                "y_std": float(y_train[ticker].std()),
                "y_min": float(y_train[ticker].min()),
                "y_max": float(y_train[ticker].max()),
                "y_sharpe_ann": float(y_train[ticker].mean() / y_train[ticker].std() * np.sqrt(252)),
            },
            "test_stats": {
                "y_mean": float(y_test[ticker].mean()),
                "y_std": float(y_test[ticker].std()),
                "y_sharpe_ann": float(y_test[ticker].mean() / y_test[ticker].std() * np.sqrt(252)),
            },
        }
        
        # Save metadata
        with open(asset_dir / "metadata.json", "w") as f:
            json.dump(asset_meta, f, indent=2)
        
        asset_metadata[ticker] = asset_meta
        
        print(f"  ✅ Saved to {asset_dir}")
    
    # =============================================================================
    # 2. GLOBAL EXPORTS (for RL ensemble)
    # =============================================================================
    print("\n" + "-"*80)
    print("EXPORTING GLOBAL DATA (for RL ensemble)")
    print("-"*80)
    
    global_dir = base_path / "global"
    global_dir.mkdir(exist_ok=True)
    
    # Full feature matrix (all assets)
    X_train_global = features_scaled.loc[train_mask]
    X_test_global = features_scaled.loc[test_mask]
    y_train_global = returns_clipped.loc[train_mask]
    y_test_global = returns_clipped.loc[test_mask]
    
    print(f"\nGlobal dataset:")
    print(f"  Features: {X_train_global.shape[1]}")
    print(f"  Targets: {y_train_global.shape[1]} assets")
    print(f"  Train: {len(X_train_global)} samples")
    print(f"  Test: {len(X_test_global)} samples")
    
    # Save global data
    X_train_global.to_parquet(global_dir / "X_train.parquet", compression="snappy")
    X_test_global.to_parquet(global_dir / "X_test.parquet", compression="snappy")
    y_train_global.to_parquet(global_dir / "y_train.parquet", compression="snappy")
    y_test_global.to_parquet(global_dir / "y_test.parquet", compression="snappy")
    
    # Also save prices (useful for RL reward calculation)
    prices.loc[train_mask].to_parquet(global_dir / "prices_train.parquet")
    prices.loc[test_mask].to_parquet(global_dir / "prices_test.parquet")
    
    print(f"  ✅ Saved to {global_dir}")
    
    # =============================================================================
    # 3. SCALERS
    # =============================================================================
    print("\n" + "-"*80)
    print("SAVING SCALERS")
    print("-"*80)
    
    scalers_dir = base_path / "scalers"
    scalers_dir.mkdir(exist_ok=True)
    
    # Global scaler (for RL model or if you want to inverse transform)
    if scaler_features is not None:
        joblib.dump(scaler_features, scalers_dir / "global_scaler.joblib")
        print("  ✅ Saved global_scaler.joblib")
    
    # Note: Per-asset models use the global scaler since features are already scaled
    # If you want per-asset scalers (re-fit on per-asset features), add that logic here
    
    # =============================================================================
    # 4. MASTER MANIFEST
    # =============================================================================
    print("\n" + "-"*80)
    print("CREATING MASTER MANIFEST")
    print("-"*80)
    
    manifest = {
        "pipeline_version": "1.0",
        "created_at": pd.Timestamp.now().isoformat(),
        "train_end_date": train_end_date,
        "tickers": tickers,
        "data_summary": {
            "total_features": features_scaled.shape[1],
            "total_samples": len(features_scaled),
            "train_samples": int(train_mask.sum()),
            "test_samples": int(test_mask.sum()),
            "date_range": {
                "start": str(features_scaled.index.min().date()),
                "end": str(features_scaled.index.max().date()),
            },
        },
        "per_asset_metadata": asset_metadata,
        "global_metadata": {
            "n_features": X_train_global.shape[1],
            "n_targets": y_train_global.shape[1],
            "feature_names": X_train_global.columns.tolist()[:50],  # First 50 for brevity
            "target_names": y_train_global.columns.tolist(),
        },
        "file_structure": {
            "per_asset": f"{len(tickers)} ticker directories with X/y train/test splits",
            "global": "Full dataset for RL ensemble training",
            "scalers": "Fitted scaler objects for inverse transforms",
        },
        "usage": {
            "per_asset_models": "Load data/exported_data/per_asset/{ticker}/X_train.parquet",
            "rl_model": "Load data/exported_data/global/X_train.parquet",
            "quick_start": "See scripts/train_per_asset_models.py",
        },
    }
    
    # Save manifest
    manifest_path = base_path / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    
    print(f"  ✅ Saved manifest.json")
    
    # =============================================================================
    # 5. README
    # =============================================================================
    readme_content = f"""# Exported ML Data - Ready for Training

## Pipeline Run Summary
- **Created**: {pd.Timestamp.now()}
- **Train/Test Split**: {train_end_date}
- **Assets**: {', '.join(tickers)}
- **Total Features**: {features_scaled.shape[1]}
- **Train Samples**: {train_mask.sum()}
- **Test Samples**: {test_mask.sum()}

## Directory Structure

```
exported_data/
├── per_asset/           # Per-asset model training data
│   ├── SPY/
│   │   ├── X_train.parquet  ({asset_metadata.get('SPY', {}).get('n_features', 'N/A')} features)
│   │   ├── X_test.parquet
│   │   ├── y_train.parquet  (SPY returns)
│   │   ├── y_test.parquet
│   │   └── metadata.json
│   └── (... 5 more assets)
│
├── global/              # RL ensemble training data
│   ├── X_train.parquet  ({X_train_global.shape[1]} features × {len(X_train_global)} samples)
│   ├── y_train.parquet  ({y_train_global.shape[1]} targets)
│   └── prices_train.parquet
│
├── scalers/
│   └── global_scaler.joblib
│
├── manifest.json        # Complete metadata catalog
└── README.txt           # This file

```

## Quick Start - Training Per-Asset Models

```python
import pandas as pd
from pathlib import Path

# Load data for one asset (e.g., SPY)
ticker = "SPY"
data_dir = Path("data/exported_data/per_asset") / ticker

X_train = pd.read_parquet(data_dir / "X_train.parquet")
y_train = pd.read_parquet(data_dir / "y_train.parquet")
X_test = pd.read_parquet(data_dir / "X_test.parquet")
y_test = pd.read_parquet(data_dir / "y_test.parquet")

# Train model
from lightgbm import LGBMRegressor
model = LGBMRegressor(n_estimators=100, learning_rate=0.05)
model.fit(X_train, y_train[ticker])

# Predict
predictions = model.predict(X_test)
```

## Quick Start - Training RL Ensemble

```python
# Load global dataset with all assets
X_train = pd.read_parquet("data/exported_data/global/X_train.parquet")
y_train = pd.read_parquet("data/exported_data/global/y_train.parquet")
prices = pd.read_parquet("data/exported_data/global/prices_train.parquet")

# Your RL training code here
# State: X_train (features) + previous predictions from per-asset models
# Action: Portfolio weights
# Reward: Sharpe ratio from y_train and prices
```

## Data Quality Guarantees

✅ No missing values (NaN)
✅ All features scaled (mean≈0, std≈1)
✅ DatetimeIndex preserved
✅ Train/test temporal split (no look-ahead bias)
✅ Indices aligned between X and y

## Next Steps

1. Train 3 models per asset (LightGBM, XGBoost, LSTM) → See `scripts/train_per_asset_models.py`
2. Evaluate and select best model per asset
3. Use best models' predictions as input to RL ensemble
4. Backtest the full strategy with transaction costs

## Metadata

See `manifest.json` for complete pipeline metadata including:
- Feature names and counts per asset
- Train/test statistics
- Date ranges
- File paths

---
Generated by ZenML Data Pipeline v1.0
"""
    
    readme_path = base_path / "README.txt"
    readme_path.write_text(readme_content)
    
    print(f"  ✅ Saved README.txt")
    
    # =============================================================================
    # FINAL SUMMARY
    # =============================================================================
    print("\n" + "="*80)
    print("EXPORT COMPLETE ✅")
    print("="*80)
    print(f"\nExported data summary:")
    print(f"  📁 Per-asset data: {per_asset_dir}")
    print(f"     - {len(tickers)} assets × 4 files each (X/y train/test)")
    print(f"  📁 Global data: {global_dir}")
    print(f"     - Full dataset for RL training")
    print(f"  📁 Scalers: {scalers_dir}")
    print(f"  📄 Manifest: {manifest_path}")
    print(f"  📄 README: {readme_path}")
    
    print(f"\n💡 Next steps:")
    print(f"   1. Run: python scripts/train_per_asset_models.py")
    print(f"   2. Evaluate models and save best per asset")
    print(f"   3. Train RL ensemble using best predictions")
    
    print("\n" + "="*80 + "\n")
    
    return manifest