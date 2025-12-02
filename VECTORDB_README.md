# VectorDB Integration - Time Series Similarity Search

## Overview

The VectorDB integration adds powerful similarity search capabilities to your financial data pipeline. It creates embeddings from sliding windows of market data and stores them in a FAISS index for ultra-fast nearest-neighbor search.

## What It Does

1. **Creates Sliding Windows**: Takes 30-day (configurable) windows of scaled features for each ticker
2. **Generates Embeddings**: Flattens each window into a single vector
3. **Builds FAISS Index**: Stores vectors in an optimized index structure
4. **Saves Metadata**: Preserves date ranges, tickers, and returns for each window
5. **Enables Queries**: Find K most similar historical patterns in milliseconds

## Use Cases

### 1. Pattern-Based Trading Signals
Find historical periods similar to current market conditions and use their subsequent returns as signals.

### 2. Market Regime Detection
Identify market regimes (bull, bear, volatile, stable) by clustering similar patterns.

### 3. Anomaly Detection
Detect unusual market patterns by measuring distance from typical historical patterns.

### 4. Transfer Learning
Use similar historical periods to improve model predictions in current conditions.

### 5. Risk Management
Find historical analogs to current positions to estimate potential outcomes.

## Pipeline Integration

### Enable VectorDB (Default: ON)

```python
# run_pipeline.py
pipeline_instance = data_pipeline(
    tickers=tickers,
    start_date=start_date,
    end_date=end_date,
    train_end_date=train_end_date,
    val_end_date=val_end_date,
    enable_vectordb=True,  # Enable VectorDB indexing
    vectordb_window_size=30,  # 30 trading days ≈ 1.5 months
    save_vectordb_dir="./data/vectordb",
)
```

### Disable VectorDB

```python
pipeline_instance = data_pipeline(
    # ... other params ...
    enable_vectordb=False,  # Skip VectorDB step
)
```

## Output Structure

After running the pipeline with `enable_vectordb=True`:

```
data/vectordb/
├── faiss_index.bin          # FAISS index (binary)
├── metadata.pkl             # Metadata (Python pickle)
├── metadata.json            # Metadata (JSON, human-readable)
├── vectors.npy              # Raw vectors (NumPy array)
└── vectordb_summary.json    # Summary statistics
```

## Query Examples

### Example 1: Find Similar Patterns to Latest Window

```python
from steps.vectordb_index_step import query_similar_windows
import pandas as pd

# Load latest 30 days of SPY features
features = pd.read_parquet("data/processed/features_scaled.parquet")
spy_features = [col for col in features.columns if col.startswith("SPY_")]
latest_window = features[spy_features].iloc[-30:].values.flatten()

# Query for 10 most similar patterns
results, distances = query_similar_windows(latest_window, k=10)

for i, (meta, dist) in enumerate(zip(results, distances), 1):
    print(f"{i}. {meta['ticker']} {meta['date_start']} to {meta['date_end']}")
    print(f"   Distance: {dist:.4f}")
    print(f"   Sharpe: {meta['returns']['sharpe']:.2f}")
```

### Example 2: Find High-Performing Historical Periods

```python
import pickle

# Load metadata
with open("data/vectordb/metadata.pkl", "rb") as f:
    metadata = pickle.load(f)

# Sort by Sharpe ratio
sorted_by_sharpe = sorted(
    [m for m in metadata if m.get('returns')],
    key=lambda x: x['returns']['sharpe'],
    reverse=True
)

# Top 10 best periods
for meta in sorted_by_sharpe[:10]:
    print(f"{meta['ticker']} {meta['date_start']} to {meta['date_end']}")
    print(f"  Sharpe: {meta['returns']['sharpe']:.2f}")
    print(f"  Returns: {meta['returns']['cumulative']*100:.2f}%")
```

### Example 3: Anomaly Detection

