'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  Play,
  Pause,
  Settings,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  RefreshCw,
  Clock,
  Target,
  Shield,
  BarChart3,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import { Skeleton } from '@/components/ui/Skeleton';

export default function TradingBotPage() {
  const { 
    botStatus, 
    recommendations,
    backtest,
    fetchBotStatus, 
    fetchRecommendations,
    fetchBacktest,
    startBot, 
    stopBot,
    loadingStates,
    initializeFromStorage 
  } = useDashboardStore();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initializeFromStorage();
    fetchBotStatus();
    fetchRecommendations();
    fetchBacktest();
    setLastUpdate(new Date());
    // No auto-refresh - use manual refresh or WebSocket for updates
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchBotStatus(), fetchRecommendations(), fetchBacktest()]);
    setLastUpdate(new Date());
    setIsRefreshing(false);
  };

  const handleToggleBot = async () => {
    setIsToggling(true);
    try {
      if (botStatus?.running) {
        await stopBot();
      } else {
        await startBot();
      }
      await fetchBotStatus();
    } catch (error) {
      console.error('Failed to toggle bot:', error);
    }
    setIsToggling(false);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const longSignals = recommendations.filter(r => r.direction === 'LONG');
  const shortSignals = recommendations.filter(r => r.direction === 'SHORT');
  const neutralSignals = recommendations.filter(r => r.direction === 'NEUTRAL');

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      style={{ paddingTop: '40px' }}
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trading Bot</h1>
          <p className="text-muted-foreground text-sm mt-1">AI-powered automated trading system</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live Indicator */}
          <div className="flex items-center gap-2 px-3 py-2 bg-card rounded border border-border">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${botStatus?.running ? 'bg-green-400' : 'bg-neutral-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${botStatus?.running ? 'bg-green-500' : 'bg-neutral-500'}`}></span>
            </span>
            <span className={`text-sm font-medium ${botStatus?.running ? 'text-green-400' : 'text-muted-foreground'}`}>
              {botStatus?.running ? 'RUNNING' : 'STOPPED'}
            </span>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-card-secondary text-foreground rounded transition border border-border"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Bot Control Card */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-br from-gray-700 to-gray-900 rounded p-8 relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-24 -translate-x-24" />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-white/20 rounded flex items-center justify-center">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">AI Trading Bot</h2>
              <p className="text-white/70">XGBoost Walk-Forward Strategy</p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <Zap className={`w-4 h-4 ${botStatus?.alpaca_connected ? 'text-green-300' : 'text-yellow-300'}`} />
                  <span className="text-white/80 text-sm">
                    {botStatus?.alpaca_connected ? 'Alpaca Connected' : 'Paper Trading'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-white/70" />
                  <span className="text-white/80 text-sm">{botStatus?.assets_tracked || 15} Assets</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleToggleBot}
            disabled={isToggling}
            className={`flex items-center gap-3 px-8 py-4 rounded font-semibold transition ${
              botStatus?.running
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-800'
            } ${isToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isToggling ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : botStatus?.running ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            {botStatus?.running ? 'Stop Bot' : 'Start Bot'}
          </button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {loadingStates.botStatus || loadingStates.recommendations ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card border border-border rounded p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton variant="circular" width={40} height={40} />
                  <Skeleton width={100} height={14} />
                </div>
                <Skeleton width={60} height={28} />
                <Skeleton width={120} height={12} />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="bg-card border border-border rounded p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-muted-foreground text-sm">LONG Signals</p>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{longSignals.length}</p>
              <p className="text-muted text-xs mt-1">Bullish recommendations</p>
            </div>

            <div className="bg-card border border-border rounded p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-500/20 rounded flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-muted-foreground text-sm">SHORT Signals</p>
              </div>
              <p className="text-2xl font-bold text-red-400">{shortSignals.length}</p>
              <p className="text-muted text-xs mt-1">Bearish recommendations</p>
            </div>

            <div className="bg-card border border-border rounded p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-neutral-500/20 rounded flex items-center justify-center">
                  <Activity className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">Trades Today</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{botStatus?.trades_today || 0}</p>
              <p className="text-muted text-xs mt-1">Executed trades</p>
            </div>

            <div className="bg-card border border-border rounded p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-muted-foreground text-sm">Next Rebalance</p>
              </div>
              <p className="text-lg font-bold text-foreground">{botStatus?.next_rebalance || 'N/A'}</p>
              <p className="text-muted text-xs mt-1">Scheduled update</p>
            </div>
          </>
        )}
      </motion.div>

      {/* Model Performance & Current Signals */}
      <div className="grid grid-cols-12 gap-6">
        {/* Model Performance */}
        <motion.div
          variants={itemVariants}
          className="col-span-12 lg:col-span-5 bg-card border border-border rounded p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Model Performance</h3>
          </div>

          {backtest ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-card-secondary rounded">
                <span className="text-muted-foreground">Annual Return</span>
                <span className={`text-xl font-bold ${backtest.annual_return >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {backtest.annual_return >= 0 ? '+' : ''}{backtest.annual_return}%
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-card-secondary rounded">
                <span className="text-muted-foreground">Sharpe Ratio</span>
                <span className="text-xl font-bold text-foreground">{backtest.sharpe_ratio}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-card-secondary rounded">
                <span className="text-muted-foreground">Win Rate</span>
                <span className="text-xl font-bold text-emerald-400">{backtest.win_rate}%</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-card-secondary rounded">
                <span className="text-muted-foreground">Max Drawdown</span>
                <span className="text-xl font-bold text-red-400">-{backtest.max_drawdown}%</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-card-secondary rounded">
                <span className="text-muted-foreground">Total Return</span>
                <span className={`text-xl font-bold ${backtest.total_return >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {backtest.total_return >= 0 ? '+' : ''}{backtest.total_return}%
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-muted">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Loading performance data...</p>
            </div>
          )}
        </motion.div>

        {/* Current Signals */}
        <motion.div
          variants={itemVariants}
          className="col-span-12 lg:col-span-7 bg-card border border-border rounded overflow-hidden"
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">Current AI Signals</h3>
            </div>
            <span className="text-muted text-sm">Updated: {mounted ? lastUpdate.toLocaleTimeString() : '--:--:--'}</span>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {recommendations.length > 0 ? (
              <table className="w-full">
                <thead className="bg-card-secondary sticky top-0">
                  <tr>
                    <th className="text-left text-muted-foreground text-xs font-medium px-4 py-3">Asset</th>
                    <th className="text-left text-muted-foreground text-xs font-medium px-4 py-3">Signal</th>
                    <th className="text-left text-muted-foreground text-xs font-medium px-4 py-3">Direction</th>
                    <th className="text-right text-muted-foreground text-xs font-medium px-4 py-3">Weight</th>
                    <th className="text-right text-muted-foreground text-xs font-medium px-4 py-3">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recommendations.map((rec) => (
                    <tr key={rec.asset} className="hover:bg-card-secondary/50 transition">
                      <td className="px-4 py-3">
                        <span className="text-foreground font-medium">{rec.asset}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${rec.signal > 0 ? 'text-emerald-400' : rec.signal < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                          {rec.signal > 0 ? '+' : ''}{(rec.signal * 100).toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          rec.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' :
                          rec.direction === 'SHORT' ? 'bg-red-500/20 text-red-400' :
                          'bg-neutral-500/20 text-muted-foreground'
                        }`}>
                          {rec.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-foreground">{rec.weight_pct}%</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-muted-foreground">${rec.current_price?.toFixed(2)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-10 text-muted">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No signals available</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Bot Settings */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Bot Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <h4 className="text-gray-400 text-sm font-medium">Strategy</h4>
            <div className="bg-[#151519] rounded p-4">
              <p className="text-white font-medium">{botStatus?.strategy || 'XGBoost Walk-Forward'}</p>
              <p className="text-gray-500 text-sm mt-1">5-day prediction horizon</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-gray-400 text-sm font-medium">Trading Mode</h4>
            <div className="bg-[#151519] rounded p-4">
              <div className="flex items-center gap-2">
                <Shield className={`w-5 h-5 ${botStatus?.mode === 'paper' ? 'text-amber-400' : 'text-emerald-400'}`} />
                <p className="text-white font-medium">{botStatus?.mode === 'paper' ? 'Paper Trading' : 'Live Trading'}</p>
              </div>
              <p className="text-gray-500 text-sm mt-1">No real money at risk</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-gray-400 text-sm font-medium">Connection Status</h4>
            <div className="bg-[#151519] rounded p-4">
              <div className="flex items-center gap-2">
                {botStatus?.alpaca_connected ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <p className="text-white font-medium">
                  {botStatus?.alpaca_connected ? 'Alpaca Connected' : 'Disconnected'}
                </p>
              </div>
              <p className="text-gray-500 text-sm mt-1">
                {botStatus?.alpaca_account?.status || 'Paper trading mode'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
