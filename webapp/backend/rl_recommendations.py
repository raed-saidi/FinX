"""
RL-Based Recommendation Engine
==============================
Complete pipeline: Live Data → XGBoost → RL Model → User Recommendations

This module implements the production pipeline:
1. Fetch live market data
2. Generate XGBoost predictions for all assets
3. Feed predictions to RL agent
4. Get optimal portfolio allocation from RL
5. Return recommendations to user
"""

import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
import warnings
warnings.filterwarnings('ignore')

# Import XGBoost prediction engine
from realtime_predictions import (
    fetch_live_ohlcv,
    generate_features_for_asset,
    load_model as load_xgboost_model,
    ASSETS
)

# Base paths
BASE_DIR = Path(__file__).parent.parent.parent
MODELS_DIR = BASE_DIR / "models"
RL_MODEL_PATH = MODELS_DIR / "rl_portfolio" / "ppo_portfolio_final.zip"

# Global cache
_rl_model = None
_last_recommendation_time = None
_cached_recommendations = None


def load_rl_model():
    """Load the trained RL portfolio optimization model."""
    global _rl_model
    
    if _rl_model is not None:
        return _rl_model
    
    try:
        from stable_baselines3 import PPO
        
        if not RL_MODEL_PATH.exists():
            print(f"⚠️ RL model not found at: {RL_MODEL_PATH}")
            return None
        
        _rl_model = PPO.load(str(RL_MODEL_PATH))
        print(f"✅ RL model loaded from: {RL_MODEL_PATH}")
        return _rl_model
        
    except ImportError:
        print("⚠️ stable-baselines3 not installed. Install with: pip install stable-baselines3")
        return None
    except Exception as e:
        print(f"⚠️ Error loading RL model: {e}")
        return None


def generate_xgboost_predictions() -> Optional[Dict[str, float]]:
    """
    Generate XGBoost predictions for all assets.
    Returns dict of {asset: predicted_return}
    """
    print("\n📊 Step 1: Generating XGBoost predictions...")
    
    try:
        # Fetch live data
        prices = fetch_live_ohlcv(ASSETS, days=300)
        returns = prices.pct_change()
        returns = returns.clip(-0.15, 0.15)  # Clip extremes
        
        predictions = {}
        
        for asset in ASSETS:
            if asset not in prices.columns:
                continue
            
            try:
                # Load XGBoost model
                model = load_xgboost_model(asset)
                if model is None:
                    continue
                
                # Generate features
                asset_features = generate_features_for_asset(asset, prices, returns)
                latest_features = asset_features.iloc[-1:].fillna(0)
                
                # Get model's expected features
                if hasattr(model, 'feature_names_in_'):
                    expected_features = list(model.feature_names_in_)
                    X = pd.DataFrame(index=latest_features.index, columns=expected_features)
                    for feat in expected_features:
                        X[feat] = latest_features[feat].values if feat in latest_features.columns else 0
                    X = X.fillna(0)
                else:
                    X = latest_features
                
                # Predict
                pred = float(model.predict(X)[0])
                predictions[asset] = pred
                
            except Exception as e:
                print(f"  ⚠️ Error predicting {asset}: {e}")
        
        print(f"  ✅ Generated predictions for {len(predictions)} assets")
        return predictions if predictions else None
        
    except Exception as e:
        print(f"  ❌ XGBoost prediction failed: {e}")
        return None


def get_rl_allocation(xgboost_predictions: Dict[str, float]) -> Optional[Dict[str, float]]:
    """
    Get optimal portfolio allocation from RL model.
    
    Args:
        xgboost_predictions: Dict of {asset: predicted_return}
    
    Returns:
        Dict of {asset: weight} where weights sum to 1.0
    """
    print("\n🤖 Step 2: Getting RL portfolio allocation...")
    
    # Load RL model
    rl_model = load_rl_model()
    if rl_model is None:
        print("  ⚠️ RL model not available, using fallback allocation")
        return _fallback_allocation(xgboost_predictions)
    
    try:
        # Prepare state for RL model
        # State format: [predictions, rolling stats, current weights, portfolio info]
        
        # Sort assets to ensure consistent ordering
        sorted_assets = sorted(xgboost_predictions.keys())
        n_assets = len(sorted_assets)
        
        # Current predictions (normalized)
        preds = np.array([xgboost_predictions[a] for a in sorted_assets])
        pred_mean = preds.mean()
        pred_std = preds.std() + 1e-8
        pred_normalized = (preds - pred_mean) / pred_std
        
        # Rolling statistics (use current as proxy since we don't have history)
        pred_mean_arr = preds  # Use current as mean
        pred_std_arr = np.full(n_assets, pred_std)  # Use overall std
        pred_sharpe = preds / (pred_std + 1e-8)
        
        # Current weights (equal weight as starting point)
        current_weights = np.ones(n_assets) / n_assets
        
        # Portfolio metrics (neutral starting point)
        portfolio_normalized = 0.0
        drawdown = 0.0
        
        # Build state (must match training dimensions)
        state = np.concatenate([
            pred_normalized,      # n_assets
            pred_mean_arr,        # n_assets
            pred_std_arr,         # n_assets
            pred_sharpe,          # n_assets
            current_weights,      # n_assets
            [portfolio_normalized, drawdown]  # 2
        ])
        
        # Pad state if needed (RL model may expect additional features)
        expected_dim = rl_model.observation_space.shape[0]
        if len(state) < expected_dim:
            padding = np.zeros(expected_dim - len(state))
            state = np.concatenate([state, padding])
        elif len(state) > expected_dim:
            state = state[:expected_dim]
        
        # Get action from RL model
        action, _ = rl_model.predict(state, deterministic=True)
        
        # Action is raw portfolio weights - normalize
        action = np.clip(action, 0, 1)
        weights = action / (action.sum() + 1e-8)
        
        # Apply position limits
        weights = np.clip(weights, 0.0, 0.35)  # Max 35% per asset
        weights = weights / weights.sum()  # Renormalize
        
        # Create allocation dict
        allocation = {asset: float(weight) for asset, weight in zip(sorted_assets, weights)}
        
        print(f"  ✅ RL model generated allocation for {len(allocation)} assets")
        return allocation
        
    except Exception as e:
        print(f"  ⚠️ RL allocation failed: {e}")
        import traceback
        traceback.print_exc()
        return _fallback_allocation(xgboost_predictions)


