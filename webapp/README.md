# Smart Investment AI - Web Platform

AI-Powered Portfolio Management Dashboard with Live Trading Bot

## 🚀 Quick Start

### 1. Start Backend (FastAPI)
```bash
cd webapp/backend
pip install fastapi uvicorn pydantic yfinance pandas
python main.py
```
Backend runs at: http://localhost:8000

### 2. Start Frontend (Next.js)
```bash
cd webapp/frontend
npm install
npm run dev
```
Frontend runs at: http://localhost:3000

## 📊 Features

- **AI Recommendations**: Real-time stock picks from XGBoost models
- **Portfolio Dashboard**: Track value, returns, and positions
- **Trading Bot**: Paper/Live trading with start/stop controls
- **Chatbot**: Groq LLM integration for market Q&A
- **Performance Metrics**: Backtest results with 47.5% annual return

## 🔧 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/recommendations` | AI stock recommendations |
| `GET /api/portfolio` | Current portfolio status |
| `GET /api/backtest` | Backtest performance metrics |
| `GET /api/prices/{symbol}` | Price history for symbol |
| `POST /api/chat` | Chatbot endpoint (Groq) |
| `GET /api/bot/status` | Trading bot status |
| `POST /api/bot/toggle` | Start/stop trading bot |

## 🔑 Integrating Groq

1. Get API key from [console.groq.com](https://console.groq.com)
2. Add to `webapp/backend/main.py`:

```python
from groq import Groq

client = Groq(api_key="your-api-key")

@app.post("/api/chat")
def chat(message: ChatMessage):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a financial advisor AI..."},
            {"role": "user", "content": message.message}
        ]
    )
    return {"response": response.choices[0].message.content}
```

## 📈 Model Performance

- **Annual Return**: 47.5%
- **Sharpe Ratio**: 1.93
- **Max Drawdown**: 25.8%
- **Win Rate**: 75.2%
- **Prediction Correlation**: 0.684

## 🛠️ Tech Stack

- **Backend**: FastAPI, Python, yfinance
- **Frontend**: Next.js 14, React, TailwindCSS
- **AI Models**: XGBoost Walk-Forward (15 assets)
- **Chatbot**: Groq LLM (llama-3.3-70b)
- **Trading**: Alpaca API

## 📁 Structure

```
webapp/
├── backend/
│   └── main.py          # FastAPI server
└── frontend/
    ├── app/
    │   ├── page.tsx     # Dashboard
    │   ├── layout.tsx   # Layout
    │   └── globals.css  # Styles
    └── package.json
```
