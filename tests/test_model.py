from pathlib import Path

import pandas as pd

from trading.signal_generator import SignalGenerator


ASSETS = [
    "AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "AMZN", "META",
    "SPY", "QQQ", "EFA", "IEF", "HYG", "BIL", "INTC", "AMD",
]


def _write_prediction(model_dir: Path, symbol: str, pred: float) -> None:
    frame = pd.DataFrame(
        {
            "date": ["2024-01-01", "2024-01-02"],
            "pred": [pred / 2, pred],
        }
    )
    frame.to_csv(model_dir / f"{symbol}_oos_predictions.csv", index=False)


def test_get_latest_signals_reads_saved_predictions(tmp_path):
    _write_prediction(tmp_path, "AAPL", 0.012)

    generator = SignalGenerator(model_dir=tmp_path)
    signals = generator.get_latest_signals()

    assert "AAPL" in signals.index
    assert abs(float(signals.loc["AAPL", "signal"]) - 0.012) < 1e-9


def test_generate_signals_returns_expected_direction(tmp_path):
    _write_prediction(tmp_path, "AAPL", 0.02)
    _write_prediction(tmp_path, "NVDA", -0.02)

    generator = SignalGenerator(model_dir=tmp_path)
    recommendations = generator.generate_signals(use_momentum=False)

    assert recommendations.loc["AAPL", "direction"] == "LONG"
    assert recommendations.loc["NVDA", "direction"] == "SHORT"


def test_portfolio_weights_sum_to_one(tmp_path):
    for i, symbol in enumerate(ASSETS):
        _write_prediction(tmp_path, symbol, 0.005 + i * 0.0001)

    generator = SignalGenerator(model_dir=tmp_path)
    recommendations = generator.generate_signals(use_momentum=False)
    recommendations = generator.calculate_portfolio_weights(recommendations)

    total_weight = float(recommendations["weight"].sum())
    assert 0.99 <= total_weight <= 1.01
