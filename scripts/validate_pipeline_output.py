# scripts/validate_pipeline_output.py
"""
Comprehensive validation script for pipeline output.
Run this after pipeline execution to verify data quality.
"""

from pathlib import Path
import pandas as pd
import numpy as np
import json
from typing import List, Dict


def validate_file_structure(base_dir: Path) -> Dict[str, bool]:
    """Validate that all expected files exist."""
    print("\n" + "="*80)
    print("VALIDATING FILE STRUCTURE")
    print("="*80)
    
    checks = {}
    
    # Check manifest
    manifest_path = base_dir / "manifest.json"
    checks["manifest_exists"] = manifest_path.exists()
    print(f"  {'✅' if checks['manifest_exists'] else '❌'} Manifest: {manifest_path}")
    
    if not checks["manifest_exists"]:
        print("\n❌ CRITICAL: Manifest not found. Pipeline may not have completed successfully.")
        return checks
    
    # Load manifest to get tickers
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
    
    tickers = manifest.get("tickers", [])
    print(f"\n  Found {len(tickers)} tickers: {', '.join(tickers)}")
    
    # Check per-asset directories
    per_asset_dir = base_dir / "per_asset"
    checks["per_asset_dir_exists"] = per_asset_dir.exists()
    print(f"\n  {'✅' if checks['per_asset_dir_exists'] else '❌'} Per-asset directory: {per_asset_dir}")
    
    if checks["per_asset_dir_exists"]:
        for ticker in tickers:
            ticker_dir = per_asset_dir / ticker
            ticker_exists = ticker_dir.exists()
            checks[f"ticker_{ticker}_dir"] = ticker_exists
            
            if ticker_exists:
                required_files = ["X_train.parquet", "X_test.parquet", "y_train.parquet", "y_test.parquet", "metadata.json"]
                all_exist = all((ticker_dir / f).exists() for f in required_files)
                checks[f"ticker_{ticker}_files"] = all_exist
                status = "✅" if all_exist else "❌"
                print(f"    {status} {ticker}: {ticker_dir}")
            else:
                checks[f"ticker_{ticker}_files"] = False
                print(f"    ❌ {ticker}: Directory not found")
    
    # Check global directory
    global_dir = base_dir / "global"
    checks["global_dir_exists"] = global_dir.exists()
    print(f"\n  {'✅' if checks['global_dir_exists'] else '❌'} Global directory: {global_dir}")
    
    if checks["global_dir_exists"]:
        required_files = ["X_train.parquet", "X_test.parquet", "y_train.parquet", "y_test.parquet"]
        all_exist = all((global_dir / f).exists() for f in required_files)
        checks["global_files"] = all_exist
        print(f"    {'✅' if all_exist else '❌'} All required files present")
    
    # Check scalers
    scalers_dir = base_dir / "scalers"
    checks["scalers_dir_exists"] = scalers_dir.exists()
    print(f"\n  {'✅' if checks['scalers_dir_exists'] else '❌'} Scalers directory: {scalers_dir}")
    
    return checks


