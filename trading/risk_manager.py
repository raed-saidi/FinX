"""
Risk Management Module - Controls and limits for safe trading.

Implements position limits, drawdown protection, and risk monitoring.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional
import json


class RiskManager:
    """
    Risk management controls for the trading system.
    """
    
    def __init__(self, config: dict = None):
        """
        Initialize risk manager with configuration.
        
        Args:
            config: Risk parameters dictionary
        """
        self.config = config or {}
        self.base_dir = Path(__file__).parent.parent
        
        # Position limits
        self.max_position_size = self.config.get('max_position_size', 0.20)  # 20% max per stock
        self.min_position_size = self.config.get('min_position_size', 0.02)  # 2% min to trade
        self.max_sector_exposure = self.config.get('max_sector_exposure', 0.40)  # 40% max per sector
        
        # Drawdown limits
        self.max_drawdown = self.config.get('max_drawdown', 0.15)  # 15% max drawdown
        self.drawdown_pause_threshold = self.config.get('drawdown_pause', 0.10)  # Pause at 10%
        
        # Volatility limits
        self.max_portfolio_volatility = self.config.get('max_volatility', 0.25)  # 25% annualized
        
        # Trading limits
        self.max_daily_trades = self.config.get('max_daily_trades', 20)
        self.max_daily_turnover = self.config.get('max_daily_turnover', 0.50)  # 50% of portfolio
        
        # Track state
        self.high_water_mark = 0.0
        self.current_drawdown = 0.0
        self.trades_today = 0
        self.daily_turnover = 0.0
        
        # Load state
        self._load_state()
        
        # Sector mapping
        self.sector_map = {
            'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology',
            'AMZN': 'Consumer', 'META': 'Technology', 'NVDA': 'Technology',
            'TSLA': 'Consumer', 'AMD': 'Technology', 'INTC': 'Technology',
            'SPY': 'Index', 'QQQ': 'Index', 'EFA': 'International',
            'IEF': 'Bonds', 'HYG': 'Bonds', 'BIL': 'Bonds'
        }
    
    def _load_state(self):
        """Load saved risk state."""
        state_path = self.base_dir / "trading" / "risk_state.json"
        if state_path.exists():
            with open(state_path) as f:
                state = json.load(f)
                self.high_water_mark = state.get('high_water_mark', 0)
                last_date = state.get('last_date', '')
                if last_date != datetime.now().strftime('%Y-%m-%d'):
                    # Reset daily counters
                    self.trades_today = 0
                    self.daily_turnover = 0.0
                else:
                    self.trades_today = state.get('trades_today', 0)
                    self.daily_turnover = state.get('daily_turnover', 0.0)
    
    def _save_state(self):
        """Save risk state."""
        state_path = self.base_dir / "trading" / "risk_state.json"
        state = {
            'high_water_mark': self.high_water_mark,
            'current_drawdown': self.current_drawdown,
            'trades_today': self.trades_today,
            'daily_turnover': self.daily_turnover,
            'last_date': datetime.now().strftime('%Y-%m-%d'),
            'last_updated': datetime.now().isoformat()
        }
        with open(state_path, 'w') as f:
            json.dump(state, f, indent=2)
    
    def update_portfolio_value(self, value: float):
        """
        Update portfolio value and calculate drawdown.
        
        Args:
            value: Current portfolio value
        """
        if value > self.high_water_mark:
            self.high_water_mark = value
        
        if self.high_water_mark > 0:
            self.current_drawdown = (self.high_water_mark - value) / self.high_water_mark
        
        self._save_state()
    
    def check_drawdown(self) -> Dict[str, any]:
        """
        Check if drawdown limits are exceeded.
        
        Returns:
            Dictionary with status and recommendations
        """
        result = {
            'current_drawdown': self.current_drawdown,
            'max_allowed': self.max_drawdown,
            'pause_threshold': self.drawdown_pause_threshold,
            'status': 'OK',
            'action': 'CONTINUE'
        }
        
        if self.current_drawdown >= self.max_drawdown:
            result['status'] = 'CRITICAL'
            result['action'] = 'STOP_TRADING'
            result['message'] = f"Max drawdown exceeded: {self.current_drawdown*100:.1f}% > {self.max_drawdown*100:.1f}%"
        elif self.current_drawdown >= self.drawdown_pause_threshold:
            result['status'] = 'WARNING'
            result['action'] = 'REDUCE_RISK'
            result['message'] = f"Drawdown warning: {self.current_drawdown*100:.1f}% approaching limit"
        
        return result
    
    def validate_positions(self, weights: pd.DataFrame) -> Dict[str, any]:
        """
        Validate proposed position weights against risk limits.
        
        Args:
            weights: DataFrame with portfolio weights
            
        Returns:
            Validation result with any adjustments needed
        """
        result = {
            'valid': True,
            'warnings': [],
            'adjustments': {},
            'original_weights': weights['weight'].to_dict()
        }
        
        adjusted_weights = weights.copy()
        
        # Check individual position limits
        for asset, row in weights.iterrows():
            weight = row['weight']
            
            if weight > self.max_position_size:
                result['warnings'].append(
                    f"{asset}: weight {weight*100:.1f}% exceeds max {self.max_position_size*100:.0f}%"
                )
                adjusted_weights.loc[asset, 'weight'] = self.max_position_size
                result['adjustments'][asset] = self.max_position_size
            
            if 0 < weight < self.min_position_size:
                result['warnings'].append(
                    f"{asset}: weight {weight*100:.1f}% below minimum {self.min_position_size*100:.0f}%"
                )
                adjusted_weights.loc[asset, 'weight'] = 0
                result['adjustments'][asset] = 0
        
        # Check sector exposure
        sector_weights = {}
        for asset, row in adjusted_weights.iterrows():
            sector = self.sector_map.get(asset, 'Other')
            sector_weights[sector] = sector_weights.get(sector, 0) + row['weight']
        
        for sector, weight in sector_weights.items():
            if weight > self.max_sector_exposure:
                result['warnings'].append(
                    f"Sector {sector}: {weight*100:.1f}% exceeds max {self.max_sector_exposure*100:.0f}%"
                )
                result['valid'] = False
        
        # Renormalize if adjustments were made
        if result['adjustments']:
            total = adjusted_weights['weight'].sum()
            if total > 0:
                adjusted_weights['weight'] = adjusted_weights['weight'] / total
        
        result['adjusted_weights'] = adjusted_weights['weight'].to_dict()
        
        return result
    
    def check_daily_limits(self, num_trades: int = 1, turnover: float = 0) -> Dict[str, any]:
        """
        Check if daily trading limits allow more trades.
        
        Args:
            num_trades: Number of trades to execute
            turnover: Portfolio turnover of proposed trades
            
        Returns:
            Validation result
        """
        result = {
            'allowed': True,
            'trades_today': self.trades_today,
            'max_trades': self.max_daily_trades,
            'turnover_today': self.daily_turnover,
            'max_turnover': self.max_daily_turnover,
            'warnings': []
        }
        
        if self.trades_today + num_trades > self.max_daily_trades:
            result['allowed'] = False
            result['warnings'].append(
                f"Trade limit reached: {self.trades_today}/{self.max_daily_trades} trades today"
            )
        
        if self.daily_turnover + turnover > self.max_daily_turnover:
            result['allowed'] = False
            result['warnings'].append(
                f"Turnover limit: {self.daily_turnover*100:.1f}%/{self.max_daily_turnover*100:.0f}% today"
            )
        
        return result
    
    def record_trade(self, turnover: float = 0):
        """Record a completed trade."""
        self.trades_today += 1
        self.daily_turnover += turnover
        self._save_state()
    
    def calculate_position_volatility(self, weights: dict, returns_data: pd.DataFrame) -> float:
        """
        Calculate expected portfolio volatility.
        
        Args:
            weights: Portfolio weights dictionary
            returns_data: Historical returns DataFrame
            
        Returns:
            Annualized portfolio volatility
        """
        # Get assets with weights
        assets = [a for a in weights.keys() if weights[a] > 0 and a in returns_data.columns]
        
        if not assets:
            return 0.0
        
        # Filter returns
        rets = returns_data[assets].dropna()
        
        if len(rets) < 20:
            return 0.0
        
        # Calculate covariance matrix
        cov_matrix = rets.cov() * 252  # Annualized
        
        # Portfolio weights vector
        w = np.array([weights.get(a, 0) for a in assets])
        w = w / w.sum()  # Normalize
        
        # Portfolio variance
        port_var = np.dot(w.T, np.dot(cov_matrix.values, w))
        port_vol = np.sqrt(port_var)
        
        return port_vol
    
    def get_risk_report(self, portfolio_value: float = None) -> str:
        """
        Generate comprehensive risk report.
        
        Args:
            portfolio_value: Current portfolio value
            
        Returns:
            Formatted risk report string
        """
        if portfolio_value:
            self.update_portfolio_value(portfolio_value)
        
        drawdown_status = self.check_drawdown()
        
        report = []
        report.append("\n" + "="*60)
        report.append("📊 RISK MANAGEMENT REPORT")
        report.append("="*60)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        
        # Drawdown section
        report.append("\n📉 DRAWDOWN STATUS")
        report.append("-"*40)
        dd_pct = drawdown_status['current_drawdown'] * 100
        max_pct = drawdown_status['max_allowed'] * 100
        report.append(f"  Current Drawdown: {dd_pct:.2f}%")
        report.append(f"  Max Allowed: {max_pct:.1f}%")
        report.append(f"  High Water Mark: ${self.high_water_mark:,.2f}")
        report.append(f"  Status: {drawdown_status['status']}")
        report.append(f"  Action: {drawdown_status['action']}")
        
        # Daily limits
        report.append("\n📈 DAILY TRADING LIMITS")
        report.append("-"*40)
        report.append(f"  Trades Today: {self.trades_today}/{self.max_daily_trades}")
        report.append(f"  Turnover Today: {self.daily_turnover*100:.1f}%/{self.max_daily_turnover*100:.0f}%")
        
        # Position limits
        report.append("\n🎯 POSITION LIMITS")
        report.append("-"*40)
        report.append(f"  Max Single Position: {self.max_position_size*100:.0f}%")
        report.append(f"  Min Position Size: {self.min_position_size*100:.0f}%")
        report.append(f"  Max Sector Exposure: {self.max_sector_exposure*100:.0f}%")
        
        report.append("\n" + "="*60)
        
        return "\n".join(report)


def apply_risk_limits(recommendations: pd.DataFrame, 
                     risk_manager: RiskManager) -> pd.DataFrame:
    """
    Apply risk limits to portfolio recommendations.
    
    Args:
        recommendations: Original recommendations DataFrame
        risk_manager: RiskManager instance
        
    Returns:
        Risk-adjusted recommendations
    """
    # Validate positions
    validation = risk_manager.validate_positions(recommendations)
    
    if validation['warnings']:
        print("\n⚠️ RISK WARNINGS:")
        for w in validation['warnings']:
            print(f"  - {w}")
    
    # Apply adjustments
    if validation['adjustments']:
        print("\n🔧 APPLYING RISK ADJUSTMENTS...")
        for asset, new_weight in validation['adjusted_weights'].items():
            if asset in recommendations.index:
                recommendations.loc[asset, 'weight'] = new_weight
        
        # Recalculate derived columns
        total_capital = recommendations['dollars'].sum() / recommendations['weight'].sum()
        recommendations['dollars'] = recommendations['weight'] * total_capital
        recommendations['weight_pct'] = recommendations['weight'] * 100
        
        if 'current_price' in recommendations.columns:
            recommendations['shares'] = (
                recommendations['dollars'] / recommendations['current_price']
            ).fillna(0).astype(int)
    
    return recommendations


if __name__ == "__main__":
    # Example usage
    rm = RiskManager({
        'max_position_size': 0.20,
        'max_drawdown': 0.15,
        'max_daily_trades': 20
    })
    
    # Update with example portfolio value
    rm.update_portfolio_value(100000)
    
    # Print risk report
    print(rm.get_risk_report(95000))  # 5% drawdown
    
    # Test position validation
    test_weights = pd.DataFrame({
        'weight': [0.30, 0.25, 0.20, 0.15, 0.10],
        'asset': ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN']
    }).set_index('asset')
    
    print("\n📋 Testing Position Validation:")
    result = rm.validate_positions(test_weights)
    print(f"  Valid: {result['valid']}")
    print(f"  Warnings: {result['warnings']}")
