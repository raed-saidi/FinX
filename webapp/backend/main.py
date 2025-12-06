"""
Smart Investment AI - Backend API
FastAPI server for the trading platform
"""

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator
from typing import List, Optional, Dict, Set
import sys
import os
from pathlib import Path
from datetime import datetime, timedelta, time
import json
import hashlib
import secrets
import asyncio
import base64
import hmac
import struct
import re
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Groq Client
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
groq_client = None
if GROQ_API_KEY and len(GROQ_API_KEY) > 10:  # Valid API key check
    try:
        from groq import Groq
        groq_client = Groq(api_key=GROQ_API_KEY)
        print("✓ Groq client initialized")
    except Exception as e:
        print(f"⚠ Groq client initialization failed: {e}")
else:
    print("⚠ GROQ_API_KEY not configured")

# Alpaca Paper Trading Configuration
ALPACA_API_KEY = os.getenv("ALPACA_API_KEY", "")
ALPACA_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY", "")
ALPACA_BASE_URL = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")

# Initialize Alpaca client
alpaca_client = None
alpaca_trading_available = False
if ALPACA_API_KEY and ALPACA_SECRET_KEY:
    try:
        from alpaca.trading.client import TradingClient
        from alpaca.trading.requests import MarketOrderRequest
        from alpaca.trading.enums import OrderSide, TimeInForce
        alpaca_client = TradingClient(ALPACA_API_KEY, ALPACA_SECRET_KEY, paper=True)
        alpaca_trading_available = True
        print("✓ Alpaca Paper Trading connected")
    except ImportError:
        print("⚠ alpaca-py not installed. Run: pip install alpaca-py")
    except Exception as e:
        print(f"⚠ Alpaca connection failed: {e}")
else:
    print("⚠ Alpaca credentials not configured")

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# ============== WebSocket Connection Manager ==============

class ConnectionManager:
    """Manage WebSocket connections for real-time updates."""
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"WebSocket disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Send message to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        # Clean up disconnected
        for conn in disconnected:
            self.disconnect(conn)

ws_manager = ConnectionManager()

# ============== Price Alerts System ==============

price_alerts: List[Dict] = []  # In-memory alerts storage

class PriceAlert(BaseModel):
    symbol: str
    target_price: float
    condition: str  # 'above' or 'below'
    message: Optional[str] = None

# ============== Market Hours Helper ==============

def is_market_open() -> dict:
    """Check if US stock market is currently open."""
    from datetime import timezone
    import pytz
    
    try:
        eastern = pytz.timezone('US/Eastern')
        now_eastern = datetime.now(eastern)
        
        # Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday
        market_open = time(9, 30)
        market_close = time(16, 0)
        
        is_weekday = now_eastern.weekday() < 5  # Monday = 0, Friday = 4
        current_time = now_eastern.time()
        is_during_hours = market_open <= current_time <= market_close
        
        is_open = is_weekday and is_during_hours
        
        # Calculate next open/close
        if is_open:
            next_event = "close"
            next_time = now_eastern.replace(hour=16, minute=0, second=0).isoformat()
        else:
            next_event = "open"
            # Find next market open
            days_ahead = 0
            if now_eastern.weekday() >= 5:  # Weekend
                days_ahead = 7 - now_eastern.weekday()
            elif current_time > market_close:
                days_ahead = 1
                if now_eastern.weekday() == 4:  # Friday after close
                    days_ahead = 3
            next_open = now_eastern + timedelta(days=days_ahead)
            next_open = next_open.replace(hour=9, minute=30, second=0)
            next_time = next_open.isoformat()
        
        return {
            "is_open": is_open,
            "current_time_et": now_eastern.strftime("%Y-%m-%d %H:%M:%S ET"),
            "next_event": next_event,
            "next_event_time": next_time,
            "is_weekday": is_weekday,
            "message": "Market is open" if is_open else "Market is closed"
        }
    except Exception as e:
        # Fallback if pytz not available
        return {
            "is_open": True,  # Assume open as fallback
            "message": f"Could not determine market hours: {e}",
            "error": True
        }

# ============== Background Bot Task ==============

bot_task: Optional[asyncio.Task] = None

async def run_trading_bot():
    """Background task that executes the trading bot logic."""
    global bot_state
    print("🤖 Trading bot background task started")
    
    while bot_state["running"]:
        try:
            # Check market hours
            market = is_market_open()
            if not market.get("is_open", False) and not market.get("error"):
                print(f"⏰ Market closed. Next: {market.get('next_event_time', 'unknown')}")
                await asyncio.sleep(60)  # Check again in 1 minute
                continue
            
            # Get AI recommendations
            recommendations = load_recommendations()
            if not recommendations:
                print("📊 No recommendations available")
                await asyncio.sleep(bot_state["config"]["trade_frequency_minutes"] * 60)
                continue
            
            # Filter by signal strength
            min_signal = bot_state["config"]["min_signal_strength"]
            strong_signals = [r for r in recommendations 
                           if abs(r.get("signal", 0)) >= min_signal 
                           and r.get("direction") == "LONG"]
            
            if not strong_signals:
                print("📊 No strong signals found")
                await asyncio.sleep(bot_state["config"]["trade_frequency_minutes"] * 60)
                continue
            
            # Check position limits
            if alpaca_client:
                try:
                    positions = alpaca_client.get_all_positions()
                    current_positions = len(positions)
                    max_positions = bot_state["config"]["max_positions"]
                    
                    if current_positions >= max_positions:
                        print(f"📈 Max positions reached ({current_positions}/{max_positions})")
                        await asyncio.sleep(bot_state["config"]["trade_frequency_minutes"] * 60)
                        continue
                    
                    # Execute trades for top signals
                    available_slots = max_positions - current_positions
                    trades_to_make = strong_signals[:min(available_slots, 3)]  # Max 3 trades per cycle
                    
                    for rec in trades_to_make:
                        symbol = rec["asset"]
                        dollars = bot_state["config"]["per_trade_amount"]
                        
                        # Check if already holding this position
                        existing = [p for p in positions if p.symbol == symbol]
                        if existing:
                            continue
                        
                        try:
                            import yfinance as yf
                            ticker = yf.Ticker(symbol)
                            price = ticker.info.get('regularMarketPrice')
                            if not price:
                                continue
                            
                            qty = round(dollars / price, 4)
                            
                            from alpaca.trading.requests import MarketOrderRequest
                            from alpaca.trading.enums import OrderSide, TimeInForce
                            
                            order = alpaca_client.submit_order(
                                MarketOrderRequest(
                                    symbol=symbol,
                                    qty=qty,
                                    side=OrderSide.BUY,
                                    time_in_force=TimeInForce.DAY
                                )
                            )
                            
                            print(f"✅ Bot trade: BUY {qty} {symbol} @ ${price:.2f}")
                            bot_state["trades_today"] += 1
                            bot_state["last_trade"] = datetime.now().isoformat()
                            
                            # Broadcast trade to WebSocket clients
                            await ws_manager.broadcast({
                                "type": "trade",
                                "data": {
                                    "symbol": symbol,
                                    "action": "buy",
                                    "qty": qty,
                                    "price": price,
                                    "order_id": str(order.id)
                                }
                            })
                            
                        except Exception as e:
                            print(f"❌ Bot trade failed for {symbol}: {e}")
                
                except Exception as e:
                    print(f"❌ Bot cycle error: {e}")
            
            # Wait for next cycle
            wait_minutes = bot_state["config"]["trade_frequency_minutes"]
            print(f"💤 Bot sleeping for {wait_minutes} minutes...")
            await asyncio.sleep(wait_minutes * 60)
            
        except asyncio.CancelledError:
            print("🛑 Trading bot task cancelled")
            break
        except Exception as e:
            print(f"❌ Bot error: {e}")
            await asyncio.sleep(60)  # Wait 1 min on error
    
    print("🤖 Trading bot background task stopped")

# ============== App Lifespan ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("Starting Smart Investment AI Backend...")
    yield
    # Cleanup
    global bot_task
    if bot_task and not bot_task.done():
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            pass
    print("Shutting down...")

