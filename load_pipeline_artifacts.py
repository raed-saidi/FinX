# load_pipeline_artifacts.py
# Easy script to load and inspect your pipeline's processed data

from zenml.client import Client
import pandas as pd
from pathlib import Path


def check_saved_files():
    """Check what files have been saved to data directories."""
    print("\n" + "=" * 70)
    print("CHECKING SAVED DATA FILES")
    print("=" * 70 + "\n")
    
    directories = {
        "Raw Data": "./data/raw",
        "Processed Data": "./data/processed",
        "Exported ML Data": "./data/exported_data"
    }
    
    for name, dir_path in directories.items():
        print(f"📁 {name} ({dir_path}):")
        path = Path(dir_path)
        
        if not path.exists():
            print(f"   ⚠️  Directory does not exist yet\n")
            continue
        
        files = sorted(path.glob("*"))
        if not files:
            print(f"   ⚠️  Directory is empty\n")
            continue
        
        for file in files:
            if file.is_file():
                size = file.stat().st_size
                size_mb = size / (1024 * 1024)
                if size_mb < 1:
                    size_str = f"{size / 1024:.1f} KB"
                else:
                    size_str = f"{size_mb:.1f} MB"
                print(f"   ✓ {file.name:<35} {size_str:>10}")
        print()


def load_from_directories():
    """Load data from saved directories (faster than ZenML)."""
    print("\n" + "=" * 70)
    print("LOADING DATA FROM DIRECTORIES")
    print("=" * 70 + "\n")
    
    data = {}
    
    # Try to load ML-ready data
    export_dir = Path("./data/exported_data")
    if export_dir.exists():
        try:
            X_train_path = export_dir / "X_train.csv"
            if X_train_path.exists():
                X_train = pd.read_csv(X_train_path, index_col=0, parse_dates=True)
                data['X_train'] = X_train
                print(f"✓ Loaded X_train: {X_train.shape}")
            
            X_test_path = export_dir / "X_test.csv"
            if X_test_path.exists():
                X_test = pd.read_csv(X_test_path, index_col=0, parse_dates=True)
                data['X_test'] = X_test
                print(f"✓ Loaded X_test: {X_test.shape}")
            
            y_train_path = export_dir / "y_train.csv"
            if y_train_path.exists():
                y_train = pd.read_csv(y_train_path, index_col=0, parse_dates=True)
                data['y_train'] = y_train
                print(f"✓ Loaded y_train: {y_train.shape}")
            
            y_test_path = export_dir / "y_test.csv"
            if y_test_path.exists():
                y_test = pd.read_csv(y_test_path, index_col=0, parse_dates=True)
                data['y_test'] = y_test
                print(f"✓ Loaded y_test: {y_test.shape}")
        except Exception as e:
            print(f"⚠️  Error loading from {export_dir}: {e}")
    
    # Try to load processed data
    processed_dir = Path("./data/processed")
    if processed_dir.exists():
        try:
            prices_path = processed_dir / "prices_clean.csv"
            if prices_path.exists():
                prices = pd.read_csv(prices_path, index_col=0, parse_dates=True)
                data['prices'] = prices
                print(f"✓ Loaded prices: {prices.shape}")
            
            features_path = processed_dir / "features_scaled.csv"
            if features_path.exists():
                features = pd.read_csv(features_path, index_col=0, parse_dates=True)
                data['features_scaled'] = features
                print(f"✓ Loaded features_scaled: {features.shape}")
        except Exception as e:
            print(f"⚠️  Error loading from {processed_dir}: {e}")
    
    if data:
        print(f"\n✅ Successfully loaded {len(data)} datasets from directories")
        return data
    else:
        print("\n⚠️  No data loaded from directories")
        return None


