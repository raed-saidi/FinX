"""
Alpaca Trading Integration - Execute trades via Alpaca API.

This module provides paper trading and live trading capabilities
through the Alpaca brokerage API.

IMPORTANT: Start with paper trading to validate the system!
"""

import os
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List
import json


class AlpacaTrader:
    """
    Alpaca trading integration for automated portfolio execution.
    
    Supports both paper trading (recommended for testing) and live trading.
    """
    
    def __init__(self, paper: bool = True):
        """
        Initialize Alpaca trader.
        
        Args:
            paper: If True, use paper trading (recommended for testing)
        """
        self.paper = paper
        self.api = None
        self.base_dir = Path(__file__).parent.parent
        
        # Try to initialize Alpaca
        self._init_alpaca()
        
    def _init_alpaca(self):
        """Initialize Alpaca API connection."""
        try:
            from alpaca.trading.client import TradingClient
            from alpaca.trading.requests import MarketOrderRequest, GetAssetsRequest
            from alpaca.trading.enums import OrderSide, TimeInForce, AssetClass
            
            # Get API keys from environment
            api_key = os.environ.get('ALPACA_API_KEY') or os.environ.get('APCA_API_KEY_ID')
            api_secret = os.environ.get('ALPACA_SECRET_KEY') or os.environ.get('APCA_API_SECRET_KEY')
            
            if api_key and api_secret:
                self.api = TradingClient(api_key, api_secret, paper=self.paper)
                self.MarketOrderRequest = MarketOrderRequest
                self.OrderSide = OrderSide
                self.TimeInForce = TimeInForce
                print(f"✅ Alpaca {'Paper' if self.paper else 'Live'} Trading initialized")
            else:
                print("⚠️ Alpaca API keys not found in environment")
                print("   Set ALPACA_API_KEY and ALPACA_SECRET_KEY")
                self.api = None
                
        except ImportError:
            print("⚠️ alpaca-py not installed. Install with: pip install alpaca-py")
            self.api = None
    
    def get_account(self) -> Optional[dict]:
        """Get account information."""
        if not self.api:
            return None
        
        try:
            account = self.api.get_account()
            return {
                'buying_power': float(account.buying_power),
                'cash': float(account.cash),
                'portfolio_value': float(account.portfolio_value),
                'equity': float(account.equity),
                'status': account.status
            }
        except Exception as e:
            print(f"❌ Error getting account: {e}")
            return None
    
    def get_positions(self) -> Dict[str, dict]:
        """Get current positions."""
        if not self.api:
            return {}
        
        try:
            positions = self.api.get_all_positions()
            return {
                p.symbol: {
                    'qty': float(p.qty),
                    'market_value': float(p.market_value),
                    'avg_entry_price': float(p.avg_entry_price),
                    'current_price': float(p.current_price),
                    'unrealized_pl': float(p.unrealized_pl),
                    'unrealized_plpc': float(p.unrealized_plpc)
                }
                for p in positions
            }
        except Exception as e:
            print(f"❌ Error getting positions: {e}")
            return {}
    
    def place_order(self, symbol: str, qty: int, side: str = 'buy') -> Optional[dict]:
        """
        Place a market order.
        
        Args:
            symbol: Stock ticker symbol
            qty: Number of shares
            side: 'buy' or 'sell'
            
        Returns:
            Order details or None if failed
        """
        if not self.api:
            print("❌ Alpaca API not initialized")
            return None
        
        if qty <= 0:
            return None
        
        try:
            order_side = self.OrderSide.BUY if side.lower() == 'buy' else self.OrderSide.SELL
            
            order_request = self.MarketOrderRequest(
                symbol=symbol,
                qty=qty,
                side=order_side,
                time_in_force=self.TimeInForce.DAY
            )
            
            order = self.api.submit_order(order_request)
            
            print(f"✅ Order placed: {side.upper()} {qty} {symbol}")
            
            return {
                'id': str(order.id),
                'symbol': order.symbol,
                'qty': float(order.qty) if order.qty else qty,
                'side': order.side.value,
                'status': order.status.value,
                'submitted_at': str(order.submitted_at)
            }
            
        except Exception as e:
            print(f"❌ Order failed for {symbol}: {e}")
            return None
    
    def execute_portfolio(self, recommendations: pd.DataFrame, 
                         confirm: bool = True) -> List[dict]:
        """
        Execute trades to match recommended portfolio.
        
        Args:
            recommendations: DataFrame with 'shares' column
            confirm: If True, ask for confirmation before trading
            
        Returns:
            List of executed orders
        """
        if not self.api:
            print("❌ Cannot execute: Alpaca API not initialized")
            return []
        
        # Get current positions
        current_positions = self.get_positions()
        
        # Calculate required trades
        trades = []
        for asset, row in recommendations.iterrows():
            target_shares = int(row['shares'])
            current_shares = int(current_positions.get(asset, {}).get('qty', 0))
            diff = target_shares - current_shares
            
            if diff > 0:
                trades.append({'symbol': asset, 'qty': diff, 'side': 'buy'})
            elif diff < 0:
                trades.append({'symbol': asset, 'qty': abs(diff), 'side': 'sell'})
        
        if not trades:
            print("✅ Portfolio already matches recommendations")
            return []
        
        # Display trades
        print("\n" + "="*60)
        print("📋 REQUIRED TRADES")
        print("="*60)
        for t in trades:
            print(f"  {t['side'].upper():>4} {t['qty']:>6} {t['symbol']}")
        print("="*60)
        
        # Confirm
        if confirm:
            response = input("\n⚠️ Execute these trades? (yes/no): ")
            if response.lower() not in ['yes', 'y']:
                print("❌ Trades cancelled")
                return []
        
        # Execute trades (sells first, then buys)
        sells = [t for t in trades if t['side'] == 'sell']
        buys = [t for t in trades if t['side'] == 'buy']
        
        executed = []
        
        for trade in sells + buys:
            result = self.place_order(trade['symbol'], trade['qty'], trade['side'])
            if result:
                executed.append(result)
        
        return executed
    
    def close_all_positions(self, confirm: bool = True) -> bool:
        """Close all positions."""
        if not self.api:
            return False
        
        if confirm:
            response = input("⚠️ Close ALL positions? (yes/no): ")
            if response.lower() not in ['yes', 'y']:
                print("❌ Cancelled")
                return False
        
        try:
            self.api.close_all_positions(cancel_orders=True)
            print("✅ All positions closed")
            return True
        except Exception as e:
            print(f"❌ Error closing positions: {e}")
            return False