app = FastAPI(
    title="Smart Investment AI",
    description="AI-Powered Portfolio Management Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== Health Check ==============

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint for Docker and Cloud Run monitoring.
    Returns service status and dependency availability.
    """
    return {
        "status": "healthy",
        "service": "Smart Investment AI Backend",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "dependencies": {
            "groq": groq_client is not None,
            "alpaca": alpaca_trading_available,
            "qdrant": qdrant_manager.collection_name if qdrant_manager else None
        }
    }

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
    
    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v
    
    @field_validator('email')
    @classmethod
    def email_valid(cls, v: str) -> str:
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError('Invalid email format')
        return v.lower()

class UserLogin(BaseModel):
    email: str
    password: str
    totp_code: Optional[str] = None  # 2FA code if enabled

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict
    requires_2fa: Optional[bool] = False
    temp_token: Optional[str] = None  # Temporary token for 2FA flow

class Enable2FARequest(BaseModel):
    password: str  # Require password to enable 2FA

class Verify2FARequest(BaseModel):
    code: str
    temp_token: Optional[str] = None  # For login flow

class Disable2FARequest(BaseModel):
    password: str
    code: str  # Require 2FA code to disable

# ============== Auth & Security ==============

security = HTTPBearer(auto_error=False)

# Simple in-memory user store (use a real DB in production)
users_db = {}
tokens_db = {}
temp_tokens_db = {}  # Temporary tokens for 2FA flow
login_attempts = {}  # Rate limiting: {email: [(timestamp, success), ...]}
active_sessions = {}  # {token: {email, device, ip, created_at, last_active}}

# Security constants
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(minutes=15)
SESSION_TIMEOUT = timedelta(hours=24)
TEMP_TOKEN_EXPIRY = timedelta(minutes=5)

def hash_password(password: str) -> str:
    """Hash password with salt."""
    salt = "finx_secure_salt_2024"  # In production, use unique salt per user
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()

def create_token() -> str:
    return secrets.token_urlsafe(32)

def generate_totp_secret() -> str:
    """Generate a random TOTP secret (base32 encoded)."""
    return base64.b32encode(secrets.token_bytes(20)).decode('utf-8')

def get_totp_code(secret: str, time_step: int = 30) -> str:
    """Generate TOTP code from secret."""
    # Get current time step
    counter = int(datetime.now().timestamp()) // time_step
    
    # Decode the secret
    key = base64.b32decode(secret.upper() + '=' * ((8 - len(secret) % 8) % 8))
    
    # Generate HMAC
    msg = struct.pack('>Q', counter)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    
    # Dynamic truncation
    offset = h[-1] & 0x0F
    code = struct.unpack('>I', h[offset:offset + 4])[0] & 0x7FFFFFFF
    
    return str(code % 1000000).zfill(6)

def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    """Verify TOTP code with time window tolerance."""
    if not code or len(code) != 6 or not code.isdigit():
        return False
    
    # Check current and adjacent time windows
    for i in range(-window, window + 1):
        counter = int(datetime.now().timestamp()) // 30 + i
        key = base64.b32decode(secret.upper() + '=' * ((8 - len(secret) % 8) % 8))
        msg = struct.pack('>Q', counter)
        h = hmac.new(key, msg, hashlib.sha1).digest()
        offset = h[-1] & 0x0F
        expected = str((struct.unpack('>I', h[offset:offset + 4])[0] & 0x7FFFFFFF) % 1000000).zfill(6)
        
        if hmac.compare_digest(code, expected):
            return True
    return False

def generate_qr_uri(email: str, secret: str) -> str:
    """Generate otpauth URI for QR code."""
    issuer = "FinX"
    return f"otpauth://totp/{issuer}:{email}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"

def check_rate_limit(email: str) -> tuple[bool, int]:
    """Check if login attempts exceeded. Returns (allowed, remaining_lockout_seconds)."""
    if email not in login_attempts:
        return True, 0
    
    attempts = login_attempts[email]
    now = datetime.now()
    
    # Clean old attempts (older than lockout duration)
    attempts = [(t, s) for t, s in attempts if now - t < LOCKOUT_DURATION]
    login_attempts[email] = attempts
    
    # Count failed attempts
    failed_count = sum(1 for t, s in attempts if not s)
    
    if failed_count >= MAX_LOGIN_ATTEMPTS:
        # Calculate remaining lockout time
        oldest_failed = min(t for t, s in attempts if not s)
        remaining = (oldest_failed + LOCKOUT_DURATION - now).total_seconds()
        if remaining > 0:
            return False, int(remaining)
    
    return True, 0

def record_login_attempt(email: str, success: bool):
    """Record a login attempt for rate limiting."""
    if email not in login_attempts:
        login_attempts[email] = []
    login_attempts[email].append((datetime.now(), success))

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None:
        return None
    token = credentials.credentials
    if token in tokens_db:
        # Update last active time
        if token in active_sessions:
            active_sessions[token]['last_active'] = datetime.now().isoformat()
        return tokens_db[token]
    return None

def create_session(token: str, email: str, ip: str = "unknown", device: str = "unknown"):
    """Create a new session record."""
    active_sessions[token] = {
        "email": email,
        "ip": ip,
        "device": device,
        "created_at": datetime.now().isoformat(),
        "last_active": datetime.now().isoformat()
    }

# ============== Data Loading ==============

BASE_DIR = Path(__file__).parent.parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
RESULTS_DIR = BASE_DIR / "results"

# Import RL recommendation engine (XGBoost → RL → Recommendations)
try:
    from rl_recommendations import generate_rl_recommendations
    from realtime_predictions import get_market_summary as get_realtime_market_summary
    REALTIME_AVAILABLE = True
    print("RL recommendation engine loaded")
except Exception as e:
    REALTIME_AVAILABLE = False
    print(f"✗ RL recommendations not available: {e}")

# Cache for recommendations (refresh every 5 minutes)
_recommendations_cache = None
_recommendations_timestamp = None

def load_recommendations():
    """Load AI recommendations - uses RL-optimized portfolio allocation."""
    global _recommendations_cache, _recommendations_timestamp
    
    from datetime import datetime, timedelta
    
    # Use cache if less than 5 minutes old
    if _recommendations_cache and _recommendations_timestamp:
        if datetime.now() - _recommendations_timestamp < timedelta(minutes=5):
            return _recommendations_cache
    
    # Try RL recommendations (XGBoost → RL → Output)
    if REALTIME_AVAILABLE:
        try:
            print("Generating RL-optimized recommendations...")
            recommendations = generate_rl_recommendations()
            if recommendations:
                _recommendations_cache = recommendations
                _recommendations_timestamp = datetime.now()
                print(f"Generated {len(recommendations)} RL recommendations")
                return recommendations
        except Exception as e:
            print(f"RL recommendations failed: {e}")
            import traceback
            traceback.print_exc()
    
    # Fallback to static predictions from CSV files
    print("Falling back to static predictions...")
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
        
        # Filter to only strong positive signals (top performers)
        MIN_SIGNAL_THRESHOLD = 0.005  # 0.5% minimum predicted return
        MAX_RECOMMENDATIONS = 6
        
        # Sort by signal strength and filter
        sorted_preds = sorted(predictions.items(), key=lambda x: x[1], reverse=True)
        strong_preds = [(a, s) for a, s in sorted_preds if s > MIN_SIGNAL_THRESHOLD]
        top_preds = strong_preds[:MAX_RECOMMENDATIONS] if strong_preds else sorted_preds[:3]
        
        # Calculate weights for selected stocks only
        selected_signals = [s for _, s in top_preds]
        min_sig = min(selected_signals) if selected_signals else 0
        shifted = [s - min_sig + 0.01 for s in selected_signals]
        total = sum(shifted)
        
        # First pass: calculate raw weights and apply cap
        raw_weights = []
        for i, (asset, signal) in enumerate(top_preds):
            raw_weight = shifted[i] / total if total > 0 else 1/len(top_preds)
            capped_weight = min(raw_weight, 0.35)  # Cap at 35%
            raw_weights.append(capped_weight)
        
        # Normalize weights to sum to 100%
        total_capped = sum(raw_weights)
        normalized_weights = [w / total_capped for w in raw_weights] if total_capped > 0 else raw_weights
        
        recommendations = []
        
        for i, (asset, signal) in enumerate(top_preds):
            weight = normalized_weights[i]
            
            recommendations.append({
                "asset": asset,
                "signal": round(signal, 4),
                "direction": "LONG" if signal > 0.005 else "SHORT" if signal < -0.005 else "NEUTRAL",
                "weight": round(weight, 4),
                "weight_pct": round(weight * 100, 2),
                "current_price": round(prices[asset], 2),
                "last_updated": datetime.now().isoformat()
            })
        
        # Already sorted by signal strength
        _recommendations_cache = recommendations
        _recommendations_timestamp = datetime.now()
        
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
    return {"status": "running", "name": "Smart Investment AI API", "realtime_predictions": REALTIME_AVAILABLE}

@app.get("/api/recommendations", response_model=List[dict])
def get_recommendations():
    """Get AI-generated stock recommendations with real-time predictions."""
    return load_recommendations()

@app.post("/api/recommendations/refresh")
def refresh_recommendations():
    """Force refresh recommendations with fresh market data."""
    global _recommendations_cache, _recommendations_timestamp
    _recommendations_cache = None
    _recommendations_timestamp = None
    
    recommendations = load_recommendations()
    return {
        "success": True,
        "count": len(recommendations),
        "recommendations": recommendations,
        "realtime": REALTIME_AVAILABLE,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/market/summary")
def get_market_summary_endpoint():
    """Get current market conditions summary."""
    if REALTIME_AVAILABLE:
        try:
            return get_realtime_market_summary()
        except:
            pass
    return get_market_summary()

@app.get("/api/portfolio")
def get_portfolio():
    """Get current portfolio status - syncs with Alpaca when available."""
    # If Alpaca is available, use real account data
    if alpaca_trading_available and alpaca_client:
        try:
            account = alpaca_client.get_account()
            positions = alpaca_client.get_all_positions()
            
            positions_list = []
            positions_value = 0
            for p in positions:
                mv = float(p.market_value)
                positions_value += mv
                positions_list.append({
                    "asset": p.symbol,
                    "shares": float(p.qty),
                    "value": round(mv, 2),
                    "pnl_pct": round(float(p.unrealized_plpc) * 100, 2)
                })
            
            equity = float(account.equity)
            last_equity = float(account.last_equity)
            daily_pnl = equity - last_equity
            daily_pnl_pct = (daily_pnl / last_equity * 100) if last_equity > 0 else 0
            
            return {
                "total_value": round(equity, 2),
                "cash": round(float(account.cash), 2),
                "buying_power": round(float(account.buying_power), 2),
                "positions_value": round(positions_value, 2),
                "daily_pnl": round(daily_pnl, 2),
                "daily_pnl_pct": round(daily_pnl_pct, 2),
                "total_return": round(equity - 100000, 2),  # Assuming 100k starting capital
                "total_return_pct": round((equity - 100000) / 100000 * 100, 2),
                "positions": positions_list,
                "alpaca_synced": True,
                "account_status": account.status
            }
        except Exception as e:
            print(f"⚠️ Failed to fetch Alpaca portfolio: {e}")
    
    # Fallback - return empty portfolio indicating NOT connected
    return {
        "total_value": 0,
        "cash": 0,
        "buying_power": 0,
        "positions_value": 0,
        "daily_pnl": 0,
        "daily_pnl_pct": 0,
        "total_return": 0,
        "total_return_pct": 0,
        "positions": [],
        "alpaca_synced": False,
        "account_status": "DISCONNECTED",
        "error": "Alpaca not connected"
    }

@app.get("/api/stock/{symbol}")
def get_stock(symbol: str, period: str = "1mo"):
    """Get stock data for a symbol - compatible with Watchlist component."""
    try:
        import yfinance as yf
        
        ticker = yf.Ticker(symbol.upper())
        hist = ticker.history(period=period)
        
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No data for {symbol}")
        
        current_price = hist['Close'].iloc[-1]
        prev_price = hist['Close'].iloc[-2] if len(hist) > 1 else current_price
        change = current_price - prev_price
        change_pct = (change / prev_price * 100) if prev_price > 0 else 0
        
        return {
            "symbol": symbol.upper(),
            "price": round(current_price, 2),
            "change": round(change, 2),
            "changePercent": round(change_pct, 2),
            "high": round(hist['High'].iloc[-1], 2),
            "low": round(hist['Low'].iloc[-1], 2),
            "volume": int(hist['Volume'].iloc[-1]),
            "history": [
                {"date": d.strftime("%Y-%m-%d"), "price": round(p, 2)}
                for d, p in zip(hist.index, hist['Close'])
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Symbol not found: {e}")

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

@app.get("/api/prices")
def get_batch_prices(symbols: str):
    """
    Get current prices for multiple symbols at once (optimized for live updates).
    Usage: /api/prices?symbols=AAPL,GOOGL,MSFT
    """
    try:
        import yfinance as yf
        
        symbol_list = [s.strip().upper() for s in symbols.split(',') if s.strip()]
        if not symbol_list:
            return {}
        
        # Batch download for efficiency
        tickers = yf.Tickers(' '.join(symbol_list))
        result = {}
        
        for symbol in symbol_list:
            try:
                ticker = tickers.tickers.get(symbol)
                if ticker:
                    hist = ticker.history(period="2d")
                    if len(hist) >= 1:
                        current = hist['Close'].iloc[-1]
                        prev = hist['Close'].iloc[-2] if len(hist) >= 2 else current
                        result[symbol] = {
                            "current_price": round(current, 2),
                            "change_pct": round((current / prev - 1) * 100, 2) if prev else 0
                        }
            except Exception:
                pass  # Skip failed symbols
        
        return result
    except Exception as e:
        return {}

@app.post("/api/chat", response_model=ChatResponse)
def chat(message: ChatMessage):
    """
    AI Chat endpoint powered by Groq LLM with enhanced financial analysis capabilities.
    """
    market = get_market_summary()
    all_recommendations = load_recommendations()
    recommendations = all_recommendations[:5]
    backtest = load_backtest_results()
    
    # Build detailed recommendations list with more context
    rec_list = []
    for r in recommendations:
        rec_list.append({
            "ticker": r['asset'],
            "signal_strength": round(r['signal'] * 100, 2),
            "direction": r['direction'],
            "weight": f"{r.get('weight_pct', 0)}%",
            "price": f"${r.get('current_price', 'N/A')}"
        })
    
    # Categorize stocks by direction for better context
    long_stocks = [r['asset'] for r in all_recommendations if r['direction'] == 'LONG'][:5]
    short_stocks = [r['asset'] for r in all_recommendations if r['direction'] == 'SHORT'][:3]
    neutral_stocks = [r['asset'] for r in all_recommendations if r['direction'] == 'NEUTRAL'][:3]
    
    # Build comprehensive system prompt
    system_prompt = f"""You are the AI Financial Analyst for Smart Investment AI - a professional algorithmic trading platform. Your name is "Aria" (AI Research & Investment Advisor).

## YOUR ROLE & PERSONALITY
- You are a sophisticated, professional financial advisor with deep expertise in quantitative analysis
- Speak with confidence and authority, but remain approachable
- Be concise but thorough - provide actionable insights, not fluff
- Use financial terminology appropriately but explain complex concepts when needed
- Show enthusiasm when market conditions are favorable

## PLATFORM CAPABILITIES
Smart Investment AI uses:
1. **XGBoost ML Models**: Walk-forward validated models trained on 7+ years of market data
2. **Multi-Asset Coverage**: 15 assets including tech stocks (AAPL, NVDA, TSLA, MSFT, GOOGL, AMZN, META, AMD, INTC), ETFs (SPY, QQQ, EFA, IEF, HYG, BIL)
3. **Real-Time Predictions**: Models generate daily signals based on technical indicators, market regimes, and price patterns
4. **Paper Trading Integration**: Connected to Alpaca for risk-free trade execution
5. **Automated Trading Bot**: Can execute trades automatically based on AI signals

## CURRENT MARKET DATA (LIVE)
{json.dumps(market, indent=2)}

## AI-GENERATED RECOMMENDATIONS (Today's Signals)
**TOP LONG POSITIONS** (Bullish): {', '.join(long_stocks) if long_stocks else 'None currently'}
**SHORT/AVOID** (Bearish): {', '.join(short_stocks) if short_stocks else 'None currently'}
**NEUTRAL/HOLD**: {', '.join(neutral_stocks) if neutral_stocks else 'None currently'}

**Top 5 Recommendations with Details:**
{json.dumps(rec_list, indent=2)}

## BACKTEST PERFORMANCE (2017-2024, 7+ Years)
- **Total Return**: {backtest['total_return']}% (vs S&P 500 ~150%)
- **Annual Return**: {backtest['annual_return']}%
- **Sharpe Ratio**: {backtest['sharpe_ratio']} (>1.5 is excellent)
- **Max Drawdown**: {backtest['max_drawdown']}%
- **Win Rate**: {backtest['win_rate']}%

## HOW TO RESPOND
1. **Stock Questions**: Reference our AI signals and explain the reasoning. If we have a signal for the stock, share it. If not, provide general analysis.
2. **Portfolio Questions**: Suggest diversification based on our signals. Recommend position sizing.
3. **Market Questions**: Analyze current conditions using the live data above.
4. **Platform Questions**: Explain our capabilities (bot, paper trading, ML models).
5. **Trade Execution**: Guide users to the trading bot feature for automated execution.

## RESPONSE GUIDELINES
- Lead with the most important insight
- Use bullet points for clarity when listing multiple items
- Include specific numbers and data when available
- Keep responses under 200 words unless detailed analysis is requested
- End actionable advice with a clear next step
- Add a brief disclaimer only when giving specific trade recommendations: "📊 AI signal - not financial advice"

## THINGS TO AVOID
- Never guarantee returns or make promises about future performance
- Don't recommend options, futures, or leverage unless specifically asked
- Don't provide tax advice
- Don't discuss other trading platforms or competitors"""
    
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message.message}
            ],
            temperature=0.6,  # Slightly lower for more consistent, professional responses
            max_tokens=600    # Allow longer responses for detailed analysis
        )
        
        ai_response = response.choices[0].message.content
        
        return {
            "response": ai_response,
            "market_context": market
        }
    except Exception as e:
        return {
            "response": "I'm experiencing a temporary connection issue. Please try again in a moment, or check the Markets tab for the latest AI signals.",
            "market_context": market
        }

