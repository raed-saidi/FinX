# Data Split Changes Summary

## Overview
Successfully converted the data pipeline from a **2-way split** (train/test) to a **3-way split** (train/validation/test) to enable proper walk-forward validation for hyperparameter tuning.

## Split Configuration

### Previous (2-way split):
- **Train**: 2010-2017 (1706 samples)
- **Test**: 2018-2024 (1760 samples)

### New (3-way split):
- **Train**: 2010-2017 (1706 samples) - For initial model training
- **Validation**: 2018-2020 (756 samples) - For hyperparameter tuning and model selection
- **Test**: 2021-2024 (1004 samples) - For final evaluation (never touched during development)

## Modified Files

### 1. `run_pipeline.py`
- Added `val_end_date = "2020-12-31"` configuration parameter
- Updated console output to display all three periods with year calculations
- Passed `val_end_date` to the pipeline function

### 2. `pipelines/data_pipeline.py`
- Added `val_end_date: str` parameter to function signature
- Updated docstring to document train/val/test splits
- Passed validation end date through to the export step

### 3. `steps/export_for_models_step.py`
**Mask Creation:**
- Changed from 2-way to 3-way boolean masks:
  ```python
  train_mask = features_scaled.index <= train_end_date
  val_mask = (features_scaled.index > train_end_date) & (features_scaled.index <= val_end_date)
  test_mask = features_scaled.index > val_end_date
  ```

**Per-Asset Export:**
- Now exports 6 files per asset instead of 4:
  - `X_train.parquet`, `X_train.csv`
  - `X_val.parquet`, `X_val.csv` ⬅️ NEW
  - `X_test.parquet`, `X_test.csv`
  - `y_train.parquet`, `y_train.csv`
  - `y_val.parquet`, `y_val.csv` ⬅️ NEW
  - `y_test.parquet`, `y_test.csv`

**Global Export:**
- Now exports 9 files instead of 6:
  - `X_train.parquet`, `X_val.parquet`, `X_test.parquet`
  - `y_train.parquet`, `y_val.parquet`, `y_test.parquet`
  - `prices_train.parquet`, `prices_val.parquet`, `prices_test.parquet`

**Metadata Updates:**
- Added validation period info to per-asset metadata
- Updated manifest.json to include `val_end_date` and `val_samples`
- Enhanced README.txt with walk-forward validation explanation

## Pipeline Execution Results

✅ **Pipeline completed successfully!**

```
Train period:      8.0 years (2010-01-01 to 2017-12-29)
Validation period: 3.0 years (2017-12-29 to 2020-12-31)
Test period:       4.0 years (2020-12-31 to 2024-12-31)

Total Features: 375
Train Samples: 1706
Validation Samples: 756
Test Samples: 1004
```

## Data Structure

```
exported_data/
├── per_asset/
│   ├── SPY/
│   │   ├── X_train.parquet (70 features × 1706 samples)
│   │   ├── X_val.parquet (70 features × 756 samples)
│   │   ├── X_test.parquet (70 features × 1004 samples)
│   │   ├── y_train.parquet, y_val.parquet, y_test.parquet
│   │   └── metadata.json
│   └── [QQQ, EFA, IEF, HYG, BIL]/
│
├── global/
│   ├── X_train.parquet (375 features × 1706 samples)
│   ├── X_val.parquet (375 features × 756 samples)
│   ├── X_test.parquet (375 features × 1004 samples)
│   ├── y_train.parquet (6 assets)
│   ├── y_val.parquet (6 assets)
│   ├── y_test.parquet (6 assets)
│   ├── prices_train.parquet
│   ├── prices_val.parquet
│   └── prices_test.parquet
│
├── scalers/
│   └── global_scaler.joblib
│
├── manifest.json
└── README.txt
```

## Usage Examples

### Training with Validation Set

```python
import pandas as pd
from pathlib import Path
from lightgbm import LGBMRegressor
import lightgbm as lgb

# Load data for one asset (e.g., SPY)
ticker = "SPY"
data_dir = Path("data/exported_data/per_asset") / ticker

X_train = pd.read_parquet(data_dir / "X_train.parquet")
y_train = pd.read_parquet(data_dir / "y_train.parquet")
X_val = pd.read_parquet(data_dir / "X_val.parquet")
y_val = pd.read_parquet(data_dir / "y_val.parquet")
X_test = pd.read_parquet(data_dir / "X_test.parquet")
y_test = pd.read_parquet(data_dir / "y_test.parquet")

# Train model with validation-based early stopping
model = LGBMRegressor(n_estimators=1000, learning_rate=0.05)
model.fit(
    X_train, y_train[ticker],
    eval_set=[(X_val, y_val[ticker])],
    callbacks=[lgb.early_stopping(50)]
)

# Final evaluation on test set (only after model is finalized)
predictions = model.predict(X_test)
```

## Benefits of Three-Way Split

1. **Prevents Overfitting**: Hyperparameters are tuned on validation set, not test set
2. **Walk-Forward Validation**: Mimics real-world scenario of training on past data
3. **Realistic Performance**: Test set provides unbiased estimate of model performance
4. **Temporal Integrity**: Respects time series nature - no future data leakage
5. **Best Practice**: Standard approach in time series ML competitions and production systems

## Next Steps

1. ✅ Data pipeline updated and tested
2. Update model training scripts to use validation set for hyperparameter tuning
3. Implement cross-validation strategies if needed (time series cross-validation)
4. Use test set only for final model evaluation and reporting

---

**Generated**: 2025-12-02  
**Pipeline Version**: 1.0  
**ZenML Status**: ✅ All steps completed successfully
