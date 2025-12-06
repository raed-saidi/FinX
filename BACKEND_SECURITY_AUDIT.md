# Backend Security Audit Report
**Date:** December 6, 2025  
**Project:** Odyssey - Smart Investment AI Platform  
**Backend Framework:** FastAPI + Python 3.10

---

## 📋 Executive Summary

**Total Files Audited:** 3 backend Python files  
**Critical Issues:** 🔴 8  
**High Issues:** 🟠 6  
**Medium Issues:** 🟡 4  
**Total Endpoints:** 47 API endpoints + 1 WebSocket

---

## 🗂️ Backend File Inventory

### 1. `webapp/backend/main.py` (2,510 lines)

**Purpose:** Main FastAPI application server - handles authentication, trading, portfolio management, AI chat, and real-time updates.

**Main Classes:**
- `ConnectionManager`: WebSocket connection pool for real-time updates
- `PriceAlert`: Pydantic model for price alert validation
- Multiple Pydantic models: `RegisterRequest`, `LoginRequest`, `TradeRequest`, `BatchInvestRequest`, etc.

**Key Functions:**
- **Authentication:**
  - `hash_password(password)` - SHA256 with static salt
  - `create_token()` - Generate 32-byte URL-safe tokens
  - `generate_totp_secret()` - Create TOTP 2FA secrets
  - `verify_totp(secret, code)` - Validate 2FA codes
  - `get_current_user(credentials)` - Bearer token authentication
  - `check_rate_limit(email)` - Brute-force protection (5 attempts, 15 min lockout)
  
- **Trading:**
  - `execute_trade()` - Alpaca paper trading integration
  - `run_trading_bot()` - Automated trading bot background task
  
- **Data:**
  - `load_recommendations()` - Load RL model recommendations
  - `generate_rl_recommendations()` - Real-time portfolio optimization

**Authentication/Authorization:**
- ✅ Bearer token authentication (`HTTPBearer`)
- ✅ 2FA/TOTP support with QR codes
- ✅ Rate limiting on login (5 attempts, 15 min lockout)
- ✅ Session tracking with IP/device info
- ❌ **CRITICAL:** In-memory storage (no persistence)
- ❌ **CRITICAL:** Static password salt for all users
- ❌ No role-based access control (RBAC)
- ❌ No refresh tokens (session timeout only)

**Endpoints/Routes (47 total):**

| Method | Path | Auth Required | Purpose |
|--------|------|---------------|---------|
| GET | `/health` | No | Health check |
| GET | `/` | No | API info |
| GET | `/api/recommendations` | No | AI portfolio recommendations |
| POST | `/api/recommendations/refresh` | No | Force refresh recommendations |
| GET | `/api/market/summary` | No | Market overview |
| GET | `/api/portfolio` | No | User portfolio data |
| GET | `/api/stock/{symbol}` | No | Single stock details |
| GET | `/api/backtest` | No | Backtesting results |
| GET | `/api/market` | No | Market status |
| GET | `/api/prices/{symbol}` | No | Historical prices (single) |
| GET | `/api/prices` | No | Multi-stock price data |
| POST | `/api/chat` | No | AI chat with Groq LLM |
| POST | `/api/auth/register` | No | User registration |
| POST | `/api/auth/login` | No | User login (email/password) |
| POST | `/api/auth/verify-2fa` | No | Verify 2FA code after login |
| POST | `/api/auth/2fa/setup` | Yes | Initialize 2FA setup |
| POST | `/api/auth/2fa/enable` | Yes | Enable 2FA with code verification |
| POST | `/api/auth/2fa/disable` | Yes | Disable 2FA (requires password + code) |
| GET | `/api/auth/2fa/status` | Yes | Check if 2FA enabled |
| GET | `/api/auth/sessions` | Yes | List active sessions |
| GET | `/api/auth/login-history` | Yes | Recent login history (last 10) |
| GET | `/api/auth/me` | Yes | Current user info |
| POST | `/api/auth/logout` | Yes | Logout (invalidate token) |
| GET | `/api/user/portfolio` | Yes | User-specific portfolio |
| POST | `/api/user/trade` | Yes | Execute trade for logged-in user |
| POST | `/api/user/batch-invest` | Yes | Batch investment (allocate % across stocks) |
| POST | `/api/bot/start` | Yes | Start automated trading bot |
| POST | `/api/bot/stop` | Yes | Stop trading bot |
| POST | `/api/bot/config` | Yes | Update bot configuration |
| GET | `/api/bot/status` | Yes | Bot status and statistics |
| POST | `/api/trade` | No | Execute trade (no auth) |
| POST | `/api/trade/batch` | No | Batch trade execution (no auth) |
| GET | `/api/alpaca/positions` | No | Alpaca account positions |
| GET | `/api/alpaca/orders` | No | Alpaca order history |
| GET | `/api/alpaca/portfolio/history` | No | Alpaca portfolio performance |
| GET | `/api/chart/{symbol}` | No | Chart data with technical indicators |
| WS | `/ws` | No | WebSocket for real-time updates |
| GET | `/api/market/hours` | No | Market hours and status |
| GET | `/api/stress-test` | No | Portfolio stress test results |
| POST | `/api/stress-test` | No | Run custom stress test |
| GET | `/api/stress-test/var` | No | Value at Risk calculation |
| GET | `/api/stress-test/scenarios` | No | Predefined stress scenarios |
| GET | `/api/stress-test/tail-risk` | No | Tail risk analysis |
| GET | `/api/alerts` | No | List price alerts |
| POST | `/api/alerts` | No | Create price alert |
| DELETE | `/api/alerts/{alert_id}` | No | Delete price alert |
| GET | `/api/alerts/check` | No | Check triggered alerts |