def validate_data_quality(base_dir: Path) -> Dict[str, bool]:
    """Validate data quality (no NaNs, correct dtypes, aligned indices)."""
    print("\n" + "="*80)
    print("VALIDATING DATA QUALITY")
    print("="*80)
    
    checks = {}
    
    # Load manifest
    manifest_path = base_dir / "manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
    
    tickers = manifest.get("tickers", [])
    
    # Check first asset as representative
    ticker = tickers[0]
    asset_dir = base_dir / "per_asset" / ticker
    
    print(f"\n  Checking data quality for {ticker} (representative)...")
    
    try:
        X_train = pd.read_parquet(asset_dir / "X_train.parquet")
        X_test = pd.read_parquet(asset_dir / "X_test.parquet")
        y_train = pd.read_parquet(asset_dir / "y_train.parquet")
        y_test = pd.read_parquet(asset_dir / "y_test.parquet")
        
        # Check for NaNs
        has_nan_X_train = X_train.isna().any().any()
        has_nan_X_test = X_test.isna().any().any()
        has_nan_y_train = y_train.isna().any().any()
        has_nan_y_test = y_test.isna().any().any()
        
        checks[f"{ticker}_no_nan"] = not (has_nan_X_train or has_nan_X_test or has_nan_y_train or has_nan_y_test)
        print(f"    {'✅' if checks[f'{ticker}_no_nan'] else '❌'} No NaN values")
        
        if not checks[f"{ticker}_no_nan"]:
            if has_nan_X_train:
                print(f"      ⚠️  X_train has {X_train.isna().sum().sum()} NaN values")
            if has_nan_X_test:
                print(f"      ⚠️  X_test has {X_test.isna().sum().sum()} NaN values")
            if has_nan_y_train:
                print(f"      ⚠️  y_train has {y_train.isna().sum().sum()} NaN values")
            if has_nan_y_test:
                print(f"      ⚠️  y_test has {y_test.isna().sum().sum()} NaN values")
        
        # Check dtypes
        X_train_numeric = all(pd.api.types.is_numeric_dtype(X_train[col]) for col in X_train.columns)
        X_test_numeric = all(pd.api.types.is_numeric_dtype(X_test[col]) for col in X_test.columns)
        y_train_numeric = all(pd.api.types.is_numeric_dtype(y_train[col]) for col in y_train.columns)
        y_test_numeric = all(pd.api.types.is_numeric_dtype(y_test[col]) for col in y_test.columns)
        
        checks[f"{ticker}_numeric"] = X_train_numeric and X_test_numeric and y_train_numeric and y_test_numeric
        print(f"    {'✅' if checks[f'{ticker}_numeric'] else '❌'} All numeric dtypes")
        
        # Check index alignment
        train_aligned = X_train.index.equals(y_train.index)
        test_aligned = X_test.index.equals(y_test.index)
        
        checks[f"{ticker}_aligned"] = train_aligned and test_aligned
        print(f"    {'✅' if checks[f'{ticker}_aligned'] else '❌'} Indices aligned (X and y)")
        
        # Check DatetimeIndex
        is_datetime_train = isinstance(X_train.index, pd.DatetimeIndex)
        is_datetime_test = isinstance(X_test.index, pd.DatetimeIndex)
        
        checks[f"{ticker}_datetime_index"] = is_datetime_train and is_datetime_test
        print(f"    {'✅' if checks[f'{ticker}_datetime_index'] else '❌'} DatetimeIndex preserved")
        
        # Check shapes
        print(f"\n    Shapes:")
        print(f"      X_train: {X_train.shape}")
        print(f"      y_train: {y_train.shape}")
        print(f"      X_test: {X_test.shape}")
        print(f"      y_test: {y_test.shape}")
        
        # Check train/test split makes sense
        total_samples = len(X_train) + len(X_test)
        train_pct = len(X_train) / total_samples * 100
        test_pct = len(X_test) / total_samples * 100
        
        print(f"\n    Train/Test split: {train_pct:.1f}% / {test_pct:.1f}%")
        
        reasonable_split = 60 <= train_pct <= 90
        checks[f"{ticker}_reasonable_split"] = reasonable_split
        print(f"    {'✅' if reasonable_split else '⚠️'} Split ratio {'reasonable' if reasonable_split else 'unusual'}")
        
    except Exception as e:
        print(f"\n    ❌ Error loading data: {e}")
        checks[f"{ticker}_loadable"] = False
        return checks
    
    # Check global data
    print(f"\n  Checking global data...")
    global_dir = base_dir / "global"
    
    try:
        X_train_global = pd.read_parquet(global_dir / "X_train.parquet")
        y_train_global = pd.read_parquet(global_dir / "y_train.parquet")
        
        print(f"    Global X_train: {X_train_global.shape}")
        print(f"    Global y_train: {y_train_global.shape}")
        
        # Verify y has all tickers
        y_tickers = list(y_train_global.columns)
        all_tickers_present = set(tickers) == set(y_tickers)
        checks["global_all_tickers"] = all_tickers_present
        print(f"    {'✅' if all_tickers_present else '❌'} All tickers in y_train: {y_tickers}")
        
    except Exception as e:
        print(f"    ❌ Error loading global data: {e}")
        checks["global_loadable"] = False
    
    return checks


