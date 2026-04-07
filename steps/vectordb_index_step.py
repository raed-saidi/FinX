# steps/vectordb_index_step.py
# VECTOR DATABASE INDEXING STEP FOR TIME SERIES SIMILARITY SEARCH

from typing import Dict, List, Tuple, Optional
import pandas as pd
import numpy as np
import faiss
import pickle
import json
from pathlib import Path
from zenml import step
import warnings
warnings.filterwarnings('ignore')


def create_sliding_windows(
    features_scaled: pd.DataFrame,
    returns_clipped: Optional[pd.DataFrame],
    tickers: List[str],
    window_size: int = 30,
) -> Tuple[np.ndarray, List[Dict]]:
    """
    Create sliding windows from time series data for each ticker.
    
    Args:
        features_scaled: Scaled feature matrix (time × features)
        returns_clipped: Returns matrix (time × tickers)
        tickers: List of ticker symbols
        window_size: Number of days per window (default: 30 trading days ≈ 1.5 months)
    
    Returns:
        vectors: numpy array of shape (n_windows, window_size * n_features_per_ticker)
        metadata: List of dicts with window metadata (ticker, date_start, date_end, returns)
    """
    print(f"\nCreating sliding windows (window_size={window_size})...")
    
    vectors = []
    metadata = []
    
    # Get date index
    dates = features_scaled.index
    n_dates = len(dates)
    
    if n_dates < window_size:
        raise ValueError(f"Not enough data points ({n_dates}) for window_size={window_size}")
    
    # For each ticker, extract its features and create windows
    for ticker in tickers:
        print(f"  Processing {ticker}...")
        
        # Find features related to this ticker (e.g., "SPY_ret_1d", "SPY_rsi14", etc.)
        ticker_features = [col for col in features_scaled.columns if col.startswith(f"{ticker}_")]
        
        if not ticker_features:
            print(f"    ⚠️  No features found for {ticker}, skipping...")
            continue
        
        # Extract ticker-specific features
        ticker_data = features_scaled[ticker_features].values  # Shape: (n_dates, n_features)
        n_features = ticker_data.shape[1]
        
        # Create sliding windows
        n_windows = n_dates - window_size + 1
        
        for i in range(n_windows):
            window_start_idx = i
            window_end_idx = i + window_size
            
            # Extract window
            window = ticker_data[window_start_idx:window_end_idx, :]  # Shape: (window_size, n_features)
            
            # Flatten window into a single vector
            vector = window.flatten()  # Shape: (window_size * n_features,)
            
            # Date range for this window
            date_start = dates[window_start_idx]
            date_end = dates[window_end_idx - 1]
            
            # Optional: Get returns for this window
            window_returns = None
            if returns_clipped is not None and ticker in returns_clipped.columns:
                returns_window = returns_clipped[ticker].iloc[window_start_idx:window_end_idx]
                window_returns = {
                    "mean": float(returns_window.mean()),
                    "std": float(returns_window.std()),
                    "cumulative": float(returns_window.sum()),
                    "sharpe": float(returns_window.mean() / returns_window.std() * np.sqrt(252)) if returns_window.std() > 0 else 0.0,
                }
            
            # Store vector and metadata
            vectors.append(vector)
            metadata.append({
                "ticker": ticker,
                "date_start": str(date_start.date()),
                "date_end": str(date_end.date()),
                "window_idx": i,
                "returns": window_returns,
            })
        
        print(f"    ✅ Created {n_windows} windows with {n_features} features each")
    
    # Convert to numpy array
    vectors_array = np.array(vectors, dtype=np.float32)
    
    print(f"\n✅ Total windows created: {len(vectors)}")
    print(f"   Vector dimension: {vectors_array.shape[1]}")
    
    return vectors_array, metadata