**Linked Elsewhere:**
- ✅ `rl_recommendations.py` - RL model inference
- ✅ `realtime_predictions.py` - XGBoost predictions
- ✅ Groq API - LLM chat integration
- ✅ Alpaca API - Paper trading
- ✅ yfinance - Market data
- ✅ Frontend - CORS enabled for all origins

**Security Issues:**

🔴 **CRITICAL:**
1. **No authentication required for 33/47 endpoints** - Trading, portfolio, alerts all public
2. **Static password salt** - `"finx_secure_salt_2024"` used for all users (line 426)
3. **In-memory storage** - All user data, tokens, sessions lost on restart
4. **CORS allows all origins** - `allow_origins=["*"]` (line 300)
5. **No input validation on trade amounts** - Risk of $0 or negative trades
6. **Secrets in environment variables** - API keys loaded from `.env` (needs Secret Manager)
7. **No SQL database** - Using dictionaries (`users_db`, `tokens_db`)
8. **WebSocket has no authentication** - Anyone can connect to `/ws`

🟠 **HIGH:**
1. **No HTTPS enforcement** - HTTP allowed in production
2. **Session timeout too long** - 24 hours (`SESSION_TIMEOUT`)
3. **Weak password hashing** - SHA256 without iterations (use bcrypt/argon2)
4. **No password complexity requirements** - Any password accepted
5. **Bot can trade without confirmation** - Automated trading with no safeguards
6. **No transaction limits** - Can place unlimited trades

🟡 **MEDIUM:**
1. **Rate limiting only on login** - No rate limiting on API calls
2. **Login history limited to 10** - Not enough for security monitoring
3. **No email verification** - Registration completes instantly
4. **TOTP window = 1** - Only ±30 seconds tolerance (standard is ±1 minute)

---

### 2. `webapp/backend/rl_recommendations.py` (355 lines)

**Purpose:** RL-based portfolio optimization - generates trading recommendations using trained PPO agent.

**Main Functions:**
- `load_rl_model()` - Load Stable-Baselines3 PPO model from disk
- `generate_rl_recommendations()` - Complete pipeline: live data → XGBoost → RL → recommendations
- `get_recommendations_for_user()` - User-specific recommendations with caching

**Linked Elsewhere:**
- ✅ `realtime_predictions.py` - XGBoost prediction engine
- ✅ `main.py` - Called by `/api/recommendations` endpoint
- ✅ Stable-Baselines3 - RL model inference
- ✅ Models at `models/rl_portfolio/ppo_portfolio_final.zip`

