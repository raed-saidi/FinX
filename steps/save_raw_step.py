# pipelines/steps/save_raw_step.py
from pathlib import Path
from typing import Any, Dict
import pandas as pd
from zenml.steps import step


@step
def save_raw_data_step(
    raw_df: pd.DataFrame,
    metadata: Dict[str, Any],
    alternative_data: Any = None,
    output_dir: str = "./data/raw",
) -> None:
    """
    Save raw OHLCV dataframe + metadata + optional alternative data to disk.
    This is a ZenML step so it receives a real pandas.DataFrame at runtime.
    """
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    # Save the main OHLCV parquet/csv
    raw_path = out / "raw_ohlcv.parquet"
    raw_df.to_parquet(raw_path)
    print(f" âœ“ Saved raw OHLCV data: {raw_path}")

    csv_path = out / "raw_ohlcv.csv"
    raw_df.to_csv(csv_path, index=False)
    print(f" âœ“ Saved raw OHLCV csv: {csv_path}")

    # Save metadata as json
    try:
        import json

        meta_path = out / "raw_metadata.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, default=str)
        print(f" âœ“ Saved metadata: {meta_path}")
    except Exception as e:
        print(f" ! Failed to save metadata: {e}")

    # If alternative_data is a DataFrame or dict of DataFrames, save them
    if alternative_data is not None:
        alt_dir = out / "alternative"
        alt_dir.mkdir(exist_ok=True)
        if isinstance(alternative_data, pd.DataFrame):
            path = alt_dir / "alternative.parquet"
            alternative_data.to_parquet(path)
            print(f" âœ“ Saved alternative data frame: {path}")
        elif isinstance(alternative_data, dict):
            for k, v in alternative_data.items():
                try:
                    if isinstance(v, pd.DataFrame):
                        path = alt_dir / f"{k}.parquet"
                        v.to_parquet(path)
                        print(f" âœ“ Saved alternative {k}: {path}")
                    else:
                        # fallback: string representation
                        with open(alt_dir / f"{k}.txt", "w", encoding="utf-8") as f:
                            f.write(str(v))
                except Exception as e:
                    print(f" ! Failed saving alternative {k}: {e}")
        else:
            # generic fallback
            try:
                with open(alt_dir / "alternative.txt", "w", encoding="utf-8") as f:
                    f.write(str(alternative_data))
                print(f" âœ“ Saved alternative data (as text)")
            except Exception as e:
                print(f" ! Couldn't save alternative data: {e}")