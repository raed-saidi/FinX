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
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showMarketClosedModal, setShowMarketClosedModal] = useState(false);
  const [config, setConfig] = useState({
    investment_amount: 10000,
    per_trade_amount: 1000,
    max_positions: 5,
    run_duration_hours: 24,
    trade_frequency_minutes: 60,
    use_ai_signals: true,
    min_signal_strength: 0.3,
    stop_loss_pct: 5.0,
    take_profit_pct: 10.0,
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    setMounted(true);
    initializeFromStorage();
    fetchBotStatus();
    fetchRecommendations();
    fetchBacktest();
    setLastUpdate(new Date());
    // No auto-refresh - use manual refresh or WebSocket for updates
  }, []);

  useEffect(() => {
    // Load config from botStatus when available
    if (botStatus?.config) {
      setConfig(botStatus.config);
    }
  }, [botStatus]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchBotStatus(), fetchRecommendations(), fetchBacktest()]);
    setLastUpdate(new Date());
    setIsRefreshing(false);
  };

  const handleToggleBot = async () => {
    // Check if trying to start bot - show market closed message
    if (!botStatus?.running) {
      setShowMarketClosedModal(true);
      return;
    }
    
    // Allow stopping the bot
    setIsToggling(true);
    try {
      await stopBot();
      await fetchBotStatus();
    } catch (error) {
      console.error('Failed to stop bot:', error);
    }
    setIsToggling(false);
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/bot/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        await fetchBotStatus();
        setShowConfigModal(false);
      } else {
        console.error('Failed to save config');
      }
    } catch (error) {
      console.error('Error saving config:', error);
    } finally {
      setIsSavingConfig(false);
    }
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

      {/* Bot Configuration */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Bot Configuration</h3>
          </div>
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition text-sm font-medium"
          >
            <Settings className="w-4 h-4" />
            Configure
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <h4 className="text-muted-foreground text-sm font-medium">Strategy</h4>
            <div className="bg-card-secondary rounded p-4">
              <p className="text-foreground font-medium">{botStatus?.strategy || 'XGBoost Walk-Forward'}</p>
              <p className="text-muted text-sm mt-1">5-day prediction horizon</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-muted-foreground text-sm font-medium">Trading Mode</h4>
            <div className="bg-card-secondary rounded p-4">
              <div className="flex items-center gap-2">
                <Shield className={`w-5 h-5 ${botStatus?.mode === 'paper' ? 'text-amber-400' : 'text-emerald-400'}`} />
                <p className="text-foreground font-medium">{botStatus?.mode === 'paper' ? 'Paper Trading' : 'Live Trading'}</p>
              </div>
              <p className="text-muted text-sm mt-1">No real money at risk</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-muted-foreground text-sm font-medium">Connection Status</h4>
            <div className="bg-card-secondary rounded p-4">
              <div className="flex items-center gap-2">
                {botStatus?.alpaca_connected ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <p className="text-foreground font-medium">
                  {botStatus?.alpaca_connected ? 'Alpaca Connected' : 'Disconnected'}
                </p>
              </div>
              <p className="text-muted text-sm mt-1">
                {botStatus?.alpaca_account?.status || 'Paper trading mode'}
              </p>
            </div>
          </div>
        </div>

        {/* Current Configuration Display */}
        {config && (
          <div className="mt-6 pt-6 border-t border-border">
            <h4 className="text-muted-foreground text-sm font-medium mb-4">Current Settings</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-card-secondary rounded p-3">
                <p className="text-muted text-xs mb-1">Investment Amount</p>
                <p className="text-foreground font-semibold">${config.investment_amount.toLocaleString()}</p>
              </div>
              <div className="bg-card-secondary rounded p-3">
                <p className="text-muted text-xs mb-1">Per Trade Amount</p>
                <p className="text-foreground font-semibold">${config.per_trade_amount.toLocaleString()}</p>
              </div>
              <div className="bg-card-secondary rounded p-3">
                <p className="text-muted text-xs mb-1">Max Positions</p>
                <p className="text-foreground font-semibold">{config.max_positions}</p>
              </div>
              <div className="bg-card-secondary rounded p-3">
                <p className="text-muted text-xs mb-1">Min Signal Strength</p>
                <p className="text-foreground font-semibold">{(config.min_signal_strength * 100).toFixed(0)}%</p>
              </div>
              <div className="bg-card-secondary rounded p-3">
                <p className="text-muted text-xs mb-1">Stop Loss</p>
                <p className="text-red-400 font-semibold">{config.stop_loss_pct}%</p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="w-6 h-6 text-blue-400" />
                  <h2 className="text-xl font-bold text-foreground">Bot Configuration</h2>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-muted-foreground hover:text-foreground transition"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Investment Settings */}
              <div>
                <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  Investment Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Total Investment Amount ($)</label>
                    <input
                      type="number"
                      value={config.investment_amount}
                      onChange={(e) => setConfig({ ...config, investment_amount: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 bg-card-secondary border border-border rounded text-foreground focus:border-blue-500 focus:outline-none"
                      min="1000"
                      step="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Per Trade Amount ($)</label>
                    <input
                      type="number"
                      value={config.per_trade_amount}
                      onChange={(e) => setConfig({ ...config, per_trade_amount: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 bg-card-secondary border border-border rounded text-foreground focus:border-blue-500 focus:outline-none"
                      min="100"
                      step="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Max Positions</label>
                    <input
                      type="number"
                      value={config.max_positions}
                      onChange={(e) => setConfig({ ...config, max_positions: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-card-secondary border border-border rounded text-foreground focus:border-blue-500 focus:outline-none"
                      min="1"
                      max="15"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Min Signal Strength (%)</label>
                    <input
                      type="number"
                      value={config.min_signal_strength * 100}
                      onChange={(e) => setConfig({ ...config, min_signal_strength: parseFloat(e.target.value) / 100 })}
                      className="w-full px-4 py-2 bg-card-secondary border border-border rounded text-foreground focus:border-blue-500 focus:outline-none"
                      min="0"
                      max="100"
                      step="5"
                    />
                  </div>
                </div>
              </div>

              {/* Risk Management */}
              <div>
                <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-400" />
                  Risk Management
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Stop Loss (%)</label>
                    <input
                      type="number"
                      value={config.stop_loss_pct}
                      onChange={(e) => setConfig({ ...config, stop_loss_pct: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 bg-card-secondary border border-border rounded text-foreground focus:border-blue-500 focus:outline-none"
                      min="1"
                      max="50"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Take Profit (%)</label>
                    <input
                      type="number"
                      value={config.take_profit_pct}
                      onChange={(e) => setConfig({ ...config, take_profit_pct: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 bg-card-secondary border border-border rounded text-foreground focus:border-blue-500 focus:outline-none"
                      min="1"
                      max="100"
                      step="0.5"
                    />
                  </div>
                </div>
              </div>

              {/* Timing Settings */}
              <div>
                <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-400" />
                  Timing Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Run Duration (hours)</label>
                    <input
                      type="number"
                      value={config.run_duration_hours}
                      onChange={(e) => setConfig({ ...config, run_duration_hours: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 bg-card-secondary border border-border rounded text-foreground focus:border-blue-500 focus:outline-none"
                      min="1"
                      max="168"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Trade Frequency (minutes)</label>
                    <input
                      type="number"
                      value={config.trade_frequency_minutes}
                      onChange={(e) => setConfig({ ...config, trade_frequency_minutes: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 bg-card-secondary border border-border rounded text-foreground focus:border-blue-500 focus:outline-none"
                      min="1"
                      max="1440"
                    />
                  </div>
                </div>
              </div>

              {/* AI Settings */}
              <div>
                <h3 className="text-foreground font-semibold mb-4 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-400" />
                  AI Settings
                </h3>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.use_ai_signals}
                    onChange={(e) => setConfig({ ...config, use_ai_signals: e.target.checked })}
                    className="w-5 h-5 rounded border-border bg-card-secondary"
                  />
                  <div>
                    <p className="text-foreground font-medium">Use AI Signals</p>
                    <p className="text-muted text-sm">Enable XGBoost model predictions for trading decisions</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border flex items-center justify-between gap-4">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-6 py-2 bg-card-secondary hover:bg-card text-foreground rounded transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSavingConfig ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Market Closed Modal */}
      {showMarketClosedModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-lg max-w-md w-full"
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Market Closed</h2>
                  <p className="text-sm text-muted-foreground">Trading Unavailable</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <p className="text-foreground">
                  The US stock market is currently closed. Trading is only available during market hours:
                </p>
                <div className="bg-card-secondary rounded p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Regular Trading Hours:</span>
                    <span className="text-foreground font-medium">9:30 AM - 4:00 PM EST</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Trading Days:</span>
                    <span className="text-foreground font-medium">Monday - Friday</span>
                  </div>
                </div>
                <p className="text-muted text-sm">
                  The bot will automatically start trading when the market opens. You can still configure settings and view AI signals while the market is closed.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowMarketClosedModal(false)}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition font-medium"
                >
                  Understood
                </button>
                <button
                  onClick={() => {
                    setShowMarketClosedModal(false);
                    setShowConfigModal(true);
                  }}
                  className="flex-1 px-4 py-2 bg-card-secondary hover:bg-card text-foreground rounded transition"
                >
                  Configure Settings
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
