# utils/qdrant_helpers.py
# HELPER FUNCTIONS FOR QUERYING QDRANT AND ENSEMBLE PREDICTIONS

from typing import List, Dict, Tuple, Optional, Any
import numpy as np
import pandas as pd
import yaml
from pathlib import Path
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, Range


def load_config(config_path: str = "./config/qdrant_config.yaml") -> Dict:
    """Load Qdrant configuration."""
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def get_qdrant_client_from_config(config_path: str = "./config/qdrant_config.yaml") -> QdrantClient:
    """Initialize Qdrant client from configuration."""
    config = load_config(config_path)
    deployment_type = config['qdrant']['deployment_type']
    
    if deployment_type == 'docker':
        docker_config = config['qdrant']['docker']
        return QdrantClient(
            host=docker_config['host'],
            port=docker_config['port'],
        )
    elif deployment_type == 'cloud':
        cloud_config = config['qdrant']['cloud']
        import os
        api_key = os.getenv('QDRANT_API_KEY', cloud_config.get('api_key'))
        return QdrantClient(
            url=cloud_config['url'],
            api_key=api_key,
        )
    elif deployment_type == 'remote':
        remote_config = config['qdrant']['remote']
        return QdrantClient(
            url=remote_config['url'],
            api_key=remote_config.get('api_key'),
        )
    else:
        raise ValueError(f"Unknown deployment type: {deployment_type}")


def query_similar_windows(
    query_vector: np.ndarray,
    top_k: int = 10,
    ticker_filter: Optional[str] = None,
    date_range: Optional[Tuple[str, str]] = None,
    min_score: float = 0.0,
    config_path: str = "./config/qdrant_config.yaml",
) -> Tuple[List[Dict], List[float]]:
    """
    Query Qdrant for K most similar historical windows.
    
    Args:
        query_vector: Query vector (must match indexed dimension)
        top_k: Number of results to return
        ticker_filter: Filter by specific ticker (optional)
        date_range: Filter by date range (start, end) (optional)
        min_score: Minimum similarity score
        config_path: Path to config file
    
    Returns:
        results: List of metadata dicts for K neighbors
        scores: List of similarity scores
    
    Example:
        >>> # Load latest 30-day window for SPY
        >>> features = pd.read_parquet("data/processed/features_scaled.parquet")
        >>> spy_cols = [c for c in features.columns if c.startswith("SPY_")]
        >>> query = features[spy_cols].iloc[-30:].values.flatten()
        >>> 
        >>> # Find similar patterns
        >>> results, scores = query_similar_windows(query, top_k=10)
        >>> 
        >>> for meta, score in zip(results, scores):
        >>>     print(f"{meta['ticker']} {meta['date_start']} (score: {score:.3f})")
    """
    
    config = load_config(config_path)
    client = get_qdrant_client_from_config(config_path)
    collection_name = config['collection']['name']
    
    # Build filter
    query_filter = None
    filter_conditions = []
    
    if ticker_filter:
        filter_conditions.append(
            FieldCondition(
                key="ticker",
                match=MatchValue(value=ticker_filter)
            )
        )
    
    if date_range:
        start_date, end_date = date_range
        filter_conditions.append(
            FieldCondition(
                key="date_start",
                range=Range(gte=start_date, lte=end_date)
            )
        )
    
    if filter_conditions:
        query_filter = Filter(must=filter_conditions)
    
    # Query
    search_result = client.search(
        collection_name=collection_name,
        query_vector=query_vector.astype(np.float32).tolist(),
        limit=top_k,
        query_filter=query_filter,
        score_threshold=min_score if min_score > 0 else None,
    )
    
    # Extract results
    results = [hit.payload for hit in search_result]
    scores = [hit.score for hit in search_result]
    
    return results, scores


