# run_pipeline.py
# Script to execute the advanced financial data pipeline

from pipelines.data_pipeline import data_pipeline


if __name__ == "__main__":
    print("\n" + "="*80)
    print("RUNNING ADVANCED FINANCIAL DATA PIPELINE")
    print("="*80)
    
    # ========================================================================
    # CONFIGURATION - 15 STOCKS UNIVERSE
    # ========================================================================
    
    # Asset universe: 15 stocks across major indices and sectors
    tickers = [
        # US Tech Giants
        "AAPL",   # Apple
        "NVDA",   # NVIDIA
        "TSLA",   # Tesla
        "MSFT",   # Microsoft
        "GOOGL",  # Alphabet/Google
        "AMZN",   # Amazon
        "META",   # Meta/Facebook
        
        # US Indices ETFs
        "SPY",    # S&P 500 ETF
        "QQQ",    # NASDAQ 100 ETF
        
        # European (CAC40 exposure)
        "EFA",    # iShares MSCI EAFE (Europe, Australasia, Far East)
        
        # Bonds/Fixed Income
        "IEF",    # 7-10 Year Treasury
        "HYG",    # High Yield Corporate Bonds
        "BIL",    # Short-term Treasury (cash proxy)
        
        # Semiconductors
        "INTC",   # Intel
        "AMD",    # AMD
    ]
    
    # Date range
    start_date = "2010-01-01"
    end_date = "2024-12-31"
    
    # Train/validation/test split
    train_end_date = "2017-12-29"  # Train: 2010-2017
    val_end_date = "2020-12-31"    # Validation: 2018-2020
                                     # Test: 2021-2024
    
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
    print(f"  Validation end: {val_end_date}")
    print(f"  Alternative data: {'Enabled' if include_alternative_data else 'Disabled'}")
    print(f"  Scaling method: {scaling_method}")
    
    from datetime import datetime
    train_end = datetime.strptime(train_end_date, "%Y-%m-%d")
    val_end = datetime.strptime(val_end_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    train_years = (train_end - datetime.strptime(start_date, "%Y-%m-%d")).days / 365.25
    val_years = (val_end - train_end).days / 365.25
    test_years = (end - val_end).days / 365.25
    
    print(f"\nTemporal split:")
    print(f"  Train period:      {train_years:.1f} years ({start_date} to {train_end_date})")
    print(f"  Validation period: {val_years:.1f} years ({train_end_date} to {val_end_date})")
    print(f"  Test period:       {test_years:.1f} years ({val_end_date} to {end_date})")
    
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
        val_end_date=val_end_date,
        include_alternative_data=include_alternative_data,
        scaling_method=scaling_method,
        enable_vectordb=True,  # Enable Qdrant vector database
        qdrant_config_path="./config/qdrant_config.yaml",
    )
    
    print("\n" + "="*80)
    print("PIPELINE EXECUTION COMPLETE")
    print("="*80)
    
    print(f"\nPipeline run: {pipeline_run}")
    print(f"\nAll artifacts have been saved and versioned by ZenML.")
    print(f"To access artifacts, run: python load_pipeline_artifacts.py")
    print(f"\nQdrant vector database indexed successfully!")
    print(f"Query examples: python scripts/query_qdrant_example.py")