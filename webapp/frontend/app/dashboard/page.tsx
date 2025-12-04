'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Bot,
  Wallet,
  Activity,
  Settings,
  ExternalLink,
  Shield,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import EnhancedChart from '@/components/charts/EnhancedChart';
import InvestModal from '@/components/invest/InvestModal';
import StockLogo from '@/components/ui/StockLogo';
// Watchlist removed from dashboard
import EquityChart from '@/components/dashboard/EquityChart';
import BotConfigModal from '@/components/bot/BotConfigModal';
import DataFreshnessIndicator from '@/components/ui/DataFreshnessIndicator';
import { Skeleton, CardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { Recommendation } from '@/lib/types';
import { useAppSettings } from '@/hooks/useAppSettings';
import MarketTicker from '@/components/ui/MarketTicker';
import MiniSparkline from '@/components/ui/MiniSparkline';

// Stock colors mapping
const stockColors: Record<string, { bg: string; color: string }> = {
  AAPL: { bg: 'from-gray-500 to-gray-600', color: 'text-gray-400' },
  NVDA: { bg: 'from-green-500 to-emerald-500', color: 'text-green-400' },
  TSLA: { bg: 'from-red-500 to-rose-500', color: 'text-red-400' },
  MSFT: { bg: 'from-slate-500 to-gray-600', color: 'text-slate-400' },
  GOOGL: { bg: 'from-yellow-500 to-amber-500', color: 'text-yellow-400' },
  AMZN: { bg: 'from-orange-500 to-amber-500', color: 'text-orange-400' },
  META: { bg: 'from-slate-400 to-gray-600', color: 'text-slate-400' },
  SPY: { bg: 'from-purple-500 to-violet-500', color: 'text-purple-400' },
  QQQ: { bg: 'from-cyan-500 to-teal-500', color: 'text-cyan-400' },
  AMD: { bg: 'from-red-600 to-red-700', color: 'text-red-400' },
};

export default function DashboardPage() {
  const [selectedStock, setSelectedStock] = useState<string>('AAPL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [showBotConfig, setShowBotConfig] = useState(false);
  const [investMode, setInvestMode] = useState<'single' | 'batch'>('batch');
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [stockGridPage, setStockGridPage] = useState(0); // For 2x2 grid pagination
  
  const router = useRouter();
  
  const { 
    portfolio,
    totalBalance, 
    availableCash,
    fetchPortfolio, 
    fetchBotStatus, 
    fetchRecommendations,
    fetchBacktest,
    botStatus,
    recommendations,
    backtest,
    loadingStates,
    initializeFromStorage
  } = useDashboardStore();

  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initializeFromStorage();
    fetchPortfolio();
    fetchBotStatus();
    fetchRecommendations();
    fetchBacktest();
    setLastUpdate(new Date());
    // No auto-refresh - use manual refresh or WebSocket for updates
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchPortfolio(),
      fetchBotStatus(),
      fetchRecommendations(),
      fetchBacktest()
    ]);
    setLastUpdate(new Date());
    setIsRefreshing(false);
  };

  const handleInvestClick = (rec: Recommendation) => {
    setSelectedRecommendation(rec);
    setInvestMode('single');
    setShowInvestModal(true);
  };

  const handleBatchInvest = () => {
    setSelectedRecommendation(null);
    setInvestMode('batch');
    setShowInvestModal(true);
  };

  const longRecommendations = recommendations.filter(r => r.direction === 'LONG');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header with Actions */}
        <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">AI-Powered Stock Trading</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Live Indicator */}
            <DataFreshnessIndicator 
              lastUpdate={lastUpdate} 
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
            />
            <button
              onClick={handleBatchInvest}
              className="flex items-center gap-2 px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded transition"
            >
              <DollarSign className="w-5 h-5" />
              Smart Invest
            </button>
          </div>
        </motion.div>

        {/* Top Row - Portfolio Card + Top Stocks */}
        <div className="grid grid-cols-12 gap-6">
          {/* Portfolio Card */}
          <motion.div
            variants={itemVariants}
            className="col-span-12 lg:col-span-5 bg-card border border-border rounded p-6"
          >
            {loadingStates.portfolio ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton width={120} height={14} />
                    <Skeleton width={180} height={32} />
                  </div>
                  <Skeleton width={100} height={28} className="rounded-full" />
                </div>
                <div className="space-y-3">
                  <Skeleton height={70} />
                  <Skeleton height={70} />
                </div>
                <div className="pt-4 border-t border-border">
                  <Skeleton width={150} height={12} className="mb-3" />
                  <div className="grid grid-cols-3 gap-3">
                    <Skeleton height={40} />
                    <Skeleton height={40} />
                    <Skeleton height={40} />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Total Portfolio Value</p>
                    <h2 className="text-3xl font-bold text-foreground">
                      ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h2>
                  </div>
                  {portfolio && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                      ((portfolio as any).daily_pnl_pct || 0) >= 0 
                        ? 'bg-emerald-500/10' 
                        : 'bg-red-500/10'
                    }`}>
                      {((portfolio as any).daily_pnl_pct || 0) >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`text-sm font-medium ${
                        ((portfolio as any).daily_pnl_pct || 0) >= 0 
                          ? 'text-emerald-400' 
                          : 'text-red-400'
                      }`}>
                        {((portfolio as any).daily_pnl_pct || 0) >= 0 ? '+' : ''}{(Number.isFinite((portfolio as any).daily_pnl_pct) ? (portfolio as any).daily_pnl_pct : 0).toFixed(2)}% Today
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Portfolio Breakdown */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-500/20 rounded flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-foreground font-medium">Available Cash</p>
                        <p className="text-muted-foreground text-sm">Ready to invest</p>
                      </div>
                    </div>
                    <p className="text-xl font-bold text-foreground">${availableCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-muted rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500/20 rounded flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-foreground font-medium">Invested</p>
                        <p className="text-muted-foreground text-sm">{portfolio?.positions?.length || 0} positions</p>
                      </div>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      ${((totalBalance - availableCash) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                
                {/* Backtest Stats */}
                {backtest && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-muted-foreground text-xs mb-3">AI Model Performance (Backtest)</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <p className="text-emerald-400 font-bold">{backtest.sharpe_ratio}</p>
                        <p className="text-gray-500 text-xs">Sharpe Ratio</p>
                      </div>
                      <div className="text-center">
                        <p className="text-emerald-400 font-bold">{backtest.win_rate}%</p>
                        <p className="text-gray-500 text-xs">Win Rate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-red-400 font-bold">-{backtest.max_drawdown}%</p>
                        <p className="text-gray-500 text-xs">Max DD</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>

          {/* Top 4 AI Recommendations - 2x2 Grid with Mini Charts */}
          <motion.div 
            variants={itemVariants}
            className="col-span-12 lg:col-span-7"
          >
            {/* Header with Navigation */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">Top AI Picks</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {stockGridPage + 1} / {Math.ceil(recommendations.length / 4)}
                </span>
                <button
                  onClick={() => setStockGridPage(prev => Math.max(0, prev - 1))}
                  disabled={stockGridPage === 0}
                  className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setStockGridPage(prev => Math.min(Math.ceil(recommendations.length / 4) - 1, prev + 1))}
                  disabled={stockGridPage >= Math.ceil(recommendations.length / 4) - 1}
                  className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {loadingStates.recommendations ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Skeleton variant="circular" width={36} height={36} />
                        <div className="flex-1 space-y-2">
                          <Skeleton width="50%" height={14} />
                          <Skeleton width="30%" height={12} />
                        </div>
                        <Skeleton width={60} height={20} className="rounded-full" />
                      </div>
                      <Skeleton height={50} className="mb-3" />
                      <div className="flex justify-between">
                        <Skeleton width="40%" height={12} />
                        <Skeleton width="30%" height={12} />
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                recommendations.slice(stockGridPage * 4, stockGridPage * 4 + 4).map((rec, index) => {
                  const isPositive = rec.signal > 0;
                  const iconStyle = stockColors[rec.asset] || { bg: 'from-gray-500 to-gray-600', color: 'text-gray-400' };
                  
                  return (
                    <motion.div
                      key={rec.asset}
                      variants={itemVariants}
                      onClick={() => router.push(`/dashboard/stock/${rec.asset}`)}
                      className="bg-card border border-border rounded-lg p-4 hover:border-gray-500/50 transition-all cursor-pointer group"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <StockLogo symbol={rec.asset} size="sm" />
                          <div>
                            <p className="text-foreground font-semibold flex items-center gap-1 text-sm">
                              {rec.asset}
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </p>
                            <p className="text-muted-foreground text-xs">${rec.current_price?.toFixed(2)}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          rec.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 
                          rec.direction === 'SHORT' ? 'bg-red-500/20 text-red-400' : 
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {rec.direction}
                        </span>
                      </div>
                      
                      {/* Mini Chart */}
                      <div className="mb-3 flex justify-center">
                        <MiniSparkline 
                          symbol={rec.asset} 
                          width={140} 
                          height={50}
                          color={isPositive ? '#10b981' : '#ef4444'}
                        />
                      </div>
                      
                      {/* Stats */}
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="text-muted-foreground">AI Signal</p>
                          <p className={`font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPositive ? '+' : ''}{(rec.signal * 100).toFixed(2)}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Allocation</p>
                          <p className="text-foreground font-medium">{rec.weight_pct}%</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>

        {/* Quick Invest Section - Below Top Row */}
        <motion.div
          variants={itemVariants}
          className="bg-gradient-to-r from-emerald-500/10 via-card to-emerald-500/10 border border-emerald-500/20 rounded-lg p-6"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Smart Invest</h3>
                <p className="text-muted-foreground text-sm">Invest in AI-recommended stocks with one click</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Quick amounts */}
              {[100, 500, 1000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => {
                    setInvestMode('batch');
                    setShowInvestModal(true);
                  }}
                  className="px-4 py-2 bg-card border border-border hover:border-emerald-500/50 rounded-lg text-foreground font-medium transition-all hover:bg-emerald-500/10"
                >
                  ${amount}
                </button>
              ))}
              <button
                onClick={handleBatchInvest}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
              >
                <DollarSign className="w-4 h-4" />
                Custom Amount
              </button>
            </div>
          </div>
        </motion.div>

        {/* Bottom Row - Trading Chart + All Recommendations */}
        <div className="grid grid-cols-12 gap-6">
          {/* Main Trading Chart - Enhanced with Candlestick/Line Toggle & Timeframes */}
          <motion.div
            variants={itemVariants}
            className="col-span-12 xl:col-span-8"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-foreground">Price Chart</h3>
              </div>
              
              {/* Stock Selector */}
              <select
                value={selectedStock}
                onChange={(e) => setSelectedStock(e.target.value)}
                className="bg-card border border-border text-foreground px-4 py-2 rounded focus:outline-none focus:border-gray-500"
              >
                {recommendations.map((rec) => (
                  <option key={rec.asset} value={rec.asset}>{rec.asset}</option>
                ))}
              </select>
            </div>
            
            {/* Enhanced Chart with Candlestick/Line Toggle & Real Timeframes */}
            <EnhancedChart 
              symbol={selectedStock} 
              height={480}
              initialInterval="1d"
            />
          </motion.div>

          {/* AI Recommendations List */}
          <motion.div
            variants={itemVariants}
            className="col-span-12 xl:col-span-4 bg-card border border-border rounded overflow-hidden"
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-foreground font-semibold">AI Recommendations</h3>
              </div>
              <p className="text-muted-foreground text-xs mt-1">Based on XGBoost Walk-Forward Model</p>
            </div>

            <div className="p-4 space-y-2 max-h-[440px] overflow-y-auto">
              {recommendations.map((rec, index) => {
                const isPositive = rec.signal > 0;
                return (
                  <motion.div
                    key={rec.asset}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleInvestClick(rec)}
                    className="flex items-center justify-between p-3 rounded hover:bg-muted transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <StockLogo symbol={rec.asset} size="sm" />
                      <div>
                        <span className="text-foreground font-medium">{rec.asset}</span>
                        <p className="text-muted-foreground text-xs">${rec.current_price?.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{(rec.signal * 100).toFixed(2)}%
                      </p>
                      <p className={`text-xs px-1.5 py-0.5 rounded ${
                        rec.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 
                        rec.direction === 'SHORT' ? 'bg-red-500/20 text-red-400' : 
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {rec.direction}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Quick Stats Row */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-card border border-border rounded p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded bg-gray-500/10 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Total Balance</p>
              <p className="text-foreground text-lg font-semibold">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          
          <div 
            onClick={() => setShowBotConfig(true)}
            className="bg-card border border-border rounded p-5 flex items-center gap-4 cursor-pointer hover:bg-muted transition"
          >
            <div className={`w-12 h-12 rounded ${botStatus?.running ? 'bg-green-500/10' : botStatus?.alpaca_connected ? 'bg-emerald-500/10' : 'bg-gray-500/10'} flex items-center justify-center`}>
              <Bot className={`w-6 h-6 ${botStatus?.running ? 'text-green-400 animate-pulse' : botStatus?.alpaca_connected ? 'text-emerald-400' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1">
              <p className="text-muted-foreground text-sm">Trading Bot</p>
              <p className={`text-lg font-semibold ${botStatus?.running ? 'text-green-400' : 'text-foreground'}`}>
                {botStatus?.running ? 'Running' : botStatus?.alpaca_connected ? 'Ready' : 'Disconnected'}
              </p>
            </div>
            <Settings className="w-5 h-5 text-gray-500" />
          </div>
          
          <div className="bg-card border border-border rounded p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded bg-purple-500/10 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Positions</p>
              <p className="text-foreground text-lg font-semibold">{portfolio?.positions?.length || 0}</p>
            </div>
          </div>
          
          <div className="bg-card border border-border rounded p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded bg-amber-500/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">AI Signals</p>
              <p className="text-foreground text-lg font-semibold">{longRecommendations.length} LONG</p>
            </div>
          </div>

          <div 
            onClick={() => router.push('/stress-test')}
            className="bg-card border border-border rounded p-5 flex items-center gap-4 cursor-pointer hover:bg-muted transition group"
          >
            <div className="w-12 h-12 rounded bg-purple-500/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-muted-foreground text-sm">Risk Analysis</p>
              <p className="text-foreground text-lg font-semibold group-hover:text-purple-400 transition">Stress Test</p>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-purple-400 transition" />
          </div>
        </motion.div>

        {/* Equity Chart - Full Width */}
        <motion.div variants={itemVariants} className="w-full">
          <EquityChart />
        </motion.div>
      </motion.div>

      {/* Investment Modal */}
      <InvestModal
        isOpen={showInvestModal}
        onClose={() => setShowInvestModal(false)}
        mode={investMode}
        stock={selectedRecommendation}
      />

      {/* Bot Configuration Modal */}
      <BotConfigModal
        isOpen={showBotConfig}
        onClose={() => setShowBotConfig(false)}
      />
    </>
  );
}
