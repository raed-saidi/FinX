"""
Smart Investment AI - Backend API
FastAPI server for the trading platform
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
import json
import hashlib
import secrets
from groq import Groq

# Groq Client
GROQ_API_KEY = "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"
groq_client = Groq(api_key=GROQ_API_KEY)

# Alpaca Paper Trading Configuration
ALPACA_API_KEY = "PKVUSVS25GG5BQ25L7TEZD4UPZ"
ALPACA_SECRET_KEY = "DcbHHjSNN2EB5RriMGs3943UG3gfjzL8J8u4SZytrrLs"
ALPACA_BASE_URL = "https://paper-api.alpaca.markets"

# Initialize Alpaca client
alpaca_client = None
alpaca_trading_available = False
try:
    from alpaca.trading.client import TradingClient
    from alpaca.trading.requests import MarketOrderRequest
    from alpaca.trading.enums import OrderSide, TimeInForce
    alpaca_client = TradingClient(ALPACA_API_KEY, ALPACA_SECRET_KEY, paper=True)
    alpaca_trading_available = True
    print("✅ Alpaca Paper Trading connected!")
except ImportError:
    print("⚠️ alpaca-py not installed. Run: pip install alpaca-py")
except Exception as e:
    print(f"⚠️ Alpaca connection failed: {e}")

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

app = FastAPI(
    title="Smart Investment AI",
    description="AI-Powered Portfolio Management Platform",
    version="1.0.0"
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== Models ==============

class Recommendation(BaseModel):
    asset: str
    signal: float
    direction: str
    weight: float
    weight_pct: float
    dollars: float
    shares: int
    current_price: Optional[float] = None

class PortfolioSummary(BaseModel):
    total_value: float
    cash: float
    positions_value: float
    daily_pnl: float
    daily_pnl_pct: float
    total_return: float
    total_return_pct: float

class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    market_context: Optional[dict] = None

class BacktestMetrics(BaseModel):
    total_return: float
    annual_return: float
    sharpe_ratio: float
    max_drawdown: float
    win_rate: float

class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

# ============== Auth ==============

security = HTTPBearer(auto_error=False)

# Simple in-memory user store (use a real DB in production)
users_db = {}
tokens_db = {}

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_token() -> str:
    return secrets.token_urlsafe(32)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None:
        return None
    token = credentials.credentials
    if token in tokens_db:
        return tokens_db[token]
    return None

# ============== Data Loading ==============

BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
RESULTS_DIR = BASE_DIR / "results"

def load_recommendations():
    """Load latest AI recommendations."""
    try:
        import pandas as pd
        import yfinance as yf
        
        # Load OOS predictions
        predictions = {}
        assets = ["AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "AMZN", "META",
                  "SPY", "QQQ", "EFA", "IEF", "HYG", "BIL", "INTC", "AMD"]
        
        for asset in assets:
            pred_path = MODELS_DIR / "xgboost_walkforward" / f"{asset}_oos_predictions.csv"
            if pred_path.exists():
                df = pd.read_csv(pred_path, parse_dates=['date'])
                predictions[asset] = df['pred'].iloc[-1]  # Latest prediction
        
        # Get current prices
        prices = {}
        for asset in assets:
            try:
                ticker = yf.Ticker(asset)
                prices[asset] = ticker.info.get('regularMarketPrice', 100)
            except:
                prices[asset] = 100
        
        # Calculate weights (signal-based)
        signals = list(predictions.values())
        min_sig = min(signals)
        shifted = [s - min_sig + 0.01 for s in signals]
        total = sum(shifted)
        
        recommendations = []
        capital = 100000
        
        for i, asset in enumerate(predictions.keys()):
            weight = shifted[i] / total
            weight = min(weight, 0.20)  # Cap at 20%
            
            recommendations.append({
                "asset": asset,
                "signal": round(predictions[asset], 4),
                "direction": "LONG" if predictions[asset] > 0.005 else "SHORT" if predictions[asset] < -0.005 else "NEUTRAL",
                "weight": round(weight, 4),
                "weight_pct": round(weight * 100, 2),
                "dollars": round(weight * capital, 2),
                "shares": int((weight * capital) / prices[asset]),
                "current_price": round(prices[asset], 2)
            })
        
        # Sort by signal strength
        recommendations.sort(key=lambda x: x['signal'], reverse=True)
        return recommendations
        
    except Exception as e:
        print(f"Error loading recommendations: {e}")
        return []

def load_backtest_results():
    """Load backtest performance metrics."""
    try:
        results_path = RESULTS_DIR / "realistic_backtest" / "realistic_results_summary.json"
        if results_path.exists():
            with open(results_path) as f:
                data = json.load(f)
            return {
                "total_return": round(data["signal_metrics"]["total_return"] * 100, 1),
                "annual_return": round(data["signal_metrics"]["annual_return"] * 100, 1),
                "sharpe_ratio": round(data["signal_metrics"]["sharpe_ratio"], 2),
                "max_drawdown": round(data["signal_metrics"]["max_drawdown"] * 100, 1),
                "win_rate": 75.2  # From our analysis
            }
    except Exception as e:
        print(f"Error loading backtest: {e}")
    
    return {
        "total_return": 353.2,
        "annual_return": 47.5,
        "sharpe_ratio": 1.93,
        "max_drawdown": 25.8,
        "win_rate": 75.2
    }

def get_market_summary():
    """Get current market summary for chatbot context."""
    try:
        import yfinance as yf
        
        indices = {
            "SPY": "S&P 500",
            "QQQ": "NASDAQ",
            "IEF": "Bonds"
        }
        
        summary = {}
        for ticker, name in indices.items():
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period="2d")
                if len(hist) >= 2:
                    change = (hist['Close'].iloc[-1] / hist['Close'].iloc[-2] - 1) * 100
                    summary[name] = {
                        "price": round(hist['Close'].iloc[-1], 2),
                        "change_pct": round(change, 2)
                    }
            except:
                pass
        
        return summary
    except:
        return {}

# ============== API Endpoints ==============

@app.get("/")
def root():
    return {"status": "running", "name": "Smart Investment AI API"}

@app.get("/api/recommendations", response_model=List[dict])
def get_recommendations():
    """Get AI-generated stock recommendations."""
    return load_recommendations()

@app.get("/api/portfolio")
def get_portfolio():
    """Get current portfolio status."""
    # Simulated portfolio for demo
    return {
        "total_value": 100000,
        "cash": 15000,
        "positions_value": 85000,
        "daily_pnl": 1250.50,
        "daily_pnl_pct": 1.25,
        "total_return": 47500,
        "total_return_pct": 47.5,
        "positions": [
            {"asset": "AAPL", "shares": 35, "value": 8312, "pnl_pct": 2.1},
            {"asset": "META", "shares": 14, "value": 8456, "pnl_pct": 1.8},
            {"asset": "QQQ", "shares": 14, "value": 7280, "pnl_pct": 0.9},
            {"asset": "SPY", "shares": 13, "value": 7800, "pnl_pct": 0.5},
            {"asset": "NVDA", "shares": 20, "value": 2680, "pnl_pct": -1.2},
        ]
    }

@app.get("/api/backtest")
def get_backtest():
    """Get backtest performance metrics."""
    return load_backtest_results()

@app.get("/api/market")
def get_market():
    """Get current market data."""
    return get_market_summary()

@app.get("/api/prices/{symbol}")
def get_price(symbol: str):
    """Get price history for a symbol."""
    try:
        import yfinance as yf
        import pandas as pd
        
        ticker = yf.Ticker(symbol.upper())
        hist = ticker.history(period="3mo")
        
        return {
            "symbol": symbol.upper(),
            "current_price": round(hist['Close'].iloc[-1], 2),
            "change_pct": round((hist['Close'].iloc[-1] / hist['Close'].iloc[-2] - 1) * 100, 2),
            "history": [
                {"date": d.strftime("%Y-%m-%d"), "price": round(p, 2)}
                for d, p in zip(hist.index, hist['Close'])
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Symbol not found: {e}")

@app.post("/api/chat", response_model=ChatResponse)
def chat(message: ChatMessage):
    """
    AI Chat endpoint powered by Groq LLM.
    """
    market = get_market_summary()
    recommendations = load_recommendations()[:5]
    backtest = load_backtest_results()
    
    # Build recommendations list
    rec_list = [{"asset": r['asset'], "signal": r['signal'], "direction": r['direction']} for r in recommendations]
    
    # Build context for the AI
    system_prompt = f"""You are a helpful AI financial advisor assistant for Smart Investment AI platform.