def load_latest_artifacts():
    """Load artifacts from the most recent successful pipeline run."""
    
    client = Client()
    
    print("\n" + "=" * 70)
    print("LOADING LATEST PIPELINE ARTIFACTS (from ZenML)")
    print("=" * 70 + "\n")
    
    # Get the latest run of your data pipeline
    try:
        runs = client.list_pipeline_runs(
            pipeline_name="data_pipeline",
            size=10
        )
        
        if not runs:
            print("❌ No pipeline runs found for 'data_pipeline'")
            print("\nTip: Run the pipeline first with: python run_pipeline.py")
            return None
        
        print(f"Found {len(runs)} pipeline run(s)\n")
        
        # Find the most recent successful run
        successful_run = None
        for run in runs:
            print(f"Run: {run.name}")
            print(f"  Status: {run.status}")
            print(f"  Started: {run.start_time}")
            
            if run.status == "completed" and successful_run is None:
                successful_run = run
                print(f"  ✓ Using this run")
            print()
        
        if successful_run is None:
            print("❌ No successful runs found")
            return None
        
        print("=" * 70)
        print("Loading Artifacts from Steps")
        print("=" * 70 + "\n")
        
        artifacts_data = {}
        
        for step_name in successful_run.steps:
            step = successful_run.steps[step_name]
            
            if step.status != "completed":
                print(f"\n⚠️  Step '{step_name}' - Status: {step.status}")
                continue
            
            print(f"\n📦 Step: {step_name}")
            print(f"   Status: {step.status}")
            
            step_artifacts = {}
            output_list = list(step.outputs.keys())
            print(f"   Found {len(output_list)} output(s): {output_list}")
            
            for idx, output_name in enumerate(output_list):
                try:
                    if output_name in step.outputs:
                        artifact_ref = step.outputs[output_name]
                        
                        if isinstance(artifact_ref, list):
                            if len(artifact_ref) > 0:
                                artifact = artifact_ref[0]
                            else:
                                print(f"   ⚠️  {output_name}: Empty artifact list")
                                continue
                        else:
                            artifact = artifact_ref
                        
                        data = artifact.load()
                        
                        # Store with a friendly name
                        if step_name == "preprocess_prices":
                            key = "prices"
                        elif step_name == "compute_and_clip_returns":
                            key = "returns_clipped" if idx == 0 else "clip_thresholds"
                        elif step_name == "feature_engineering":
                            key = ["features_all", "scaler_regime", "kmeans_regime"][idx]
                        elif step_name == "scale_features":
                            key = "features_scaled" if idx == 0 else "scaler_features"
                        else:
                            key = output_name
                        
                        step_artifacts[key] = data
                        
                        print(f"   ✓ {key}:")
                        print(f"      Type: {type(data).__name__}")
                        
                        if isinstance(data, pd.DataFrame):
                            print(f"      Shape: {data.shape}")
                            print(f"      Columns: {list(data.columns)[:5]}{'...' if len(data.columns) > 5 else ''}")
                            if hasattr(data.index, 'min'):
                                print(f"      Date range: {data.index.min()} to {data.index.max()}")
                        
                except Exception as e:
                    print(f"   ✗ Error loading {output_name}: {e}")
            
            if step_artifacts:
                artifacts_data[step_name] = step_artifacts
        
        return artifacts_data
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


def display_summary():
    """Display a summary of available data."""
    print("\n" + "=" * 70)
    print("USAGE EXAMPLES")
    print("=" * 70 + "\n")
    
    print("Load ML-ready data for training:")
    print("""
import pandas as pd

# Load train/test splits
X_train = pd.read_csv('./data/exported_data/X_train.csv', index_col=0, parse_dates=True)
y_train = pd.read_csv('./data/exported_data/y_train.csv', index_col=0, parse_dates=True)
X_test = pd.read_csv('./data/exported_data/X_test.csv', index_col=0, parse_dates=True)
y_test = pd.read_csv('./data/exported_data/y_test.csv', index_col=0, parse_dates=True)

# Train your model
from sklearn.ensemble import RandomForestRegressor
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train['SPY'])  # Predict returns for SPY
predictions = model.predict(X_test)
    """)
    
    print("\nLoad processed features and prices:")
    print("""
# Load processed data
prices = pd.read_csv('./data/processed/prices_clean.csv', index_col=0, parse_dates=True)
features = pd.read_csv('./data/processed/features_scaled.csv', index_col=0, parse_dates=True)
returns = pd.read_csv('./data/processed/returns_clipped.csv', index_col=0, parse_dates=True)

# Analyze
print(f"Price data: {prices.shape}")
print(f"Features: {features.shape}")
print(f"Returns: {returns.shape}")
    """)


if __name__ == "__main__":
    # First check what files exist
    check_saved_files()
    
    # Try to load from directories (faster)
    print("\n" + "=" * 70)
    print("OPTION 1: Load from Saved Directories (Recommended)")
    print("=" * 70)
    dir_data = load_from_directories()
    
    # Optionally load from ZenML
    print("\n" + "=" * 70)
    print("OPTION 2: Load from ZenML (Alternative)")
    print("=" * 70)
    zenml_artifacts = load_latest_artifacts()
    
    # Display usage examples
    display_summary()
    
    print("\n" + "=" * 70)
    print("✅ DATA LOADING COMPLETE")
    print("=" * 70)
    print("\nYou can now use the data in your ML models!")
    print("See the usage examples above for how to load the data.\n")