def calculate_weighted_prediction(
    query_vector: np.ndarray,
    top_k: int = 10,
    prediction_field: str = "returns_cumulative",
    weight_method: str = "inverse_distance",
    config_path: str = "./config/qdrant_config.yaml",
    **kwargs
) -> Dict[str, float]:
    """
    Calculate weighted prediction from similar historical windows.
    
    This is useful for ensemble modeling where you want to predict
    future returns based on what happened after similar patterns.
    
    Args:
        query_vector: Query vector
        top_k: Number of neighbors
        prediction_field: Field to predict (e.g., 'returns_cumulative')
        weight_method: 'inverse_distance', 'exponential', or 'uniform'
        config_path: Path to config
        **kwargs: Additional arguments for query_similar_windows
    
    Returns:
        Dict with prediction statistics
    
    Example:
        >>> prediction = calculate_weighted_prediction(
        >>>     query_vector=current_window,
        >>>     top_k=10,
        >>>     prediction_field="returns_cumulative"
        >>> )
        >>> print(f"Expected return: {prediction['weighted_mean']:.2%}")
        >>> print(f"Confidence: {prediction['confidence']:.2f}")
    """
    
    # Query similar windows
    results, scores = query_similar_windows(
        query_vector=query_vector,
        top_k=top_k,
        config_path=config_path,
        **kwargs
    )
    
    if not results:
        return {
            "weighted_mean": 0.0,
            "simple_mean": 0.0,
            "median": 0.0,
            "std": 0.0,
            "confidence": 0.0,
            "n_neighbors": 0,
        }
    
    # Extract prediction values
    values = np.array([r.get(prediction_field, 0.0) for r in results])
    
    # Calculate weights
    if weight_method == "inverse_distance":
        # Higher similarity = lower distance (for Cosine/Dot)
        # Convert scores to weights (higher score = higher weight)
        weights = np.array(scores)
        weights = weights / weights.sum()
    
    elif weight_method == "exponential":
        # Exponential decay with distance
        weights = np.exp(scores)
        weights = weights / weights.sum()
    
    elif weight_method == "uniform":
        weights = np.ones(len(results)) / len(results)
    
    else:
        raise ValueError(f"Unknown weight method: {weight_method}")
    
    # Calculate statistics
    weighted_mean = float(np.sum(weights * values))
    simple_mean = float(values.mean())
    median = float(np.median(values))
    std = float(values.std())
    
    # Confidence based on agreement and score
    confidence = float(np.mean(scores) * (1 - std / (abs(simple_mean) + 1e-6)))
    confidence = max(0.0, min(1.0, confidence))
    
    return {
        "weighted_mean": weighted_mean,
        "simple_mean": simple_mean,
        "median": median,
        "std": std,
        "confidence": confidence,
        "n_neighbors": len(results),
        "min_score": float(min(scores)),
        "max_score": float(max(scores)),
    }


def calculate_anomaly_score(
    query_vector: np.ndarray,
    top_k: int = 5,
    method: str = "average_distance",
    config_path: str = "./config/qdrant_config.yaml",
    **kwargs
) -> Dict[str, float]:
    """
    Calculate anomaly score for a query vector.
    
    High anomaly score indicates the pattern is unusual/rare.
    
    Args:
        query_vector: Query vector
        top_k: Number of neighbors to consider
        method: 'average_distance' or 'min_distance'
        config_path: Path to config
        **kwargs: Additional arguments for query_similar_windows
    
    Returns:
        Dict with anomaly metrics
    
    Example:
        >>> anomaly = calculate_anomaly_score(current_window, top_k=5)
        >>> if anomaly['anomaly_score'] > 0.8:
        >>>     print("⚠️  Unusual market pattern detected!")
    """
    
    # Query similar windows
    results, scores = query_similar_windows(
        query_vector=query_vector,
        top_k=top_k,
        config_path=config_path,
        **kwargs
    )
    
    if not results:
        return {
            "anomaly_score": 1.0,
            "avg_similarity": 0.0,
            "is_anomalous": True,
        }
    
    # Convert similarity scores to distance (1 - score for Cosine)
    distances = 1 - np.array(scores)
    
    if method == "average_distance":
        anomaly_score = float(distances.mean())
    elif method == "min_distance":
        anomaly_score = float(distances.min())
    else:
        raise ValueError(f"Unknown method: {method}")
    
    # Normalize to [0, 1]
    anomaly_score = max(0.0, min(1.0, anomaly_score))
    
    return {
        "anomaly_score": anomaly_score,
        "avg_similarity": float(np.mean(scores)),
        "min_similarity": float(np.min(scores)),
        "max_similarity": float(np.max(scores)),
        "is_anomalous": anomaly_score > 0.5,
        "n_neighbors": len(results),
    }


def get_collection_stats(config_path: str = "./config/qdrant_config.yaml") -> Dict:
    """
    Get statistics about the Qdrant collection.
    
    Returns:
        Dict with collection statistics
    """
    config = load_config(config_path)
    client = get_qdrant_client_from_config(config_path)
    collection_name = config['collection']['name']
    
    try:
        collection_info = client.get_collection(collection_name)
        
        return {
            "collection_name": collection_name,
            "points_count": collection_info.points_count,
            "vector_size": collection_info.config.params.vectors.size,
            "distance": str(collection_info.config.params.vectors.distance),
            "status": str(collection_info.status),
        }
    except Exception as e:
        return {
            "error": str(e),
            "collection_name": collection_name,
        }