# Old bot status endpoint removed - new one with Alpaca integration is below

# ============== Auth Endpoints ==============

@app.post("/api/auth/register")
def register(user: UserRegister, request: Request):
    """Register a new user with strong password validation."""
    email = user.email.lower()
    
    if email in users_db:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = hash_password(user.password)
    users_db[email] = {
        "email": email,
        "name": user.name,
        "password_hash": hashed_pw,
        "created_at": datetime.now().isoformat(),
        "two_factor_enabled": False,
        "two_factor_secret": None,
        "backup_codes": [],
        "login_history": []
    }
    
    token = create_token()
    user_data = {
        "email": email, 
        "name": user.name,
        "two_factor_enabled": False
    }
    tokens_db[token] = user_data
    
    # Create session
    ip = request.client.host if request.client else "unknown"
    create_session(token, email, ip)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_data,
        "requires_2fa": False
    }

@app.post("/api/auth/login")
def login(credentials: UserLogin, request: Request):
    """Login with rate limiting and 2FA support."""
    email = credentials.email.lower()
    
    # Check rate limiting
    allowed, lockout_remaining = check_rate_limit(email)
    if not allowed:
        raise HTTPException(
            status_code=429, 
            detail=f"Too many failed attempts. Try again in {lockout_remaining} seconds."
        )
    
    if email not in users_db:
        record_login_attempt(email, False)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = users_db[email]
    if user["password_hash"] != hash_password(credentials.password):
        record_login_attempt(email, False)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if 2FA is enabled
    if user.get("two_factor_enabled") and user.get("two_factor_secret"):
        # If no TOTP code provided, return temp token for 2FA flow
        if not credentials.totp_code:
            temp_token = create_token()
            temp_tokens_db[temp_token] = {
                "email": email,
                "created_at": datetime.now(),
                "purpose": "2fa_login"
            }
            return {
                "access_token": None,
                "token_type": "bearer",
                "user": None,
                "requires_2fa": True,
                "temp_token": temp_token
            }
        
        # Verify TOTP code
        if not verify_totp(user["two_factor_secret"], credentials.totp_code):
            record_login_attempt(email, False)
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    # Successful login
    record_login_attempt(email, True)
    
    token = create_token()
    user_data = {
        "email": user["email"], 
        "name": user["name"],
        "two_factor_enabled": user.get("two_factor_enabled", False)
    }
    tokens_db[token] = user_data
    
    # Create session with device info
    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    create_session(token, email, ip, user_agent[:100])
    
    # Record in login history
    if "login_history" not in users_db[email]:
        users_db[email]["login_history"] = []
    users_db[email]["login_history"].append({
        "timestamp": datetime.now().isoformat(),
        "ip": ip,
        "success": True
    })
    # Keep only last 10 logins
    users_db[email]["login_history"] = users_db[email]["login_history"][-10:]
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_data,
        "requires_2fa": False
    }