**Security Issues:**

🟠 **HIGH:**
1. **Model file path hardcoded** - `RL_MODEL_PATH` not configurable
2. **No model validation** - Could load malicious pickle file
3. **Global caching without locks** - Race conditions in multi-threaded environment

🟡 **MEDIUM:**
1. **5-minute cache expiry hardcoded** - Should be configurable
2. **No error handling for missing model** - Crashes if model not found

---

### 3. `webapp/backend/realtime_predictions.py` (540 lines)

**Purpose:** Real-time XGBoost predictions using live market data from yfinance.

**Main Functions:**
- `fetch_live_ohlcv(assets, period)` - Download live price data
- `compute_rsi(prices, window)` - Technical indicator: RSI
- `compute_macd(prices, fast, slow, signal)` - Technical indicator: MACD
- `generate_features_for_asset(symbol, ohlcv)` - Feature engineering
- `load_model(asset)` - Load XGBoost model with caching
- `predict_for_asset(asset)` - Generate real-time prediction

**Linked Elsewhere:**
- ✅ `rl_recommendations.py` - Predictions feed into RL model
- ✅ `main.py` - Market summary endpoint
- ✅ yfinance - External API dependency
- ✅ XGBoost models at `models/xgboost_walkforward/`

**Security Issues:**

🟡 **MEDIUM:**
1. **External API dependency** - yfinance can fail or return malicious data
2. **No data validation** - Trusts yfinance data without checks
3. **Model cache without expiry** - Memory leak potential
4. **Hardcoded asset list** - 15 assets only, no dynamic support

---

## 🚨 Critical Security Vulnerabilities

### 1. **No Authentication on Trading Endpoints** (CRITICAL)

**Issue:** Anyone can execute trades, view portfolios, manage alerts without authentication.

**Affected Endpoints:**
- `POST /api/trade` - Execute trades
- `POST /api/trade/batch` - Batch trades  
- `GET /api/alpaca/positions` - View real account positions
- `GET /api/alpaca/orders` - View order history
- `POST /api/alerts` - Create/delete price alerts

**Risk:** 
- Unauthorized trading on Alpaca accounts
- Data exposure of portfolio holdings
- Financial loss through malicious trades

**Fix:**
```python
@app.post("/api/trade")
async def execute_trade(
    request: TradeRequest,
    user: dict = Depends(get_current_user)  # ← Add this
):
    if not user:
        raise HTTPException(401, "Authentication required")
    # ... existing code
```

---

### 2. **Static Password Salt** (CRITICAL)

**Issue:** All users share the same salt: `"finx_secure_salt_2024"`

**Location:** `main.py` line 426
```python
def hash_password(password: str) -> str:
    salt = "finx_secure_salt_2024"  # ← VULNERABILITY
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
```

**Risk:**
- Rainbow table attacks work for all users
- If one password hash leaks, attacker can crack all passwords
- SHA256 is too fast (not designed for passwords)

**Fix:**
```python
import bcrypt

def hash_password(password: str) -> str:
    """Hash password with bcrypt (per-user salt included)."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash."""
    return bcrypt.checkpw(password.encode(), hashed.encode())
```

---

### 3. **In-Memory Storage** (CRITICAL)

**Issue:** All user data stored in dictionaries - lost on restart.

**Affected Data:**
- `users_db = {}` - User credentials, 2FA secrets
- `tokens_db = {}` - Active sessions
- `temp_tokens_db = {}` - 2FA temporary tokens
- `login_attempts = {}` - Rate limiting state
- `active_sessions = {}` - Session metadata
- `price_alerts = []` - User alerts

**Risk:**
- All users logged out on server restart
- No audit trail or persistence
- Cannot scale horizontally
- Data loss on crash

**Fix:** Use PostgreSQL or SQLite with SQLAlchemy:
```python
from sqlalchemy import create_engine, Column, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    email = Column(String, primary_key=True)
    password_hash = Column(String, nullable=False)
    totp_secret = Column(String, nullable=True)
    totp_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

# Initialize DB
engine = create_engine("sqlite:///./finx.db")  # or PostgreSQL
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)
```