def scroll_all_points(
    batch_size: int = 100,
    ticker_filter: Optional[str] = None,
    config_path: str = "./config/qdrant_config.yaml",
) -> List[Dict]:
    """
    Scroll through all points in collection (for analysis).
    
    Args:
        batch_size: Batch size for scrolling
        ticker_filter: Filter by ticker
        config_path: Path to config
    
    Returns:
        List of all metadata dicts
    """
    config = load_config(config_path)
    client = get_qdrant_client_from_config(config_path)
    collection_name = config['collection']['name']
    
    # Build filter
    scroll_filter = None
    if ticker_filter:
        scroll_filter = Filter(
            must=[
                FieldCondition(
                    key="ticker",
                    match=MatchValue(value=ticker_filter)
                )
            ]
        )
    
    # Scroll through points
    all_metadata = []
    offset = None
    
    while True:
        records, offset = client.scroll(
            collection_name=collection_name,
            scroll_filter=scroll_filter,
            limit=batch_size,
            offset=offset,
            with_vectors=False,
        )
        
        if not records:
            break
        
        all_metadata.extend([r.payload for r in records])
        
        if offset is None:
            break
    
    return all_metadata


def find_best_historical_periods(
    metric: str = "sharpe_ratio",
    top_n: int = 20,
    ticker_filter: Optional[str] = None,
    config_path: str = "./config/qdrant_config.yaml",
) -> List[Dict]:
    """
    Find best historical periods by a specific metric.
    
    Args:
        metric: Metric to sort by (e.g., 'sharpe_ratio', 'returns_cumulative')
        top_n: Number of results
        ticker_filter: Filter by ticker
        config_path: Path to config
    
    Returns:
        List of top N periods sorted by metric
    
    Example:
        >>> best_periods = find_best_historical_periods(
        >>>     metric="sharpe_ratio",
        >>>     top_n=10,
        >>>     ticker_filter="SPY"
        >>> )
        >>> for period in best_periods:
        >>>     print(f"{period['date_start']} to {period['date_end']}")
        >>>     print(f"  Sharpe: {period['sharpe_ratio']:.2f}")
    """
    
    # Get all points
    all_metadata = scroll_all_points(
        ticker_filter=ticker_filter,
        config_path=config_path,
    )
    
    # Filter for points with the metric
    filtered = [m for m in all_metadata if metric in m and m[metric] is not None]
    
    # Sort by metric
    sorted_periods = sorted(filtered, key=lambda x: x[metric], reverse=True)
    
    return sorted_periods[:top_n]


def create_ensemble_features(
    query_vector: np.ndarray,
    top_k: int = 10,
    config_path: str = "./config/qdrant_config.yaml",
) -> Dict[str, Any]:
    """
    Create ensemble features from similar historical windows.
    
    This generates a rich feature set that can be used as input
    to ML models for improved predictions.
    
    Args:
        query_vector: Query vector
        top_k: Number of neighbors
        config_path: Path to config
    
    Returns:
        Dict with ensemble features
    
    Example:
        >>> ensemble_feats = create_ensemble_features(current_window, top_k=10)
        >>> # Add to your feature matrix
        >>> X_enhanced = np.hstack([X_original, ensemble_feats['feature_vector']])
    """
    
    # Query neighbors
    results, scores = query_similar_windows(
        query_vector=query_vector,
        top_k=top_k,
        config_path=config_path,
    )
    
    if not results:
        return {
            "feature_vector": np.zeros(10),
            "feature_names": [],
        }
    
    # Extract metrics
    returns = np.array([r.get('returns_cumulative', 0) for r in results])
    sharpe = np.array([r.get('sharpe_ratio', 0) for r in results])
    volatility = np.array([r.get('volatility', 0) for r in results])
    
    # Calculate ensemble features
    features = {
        # Similarity features
        "avg_similarity": float(np.mean(scores)),
        "min_similarity": float(np.min(scores)),
        "max_similarity": float(np.max(scores)),
        "std_similarity": float(np.std(scores)),
        
        # Return features
        "avg_return": float(returns.mean()),
        "median_return": float(np.median(returns)),
        "std_return": float(returns.std()),
        "min_return": float(returns.min()),
        "max_return": float(returns.max()),
        
        # Risk features
        "avg_sharpe": float(sharpe.mean()),
        "avg_volatility": float(volatility.mean()),
        
        # Consensus features
        "return_consistency": float(1 - returns.std() / (abs(returns.mean()) + 1e-6)),
        "positive_ratio": float((returns > 0).sum() / len(returns)),
    }
    
    # Create feature vector
    feature_vector = np.array(list(features.values()))
    feature_names = list(features.keys())
    
    return {
        "feature_vector": feature_vector,
        "feature_names": feature_names,
        "features_dict": features,
        "n_neighbors": len(results),
    }
