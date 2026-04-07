import pandas as pd
import numpy as np
import json
from pathlib import Path

print("="*80)
print("EXPORTED DATA VALIDATION")
print("="*80)

# Load manifest
with open('data/exported_data/manifest.json', 'r') as f:
    manifest = json.load(f)

assets = manifest['tickers']

print("\n" + "="*80)
print("1. PER-ASSET DATA CHECK")
print("="*80)

for asset in assets:
    print(f"\n{asset}:")
    
    # Load train/val/test
    X_train = pd.read_csv(f'data/exported_data/per_asset/{asset}/X_train.csv', index_col=0)
    X_val = pd.read_csv(f'data/exported_data/per_asset/{asset}/X_val.csv', index_col=0)
    X_test = pd.read_csv(f'data/exported_data/per_asset/{asset}/X_test.csv', index_col=0)
    
    y_train = pd.read_csv(f'data/exported_data/per_asset/{asset}/y_train.csv', index_col=0)
    y_val = pd.read_csv(f'data/exported_data/per_asset/{asset}/y_val.csv', index_col=0)
    y_test = pd.read_csv(f'data/exported_data/per_asset/{asset}/y_test.csv', index_col=0)
    
    # Shapes
    print(f"  Shapes: Train={X_train.shape}, Val={X_val.shape}, Test={X_test.shape}")
    
    # NaN check
    train_nans = X_train.isna().sum().sum()
    val_nans = X_val.isna().sum().sum()
    test_nans = X_test.isna().sum().sum()
    
    if train_nans + val_nans + test_nans > 0:
        print(f"  ⚠️  NaNs: Train={train_nans}, Val={val_nans}, Test={test_nans}")
    else:
        print(f"  ✅ No NaNs")
    
    # Date continuity
    print(f"  Dates: {X_train.index[0]} → {X_train.index[-1]} (train)")
    print(f"         {X_val.index[0]} → {X_val.index[-1]} (val)")
    print(f"         {X_test.index[0]} → {X_test.index[-1]} (test)")

print("\n" + "="*80)
print("2. SCALING VERIFICATION")
print("="*80)

print("\nTrain Set (should be mean≈0, std≈1):")
for asset in assets:
    X_train = pd.read_csv(f'data/exported_data/per_asset/{asset}/X_train.csv', index_col=0)
    mean = X_train.mean().mean()
    std = X_train.std().mean()
    print(f"  {asset}: mean={mean:+.6f}, std={std:.6f}")

print("\nTest Set (will have different distribution - DATA LEAKAGE CHECK):")
for asset in assets:
    X_test = pd.read_csv(f'data/exported_data/per_asset/{asset}/X_test.csv', index_col=0)
    mean = X_test.mean().mean()
    std = X_test.std().mean()
    print(f"  {asset}: mean={mean:+.6f}, std={std:.6f}")

print("\n" + "="*80)
print("3. TARGET (y) VALIDATION")
print("="*80)

print("\nTarget statistics (returns):")
for asset in assets:
    y_train = pd.read_csv(f'data/exported_data/per_asset/{asset}/y_train.csv', index_col=0)
    y_test = pd.read_csv(f'data/exported_data/per_asset/{asset}/y_test.csv', index_col=0)
    
    print(f"\n{asset}:")
    print(f"  Train: mean={y_train.mean().values[0]:.6f}, std={y_train.std().values[0]:.6f}")
    print(f"  Test:  mean={y_test.mean().values[0]:.6f}, std={y_test.std().values[0]:.6f}")
    print(f"  Range: [{y_train.min().values[0]:.6f}, {y_train.max().values[0]:.6f}]")

print("\n" + "="*80)
print("4. GLOBAL DATA CHECK")
print("="*80)

X_global = pd.read_csv('data/exported_data/global/X_train.csv', index_col=0)
y_global = pd.read_csv('data/exported_data/global/y_train.csv', index_col=0)

print(f"\nGlobal dataset:")
print(f"  X shape: {X_global.shape}")
print(f"  y shape: {y_global.shape}")
print(f"  Features: {X_global.shape[1]}")
print(f"  Targets (assets): {y_global.shape[1]}")
print(f"  NaNs: {X_global.isna().sum().sum()}")

print("\n" + "="*80)
print("5. SCALER CHECK")
print("="*80)

import joblib
scaler = joblib.load('data/exported_data/scalers/global_scaler.joblib')
print(f"\nScaler type: {type(scaler).__name__}")
print(f"Features scaled: {scaler.n_features_in_}")
print(f"Scaler mean sample: {scaler.mean_[:5]}")
print(f"Scaler scale sample: {scaler.scale_[:5]}")

print("\n" + "="*80)
print("✅ VALIDATION COMPLETE")
print("="*80)