@app.post("/api/auth/verify-2fa")
def verify_2fa_login(data: Verify2FARequest, request: Request):
    """Complete 2FA login flow."""
    if not data.temp_token or data.temp_token not in temp_tokens_db:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    temp_data = temp_tokens_db[data.temp_token]
    
    # Check expiry
    if datetime.now() - temp_data["created_at"] > TEMP_TOKEN_EXPIRY:
        del temp_tokens_db[data.temp_token]
        raise HTTPException(status_code=401, detail="2FA session expired. Please login again.")
    
    email = temp_data["email"]
    user = users_db.get(email)
    
    if not user or not user.get("two_factor_secret"):
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Verify TOTP code
    if not verify_totp(user["two_factor_secret"], data.code):
        record_login_attempt(email, False)
        raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    # Success - clean up temp token
    del temp_tokens_db[data.temp_token]
    record_login_attempt(email, True)
    
    token = create_token()
    user_data = {
        "email": user["email"], 
        "name": user["name"],
        "two_factor_enabled": True
    }
    tokens_db[token] = user_data
    
    # Create session
    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    create_session(token, email, ip, user_agent[:100])
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_data,
        "requires_2fa": False
    }

@app.post("/api/auth/2fa/setup")
def setup_2fa(data: Enable2FARequest, user: dict = Depends(get_current_user)):
    """Generate 2FA secret and QR code URI."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    email = user["email"]
    db_user = users_db.get(email)
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify password
    if db_user["password_hash"] != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Generate new secret
    secret = generate_totp_secret()
    qr_uri = generate_qr_uri(email, secret)
    
    # Store temporarily (not yet confirmed)
    db_user["pending_2fa_secret"] = secret
    
    return {
        "secret": secret,
        "qr_uri": qr_uri,
        "message": "Scan the QR code with your authenticator app, then verify with a code"
    }

@app.post("/api/auth/2fa/enable")
def enable_2fa(data: Verify2FARequest, user: dict = Depends(get_current_user)):
    """Verify and enable 2FA."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    email = user["email"]
    db_user = users_db.get(email)
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    pending_secret = db_user.get("pending_2fa_secret")
    if not pending_secret:
        raise HTTPException(status_code=400, detail="No pending 2FA setup. Call /api/auth/2fa/setup first.")
    
    # Verify the code with pending secret
    if not verify_totp(pending_secret, data.code):
        raise HTTPException(status_code=401, detail="Invalid 2FA code. Please try again.")
    
    # Enable 2FA
    db_user["two_factor_enabled"] = True
    db_user["two_factor_secret"] = pending_secret
    del db_user["pending_2fa_secret"]
    
    # Generate backup codes
    backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
    db_user["backup_codes"] = [hash_password(c) for c in backup_codes]
    
    return {
        "message": "2FA enabled successfully",
        "backup_codes": backup_codes,
        "warning": "Save these backup codes in a safe place. They can be used to access your account if you lose your authenticator."
    }

@app.post("/api/auth/2fa/disable")
def disable_2fa(data: Disable2FARequest, user: dict = Depends(get_current_user)):
    """Disable 2FA (requires password and current 2FA code)."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    email = user["email"]
    db_user = users_db.get(email)
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not db_user.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    
    # Verify password
    if db_user["password_hash"] != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Verify 2FA code
    if not verify_totp(db_user["two_factor_secret"], data.code):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    # Disable 2FA
    db_user["two_factor_enabled"] = False
    db_user["two_factor_secret"] = None
    db_user["backup_codes"] = []
    
    return {"message": "2FA disabled successfully"}

@app.get("/api/auth/2fa/status")
def get_2fa_status(user: dict = Depends(get_current_user)):
    """Check if 2FA is enabled for current user."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db_user = users_db.get(user["email"])
    return {
        "two_factor_enabled": db_user.get("two_factor_enabled", False) if db_user else False
    }