def _fallback_allocation(predictions: Dict[str, float]) -> Dict[str, float]:
    """
    Fallback allocation strategy if RL model fails.
    Simple rule-based approach: allocate to top positive signals.
    """
    print("  → Using fallback rule-based allocation")
    
    # Filter positive predictions
    positive = {a: p for a, p in predictions.items() if p > 0.005}  # >0.5% threshold
    
    if not positive:
        # No positive signals - equal weight top 3
        sorted_all = sorted(predictions.items(), key=lambda x: x[1], reverse=True)
        top_assets = dict(sorted_all[:3])
        return {a: 1.0/len(top_assets) for a in top_assets}
    
    # Weight by signal strength (with cap)
    sorted_pos = sorted(positive.items(), key=lambda x: x[1], reverse=True)
    top_assets = dict(sorted_pos[:6])  # Top 6
    
    # Calculate weights
    min_sig = min(top_assets.values())
    shifted = {a: p - min_sig + 0.01 for a, p in top_assets.items()}
    total = sum(shifted.values())
    
    weights = {a: min(v / total, 0.35) for a, v in shifted.items()}  # Cap at 35%
    total_capped = sum(weights.values())
    weights = {a: w / total_capped for a, w in weights.items()}
    
    return weights


def generate_rl_recommendations(capital: float = 100000, cache_minutes: int = 5) -> List[Dict]:
    """
    Generate portfolio recommendations using complete RL pipeline.
    
    Pipeline:
    1. XGBoost predicts returns for each asset
    2. RL model determines optimal allocation
    3. Convert to actionable recommendations
    
    Args:
        capital: Total portfolio capital
        cache_minutes: Cache recommendations for N minutes
    
    Returns:
        List of recommendation dicts with asset, weight, dollars, shares, etc.
    """
    global _last_recommendation_time, _cached_recommendations
    
    # Check cache
    if _cached_recommendations and _last_recommendation_time:
        elapsed = (datetime.now() - _last_recommendation_time).total_seconds() / 60
        if elapsed < cache_minutes:
            print(f"📋 Using cached recommendations ({elapsed:.1f} min old)")
            return _cached_recommendations
    
    print("\n" + "="*70)
    print("RL RECOMMENDATION ENGINE")
    print("="*70)
    
    # Step 1: Get XGBoost predictions
    xgboost_preds = generate_xgboost_predictions()
    if not xgboost_preds:
        print("❌ Failed to generate XGBoost predictions")
        return []
    
    # Step 2: Get RL allocation
    rl_allocation = get_rl_allocation(xgboost_preds)
    if not rl_allocation:
        print("❌ Failed to get RL allocation")
        return []
    
    # Step 3: Build recommendations
    print("\n📈 Step 3: Building recommendations...")
    
    recommendations = []
    
    # Get current prices
    try:
        import yfinance as yf
        prices = {}
        for asset in rl_allocation.keys():
            try:
                ticker = yf.Ticker(asset)
                info = ticker.info
                prices[asset] = info.get('regularMarketPrice') or info.get('currentPrice', 100)
            except:
                prices[asset] = 100
    except:
        prices = {a: 100 for a in rl_allocation.keys()}
    
    # Sort by allocation (highest first)
    sorted_allocation = sorted(rl_allocation.items(), key=lambda x: x[1], reverse=True)
    
    for asset, weight in sorted_allocation:
        if weight < 0.01:  # Skip tiny allocations (<1%)
            continue
        
        signal = xgboost_preds.get(asset, 0)
        price = prices.get(asset, 100)
        dollars = capital * weight
        shares = int(dollars / price) if price > 0 else 0
        
        recommendation = {
            "asset": asset,
            "signal": round(signal, 4),
            "direction": "LONG" if signal > 0.005 else "NEUTRAL" if signal > 0 else "SHORT",
            "confidence": min(abs(signal) * 100, 99),  # Convert to confidence %
            "weight": round(weight, 4),
            "weight_pct": round(weight * 100, 2),
            "current_price": round(price, 2),
            "dollars": round(dollars, 2),
            "shares": shares,
            "source": "RL Portfolio Optimizer",
            "last_updated": datetime.now().isoformat()
        }
        
        recommendations.append(recommendation)
        print(f"  ✅ {asset}: {weight*100:.1f}% (${dollars:,.0f}, {shares} shares)")
    
    print(f"\n✅ Generated {len(recommendations)} recommendations")
    print("="*70)
    
    # Cache results
    _cached_recommendations = recommendations
    _last_recommendation_time = datetime.now()
    
    return recommendations


# Alias for compatibility
def get_rl_recommendations(capital: float = 100000) -> List[Dict]:
    """Alias for generate_rl_recommendations()"""
    return generate_rl_recommendations(capital=capital)


if __name__ == "__main__":
    # Test the pipeline
    print("Testing RL Recommendation Pipeline...")
    recs = generate_rl_recommendations()
    
    if recs:
        print("\n📊 Sample Recommendations:")
        for rec in recs[:5]:
            print(f"  {rec['asset']}: {rec['weight_pct']}% - ${rec['dollars']:,.0f}")
    else:
        print("No recommendations generated")
