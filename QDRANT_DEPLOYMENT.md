# Qdrant Vector Database - Production Deployment Guide

## 🎯 Overview

This guide covers the complete setup and usage of **Qdrant**, a production-ready vector database for time series similarity search in the Smart Investment AI pipeline.

### Why Qdrant?

- **Production-Ready**: Built for scale with high availability
- **Incremental Indexing**: Only index new data on each run
- **Persistent Storage**: Docker volumes for data durability
- **Rich Filtering**: Query by ticker, date range, metrics
- **High Performance**: Fast similarity search with HNSW algorithm
- **Easy Deployment**: Docker-based with simple configuration

---

## 📋 Table of Contents

1. [Architecture](#architecture)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Deployment Options](#deployment-options)
5. [Pipeline Integration](#pipeline-integration)
6. [Query Examples](#query-examples)
7. [Ensemble Modeling](#ensemble-modeling)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)
10. [Scaling](#scaling)

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    ZenML Pipeline                           │
│  ┌────────┐  ┌─────────┐  ┌──────────┐  ┌──────────────┐  │
│  │Load Raw│→ │Preprocess│→ │Features  │→ │Qdrant Index  │  │
│  └────────┘  └─────────┘  └──────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                    ↓
                        ┌───────────────────────┐
                        │   Qdrant Database     │
                        │  (Docker Container)   │
                        ├───────────────────────┤
                        │  • REST API :6333     │
                        │  • gRPC API :6334     │
                        │  • Web UI :6333/dash  │
                        │  • Persistent Volume  │
                        └───────────────────────┘
                                    ↓
                        ┌───────────────────────┐
                        │   Query Helpers       │
                        ├───────────────────────┤
                        │  • Similarity Search  │
                        │  • Weighted Predict   │
                        │  • Anomaly Detection  │
                        │  • Ensemble Features  │
                        └───────────────────────┘
```

### Data Flow

1. **Indexing** (Pipeline Run):
   - Features scaled → Sliding windows created → Qdrant indexed
   - Incremental: Only new windows indexed (state file tracking)
   - Metadata: ticker, dates, returns, Sharpe, drawdown

2. **Querying** (ML Models):
   - Load current window → Query Qdrant → Get K neighbors
   - Calculate weighted predictions → Ensemble features → ML input

---

## 🚀 Quick Start

### 1. Start Qdrant Server

```powershell
# Navigate to project directory
cd c:\Users\Raed\Desktop\ai-odissey\smart_investment_ai

# Start Qdrant with Docker Compose
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f qdrant
```

**Expected output:**
```
✓ Container qdrant-smart-investment started
✓ REST API: http://localhost:6333
✓ Web UI: http://localhost:6333/dashboard
```

### 2. Run Pipeline with Qdrant

```powershell
# Run full pipeline (includes Qdrant indexing)
python run_pipeline.py
```

The pipeline will:
- Process all features
- Create 30-day sliding windows
- Index to Qdrant (incremental)
- Save state file for next run

### 3. Query Qdrant

```powershell
# Run example query script
python scripts/query_qdrant_example.py
```

This demonstrates:
- Finding similar patterns
- Weighted predictions
- Anomaly detection
- Ensemble features

---

## ⚙️ Configuration

All settings are in `config/qdrant_config.yaml`:

### Core Settings

```yaml
qdrant:
  deployment_type: docker  # Options: docker, cloud, remote
  
  docker:
    host: localhost
    port: 6333
    
collection:
  name: financial_timeseries_v1
  distance_metric: Cosine  # Options: Cosine, Euclid, Dot
  
window:
  size: 30          # Days per window
  stride: 1         # Overlap between windows
  min_required_points: 25  # Minimum valid data points

indexing:
  batch_size: 100   # Vectors per batch
  incremental: true # Only index new windows
  state_file: ./data/qdrant_indexing_state.json
```

### Key Parameters

| Parameter | Description | Recommended |
|-----------|-------------|-------------|
| `window.size` | Days per sliding window | 30 (1 month) |
| `window.stride` | Step size (1 = no gap) | 1 (max overlap) |
| `distance_metric` | Similarity measure | Cosine (normalized) |
| `batch_size` | Vectors per upload | 100 (balance speed/memory) |
| `incremental` | Skip indexed windows | true (faster re-runs) |

---

## 🌐 Deployment Options

### Option 1: Docker (Local Development)

**Best for:** Local testing, development

```yaml
deployment_type: docker
docker:
  host: localhost
  port: 6333
```

**Start:**
```powershell
docker-compose up -d
```

**Data location:** `./data/qdrant_storage/`

---

### Option 2: Qdrant Cloud (Production)

**Best for:** Production, managed service

1. **Sign up:** https://cloud.qdrant.io/
2. **Create cluster** → Get API key and URL
3. **Update config:**

```yaml
deployment_type: cloud
cloud:
  url: https://your-cluster.qdrant.io
  api_key: YOUR_API_KEY  # Or set QDRANT_API_KEY env var
```

**Advantages:**
- Fully managed
- Automatic scaling
- High availability
- No infrastructure management

---

### Option 3: Remote Server (Self-Hosted)

**Best for:** Custom infrastructure, on-premises

```yaml
deployment_type: remote
remote:
  url: http://your-server.com:6333
  api_key: YOUR_SECRET_KEY  # Optional
```

**Setup:**
```bash
# On remote server
docker run -p 6333:6333 -v /data/qdrant:/qdrant/storage qdrant/qdrant
```

---

## 🔗 Pipeline Integration

### In `run_pipeline.py`

```python
from pipelines.data_pipeline import data_pipeline

# Run with Qdrant enabled
pipeline_instance = data_pipeline(
    tickers=["SPY", "QQQ", "EFA", "IEF", "HYG", "BIL"],
    start_date="2010-01-01",
    end_date="2024-12-31",
    train_end_date="2017-12-31",
    val_end_date="2020-12-31",
    enable_vectordb=True,  # Enable Qdrant
    qdrant_config_path="./config/qdrant_config.yaml",
)

pipeline_instance.run()
```

### Incremental Updates

On subsequent runs, only **new windows** are indexed:

```
First run:  Index 3000+ windows (~30 seconds)
Second run: Index 1 new window (~1 second)
```

State is tracked in `./data/qdrant_indexing_state.json`.

---

## 🔍 Query Examples

### 1. Find Similar Patterns

```python
from utils.qdrant_helpers import query_similar_windows

# Load current 30-day window
query_vector = get_current_window_vector()

# Find top 10 similar periods
results, scores = query_similar_windows(
    query_vector=query_vector,
    top_k=10,
    ticker_filter="SPY",
    date_range=("2020-01-01", "2024-12-31"),
)

for meta, score in zip(results, scores):
    print(f"{meta['date_start']} | Similarity: {score:.4f}")
```

### 2. Weighted Predictions

```python
from utils.qdrant_helpers import calculate_weighted_prediction

prediction = calculate_weighted_prediction(
    query_vector=query_vector,
    top_k=10,
    prediction_field="returns_cumulative",
    weight_method="inverse_distance",
)

print(f"Expected return: {prediction['weighted_mean']:.2%}")
print(f"Confidence: {prediction['confidence']:.2%}")
```

### 3. Anomaly Detection

```python
from utils.qdrant_helpers import calculate_anomaly_score

anomaly = calculate_anomaly_score(
    query_vector=query_vector,
    top_k=5,
)

if anomaly['is_anomalous']:
    print("⚠️  Unusual pattern detected!")
```

### 4. Ensemble Features

```python
from utils.qdrant_helpers import create_ensemble_features

ensemble = create_ensemble_features(
    query_vector=query_vector,
    top_k=10,
)

# Add to your feature matrix
X_enhanced = np.hstack([X_original, ensemble['feature_vector']])
```

---

## 🤖 Ensemble Modeling

### Use Case: Weighted Ensemble

Combine predictions from similar historical periods:

```python
def ensemble_predict(current_window, models):
    """
    Predict using weighted ensemble of similar patterns.
    """
    # 1. Find similar patterns
    results, scores = query_similar_windows(current_window, top_k=10)
    
    # 2. Get predictions from each model for similar patterns
    predictions = []
    for meta in results:
        # Load historical data for this pattern
        historical_window = load_window(meta['ticker'], meta['date_start'])
        
        # Predict with your models
        pred = models['lightgbm'].predict(historical_window)
        predictions.append(pred)
    
    # 3. Weight by similarity
    weights = np.array(scores) / np.sum(scores)
    weighted_pred = np.sum(weights * predictions)
    
    return weighted_pred
```

### Use Case: Feature Augmentation

Add similarity features to ML models:

```python
# Original features: 375 dimensions
X_train = load_features()

# Add ensemble features: +13 dimensions
ensemble_features = []
for window in X_train:
    ens = create_ensemble_features(window, top_k=10)
    ensemble_features.append(ens['feature_vector'])

# Enhanced features: 388 dimensions
X_train_enhanced = np.hstack([X_train, ensemble_features])

# Train models on enhanced features
model.fit(X_train_enhanced, y_train)
```

---

## 📊 Monitoring

### Collection Statistics

```python
from utils.qdrant_helpers import get_collection_stats

stats = get_collection_stats()
print(f"Total vectors: {stats['points_count']}")
print(f"Vector size: {stats['vector_size']}")
```

### Web Dashboard

Access at: http://localhost:6333/dashboard

Features:
- Collection overview
- Vector count
- Memory usage
- Query metrics

### Logs

```powershell
# View Qdrant logs
docker-compose logs -f qdrant

# Check for errors
docker-compose logs qdrant | Select-String "ERROR"
```

---

## 🛠️ Troubleshooting

### Issue: "Connection refused"

**Symptom:**
```
ConnectionError: [Errno 61] Connection refused
```

**Solution:**
```powershell
# Check if Qdrant is running
docker-compose ps

# If not running, start it
docker-compose up -d

# Check logs
docker-compose logs qdrant
```

---

### Issue: "Collection not found"

**Symptom:**
```
QdrantException: Collection not found
```

**Solution:**
```python
# Re-run pipeline to create collection
python run_pipeline.py
```

Or manually create:
```python
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance

client = QdrantClient(host="localhost", port=6333)
client.create_collection(
    collection_name="financial_timeseries_v1",
    vectors_config=VectorParams(size=375, distance=Distance.COSINE),
)
```

---

### Issue: "Out of memory"

**Symptom:**
```
Docker container killed due to OOM
```

**Solution:**
```yaml
# In docker-compose.yml, add memory limit
services:
  qdrant:
    ...
    deploy:
      resources:
        limits:
          memory: 4G
```

Or reduce batch size in config:
```yaml
indexing:
  batch_size: 50  # Reduce from 100
```

---

### Issue: Slow queries

**Symptom:** Queries take >1 second

**Solution:**

1. **Optimize HNSW parameters:**
```yaml
collection:
  hnsw_config:
    m: 16              # Reduce for faster queries
    ef_construct: 100  # Reduce for faster indexing
```

2. **Enable query prefetch:**
```yaml
performance:
  enable_prefetch: true
```

3. **Use filters efficiently:**
```python
# Faster: Filter by indexed fields
results, scores = query_similar_windows(
    query_vector=query_vector,
    ticker_filter="SPY",  # Indexed field
)

# Slower: Post-filter in Python
```

---

## 📈 Scaling

### Vertical Scaling (More Resources)

```yaml
# docker-compose.yml
services:
  qdrant:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
```

### Horizontal Scaling (Qdrant Cloud)

Qdrant Cloud supports:
- **Sharding**: Distribute data across nodes
- **Replication**: High availability
- **Auto-scaling**: Dynamic resource allocation

### Data Volume Estimates

| Windows | Vector Size | Storage | RAM |
|---------|-------------|---------|-----|
| 1,000 | 375 | ~4 MB | ~10 MB |
| 10,000 | 375 | ~40 MB | ~100 MB |
| 100,000 | 375 | ~400 MB | ~1 GB |
| 1,000,000 | 375 | ~4 GB | ~10 GB |

**Current:** ~3,500 windows per asset × 6 assets = ~21,000 windows (~80 MB)

---

## 🎓 Best Practices

### 1. Incremental Indexing

Always keep `incremental: true` to avoid re-indexing:

```yaml
indexing:
  incremental: true
  state_file: ./data/qdrant_indexing_state.json
```

### 2. Regular Backups

```powershell
# Backup Qdrant data
docker-compose down
Copy-Item -Recurse ./data/qdrant_storage ./backups/qdrant_$(Get-Date -Format 'yyyyMMdd')
docker-compose up -d
```

### 3. Monitor Performance

```python
import time

start = time.time()
results, scores = query_similar_windows(query_vector, top_k=10)
elapsed = time.time() - start

print(f"Query time: {elapsed:.3f}s")
if elapsed > 1.0:
    print("⚠️  Query slower than expected")
```

### 4. Version Collections

When changing vector dimensions or features:

```yaml
collection:
  name: financial_timeseries_v2  # Increment version
```

This avoids conflicts with old data.

---

## 📚 Additional Resources

- **Qdrant Docs**: https://qdrant.tech/documentation/
- **Python Client**: https://github.com/qdrant/qdrant-client
- **Docker Image**: https://hub.docker.com/r/qdrant/qdrant
- **Qdrant Cloud**: https://cloud.qdrant.io/

---

## 📝 Summary

✅ **Production-ready** vector database with Docker  
✅ **Incremental indexing** for fast updates  
✅ **Rich querying** with filters and metadata  
✅ **Ensemble modeling** helpers for ML teams  
✅ **Scalable** from local to cloud deployment  

**Next Steps:**
1. Start Qdrant: `docker-compose up -d`
2. Run pipeline: `python run_pipeline.py`
3. Query examples: `python scripts/query_qdrant_example.py`
4. Integrate into your models using `utils/qdrant_helpers.py`

---

**Questions?** Check the [Troubleshooting](#troubleshooting) section or open an issue on GitHub.
