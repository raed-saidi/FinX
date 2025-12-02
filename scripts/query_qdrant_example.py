# scripts/query_qdrant_example.py
# EXAMPLE SCRIPT FOR QUERYING QDRANT

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

import pandas as pd
import numpy as np
from utils.qdrant_helpers import (
    query_similar_windows,
    calculate_weighted_prediction,
    calculate_anomaly_score,
    get_collection_stats,
    create_ensemble_features,
)


def main():
    """
    Example usage of Qdrant query helpers.
    
    This demonstrates how to use the vector database for:
    1. Finding similar historical patterns
    2. Making weighted predictions
    3. Detecting anomalies
    4. Creating ensemble features
    """
    
    print("=" * 80)
    print("QDRANT VECTOR DATABASE - QUERY EXAMPLES")
    print("=" * 80)
    
    # =========================================================================
    # 1. Check collection stats
    # =========================================================================
    print("\n[1] Collection Statistics")
    print("-" * 80)
    
    stats = get_collection_stats()
    print(f"Collection: {stats['collection_name']}")
    print(f"Total vectors: {stats.get('points_count', 'N/A')}")
    print(f"Vector size: {stats.get('vector_size', 'N/A')}")
    print(f"Distance metric: {stats.get('distance', 'N/A')}")
    
    # =========================================================================
    # 2. Load current market data and create query vector
    # =========================================================================
    print("\n[2] Loading Current Market Data")
    print("-" * 80)
    
    # Load scaled features
    features_path = "./data/processed/features_scaled.parquet"
    try:
        features = pd.read_parquet(features_path)
        print(f"✓ Loaded {len(features)} time steps")
        print(f"✓ Features: {len(features.columns)} columns")
    except FileNotFoundError:
        print(f"✗ File not found: {features_path}")
        print("  Please run the pipeline first: python run_pipeline.py")
        return
    
    # Create query vector from last 30 days of SPY
    window_size = 30
    spy_cols = [c for c in features.columns if c.startswith("SPY_")]
    
    if not spy_cols:
        print("✗ No SPY features found")
        return
    
    query_data = features[spy_cols].iloc[-window_size:]
    query_vector = query_data.values.flatten()
    
    print(f"✓ Query vector created: {len(query_vector)} dimensions")
    print(f"  Window: {query_data.index[0]} to {query_data.index[-1]}")
    
    # =========================================================================
    # 3. Find similar historical patterns
    # =========================================================================
    print("\n[3] Finding Similar Historical Patterns")
    print("-" * 80)
    
    results, scores = query_similar_windows(
        query_vector=query_vector,
        top_k=10,
        ticker_filter="SPY",
    )
    
    print(f"Found {len(results)} similar periods:\n")
    for i, (meta, score) in enumerate(zip(results, scores), 1):
        print(f"{i:2d}. {meta['date_start']} to {meta['date_end']}")
        print(f"    Similarity: {score:.4f}")
        print(f"    Returns: {meta['returns_cumulative']:.2%}")
        print(f"    Sharpe: {meta.get('sharpe_ratio', 0):.2f}")
        print()
    
    # =========================================================================
    # 4. Calculate weighted prediction
    # =========================================================================
    print("\n[4] Weighted Return Prediction")
    print("-" * 80)
    
    prediction = calculate_weighted_prediction(
        query_vector=query_vector,
        top_k=10,
        prediction_field="returns_cumulative",
        weight_method="inverse_distance",
        ticker_filter="SPY",
    )
    
    print(f"Based on {prediction['n_neighbors']} similar periods:")
    print(f"  Weighted Mean Return: {prediction['weighted_mean']:.2%}")
    print(f"  Simple Mean Return: {prediction['simple_mean']:.2%}")
    print(f"  Median Return: {prediction['median']:.2%}")
    print(f"  Std Dev: {prediction['std']:.2%}")
    print(f"  Confidence: {prediction['confidence']:.2%}")
    print(f"  Score Range: {prediction['min_score']:.4f} - {prediction['max_score']:.4f}")
    
    # =========================================================================
    # 5. Detect anomalies
    # =========================================================================
    print("\n[5] Anomaly Detection")
    print("-" * 80)
    
    anomaly = calculate_anomaly_score(
        query_vector=query_vector,
        top_k=5,
        ticker_filter="SPY",
    )
    
    print(f"Anomaly Score: {anomaly['anomaly_score']:.2%}")
    print(f"Average Similarity: {anomaly['avg_similarity']:.4f}")
    print(f"Is Anomalous: {anomaly['is_anomalous']}")
    
    if anomaly['is_anomalous']:
        print("\n⚠️  WARNING: Unusual market pattern detected!")
        print("   This pattern is rare in historical data.")
    else:
        print("\n✓ Pattern is similar to historical data.")
    
    # =========================================================================
    # 6. Create ensemble features
    # =========================================================================
    print("\n[6] Ensemble Features for ML Models")
    print("-" * 80)
    
    ensemble = create_ensemble_features(
        query_vector=query_vector,
        top_k=10,
    )
    
    print(f"Generated {len(ensemble['feature_names'])} ensemble features:")
    print()
    for name, value in ensemble['features_dict'].items():
        print(f"  {name:25s}: {value:8.4f}")
    
    print("\n✓ These features can be added to your ML models for improved predictions!")
    
    # =========================================================================
    # 7. Cross-asset similarity
    # =========================================================================
    print("\n[7] Cross-Asset Pattern Search")
    print("-" * 80)
    
    # Query without ticker filter to find similar patterns across all assets
    results_all, scores_all = query_similar_windows(
        query_vector=query_vector,
        top_k=10,
    )
    
    print(f"Top 10 similar patterns across all assets:\n")
    for i, (meta, score) in enumerate(zip(results_all, scores_all), 1):
        print(f"{i:2d}. {meta['ticker']:4s} | {meta['date_start']} to {meta['date_end']}")
        print(f"    Similarity: {score:.4f} | Returns: {meta['returns_cumulative']:.2%}")
    
    print("\n" + "=" * 80)
    print("QUERY COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    main()
