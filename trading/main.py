"""
Smart Investment AI - Main Trading Interface

This is the main entry point for the trading system.
Supports two modes:
  1. ADVISORY - Get recommendations only (no trading)
  2. AUTOMATED - Execute trades automatically via Alpaca

Usage:
    python main.py                     # Interactive mode
    python main.py --mode advisory     # Just show recommendations
    python main.py --mode trade        # Execute trades (paper)
    python main.py --mode trade --live # Execute trades (LIVE - careful!)
"""

import argparse
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from trading.signal_generator import SignalGenerator, print_recommendations
from trading.alpaca_trader import AlpacaTrader, SimulatedTrader, check_alpaca_setup


def banner():
    """Print welcome banner."""
    print("\n" + "="*70)
    print("""
    ███████╗███╗   ███╗ █████╗ ██████╗ ████████╗    ██╗███╗   ██╗██╗   ██╗
    ██╔════╝████╗ ████║██╔══██╗██╔══██╗╚══██╔══╝    ██║████╗  ██║██║   ██║
    ███████╗██╔████╔██║███████║██████╔╝   ██║       ██║██╔██╗ ██║██║   ██║
    ╚════██║██║╚██╔╝██║██╔══██║██╔══██╗   ██║       ██║██║╚██╗██║╚██╝ ██╔╝
    ███████║██║ ╚═╝ ██║██║  ██║██║  ██║   ██║       ██║██║ ╚████║ ╚████╔╝ 
    ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝       ╚═╝╚═╝  ╚═══╝  ╚═══╝ 
    
                    AI-Powered Portfolio Management
    """)
    print("="*70)
    print(f"    📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70 + "\n")


def get_user_capital() -> float:
    """Prompt user for capital amount."""
    while True:
        try:
            capital = input("\n💰 Enter your investment capital (default $100,000): ").strip()
            if capital == "":
                return 100000.0
            capital = float(capital.replace(",", "").replace("$", ""))
            if capital <= 0:
                print("❌ Capital must be positive")
                continue
            return capital
        except ValueError:
            print("❌ Invalid amount. Enter a number like 50000 or $100,000")


def get_user_max_position() -> float:
    """Prompt user for max position size."""
    while True:
        try:
            pos = input("📊 Max position size % (default 20%): ").strip()
            if pos == "":
                return 0.20
            pos = float(pos.replace("%", "")) / 100
            if pos <= 0 or pos > 1:
                print("❌ Must be between 1% and 100%")
                continue
            return pos
        except ValueError:
            print("❌ Invalid percentage. Enter a number like 20 or 25%")


def interactive_mode():
    """Run interactive trading session."""
    banner()
    
    print("Select mode:")
    print("  1. 📋 ADVISORY - Get recommendations only")
    print("  2. 📈 PAPER TRADE - Execute trades (simulated)")
    print("  3. 🏦 LIVE TRADE - Execute real trades (requires Alpaca)")
    print("  4. 📊 VIEW PORTFOLIO - See current positions")
    print("  5. ❌ EXIT")
    
    while True:
        choice = input("\nEnter choice (1-5): ").strip()
        
        if choice == "1":
            advisory_mode()
        elif choice == "2":
            paper_trade_mode()
        elif choice == "3":
            live_trade_mode()
        elif choice == "4":
            view_portfolio()
        elif choice == "5":
            print("\n👋 Goodbye!")
            break
        else:
            print("❌ Invalid choice")


def advisory_mode(capital: float = None, max_position: float = None):
    """Generate and display recommendations without trading."""
    print("\n" + "="*60)
    print("📋 ADVISORY MODE - Recommendations Only")
    print("="*60)
    
    if capital is None:
        capital = get_user_capital()
    if max_position is None:
        max_position = get_user_max_position()
    
    # Generate signals
    generator = SignalGenerator()
    recommendations = generator.get_recommendations(
        capital=capital,
        max_position=max_position
    )
    
    # Print recommendations
    print_recommendations(recommendations)
    
    # Show top picks
    print("\n🏆 TOP 5 PICKS:")
    top5 = recommendations.head(5)
    for i, (asset, row) in enumerate(top5.iterrows(), 1):
        direction = "🟢 LONG" if row['signal'] > 0 else "🔴 SHORT" if row['signal'] < 0 else "⚪ NEUTRAL"
        print(f"  {i}. {asset}: {direction} - Allocate {row['weight_pct']:.1f}% (${row['dollars']:,.0f})")
    
    # Save to file
    base_dir = Path(__file__).parent.parent
    output_path = base_dir / "trading" / f"recommendations_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    recommendations.to_csv(output_path)
    print(f"\n💾 Saved to {output_path}")
    
    return recommendations


def paper_trade_mode():
    """Execute trades using simulated or Alpaca paper account."""
    print("\n" + "="*60)
    print("📈 PAPER TRADING MODE")
    print("="*60)
    
    # Check if Alpaca is available
    has_alpaca = check_alpaca_setup()
    
    if has_alpaca:
        trader = AlpacaTrader(paper=True)
        account = trader.get_account()
        if account:
            capital = account['portfolio_value']
            print(f"\n📊 Alpaca Paper Account: ${capital:,.2f}")
        else:
            print("⚠️ Could not connect to Alpaca, using simulated trader")
            trader = SimulatedTrader()
            capital = get_user_capital()
    else:
        print("💡 Using local simulated trader")
        trader = SimulatedTrader()
        account = trader.get_account()
        capital = account['portfolio_value']
        print(f"📊 Simulated Portfolio: ${capital:,.2f}")
    
    max_position = get_user_max_position()
    
    # Generate recommendations
    generator = SignalGenerator()
    recommendations = generator.get_recommendations(
        capital=capital,
        max_position=max_position
    )
    
    print_recommendations(recommendations)
    
    # Execute trades
    print("\n⚠️ Ready to execute paper trades")
    if isinstance(trader, AlpacaTrader):
        trades = trader.execute_portfolio(recommendations, confirm=True)
    else:
        confirm = input("Execute simulated trades? (yes/no): ")
        if confirm.lower() in ['yes', 'y']:
            trades = trader.execute_portfolio(recommendations)
        else:
            print("❌ Trades cancelled")
            trades = []
    
    if trades:
        print(f"\n✅ Executed {len(trades)} trades")


def live_trade_mode():
    """Execute real trades via Alpaca (use with caution!)."""
    print("\n" + "="*60)
    print("🏦 LIVE TRADING MODE")
    print("="*60)
    print("\n⚠️  WARNING: This will execute REAL trades with REAL money!")
    print("⚠️  Make sure you understand the risks involved.")
    
    # Triple confirmation
    confirm1 = input("\nType 'I UNDERSTAND' to continue: ")
    if confirm1 != "I UNDERSTAND":
        print("❌ Cancelled")
        return
    
    if not check_alpaca_setup():
        print("\n❌ Alpaca not configured. Cannot execute live trades.")
        return
    
    trader = AlpacaTrader(paper=False)
    account = trader.get_account()
    
    if not account:
        print("❌ Could not connect to Alpaca live account")
        return
    
    print(f"\n📊 Live Account Status: {account['status']}")
    print(f"   Portfolio Value: ${account['portfolio_value']:,.2f}")
    print(f"   Cash: ${account['cash']:,.2f}")
    
    confirm2 = input(f"\nTrade with this ${account['portfolio_value']:,.2f} account? (yes/no): ")
    if confirm2.lower() not in ['yes', 'y']:
        print("❌ Cancelled")
        return
    
    capital = account['portfolio_value']
    max_position = get_user_max_position()
    
    # Generate recommendations
    generator = SignalGenerator()
    recommendations = generator.get_recommendations(
        capital=capital,
        max_position=max_position
    )
    
    print_recommendations(recommendations)
    
    # Execute with confirmation
    trades = trader.execute_portfolio(recommendations, confirm=True)
    
    if trades:
        print(f"\n✅ Executed {len(trades)} LIVE trades")


def view_portfolio():
    """View current portfolio positions."""
    print("\n" + "="*60)
    print("📊 CURRENT PORTFOLIO")
    print("="*60)
    
    # Check Alpaca
    has_alpaca = check_alpaca_setup()
    
    if has_alpaca:
        trader = AlpacaTrader(paper=True)
        account = trader.get_account()
        positions = trader.get_positions()
        
        if account:
            print(f"\n🏦 Alpaca Paper Account")
            print(f"   Portfolio Value: ${account['portfolio_value']:,.2f}")
            print(f"   Cash: ${account['cash']:,.2f}")
            print(f"   Buying Power: ${account['buying_power']:,.2f}")
            
            if positions:
                print(f"\n   Positions ({len(positions)}):")
                print(f"   {'Symbol':<8} {'Qty':>8} {'Value':>12} {'P/L':>12} {'P/L %':>10}")
                print("   " + "-"*52)
                for symbol, pos in positions.items():
                    print(f"   {symbol:<8} {pos['qty']:>8.0f} ${pos['market_value']:>10,.2f} "
                          f"${pos['unrealized_pl']:>10,.2f} {pos['unrealized_plpc']*100:>9.2f}%")
            else:
                print("\n   No positions")
    
    # Also show simulated portfolio
    sim_trader = SimulatedTrader()
    sim_account = sim_trader.get_account()
    
    print(f"\n💻 Simulated Portfolio")
    print(f"   Total Value: ${sim_account['portfolio_value']:,.2f}")
    print(f"   Cash: ${sim_account['cash']:,.2f}")
    
    if sim_trader.positions:
        print(f"\n   Positions ({len(sim_trader.positions)}):")
        for symbol, pos in sim_trader.positions.items():
            print(f"   {symbol}: {pos['qty']} shares @ ${pos.get('avg_price', 0):.2f}")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Smart Investment AI Trading System")
    parser.add_argument("--mode", choices=["advisory", "trade", "view"], 
                       help="Operating mode")
    parser.add_argument("--live", action="store_true",
                       help="Use live trading (default is paper)")
    parser.add_argument("--capital", type=float, default=100000,
                       help="Investment capital (default: 100000)")
    parser.add_argument("--max-position", type=float, default=0.20,
                       help="Max position size as decimal (default: 0.20)")
    parser.add_argument("--no-confirm", action="store_true",
                       help="Skip trade confirmation (dangerous!)")
    
    args = parser.parse_args()
    
    if args.mode is None:
        # Interactive mode
        interactive_mode()
    elif args.mode == "advisory":
        banner()
        advisory_mode(capital=args.capital, max_position=args.max_position)
    elif args.mode == "trade":
        banner()
        if args.live:
            live_trade_mode()
        else:
            paper_trade_mode()
    elif args.mode == "view":
        banner()
        view_portfolio()


if __name__ == "__main__":
    main()
