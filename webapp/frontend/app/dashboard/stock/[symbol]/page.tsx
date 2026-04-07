'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Activity,
  Star,
  RefreshCw,
  ShoppingCart,
  Minus,
  Info,
  Clock,
  Calendar,
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import EnhancedChart from '@/components/charts/EnhancedChart';
import StockLogo from '@/components/ui/StockLogo';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  week52High?: number;
  week52Low?: number;
}

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const symbol = (params.symbol as string)?.toUpperCase();
  
  const { 
    portfolio, 
    recommendations,
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    executeTrade,
    fetchPortfolio
  } = useDashboardStore();

  const [stockData, setStockData] = useState<StockData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrading, setIsTrading] = useState(false);
  const [tradeAmount, setTradeAmount] = useState('100');
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy');
  const [mounted, setMounted] = useState(false);

  // Find if we have a position in this stock
  const position = portfolio?.positions?.find(
    (p) => p.symbol === symbol
  );

  // Find recommendation for this stock
  const recommendation = recommendations?.find(r => r.asset === symbol);

  // Check if in watchlist
  const isInWatchlist = watchlist.includes(symbol);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (symbol) {
      fetchStockData();
    }
  }, [symbol]);

  const fetchStockData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/stock/${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setStockData(data);
      }
    } catch (error) {
      console.error('Failed to fetch stock data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrade = async () => {
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid Amount', 'Please enter a valid dollar amount');
      return;
    }

    if (tradeAction === 'sell' && !position) {
      toast.error('No Position', `You don't own any ${symbol} to sell`);
      return;
    }

    setIsTrading(true);
    try {
      const result = await executeTrade(symbol, tradeAction, amount);
      if (result?.success) {
        toast.success(
          'Trade Executed',
          `${tradeAction.toUpperCase()} $${amount} of ${symbol}`
        );
        fetchPortfolio();
        fetchStockData();
      } else {
        toast.error('Trade Failed', result?.error || 'Unknown error');
      }
    } catch (error) {
      toast.error('Trade Failed', 'Could not execute trade');
    } finally {
      setIsTrading(false);
    }
  };

  const toggleWatchlist = () => {
    if (isInWatchlist) {
      removeFromWatchlist(symbol);
      toast.info('Removed', `${symbol} removed from watchlist`);
    } else {
      addToWatchlist(symbol);
      toast.success('Added', `${symbol} added to watchlist`);
    }
  };

  const quickAmounts = [50, 100, 250, 500, 1000];

  if (!symbol) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Invalid stock symbol</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
      style={{ paddingTop: '40px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-muted rounded transition"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          
          <div className="flex items-center gap-4">
            <StockLogo symbol={symbol} size="xl" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">{symbol}</h1>
              {isLoading ? (
                <Skeleton width={100} height={16} />
              ) : (
                <p className="text-muted-foreground">
                  ${stockData?.price?.toFixed(2) || '—'}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleWatchlist}
            className={`p-2 rounded transition ${
              isInWatchlist 
                ? 'bg-amber-500/20 text-amber-400' 
                : 'hover:bg-muted text-muted-foreground'
            }`}
            title={isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
          >
            <Star className={`w-5 h-5 ${isInWatchlist ? 'fill-current' : ''}`} />
          </button>
          
          <button
            onClick={fetchStockData}
            className="p-2 hover:bg-muted rounded transition text-muted-foreground"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Chart & Stats */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Price Change Banner */}
          {!isLoading && stockData && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded flex items-center justify-between ${
                (stockData.changePercent || 0) >= 0
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : 'bg-red-500/10 border border-red-500/20'
              }`}
            >
              <div className="flex items-center gap-3">
                {(stockData.changePercent || 0) >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-400" />
                )}
                <div>
                  <p className={`text-lg font-bold ${
                    (stockData.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {(stockData.changePercent || 0) >= 0 ? '+' : ''}{stockData.changePercent?.toFixed(2)}%
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {(stockData.change || 0) >= 0 ? '+' : ''}${stockData.change?.toFixed(2)} today
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">
                  ${stockData.price?.toFixed(2)}
                </p>
                <p className="text-muted-foreground text-xs">Current Price</p>
              </div>
            </motion.div>
          )}

          {/* Chart */}
          <div className="bg-card border border-border rounded p-4">
            <EnhancedChart symbol={symbol} height={400} />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded p-4">
              <div className="flex items-center gap-2 text-foreground/70 text-sm mb-1">
                <Activity className="w-4 h-4" />
                Open
              </div>
              <p className="text-foreground font-bold">
                {isLoading ? <Skeleton width={60} height={20} /> : `$${stockData?.open?.toFixed(2) || '—'}`}
              </p>
            </div>
            
            <div className="bg-card border border-border rounded p-4">
              <div className="flex items-center gap-2 text-foreground/70 text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                High
              </div>
              <p className="text-emerald-400 font-bold">
                {isLoading ? <Skeleton width={60} height={20} /> : `$${stockData?.high?.toFixed(2) || '—'}`}
              </p>
            </div>
            
            <div className="bg-card border border-border rounded p-4">
              <div className="flex items-center gap-2 text-foreground/70 text-sm mb-1">
                <TrendingDown className="w-4 h-4" />
                Low
              </div>
              <p className="text-red-400 font-bold">
                {isLoading ? <Skeleton width={60} height={20} /> : `$${stockData?.low?.toFixed(2) || '—'}`}
              </p>
            </div>
            
            <div className="bg-card border border-border rounded p-4">
              <div className="flex items-center gap-2 text-foreground/70 text-sm mb-1">
                <BarChart3 className="w-4 h-4" />
                Volume
              </div>
              <p className="text-foreground font-bold">
                {isLoading ? <Skeleton width={60} height={20} /> : (
                  stockData?.volume 
                    ? `${(stockData.volume / 1000000).toFixed(2)}M` 
                    : '—'
                )}
              </p>
            </div>
          </div>

          {/* AI Recommendation */}
          {recommendation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card border border-border rounded p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-purple-500/20 rounded flex items-center justify-center">
                  <Activity className="w-4 h-4 text-purple-400" />
                </div>
                <h3 className="font-semibold text-foreground">AI Recommendation</h3>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Signal</p>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    recommendation.direction === 'LONG' 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : recommendation.direction === 'SHORT'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {recommendation.direction}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Weight</p>
                  <p className="text-foreground font-bold">{recommendation.weight_pct}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Signal Strength</p>
                  <p className={`font-bold ${recommendation.signal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {recommendation.signal >= 0 ? '+' : ''}{(recommendation.signal * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column - Trading Panel */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Your Position */}
          {position && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card border border-border rounded p-4"
            >
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Your Position
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shares</span>
                  <span className="text-foreground font-medium">{position.shares.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Market Value</span>
                  <span className="text-foreground font-medium">${position.value.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">P&L</span>
                  <span className={`font-medium ${position.pnl_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {position.pnl_pct >= 0 ? '+' : ''}{position.pnl_pct.toFixed(2)}%
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Trading Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded p-4"
          >
            <h3 className="font-semibold text-foreground mb-4">Trade {symbol}</h3>
            
            {/* Buy/Sell Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTradeAction('buy')}
                className={`flex-1 py-2 rounded font-medium transition ${
                  tradeAction === 'buy'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setTradeAction('sell')}
                disabled={!position}
                className={`flex-1 py-2 rounded font-medium transition ${
                  tradeAction === 'sell'
                    ? 'bg-red-500 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                Sell
              </button>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="text-muted-foreground text-sm mb-2 block">
                Amount (USD)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-emerald-500"
                  placeholder="100"
                />
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setTradeAmount(amount.toString())}
                  className={`px-3 py-1 rounded text-sm transition ${
                    tradeAmount === amount.toString()
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>

            {/* Estimated Shares */}
            {stockData && tradeAmount && (
              <div className="p-3 bg-muted rounded mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Shares</span>
                  <span className="text-foreground font-medium">
                    ~{(parseFloat(tradeAmount) / stockData.price).toFixed(4)}
                  </span>
                </div>
              </div>
            )}

            {/* Trade Button */}
            <button
              onClick={handleTrade}
              disabled={isTrading || !tradeAmount}
              className={`w-full py-3 rounded font-semibold transition flex items-center justify-center gap-2 ${
                tradeAction === 'buy'
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isTrading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {tradeAction === 'buy' ? (
                    <ShoppingCart className="w-4 h-4" />
                  ) : (
                    <Minus className="w-4 h-4" />
                  )}
                  {tradeAction === 'buy' ? 'Buy' : 'Sell'} {symbol}
                </>
              )}
            </button>

            {/* Paper Trading Notice */}
            <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
              <Info className="w-3 h-3" />
              Paper trading mode - no real money
            </p>
          </motion.div>

          {/* Market Info */}
          <div className="bg-card border border-border rounded p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Market Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exchange</span>
                <span className="text-foreground">NASDAQ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Currency</span>
                <span className="text-foreground">USD</span>
              </div>
              {mounted && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="text-foreground">{new Date().toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
