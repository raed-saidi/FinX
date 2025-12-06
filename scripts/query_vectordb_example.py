# scripts/query_vectordb_example.py
# EXAMPLE: Query VectorDB for similar historical market patterns

"""
This script demonstrates how to query the VectorDB to find similar historical
market patterns/regimes. Useful for:
- Finding similar market conditions
- Pattern-based trading signals  
- Anomaly detection
- Transfer learning from similar periods
"""

import pandas as pd
import numpy as np
import pickle
import faiss
from pathlib import Path
from steps.vectordb_index_step import query_similar_windows


def example_1_find_similar_to_latest_window():
    """Find patterns similar to the most recent 30 days of SPY."""
    
    print("\n" + "="*80)
    print("EXAMPLE 1: Find Similar Patterns to Latest 30 Days of SPY")
    print("="*80)
    
    # Load features
    features = pd.read_parquet("data/processed/features_scaled.parquet")
    
    # Get SPY features from the latest 30 days
    spy_features = [col for col in features.columns if col.startswith("SPY_")]
    latest_window = features[spy_features].iloc[-30:].values.flatten()
    
    print(f"\nQuery vector shape: {latest_window.shape}")
    print(f"Latest date: {features.index[-1].date()}")
    
    # Query for 10 most similar patterns
    results, distances = query_similar_windows(latest_window, k=10)
    
    print(f"\nTop 10 similar historical patterns:")
    print("-" * 80)
    
    for i, (meta, dist) in enumerate(zip(results, distances), 1):
        returns_info = meta.get('returns', {})
        print(f"\n{i}. {meta['ticker']} | {meta['date_start']} → {meta['date_end']}")
        print(f"   Distance: {dist:.4f}")
        if returns_info:
            print(f"   Returns: {returns_info['cumulative']*100:.2f}% cumulative")
            print(f"   Sharpe: {returns_info['sharpe']:.2f}")
            print(f"   Volatility: {returns_info['std']*100:.2f}%")


def example_2_find_high_sharpe_periods():
    """Find historical windows with high Sharpe ratios."""
    
    print("\n" + "="*80)
    print("EXAMPLE 2: Find Historical Windows with High Sharpe Ratios")
    print("="*80)
    
    # Load metadata
    metadata_path = Path("data/vectordb/metadata.pkl")
    with open(metadata_path, "rb") as f:
        metadata = pickle.load(f)
    
    # Filter for windows with returns data
    windows_with_returns = [m for m in metadata if m.get('returns') is not None]
    
    # Sort by Sharpe ratio
    sorted_by_sharpe = sorted(
        windows_with_returns,
        key=lambda x: x['returns']['sharpe'],
        reverse=True
    )
    
    print(f"\nTop 20 windows by Sharpe ratio:")
    print("-" * 80)
    
    for i, meta in enumerate(sorted_by_sharpe[:20], 1):
        returns_info = meta['returns']
        print(f"\n{i}. {meta['ticker']} | {meta['date_start']} → {meta['date_end']}")
        print(f"   Sharpe: {returns_info['sharpe']:.2f}")
        print(f"   Returns: {returns_info['cumulative']*100:.2f}% cumulative")
        print(f"   Volatility: {returns_info['std']*100:.2f}%")


def example_3_cross_asset_similarity():
    """Find similar patterns across different assets."""
    
    print("\n" + "="*80)
    print("EXAMPLE 3: Cross-Asset Pattern Similarity")
    print("="*80)
    
    # Load features
    features = pd.read_parquet("data/processed/features_scaled.parquet")
    
    # Get a specific QQQ window (e.g., during a volatile period)
    qqq_features = [col for col in features.columns if col.startswith("QQQ_")]
    
    # Let's take a window from 2020 (COVID crash period)
    covid_period = features.loc["2020-02-15":"2020-03-31"]
    if len(covid_period) >= 30:
        covid_window = covid_period[qqq_features].iloc[:30].values.flatten()
        
        print(f"\nQuery: QQQ during COVID crash (Feb-Mar 2020)")
        print(f"Looking for similar patterns across all tickers...")
        
        # Find similar patterns
        results, distances = query_similar_windows(covid_window, k=15)
        
        print(f"\nTop 15 similar patterns:")
        print("-" * 80)
        
        for i, (meta, dist) in enumerate(zip(results, distances), 1):
            returns_info = meta.get('returns', {})
            print(f"\n{i}. {meta['ticker']} | {meta['date_start']} → {meta['date_end']}")
            print(f"   Distance: {dist:.4f}")
            if returns_info:
                print(f"   Returns: {returns_info['cumulative']*100:.2f}%")
                print(f"   Sharpe: {returns_info['sharpe']:.2f}")
    else:
        print("  ⚠️  Not enough data for COVID period analysis")


