# steps/qdrant_index_step.py
# PRODUCTION-READY QDRANT INDEXING STEP FOR TIME SERIES SIMILARITY SEARCH

from typing import Dict, List, Tuple, Optional, Any
import pandas as pd
import numpy as np
import json
import yaml
from pathlib import Path
from datetime import datetime
from zenml import step
import warnings
warnings.filterwarnings('ignore')

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import (
        Distance, VectorParams, PointStruct, 
        Filter, FieldCondition, MatchValue, Range
    )
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False
    QdrantClient = None  # Placeholder to prevent NameError
    Distance = VectorParams = PointStruct = None
    Filter = FieldCondition = MatchValue = Range = None
    print("⚠️  Qdrant client not installed. Install: pip install qdrant-client")


def load_config(config_path: str = "./config/qdrant_config.yaml") -> Dict:
    """Load Qdrant configuration from YAML file."""
    config_file = Path(config_path)
    
    # If relative path, resolve it relative to the smart_investment_ai directory
    if not config_file.is_absolute():
        # Get the directory containing this file (steps/)
        current_file = Path(__file__).resolve()
        # Go up to smart_investment_ai directory
        project_root = current_file.parent.parent
        config_file = project_root / config_path
    
    if not config_file.exists():
        raise FileNotFoundError(f"Config file not found: {config_file} (original path: {config_path})")
    
    with open(config_file, 'r') as f:
        config = yaml.safe_load(f)
    
    return config


def get_qdrant_client(config: Dict) -> QdrantClient:
    """
    Initialize Qdrant client based on deployment type.
    
    Args:
        config: Configuration dictionary
    
    Returns:
        Initialized QdrantClient
    """
    deployment_type = config['qdrant']['deployment_type']
    
    if deployment_type == 'docker':
        docker_config = config['qdrant']['docker']
        client = QdrantClient(
            host=docker_config['host'],
            port=docker_config['port'],
            timeout=30,
        )
        print(f"✅ Connected to Qdrant (Docker): {docker_config['host']}:{docker_config['port']}")
    
    elif deployment_type == 'cloud':
        cloud_config = config['qdrant']['cloud']
        import os
        api_key = os.getenv('QDRANT_API_KEY', cloud_config.get('api_key'))
        client = QdrantClient(
            url=cloud_config['url'],
            api_key=api_key,
            timeout=cloud_config.get('timeout', 30),
        )
        print(f"✅ Connected to Qdrant Cloud: {cloud_config['url']}")
    
    elif deployment_type == 'remote':
        remote_config = config['qdrant']['remote']
        client = QdrantClient(
            url=remote_config['url'],
            api_key=remote_config.get('api_key'),
            timeout=remote_config.get('timeout', 30),
        )
        print(f"✅ Connected to Qdrant (Remote): {remote_config['url']}")
    
    else:
        raise ValueError(f"Unknown deployment type: {deployment_type}")
    
    return client


