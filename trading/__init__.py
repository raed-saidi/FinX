"""
Trading Module - Smart Investment AI

This module provides automated trading and recommendation capabilities.

Components:
- signal_generator.py: Generate trading signals from XGBoost models
- alpaca_trader.py: Execute trades via Alpaca API
- risk_manager.py: Position and drawdown risk controls
- main.py: Interactive trading interface

Quick Start:
    from trading import SignalGenerator, AlpacaTrader
    
    # Generate recommendations
    generator = SignalGenerator()
    recs = generator.get_recommendations(capital=100000)
    
    # Paper trade
    trader = AlpacaTrader(paper=True)
    trader.execute_portfolio(recs)

For more details, run: python trading/main.py
"""

from .signal_generator import SignalGenerator, print_recommendations
from .alpaca_trader import AlpacaTrader, SimulatedTrader
from .risk_manager import RiskManager, apply_risk_limits

__all__ = [
    'SignalGenerator',
    'print_recommendations',
    'AlpacaTrader',
    'SimulatedTrader',
    'RiskManager',
    'apply_risk_limits'
]