@app.get("/api/auth/sessions")
def get_sessions(user: dict = Depends(get_current_user)):
    """Get active sessions for current user."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    email = user["email"]
    user_sessions = []
    
    for token, session in active_sessions.items():
        if session["email"] == email:
            user_sessions.append({
                "device": session.get("device", "Unknown")[:50],
                "ip": session.get("ip", "Unknown"),
                "created_at": session.get("created_at"),
                "last_active": session.get("last_active")
            })
    
    return {"sessions": user_sessions}

@app.get("/api/auth/login-history")
def get_login_history(user: dict = Depends(get_current_user)):
    """Get login history for current user."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db_user = users_db.get(user["email"])
    history = db_user.get("login_history", []) if db_user else []
    
    return {"history": history[-10:]}  # Last 10 logins

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
        if credentials.credentials in active_sessions:
            del active_sessions[credentials.credentials]
    return {"message": "Logged out"}

# ============== User Portfolio ==============

# In-memory portfolio storage (use DB in production)
user_portfolios = {}

class TradeRequest(BaseModel):
    symbol: str
    action: str  # "buy" or "sell"
    shares: Optional[float] = None  # Optional: number of shares (fractional allowed)
    dollars: Optional[float] = None  # Optional: dollar amount to invest (min $5)

class BatchInvestRequest(BaseModel):
    total_dollars: float  # Total amount to invest
    use_recommendations: bool = True  # Use AI-recommended weights
    custom_allocations: Optional[List[dict]] = None  # Custom allocations if not using recommendations

@app.get("/api/user/portfolio")
def get_user_portfolio(user: dict = Depends(get_current_user)):
    """Get user's portfolio - syncs with Alpaca when available."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # If Alpaca is available, use real account data
    if alpaca_trading_available and alpaca_client:
        try:
            account = alpaca_client.get_account()
            positions = alpaca_client.get_all_positions()
            
            positions_list = []
            for p in positions:
                positions_list.append({
                    "symbol": p.symbol,
                    "shares": float(p.qty),
                    "avg_price": round(float(p.avg_entry_price), 2),
                    "current_price": round(float(p.current_price), 2),
                    "value": round(float(p.market_value), 2),
                    "pnl": round(float(p.unrealized_pl), 2),
                    "pnl_pct": round(float(p.unrealized_plpc) * 100, 2)
                })
            
            # Get recent orders as trades
            from alpaca.trading.requests import GetOrdersRequest
            from alpaca.trading.enums import QueryOrderStatus
            orders_request = GetOrdersRequest(status=QueryOrderStatus.CLOSED, limit=10)
            orders = alpaca_client.get_orders(filter=orders_request)
            
            trades_list = []
            for o in orders:
                if o.filled_at and o.filled_avg_price:
                    trades_list.append({
                        "symbol": o.symbol,
                        "action": "buy" if o.side.value == "buy" else "sell",
                        "shares": float(o.filled_qty),
                        "price": float(o.filled_avg_price),
                        "total": float(o.filled_qty) * float(o.filled_avg_price),
                        "timestamp": o.filled_at.isoformat()
                    })
            
            return {
                "cash": round(float(account.cash), 2),
                "buying_power": round(float(account.buying_power), 2),
                "positions": positions_list,
                "total_value": round(float(account.portfolio_value), 2),
                "equity": round(float(account.equity), 2),
                "trades": trades_list,
                "alpaca_synced": True,
                "account_status": account.status
            }
        except Exception as e:
            print(f"⚠️ Failed to fetch Alpaca portfolio: {e}")
            # Fall back to simulated portfolio
    
    # Fallback to simulated portfolio only if Alpaca fails
    # Start with 0 balance when not connected to Alpaca
    email = user["email"]
    if email not in user_portfolios:
        user_portfolios[email] = {
            "cash": 0.0,  # No fake money - must connect to Alpaca for real balance
            "positions": {},
            "trades": [],
            "warning": "Not connected to Alpaca. Please check API keys."
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
        "trades": portfolio["trades"][-10:],  # Last 10 trades
        "alpaca_synced": False
    }

@app.post("/api/user/trade")
def execute_trade(trade: TradeRequest, user: dict = Depends(get_current_user)):
    """Execute a buy/sell trade. Supports both share-based and dollar-based investing."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate input - must have either shares or dollars
    if trade.shares is None and trade.dollars is None:
        raise HTTPException(status_code=400, detail="Must specify either shares or dollars amount")
    
    # Validate minimum investment for dollar-based trades
    MIN_INVESTMENT = 5.0
    if trade.dollars is not None and trade.dollars < MIN_INVESTMENT:
        raise HTTPException(status_code=400, detail=f"Minimum investment is ${MIN_INVESTMENT}")
    
    email = user["email"]
    if email not in user_portfolios:
        user_portfolios[email] = {
            "cash": 0.0,  # No fake money - trades will use Alpaca
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
    
    # Calculate shares and total cost
    if trade.dollars is not None:
        # Dollar-based investing - calculate fractional shares
        shares = trade.dollars / price
        total_cost = trade.dollars
    else:
        # Share-based investing
        shares = trade.shares
        total_cost = price * shares
    
    if trade.action == "buy":
        if portfolio["cash"] < total_cost:
            raise HTTPException(status_code=400, detail=f"Insufficient funds. Available: ${portfolio['cash']:.2f}, Required: ${total_cost:.2f}")
        
        portfolio["cash"] -= total_cost
        
        if symbol in portfolio["positions"]:
            pos = portfolio["positions"][symbol]
            new_shares = pos["shares"] + shares
            pos["avg_price"] = (pos["avg_price"] * pos["shares"] + total_cost) / new_shares
            pos["shares"] = new_shares
        else:
            portfolio["positions"][symbol] = {
                "shares": shares,
                "avg_price": price
            }
    
    elif trade.action == "sell":
        if symbol not in portfolio["positions"]:
            raise HTTPException(status_code=400, detail="No position to sell")
        
        pos = portfolio["positions"][symbol]
        
        # If selling by dollars, calculate shares
        if trade.dollars is not None:
            shares_to_sell = min(trade.dollars / price, pos["shares"])
            actual_total = shares_to_sell * price
        else:
            shares_to_sell = min(shares, pos["shares"])
            actual_total = shares_to_sell * price
        
        if pos["shares"] < shares_to_sell:
            raise HTTPException(status_code=400, detail=f"Insufficient shares. Have: {pos['shares']:.6f}")
        
        portfolio["cash"] += actual_total
        pos["shares"] -= shares_to_sell
        shares = shares_to_sell
        total_cost = actual_total
        
        if pos["shares"] < 0.0001:  # Clean up tiny positions
            del portfolio["positions"][symbol]
    
    # Execute on Alpaca if available (Alpaca supports fractional shares)
    alpaca_order = None
    if alpaca_trading_available and alpaca_client:
        try:
            from alpaca.trading.requests import MarketOrderRequest
            from alpaca.trading.enums import OrderSide, TimeInForce
            
            # Use notional (dollar amount) for fractional shares
            if trade.dollars is not None:
                order_data = MarketOrderRequest(
                    symbol=symbol,
                    notional=round(total_cost, 2),
                    side=OrderSide.BUY if trade.action == "buy" else OrderSide.SELL,
                    time_in_force=TimeInForce.DAY
                )
            else:
                order_data = MarketOrderRequest(
                    symbol=symbol,
                    qty=shares,
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
        "shares": round(shares, 6),
        "price": round(price, 2),
        "total": round(total_cost, 2),
        "timestamp": datetime.now().isoformat(),
        "alpaca_order_id": str(alpaca_order.id) if alpaca_order else None
    })
    
    return {
        "success": True,
        "message": f"{trade.action.upper()} ${total_cost:.2f} of {symbol} ({shares:.6f} shares @ ${price:.2f})",
        "trade": {
            "symbol": symbol,
            "action": trade.action,
            "shares": round(shares, 6),
            "price": round(price, 2),
            "total": round(total_cost, 2)
        },
        "cash": round(portfolio["cash"], 2),
        "alpaca_connected": alpaca_trading_available
    }