def create_sliding_windows(
    features_scaled: pd.DataFrame,
    returns_clipped: Optional[pd.DataFrame],
    tickers: List[str],
    window_size: int = 30,
    stride: int = 1,
    min_required_points: int = 25,
) -> Tuple[List[np.ndarray], List[Dict]]:
    """
    Create sliding windows from time series data for each ticker.
    
    Args:
        features_scaled: Scaled feature matrix (time × features)
        returns_clipped: Returns matrix (time × tickers)
        tickers: List of ticker symbols
        window_size: Number of days per window
        stride: Stride for sliding window
        min_required_points: Minimum non-NaN points required
    
    Returns:
        vectors: List of numpy arrays (vectors)
        metadata: List of metadata dicts
    """
    print(f"\nCreating sliding windows (size={window_size}, stride={stride})...")
    
    vectors = []
    metadata = []
    
    dates = features_scaled.index
    n_dates = len(dates)
    
    if n_dates < window_size:
        raise ValueError(f"Not enough data points ({n_dates}) for window_size={window_size}")
    
    # Use ALL features for each ticker window (includes cross-asset and global features)
    all_features_data = features_scaled.values
    n_features = all_features_data.shape[1]
    
    for ticker in tickers:
        print(f"  Processing {ticker}...")
        
        # Create sliding windows
        window_idx = 0
        for i in range(0, n_dates - window_size + 1, stride):
            window_start_idx = i
            window_end_idx = i + window_size
            
            window = all_features_data[window_start_idx:window_end_idx, :]
            
            # Check for sufficient non-NaN data
            non_nan_count = np.sum(~np.isnan(window))
            total_count = window.size
            
            if non_nan_count < min_required_points * n_features:
                continue
            
            # Replace NaNs with 0 for indexing
            window_clean = np.nan_to_num(window, nan=0.0)
            vector = window_clean.flatten().astype(np.float32)
            
            # Date range
            date_start = dates[window_start_idx]
            date_end = dates[window_end_idx - 1]
            
            # Calculate returns metrics
            window_returns = None
            if returns_clipped is not None and ticker in returns_clipped.columns:
                returns_window = returns_clipped[ticker].iloc[window_start_idx:window_end_idx]
                returns_clean = returns_window.dropna()
                
                if len(returns_clean) > 0:
                    cumulative_return = float(returns_clean.sum())
                    mean_return = float(returns_clean.mean())
                    std_return = float(returns_clean.std())
                    
                    # Sharpe ratio (annualized)
                    sharpe = (mean_return / std_return * np.sqrt(252)) if std_return > 0 else 0.0
                    
                    # Max drawdown
                    cumulative = (1 + returns_clean).cumprod()
                    running_max = cumulative.expanding().max()
                    drawdown = (cumulative - running_max) / running_max
                    max_drawdown = float(drawdown.min())
                    
                    window_returns = {
                        "cumulative": cumulative_return,
                        "mean": mean_return,
                        "std": std_return,
                        "sharpe": sharpe,
                        "volatility": std_return * np.sqrt(252),
                        "max_drawdown": max_drawdown,
                    }
            
            # Create metadata
            meta = {
                "ticker": ticker,
                "date_start": str(date_start.date()),
                "date_end": str(date_end.date()),
                "window_idx": window_idx,
                "n_features": n_features,
                "vector_dim": len(vector),
            }
            
            if window_returns:
                meta.update({
                    "returns_cumulative": window_returns["cumulative"],
                    "returns_mean": window_returns["mean"],
                    "returns_std": window_returns["std"],
                    "sharpe_ratio": window_returns["sharpe"],
                    "volatility": window_returns["volatility"],
                    "max_drawdown": window_returns["max_drawdown"],
                })
            
            vectors.append(vector)
            metadata.append(meta)
            window_idx += 1
        
        print(f"    ✅ Created {window_idx} windows")
    
    print(f"\n✅ Total windows: {len(vectors)}")
    print(f"   Vector dimension: {len(vectors[0]) if vectors else 0}")
    
    return vectors, metadata


def setup_qdrant_collection(
    client: QdrantClient,
    collection_name: str,
    vector_size: int,
    distance_metric: str = "Cosine",
    recreate: bool = False,
) -> None:
    """
    Create or update Qdrant collection.
    
    Args:
        client: QdrantClient instance
        collection_name: Name of collection
        vector_size: Dimension of vectors
        distance_metric: Distance metric (Cosine, Euclid, Dot)
        recreate: Whether to recreate collection
    """
    print(f"\nSetting up collection: {collection_name}")
    
    # Check if collection exists
    collections = client.get_collections().collections
    collection_exists = any(c.name == collection_name for c in collections)
    
    if collection_exists and recreate:
        print(f"  🗑️  Deleting existing collection...")
        client.delete_collection(collection_name)
        collection_exists = False
    
    if collection_exists:
        # Verify vector size matches
        collection_info = client.get_collection(collection_name)
        existing_size = collection_info.config.params.vectors.size
        
        if existing_size != vector_size:
            print(f"  ⚠️  Vector size mismatch: existing={existing_size}, required={vector_size}")
            print(f"  🗑️  Recreating collection with correct dimensions...")
            client.delete_collection(collection_name)
            collection_exists = False
        else:
            print(f"  ✅ Collection already exists")
    
    if not collection_exists:
        # Map distance metric
        distance_map = {
            "Cosine": Distance.COSINE,
            "Euclid": Distance.EUCLID,
            "Dot": Distance.DOT,
        }
        
        distance = distance_map.get(distance_metric, Distance.COSINE)
        
        print(f"  📦 Creating collection...")
        print(f"     Vector size: {vector_size}")
        print(f"     Distance: {distance_metric}")
        
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=vector_size,
                distance=distance,
            ),
        )
        print(f"  ✅ Collection created successfully")