---

### 4. **CORS Allows All Origins** (CRITICAL)

**Issue:** Any website can make API requests.

**Location:** `main.py` line 300
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ← VULNERABILITY
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Risk:**
- CSRF attacks from malicious websites
- Session hijacking
- Data theft via XSS

**Fix:**
```python
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "https://finx-frontend.run.app").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # ← Only allow trusted domains
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # Explicit methods
    allow_headers=["Authorization", "Content-Type"],
)
```

---

### 5. **WebSocket No Authentication** (CRITICAL)

**Issue:** Anyone can connect to `/ws` and receive real-time updates.

**Location:** `main.py` line 2188
```python
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)  # ← No auth check
    # ...
```

**Risk:**
- Real-time market data exposure
- Trade notifications leak to unauthorized users
- Can be used to DDoS (connection flooding)

**Fix:**
```python
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    # Verify token before accepting connection
    if token not in tokens_db:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle messages
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
```

---

### 6. **No Input Validation on Trades** (HIGH)

**Issue:** Trade requests accept any values without validation.

**Example:**
```python
@app.post("/api/trade")
async def execute_trade(request: TradeRequest):
    # No checks on:
    # - Negative quantities
    # - Zero dollar amounts
    # - Invalid symbols
    # - Excessive position sizes
```

**Risk:**
- Accidental fat-finger trades
- Malicious trades draining account
- API abuse

**Fix:**
```python
class TradeRequest(BaseModel):
    symbol: str
    action: str
    dollars: float
    
    @field_validator('symbol')
    def validate_symbol(cls, v):
        if not re.match(r'^[A-Z]{1,5}$', v):
            raise ValueError('Invalid stock symbol')
        return v
    
    @field_validator('action')
    def validate_action(cls, v):
        if v not in ['buy', 'sell']:
            raise ValueError('Action must be buy or sell')
        return v
    
    @field_validator('dollars')
    def validate_dollars(cls, v):
        if v <= 0:
            raise ValueError('Amount must be positive')
        if v > 10000:  # Max $10k per trade
            raise ValueError('Trade amount exceeds limit')
        return v
```

---

### 7. **Model File Security** (HIGH)

**Issue:** Loading pickle files without validation.

**Location:** `rl_recommendations.py`
```python
from stable_baselines3 import PPO
_rl_model = PPO.load(RL_MODEL_PATH)  # ← Can execute arbitrary code
```

**Risk:**
- Malicious pickle files can execute code on load
- Model tampering undetected
- Supply chain attack vector

**Fix:**
```python
import hashlib

EXPECTED_MODEL_HASH = "abc123..."  # Compute and store this

def verify_model_integrity(path: Path) -> bool:
    """Verify model file hasn't been tampered with."""
    with open(path, 'rb') as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()
    return file_hash == EXPECTED_MODEL_HASH

def load_rl_model():
    if not RL_MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {RL_MODEL_PATH}")
    
    if not verify_model_integrity(RL_MODEL_PATH):
        raise SecurityError("Model file integrity check failed")
    
    return PPO.load(RL_MODEL_PATH)
```

---

### 8. **Weak Password Hashing** (HIGH)

**Issue:** SHA256 with 1 iteration is too fast for password hashing.

**Current:**
```python
hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
```

**Problem:**
- SHA256 can compute 1 billion hashes/second on GPU
- Attacker can try 10M passwords in 10ms
- No protection against brute force

**Benchmark:**
- **SHA256:** 1,000,000,000 hashes/sec
- **bcrypt (cost=12):** 5 hashes/sec (200,000,000x slower)

**Fix:** Already covered in issue #2 (use bcrypt)

---

## 📝 Missing Backend Components

### 1. **Database Layer** (CRITICAL)

**Missing:**
- ✗ No persistent storage
- ✗ No ORM (SQLAlchemy)
- ✗ No migrations (Alembic)
- ✗ No database backups

