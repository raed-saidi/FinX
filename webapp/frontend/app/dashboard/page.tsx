'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, 
  TrendingDown, 
  Bot, 
  MessageCircle, 
  DollarSign,
  Activity,
  Zap,
  Send,
  LogOut,
  User,
  X,
  BarChart3,
  Wallet,
  ShoppingCart,
  Play,
  Square,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
interface Position {
  symbol: string;
  shares: number;
  avg_price: number;
  current_price: number;
  pnl: number;
  pnl_pct: number;
}

interface Portfolio {
  cash: number;
  positions: Position[];
  total_value: number;
}

interface Recommendation {
  asset: string;
  signal: number;
  direction: string;
  weight_pct: number;
  current_price: number;
}

interface AlpacaAccount {
  buying_power: number;
  cash: number;
  portfolio_value: number;
  equity: number;
  status: string;
}

interface BotStatus {
  status: string;
  mode: string;
  trades_today: number;
  alpaca_connected: boolean;
  alpaca_account: AlpacaAccount | null;
}

// Trade Modal
function TradeModal({ 
  isOpen, 
  onClose, 
  symbol, 
  currentPrice,
  onTrade 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  symbol: string;
  currentPrice: number;
  onTrade: (symbol: string, shares: number, action: 'buy' | 'sell') => void;
}) {
  const [shares, setShares] = useState(1);
  const [action, setAction] = useState<'buy' | 'sell'>('buy');

  if (!isOpen) return null;

  const total = shares * currentPrice;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-sm animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">{symbol}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center mb-6">
          <p className="text-3xl font-bold">${currentPrice.toFixed(2)}</p>
          <p className="text-gray-500 text-sm">Current Price</p>
        </div>

        {/* Buy/Sell Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setAction('buy')}
            className={`flex-1 py-3 rounded-lg font-semibold transition ${
              action === 'buy' 
                ? 'bg-green-500 text-white' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setAction('sell')}
            className={`flex-1 py-3 rounded-lg font-semibold transition ${
              action === 'sell' 
                ? 'bg-red-500 text-white' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Sell
          </button>
        </div>

        {/* Shares Input */}
        <div className="mb-6">
          <label className="text-sm text-gray-500 mb-2 block">Shares</label>
          <input
            type="number"
            min="1"
            value={shares}
            onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 1))}
            className="input text-center text-2xl font-bold"
          />
        </div>

        {/* Total */}
        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Estimated Total</span>
            <span className="font-semibold">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Execute Button */}
        <button
          onClick={() => {
            onTrade(symbol, shares, action);
            onClose();
          }}
          className={`w-full py-4 rounded-lg font-bold text-lg transition ${
            action === 'buy'
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
        >
          {action === 'buy' ? 'Buy' : 'Sell'} {shares} Share{shares > 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

// Stock Chart Component
function StockChart({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/chart/${symbol}`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [symbol]);

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      </div>
    );
  }

  if (!data) return null;
  const isPositive = data.change_pct >= 0;

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-gray-400" />
          <div>
            <h3 className="font-bold">{data.symbol}</h3>
            <p className="text-sm text-gray-500">3 Month Chart</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xl font-bold">${data.current_price}</p>
            <p className={isPositive ? 'text-profit text-sm' : 'text-loss text-sm'}>
              {isPositive ? '+' : ''}{data.change_pct.toFixed(2)}%
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.data}>
            <defs>
              <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#0a0a0a', 
                border: '1px solid #1a1a1a',
                borderRadius: '8px'
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
            />
            <Area 
              type="monotone" 
              dataKey="close" 
              stroke={isPositive ? "#22c55e" : "#ef4444"}
              strokeWidth={2}
              fill={`url(#gradient-${symbol})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Chat Panel
function ChatPanel() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I had trouble connecting. Please try again!' 
      }]);
    }
    setLoading(false);
  };

  return (
    <div className="card h-[400px] flex flex-col">
      <div className="p-4 border-b border-white/5 flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-gray-400" />
        <h3 className="font-semibold">AI Assistant</h3>
        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full ml-auto">
          Groq
        </span>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
              msg.role === 'user' 
                ? 'bg-white text-black' 
                : 'bg-white/5 text-gray-200'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 p-3 rounded-lg">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        {messages.length === 0 && !loading && (
          <div className="text-center text-gray-600 py-8">
            <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Ask about stocks or trading</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-white/5">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about stocks..."
            className="input flex-1"
            disabled={loading}
          />
          <button 
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="btn-primary p-3"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Dashboard
export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus>({ 
    status: 'stopped', 
    mode: 'paper', 
    trades_today: 0,
    alpaca_connected: false,
    alpaca_account: null
  });
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [tradeModal, setTradeModal] = useState<{ symbol: string; price: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!savedUser || !token) {
      router.push('/');
      return;
    }
    
    setUser(JSON.parse(savedUser));
    fetchData(token);
  }, [router]);

  const fetchData = async (token: string) => {
    setLoading(true);
    try {
      const [portfolioRes, recsRes, botRes] = await Promise.all([
        fetch(`${API_URL}/api/user/portfolio`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/recommendations`),
        fetch(`${API_URL}/api/bot/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (portfolioRes.ok) setPortfolio(await portfolioRes.json());
      if (recsRes.ok) setRecommendations(await recsRes.json());
      if (botRes.ok) {
        const botData = await botRes.json();
        setBotStatus(prev => ({ ...prev, ...botData }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleTrade = async (symbol: string, shares: number, action: 'buy' | 'sell') => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/api/user/trade`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ symbol, shares, action })
      });

      if (res.ok) {
        fetchData(token);
      } else {
        const data = await res.json();
        alert(data.detail || 'Trade failed');
      }
    } catch (error) {
      alert('Trade failed');
    }
  };

  const toggleBot = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const endpoint = botStatus.status === 'running' ? '/api/bot/stop' : '/api/bot/start';
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBotStatus(prev => ({ ...prev, status: data.status }));
      }
    } catch (error) {
      console.error('Bot toggle failed:', error);
    }
  };

  // Default portfolio for demo
  const displayPortfolio = portfolio || {
    cash: 100000,
    positions: [],
    total_value: 100000
  };

  // Demo recommendations if none loaded
  const displayRecs = recommendations.length > 0 ? recommendations : [
    { asset: 'META', signal: 0.0482, direction: 'LONG', weight_pct: 12.5, current_price: 568.40 },
    { asset: 'AAPL', signal: 0.0341, direction: 'LONG', weight_pct: 10.2, current_price: 237.50 },
    { asset: 'NVDA', signal: 0.0245, direction: 'LONG', weight_pct: 8.5, current_price: 138.00 },
    { asset: 'QQQ', signal: 0.0287, direction: 'LONG', weight_pct: 9.8, current_price: 515.20 },
    { asset: 'SPY', signal: 0.0198, direction: 'LONG', weight_pct: 7.2, current_price: 600.15 },
  ];

  const positionsValue = displayPortfolio.positions.reduce((sum, p) => sum + (p.shares * p.current_price), 0);
  const totalPnl = displayPortfolio.positions.reduce((sum, p) => sum + p.pnl, 0);

  if (!user) return null;

  return (
    <main className="min-h-screen">
      {/* Trade Modal */}
      {tradeModal && (
        <TradeModal
          isOpen={true}
          onClose={() => setTradeModal(null)}
          symbol={tradeModal.symbol}
          currentPrice={tradeModal.price}
          onTrade={handleTrade}
        />
      )}

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6" />
            <span className="font-semibold text-lg">SmartInvest</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <User className="w-4 h-4" />
              {user.name}
            </div>
            <button 
              onClick={handleLogout}
              className="text-gray-400 hover:text-white transition p-2"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-white/5">
                <Wallet className="w-5 h-5 text-gray-400" />
              </div>
              <span className="text-gray-500 text-sm">Total Value</span>
            </div>
            <p className="text-2xl font-bold">${displayPortfolio.total_value.toLocaleString()}</p>
          </div>
          
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-white/5">
                <DollarSign className="w-5 h-5 text-gray-400" />
              </div>
              <span className="text-gray-500 text-sm">Cash</span>
            </div>
            <p className="text-2xl font-bold">${displayPortfolio.cash.toLocaleString()}</p>
          </div>
          
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-white/5">
                <Activity className="w-5 h-5 text-gray-400" />
              </div>
              <span className="text-gray-500 text-sm">Positions Value</span>
            </div>
            <p className="text-2xl font-bold">${positionsValue.toLocaleString()}</p>
          </div>
          
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-white/5">
                <TrendingUp className="w-5 h-5 text-gray-400" />
              </div>
              <span className="text-gray-500 text-sm">Total P&L</span>
            </div>
            <p className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Chart */}
        {selectedChart && (
          <div className="mb-8">
            <StockChart symbol={selectedChart} onClose={() => setSelectedChart(null)} />
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Portfolio & Recommendations */}
          <div className="lg:col-span-2 space-y-6">
            {/* Positions */}
            <div className="card">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-gray-400" />
                  Your Positions
                </h3>
              </div>
              <div className="p-4">
                {displayPortfolio.positions.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No positions yet</p>
                    <p className="text-sm">Buy stocks from recommendations below</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {displayPortfolio.positions.map((pos, i) => (
                      <div 
                        key={i}
                        onClick={() => setSelectedChart(pos.symbol)}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            pos.pnl >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {pos.pnl >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-semibold">{pos.symbol}</p>
                            <p className="text-sm text-gray-500">{pos.shares} shares @ ${pos.avg_price.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${(pos.shares * pos.current_price).toFixed(2)}</p>
                          <p className={`text-sm ${pos.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {pos.pnl >= 0 ? '+' : ''}{pos.pnl_pct.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="card">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  AI Recommendations
                </h3>
                <span className="text-xs text-gray-500">Click to view chart</span>
              </div>
              <div className="p-4 space-y-2">
                {displayRecs.slice(0, 5).map((rec, i) => {
                  const isPositive = rec.signal > 0;
                  return (
                    <div 
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition"
                    >
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => setSelectedChart(rec.asset)}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-semibold">{rec.asset}</p>
                          <p className="text-sm text-gray-500">{rec.direction} • ${rec.current_price}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`font-semibold ${isPositive ? 'text-profit' : 'text-loss'}`}>
                            {(rec.signal * 100).toFixed(2)}%
                          </p>
                          <p className="text-xs text-gray-500">{rec.weight_pct.toFixed(1)}% weight</p>
                        </div>
                        <button
                          onClick={() => setTradeModal({ symbol: rec.asset, price: rec.current_price })}
                          className="btn-primary text-sm py-2 px-4"
                        >
                          Trade
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Bot & Chat */}
          <div className="space-y-6">
            {/* Bot Status */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-gray-400" />
                  <h3 className="font-semibold">Trading Bot</h3>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  botStatus.status === 'running' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-white/5 text-gray-500'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    botStatus.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                  }`} />
                  {botStatus.status === 'running' ? 'Running' : 'Stopped'}
                </div>
              </div>

              {/* Alpaca Connection Status */}
              <div className={`mb-4 p-3 rounded-lg ${
                botStatus.alpaca_connected 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-yellow-500/10 border border-yellow-500/20'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${
                    botStatus.alpaca_connected ? 'bg-green-400' : 'bg-yellow-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    botStatus.alpaca_connected ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    Alpaca {botStatus.alpaca_connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                {botStatus.alpaca_connected && botStatus.alpaca_account && (
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Buying Power</span>
                      <span className="text-white">${botStatus.alpaca_account.buying_power.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Portfolio Value</span>
                      <span className="text-white">${botStatus.alpaca_account.portfolio_value.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <span className="text-green-400 capitalize">{botStatus.alpaca_account.status}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Mode</span>
                  <span className="capitalize">{botStatus.mode}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Trades Today</span>
                  <span>{botStatus.trades_today}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Strategy</span>
                  <span>XGBoost AI</span>
                </div>
              </div>
              
              <button 
                onClick={toggleBot}
                className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
                  botStatus.status === 'running'
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                }`}
              >
                {botStatus.status === 'running' ? (
                  <>
                    <Square className="w-4 h-4" /> Stop Bot
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Start Bot
                  </>
                )}
              </button>
            </div>

            {/* Chat */}
            <ChatPanel />
          </div>
        </div>

        {/* Performance Stats */}
        <div className="mt-8 card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-gray-400" />
            Model Performance (Backtest 2017-2024)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-2xl font-bold text-profit">353.2%</p>
              <p className="text-xs text-gray-500">Total Return</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-2xl font-bold text-profit">47.5%</p>
              <p className="text-xs text-gray-500">Annual Return</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-2xl font-bold">1.93</p>
              <p className="text-xs text-gray-500">Sharpe Ratio</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-2xl font-bold text-loss">25.8%</p>
              <p className="text-xs text-gray-500">Max Drawdown</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <p className="text-2xl font-bold text-profit">75.2%</p>
              <p className="text-xs text-gray-500">Win Rate</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