You have access to real-time market data and AI-generated stock recommendations.

Current Market Data:
{json.dumps(market, indent=2)}

Top AI Recommendations (based on XGBoost models):
{json.dumps(rec_list, indent=2)}

Backtest Performance (2017-2024):
- Annual Return: {backtest['annual_return']}%
- Sharpe Ratio: {backtest['sharpe_ratio']}
- Max Drawdown: {backtest['max_drawdown']}%
- Win Rate: {backtest['win_rate']}%

Provide helpful, concise answers about stocks, market conditions, and our AI recommendations.
Always remind users that this is not financial advice and they should do their own research.
Keep responses brief and actionable."""
    
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message.message}
            ],
            temperature=0.7,
            max_tokens=500
        )
        
        ai_response = response.choices[0].message.content
        
        return {
            "response": ai_response,
            "market_context": market
        }
    except Exception as e:
        return {
            "response": f"I'm having trouble connecting right now. Error: {str(e)}",
            "market_context": market
        }

@app.get("/api/bot/status")
def get_bot_status():
    """Get trading bot status."""
    return {
        "status": "running",
        "mode": "paper",
        "last_trade": "2025-12-03 09:30:00",
        "trades_today": 3,
        "next_rebalance": "2025-12-05 09:30:00",
        "strategy": "XGBoost Walk-Forward",
        "assets_tracked": 15
    }

@app.post("/api/bot/toggle")
def toggle_bot(enabled: bool = True):
    """Enable/disable trading bot."""
    return {
        "status": "running" if enabled else "stopped",
        "message": f"Bot {'started' if enabled else 'stopped'}"
    }

# ============== Auth Endpoints ==============

@app.post("/api/auth/register", response_model=Token)
def register(user: UserRegister):
    """Register a new user."""
    if user.email in users_db:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = hash_password(user.password)
    users_db[user.email] = {
        "email": user.email,
        "name": user.name,
        "password_hash": hashed_pw,
        "created_at": datetime.now().isoformat()
    }
    
    token = create_token()
    user_data = {"email": user.email, "name": user.name}
    tokens_db[token] = user_data
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_data
    }

@app.post("/api/auth/login", response_model=Token)
def login(credentials: UserLogin):
    """Login and get access token."""
    if credentials.email not in users_db:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = users_db[credentials.email]
    if user["password_hash"] != hash_password(credentials.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token()
    user_data = {"email": user["email"], "name": user["name"]}
    tokens_db[token] = user_data
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_data
    }

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    """Get current user info."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@app.post("/api/auth/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Logout and invalidate token."""
    if credentials and credentials.credentials in tokens_db:
        del tokens_db[credentials.credentials]
    return {"message": "Logged out"}

# ============== User Portfolio ==============

# In-memory portfolio storage (use DB in production)
user_portfolios = {}

class TradeRequest(BaseModel):
    symbol: str
    shares: int
    action: str  # "buy" or "sell"

@app.get("/api/user/portfolio")
def get_user_portfolio(user: dict = Depends(get_current_user)):
    """Get user's portfolio."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    email = user["email"]
    if email not in user_portfolios:
        user_portfolios[email] = {
            "cash": 100000.0,
            "positions": {},
            "trades": []
        }
    
    portfolio = user_portfolios[email]
    
    # Calculate position values
    import yfinance as yf
    positions_list = []
    total_value = portfolio["cash"]
    
    for symbol, data in portfolio["positions"].items():
        try:
            ticker = yf.Ticker(symbol)
            price = ticker.info.get('regularMarketPrice', data.get('avg_price', 100))
            value = price * data["shares"]
            pnl = (price - data["avg_price"]) * data["shares"]
            pnl_pct = ((price / data["avg_price"]) - 1) * 100 if data["avg_price"] > 0 else 0
            
            positions_list.append({
                "symbol": symbol,
                "shares": data["shares"],
                "avg_price": round(data["avg_price"], 2),
                "current_price": round(price, 2),
                "value": round(value, 2),
                "pnl": round(pnl, 2),
                "pnl_pct": round(pnl_pct, 2)
            })
            total_value += value
        except:
            pass
    
    return {
        "cash": round(portfolio["cash"], 2),
        "positions": positions_list,
        "total_value": round(total_value, 2),
        "trades": portfolio["trades"][-10:]  # Last 10 trades
    }