**Proposed Stub:**
```python
# models/database.py
from sqlalchemy import create_engine, Column, String, Float, Boolean, DateTime, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    totp_secret = Column(String, nullable=True)
    totp_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    trades = relationship("Trade", back_populates="user")
    alerts = relationship("Alert", back_populates="user")

class Session(Base):
    __tablename__ = "sessions"
    token = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ip_address = Column(String)
    user_agent = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    last_active = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="sessions")

class Trade(Base):
    __tablename__ = "trades"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False)
    action = Column(String, nullable=False)  # buy/sell
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    status = Column(String, default="pending")  # pending/executed/failed
    alpaca_order_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="trades")

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False)
    condition = Column(String, nullable=False)  # above/below
    target_price = Column(Float, nullable=False)
    message = Column(String, nullable=True)
    triggered = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    triggered_at = Column(DateTime, nullable=True)
    
    user = relationship("User", back_populates="alerts")

# Database initialization
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./finx.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

### 2. **Exchange Connectors** (HIGH PRIORITY)

**Missing:**
- ✗ Real exchange integration (only Alpaca paper trading)
- ✗ Order book data
- ✗ Real-time quotes
- ✗ Historical trade data
- ✗ Multi-exchange support

**Proposed Stub:**
```python
# connectors/base_exchange.py
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from datetime import datetime

class BaseExchange(ABC):
    """Abstract base class for exchange connectors."""
    
    @abstractmethod
    def connect(self, api_key: str, api_secret: str) -> bool:
        """Connect to exchange."""
        pass
    
    @abstractmethod
    def get_balance(self) -> Dict[str, float]:
        """Get account balances."""
        pass
    
    @abstractmethod
    def place_order(self, symbol: str, side: str, quantity: float, price: Optional[float] = None) -> Dict:
        """Place buy/sell order."""
        pass
    
    @abstractmethod
    def cancel_order(self, order_id: str) -> bool:
        """Cancel existing order."""
        pass
    
    @abstractmethod
    def get_orders(self, symbol: Optional[str] = None) -> List[Dict]:
        """Get all orders."""
        pass
    
    @abstractmethod
    def get_positions(self) -> List[Dict]:
        """Get open positions."""
        pass
    
    @abstractmethod
    def get_quote(self, symbol: str) -> Dict:
        """Get real-time quote."""
        pass

# connectors/alpaca_connector.py
from connectors.base_exchange import BaseExchange
from alpaca.trading.client import TradingClient

class AlpacaConnector(BaseExchange):
    def __init__(self, paper: bool = True):
        self.client = None
        self.paper = paper
    
    def connect(self, api_key: str, api_secret: str) -> bool:
        try:
            self.client = TradingClient(api_key, api_secret, paper=self.paper)
            # Test connection
            self.client.get_account()
            return True
        except Exception as e:
            print(f"Alpaca connection failed: {e}")
            return False
    
    def get_balance(self) -> Dict[str, float]:
        account = self.client.get_account()
        return {
            "cash": float(account.cash),
            "equity": float(account.equity),
            "buying_power": float(account.buying_power)
        }
    
    def place_order(self, symbol: str, side: str, quantity: float, price: Optional[float] = None) -> Dict:
        from alpaca.trading.requests import MarketOrderRequest
        from alpaca.trading.enums import OrderSide, TimeInForce
        
        order_side = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
        
        request = MarketOrderRequest(
            symbol=symbol,
            qty=quantity,
            side=order_side,
            time_in_force=TimeInForce.DAY
        )
        
        order = self.client.submit_order(request)
        
        return {
            "order_id": str(order.id),
            "symbol": order.symbol,
            "side": order.side.value,
            "qty": float(order.qty),
            "status": order.status.value
        }
    
    # ... implement other methods

# connectors/interactive_brokers.py
class InteractiveBrokersConnector(BaseExchange):
    """Stub for future IB integration."""
    # TODO: Implement using ibapi
    pass

# connectors/coinbase.py
class CoinbaseConnector(BaseExchange):
    """Stub for crypto exchange."""
    # TODO: Implement using coinbase API
    pass
