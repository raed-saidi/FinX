# run_pipeline.py
# Script to execute the advanced financial data pipeline

from pipelines.data_pipeline import data_pipeline


if __name__ == "__main__":
    print("\n" + "="*80)
    print("RUNNING ADVANCED FINANCIAL DATA PIPELINE")
    print("="*80)
    
    # ========================================================================
    # CONFIGURATION
    # ========================================================================
    
    # Asset universe (diversified across asset classes)
    tickers = [
        "SPY",   # S&P 500 (US Large Cap)
        "QQQ",   # Nasdaq 100 (US Tech)
        "EFA",   # EAFE (International Developed)
        "IEF",   # 7-10Y Treasury (Government Bonds)
        "HYG",   # High Yield Corporate Bonds
        "BIL",   # 1-3M Treasury Bills (Cash)
    ]
    
    # Date range
    start_date = "2010-01-01"
    end_date = "2024-12-31"
    
    # Train/test split (use 2017 as split point)
    train_end_date = "2017-12-29"
    
    # Alternative data (VIX, yields, commodities, etc.)
    include_alternative_data = True
    
    # Scaling method
    scaling_method = "standard"  # Options: 'standard', 'robust', 'minmax'
    
    # ========================================================================
    # PRINT CONFIGURATION
    # ========================================================================
    
    print(f"\nPipeline Configuration:")
    print(f"  Tickers: {tickers}")
    print(f"  Start date: {start_date}")
    print(f"  End date: {end_date}")
    print(f"  Train end: {train_end_date}")
    print(f"  Alternative data: {'Enabled' if include_alternative_data else 'Disabled'}")
    print(f"  Scaling method: {scaling_method}")
    
    from datetime import datetime
    train_end = datetime.strptime(train_end_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    train_years = (train_end - datetime.strptime(start_date, "%Y-%m-%d")).days / 365.25
    test_years = (end - train_end).days / 365.25
    
    print(f"\nTemporal split:")
    print(f"  Train period: {train_years:.1f} years ({start_date} to {train_end_date})")
    print(f"  Test period:  {test_years:.1f} years ({train_end_date} to {end_date})")
    
    # ========================================================================
    # RUN PIPELINE
    # ========================================================================
    
    print("\n" + "="*80)
    print("EXECUTING PIPELINE")
    print("="*80 + "\n")
    
    # Execute with cache disabled for fresh run
    pipeline_run = data_pipeline.with_options(
        enable_cache=False  # Force fresh execution
    )(
        tickers=tickers,
        start_date=start_date,
        end_date=end_date,
        train_end_date=train_end_date,
        include_alternative_data=include_alternative_data,
        scaling_method=scaling_method,
    )
    
    print("\n" + "="*80)
    print("PIPELINE EXECUTION COMPLETE")
    print("="*80)
    
    print(f"\nPipeline run: {pipeline_run}")
    print(f"\nAll artifacts have been saved and versioned by ZenML.")
    print(f"To access artifacts, run: python load_pipeline_artifacts.py")