def build_faiss_index(vectors: np.ndarray, index_type: str = "L2") -> faiss.Index:
    """
    Build FAISS index for similarity search.
    
    Args:
        vectors: numpy array of shape (n_vectors, dimension)
        index_type: "L2" for Euclidean distance or "IP" for inner product
    
    Returns:
        FAISS index
    """
    print(f"\nBuilding FAISS index (type={index_type})...")
    
    n_vectors, dimension = vectors.shape
    
    # Normalize vectors for cosine similarity if using inner product
    if index_type == "IP":
        print("  Normalizing vectors for cosine similarity...")
        faiss.normalize_L2(vectors)
        index = faiss.IndexFlatIP(dimension)
    else:
        # Use L2 (Euclidean) distance
        index = faiss.IndexFlatL2(dimension)
    
    # Add vectors to index
    print(f"  Adding {n_vectors} vectors to index...")
    index.add(vectors)
    
    print(f"✅ FAISS index built successfully")
    print(f"   Total vectors: {index.ntotal}")
    print(f"   Dimension: {dimension}")
    
    return index


def save_vectordb_artifacts(
    index: faiss.Index,
    metadata: List[Dict],
    vectors: np.ndarray,
    output_dir: str,
    window_size: int,
) -> Dict:
    """
    Save FAISS index, metadata, and summary to disk.
    
    Args:
        index: FAISS index
        metadata: List of metadata dicts
        vectors: Raw vectors (for debugging)
        output_dir: Output directory path
        window_size: Window size used
    
    Returns:
        Summary dict with paths and statistics
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    print(f"\nSaving VectorDB artifacts to {output_dir}...")
    
    # Save FAISS index
    index_path = output_path / "faiss_index.bin"
    faiss.write_index(index, str(index_path))
    print(f"  ✅ Saved FAISS index: {index_path}")
    
    # Save metadata (pickle for Python, JSON for portability)
    metadata_pkl_path = output_path / "metadata.pkl"
    with open(metadata_pkl_path, "wb") as f:
        pickle.dump(metadata, f)
    print(f"  ✅ Saved metadata (pickle): {metadata_pkl_path}")
    
    metadata_json_path = output_path / "metadata.json"
    with open(metadata_json_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"  ✅ Saved metadata (JSON): {metadata_json_path}")
    
    # Save raw vectors (optional, for debugging)
    vectors_path = output_path / "vectors.npy"
    np.save(vectors_path, vectors)
    print(f"  ✅ Saved raw vectors: {vectors_path}")
    
    # Create summary
    tickers = list(set([m["ticker"] for m in metadata]))
    date_ranges = {
        ticker: {
            "start": min([m["date_start"] for m in metadata if m["ticker"] == ticker]),
            "end": max([m["date_end"] for m in metadata if m["ticker"] == ticker]),
        }
        for ticker in tickers
    }
    
    summary = {
        "window_size": window_size,
        "n_vectors": len(metadata),
        "vector_dimension": vectors.shape[1],
        "n_tickers": len(tickers),
        "tickers": tickers,
        "date_ranges": date_ranges,
        "index_type": "L2",
        "paths": {
            "index": str(index_path),
            "metadata_pkl": str(metadata_pkl_path),
            "metadata_json": str(metadata_json_path),
            "vectors": str(vectors_path),
        },
    }
    
    # Save summary
    summary_path = output_path / "vectordb_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"  ✅ Saved summary: {summary_path}")
    
    return summary


@step
def vectordb_index_step(
    features_scaled: pd.DataFrame,
    returns_clipped: pd.DataFrame,
    tickers: List[str],
    output_dir: str = "./data/vectordb",
    window_size: int = 30,
    index_type: str = "L2",
) -> Dict:
    """
    Create VectorDB index for time series similarity search.
    
    This step creates embeddings from sliding windows of scaled features,
    stores them in a FAISS index, and saves metadata for retrieval.
    
    Use cases:
    - Find similar market regimes/patterns from historical data
    - Nearest-neighbor based trading signals
    - Anomaly detection (distance from typical patterns)
    - Transfer learning from similar historical periods
    
    Args:
        features_scaled: Scaled feature matrix from scale_features_step
        returns_clipped: Clipped returns from compute_and_clip_returns
        tickers: List of ticker symbols
        output_dir: Directory to save FAISS index and metadata
        window_size: Number of days per window (default: 30 ≈ 1.5 months)
        index_type: "L2" for Euclidean distance, "IP" for cosine similarity
    
    Returns:
        summary: Dict with VectorDB statistics and file paths
    """
    
    print("\n" + "="*80)
    print("VECTOR DATABASE INDEXING")
    print("="*80)
    
    print(f"\nConfiguration:")
    print(f"  Tickers: {tickers}")
    print(f"  Window size: {window_size} days")
    print(f"  Index type: {index_type}")
    print(f"  Output dir: {output_dir}")
    
    # Validate inputs
    if features_scaled.empty:
        raise ValueError("features_scaled is empty")
    
    print(f"\nInput data:")
    print(f"  Features shape: {features_scaled.shape}")
    print(f"  Date range: {features_scaled.index.min().date()} to {features_scaled.index.max().date()}")
    if returns_clipped is not None:
        print(f"  Returns shape: {returns_clipped.shape}")
    
    # =========================================================================
    # STEP 1: Create sliding windows
    # =========================================================================
    vectors, metadata = create_sliding_windows(
        features_scaled=features_scaled,
        returns_clipped=returns_clipped,
        tickers=tickers,
        window_size=window_size,
    )
    
    # =========================================================================
    # STEP 2: Build FAISS index
    # =========================================================================
    index = build_faiss_index(vectors, index_type=index_type)
    
    # =========================================================================
    # STEP 3: Save artifacts
    # =========================================================================
    summary = save_vectordb_artifacts(
        index=index,
        metadata=metadata,
        vectors=vectors,
        output_dir=output_dir,
        window_size=window_size,
    )
    
    print("\n" + "="*80)
    print("VECTOR DATABASE INDEXING COMPLETE ✅")
    print("="*80)
    print(f"\n📊 Summary:")
    print(f"   Total windows: {summary['n_vectors']}")
    print(f"   Vector dimension: {summary['vector_dimension']}")
    print(f"   Tickers: {', '.join(summary['tickers'])}")
    print(f"   Index saved: {summary['paths']['index']}")
    print("\n💡 Usage:")
    print(f"   Load index: faiss.read_index('{summary['paths']['index']}')")
    print(f"   Load metadata: pickle.load(open('{summary['paths']['metadata_pkl']}', 'rb'))")
    print("\n" + "="*80 + "\n")
    
    return summary


# =============================================================================
# QUERY HELPER FUNCTION (Use after pipeline completes)
# =============================================================================

def query_similar_windows(
    query_vector: np.ndarray,
    vectordb_dir: str = "./data/vectordb",
    k: int = 10,
) -> Tuple[List[Dict], np.ndarray]:
    """
    Query VectorDB for K most similar historical windows.
    
    Usage example:
        # Load latest window for SPY
        features = pd.read_parquet("data/processed/features_scaled.parquet")
        spy_features = [col for col in features.columns if col.startswith("SPY_")]
        latest_window = features[spy_features].iloc[-30:].values.flatten()
        
        # Find similar patterns
        results, distances = query_similar_windows(latest_window, k=10)
        
        for i, (meta, dist) in enumerate(zip(results, distances)):
            print(f"{i+1}. {meta['ticker']} {meta['date_start']} to {meta['date_end']}")
            print(f"   Distance: {dist:.4f}, Sharpe: {meta['returns']['sharpe']:.2f}")
    
    Args:
        query_vector: Query vector (should be same dimension as indexed vectors)
        vectordb_dir: Path to VectorDB directory
        k: Number of nearest neighbors to return
    
    Returns:
        results: List of metadata dicts for K nearest neighbors
        distances: Array of distances for K nearest neighbors
    """
    vectordb_path = Path(vectordb_dir)
    
    # Load FAISS index
    index_path = vectordb_path / "faiss_index.bin"
    if not index_path.exists():
        raise FileNotFoundError(f"FAISS index not found: {index_path}")
    
    index = faiss.read_index(str(index_path))
    
    # Load metadata
    metadata_path = vectordb_path / "metadata.pkl"
    if not metadata_path.exists():
        raise FileNotFoundError(f"Metadata not found: {metadata_path}")
    
    with open(metadata_path, "rb") as f:
        metadata = pickle.load(f)
    
    # Prepare query vector
    query = query_vector.reshape(1, -1).astype(np.float32)
    
    # Search
    distances, indices = index.search(query, k)
    
    # Get results
    results = [metadata[idx] for idx in indices[0]]
    
    return results, distances[0]