```

---

### 3. **Risk Management System** (HIGH PRIORITY)

**Missing:**
- ✗ Position size limits
- ✗ Maximum drawdown protection
- ✗ Exposure limits per sector
- ✗ Correlation-based risk
- ✗ Pre-trade risk checks

**Proposed Stub:**
```python
# risk/risk_manager.py
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class RiskLimits:
    """Risk management limits."""
    max_position_size_pct: float = 0.10  # 10% max per position
    max_sector_exposure_pct: float = 0.30  # 30% max per sector
    max_daily_loss_pct: float = 0.05  # 5% max daily loss
    max_drawdown_pct: float = 0.20  # 20% max drawdown
    max_leverage: float = 1.0  # No leverage
    max_trade_size_dollars: float = 10000  # $10k max per trade

class RiskManager:
    """Pre-trade risk checks and portfolio monitoring."""
    
    def __init__(self, limits: RiskLimits = None):
        self.limits = limits or RiskLimits()
    
    def check_trade(self, 
                   symbol: str, 
                   action: str, 
                   quantity: float,
                   price: float,
                   current_portfolio: Dict) -> tuple[bool, str]:
        """
        Validate trade against risk limits.
        Returns: (approved: bool, reason: str)
        """
        trade_value = quantity * price
        total_value = current_portfolio.get("total_value", 0)
        
        # Check 1: Trade size limit
        if trade_value > self.limits.max_trade_size_dollars:
            return False, f"Trade size ${trade_value:.2f} exceeds limit ${self.limits.max_trade_size_dollars}"
        
        # Check 2: Position size limit (after trade)
        if action.lower() == "buy":
            current_position = current_portfolio.get("positions", {}).get(symbol, 0)
            new_position_value = current_position + trade_value
            position_pct = new_position_value / total_value if total_value > 0 else 0
            
            if position_pct > self.limits.max_position_size_pct:
                return False, f"Position would be {position_pct*100:.1f}%, limit is {self.limits.max_position_size_pct*100}%"
        
        # Check 3: Sector exposure
        sector = self._get_sector(symbol)
        sector_exposure = self._calculate_sector_exposure(current_portfolio, sector)
        if sector_exposure > self.limits.max_sector_exposure_pct:
            return False, f"Sector exposure {sector_exposure*100:.1f}% exceeds limit"
        
        # Check 4: Daily loss limit
        daily_pnl_pct = current_portfolio.get("daily_pnl_pct", 0)
        if daily_pnl_pct < -self.limits.max_daily_loss_pct:
            return False, f"Daily loss limit reached ({daily_pnl_pct*100:.1f}%)"
        
        # All checks passed
        return True, "Trade approved"
    
    def calculate_value_at_risk(self, portfolio: Dict, confidence: float = 0.95) -> float:
        """Calculate portfolio VaR."""
        # TODO: Implement historical or parametric VaR
        pass
    
    def check_correlation_risk(self, portfolio: Dict) -> float:
        """Calculate portfolio correlation risk."""
        # TODO: Implement correlation matrix analysis
        pass
    
    def _get_sector(self, symbol: str) -> str:
        """Get stock sector (stub - use yfinance or API)."""
        # TODO: Query sector from database or API
        return "Technology"  # Placeholder
    
    def _calculate_sector_exposure(self, portfolio: Dict, sector: str) -> float:
        """Calculate current sector exposure."""
        # TODO: Sum all positions in sector
        return 0.0  # Placeholder

# Usage in trading endpoint:
risk_manager = RiskManager()

@app.post("/api/trade")
async def execute_trade(request: TradeRequest, user: dict = Depends(get_current_user)):
    # Get current portfolio
    portfolio = get_user_portfolio(user["email"])
    
    # Pre-trade risk check
    approved, reason = risk_manager.check_trade(
        symbol=request.symbol,
        action=request.action,
        quantity=request.quantity,
        price=get_current_price(request.symbol),
        current_portfolio=portfolio
    )
    
    if not approved:
        raise HTTPException(400, f"Trade rejected: {reason}")
    
    # Execute trade
    # ...
```

---

### 4. **Audit Logging** (MEDIUM PRIORITY)

**Missing:**
- ✗ Security event logging
- ✗ Trade audit trail
- ✗ User action history
- ✗ API access logs

**Proposed Stub:**
```python
# logging/audit_logger.py
import logging
from datetime import datetime
from typing import Optional
import json

