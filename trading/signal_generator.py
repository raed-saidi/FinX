"""
Signal Generator - Generates trading signals from XGBoost model predictions.

This module uses the latest OOS predictions from trained models to generate
portfolio allocation recommendations.

NOTE: For real-time trading, you would need to:
1. Run the full data pipeline to get fresh data
2. Run feature engineering to create proper features
3. Use the trained models to predict

For now, we use the most recent OOS predictions as signals.
"""

import numpy as np
import pandas as pd
import yfinance as yf
from pathlib import Path
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')


class SignalGenerator:
    """
    Generates trading signals using the latest model predictions.
    
    Uses the OOS predictions from walk-forward validation as the
    signal source. For live trading, integrate with the full pipeline.
    """
    
    def __init__(self, model_dir: Path = None):
        """
        Initialize the signal generator.
        
        Args:
            model_dir: Path to the directory containing trained models
        """
        self.base_dir = Path(__file__).parent.parent
        self.model_dir = model_dir or self.base_dir / "models" / "xgboost_walkforward"
        self.data_dir = self.base_dir / "data"
        
        # Asset universe
        self.assets = [
            "AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "AMZN", "META",
            "SPY", "QQQ", "EFA", "IEF", "HYG", "BIL", "INTC", "AMD"
        ]
        
        # Load predictions
        self.predictions = self._load_predictions()
        
    def _load_predictions(self) -> dict:
        """Load OOS predictions from walk-forward validation."""
        predictions = {}
        
        for asset in self.assets:
            pred_path = self.model_dir / f"{asset}_oos_predictions.csv"
            if pred_path.exists():
                df = pd.read_csv(pred_path, parse_dates=['date'])
                df.set_index('date', inplace=True)
                predictions[asset] = df
        
        print(f"✅ Loaded predictions for {len(predictions)} assets")
        return predictions
    
    def get_latest_signals(self) -> pd.DataFrame:
        """
        Get the most recent signals from OOS predictions.
        
        Returns:
            DataFrame with latest signals for each asset
        """
        signals = {}
        
        for asset in self.assets:
            if asset not in self.predictions:
                signals[asset] = {'signal': 0, 'confidence': 0.5, 'direction': 'NEUTRAL'}
                continue
            
            df = self.predictions[asset]
            
            # Get latest prediction (most recent OOS date)
            latest = df.iloc[-1]
            
            # Signal is the predicted 5-day return
            signal = latest['pred']
            
            # Confidence based on how consistent recent predictions are
            recent_preds = df['pred'].tail(5)
            confidence = 1.0 - (recent_preds.std() / (abs(recent_preds.mean()) + 0.01))
            confidence = np.clip(confidence, 0.3, 1.0)
            
            # Direction
            if signal > 0.005:  # >0.5% expected return
                direction = 'LONG'
            elif signal < -0.005:
                direction = 'SHORT'
            else:
                direction = 'NEUTRAL'
            
            signals[asset] = {
                'signal': signal,
                'confidence': confidence,
                'direction': direction,
                'last_pred_date': df.index[-1].strftime('%Y-%m-%d')
            }
        
        signals_df = pd.DataFrame(signals).T
        signals_df.index.name = 'asset'
        
        return signals_df
    
    def get_momentum_signals(self) -> pd.DataFrame:
        """
        Calculate momentum-based signals from recent price action.
        
        Returns:
            DataFrame with momentum signals
        """
        print("\n📥 Fetching recent price data...")
        
        signals = {}
        end_date = datetime.now()
        start_date = end_date - timedelta(days=60)
        
        for asset in self.assets:
            try:
                ticker = yf.Ticker(asset)
                hist = ticker.history(start=start_date, end=end_date)
                
                if len(hist) < 20:
                    signals[asset] = {'signal': 0, 'confidence': 0.5, 'direction': 'NEUTRAL'}
                    continue
                
                close = hist['Close']
                
                # Momentum signals
                ret_5 = (close.iloc[-1] / close.iloc[-5] - 1) if len(close) >= 5 else 0
                ret_20 = (close.iloc[-1] / close.iloc[-20] - 1) if len(close) >= 20 else 0
                
                # RSI
                delta = close.diff()
                gain = delta.where(delta > 0, 0).rolling(14).mean()
                loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
                rs = gain / (loss + 1e-10)
                rsi = (100 - (100 / (1 + rs))).iloc[-1]
                
                # Volatility
                vol = close.pct_change().rolling(20).std().iloc[-1]
                
                # Combined signal
                momentum_score = (ret_5 * 0.3 + ret_20 * 0.3)
                
                # RSI adjustment (reduce signal if overbought/oversold)
                if rsi > 70:
                    momentum_score *= 0.7  # Overbought, reduce bullishness
                elif rsi < 30:
                    momentum_score *= 1.3  # Oversold, increase bullishness
                
                # Normalize by volatility
                signal = momentum_score / (vol + 0.01)
                signal = np.clip(signal, -0.1, 0.1)  # Cap at ±10%
                
                confidence = min(1.0, abs(signal) / 0.03)
                
                direction = 'LONG' if signal > 0.01 else 'SHORT' if signal < -0.01 else 'NEUTRAL'
                
                signals[asset] = {
                    'signal': signal,
                    'confidence': confidence,
                    'direction': direction,
                    'rsi': rsi,
                    'ret_5d': ret_5,
                    'ret_20d': ret_20,
                    'volatility': vol
                }
                
            except Exception as e:
                print(f"  ⚠️ {asset}: {e}")
                signals[asset] = {'signal': 0, 'confidence': 0.5, 'direction': 'NEUTRAL'}
        
        signals_df = pd.DataFrame(signals).T
        signals_df.index.name = 'asset'
        
        return signals_df
    
    def generate_signals(self, use_momentum: bool = True) -> pd.DataFrame:
        """
        Generate combined trading signals.
        
        Args:
            use_momentum: If True, combine with momentum signals
            
        Returns:
            DataFrame with signals and recommended weights
        """
        # Get model-based signals
        model_signals = self.get_latest_signals()
        
        if use_momentum:
            # Get momentum signals
            momentum_signals = self.get_momentum_signals()
            
            # Combine signals (60% model, 40% momentum)
            combined_signals = {}
            for asset in self.assets:
                model_sig = model_signals.loc[asset, 'signal'] if asset in model_signals.index else 0
                mom_sig = momentum_signals.loc[asset, 'signal'] if asset in momentum_signals.index else 0
                
                combined = 0.6 * model_sig + 0.4 * mom_sig
                
                combined_signals[asset] = {
                    'signal': combined,
                    'model_signal': model_sig,
                    'momentum_signal': mom_sig,
                    'confidence': (model_signals.loc[asset, 'confidence'] + 
                                 momentum_signals.loc[asset, 'confidence']) / 2,
                    'direction': 'LONG' if combined > 0.005 else 'SHORT' if combined < -0.005 else 'NEUTRAL'
                }
            
            signals_df = pd.DataFrame(combined_signals).T
            signals_df.index.name = 'asset'
        else:
            signals_df = model_signals
        
        return signals_df
    
    def calculate_portfolio_weights(self, signals_df: pd.DataFrame, 
                                   max_position: float = 0.20,
                                   min_position: float = 0.0) -> pd.DataFrame:
        """
        Convert signals to portfolio weights.
        
        Args:
            signals_df: DataFrame with signals
            max_position: Maximum weight for any single asset
            min_position: Minimum weight (0 = no shorting)
            
        Returns:
            DataFrame with recommended weights
        """
        # Get signal values
        raw_signals = signals_df['signal'].values
        
        # Shift to positive (for long-only)
        if min_position >= 0:
            shifted = raw_signals - raw_signals.min() + 0.01
        else:
            shifted = raw_signals
        
        # Normalize to sum to 1
        weights = shifted / shifted.sum()
        
        # Apply position limits
        weights = np.clip(weights, min_position, max_position)
        weights = weights / weights.sum()  # Renormalize
        
        # Add to DataFrame
        signals_df['weight'] = weights
        signals_df['weight_pct'] = weights * 100
        
        return signals_df
    
    def get_recommendations(self, capital: float = 100000, 
                           max_position: float = 0.20) -> pd.DataFrame:
        """
        Get full trading recommendations.
        
        Args:
            capital: Total capital to allocate
            max_position: Maximum position size (as fraction)
            
        Returns:
            DataFrame with complete recommendations
        """
        print("\n" + "="*60)
        print("📊 GENERATING TRADING RECOMMENDATIONS")
        print("="*60)
        print(f"Capital: ${capital:,.2f}")
        print(f"Max Position: {max_position*100:.0f}%")
        print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        
        # Generate signals
        signals = self.generate_signals()
        
        # Calculate weights
        recommendations = self.calculate_portfolio_weights(signals, max_position)
        
        # Calculate dollar amounts
        recommendations['dollars'] = recommendations['weight'] * capital
        
        # Fetch current prices for share calculations
        print("\n💵 Fetching current prices...")
        current_prices = {}
        for asset in self.assets:
            try:
                ticker = yf.Ticker(asset)
                current_prices[asset] = ticker.info.get('regularMarketPrice', 
                                       ticker.history(period='1d')['Close'].iloc[-1])
            except:
                current_prices[asset] = None
        
        recommendations['current_price'] = [current_prices.get(a) for a in recommendations.index]
        recommendations['shares'] = (recommendations['dollars'] / recommendations['current_price']).fillna(0).astype(int)
        
        # Sort by weight
        recommendations = recommendations.sort_values('weight', ascending=False)
        
        return recommendations