class SimulatedTrader:
    """
    Simulated trader for testing without API connection.
    Tracks paper portfolio locally.
    """
    
    def __init__(self, initial_capital: float = 100000):
        """Initialize with starting capital."""
        self.cash = initial_capital
        self.positions = {}
        self.trades = []
        self.base_dir = Path(__file__).parent.parent
        
        # Load existing state if available
        self._load_state()
        
    def _load_state(self):
        """Load saved portfolio state."""
        state_path = self.base_dir / "trading" / "simulated_portfolio.json"
        if state_path.exists():
            with open(state_path) as f:
                state = json.load(f)
                self.cash = state.get('cash', self.cash)
                self.positions = state.get('positions', {})
                self.trades = state.get('trades', [])
                print(f"✅ Loaded simulated portfolio (${self.cash + self._position_value():,.2f})")
    
    def _save_state(self):
        """Save portfolio state."""
        state_path = self.base_dir / "trading" / "simulated_portfolio.json"
        state = {
            'cash': self.cash,
            'positions': self.positions,
            'trades': self.trades,
            'last_updated': datetime.now().isoformat()
        }
        with open(state_path, 'w') as f:
            json.dump(state, f, indent=2)
    
    def _position_value(self) -> float:
        """Calculate total position value."""
        return sum(p['value'] for p in self.positions.values())
    
    def get_account(self) -> dict:
        """Get simulated account info."""
        pos_value = self._position_value()
        return {
            'cash': self.cash,
            'positions_value': pos_value,
            'portfolio_value': self.cash + pos_value,
            'status': 'SIMULATED'
        }
    
    def get_positions(self) -> dict:
        """Get current positions."""
        return self.positions.copy()
    
    def place_order(self, symbol: str, qty: int, side: str, price: float) -> dict:
        """
        Simulate order execution.
        
        Args:
            symbol: Stock ticker
            qty: Number of shares
            side: 'buy' or 'sell'
            price: Current price per share
        """
        value = qty * price
        
        if side.lower() == 'buy':
            if value > self.cash:
                print(f"❌ Insufficient cash for {symbol}")
                return None
            
            self.cash -= value
            if symbol in self.positions:
                self.positions[symbol]['qty'] += qty
                self.positions[symbol]['value'] += value
            else:
                self.positions[symbol] = {'qty': qty, 'value': value, 'avg_price': price}
                
        else:  # sell
            if symbol not in self.positions or self.positions[symbol]['qty'] < qty:
                print(f"❌ Insufficient shares of {symbol}")
                return None
            
            self.positions[symbol]['qty'] -= qty
            self.positions[symbol]['value'] -= value
            self.cash += value
            
            if self.positions[symbol]['qty'] == 0:
                del self.positions[symbol]
        
        trade = {
            'timestamp': datetime.now().isoformat(),
            'symbol': symbol,
            'side': side,
            'qty': qty,
            'price': price,
            'value': value
        }
        self.trades.append(trade)
        self._save_state()
        
        print(f"✅ Simulated: {side.upper()} {qty} {symbol} @ ${price:.2f}")
        return trade
    
    def execute_portfolio(self, recommendations: pd.DataFrame) -> List[dict]:
        """Execute trades to match recommendations."""
        import yfinance as yf
        
        executed = []
        
        for asset, row in recommendations.iterrows():
            target_shares = int(row['shares'])
            current_shares = self.positions.get(asset, {}).get('qty', 0)
            diff = target_shares - current_shares
            
            if diff == 0:
                continue
            
            # Get current price
            try:
                price = yf.Ticker(asset).info.get('regularMarketPrice', row.get('current_price', 100))
            except:
                price = row.get('current_price', 100)
            
            if diff > 0:
                result = self.place_order(asset, diff, 'buy', price)
            else:
                result = self.place_order(asset, abs(diff), 'sell', price)
            
            if result:
                executed.append(result)
        
        return executed