class AuditLogger:
    """Security and compliance audit logging."""
    
    def __init__(self, log_file: str = "audit.log"):
        self.logger = logging.getLogger("audit")
        handler = logging.FileHandler(log_file)
        handler.setFormatter(logging.Formatter(
            '%(asctime)s | %(levelname)s | %(message)s'
        ))
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
    
    def log_event(self, 
                  event_type: str, 
                  user_email: Optional[str], 
                  details: dict,
                  ip_address: str = "unknown"):
        """Log security or business event."""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "user": user_email,
            "ip": ip_address,
            "details": details
        }
        self.logger.info(json.dumps(log_entry))
    
    def log_login(self, email: str, success: bool, ip: str, mfa_used: bool):
        self.log_event(
            "LOGIN",
            email,
            {"success": success, "mfa": mfa_used},
            ip
        )
    
    def log_trade(self, email: str, symbol: str, action: str, amount: float, ip: str):
        self.log_event(
            "TRADE",
            email,
            {"symbol": symbol, "action": action, "amount": amount},
            ip
        )
    
    def log_config_change(self, email: str, setting: str, old_value, new_value, ip: str):
        self.log_event(
            "CONFIG_CHANGE",
            email,
            {"setting": setting, "old": old_value, "new": new_value},
            ip
        )

# Global logger instance
audit = AuditLogger()

# Usage in endpoints:
@app.post("/api/auth/login")
async def login(data: LoginRequest, request: Request):
    ip = request.client.host
    # ... login logic
    audit.log_login(data.email, success=True, ip=ip, mfa_used=False)
```

---

### 5. **Rate Limiting & DDoS Protection** (MEDIUM)

**Missing:**
- ✗ Global API rate limiting
- ✗ Per-user quotas
- ✗ WebSocket connection limits
- ✗ Endpoint-specific limits

**Proposed Stub:**
```python
# middleware/rate_limiter.py
from fastapi import Request, HTTPException
from collections import defaultdict
from datetime import datetime, timedelta
import asyncio

class RateLimiter:
    """In-memory rate limiter (use Redis in production)."""
    
    def __init__(self):
        self.requests = defaultdict(list)  # {ip: [timestamp1, timestamp2, ...]}
        self.cleanup_task = None
    
    async def check_rate_limit(self, 
                              key: str, 
                              max_requests: int = 100, 
                              window_seconds: int = 60) -> bool:
        """
        Check if request is within rate limit.
        Returns True if allowed, False if exceeded.
        """
        now = datetime.now()
        window_start = now - timedelta(seconds=window_seconds)
        
        # Clean old requests
        self.requests[key] = [
            ts for ts in self.requests[key] 
            if ts > window_start
        ]
        
        # Check limit
        if len(self.requests[key]) >= max_requests:
            return False
        
        # Record request
        self.requests[key].append(now)
        return True
    
    async def cleanup_old_entries(self):
        """Background task to clean old entries."""
        while True:
            await asyncio.sleep(300)  # Every 5 minutes
            cutoff = datetime.now() - timedelta(hours=1)
            for key in list(self.requests.keys()):
                self.requests[key] = [ts for ts in self.requests[key] if ts > cutoff]
                if not self.requests[key]:
                    del self.requests[key]

rate_limiter = RateLimiter()

# Middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Skip for health check
    if request.url.path == "/health":
        return await call_next(request)
    
    ip = request.client.host
    
    # Different limits for different endpoints
    if request.url.path.startswith("/api/trade"):
        allowed = await rate_limiter.check_rate_limit(f"trade:{ip}", max_requests=10, window_seconds=60)
    else:
        allowed = await rate_limiter.check_rate_limit(f"api:{ip}", max_requests=100, window_seconds=60)
    
    if not allowed:
        raise HTTPException(429, "Rate limit exceeded")
    
    return await call_next(request)