```python
import numpy as np
import faiss

# Load index and vectors
index = faiss.read_index("data/vectordb/faiss_index.bin")
vectors = np.load("data/vectordb/vectors.npy")

# Find distance to 5 nearest neighbors for each vector
k = 5
distances, _ = index.search(vectors.astype(np.float32), k)

# Anomaly score = mean distance to neighbors (excluding self)
anomaly_scores = distances[:, 1:].mean(axis=1)

# Most anomalous windows
anomalous_idx = np.argsort(anomaly_scores)[-10:]
print("Most unusual market patterns:")
for idx in anomalous_idx:
    meta = metadata[idx]
    print(f"{meta['ticker']} {meta['date_start']} to {meta['date_end']}")
    print(f"  Anomaly score: {anomaly_scores[idx]:.4f}")
```

## Run Complete Examples

```bash
# Run the pipeline first (if not already done)
python run_pipeline.py

# Run all VectorDB query examples
python scripts/query_vectordb_example.py
```

This will demonstrate:
1. Finding similar patterns to latest data
2. Finding high Sharpe ratio periods
3. Cross-asset similarity analysis
4. Anomaly detection
5. Ticker-specific analysis

## Technical Details

### Window Size Selection

- **30 days** (default): Captures ~1.5 months of market behavior
- **60 days**: Captures ~3 months (quarterly patterns)
- **20 days**: Captures ~1 month (for shorter-term patterns)
- **5 days**: Captures 1 trading week (for very short-term)

```python
# Custom window size
pipeline_instance = data_pipeline(
    # ... other params ...
    vectordb_window_size=60,  # 60 days instead of 30
)
```

### Distance Metrics

**L2 (Euclidean)** (default):
- Measures absolute difference between patterns
- Good for finding similar market conditions

**IP (Inner Product / Cosine Similarity)**:
- Measures directional similarity
- Good for finding similar trends regardless of magnitude

```python
# In vectordb_index_step.py, modify:
index_type="IP"  # For cosine similarity
```

### Vector Dimensions

For a typical setup with 6 tickers and ~50-80 features per ticker:
- Per-ticker features: ~70 features
- Window size: 30 days
- **Vector dimension**: 30 × 70 = **2,100 dimensions**

### Performance

- **Index build time**: ~1-2 seconds for 10,000 windows
- **Query time**: < 1ms for k=10 nearest neighbors
- **Memory**: ~50MB for 10,000 windows × 2,100 dimensions

## Integration with Models

### Using VectorDB Results for Predictions

```python
# Get similar historical windows
results, distances = query_similar_windows(current_window, k=10)

# Calculate consensus prediction from neighbors
neighbor_returns = [r['returns']['cumulative'] for r in results]
predicted_return = np.mean(neighbor_returns)

# Weight by similarity (inverse distance)
weights = 1 / (distances + 1e-6)
weights = weights / weights.sum()
weighted_prediction = sum(w * r['returns']['cumulative'] 
                         for w, r in zip(weights, results))
```

### Ensemble with ML Models

```python
# Combine VectorDB with traditional ML
ml_prediction = model.predict(X_test)
vectordb_prediction = weighted_prediction

# Ensemble
final_prediction = 0.7 * ml_prediction + 0.3 * vectordb_prediction
```

## Troubleshooting

### "FAISS index not found"
Run the pipeline with `enable_vectordb=True` first.

### "Not enough data points for window_size"
Reduce `vectordb_window_size` or use more historical data.

### Memory issues with large datasets
- Use smaller window size
- Index only specific tickers
- Use FAISS's IndexIVFFlat for large-scale data

### Query returns unexpected results
- Check that query vector has same dimension as indexed vectors
- Ensure query data is scaled using the same scaler
- Try different distance metrics (L2 vs IP)

## Future Enhancements

1. **Multi-resolution windows**: Index multiple window sizes (5, 20, 60 days)
2. **Conditional similarity**: Find patterns similar in features but different in outcomes
3. **Streaming updates**: Add new windows incrementally without rebuilding
4. **GPU acceleration**: Use faiss-gpu for 10x faster queries
5. **Dimensionality reduction**: Use PCA/autoencoders before indexing

## References

- [FAISS Documentation](https://github.com/facebookresearch/faiss)
- [Time Series Similarity Search](https://arxiv.org/abs/2101.09545)
- [Pattern Recognition in Financial Markets](https://jfin-swufe.springeropen.com/articles/10.1186/s40854-021-00235-8)