def check_alpaca_setup() -> bool:
    """Check if Alpaca is properly configured."""
    api_key = os.environ.get('ALPACA_API_KEY') or os.environ.get('APCA_API_KEY_ID')
    api_secret = os.environ.get('ALPACA_SECRET_KEY') or os.environ.get('APCA_API_SECRET_KEY')
    
    print("\n" + "="*60)
    print("🔐 ALPACA CONFIGURATION CHECK")
    print("="*60)
    
    if api_key:
        print(f"  ✅ API Key: {api_key[:8]}...")
    else:
        print("  ❌ API Key: NOT SET")
        print("     Set with: $env:ALPACA_API_KEY = 'your-key'")
    
    if api_secret:
        print(f"  ✅ Secret Key: {api_secret[:8]}...")
    else:
        print("  ❌ Secret Key: NOT SET")
        print("     Set with: $env:ALPACA_SECRET_KEY = 'your-secret'")
    
    try:
        import alpaca
        print("  ✅ alpaca-py: Installed")
    except ImportError:
        print("  ❌ alpaca-py: NOT INSTALLED")
        print("     Install with: pip install alpaca-py")
        return False
    
    print("="*60)
    
    return bool(api_key and api_secret)


if __name__ == "__main__":
    # Check setup
    if check_alpaca_setup():
        # Test connection
        trader = AlpacaTrader(paper=True)
        account = trader.get_account()
        if account:
            print(f"\n📊 Account Status: {account['status']}")
            print(f"   Portfolio Value: ${account['portfolio_value']:,.2f}")
            print(f"   Buying Power: ${account['buying_power']:,.2f}")
    else:
        print("\n💡 Using simulated trader for testing...")
        trader = SimulatedTrader(initial_capital=100000)
        account = trader.get_account()
        print(f"\n📊 Simulated Portfolio: ${account['portfolio_value']:,.2f}")