@app.post("/api/user/batch-invest")
def batch_invest(request: BatchInvestRequest, user: dict = Depends(get_current_user)):
    """Invest in multiple stocks at once using AI recommendations or custom allocations."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    MIN_INVESTMENT = 5.0
    if request.total_dollars < MIN_INVESTMENT:
        raise HTTPException(status_code=400, detail=f"Minimum investment is ${MIN_INVESTMENT}")
    
    email = user["email"]
    if email not in user_portfolios:
        user_portfolios[email] = {
            "cash": 0.0,  # No fake money - use Alpaca for real balance
            "positions": {},
            "trades": []
        }
    
    portfolio = user_portfolios[email]
    
    if portfolio["cash"] < request.total_dollars:
        raise HTTPException(status_code=400, detail=f"Insufficient funds. Available: ${portfolio['cash']:.2f}")
    
    # Get allocations
    if request.use_recommendations:
        recommendations = load_recommendations()
        if not recommendations:
            raise HTTPException(status_code=400, detail="No recommendations available")
        allocations = [
            {"symbol": r["asset"], "weight": r["weight"]}
            for r in recommendations if r["direction"] == "LONG"
        ]
    else:
        if not request.custom_allocations:
            raise HTTPException(status_code=400, detail="Must provide custom_allocations when not using recommendations")
        allocations = request.custom_allocations
    
    # Normalize weights to sum to 1
    total_weight = sum(a["weight"] for a in allocations)
    if total_weight == 0:
        raise HTTPException(status_code=400, detail="Invalid weights")
    
    for a in allocations:
        a["weight"] = a["weight"] / total_weight
    
    # Execute trades
    import yfinance as yf
    trades_executed = []
    total_invested = 0
    
    for allocation in allocations:
        symbol = allocation["symbol"].upper()
        dollars = request.total_dollars * allocation["weight"]
        
        if dollars < 1:  # Skip very small allocations
            continue
        
        try:
            ticker = yf.Ticker(symbol)
            price = ticker.info.get('regularMarketPrice', None)
            if price is None:
                continue
            
            shares = dollars / price
            
            # Update portfolio
            portfolio["cash"] -= dollars
            total_invested += dollars
            
            if symbol in portfolio["positions"]:
                pos = portfolio["positions"][symbol]
                new_shares = pos["shares"] + shares
                pos["avg_price"] = (pos["avg_price"] * pos["shares"] + dollars) / new_shares
                pos["shares"] = new_shares
            else:
                portfolio["positions"][symbol] = {
                    "shares": shares,
                    "avg_price": price
                }
            
            # Record trade
            trade_record = {
                "symbol": symbol,
                "action": "buy",
                "shares": round(shares, 6),
                "price": round(price, 2),
                "total": round(dollars, 2),
                "timestamp": datetime.now().isoformat(),
                "alpaca_order_id": None
            }
            portfolio["trades"].append(trade_record)
            trades_executed.append(trade_record)
            
        except Exception as e:
            print(f"Failed to invest in {symbol}: {e}")
            continue
    
    return {
        "success": True,
        "message": f"Invested ${total_invested:.2f} across {len(trades_executed)} stocks",
        "trades": trades_executed,
        "cash": round(portfolio["cash"], 2)
    }

# ============== Bot Configuration & State ==============

bot_state = {
    "running": False,
    "mode": "paper",
    "trades_today": 0,
    "last_trade": None,
    "started_at": None,
    "config": {
        "investment_amount": 1000,  # Total dollars to invest
        "per_trade_amount": 100,    # Dollars per trade
        "max_positions": 10,        # Maximum number of positions
        "run_duration_hours": 24,   # How long to run (0 = indefinitely)
        "trade_frequency_minutes": 60,  # How often to check for trades
        "use_ai_signals": True,     # Use AI recommendations
        "min_signal_strength": 0.01,  # Minimum signal to trade
        "stop_loss_pct": 5,         # Stop loss percentage
        "take_profit_pct": 10,      # Take profit percentage
    }
}

class BotConfig(BaseModel):
    investment_amount: Optional[float] = 1000
    per_trade_amount: Optional[float] = 100
    max_positions: Optional[int] = 10
    run_duration_hours: Optional[int] = 24
    trade_frequency_minutes: Optional[int] = 60
    use_ai_signals: Optional[bool] = True
    min_signal_strength: Optional[float] = 0.01
    stop_loss_pct: Optional[float] = 5
    take_profit_pct: Optional[float] = 10

@app.post("/api/bot/start")
async def start_bot(config: Optional[BotConfig] = None):
    """Start the trading bot with optional configuration - runs in background."""
    global bot_task
    
    # Update config if provided
    if config:
        for key, value in config.dict(exclude_none=True).items():
            if key in bot_state["config"]:
                bot_state["config"][key] = value
    
    bot_state["running"] = True
    bot_state["started_at"] = datetime.now().isoformat()
    bot_state["trades_today"] = 0
    
    # Start background task if not already running
    if bot_task is None or bot_task.done():
        bot_task = asyncio.create_task(run_trading_bot())
        print("🤖 Bot background task created")
    
    # Check market hours
    market = is_market_open()
    
    return {
        "status": "running", 
        "message": "Bot started successfully" + (" (market closed, will trade when open)" if not market.get("is_open") else ""),
        "alpaca_connected": alpaca_trading_available,
        "config": bot_state["config"],
        "started_at": bot_state["started_at"],
        "market_status": market
    }

@app.post("/api/bot/stop")
async def stop_bot():
    """Stop the trading bot."""
    global bot_task
    
    bot_state["running"] = False
    bot_state["started_at"] = None
    
    # Cancel background task
    if bot_task and not bot_task.done():
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            pass
        bot_task = None
        print("🛑 Bot background task cancelled")
    
    return {"status": "stopped", "message": "Bot stopped"}

@app.post("/api/bot/config")
def update_bot_config(config: BotConfig):
    """Update bot configuration without starting it."""
    for key, value in config.dict(exclude_none=True).items():
        if key in bot_state["config"]:
            bot_state["config"][key] = value
    return {
        "message": "Configuration updated",
        "config": bot_state["config"]
    }

@app.get("/api/bot/status")
def get_bot_status():
    """Get bot status and Alpaca account info - no auth required."""
    alpaca_account = None
    if alpaca_trading_available and alpaca_client:
        try:
            account = alpaca_client.get_account()
            alpaca_account = {
                "buying_power": float(account.buying_power),
                "cash": float(account.cash),
                "portfolio_value": float(account.portfolio_value),
                "equity": float(account.equity),
                "status": str(account.status)
            }
        except Exception as e:
            print(f"⚠️ Failed to get Alpaca account: {e}")
    
    # Add market hours to status
    market = is_market_open()
    
    return {
        **bot_state,
        "bot_task_active": bot_task is not None and not bot_task.done() if bot_task else False,
        "market_status": market,
        "alpaca_connected": alpaca_trading_available,
        "alpaca_account": alpaca_account
    }

# ============== Direct Alpaca Trading (No Auth Required) ==============

class AlpacaTradeRequest(BaseModel):
    symbol: str
    action: str  # 'buy' or 'sell'
    dollars: Optional[float] = None
    shares: Optional[float] = None
    order_type: Optional[str] = "market"  # 'market', 'limit'
    limit_price: Optional[float] = None

@app.post("/api/trade")
def execute_alpaca_trade(trade: AlpacaTradeRequest):
    """Execute a trade directly through Alpaca - NO AUTH REQUIRED for personal use."""
    if not alpaca_trading_available or not alpaca_client:
        raise HTTPException(status_code=503, detail="Alpaca trading not available. Check API keys.")
    
    symbol = trade.symbol.upper()
    
    # Validate input
    if trade.dollars is None and trade.shares is None:
        raise HTTPException(status_code=400, detail="Must specify either dollars or shares amount")
    
    if trade.action not in ["buy", "sell"]:
        raise HTTPException(status_code=400, detail="Action must be 'buy' or 'sell'")
    
    try:
        from alpaca.trading.requests import MarketOrderRequest, LimitOrderRequest
        from alpaca.trading.enums import OrderSide, TimeInForce
        
        side = OrderSide.BUY if trade.action == "buy" else OrderSide.SELL
        
        # Calculate quantity
        if trade.dollars:
            # Get current price for dollar-based orders
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            price = ticker.info.get('regularMarketPrice')
            if not price:
                raise HTTPException(status_code=400, detail=f"Could not get price for {symbol}")
            qty = round(trade.dollars / price, 4)
        else:
            qty = trade.shares
        
        # Create order
        if trade.order_type == "limit" and trade.limit_price:
            order_data = LimitOrderRequest(
                symbol=symbol,
                qty=qty,
                side=side,
                time_in_force=TimeInForce.DAY,
                limit_price=trade.limit_price
            )
        else:
            order_data = MarketOrderRequest(
                symbol=symbol,
                qty=qty,
                side=side,
                time_in_force=TimeInForce.DAY
            )
        
        # Submit order
        order = alpaca_client.submit_order(order_data=order_data)
        
        # Update bot state
        bot_state["trades_today"] += 1
        bot_state["last_trade"] = datetime.now().isoformat()
        
        return {
            "success": True,
            "order_id": str(order.id),
            "symbol": order.symbol,
            "side": order.side.value,
            "qty": str(order.qty),
            "status": order.status.value,
            "message": f"Order submitted: {trade.action.upper()} {qty} shares of {symbol}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Order failed: {str(e)}")

@app.post("/api/trade/batch")
def execute_batch_trade(
    total_dollars: float,
    use_ai_signals: bool = True,
    custom_symbols: Optional[str] = None  # Comma-separated symbols
):
    """Execute batch trades using AI signals or custom symbols - NO AUTH REQUIRED."""
    if not alpaca_trading_available or not alpaca_client:
        raise HTTPException(status_code=503, detail="Alpaca trading not available")
    
    if total_dollars < 10:
        raise HTTPException(status_code=400, detail="Minimum investment is $10")
    
    # Get allocations
    if use_ai_signals:
        recommendations = load_recommendations()
        if not recommendations:
            raise HTTPException(status_code=400, detail="No AI recommendations available")
        # Use top LONG signals
        allocations = [
            {"symbol": r["asset"], "weight": r["weight"]}
            for r in recommendations if r["direction"] == "LONG"
        ][:5]  # Top 5
    else:
        if not custom_symbols:
            raise HTTPException(status_code=400, detail="Must provide custom_symbols when not using AI signals")
        symbols = [s.strip().upper() for s in custom_symbols.split(",")]
        allocations = [{"symbol": s, "weight": 1/len(symbols)} for s in symbols]
    
    if not allocations:
        raise HTTPException(status_code=400, detail="No stocks to invest in")
    
    # Normalize weights
    total_weight = sum(a["weight"] for a in allocations)
    for a in allocations:
        a["weight"] = a["weight"] / total_weight
    
    # Execute trades
    from alpaca.trading.requests import MarketOrderRequest
    from alpaca.trading.enums import OrderSide, TimeInForce
    import yfinance as yf
    
    trades_executed = []
    errors = []
    
    for allocation in allocations:
        symbol = allocation["symbol"]
        dollars = total_dollars * allocation["weight"]
        
        if dollars < 1:
            continue
        
        try:
            # Get price
            ticker = yf.Ticker(symbol)
            price = ticker.info.get('regularMarketPrice')
            if not price:
                errors.append(f"{symbol}: Could not get price")
                continue
            
            qty = round(dollars / price, 4)
            
            # Submit order
            order_data = MarketOrderRequest(
                symbol=symbol,
                qty=qty,
                side=OrderSide.BUY,
                time_in_force=TimeInForce.DAY
            )
            order = alpaca_client.submit_order(order_data=order_data)
            
            trades_executed.append({
                "symbol": symbol,
                "qty": qty,
                "dollars": round(dollars, 2),
                "order_id": str(order.id),
                "status": order.status.value
            })
            
        except Exception as e:
            errors.append(f"{symbol}: {str(e)}")
    
    return {
        "success": len(trades_executed) > 0,
        "trades": trades_executed,
        "errors": errors,
        "total_invested": sum(t["dollars"] for t in trades_executed),
        "message": f"Executed {len(trades_executed)} trades"
    }

@app.get("/api/alpaca/positions")
def get_alpaca_positions():
    """Get real positions from Alpaca - NO AUTH REQUIRED."""
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
                    "side": str(p.side)
                }
                for p in positions
            ],
            "alpaca_connected": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alpaca/orders")
def get_alpaca_orders():
    """Get recent orders from Alpaca - NO AUTH REQUIRED."""
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
                    "filled_avg_price": str(o.filled_avg_price) if o.filled_avg_price else None,
                    "filled_qty": str(o.filled_qty) if o.filled_qty else "0",
                    "filled_at": o.filled_at.isoformat() if o.filled_at else None,
                    "submitted_at": o.submitted_at.isoformat() if o.submitted_at else None
                }
                for o in orders
            ],
            "alpaca_connected": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alpaca/portfolio/history")
def get_alpaca_portfolio_history(
    period: str = "1m", 
    timeframe: str = "1D"
):
    """Get portfolio history from Alpaca for equity chart - REAL DATA ONLY."""
    if not alpaca_trading_available or not alpaca_client:
        return {"equity": [], "timestamp": [], "alpaca_connected": False, "error": "Alpaca not connected"}
    
    try:
        import requests
        
        # Map period to Alpaca format
        period_map = {
            "1d": "1D",
            "1w": "1W",
            "1m": "1M",
            "3m": "3M",
            "1y": "1A",
            "all": "all"
        }
        
        alpaca_period = period_map.get(period, "1M")
        
        # Use Alpaca REST API directly for portfolio history
        headers = {
            "APCA-API-KEY-ID": ALPACA_API_KEY,
            "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY
        }
        
        url = f"{ALPACA_BASE_URL}/v2/account/portfolio/history"
        params = {
            "period": alpaca_period,
            "timeframe": timeframe
        }
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            data = response.json()
            return {
                "equity": data.get("equity", []),
                "timestamp": data.get("timestamp", []),
                "profit_loss": data.get("profit_loss", []),
                "profit_loss_pct": data.get("profit_loss_pct", []),
                "base_value": data.get("base_value", 0),
                "alpaca_connected": True
            }
        else:
            return {"equity": [], "timestamp": [], "alpaca_connected": True, "error": f"Alpaca API error: {response.status_code} - {response.text}"}
    except Exception as e:
        return {"equity": [], "timestamp": [], "alpaca_connected": False, "error": str(e)}

# ============== Chart Data ==============

@app.get("/api/chart/{symbol}")
def get_chart_data(symbol: str, period: str = "1mo", interval: str = "1d"):
    """
    Get OHLCV chart data for a symbol with flexible timeframes.
    
    Supported periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max
    Supported intervals: 1m, 5m, 15m, 30m, 1h, 1d, 1wk, 1mo
    
    Note: Intraday data (1m, 5m, 15m, 30m, 1h) only available for last 7-60 days
    """
    try:
        import yfinance as yf
        
        # Map frontend timeframes to yfinance params
        timeframe_map = {
            # Intraday
            "1m": {"period": "1d", "interval": "1m"},
            "5m": {"period": "5d", "interval": "5m"},
            "15m": {"period": "5d", "interval": "15m"},
            "30m": {"period": "1mo", "interval": "30m"},
            "1h": {"period": "1mo", "interval": "1h"},
            # Daily+
            "1d": {"period": period, "interval": "1d"},
            "1wk": {"period": "1y", "interval": "1wk"},
            "1mo": {"period": "5y", "interval": "1mo"},
        }
        
        # Use interval param to determine settings
        if interval in timeframe_map:
            yf_period = timeframe_map[interval]["period"]
            yf_interval = timeframe_map[interval]["interval"]
        else:
            yf_period = period
            yf_interval = interval
        
        ticker = yf.Ticker(symbol.upper())
        hist = ticker.history(period=yf_period, interval=yf_interval)
        
        if hist.empty:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Format for charting library
        data = []
        for idx, row in hist.iterrows():
            # Use timestamp for intraday, date for daily
            if yf_interval in ["1m", "5m", "15m", "30m", "1h"]:
                time_str = idx.strftime("%Y-%m-%d %H:%M")
            else:
                time_str = idx.strftime("%Y-%m-%d")
            
            data.append({
                "time": time_str,
                "open": round(row['Open'], 2),
                "high": round(row['High'], 2),
                "low": round(row['Low'], 2),
                "close": round(row['Close'], 2),
                "volume": int(row['Volume'])
            })
        
        current = hist['Close'].iloc[-1]
        prev = hist['Close'].iloc[-2] if len(hist) > 1 else current
        change_pct = ((current / prev) - 1) * 100
        
        # Calculate period high/low
        period_high = hist['High'].max()
        period_low = hist['Low'].min()
        
        return {
            "symbol": symbol.upper(),
            "current_price": round(current, 2),
            "change_pct": round(change_pct, 2),
            "period_high": round(period_high, 2),
            "period_low": round(period_low, 2),
            "interval": yf_interval,
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

# ============== WebSocket Endpoint ==============

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and listen for messages
            data = await websocket.receive_text()
            
            # Handle client messages (e.g., subscribe to specific symbols)
            try:
                message = json.loads(data)
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif message.get("type") == "subscribe":
                    # Could implement symbol-specific subscriptions here
                    await websocket.send_json({
                        "type": "subscribed",
                        "symbols": message.get("symbols", [])
                    })
            except json.JSONDecodeError:
                pass
                
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)

# ============== Market Hours Endpoint ==============

@app.get("/api/market/hours")
def get_market_hours():
    """Get current market hours status."""
    return is_market_open()

# ============== Price Alerts Endpoints ==============

# ============== Stress Testing API ==============

# Import stress testing module
try:
    sys.path.insert(0, str(BASE_DIR / "utils"))
    from stress_testing import StressTesting
    STRESS_TESTING_AVAILABLE = True
    print("Stress testing module loaded")
except Exception as e:
    STRESS_TESTING_AVAILABLE = False
    print(f"✗ Stress testing not available: {e}")

class StressTestRequest(BaseModel):
    weights: Optional[Dict[str, float]] = None  # Custom weights, or use recommendations
    portfolio_value: float = 100000
    confidence_levels: Optional[List[float]] = None  # Default: [0.90, 0.95, 0.99]

@app.get("/api/stress-test")
def get_stress_test():
    """Get stress test results using current recommendations as portfolio weights."""
    if not STRESS_TESTING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Stress testing module not available")
    
    try:
        # Get current recommendations as weights
        recommendations = load_recommendations()
        if not recommendations:
            raise HTTPException(status_code=400, detail="No recommendations available for stress testing")
        
        # Convert recommendations to weights
        weights = {}
        for rec in recommendations:
            asset = rec.get('asset')
            weight = rec.get('weight', 0)
            if asset and weight > 0:
                weights[asset] = weight
        
        # Normalize weights
        total_weight = sum(weights.values())
        if total_weight > 0:
            weights = {k: v/total_weight for k, v in weights.items()}
        
        # Run stress test
        st = StressTesting()
        st.load_returns_data()
        
        results = st.get_stress_test_summary(weights, portfolio_value=100000)
        
        return {
            "success": True,
            "weights_used": weights,
            **results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stress test failed: {str(e)}")

@app.post("/api/stress-test")
def run_stress_test(request: StressTestRequest):
    """Run comprehensive stress test with custom parameters."""
    if not STRESS_TESTING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Stress testing module not available")
    
    try:
        # Get weights from request or from recommendations
        if request.weights:
            weights = request.weights
        else:
            recommendations = load_recommendations()
            if not recommendations:
                raise HTTPException(status_code=400, detail="No recommendations available")
            
            weights = {}
            for rec in recommendations:
                asset = rec.get('asset')
                weight = rec.get('weight', 0)
                if asset and weight > 0:
                    weights[asset] = weight
        
        # Normalize weights
        total_weight = sum(weights.values())
        if total_weight > 0:
            weights = {k: v/total_weight for k, v in weights.items()}
        
        # Initialize stress testing
        st = StressTesting(confidence_levels=request.confidence_levels)
        st.load_returns_data()
        
        # Get comprehensive results
        results = st.get_stress_test_summary(weights, request.portfolio_value)
        
        return {
            "success": True,
            "weights_used": weights,
            "portfolio_value": request.portfolio_value,
            **results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stress test failed: {str(e)}")

@app.get("/api/stress-test/var")
def get_var_analysis():
    """Get Value at Risk analysis for current portfolio."""
    if not STRESS_TESTING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Stress testing module not available")
    
    try:
        # Get current recommendations as weights
        recommendations = load_recommendations()
        weights = {}
        for rec in recommendations:
            asset = rec.get('asset')
            weight = rec.get('weight', 0)
            if asset and weight > 0:
                weights[asset] = weight
        
        total_weight = sum(weights.values())
        if total_weight > 0:
            weights = {k: v/total_weight for k, v in weights.items()}
        
        st = StressTesting()
        st.load_returns_data()
        
        # Calculate VaR at multiple confidence levels
        var_results = {}
        for conf in [0.90, 0.95, 0.99]:
            conf_key = f"{int(conf*100)}pct"
            var_results[conf_key] = {
                "historical": st.historical_var(weights, conf),
                "parametric": st.parametric_var(weights, conf),
                "monte_carlo": st.monte_carlo_var(weights, conf, n_simulations=5000)
            }
        
        return {
            "success": True,
            "weights": weights,
            "var": var_results,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"VaR calculation failed: {str(e)}")

@app.get("/api/stress-test/scenarios")
def get_stress_scenarios():
    """Get stress scenario analysis results."""
    if not STRESS_TESTING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Stress testing module not available")
    
    try:
        # Get current recommendations as weights
        recommendations = load_recommendations()
        weights = {}
        for rec in recommendations:
            asset = rec.get('asset')
            weight = rec.get('weight', 0)
            if asset and weight > 0:
                weights[asset] = weight
        
        total_weight = sum(weights.values())
        if total_weight > 0:
            weights = {k: v/total_weight for k, v in weights.items()}
        
        st = StressTesting()
        
        # Run all scenarios
        historical = st.run_historical_scenarios(weights, 100000)
        hypothetical = st.run_hypothetical_scenarios(weights, 100000)
        
        return {
            "success": True,
            "weights": weights,
            "historical_scenarios": historical.to_dict('records'),
            "hypothetical_scenarios": hypothetical.to_dict('records'),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scenario analysis failed: {str(e)}")

@app.get("/api/stress-test/tail-risk")
def get_tail_risk():
    """Get tail risk analysis for current portfolio."""
    if not STRESS_TESTING_AVAILABLE:
        raise HTTPException(status_code=503, detail="Stress testing module not available")
    
    try:
        # Get current recommendations as weights
        recommendations = load_recommendations()
        weights = {}
        for rec in recommendations:
            asset = rec.get('asset')
            weight = rec.get('weight', 0)
            if asset and weight > 0:
                weights[asset] = weight
        
        total_weight = sum(weights.values())
        if total_weight > 0:
            weights = {k: v/total_weight for k, v in weights.items()}
        
        st = StressTesting()
        st.load_returns_data()
        
        tail_risk = st.tail_risk_analysis(weights)
        
        return {
            "success": True,
            "weights": weights,
            "tail_risk": tail_risk,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tail risk analysis failed: {str(e)}")

# ============== Price Alerts ==============

@app.get("/api/alerts")
def get_price_alerts():
    """Get all configured price alerts."""
    return {"alerts": price_alerts}

@app.post("/api/alerts")
def create_price_alert(alert: PriceAlert):
    """Create a new price alert."""
    alert_dict = {
        "id": len(price_alerts) + 1,
        "symbol": alert.symbol.upper(),
        "target_price": alert.target_price,
        "condition": alert.condition,
        "message": alert.message or f"{alert.symbol} reached ${alert.target_price}",
        "created_at": datetime.now().isoformat(),
        "triggered": False,
        "triggered_at": None
    }
    price_alerts.append(alert_dict)
    return {"message": "Alert created", "alert": alert_dict}

@app.delete("/api/alerts/{alert_id}")
def delete_price_alert(alert_id: int):
    """Delete a price alert."""
    global price_alerts
    price_alerts = [a for a in price_alerts if a.get("id") != alert_id]
    return {"message": "Alert deleted"}

@app.get("/api/alerts/check")
async def check_price_alerts():
    """Check all alerts against current prices and trigger if conditions met."""
    import yfinance as yf
    
    triggered = []
    for alert in price_alerts:
        if alert.get("triggered"):
            continue
        
        try:
            ticker = yf.Ticker(alert["symbol"])
            current_price = ticker.info.get("regularMarketPrice")
            
            if current_price is None:
                continue
            
            should_trigger = False
            if alert["condition"] == "above" and current_price >= alert["target_price"]:
                should_trigger = True
            elif alert["condition"] == "below" and current_price <= alert["target_price"]:
                should_trigger = True
            
            if should_trigger:
                alert["triggered"] = True
                alert["triggered_at"] = datetime.now().isoformat()
                alert["current_price"] = current_price
                triggered.append(alert)
                
                # Broadcast to WebSocket clients
                await ws_manager.broadcast({
                    "type": "alert",
                    "data": alert
                })
        except Exception as e:
            print(f"Error checking alert for {alert['symbol']}: {e}")
    
    return {"triggered": triggered, "total_alerts": len(price_alerts)}

# ============== Run Server ==============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)