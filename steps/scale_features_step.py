# steps/scale_features_step.py
# ADVANCED FEATURE SCALING with Distribution Analysis

from typing import Tuple, Dict, Any
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, RobustScaler, MinMaxScaler
from zenml import step


@step
def scale_features(
    features_all: pd.DataFrame,
    train_end_date: str,
    scaling_method: str = "standard",
) -> Tuple[pd.DataFrame, StandardScaler, Dict[str, Any]]:
    """
    Advanced feature scaling with multiple methods and comprehensive analysis.
    
    Scaling Methods:
    - 'standard': StandardScaler (mean=0, std=1) - default, best for normally distributed features
    - 'robust': RobustScaler (median=0, IQR=1) - robust to outliers
    - 'minmax': MinMaxScaler (range=[0,1]) - preserves zero values
    
    Features:
    - Fits scaler on TRAIN data only (prevents data leakage)
    - Analyzes feature distributions
    - Detects high-correlation features
    - Identifies low-variance features
    - Comprehensive scaling validation
    
    Args:
        features_all: Full feature matrix indexed by date
        train_end_date: Last date of train period (inclusive)
        scaling_method: 'standard', 'robust', or 'minmax'
    
    Returns:
        features_scaled: Scaled feature matrix
        scaler: Fitted scaler object
        scaling_stats: Dictionary with scaling statistics and analysis
    """
    print("\n" + "="*80)
    print("ADVANCED FEATURE SCALING")
    print("="*80)
    
    features_all = features_all.sort_index()
    
    # Convert all columns to float64 to avoid type issues
    features_all = features_all.astype(np.float64)
    
    print(f"\nInput Features:")
    print(f"  Shape: {features_all.shape}")
    print(f"  Features: {features_all.shape[1]}")
    print(f"  Date range: {features_all.index.min().date()} to {features_all.index.max().date()}")
    
    # ========================================================================
    # 1. TRAIN/TEST SPLIT
    # ========================================================================
    print("\n" + "-"*80)
    print("DATA SPLIT")
    print("-"*80)
    
    train_mask = features_all.index <= train_end_date
    if not train_mask.any():
        raise ValueError("âŒ No train data for scaling. Check train_end_date.")
    
    X_train = features_all.loc[train_mask]
    X_test = features_all.loc[~train_mask]
    
    print(f"\nTrain: {len(X_train)} days ({X_train.index.min().date()} to {X_train.index.max().date()})")
    print(f"Test:  {len(X_test)} days ({X_test.index.min().date()} to {X_test.index.max().date()})")
    print(f"Split: {len(X_train)/len(features_all)*100:.1f}% / {len(X_test)/len(features_all)*100:.1f}%")
    
    # ========================================================================
    # 2. FEATURE ANALYSIS (TRAIN DATA)
    # ========================================================================
    print("\n" + "-"*80)
    print("FEATURE ANALYSIS (Train Data)")
    print("-"*80)
    
    # Check for NaN
    nan_counts = X_train.isna().sum()
    if nan_counts.sum() > 0:
        print(f"\nâš ï¸  WARNING: Found NaN values in features:")
        for col in nan_counts[nan_counts > 0].index[:10]:
            print(f"    {col}: {nan_counts[col]} NaN")
        raise ValueError("âŒ Cannot scale features with NaN values")
    
    # Check for infinite values
    inf_counts = np.isinf(X_train).sum()
    if inf_counts.sum() > 0:
        print(f"\nâš ï¸  WARNING: Found infinite values in features:")
        for col in inf_counts[inf_counts > 0].index[:10]:
            print(f"    {col}: {inf_counts[col]} infinite")
        raise ValueError("âŒ Cannot scale features with infinite values")
    
    # Distribution analysis
    print(f"\nFeature Distributions:")
    print(f"{'Statistic':<20} {'Min':<12} {'Median':<12} {'Mean':<12} {'Max':<12}")
    print("-"*68)
    
    for stat in ['mean', 'std', 'min', 'max']:
        stat_vals = X_train.agg(stat)
        print(f"{stat.capitalize():<20} {stat_vals.min():>11.4f} {stat_vals.median():>11.4f} {stat_vals.mean():>11.4f} {stat_vals.max():>11.4f}")
    
    # Skewness and Kurtosis
    skewness = X_train.skew()
    kurtosis = X_train.kurtosis()
    
    print(f"\nSkewness: min={skewness.min():.2f}, median={skewness.median():.2f}, max={skewness.max():.2f}")
    print(f"Kurtosis: min={kurtosis.min():.2f}, median={kurtosis.median():.2f}, max={kurtosis.max():.2f}")
    
    # Identify highly skewed features (|skew| > 2)
    highly_skewed = skewness[abs(skewness) > 2]
    if len(highly_skewed) > 0:
        print(f"\nâš ï¸  {len(highly_skewed)} highly skewed features (|skew| > 2):")
        for feat in highly_skewed.head(5).index:
            print(f"    {feat}: skew={skewness[feat]:.2f}")
        if len(highly_skewed) > 5:
            print(f"    ... and {len(highly_skewed)-5} more")
    
    # Low variance features (variance < 0.01)
    variances = X_train.var()
    low_var = variances[variances < 0.01]
    if len(low_var) > 0:
        print(f"\nâš ï¸  {len(low_var)} low-variance features (var < 0.01):")
        for feat in low_var.head(5).index:
            print(f"    {feat}: var={variances[feat]:.6f}")
        if len(low_var) > 5:
            print(f"    ... and {len(low_var)-5} more")
        print(f"\n   Consider removing these features for model training")
    
    # High correlation features - only compute for non-constant features
    print(f"\nComputing feature correlations...")
    non_constant_features = X_train.loc[:, X_train.std() > 0]
    
    if len(non_constant_features.columns) > 1:
        corr_matrix = non_constant_features.corr().abs()
        
        # Find highly correlated pairs (correlation > 0.95, excluding self-correlation)
        high_corr_pairs = []
        for i in range(len(corr_matrix.columns)):
            for j in range(i+1, len(corr_matrix.columns)):
                if corr_matrix.iloc[i, j] > 0.95:
                    high_corr_pairs.append((
                        corr_matrix.columns[i],
                        corr_matrix.columns[j],
                        corr_matrix.iloc[i, j]
                    ))
        
        if len(high_corr_pairs) > 0:
            print(f"\nâš ï¸  Found {len(high_corr_pairs)} highly correlated feature pairs (corr > 0.95):")
            for feat1, feat2, corr_val in high_corr_pairs[:5]:
                print(f"    {feat1} <-> {feat2}: {corr_val:.3f}")
            if len(high_corr_pairs) > 5:
                print(f"    ... and {len(high_corr_pairs)-5} more pairs")
            print(f"\n   Consider removing redundant features")
    else:
        high_corr_pairs = []
        print("  Skipping correlation analysis (insufficient non-constant features)")
    
    # ========================================================================
    # 3. CHOOSE AND FIT SCALER
    # ========================================================================
    print("\n" + "-"*80)
    print("FITTING SCALER")
    print("-"*80)
    
    if scaling_method == "standard":
        scaler = StandardScaler()
        print(f"\nUsing StandardScaler (mean=0, std=1)")
        print("  Best for: Normally distributed features, most ML algorithms")
    elif scaling_method == "robust":
        scaler = RobustScaler()
        print(f"\nUsing RobustScaler (median=0, IQR=1)")
        print("  Best for: Features with outliers, non-normal distributions")
    elif scaling_method == "minmax":
        scaler = MinMaxScaler()
        print(f"\nUsing MinMaxScaler (range=[0,1])")
        print("  Best for: Neural networks, algorithms requiring bounded inputs")
    else:
        raise ValueError(f"Unknown scaling method: {scaling_method}")
    
    # Fit on train data only
    print(f"\nFitting on {len(X_train)} training samples...")
    scaler.fit(X_train.values)
    
    # ========================================================================
    # 4. TRANSFORM FULL DATASET
    # ========================================================================
    print("\n" + "-"*80)
    print("TRANSFORMING FEATURES")
    print("-"*80)
    
    # Transform full dataset using train-fitted scaler
    X_scaled_all = scaler.transform(features_all.values)
    
    features_scaled = pd.DataFrame(
        X_scaled_all,
        index=features_all.index,
        columns=features_all.columns,
    )
    
    print(f"\nâœ… Scaled features:")
    print(f"  Shape: {features_scaled.shape}")
    print(f"  Date range: {features_scaled.index.min().date()} to {features_scaled.index.max().date()}")
    
    # ========================================================================
    # 5. VALIDATION
    # ========================================================================
    print("\n" + "-"*80)
    print("VALIDATION")
    print("-"*80)
    
    # Split scaled data
    X_train_scaled = features_scaled.loc[train_mask]
    X_test_scaled = features_scaled.loc[~train_mask]
    
    # Verify train set has meanâ‰ˆ0, stdâ‰ˆ1 for StandardScaler
    if scaling_method == "standard":
        train_means = X_train_scaled.mean()
        train_stds = X_train_scaled.std()
        
        print(f"\nTrain Set Statistics (should be meanâ‰ˆ0, stdâ‰ˆ1):")
        print(f"  Mean: min={train_means.min():.4f}, median={train_means.median():.4f}, max={train_means.max():.4f}")
        print(f"  Std:  min={train_stds.min():.4f}, median={train_stds.median():.4f}, max={train_stds.max():.4f}")
        
        # Check if means are close to 0
        if abs(train_means.mean()) > 1e-10:
            print(f"\nâš ï¸  WARNING: Train means not centered at 0 (avg={train_means.mean():.2e})")
        
        # Check if stds are close to 1
        if abs(train_stds.mean() - 1.0) > 0.01:
            print(f"\nâš ï¸  WARNING: Train stds not scaled to 1 (avg={train_stds.mean():.4f})")
    
    # Test set statistics (will differ from train)
    test_means = X_test_scaled.mean()
    test_stds = X_test_scaled.std()
    
    print(f"\nTest Set Statistics:")
    print(f"  Mean: min={test_means.min():.4f}, median={test_means.median():.4f}, max={test_means.max():.4f}")
    print(f"  Std:  min={test_stds.min():.4f}, median={test_stds.median():.4f}, max={test_stds.max():.4f}")
    
    # Check for extreme values after scaling
    extreme_vals_train = (abs(X_train_scaled) > 5).sum()
    extreme_vals_test = (abs(X_test_scaled) > 5).sum()
    
    if extreme_vals_train.sum() > 0:
        print(f"\nâš ï¸  Extreme values in train (|x| > 5): {extreme_vals_train.sum()} occurrences")
        top_extreme = extreme_vals_train.sort_values(ascending=False).head(3)
        for feat, count in top_extreme.items():
            print(f"    {feat}: {count} times")
    
    if extreme_vals_test.sum() > 0:
        print(f"\nâš ï¸  Extreme values in test (|x| > 5): {extreme_vals_test.sum()} occurrences")
        top_extreme = extreme_vals_test.sort_values(ascending=False).head(3)
        for feat, count in top_extreme.items():
            print(f"    {feat}: {count} times")
    
    # ========================================================================
    # 6. COMPILE STATISTICS
    # ========================================================================
    
    scaling_stats = {
        'scaling_method': scaling_method,
        'n_features': features_all.shape[1],
        'train_samples': len(X_train),
        'test_samples': len(X_test),
        
        # Feature quality metrics
        'n_low_variance': int(len(low_var)),
        'n_highly_correlated_pairs': int(len(high_corr_pairs)),
        'n_highly_skewed': int(len(highly_skewed)),
        
        # Scaling validation
        'train_mean_min': float(train_means.min()),
        'train_mean_max': float(train_means.max()),
        'train_std_min': float(train_stds.min()),
        'train_std_max': float(train_stds.max()),
        
        'test_mean_min': float(test_means.min()),
        'test_mean_max': float(test_means.max()),
        'test_std_min': float(test_stds.min()),
        'test_std_max': float(test_stds.max()),
        
        # Feature names for reference
        'feature_names': list(features_all.columns),
        'low_variance_features': list(low_var.index) if len(low_var) > 0 else [],
        'highly_skewed_features': list(highly_skewed.index) if len(highly_skewed) > 0 else [],
    }
    
    print("\n" + "="*80)
    print("FEATURE SCALING COMPLETE")
    print("="*80)
    print(f"\nâœ… Scaled {features_scaled.shape[1]} features across {len(features_scaled)} time steps")
    print(f"âœ… Scaler fitted on {len(X_train)} training samples only")
    print(f"âœ… No data leakage - test data not used in scaling")
    
    if len(low_var) > 0 or len(high_corr_pairs) > 0:
        print(f"\nðŸ’¡ Recommendation: Consider feature selection to remove:")
        if len(low_var) > 0:
            print(f"   - {len(low_var)} low-variance features")
        if len(high_corr_pairs) > 0:
            print(f"   - {len(high_corr_pairs)} redundant highly-correlated features")
    
    print("\n" + "="*80 + "\n")
    
    return features_scaled, scaler, scaling_stats