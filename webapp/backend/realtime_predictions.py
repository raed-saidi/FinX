# realtime_predictions.py
# Real-time prediction engine using trained XGBoost models with live market data

import numpy as np
import pandas as pd
import yfinance as yf
import joblib
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import warnings
warnings.filterwarnings('ignore')

# Base paths
BASE_DIR = Path(__file__).parent.parent.parent
MODELS_DIR = BASE_DIR / "models" / "xgboost_walkforward"
DATA_DIR = BASE_DIR / "data" / "processed"

# Assets we have models for
ASSETS = ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "AMZN", "META",
          "SPY", "QQQ", "EFA", "IEF", "HYG", "BIL", "INTC", "AMD"]

# Cache for models and data
_model_cache = {}
_scaler_cache = {}
_last_data_fetch = None
_cached_ohlcv = None


def compute_rsi(prices: pd.Series, window: int = 14) -> pd.Series:
    """Compute RSI WITHOUT look-ahead bias."""
    delta = prices.diff()
    up = delta.clip(lower=0)
    down = -delta.clip(upper=0)
    roll_up = up.rolling(window).mean()
    roll_down = down.rolling(window).mean()
    rs = roll_up / (roll_down + 1e-8)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi


def compute_macd(prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    """Compute MACD indicator."""
    ema_fast = prices.ewm(span=fast, adjust=False).mean()
    ema_slow = prices.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return pd.DataFrame({
        'macd': macd_line,
        'signal': signal_line,
        'histogram': histogram
    }, index=prices.index)


def compute_bollinger_bands(prices: pd.Series, window: int = 20, num_std: float = 2.0) -> pd.DataFrame:
    """Compute Bollinger Bands."""
    sma = prices.rolling(window).mean()
    std = prices.rolling(window).std()
    upper = sma + (std * num_std)
    lower = sma - (std * num_std)
    bb_position = (prices - sma) / (std * num_std + 1e-8)
    bb_width = (upper - lower) / (sma + 1e-8)
    return pd.DataFrame({
        'bb_upper': upper,
        'bb_middle': sma,
        'bb_lower': lower,
        'bb_position': bb_position,
        'bb_width': bb_width
    }, index=prices.index)


def compute_momentum_features(prices: pd.Series, returns: pd.Series) -> pd.DataFrame:
    """Comprehensive momentum features."""
    features = pd.DataFrame(index=prices.index)
    for period in [5, 10, 20, 60, 120]:
        features[f'mom_{period}'] = (prices / prices.shift(period) - 1)
    for period in [10, 20]:
        features[f'roc_{period}'] = ((prices - prices.shift(period)) / prices.shift(period))
    mom_20 = (prices / prices.shift(20) - 1)
    features['mom_acceleration'] = mom_20 - mom_20.shift(10)
    return features


def compute_volatility_features(returns: pd.Series) -> pd.DataFrame:
    """Advanced volatility features."""
    features = pd.DataFrame(index=returns.index)
    for window in [5, 10, 20, 60]:
        features[f'vol_{window}'] = returns.rolling(window).std()
    features['vol_parkinson'] = (returns.abs()).rolling(20).mean()
    vol_20 = returns.rolling(20).std()
    features['volvol_20'] = vol_20.rolling(20).std()
    negative_returns = returns.copy()
    negative_returns[negative_returns > 0] = 0
    features['downside_vol_20'] = negative_returns.rolling(20).std()
    positive_returns = returns.copy()
    positive_returns[positive_returns < 0] = 0
    upside_vol = positive_returns.rolling(20).std()
    downside_vol = features['downside_vol_20']
    features['vol_asymmetry'] = upside_vol / (downside_vol + 1e-8)
    return features


def compute_risk_features(prices: pd.Series, returns: pd.Series) -> pd.DataFrame:
    """Risk-adjusted and drawdown features."""
    features = pd.DataFrame(index=prices.index)
    for window in [20, 60, 120, 252]:
        rolling_max = prices.rolling(window).max()
        features[f'dd_{window}'] = (prices - rolling_max) / (rolling_max + 1e-8)
    for window in [20, 60]:
        mean_ret = returns.rolling(window).mean()
        std_ret = returns.rolling(window).std()
        features[f'sharpe_{window}'] = mean_ret / (std_ret + 1e-8) * np.sqrt(252)
    for window in [20, 60]:
        mean_ret = returns.rolling(window).mean()
        negative_returns = returns.copy()
        negative_returns[negative_returns > 0] = 0
        downside_std = negative_returns.rolling(window).std()
        features[f'sortino_{window}'] = mean_ret / (downside_std + 1e-8) * np.sqrt(252)
    return features


def compute_trend_features(prices: pd.Series) -> pd.DataFrame:
    """Trend strength and direction features."""
    features = pd.DataFrame(index=prices.index)
    ma_pairs = [(5, 20), (10, 50), (20, 60), (50, 200)]
    for fast, slow in ma_pairs:
        ma_fast = prices.rolling(fast).mean()
        ma_slow = prices.rolling(slow).mean()
        features[f'ma_{fast}_{slow}_cross'] = (ma_fast - ma_slow) / (ma_slow + 1e-8)
    return features


def compute_statistical_features(returns: pd.Series) -> pd.DataFrame:
    """Statistical properties of return distribution."""
    features = pd.DataFrame(index=returns.index)
    for window in [20, 60]:
        features[f'skew_{window}'] = returns.rolling(window).skew()
        features[f'kurt_{window}'] = returns.rolling(window).kurt()
    return features


def fetch_live_ohlcv(assets: List[str], days: int = 300) -> pd.DataFrame:
    """Fetch live OHLCV data from Yahoo Finance using batch download."""
    global _last_data_fetch, _cached_ohlcv
    
    # Cache data for 5 minutes
    now = datetime.now()
    if _cached_ohlcv is not None and _last_data_fetch is not None:
        if (now - _last_data_fetch).total_seconds() < 300:
            return _cached_ohlcv
    
    print(f"Fetching live data for {len(assets)} assets (batch mode)...")
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    try:
        # Use batch download - much more efficient and less likely to be rate limited
        tickers_str = " ".join(assets)
        data = yf.download(tickers_str, start=start_date, end=end_date, interval='1d', progress=False, threads=True)
        
        if data.empty:
            raise ValueError("No data returned from Yahoo Finance")
        
        # Extract Close prices
        if 'Close' in data.columns:
            if isinstance(data['Close'], pd.DataFrame):
                prices = data['Close']
            else:
                # Single ticker case
                prices = pd.DataFrame({assets[0]: data['Close']})
        else:
            # Multi-level columns from batch download
            prices = data['Close'] if 'Close' in data else data.xs('Close', axis=1, level=0)
        
        prices.index = pd.to_datetime(prices.index).tz_localize(None)
        
        # Remove any all-NaN columns
        prices = prices.dropna(axis=1, how='all')
        
        if prices.empty:
            raise ValueError("No valid price data after cleaning")
        
        _cached_ohlcv = prices
        _last_data_fetch = now
        
        print(f"✓ Successfully fetched {len(prices.columns)} assets, {len(prices)} days")
        
        return prices
        
    except Exception as e:
        print(f"Batch download failed: {e}")
        
        # Fallback: try individual downloads with delay
        all_data = {}
        import time
        
        for i, asset in enumerate(assets):
            try:
                if i > 0:
                    time.sleep(0.5)  # Rate limit protection
                ticker = yf.Ticker(asset)
                df = ticker.history(start=start_date, end=end_date, interval='1d')
                if len(df) > 0:
                    all_data[asset] = df['Close']
            except Exception as e2:
                print(f"Error fetching {asset}: {e2}")
        
        if not all_data:
            raise ValueError("Failed to fetch any market data")
        
        prices = pd.DataFrame(all_data)
        prices.index = pd.to_datetime(prices.index).tz_localize(None)
        
        _cached_ohlcv = prices
        _last_data_fetch = now
        
        return prices


def generate_features_for_asset(ticker: str, prices: pd.DataFrame, returns: pd.DataFrame) -> pd.DataFrame:
    """Generate all features for a single asset."""
    p = prices[ticker]
    r = returns[ticker]
    
    features = pd.DataFrame(index=prices.index)
    
    # RSI
    features[f'{ticker}_rsi14'] = compute_rsi(p, 14)
    
    # MACD
    macd = compute_macd(p)
    features[f'{ticker}_macd'] = macd['macd']
    features[f'{ticker}_macd_signal'] = macd['signal']
    features[f'{ticker}_macd_hist'] = macd['histogram']
    
    # Bollinger Bands
    bb = compute_bollinger_bands(p)
    features[f'{ticker}_bb_upper'] = bb['bb_upper']
    features[f'{ticker}_bb_middle'] = bb['bb_middle']
    features[f'{ticker}_bb_lower'] = bb['bb_lower']
    features[f'{ticker}_bb_position'] = bb['bb_position']
    features[f'{ticker}_bb_width'] = bb['bb_width']
    
    # Momentum
    mom = compute_momentum_features(p, r)
    for col in mom.columns:
        features[f'{ticker}_{col}'] = mom[col]
    
    # Volatility
    vol = compute_volatility_features(r)
    for col in vol.columns:
        features[f'{ticker}_{col}'] = vol[col]
    
    # Risk features
    risk = compute_risk_features(p, r)
    for col in risk.columns:
        features[f'{ticker}_{col}'] = risk[col]
    
    # Trend features
    trend = compute_trend_features(p)
    for col in trend.columns:
        features[f'{ticker}_{col}'] = trend[col]
    
    # Statistical features
    stats = compute_statistical_features(r)
    for col in stats.columns:
        features[f'{ticker}_{col}'] = stats[col]
    
    return features


def load_model(asset: str):
    """Load XGBoost model for an asset."""
    # _model_cache is module-level variable
    if asset in _model_cache:
        return _model_cache[asset]
    
    model_path = MODELS_DIR / f"{asset}_final_model.joblib"
    if not model_path.exists():
        # Try loading from all_final_models.joblib
        all_models_path = MODELS_DIR / "all_final_models.joblib"
        if all_models_path.exists():
            all_models = joblib.load(all_models_path)
            if asset in all_models:
                _model_cache[asset] = all_models[asset]
                return all_models[asset]
        return None
    
    model = joblib.load(model_path)
    _model_cache[asset] = model
    return model


def load_scaler():
    """Load the feature scaler."""
    # _scaler_cache is module-level variable
    if 'scaler' in _scaler_cache:
        return _scaler_cache['scaler']
    
    scaler_path = DATA_DIR / "scaler_features.joblib"
    if scaler_path.exists():
        scaler = joblib.load(scaler_path)
        _scaler_cache['scaler'] = scaler
        return scaler
    return None


def get_model_features(model) -> List[str]:
    """Get the feature names the model was trained on."""
    if hasattr(model, 'feature_names_in_'):
        return list(model.feature_names_in_)
    elif hasattr(model, 'get_booster'):
        return model.get_booster().feature_names
    return None


def generate_realtime_predictions() -> List[Dict]:
    """
    Generate real-time predictions using trained models and live data.
    
    Returns list of recommendations with:
    - asset: ticker symbol
    - signal: predicted return (model output)
    - direction: LONG/SHORT/NEUTRAL
    - confidence: prediction confidence
    - current_price: live price
    - weight: portfolio weight
    - dollars/shares: suggested allocation
    """
    print("\n" + "="*60)
    print("REAL-TIME PREDICTION ENGINE")
    print("="*60)
    
    # 1. Fetch live market data
    try:
        prices = fetch_live_ohlcv(ASSETS, days=300)
        print(f"✓ Fetched data for {len(prices.columns)} assets")
        print(f"  Date range: {prices.index.min()} to {prices.index.max()}")
    except Exception as e:
        print(f"✗ Error fetching data: {e}")
        return []
    
    # 2. Calculate returns
    returns = prices.pct_change()
    
    # Clip extreme returns
    clip_threshold = 0.15  # 15%
    returns = returns.clip(-clip_threshold, clip_threshold)
    
    # 3. Generate predictions for each asset
    predictions = {}
    current_prices = {}
    
    for asset in ASSETS:
        if asset not in prices.columns:
            continue
        
        try:
            # Load model
            model = load_model(asset)
            if model is None:
                print(f"  ✗ No model found for {asset}")
                continue
            
            # Get model's expected features
            expected_features = get_model_features(model)
            
            # Generate features for this asset
            asset_features = generate_features_for_asset(asset, prices, returns)
            
            # Get latest row
            latest_features = asset_features.iloc[-1:].copy()
            
            # Match features to what model expects
            if expected_features:
                # Create aligned feature vector
                X = pd.DataFrame(index=latest_features.index, columns=expected_features)
                for feat in expected_features:
                    if feat in latest_features.columns:
                        X[feat] = latest_features[feat].values
                    else:
                        X[feat] = 0  # Fill missing with 0
                
                X = X.fillna(0)
            else:
                X = latest_features.fillna(0)
            
            # Make prediction
            pred = model.predict(X)[0]
            predictions[asset] = pred
            current_prices[asset] = prices[asset].iloc[-1]
            
            print(f"  ✓ {asset}: signal={pred:.4f}, price=${current_prices[asset]:.2f}")
            
        except Exception as e:
            print(f"  ✗ Error predicting {asset}: {e}")
            import traceback
            traceback.print_exc()
    
    if not predictions:
        print("No predictions generated!")
        return []
    
    # 4. Filter to only STRONG signals (top performers)
    # Only recommend stocks with signal > 0.005 (0.5% predicted return)
    MIN_SIGNAL_THRESHOLD = 0.005
    MAX_RECOMMENDATIONS = 6  # Maximum stocks to recommend
    
    # Sort predictions by signal strength (descending)
    sorted_predictions = sorted(predictions.items(), key=lambda x: x[1], reverse=True)
    
    # Filter to only positive signals above threshold
    strong_predictions = [(asset, sig) for asset, sig in sorted_predictions 
                          if sig > MIN_SIGNAL_THRESHOLD]
    
    # Take top N recommendations
    top_predictions = strong_predictions[:MAX_RECOMMENDATIONS]
    
    if not top_predictions:
        # If no strong signals, take top 3 anyway but mark as weak
        top_predictions = sorted_predictions[:3]
        print("  ⚠ No strong signals - showing top 3 with caution")
    
    print(f"  → Selected {len(top_predictions)} stocks with strong signals")
    
    # 5. Calculate weights for selected stocks only
    selected_signals = [sig for _, sig in top_predictions]
    min_sig = min(selected_signals) if selected_signals else 0
    shifted = [float(s) - float(min_sig) + 0.01 for s in selected_signals]
    total = sum(shifted)
    
    # 6. Build recommendations for selected stocks
    recommendations = []
    capital = 100000
    
    # First pass: calculate raw weights and apply cap
    raw_weights = []
    for i, (asset, signal) in enumerate(top_predictions):
        # Calculate weight - distribute 100% among selected stocks
        raw_weight = shifted[i] / total if total > 0 else 1/len(top_predictions)
        # Cap individual positions at 35%
        capped_weight = min(raw_weight, 0.35)
        raw_weights.append(capped_weight)
    
    # Normalize weights to sum to 100%
    total_capped = sum(raw_weights)
    normalized_weights = [w / total_capped for w in raw_weights] if total_capped > 0 else raw_weights
    
    for i, (asset, signal) in enumerate(top_predictions):
        weight = normalized_weights[i]
        price = float(current_prices.get(asset, 100))
        signal_float = float(signal)
        
        # Determine direction with confidence
        if signal_float > 0.01:
            direction = "LONG"
            confidence = min(abs(signal_float) * 10, 1.0)
        elif signal_float < -0.01:
            direction = "SHORT"
            confidence = min(abs(signal_float) * 10, 1.0)
        else:
            direction = "NEUTRAL"
            confidence = 0.5
        
        recommendations.append({
            "asset": str(asset),
            "signal": float(round(signal_float, 6)),
            "direction": direction,
            "confidence": float(round(confidence, 2)),
            "weight": float(round(weight, 4)),
            "weight_pct": float(round(weight * 100, 2)),
            "current_price": float(round(price, 2)),
            "predicted_return_pct": float(round(signal_float * 100, 2)),
            "last_updated": datetime.now().isoformat()
        })
    
    # Already sorted by signal strength
    print(f"\n✓ Generated {len(recommendations)} focused recommendations")
    print("="*60)
    
    return recommendations


def get_market_summary() -> Dict:
    """Get a quick summary of current market conditions."""
    try:
        prices = fetch_live_ohlcv(['SPY', 'QQQ', 'IEF', 'VIX'], days=30)
        
        summary = {}
        for ticker in prices.columns:
            p = prices[ticker]
            returns = p.pct_change()
            
            summary[ticker] = {
                "current": round(p.iloc[-1], 2),
                "change_1d": round(returns.iloc[-1] * 100, 2) if len(returns) > 0 else 0,
                "change_5d": round((p.iloc[-1] / p.iloc[-5] - 1) * 100, 2) if len(p) > 5 else 0,
                "change_20d": round((p.iloc[-1] / p.iloc[-20] - 1) * 100, 2) if len(p) > 20 else 0,
                "volatility_20d": round(returns.tail(20).std() * np.sqrt(252) * 100, 2)
            }
        
        # Market regime (simple)
        spy_mom = (prices['SPY'].iloc[-1] / prices['SPY'].iloc[-20] - 1) if 'SPY' in prices.columns else 0
        if spy_mom > 0.03:
            regime = "BULLISH"
        elif spy_mom < -0.03:
            regime = "BEARISH"
        else:
            regime = "NEUTRAL"
        
        return {
            "regime": regime,
            "indices": summary,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {"error": str(e)}


# Test function
if __name__ == "__main__":
    print("Testing real-time prediction engine...")
    
    # Test market summary
    print("\n1. Market Summary:")
    summary = get_market_summary()
    print(f"   Regime: {summary.get('regime', 'Unknown')}")
    
    # Test predictions
    print("\n2. Generating Predictions:")
    recs = generate_realtime_predictions()
    
    print("\nTop 5 Recommendations:")
    for rec in recs[:5]:
        print(f"  {rec['asset']}: {rec['direction']} (signal={rec['signal']:.4f}, price=${rec['current_price']:.2f})")