def validate_statistics(base_dir: Path) -> Dict[str, bool]:
    """Validate statistical properties."""
    print("\n" + "="*80)
    print("VALIDATING STATISTICAL PROPERTIES")
    print("="*80)
    
    checks = {}
    
    # Load manifest
    manifest_path = base_dir / "manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
    
    tickers = manifest.get("tickers", [])
    ticker = tickers[0]
    
    asset_dir = base_dir / "per_asset" / ticker
    
    print(f"\n  Checking scaled features (should have mean≈0, std≈1)...")
    
    X_train = pd.read_parquet(asset_dir / "X_train.parquet")
    
    means = X_train.mean()
    stds = X_train.std()
    
    mean_close_to_zero = abs(means.mean()) < 0.1
    std_close_to_one = abs(stds.mean() - 1.0) < 0.2
    
    checks["features_scaled"] = mean_close_to_zero and std_close_to_one
    
    print(f"    {'✅' if mean_close_to_zero else '⚠️'} Mean close to 0: {means.mean():.4f}")
    print(f"    {'✅' if std_close_to_one else '⚠️'} Std close to 1: {stds.mean():.4f}")
    
    # Check for extreme outliers (|z| > 10)
    extreme_outliers = (abs(X_train) > 10).sum().sum()
    checks["no_extreme_outliers"] = extreme_outliers == 0
    print(f"    {'✅' if checks['no_extreme_outliers'] else '⚠️'} Extreme outliers (|z|>10): {extreme_outliers}")
    
    # Check returns distribution
    print(f"\n  Checking returns distribution...")
    y_train = pd.read_parquet(asset_dir / "y_train.parquet")
    
    ret_mean = y_train[ticker].mean()
    ret_std = y_train[ticker].std()
    ret_min = y_train[ticker].min()
    ret_max = y_train[ticker].max()
    
    print(f"    Mean: {ret_mean*100:.4f}%")
    print(f"    Std: {ret_std*100:.4f}%")
    print(f"    Min: {ret_min*100:.2f}%")
    print(f"    Max: {ret_max*100:.2f}%")
    
    # Sanity checks
    reasonable_mean = -0.01 < ret_mean < 0.01  # Daily returns should be small
    reasonable_std = 0.005 < ret_std < 0.05     # Typical daily volatility
    
    checks["returns_reasonable"] = reasonable_mean and reasonable_std
    print(f"    {'✅' if checks['returns_reasonable'] else '⚠️'} Returns distribution reasonable")
    
    return checks


def main():
    """Run all validation checks."""
    base_dir = Path("data/exported_data")
    
    if not base_dir.exists():
        print(f"\n❌ ERROR: {base_dir} not found!")
        print("Please run the data pipeline first: python run_pipeline.py")
        return
    
    print("\n" + "="*80)
    print("PIPELINE OUTPUT VALIDATION")
    print("="*80)
    print(f"\nValidating: {base_dir.absolute()}")
    
    # Run all validation checks
    file_checks = validate_file_structure(base_dir)
    quality_checks = validate_data_quality(base_dir)
    stats_checks = validate_statistics(base_dir)
    
    # Combine all checks
    all_checks = {**file_checks, **quality_checks, **stats_checks}
    
    # Summary
    print("\n" + "="*80)
    print("VALIDATION SUMMARY")
    print("="*80)
    
    total_checks = len(all_checks)
    passed_checks = sum(all_checks.values())
    failed_checks = total_checks - passed_checks
    
    print(f"\nTotal checks: {total_checks}")
    print(f"✅ Passed: {passed_checks}")
    print(f"❌ Failed: {failed_checks}")
    
    if failed_checks == 0:
        print("\n🎉 ALL CHECKS PASSED! Data is ready for model training.")
        print("\nNext steps:")
        print("  1. Run: python scripts/train_per_asset_models.py")
        print("  2. Evaluate models and save best per asset")
        print("  3. Train RL ensemble using best predictions")
    else:
        print("\n⚠️  SOME CHECKS FAILED. Please review the output above.")
        print("\nFailed checks:")
        for check, passed in all_checks.items():
            if not passed:
                print(f"  ❌ {check}")
    
    print("\n" + "="*80 + "\n")
    
    return all_checks


if __name__ == "__main__":
    main()