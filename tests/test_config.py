"""
pytest configuration for backend tests
"""
import pytest
import os
from dotenv import load_dotenv

# Load test environment variables
load_dotenv()

@pytest.fixture(scope="session")
def test_env():
    """Set up test environment variables"""
    return {
        "GROQ_API_KEY": os.getenv("GROQ_API_KEY", "test_key"),
        "ALPACA_API_KEY": os.getenv("ALPACA_API_KEY", "test_key"),
        "ALPACA_SECRET_KEY": os.getenv("ALPACA_SECRET_KEY", "test_secret"),
    }

@pytest.fixture
def mock_trading_client():
    """Mock Alpaca trading client for testing"""
    class MockTradingClient:
        def get_account(self):
            return {
                "equity": "100000.00",
                "cash": "50000.00"
            }
        
        def get_all_positions(self):
            return []
    
    return MockTradingClient()
