# steps/returns_clip_step.py
# ADVANCED RETURNS COMPUTATION with Statistical Analysis

from typing import Tuple, Dict, Any
import pandas as pd
import numpy as np
from zenml import step
from scipy import stats


@step
def compute_and_clip_returns(
    prices: pd.DataFrame,
    train_end_date: str,
    lower_pct: float = 0.01,
    upper_pct: float = 0.99,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Advanced returns computation with outlier detection and clipping.
    
    Features:
    - Computes log returns (better for statistical properties)
    - Detects outliers using train data only
    - Winsorization based on percentiles
    - Comprehensive statistical analysis
    - Per-asset and global clipping options
    
    Args:
        prices: Clean price matrix (date x ticker)
        train_end_date: Last date of train period (inclusive)
        lower_pct: Lower percentile for winsorization (0.01 = 1%)
        upper_pct: Upper percentile for winsorization (0.99 = 99%)
    
    Returns:
        returns_clipped: Winsorized returns
        thresholds: Dictionary with clipping statistics and thresholds
    """
    print("\n" + "="*80)
    print("ADVANCED RETURNS COMPUTATION")
    print("="*80)
    
    prices = prices.sort_index()
    
    # ========================================================================
    # 1. COMPUTE RETURNS (LOG RETURNS)
    # ========================================================================
    print("\nComputing returns...")
    
    # Log returns have better statistical properties than simple returns
    # log(P_t / P_{t-1}) â‰ˆ (P_t - P_{t-1}) / P_{t-1} for small changes
    returns = np.log(prices / prices.shift(1)).dropna()
    
    # Alternative: simple returns
    # returns = prices.pct_change().dropna()
    
    if returns.empty:
        raise ValueError("âŒ Returns empty after computation")
    
    print(f"  Type: Log returns")
    print(f"  Shape: {returns.shape}")
    print(f"  Date range: {returns.index.min().date()} to {returns.index.max().date()}")
    
    # ========================================================================
    # 2. STATISTICAL ANALYSIS ON TRAIN DATA
    # ========================================================================
    print("\n" + "-"*80)
    print("STATISTICAL ANALYSIS (Train Period)")
    print("-"*80)
    
    train_mask = returns.index <= train_end_date
    if not train_mask.any():
        raise ValueError("âŒ No train data found. Check train_end_date.")
    
    train_returns = returns.loc[train_mask]
    test_returns = returns.loc[~train_mask]
    
    print(f"\nData Split:")
    print(f"  Train: {len(train_returns)} days ({train_returns.index.min().date()} to {train_returns.index.max().date()})")
    print(f"  Test:  {len(test_returns)} days ({test_returns.index.min().date()} to {test_returns.index.max().date()})")
    print(f"  Ratio: {len(train_returns)/len(returns)*100:.1f}% train / {len(test_returns)/len(returns)*100:.1f}% test")
    
    # Per-asset statistics
    print(f"\nPer-Asset Statistics (Train):")
    print(f"{'Ticker':<10} {'Mean':<10} {'Std':<10} {'Sharpe':<10} {'Skew':<10} {'Kurt':<10}")
    print("-"*60)
    
    asset_stats = {}
    
    for ticker in train_returns.columns:
        r = train_returns[ticker]
        
        mean_ret = r.mean() * 252  # Annualized
        std_ret = r.std() * np.sqrt(252)  # Annualized
        sharpe = mean_ret / std_ret if std_ret > 0 else 0
        skewness = r.skew()
        kurtosis = r.kurtosis()
        
        asset_stats[ticker] = {
            'mean': mean_ret,
            'std': std_ret,
            'sharpe': sharpe,
            'skew': skewness,
            'kurt': kurtosis
        }
        
        print(f"{ticker:<10} {mean_ret:>9.2%} {std_ret:>9.2%} {sharpe:>9.2f} {skewness:>9.2f} {kurtosis:>9.2f}")
    
    # ========================================================================
    # 3. OUTLIER DETECTION
    # ========================================================================
    print("\n" + "-"*80)
    print("OUTLIER DETECTION (Train Period)")
    print("-"*80)
    
    # Flatten train returns for global analysis
    train_flat = train_returns.values.flatten()
    train_flat = train_flat[~np.isnan(train_flat)]
    
    print(f"\nGlobal return distribution (all assets combined):")
    print(f"  Observations: {len(train_flat)}")
    print(f"  Mean: {train_flat.mean()*100:.4f}%")
    print(f"  Std: {train_flat.std()*100:.4f}%")
    print(f"  Min: {train_flat.min()*100:.2f}%")
    print(f"  Max: {train_flat.max()*100:.2f}%")
    
    # Calculate percentiles
    percentiles = [0.1, 0.5, 1, 5, 25, 50, 75, 95, 99, 99.5, 99.9]
    print(f"\nPercentile distribution:")
    for p in percentiles:
        val = np.percentile(train_flat, p)
        print(f"  {p:5.1f}%: {val*100:>8.3f}%")
    
    # Determine clipping thresholds
    lower_thr = np.percentile(train_flat, lower_pct * 100.0)
    upper_thr = np.percentile(train_flat, upper_pct * 100.0)
    
    print(f"\nClipping Thresholds:")
    print(f"  Lower ({lower_pct*100}%): {lower_thr*100:.3f}%")
    print(f"  Upper ({upper_pct*100}%): {upper_thr*100:.3f}%")
    
    # Count outliers in train
    n_outliers_train = ((train_flat < lower_thr) | (train_flat > upper_thr)).sum()
    pct_outliers_train = n_outliers_train / len(train_flat) * 100
    
    print(f"\nOutliers in train data:")
    print(f"  Count: {n_outliers_train}")
    print(f"  Percentage: {pct_outliers_train:.2f}%")
    
    # ========================================================================
    # 4. APPLY CLIPPING
    # ========================================================================
    print("\n" + "-"*80)
    print("APPLYING WINSORIZATION")
    print("-"*80)
    
    # Clip using train-derived thresholds
    returns_clipped = returns.clip(lower=lower_thr, upper=upper_thr)
    
    # Count how many values were clipped
    n_clipped_lower = (returns < lower_thr).sum().sum()
    n_clipped_upper = (returns > upper_thr).sum().sum()
    n_total = returns.shape[0] * returns.shape[1]
    
    print(f"\nClipping Results (Full Dataset):")
    print(f"  Clipped below threshold: {n_clipped_lower} ({n_clipped_lower/n_total*100:.2f}%)")
    print(f"  Clipped above threshold: {n_clipped_upper} ({n_clipped_upper/n_total*100:.2f}%)")
    print(f"  Total clipped: {n_clipped_lower + n_clipped_upper} ({(n_clipped_lower + n_clipped_upper)/n_total*100:.2f}%)")
    
    # Per-asset clipping stats
    print(f"\nPer-Asset Clipping:")
    for ticker in returns.columns:
        n_lower = (returns[ticker] < lower_thr).sum()
        n_upper = (returns[ticker] > upper_thr).sum()
        if n_lower + n_upper > 0:
            print(f"  {ticker}: {n_lower} lower, {n_upper} upper")
    
    # ========================================================================
    # 5. VALIDATE CLIPPED RETURNS
    # ========================================================================
    print("\n" + "-"*80)
    print("VALIDATION")
    print("-"*80)
    
    # Check statistics after clipping
    train_clipped = returns_clipped.loc[train_mask]
    
    print(f"\nBefore/After Clipping (Train):")
    print(f"{'Metric':<20} {'Before':<15} {'After':<15} {'Change':<15}")
    print("-"*65)
    
    metrics = {
        'Mean (ann.)': (train_returns.mean().mean() * 252, train_clipped.mean().mean() * 252),
        'Std (ann.)': (train_returns.std().mean() * np.sqrt(252), train_clipped.std().mean() * np.sqrt(252)),
        'Min': (train_returns.min().min(), train_clipped.min().min()),
        'Max': (train_returns.max().max(), train_clipped.max().max()),
        'Skewness': (train_returns.stack().skew(), train_clipped.stack().skew()),
        'Kurtosis': (train_returns.stack().kurtosis(), train_clipped.stack().kurtosis()),
    }
    
    for metric_name, (before, after) in metrics.items():
        if 'Min' in metric_name or 'Max' in metric_name:
            print(f"{metric_name:<20} {before*100:>13.2f}% {after*100:>13.2f}% {(after-before)*100:>13.2f}%")
        elif 'Skewness' in metric_name or 'Kurtosis' in metric_name:
            print(f"{metric_name:<20} {before:>14.2f} {after:>14.2f} {after-before:>14.2f}")
        else:
            print(f"{metric_name:<20} {before*100:>13.2f}% {after*100:>13.2f}% {(after-before)*100:>13.2f}%")
    
    print(f"\nNote: Clipping reduces extreme values and kurtosis (fat tails)")
    
    # ========================================================================
    # 6. COMPILE METADATA
    # ========================================================================
    
    thresholds = {
        # Thresholds
        'lower_threshold': float(lower_thr),
        'upper_threshold': float(upper_thr),
        'lower_percentile': lower_pct,
        'upper_percentile': upper_pct,
        
        # Clipping statistics
        'n_clipped_lower': int(n_clipped_lower),
        'n_clipped_upper': int(n_clipped_upper),
        'pct_clipped': float((n_clipped_lower + n_clipped_upper) / n_total * 100),
        
        # Data split info
        'train_days': int(len(train_returns)),
        'test_days': int(len(test_returns)),
        'train_end_date': str(train_end_date),
        
        # Statistics
        'asset_stats': asset_stats,
        'train_mean_return_ann': float(train_returns.mean().mean() * 252),
        'train_mean_vol_ann': float(train_returns.std().mean() * np.sqrt(252)),
    }
    
    print("\n" + "="*80)
    print("RETURNS COMPUTATION COMPLETE")
    print("="*80 + "\n")
    
    return returns_clipped, thresholds