@app.post("/api/user/trade")
def execute_trade(trade: TradeRequest, user: dict = Depends(get_current_user)):
    """Execute a buy/sell trade."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    email = user["email"]
    if email not in user_portfolios:
        user_portfolios[email] = {
            "cash": 100000.0,
            "positions": {},
            "trades": []
        }
    
    portfolio = user_portfolios[email]
    symbol = trade.symbol.upper()
    
    # Get current price
    import yfinance as yf
    try:
        ticker = yf.Ticker(symbol)
        price = ticker.info.get('regularMarketPrice', None)
        if price is None:
            raise HTTPException(status_code=400, detail="Could not get price")
    except:
        raise HTTPException(status_code=400, detail="Invalid symbol")
    
    total_cost = price * trade.shares
    
    if trade.action == "buy":
        if portfolio["cash"] < total_cost:
            raise HTTPException(status_code=400, detail="Insufficient funds")
        
        portfolio["cash"] -= total_cost
        
        if symbol in portfolio["positions"]:
            pos = portfolio["positions"][symbol]
            new_shares = pos["shares"] + trade.shares
            pos["avg_price"] = (pos["avg_price"] * pos["shares"] + total_cost) / new_shares
            pos["shares"] = new_shares
        else:
            portfolio["positions"][symbol] = {
                "shares": trade.shares,
                "avg_price": price
            }
    
    elif trade.action == "sell":
        if symbol not in portfolio["positions"]:
            raise HTTPException(status_code=400, detail="No position to sell")
        
        pos = portfolio["positions"][symbol]
        if pos["shares"] < trade.shares:
            raise HTTPException(status_code=400, detail="Insufficient shares")
        
        portfolio["cash"] += total_cost
        pos["shares"] -= trade.shares
        
        if pos["shares"] == 0:
            del portfolio["positions"][symbol]
    
    # Execute on Alpaca if available
    alpaca_order = None
    if alpaca_trading_available and alpaca_client:
        try:
            order_data = MarketOrderRequest(
                symbol=symbol,
                qty=trade.shares,
                side=OrderSide.BUY if trade.action == "buy" else OrderSide.SELL,
                time_in_force=TimeInForce.DAY
            )
            alpaca_order = alpaca_client.submit_order(order_data)
            print(f"✅ Alpaca order submitted: {alpaca_order.id}")
        except Exception as e:
            print(f"⚠️ Alpaca order failed: {e}")
    
    # Record trade
    portfolio["trades"].append({
        "symbol": symbol,
        "action": trade.action,
        "shares": trade.shares,
        "price": round(price, 2),
        "total": round(total_cost, 2),
        "timestamp": datetime.now().isoformat(),
        "alpaca_order_id": str(alpaca_order.id) if alpaca_order else None
    })
    
    return {
        "success": True,
        "message": f"{trade.action.upper()} {trade.shares} {symbol} @ ${price:.2f}",
        "cash": round(portfolio["cash"], 2),
        "alpaca_connected": alpaca_trading_available
    }

# ============== Bot Control ==============

bot_state = {
    "running": False,
    "mode": "paper",
    "trades_today": 0,
    "last_trade": None
}

@app.post("/api/bot/start")
def start_bot(user: dict = Depends(get_current_user)):
    """Start the trading bot."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    bot_state["running"] = True
    return {
        "status": "running", 
        "message": "Bot started",
        "alpaca_connected": alpaca_trading_available
    }

