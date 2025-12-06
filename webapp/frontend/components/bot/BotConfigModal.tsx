'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Bot, 
  DollarSign, 
  Clock, 
  Target, 
  TrendingUp,
  AlertTriangle,
  Play,
  Settings,
  Zap
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import { useToast } from '@/components/ui/Toast';

interface BotConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BOT_CONFIG_KEY = 'bot_config';

export default function BotConfigModal({ isOpen, onClose }: BotConfigModalProps) {
  const { botStatus, startBot, stopBot, fetchBotStatus } = useDashboardStore();
  const toast = useToast();
  
  const [config, setConfig] = useState({
    investment_amount: 1000,
    per_trade_amount: 100,
    max_positions: 10,
    run_duration_hours: 24,
    trade_frequency_minutes: 60,
    use_ai_signals: true,
    min_signal_strength: 0.01,
    stop_loss_pct: 5,
    take_profit_pct: 10
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Load config from localStorage first, then override with bot status if running
    const savedConfig = localStorage.getItem(BOT_CONFIG_KEY);
    if (savedConfig) {
      try {
        setConfig(prev => ({ ...prev, ...JSON.parse(savedConfig) }));
      } catch {}
    }
    
    // If bot has active config, use that
    if (botStatus?.config) {
      setConfig(prev => ({ ...prev, ...botStatus.config }));
    }
  }, [botStatus]);

  // Save config to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(BOT_CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  const handleStartBot = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await startBot(config);
      setSuccess('Trading bot started successfully!');
      toast.success('Bot Started', 'Trading bot is now running with your configuration');
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to start bot');
      toast.error('Failed to Start Bot', err.message || 'Please check your configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopBot = async () => {
    setIsLoading(true);
    try {
      await stopBot();
      setSuccess('Bot stopped');
      toast.warning('Bot Stopped', 'Trading bot has been stopped');
      fetchBotStatus();
    } catch (err) {
      setError('Failed to stop bot');
      toast.error('Failed to Stop Bot', 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isRunning = botStatus?.running;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-border w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 flex items-center justify-center ${
                isRunning ? 'bg-profit/20' : 'bg-muted'
              }`}>
                <Bot className={`w-6 h-6 ${isRunning ? 'text-profit' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Trading Bot</h2>
                <p className={`text-sm ${isRunning ? 'text-profit' : 'text-muted-foreground'}`}>
                  {isRunning ? '● Running' : '○ Stopped'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted transition"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Alpaca Status */}
          <div className="p-4 border-b border-border bg-background">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Alpaca Connection</span>
              <span className={`flex items-center gap-2 text-sm ${
                botStatus?.alpaca_connected ? 'text-profit' : 'text-loss'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  botStatus?.alpaca_connected ? 'bg-profit' : 'bg-loss'
                }`} />
                {botStatus?.alpaca_connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {botStatus?.alpaca_account && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Cash: </span>
                  <span className="text-foreground">${botStatus.alpaca_account.cash?.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Buying Power: </span>
                  <span className="text-foreground">${botStatus.alpaca_account.buying_power?.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Configuration */}
          <div className="p-6 space-y-5">
            <h3 className="text-foreground font-medium flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted-foreground" />
              Bot Configuration
            </h3>

            {/* Investment Amount */}
            <div>
              <label className="block text-muted-foreground text-sm mb-2">
                Total Investment Amount
              </label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="number"
                  value={config.investment_amount}
                  onChange={(e) => setConfig(prev => ({ ...prev, investment_amount: Number(e.target.value) }))}
                  className="w-full bg-muted border border-border pl-12 pr-4 py-3 text-foreground focus:outline-none focus:border-muted-foreground"
                  placeholder="1000"
                  disabled={isRunning}
                />
              </div>
              <p className="text-muted-foreground text-xs mt-1">Maximum amount the bot will invest</p>
            </div>

            {/* Per Trade Amount */}
            <div>
              <label className="block text-muted-foreground text-sm mb-2">
                Amount Per Trade
              </label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="number"
                  value={config.per_trade_amount}
                  onChange={(e) => setConfig(prev => ({ ...prev, per_trade_amount: Number(e.target.value) }))}
                  className="w-full bg-muted border border-border pl-12 pr-4 py-3 text-foreground focus:outline-none focus:border-muted-foreground"
                  placeholder="100"
                  disabled={isRunning}
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-muted-foreground text-sm mb-2">
                Run Duration (hours)
              </label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="number"
                  value={config.run_duration_hours}
                  onChange={(e) => setConfig(prev => ({ ...prev, run_duration_hours: Number(e.target.value) }))}
                  className="w-full bg-muted border border-border pl-12 pr-4 py-3 text-foreground focus:outline-none focus:border-muted-foreground"
                  placeholder="24"
                  disabled={isRunning}
                />
              </div>
              <p className="text-muted-foreground text-xs mt-1">0 = run indefinitely</p>
            </div>

            {/* Max Positions */}
            <div>
              <label className="block text-muted-foreground text-sm mb-2">
                Maximum Positions
              </label>
              <div className="relative">
                <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="number"
                  value={config.max_positions}
                  onChange={(e) => setConfig(prev => ({ ...prev, max_positions: Number(e.target.value) }))}
                  className="w-full bg-muted border border-border pl-12 pr-4 py-3 text-foreground focus:outline-none focus:border-muted-foreground"
                  placeholder="10"
                  disabled={isRunning}
                />
              </div>
            </div>

            {/* Risk Management */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-muted-foreground text-sm mb-2">
                  Stop Loss %
                </label>
                <div className="relative">
                  <AlertTriangle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-loss" />
                  <input
                    type="number"
                    value={config.stop_loss_pct}
                    onChange={(e) => setConfig(prev => ({ ...prev, stop_loss_pct: Number(e.target.value) }))}
                    className="w-full bg-muted border border-border pl-11 pr-4 py-3 text-foreground focus:outline-none focus:border-muted-foreground"
                    disabled={isRunning}
                  />
                </div>
              </div>
              <div>
                <label className="block text-muted-foreground text-sm mb-2">
                  Take Profit %
                </label>
                <div className="relative">
                  <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-profit" />
                  <input
                    type="number"
                    value={config.take_profit_pct}
                    onChange={(e) => setConfig(prev => ({ ...prev, take_profit_pct: Number(e.target.value) }))}
                    className="w-full bg-muted border border-border pl-11 pr-4 py-3 text-foreground focus:outline-none focus:border-muted-foreground"
                    disabled={isRunning}
                  />
                </div>
              </div>
            </div>

            {/* AI Signals Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-warning" />
                <div>
                  <p className="text-foreground text-sm font-medium">Use AI Signals</p>
                  <p className="text-muted-foreground text-xs">Trade based on AI recommendations</p>
                </div>
              </div>
              <button
                onClick={() => setConfig(prev => ({ ...prev, use_ai_signals: !prev.use_ai_signals }))}
                disabled={isRunning}
                className={`w-12 h-6 transition ${
                  config.use_ai_signals ? 'bg-neutral-800 dark:bg-neutral-200' : 'bg-neutral-400'
                } ${isRunning ? 'opacity-50' : ''}`}
              >
                <div className={`w-5 h-5 bg-white dark:bg-neutral-900 transition-transform ${
                  config.use_ai_signals ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="p-4 bg-loss/10 border border-loss/30">
                <p className="text-loss text-sm">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="p-4 bg-profit/10 border border-profit/30">
                <p className="text-profit text-sm">{success}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border flex gap-3">
            {isRunning ? (
              <button
                onClick={handleStopBot}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-loss hover:bg-loss/80 text-white font-semibold transition disabled:opacity-50"
              >
                Stop Bot
              </button>
            ) : (
              <button
                onClick={handleStartBot}
                disabled={isLoading || !botStatus?.alpaca_connected}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-profit hover:bg-profit/80 text-white font-semibold transition disabled:opacity-50"
              >
                <Play className="w-5 h-5" />
                {isLoading ? 'Starting...' : 'Start Bot'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-6 py-3 bg-muted hover:bg-border text-foreground transition"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
