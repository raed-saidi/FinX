import numpy as np
import pandas as pd

from steps.feature_engineering_step import compute_bollinger_bands, compute_macd, compute_rsi


def test_rsi_has_expected_bounds_and_index_alignment():
    series = pd.Series(np.linspace(100, 130, 60))
    rsi = compute_rsi(series, window=14)

    assert len(rsi) == len(series)
    assert rsi.index.equals(series.index)

    valid = rsi.dropna()
    assert (valid >= 0).all()
    assert (valid <= 100).all()


def test_macd_produces_all_components():
    series = pd.Series(np.linspace(80, 120, 80))
    macd_df = compute_macd(series)

    assert len(macd_df) == len(series)
    assert {"macd", "signal", "histogram"}.issubset(set(macd_df.columns))
    assert macd_df.index.equals(series.index)


def test_bollinger_band_ordering():
    series = pd.Series(100 + np.sin(np.linspace(0, 10, 120)) * 3)
    bollinger = compute_bollinger_bands(series, window=20, num_std=2.0)
    upper = bollinger["bb_upper"]
    mid = bollinger["bb_middle"]
    lower = bollinger["bb_lower"]

    mask = upper.notna() & mid.notna() & lower.notna()
    assert (upper[mask] >= mid[mask]).all()
    assert (mid[mask] >= lower[mask]).all()