def load_indexing_state(state_file: Path) -> Dict:
    """Load indexing state to track what's been indexed."""
    if state_file.exists():
        with open(state_file, 'r') as f:
            return json.load(f)
    return {"indexed_windows": [], "last_index_date": None}


def save_indexing_state(state_file: Path, state: Dict) -> None:
    """Save indexing state."""
    state_file.parent.mkdir(parents=True, exist_ok=True)
    with open(state_file, 'w') as f:
        json.dump(state, f, indent=2)


def index_vectors_to_qdrant(
    client: QdrantClient,
    collection_name: str,
    vectors: List[np.ndarray],
    metadata: List[Dict],
    batch_size: int = 100,
    incremental: bool = True,
    state_file: Optional[Path] = None,
) -> Dict:
    """
    Index vectors to Qdrant with incremental support.
    
    Args:
        client: QdrantClient instance
        collection_name: Collection name
        vectors: List of vectors
        metadata: List of metadata dicts
        batch_size: Batch size for uploads
        incremental: Enable incremental indexing
        state_file: Path to state file
    
    Returns:
        Indexing summary
    """
    print(f"\nIndexing vectors to Qdrant...")
    
    # Load state for incremental indexing
    state = {"indexed_windows": []}
    if incremental and state_file and state_file.exists():
        state = load_indexing_state(state_file)
        print(f"  📋 Loaded state: {len(state['indexed_windows'])} windows previously indexed")
    
    indexed_keys = set(state.get("indexed_windows", []))
    
    # Prepare points
    points = []
    new_count = 0
    skipped_count = 0
    
    for idx, (vector, meta) in enumerate(zip(vectors, metadata)):
        # Create unique key for window
        window_key = f"{meta['ticker']}_{meta['date_start']}_{meta['date_end']}"
        
        # Skip if already indexed
        if incremental and window_key in indexed_keys:
            skipped_count += 1
            continue
        
        point = PointStruct(
            id=idx,
            vector=vector.tolist(),
            payload=meta,
        )
        points.append(point)
        indexed_keys.add(window_key)
        new_count += 1
    
    print(f"  📊 New windows to index: {new_count}")
    print(f"  ⏭️  Skipped (already indexed): {skipped_count}")
    
    # Upload in batches
    total_uploaded = 0
    for i in range(0, len(points), batch_size):
        batch = points[i:i + batch_size]
        client.upsert(
            collection_name=collection_name,
            points=batch,
        )
        total_uploaded += len(batch)
        print(f"  ⬆️  Uploaded batch {i // batch_size + 1}: {total_uploaded}/{len(points)} points")
    
    # Update state
    if incremental and state_file:
        state["indexed_windows"] = list(indexed_keys)
        state["last_index_date"] = datetime.now().isoformat()
        state["total_windows"] = len(indexed_keys)
        save_indexing_state(state_file, state)
        print(f"  💾 Saved indexing state")
    
    # Get collection info
    collection_info = client.get_collection(collection_name)
    
    summary = {
        "collection_name": collection_name,
        "total_vectors": collection_info.points_count,
        "new_vectors_indexed": new_count,
        "skipped_vectors": skipped_count,
        "vector_dimension": len(vectors[0]) if vectors else 0,
        "indexing_time": datetime.now().isoformat(),
    }
    
    print(f"\n✅ Indexing complete!")
    print(f"   Total vectors in collection: {summary['total_vectors']}")
    
    return summary