```

---

## 📊 Risk Matrix

| Vulnerability | Likelihood | Impact | Risk Score |
|--------------|------------|--------|------------|
| No auth on trading endpoints | High | Critical | 🔴 10/10 |
| Static password salt | High | Critical | 🔴 10/10 |
| In-memory storage | High | High | 🔴 9/10 |
| CORS wildcard | Medium | Critical | 🔴 8/10 |
| WebSocket no auth | Medium | High | 🟠 7/10 |
| Weak password hashing | High | High | 🟠 8/10 |
| No input validation | Medium | High | 🟠 7/10 |
| Model file security | Low | Critical | 🟠 6/10 |
| No rate limiting | High | Medium | 🟡 6/10 |
| No database backups | Low | High | 🟡 5/10 |

---

## ✅ Recommendations Priority

### Immediate (This Week):
1. **Add authentication to all trading endpoints**
2. **Switch to bcrypt for password hashing**
3. **Restrict CORS to specific origins**
4. **Add WebSocket authentication**
5. **Implement PostgreSQL database**

### Short-term (Next Sprint):
6. **Add input validation on all trade endpoints**
7. **Implement risk management pre-trade checks**
8. **Add rate limiting middleware**
9. **Set up audit logging**
10. **Model integrity verification**

### Medium-term (Next Month):
11. **Build exchange connector abstraction**
12. **Implement real exchange integration**
13. **Add database migrations with Alembic**
14. **Set up automated backups**
15. **Email verification for registration**

---

## 📦 Proposed File Structure

```
webapp/backend/
├── main.py                    # FastAPI app (existing)
├── realtime_predictions.py    # XGBoost predictions (existing)
├── rl_recommendations.py      # RL recommendations (existing)
├── requirements.txt           # Dependencies (existing)
├── Dockerfile                 # Container config (existing)
│
├── models/                    # NEW: Database models
│   ├── __init__.py
│   ├── database.py           # SQLAlchemy setup
│   ├── user.py               # User model
│   ├── session.py            # Session model
│   ├── trade.py              # Trade model
│   └── alert.py              # Alert model
│
├── connectors/                # NEW: Exchange connectors
│   ├── __init__.py
│   ├── base_exchange.py      # Abstract base class
│   ├── alpaca_connector.py   # Alpaca implementation
│   ├── ib_connector.py       # Interactive Brokers (stub)
│   └── coinbase_connector.py # Crypto exchange (stub)
│
├── risk/                      # NEW: Risk management
│   ├── __init__.py
│   ├── risk_manager.py       # Pre-trade checks
│   ├── var_calculator.py     # Value at Risk
│   └── stress_tester.py      # Portfolio stress tests
│
├── middleware/                # NEW: API middleware
│   ├── __init__.py
│   ├── rate_limiter.py       # Rate limiting
│   ├── auth.py               # Authentication helpers
│   └── cors.py               # CORS configuration
│
├── logging/                   # NEW: Audit logging
│   ├── __init__.py
│   ├── audit_logger.py       # Security events
│   └── trade_logger.py       # Trade audit trail
│
└── tests/                     # NEW: Unit tests
    ├── __init__.py
    ├── test_auth.py           # Authentication tests
    ├── test_trading.py        # Trading logic tests
    ├── test_risk.py           # Risk management tests
    └── test_api.py            # API endpoint tests
```

---

## 🎯 Next Steps

1. **Run security linters:**
   ```bash
   pip install bandit safety
   bandit -r webapp/backend/
   safety check -r webapp/backend/requirements.txt
   ```

2. **Set up pre-commit hooks:**
   ```bash
   pip install pre-commit
   pre-commit install
   ```

3. **Add security headers to FastAPI:**
   ```python
   from fastapi.middleware.trustedhost import TrustedHostMiddleware
   from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
   
   app.add_middleware(HTTPSRedirectMiddleware)
   app.add_middleware(TrustedHostMiddleware, allowed_hosts=["finx-backend.run.app"])
   ```

4. **Enable Cloud Run security features:**
   - Service account with minimal permissions
   - VPC connector for private database
   - Binary authorization
   - Cloud Armor for DDoS protection

---

**Generated:** December 6, 2025  
**Audited By:** GitHub Copilot (Claude Sonnet 4.5)  
**Total Issues:** 18 vulnerabilities identified  
**Files Reviewed:** 3 Python files, 2,510 lines of backend code
