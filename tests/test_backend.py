"""
Tests for backend health endpoint
"""
import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / "webapp" / "backend"
sys.path.insert(0, str(backend_path))

from main import app

client = TestClient(app)

def test_health_endpoint():
    """Test that health endpoint returns 200 OK"""
    response = client.get("/health")
    assert response.status_code == 200
    
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data
    assert "version" in data
    assert "timestamp" in data

def test_health_endpoint_structure():
    """Test health endpoint response structure"""
    response = client.get("/health")
    data = response.json()
    
    assert isinstance(data, dict)
    assert "dependencies" in data
    assert isinstance(data["dependencies"], dict)

# Example test for future endpoints
@pytest.mark.skip(reason="Endpoint not yet implemented")
def test_recommendations_endpoint():
    """Test recommendations endpoint"""
    response = client.get("/api/recommendations")
    assert response.status_code == 200
    
# TODO: Add more tests for:
# - Authentication endpoints
# - Portfolio endpoints
# - Trading endpoints
# - WebSocket connections