def print_recommendations(recs: pd.DataFrame):
    """Pretty print the recommendations."""
    print("\n" + "="*80)
    print("🎯 PORTFOLIO RECOMMENDATIONS")
    print("="*80)
    print(f"\n{'Asset':<8} {'Signal':>10} {'Direction':<10} {'Weight':>10} {'Dollars':>12} {'Shares':>8}")
    print("-"*80)
    
    for asset, row in recs.iterrows():
        direction = row.get('direction', 'N/A')
        print(f"{asset:<8} {row['signal']:>10.4f} {direction:<10} {row['weight_pct']:>9.2f}% ${row['dollars']:>10,.0f} {row['shares']:>8.0f}")
    
    print("-"*80)
    print(f"{'TOTAL':<8} {'':<10} {'':<10} {recs['weight_pct'].sum():>9.2f}% ${recs['dollars'].sum():>10,.0f}")
    print("="*80)


if __name__ == "__main__":
    # Example usage
    generator = SignalGenerator()
    
    # Get recommendations for $100k portfolio
    recommendations = generator.get_recommendations(capital=100000, max_position=0.20)
    
    # Print them
    print_recommendations(recommendations)
    
    # Save to CSV
    output_path = generator.base_dir / "trading" / "latest_recommendations.csv"
    recommendations.to_csv(output_path)
    print(f"\n✅ Recommendations saved to {output_path}")
