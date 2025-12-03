# Smart Investment AI - Trading Module

## Overview

This trading module provides **two modes** for using the AI-powered stock selection system:

1. **Advisory Mode** - Get recommendations only (no trading)
2. **Automated Mode** - Execute trades via Alpaca API (paper or live)

## Quick Start

```powershell
# Navigate to the trading directory
cd smart_investment_ai/trading

# Run in interactive mode
python main.py

# Or use command-line arguments
python main.py --mode advisory --capital 100000
python main.py --mode trade  # Paper trading
python main.py --mode view   # View portfolio
```

## Modes Explained

### 1. Advisory Mode (Recommendations Only)

Get AI-generated stock recommendations without executing any trades:

```powershell
python main.py --mode advisory --capital 100000 --max-position 0.20
```

**Output:**
- Top stock picks ranked by signal strength
- Recommended allocation percentages
- Dollar amounts and share counts
- Saved to CSV for reference

**Example Output:**
```
🎯 PORTFOLIO RECOMMENDATIONS
Asset     Signal    Direction    Weight    Dollars
AAPL      0.054     LONG         10.0%     $10,023
META      0.048     LONG          9.6%      $9,553
QQQ       0.044     LONG          9.2%      $9,204
...
```

### 2. Paper Trading Mode

Execute simulated trades to test the system:

```powershell
python main.py --mode trade
```

**Options:**
- **Alpaca Paper Trading** - If you have Alpaca API keys configured
- **Local Simulation** - Track a virtual portfolio locally

### 3. Live Trading Mode

⚠️ **WARNING: Real money at risk!**

```powershell
python main.py --mode trade --live
```

Requires:
- Alpaca API keys configured
- Multiple confirmations before execution

## Setting Up Alpaca

### 1. Create Alpaca Account
- Go to [alpaca.markets](https://alpaca.markets)
- Create a free account
- Get API keys from the dashboard

### 2. Configure API Keys

**Windows PowerShell:**
```powershell
$env:ALPACA_API_KEY = "your-api-key-here"
$env:ALPACA_SECRET_KEY = "your-secret-key-here"
```

**Or set permanently:**
```powershell
[Environment]::SetEnvironmentVariable("ALPACA_API_KEY", "your-key", "User")
[Environment]::SetEnvironmentVariable("ALPACA_SECRET_KEY", "your-secret", "User")
```

### 3. Install Alpaca SDK
```powershell
pip install alpaca-py
```

## Signal Generation

The system generates signals by combining:

1. **Model Predictions (60%)** - XGBoost walk-forward validated predictions
2. **Momentum Signals (40%)** - Current price momentum and RSI

### Signal Interpretation

| Signal | Direction | Meaning |
|--------|-----------|---------|
| > 0.005 | LONG | Bullish - Buy |
| < -0.005 | SHORT | Bearish - Reduce/Sell |
| -0.005 to 0.005 | NEUTRAL | Hold |

## Risk Management

Built-in risk controls include:

- **Position Limits**: Max 20% per stock (configurable)
- **Sector Limits**: Max 40% per sector
- **Drawdown Protection**: Auto-pause at 10%, stop at 15%
- **Daily Trade Limits**: Max 20 trades/day
- **Turnover Limits**: Max 50% daily turnover

View risk report:
```python
from trading import RiskManager
rm = RiskManager()
print(rm.get_risk_report(portfolio_value=100000))
```

## File Structure

```
trading/
├── __init__.py           # Package init
├── main.py               # Main CLI interface
├── signal_generator.py   # Signal generation logic
├── alpaca_trader.py      # Alpaca API integration
├── risk_manager.py       # Risk controls
└── README.md             # This file
```

## Example Workflow

### Daily Routine

1. **Morning**: Check recommendations
   ```powershell
   python main.py --mode advisory
   ```

2. **Analyze**: Review the top picks and signals

3. **Execute** (if desired):
   ```powershell
   python main.py --mode trade  # Paper trading
   ```

4. **Monitor**: Check portfolio status
   ```powershell
   python main.py --mode view
   ```

### Python API Usage

```python
from trading import SignalGenerator, AlpacaTrader, RiskManager

# Generate signals
generator = SignalGenerator()
recommendations = generator.get_recommendations(capital=100000)

# Apply risk limits
rm = RiskManager()
safe_recommendations = apply_risk_limits(recommendations, rm)

# Execute (paper trading)
trader = AlpacaTrader(paper=True)
trader.execute_portfolio(safe_recommendations)
```

## Performance Notes

Based on our realistic backtest (2021-2024):

| Metric | Value |
|--------|-------|
| Annual Return | 47.5% |
| Sharpe Ratio | 1.93 |
| Max Drawdown | 25.8% |
| Alpha (vs equal-weight) | +31.7% |

**Important**: Past performance does not guarantee future results. Always use paper trading first!

## Limitations

1. **Signal Lag**: OOS predictions are from historical walk-forward validation
2. **Feature Mismatch**: Real-time features may differ slightly from training
3. **Market Conditions**: Models were trained on 2013-2024 data

## Troubleshooting

### "No module named 'alpaca'"
```powershell
pip install alpaca-py
```

### "API keys not found"
Make sure environment variables are set:
```powershell
echo $env:ALPACA_API_KEY
```

### "Connection error"
- Check internet connection
- Verify Alpaca API status at status.alpaca.markets

## Support

For issues or questions:
1. Check the main README.md
2. Review the backtest notebook for methodology
3. Inspect model performance in results/
