# Smart Investment AI - Web Platform

AI-Powered Portfolio Management Dashboard with Live Trading Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.0.7-black)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green)](https://fastapi.tiangolo.com/)
[![XGBoost](https://img.shields.io/badge/XGBoost-ML-orange.svg)](https://xgboost.readthedocs.io/)
[![Stable-Baselines3](https://img.shields.io/badge/Stable--Baselines3-RL-8A2BE2.svg)](https://stable-baselines3.readthedocs.io/)
[![MLflow](https://img.shields.io/badge/MLflow-Tracking-0194E2.svg)](https://mlflow.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Realtime-4CAF50.svg)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

## 🚀 Quick Start

### 1. Start Backend (FastAPI)
```bash
cd webapp/backend
pip install -r requirements.txt  # Or: pip install fastapi uvicorn pydantic yfinance pandas apscheduler pytz groq
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
- **MLflow Tracking**: Experiment tracking and model registry support for training runs
- **Portfolio Dashboard**: Track value, returns, and positions
- **Trading Bot**: Paper/Live trading with start/stop controls & background scheduling
- **Chatbot**: Groq LLM integration for market Q&A with persistent chat history
- **Performance Metrics**: Backtest results with 47.5% annual return
- **Real-time WebSocket**: Live updates for trades, alerts, and portfolio changes
- **Price Alerts**: Set custom price alerts for any symbol
- **Market Hours**: Visual indicator for market open/closed status
- **Toast Notifications**: System-wide notifications for important events
- **Mobile Responsive**: Full mobile support with collapsible sidebar
- **Settings Persistence**: User preferences saved in localStorage

## 🔧 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/recommendations` | AI stock recommendations |
| `GET /api/portfolio` | Current portfolio status |
| `GET /api/backtest` | Backtest performance metrics |
| `GET /api/prices/{symbol}` | Price history for symbol |
| `POST /api/chat` | Chatbot endpoint (Groq) |
| `GET /api/bot/status` | Trading bot status |
| `POST /api/bot/start` | Start trading bot with scheduler |
| `POST /api/bot/stop` | Stop trading bot |
| `WS /ws` | WebSocket for real-time updates |
| `GET /api/market/hours` | Market hours status |
| `GET /api/alerts` | Get price alerts |
| `POST /api/alerts` | Create price alert |
| `DELETE /api/alerts/{id}` | Delete price alert |

## 🔑 Environment Variables

1. Get API key from [console.groq.com](https://console.groq.com)
2. Configure `webapp/backend/.env` from `webapp/backend/.env.example`.

```bash
GROQ_API_KEY=your_groq_api_key
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key
FRED_API_KEY=your_fred_api_key
JWT_SECRET=generate_a_strong_secret
```

3. Configure `webapp/frontend/.env.local` from `webapp/frontend/.env.example`.

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 📈 Model Performance

- **Annual Return**: 47.5%
- **Sharpe Ratio**: 1.93
- **Max Drawdown**: 25.8%
- **Win Rate**: 75.2%
- **Prediction Correlation**: 0.684

## 🛠️ Tech Stack

- **Backend**: FastAPI, Python, yfinance, APScheduler
- **Frontend**: Next.js 14, React, TailwindCSS, Zustand
- **AI Models**: XGBoost Walk-Forward (15 assets)
- **MLOps**: MLflow tracking server (docker-compose, port 5000)
- **Chatbot**: Groq LLM (llama-3.3-70b)
- **Trading**: Alpaca API (Paper/Live)
- **Real-time**: WebSocket, EventSource

## 📁 Structure

```
webapp/
├── backend/
│   ├── main.py              # FastAPI server with WebSocket
│   └── requirements.txt     # Python dependencies
└── frontend/
    ├── app/
    │   ├── page.tsx         # Landing page
    │   ├── layout.tsx       # Root layout
    │   ├── dashboard/       # Dashboard pages
    │   └── globals.css      # Global styles
    ├── components/
    │   ├── layout/          # Navbar, Sidebar
    │   ├── ui/              # Reusable UI components
    │   ├── chat/            # Chatbot widget
    │   ├── alerts/          # Price alerts
    │   └── bot/             # Trading bot controls
    ├── hooks/               # Custom React hooks
    │   ├── useWebSocket.ts  # WebSocket connection
    │   └── useAppSettings.ts # Settings persistence
    └── store/               # Zustand stores
```