def example_4_anomaly_detection():
    """Detect unusual market patterns (high distance from all neighbors)."""
    
    print("\n" + "="*80)
    print("EXAMPLE 4: Anomaly Detection - Find Unusual Market Patterns")
    print("="*80)
    
    # Load vectors and metadata
    vectors = np.load("data/vectordb/vectors.npy")
    
    with open("data/vectordb/metadata.pkl", "rb") as f:
        metadata = pickle.load(f)
    
    # Load FAISS index
    index = faiss.read_index("data/vectordb/faiss_index.bin")
    
    # For each vector, find its nearest neighbor distance
    k = 5
    distances_all, _ = index.search(vectors.astype(np.float32), k)
    
    # Use mean distance to k nearest neighbors as anomaly score
    anomaly_scores = distances_all[:, 1:].mean(axis=1)  # Skip self (distance=0)
    
    # Find most anomalous windows
    anomalous_indices = np.argsort(anomaly_scores)[-20:][::-1]
    
    print(f"\nTop 20 most anomalous windows (unusual patterns):")
    print("-" * 80)
    
    for i, idx in enumerate(anomalous_indices, 1):
        meta = metadata[idx]
        score = anomaly_scores[idx]
        returns_info = meta.get('returns', {})
        
        print(f"\n{i}. {meta['ticker']} | {meta['date_start']} → {meta['date_end']}")
        print(f"   Anomaly score: {score:.4f}")
        if returns_info:
            print(f"   Returns: {returns_info['cumulative']*100:.2f}%")
            print(f"   Volatility: {returns_info['std']*100:.2f}%")


def example_5_ticker_specific_analysis():
    """Analyze similarity patterns within a specific ticker."""
    
    print("\n" + "="*80)
    print("EXAMPLE 5: SPY Pattern Clustering")
    print("="*80)
    
    # Load metadata
    with open("data/vectordb/metadata.pkl", "rb") as f:
        metadata = pickle.load(f)
    
    # Filter for SPY windows
    spy_windows = [m for m in metadata if m['ticker'] == 'SPY']
    
    print(f"\nTotal SPY windows: {len(spy_windows)}")
    
    # Get performance distribution
    sharpe_ratios = [w['returns']['sharpe'] for w in spy_windows if w.get('returns')]
    returns_cum = [w['returns']['cumulative'] for w in spy_windows if w.get('returns')]
    
    print(f"\nSPY Performance Statistics:")
    print(f"  Average Sharpe: {np.mean(sharpe_ratios):.2f}")
    print(f"  Std Sharpe: {np.std(sharpe_ratios):.2f}")
    print(f"  Best Sharpe: {np.max(sharpe_ratios):.2f}")
    print(f"  Worst Sharpe: {np.min(sharpe_ratios):.2f}")
    print(f"\n  Average 30-day return: {np.mean(returns_cum)*100:.2f}%")
    print(f"  Best 30-day return: {np.max(returns_cum)*100:.2f}%")
    print(f"  Worst 30-day return: {np.min(returns_cum)*100:.2f}%")


if __name__ == "__main__":
    print("\n" + "="*80)
    print("VECTORDB QUERY EXAMPLES")
    print("="*80)
    print("\nMake sure you've run the pipeline with enable_vectordb=True first!")
    print("This will create: ./data/vectordb/ with FAISS index and metadata")
    
    # Check if VectorDB exists
    if not Path("data/vectordb/faiss_index.bin").exists():
        print("\n❌ VectorDB not found!")
        print("Run: python run_pipeline.py (with enable_vectordb=True)")
        exit(1)
    
    # Run examples
    try:
        example_1_find_similar_to_latest_window()
    except Exception as e:
        print(f"\n⚠️  Example 1 failed: {e}")
    
    try:
        example_2_find_high_sharpe_periods()
    except Exception as e:
        print(f"\n⚠️  Example 2 failed: {e}")
    
    try:
        example_3_cross_asset_similarity()
    except Exception as e:
        print(f"\n⚠️  Example 3 failed: {e}")
    
    try:
        example_4_anomaly_detection()
    except Exception as e:
        print(f"\n⚠️  Example 4 failed: {e}")
    
    try:
        example_5_ticker_specific_analysis()
    except Exception as e:
        print(f"\n⚠️  Example 5 failed: {e}")
    
    print("\n" + "="*80)
    print("ALL EXAMPLES COMPLETE")
    print("="*80 + "\n")
