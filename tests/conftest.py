"""
pytest configuration and fixtures
"""
import pytest
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

@pytest.fixture
def sample_stock_data():
    """Sample stock data for testing"""
    return {
        "symbol": "AAPL",
        "price": 150.0,
        "change": 2.5,
        "volume": 1000000
    }

@pytest.fixture
def sample_portfolio():
    """Sample portfolio data for testing"""
    return {
        "total_value": 100000.0,
        "cash": 50000.0,
        "positions": [
            {"symbol": "AAPL", "shares": 100, "value": 15000.0},
            {"symbol": "GOOGL", "shares": 50, "value": 7500.0}
        ]
    }
