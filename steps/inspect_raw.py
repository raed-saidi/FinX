# steps/inspect_raw.py
import sys, pathlib, traceback
PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd
from steps import preprocess_prices_step

# If you have a sample raw file, load it; else, this will just show the function signature
try:
    print("Function signature for preprocess_prices:", preprocess_prices_step.preprocess_prices.entrypoint.__signature__)
except Exception:
    pass

# If you have a file produced by upstream step, update path below:
candidate_paths = list(pathlib.Path("artifacts").rglob("*raw*.parquet")) + list(pathlib.Path("artifacts").rglob("*.csv"))
if candidate_paths:
    p = candidate_paths[0]
    print("Inspecting", p)
    if p.suffix == ".parquet":
        df = pd.read_parquet(p)
    else:
        df = pd.read_csv(p, index_col=None)
    print("df.shape:", df.shape)
    print("df.columns:", df.columns.tolist()[:20])
    print("index sample (first 20):", list(df.index[:20]))
    print("index dtype:", df.index.dtype)
    print("dtypes sample:")
    print(df.dtypes.head(20))
    print("\nhead:\n", df.head(10))
else:
    print("No candidate raw files found under ./artifacts — inspect your upstream output path instead.")
