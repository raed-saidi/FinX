'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Bot,
  Shield,
  Zap,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import InvestModal from '@/components/invest/InvestModal';
import { Skeleton } from '@/components/ui/Skeleton';

export default function WalletPage() {
  const { 
    totalBalance, 
    availableCash, 
    portfolio,
    botStatus,
    loadingStates,
    fetchPortfolio, 
    fetchBotStatus,
    initializeFromStorage 
  } = useDashboardStore();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initializeFromStorage();
    fetchPortfolio();
    fetchBotStatus();
  }, [initializeFromStorage, fetchPortfolio, fetchBotStatus]);

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-32 bg-card rounded animate-pulse" />
            <div className="h-4 w-48 bg-card rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-gray-700 to-gray-900 rounded p-8 h-64 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded p-5 h-32 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const investedAmount = totalBalance - availableCash;
  const positions = portfolio?.positions || [];
  const trades = portfolio?.trades || [];
  const isAlpacaSynced = (portfolio as any)?.alpaca_synced || false;
  const buyingPower = (portfolio as any)?.buying_power || availableCash;
  const equity = (portfolio as any)?.equity || totalBalance;
  const accountStatus = (portfolio as any)?.account_status || 'ACTIVE';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchPortfolio(), fetchBotStatus()]);
    setIsRefreshing(false);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  // Get recent trades (last 5)
  const recentTrades = [...trades].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  ).slice(0, 5);

  return (
    <>
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
            <h1 className="text-2xl font-bold text-foreground">Wallet</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your funds and investments</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Alpaca Sync Status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded border ${
              isAlpacaSynced 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              {isAlpacaSynced ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400" />
              )}
              <span className={`text-sm font-medium ${isAlpacaSynced ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isAlpacaSynced ? 'Alpaca Synced' : 'Simulated'}
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

        {/* Main Wallet Card */}
        <motion.div
          variants={itemVariants}
          className="bg-gradient-to-br from-gray-700 to-gray-900 rounded p-8 relative overflow-hidden"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-32 translate-x-32" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-24 -translate-x-24" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-white/20 rounded flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-sm">
                  {isAlpacaSynced ? 'Alpaca Portfolio Value' : 'Total Portfolio Value'}
                </p>
                {loadingStates.portfolio ? (
                  <Skeleton className="h-9 w-40 bg-white/20" />
                ) : (
                  <h2 className="text-3xl font-bold text-white">
                    ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </h2>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/10 rounded p-4">
                <p className="text-white/70 text-sm">Available Cash</p>
                {loadingStates.portfolio ? (
                  <Skeleton className="h-7 w-24 bg-white/20 mt-1" />
                ) : (
                  <p className="text-xl font-bold text-white">${availableCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                )}
              </div>
              <div className="bg-white/10 rounded p-4">
                <p className="text-white/70 text-sm">Buying Power</p>
                {loadingStates.portfolio ? (
                  <Skeleton className="h-7 w-24 bg-white/20 mt-1" />
                ) : (
                  <p className="text-xl font-bold text-white">${buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                )}
              </div>
              <div className="bg-white/10 rounded p-4">
                <p className="text-white/70 text-sm">Invested</p>
                {loadingStates.portfolio ? (
                  <Skeleton className="h-7 w-24 bg-white/20 mt-1" />
                ) : (
                  <p className="text-xl font-bold text-white">${investedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                )}
              </div>
              <div className="bg-white/10 rounded p-4">
                <p className="text-white/70 text-sm">Account Status</p>
                {loadingStates.portfolio ? (
                  <Skeleton className="h-7 w-20 bg-white/20 mt-1" />
                ) : (
                  <p className={`text-xl font-bold ${accountStatus === 'ACTIVE' ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {accountStatus}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowDepositModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white text-gray-800 font-semibold rounded hover:bg-white/90 transition"
              >
                <DollarSign className="w-5 h-5" />
                {isAlpacaSynced ? 'Account Info' : 'Add Funds'}
              </button>
              <button
                onClick={() => setShowInvestModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white/20 text-white font-semibold rounded hover:bg-white/30 transition border border-white/20"
              >
                <TrendingUp className="w-5 h-5" />
                Smart Invest
              </button>
            </div>
          </div>
        </motion.div>

        {/* Info Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Trading Status */}
          <div className="bg-card border border-border rounded p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded ${botStatus?.alpaca_connected ? 'bg-emerald-500/20' : 'bg-gray-500/20'} flex items-center justify-center`}>
                <Zap className={`w-5 h-5 ${botStatus?.alpaca_connected ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-foreground font-medium">Trading Status</p>
                {loadingStates.botStatus ? (
                  <Skeleton className="h-4 w-32 mt-1" />
                ) : (
                  <p className={`text-sm ${botStatus?.alpaca_connected ? 'text-emerald-400' : 'text-muted'}`}>
                    {botStatus?.alpaca_connected ? 'Connected to Alpaca' : 'Paper Trading Mode'}
                  </p>
                )}
              </div>
            </div>
            {loadingStates.botStatus ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ) : botStatus?.alpaca_account && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Buying Power</span>
                  <span className="text-foreground">${botStatus.alpaca_account.buying_power?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Portfolio Value</span>
                  <span className="text-foreground">${botStatus.alpaca_account.portfolio_value?.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Positions Summary */}
          <div className="bg-card border border-border rounded p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded bg-purple-500/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-foreground font-medium">Positions</p>
                {loadingStates.portfolio ? (
                  <Skeleton className="h-4 w-24 mt-1" />
                ) : (
                  <p className="text-muted text-sm">{positions.length} active holdings</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {loadingStates.portfolio ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))
              ) : (
                <>
                  {positions.slice(0, 3).map((pos) => (
                    <div key={pos.symbol} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{pos.symbol}</span>
                      <span className={(pos.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {(pos.pnl || 0) >= 0 ? '+' : ''}${(pos.pnl || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {positions.length > 3 && (
                    <p className="text-muted text-xs">+{positions.length - 3} more</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Security */}
          <div className="bg-card border border-border rounded p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded bg-amber-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-foreground font-medium">Security</p>
                <p className="text-emerald-400 text-sm">Protected</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-muted-foreground">Paper Trading Mode</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-muted-foreground">Real-time Prices</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-muted-foreground">AI Recommendations</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          variants={itemVariants}
          className="bg-card border border-border rounded overflow-hidden"
        >
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
          </div>

          {recentTrades.length > 0 ? (
            <div className="divide-y divide-border">
              {recentTrades.map((trade, index) => {
                const isBuy = trade.action === 'buy';
                const date = new Date(trade.timestamp);
                
                return (
                  <div
                    key={`${trade.symbol}-${trade.timestamp}-${index}`}
                    className="p-4 flex items-center justify-between hover:bg-card-secondary/50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded ${isBuy ? 'bg-emerald-500/20' : 'bg-red-500/20'} flex items-center justify-center`}>
                        {isBuy ? (
                          <ArrowDownRight className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-foreground font-medium">
                          {isBuy ? 'Bought' : 'Sold'} {trade.symbol}
                        </p>
                        <p className="text-muted text-sm">
                          {trade.shares.toFixed(4)} shares @ ${trade.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isBuy ? '-' : '+'}${trade.total.toFixed(2)}
                      </p>
                      <p className="text-muted text-sm">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-muted">
              <Wallet className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No recent activity</p>
              <p className="text-sm mt-1">Your trading activity will appear here</p>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Invest Modal */}
      <InvestModal
        isOpen={showInvestModal}
        onClose={() => setShowInvestModal(false)}
        mode="batch"
        stock={null}
      />

      {/* Deposit Modal / Account Info Modal */}
      <AnimatePresence>
        {showDepositModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDepositModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-foreground">
                  {isAlpacaSynced ? 'Alpaca Account' : 'Add Funds'}
                </h2>
                <button
                  onClick={() => setShowDepositModal(false)}
                  className="p-2 hover:bg-card-secondary rounded transition"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              
              {isAlpacaSynced ? (
                <>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-4 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <p className="text-emerald-400 font-medium">Connected to Alpaca Paper Trading</p>
                    </div>
                    <p className="text-gray-400 text-sm">
                      Your wallet is synced with your Alpaca paper trading account. All balances and positions are pulled directly from Alpaca.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between p-4 bg-card-secondary rounded">
                      <span className="text-muted-foreground">Portfolio Value</span>
                      <span className="text-foreground font-bold">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    
                    <div className="flex justify-between p-4 bg-card-secondary rounded">
                      <span className="text-muted-foreground">Cash Balance</span>
                      <span className="text-foreground font-bold">${availableCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    
                    <div className="flex justify-between p-4 bg-card-secondary rounded">
                      <span className="text-muted-foreground">Buying Power</span>
                      <span className="text-emerald-400 font-bold">${buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    
                    <div className="flex justify-between p-4 bg-card-secondary rounded">
                      <span className="text-muted-foreground">Equity</span>
                      <span className="text-foreground font-bold">${equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    
                    <div className="flex justify-between p-4 bg-card-secondary rounded">
                      <span className="text-muted-foreground">Account Status</span>
                      <span className={`font-bold ${accountStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {accountStatus}
                      </span>
                    </div>
                    
                    <div className="flex justify-between p-4 bg-card-secondary rounded">
                      <span className="text-muted-foreground">Open Positions</span>
                      <span className="text-foreground font-bold">{mounted ? positions.length : 0}</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-gray-500/10 border border-gray-500/20 rounded">
                    <p className="text-gray-400 text-sm">
                      <strong>Paper Trading:</strong> This is a simulated trading account. No real money is at risk.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gray-500/10 border border-gray-500/20 rounded p-4 mb-6">
                    <p className="text-gray-400 text-sm">
                      <strong>Paper Trading Mode:</strong> You have $100,000 in virtual funds to practice trading. 
                      This is a demo environment - no real money is involved.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between p-4 bg-card-secondary rounded">
                      <span className="text-muted-foreground">Available Balance</span>
                      <span className="text-foreground font-bold">${availableCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    
                    <div className="flex justify-between p-4 bg-card-secondary rounded">
                      <span className="text-muted-foreground">Starting Capital</span>
                      <span className="text-foreground font-bold">$100,000.00</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded">
                    <p className="text-amber-400 text-sm">
                      <strong>Connect Alpaca:</strong> To use real paper trading funds, ensure the backend is connected to Alpaca.
                    </p>
                  </div>
                </>
              )}
              
              <button
                onClick={() => setShowDepositModal(false)}
                className="w-full mt-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded transition"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