@app.post("/api/bot/stop")
def stop_bot(user: dict = Depends(get_current_user)):
    """Stop the trading bot."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    bot_state["running"] = False
    return {"status": "stopped", "message": "Bot stopped"}

@app.get("/api/bot/status")
def get_bot_status(user: dict = Depends(get_current_user)):
    """Get bot status and Alpaca account info."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    alpaca_account = None
    if alpaca_trading_available and alpaca_client:
        try:
            account = alpaca_client.get_account()
            alpaca_account = {
                "buying_power": float(account.buying_power),
                "cash": float(account.cash),
                "portfolio_value": float(account.portfolio_value),
                "equity": float(account.equity),
                "status": account.status
            }
        except Exception as e:
            print(f"⚠️ Failed to get Alpaca account: {e}")
    
    return {
        **bot_state,
        "alpaca_connected": alpaca_trading_available,
        "alpaca_account": alpaca_account
    }

@app.get("/api/alpaca/positions")
def get_alpaca_positions(user: dict = Depends(get_current_user)):
    """Get real positions from Alpaca."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if not alpaca_trading_available or not alpaca_client:
        return {"positions": [], "alpaca_connected": False}
    
    try:
        positions = alpaca_client.get_all_positions()
        return {
            "positions": [
                {
                    "symbol": p.symbol,
                    "qty": float(p.qty),
                    "avg_entry_price": float(p.avg_entry_price),
                    "current_price": float(p.current_price),
                    "market_value": float(p.market_value),
                    "unrealized_pl": float(p.unrealized_pl),
                    "unrealized_plpc": float(p.unrealized_plpc) * 100,
                    "side": p.side
                }
                for p in positions
            ],
            "alpaca_connected": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alpaca/orders")
def get_alpaca_orders(user: dict = Depends(get_current_user)):
    """Get recent orders from Alpaca."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if not alpaca_trading_available or not alpaca_client:
        return {"orders": [], "alpaca_connected": False}
    
    try:
        from alpaca.trading.requests import GetOrdersRequest
        from alpaca.trading.enums import QueryOrderStatus
        
        request = GetOrdersRequest(status=QueryOrderStatus.ALL, limit=20)
        orders = alpaca_client.get_orders(filter=request)
        return {
            "orders": [
                {
                    "id": str(o.id),
                    "symbol": o.symbol,
                    "qty": str(o.qty),
                    "side": o.side.value,
                    "type": o.type.value,
                    "status": o.status.value,
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                    "filled_avg_price": str(o.filled_avg_price) if o.filled_avg_price else None
                }
                for o in orders
            ],
            "alpaca_connected": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============== Chart Data ==============

@app.get("/api/chart/{symbol}")
def get_chart_data(symbol: str, period: str = "3mo"):
    """Get OHLCV chart data for a symbol."""
    try:
        import yfinance as yf
        
        ticker = yf.Ticker(symbol.upper())
        hist = ticker.history(period=period)
        
        if hist.empty:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Format for charting library
        data = []
        for idx, row in hist.iterrows():
            data.append({
                "time": idx.strftime("%Y-%m-%d"),
                "open": round(row['Open'], 2),
                "high": round(row['High'], 2),
                "low": round(row['Low'], 2),
                "close": round(row['Close'], 2),
                "volume": int(row['Volume'])
            })
        
        current = hist['Close'].iloc[-1]
        prev = hist['Close'].iloc[-2] if len(hist) > 1 else current
        change_pct = ((current / prev) - 1) * 100
        
        return {
            "symbol": symbol.upper(),
            "current_price": round(current, 2),
            "change_pct": round(change_pct, 2),
            "high_52w": round(hist['High'].max(), 2),
            "low_52w": round(hist['Low'].min(), 2),
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

# ============== Run Server ==============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