@step
def index_features_in_qdrant(
    features_scaled: pd.DataFrame,
    returns_clipped: pd.DataFrame,
    tickers: List[str],
    config_path: str = "./config/qdrant_config.yaml",
    output_dir: str = "./data/vectordb",
) -> Dict:
    """
    Production-ready Qdrant indexing step for ZenML pipeline.
    
    This step:
    1. Creates sliding windows from scaled features
    2. Connects to Qdrant (Docker/Cloud/Remote)
    3. Sets up collection with proper configuration
    4. Indexes vectors with incremental support
    5. Saves metadata and summary
    
    Args:
        features_scaled: Scaled features from scale_features_step
        returns_clipped: Clipped returns from compute_and_clip_returns
        tickers: List of ticker symbols
        config_path: Path to qdrant_config.yaml
        output_dir: Directory for metadata and state files
    
    Returns:
        summary: Indexing summary with statistics
    """
    
    if not QDRANT_AVAILABLE:
        raise ImportError("Qdrant client not installed. Install: pip install qdrant-client")
    
    print("\n" + "="*80)
    print("QDRANT VECTOR DATABASE INDEXING")
    print("="*80)
    
    # Load configuration
    config = load_config(config_path)
    print(f"\n📋 Configuration loaded: {config_path}")
    
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # =========================================================================
    # STEP 1: Create sliding windows
    # =========================================================================
    window_config = config['windows']
    vectors, metadata = create_sliding_windows(
        features_scaled=features_scaled,
        returns_clipped=returns_clipped,
        tickers=tickers,
        window_size=window_config['window_size'],
        stride=window_config.get('stride', 1),
        min_required_points=window_config.get('min_required_points', 25),
    )
    
    if not vectors:
        raise ValueError("No windows created. Check data and configuration.")
    
    # =========================================================================
    # STEP 2: Connect to Qdrant
    # =========================================================================
    client = get_qdrant_client(config)
    
    # =========================================================================
    # STEP 3: Setup collection
    # =========================================================================
    collection_config = config['collection']
    collection_name = collection_config['name']
    vector_size = len(vectors[0])
    
    setup_qdrant_collection(
        client=client,
        collection_name=collection_name,
        vector_size=vector_size,
        distance_metric=collection_config['distance_metric'],
        recreate=False,  # Set to True to recreate collection
    )
    
    # =========================================================================
    # STEP 4: Index vectors
    # =========================================================================
    indexing_config = config['indexing']
    state_file = Path(indexing_config['state_file'])
    
    indexing_summary = index_vectors_to_qdrant(
        client=client,
        collection_name=collection_name,
        vectors=vectors,
        metadata=metadata,
        batch_size=indexing_config['batch_size'],
        incremental=indexing_config['incremental'],
        state_file=state_file,
    )
    
    # =========================================================================
    # STEP 5: Save metadata and summary
    # =========================================================================
    metadata_file = output_path / "metadata.json"
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"\n💾 Saved metadata: {metadata_file}")
    
    summary_file = output_path / "qdrant_summary.json"
    summary = {
        "collection_name": collection_name,
        "qdrant_deployment": config['qdrant']['deployment_type'],
        "window_config": window_config,
        "indexing_summary": indexing_summary,
        "metadata_file": str(metadata_file),
        "state_file": str(state_file),
    }
    
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)
    print(f"💾 Saved summary: {summary_file}")
    
    print("\n" + "="*80)
    print("QDRANT INDEXING COMPLETE ✅")
    print("="*80)
    print(f"\n📊 Summary:")
    print(f"   Collection: {collection_name}")
    print(f"   Total vectors: {indexing_summary['total_vectors']}")
    print(f"   New vectors: {indexing_summary['new_vectors_indexed']}")
    print(f"   Vector dimension: {indexing_summary['vector_dimension']}")
    print(f"   Deployment: {config['qdrant']['deployment_type']}")
    print("\n" + "="*80 + "\n")
    
    return summary
