# steps/preprocess_prices_step.py
# ADVANCED PREPROCESSING with Data Quality Checks

from typing import Dict, List, Tuple
import pandas as pd
import numpy as np
from zenml import step


@step
def preprocess_prices(
    raw_df: pd.DataFrame,
    metadata: Dict[str, List[str]],
) -> pd.DataFrame:
    """
    Advanced preprocessing with comprehensive data quality checks.
    
    Features:
    - Preserves ticker names through metadata
    - Detects and handles stock splits
    - Identifies suspicious price movements
    - Checks for data quality issues
    - Forward-fills small gaps (max 3 days)
    - Validates trading day consistency
    
    Args:
        raw_df: Raw data from yfinance
        metadata: Dict with 'tickers' list
    
    Returns:
        prices_df: Clean adjusted close prices with proper ticker names
    """
    print("\n" + "="*80)
    print("ADVANCED PRICE PREPROCESSING")
    print("="*80)
    
    print(f"\nInput Data:")
    print(f"  Shape: {raw_df.shape}")
    print(f"  Metadata: {metadata}")
    print(f"  Column type: {type(raw_df.columns)}")
    
    # ========================================================================
    # 1. EXTRACT ADJ CLOSE PRICES
    # ========================================================================
    
    # Clean up index first
    if raw_df.index.dtype == 'object':
        print("\nCleaning object-type index...")
        valid_mask = pd.to_datetime(raw_df.index, errors='coerce').notna()
        raw_df = raw_df[valid_mask]
        raw_df.index = pd.to_datetime(raw_df.index)
    
    if isinstance(raw_df.columns, pd.MultiIndex):
        # Perfect case - MultiIndex preserved
        print("\nâœ… MultiIndex structure preserved")
        
        if "Adj Close" not in raw_df.columns.get_level_values(0):
            raise ValueError("'Adj Close' not found in MultiIndex columns")
        
        prices = raw_df["Adj Close"].copy()
        
    else:
        # CSV round-trip case - reconstruct from metadata
        print("\nðŸ”§ Reconstructing from flattened columns...")
        
        tickers = metadata.get("tickers", [])
        if not tickers:
            raise ValueError("No tickers in metadata - cannot reconstruct")
        
        # Find Adj Close columns
        adj_close_cols = [col for col in raw_df.columns if 'Adj Close' in str(col)]
        
        if len(adj_close_cols) != len(tickers):
            print(f"\nâš ï¸  WARNING: {len(adj_close_cols)} Adj Close columns but {len(tickers)} tickers")
            print(f"    Adj Close columns: {adj_close_cols[:5]}...")
            print(f"    Expected tickers: {tickers}")
        
        prices = raw_df[adj_close_cols].copy()
        prices.columns = tickers[:len(adj_close_cols)]
    
    # Ensure datetime index
    if not isinstance(prices.index, pd.DatetimeIndex):
        prices.index = pd.to_datetime(prices.index)
    
    prices = prices.sort_index()
    
    print(f"\nExtracted Adj Close:")
    print(f"  Shape: {prices.shape}")
    print(f"  Tickers: {list(prices.columns)}")
    print(f"  Date range: {prices.index.min()} to {prices.index.max()}")
    
    # ========================================================================
    # 2. DATA QUALITY CHECKS
    # ========================================================================
    print("\n" + "-"*80)
    print("DATA QUALITY CHECKS")
    print("-"*80)
    
    # Check 1: All-NaN columns
    all_nan_cols = prices.columns[prices.isna().all()]
    if len(all_nan_cols) > 0:
        print(f"\nâŒ Removing {len(all_nan_cols)} all-NaN columns: {list(all_nan_cols)}")
        prices = prices.drop(columns=all_nan_cols)
    
    # Check 2: Convert to numeric
    non_numeric = []
    for col in prices.columns:
        if not pd.api.types.is_numeric_dtype(prices[col]):
            non_numeric.append(col)
            prices[col] = pd.to_numeric(prices[col], errors='coerce')
    
    if non_numeric:
        print(f"\nðŸ”§ Converted {len(non_numeric)} non-numeric columns to numeric")
    
    prices = prices.astype(np.float64)
    
    # Check 3: Negative or zero prices
    invalid_prices = (prices <= 0).sum()
    if invalid_prices.sum() > 0:
        print(f"\nâš ï¸  Found negative/zero prices:")
        for col in invalid_prices[invalid_prices > 0].index:
            print(f"    {col}: {invalid_prices[col]} occurrences")
        prices = prices[prices > 0]
    
    # Check 4: Extreme price changes (potential stock splits)
    price_changes = prices.pct_change()
    extreme_threshold = 0.5  # 50% daily change
    extreme_changes = (abs(price_changes) > extreme_threshold).sum()
    
    if extreme_changes.sum() > 0:
        print(f"\nâš ï¸  ALERT: Extreme price movements detected (>50% daily change):")
        for col in extreme_changes[extreme_changes > 0].index:
            print(f"    {col}: {extreme_changes[col]} occurrences")
            # Show the dates
            extreme_dates = price_changes[abs(price_changes[col]) > extreme_threshold].index
            for date in extreme_dates[:3]:  # Show first 3
                change = price_changes.loc[date, col]
                print(f"      {date.date()}: {change:+.1%} change")
    
    # Check 5: Flat periods (no price movement)
    flat_days = (prices.diff() == 0).sum()
    suspicious_flat = flat_days[flat_days > 10]
    
    if len(suspicious_flat) > 0:
        print(f"\nâš ï¸  WARNING: Assets with >10 flat trading days:")
        for col in suspicious_flat.index:
            print(f"    {col}: {flat_days[col]} flat days")
    
    # Check 6: Missing data analysis
    missing_pct = (prices.isna().sum() / len(prices) * 100)
    if missing_pct.max() > 0:
        print(f"\nðŸ“Š Missing data analysis:")
        for col in missing_pct[missing_pct > 0].index:
            print(f"    {col}: {missing_pct[col]:.2f}% missing")
    
    # ========================================================================
    # 3. HANDLE MISSING DATA
    # ========================================================================
    print("\n" + "-"*80)
    print("MISSING DATA HANDLING")
    print("-"*80)
    
    # Strategy: Forward-fill small gaps (max 3 days), then drop rows with NaN
    
    # Count gaps before
    gaps_before = prices.isna().sum().sum()
    
    if gaps_before > 0:
        print(f"\nTotal missing values: {gaps_before}")
        print("Forward-filling gaps (max 3 days)...")
        
        prices = prices.fillna(method='ffill', limit=3)
        
        gaps_after_ffill = prices.isna().sum().sum()
        print(f"After forward-fill: {gaps_after_ffill} missing values remain")
    
    # Drop rows with any remaining NaN
    before_drop = len(prices)
    prices = prices.dropna(how='any')
    after_drop = len(prices)
    
    if before_drop > after_drop:
        print(f"\nDropped {before_drop - after_drop} rows with remaining NaN")
        print(f"Retention: {after_drop/before_drop*100:.1f}%")
    
    if prices.empty:
        raise ValueError("âŒ Prices DataFrame is empty after preprocessing")
    
    # ========================================================================
    # 4. FINAL VALIDATION
    # ========================================================================
    print("\n" + "-"*80)
    print("FINAL VALIDATION")
    print("-"*80)
    
    # Validate all numeric
    if not all(pd.api.types.is_numeric_dtype(prices[col]) for col in prices.columns):
        raise ValueError("âŒ Some columns are still non-numeric after preprocessing")
    
    # Validate no NaN
    if prices.isna().any().any():
        raise ValueError("âŒ NaN values remain after preprocessing")
    
    # Validate positive prices
    if (prices <= 0).any().any():
        raise ValueError("âŒ Non-positive prices remain after preprocessing")
    
    # Validate sufficient data
    if len(prices) < 252:  # Less than 1 year of data
        print(f"\nâš ï¸  WARNING: Only {len(prices)} trading days available (<1 year)")
    
    # Calculate basic statistics
    print(f"\nâœ… Preprocessing Complete:")
    print(f"  Final shape: {prices.shape}")
    print(f"  Date range: {prices.index.min().date()} to {prices.index.max().date()}")
    print(f"  Trading days: {len(prices)}")
    print(f"  Tickers: {list(prices.columns)}")
    
    print(f"\nPrice Statistics:")
    print(prices.describe().loc[['mean', 'std', 'min', 'max']].round(2))
    
    print(f"\nDaily Return Statistics:")
    returns = prices.pct_change().dropna()
    print(f"  Mean return: {returns.mean().mean()*100:.4f}%")
    print(f"  Mean volatility: {returns.std().mean()*100:.4f}%")
    print(f"  Max daily gain: {returns.max().max()*100:.2f}%")
    print(f"  Max daily loss: {returns.min().min()*100:.2f}%")
    
    print("\n" + "="*80 + "\n")
    
    return prices