# pipelines/data_pipeline.py
# PRODUCTION-READY FINANCIAL DATA PIPELINE for Multi-Model Architecture

from typing import List
from zenml import pipeline

# Core processing steps
from steps.load_raw_step import load_raw_data
from steps.preprocess_prices_step import preprocess_prices
from steps.returns_clip_step import compute_and_clip_returns
from steps.feature_engineering_step import feature_engineering
from steps.scale_features_step import scale_features

# Save steps
from steps.save_raw_step import save_raw_data_step
from steps.save_processed_step import save_processed_data_step
from steps.export_for_models_step import export_for_models

# VectorDB step - Qdrant (production-ready)
from steps.qdrant_index_step import index_features_in_qdrant


@pipeline
def data_pipeline(
    tickers: List[str],
    start_date: str,
    end_date: str,
    train_end_date: str,
    val_end_date: str,
    include_alternative_data: bool = True,
    scaling_method: str = "standard",
    save_raw_dir: str = "./data/raw",
    save_processed_dir: str = "./data/processed",
    save_exported_dir: str = "./data/exported_data",
    enable_vectordb: bool = True,
    qdrant_config_path: str = "./config/qdrant_config.yaml",
):
    """
    PRODUCTION-READY FINANCIAL DATA PIPELINE
    
    Optimized for multi-model architecture:
    - Per-asset models (LightGBM, XGBoost, LSTM)
    - RL ensemble model
    
    Pipeline Flow:
    1. Load raw OHLCV + alternative data
    2. Preprocess with quality checks
    3. Compute and clip returns (outlier handling)
    4. Engineer 50+ features per asset
    5. Scale features (train-only fitting)
    6. Export in optimized formats:
       - Per-asset: Individual X/y for each ticker
       - Global: Full dataset for RL ensemble
       - Manifests: Metadata for quick inspection
    
    Args:
        tickers: Asset universe (e.g., ['SPY', 'QQQ', 'IEF', 'HYG', 'EFA', 'BIL'])
        start_date: Start date 'YYYY-MM-DD'
        end_date: End date 'YYYY-MM-DD'
        train_end_date: Last date of training period
        val_end_date: Last date of validation period
        include_alternative_data: Fetch VIX, yields, commodities
        scaling_method: 'standard', 'robust', or 'minmax'
        save_raw_dir: Raw data directory
        save_processed_dir: Processed data directory
        save_exported_dir: ML-ready exports directory
        save_vectordb_dir: VectorDB index directory (default: ./data/vectordb)
        enable_vectordb: Enable VectorDB indexing for similarity search (default: True)
        vectordb_window_size: Window size for VectorDB (default: 30 days)
        save_exported_dir: ML-ready exports directory
    
    Outputs:
        All artifacts saved to directories:
        - ./data/raw/ - Raw OHLCV + alternative data
        - ./data/processed/ - Processed data + scalers
        - ./data/exported_data/ - ML-ready train/val/test splits
          - per_asset/{ticker}/ - Per-asset data
          - global/ - Full dataset
          - manifest.json - Complete metadata
    """
    
    # =========================================================================
    # STAGE 1: DATA LOADING
    # =========================================================================
    raw_df, metadata, alternative_data = load_raw_data(
        tickers=tickers,
        start_date=start_date,
        end_date=end_date,
        include_alternative_data=include_alternative_data,
    )
    
    # Save raw data
    save_raw_data_step(
        raw_df=raw_df,
        metadata=metadata,
        alternative_data=alternative_data,
        output_dir=save_raw_dir,
    )
    
    # =========================================================================
    # STAGE 2: PREPROCESSING
    # =========================================================================
    prices = preprocess_prices(
        raw_df=raw_df,
        metadata=metadata,
    )
    
    # =========================================================================
    # STAGE 3: RETURNS & OUTLIER HANDLING
    # =========================================================================
    returns_clipped, clip_thresholds = compute_and_clip_returns(
        prices=prices,
        train_end_date=train_end_date,
    )
    
    # =========================================================================
    # STAGE 4: FEATURE ENGINEERING
    # =========================================================================
    features_all, scaler_regime, kmeans_regime = feature_engineering(
        prices=prices,
        returns_clipped=returns_clipped,
        train_end_date=train_end_date,
    )
    
    # =========================================================================
    # STAGE 5: FEATURE SCALING
    # =========================================================================
    features_scaled, scaler_features, scaling_stats = scale_features(
        features_all=features_all,
        train_end_date=train_end_date,
        scaling_method=scaling_method,
    )
    
    # =========================================================================
    # STAGE 6: SAVE PROCESSED DATA (for inspection/debugging)
    # =========================================================================
    save_processed_data_step(
        prices=prices,
        returns_clipped=returns_clipped,
        clip_thresholds=clip_thresholds,
        features_all=features_all,
        features_scaled=features_scaled,
        scaler_features=scaler_features,
        scaler_regime=scaler_regime,
        kmeans_regime=kmeans_regime,
        scaling_stats=scaling_stats,
        output_dir=save_processed_dir,
    )
    
    # =========================================================================
    # STAGE 7: EXPORT FOR MODELS (Multi-Model Architecture)
    # =========================================================================
    manifest = export_for_models(
        features_scaled=features_scaled,
        returns_clipped=returns_clipped,
        prices=prices,
        scaler_features=scaler_features,
        train_end_date=train_end_date,
        val_end_date=val_end_date,
        tickers=tickers,
        output_dir=save_exported_dir,
    )
    
    # =========================================================================
    # STAGE 8: QDRANT VECTOR DATABASE (Production-Ready Similarity Search)
    # =========================================================================
    if enable_vectordb:
        vectordb_summary = index_features_in_qdrant(
            features_scaled=features_scaled,
            returns_clipped=returns_clipped,
            tickers=tickers,
            config_path=qdrant_config_path,
        )
    
    # Pipeline complete - all artifacts saved and versioned by ZenML
    # Access via: python load_pipeline_artifacts.py
    # Or directly from: ./data/exported_data/