from fastapi.testclient import TestClient

from webapp.backend import main as backend_main


client = TestClient(backend_main.app)


def test_predict_endpoint_returns_signal(monkeypatch):
    monkeypatch.setattr(
        backend_main,
        "load_recommendations",
        lambda: [
            {
                "asset": "AAPL",
                "signal": 0.015,
                "direction": "LONG",
                "weight": 0.2,
                "current_price": 200.0,
            }
        ],
    )

    response = client.post("/predict", json={"symbol": "aapl"})
    assert response.status_code == 200

    body = response.json()
    assert body["symbol"] == "AAPL"
    assert body["direction"] == "LONG"


def test_predict_endpoint_missing_symbol_returns_404(monkeypatch):
    monkeypatch.setattr(
        backend_main,
        "load_recommendations",
        lambda: [{"asset": "MSFT", "signal": 0.01, "direction": "LONG", "weight": 0.1, "current_price": 410.0}],
    )

    response = client.post("/predict", json={"symbol": "AAPL"})
    assert response.status_code == 404


def test_predict_endpoint_requires_symbol_field():
    response = client.post("/predict", json={})
    assert response.status_code == 422
