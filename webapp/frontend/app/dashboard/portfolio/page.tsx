'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
  RefreshCw,
  DollarSign,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useDashboardStore } from '@/store/dashboard-store';
import InvestModal from '@/components/invest/InvestModal';
import StockLogo from '@/components/ui/StockLogo';
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { Position } from '@/lib/types';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EF4444', '#84CC16', '#F97316', '#14B8A6'];

// Memoized position row - only re-renders when position data actually changes
interface PositionRowProps {
  pos: Position;
  sellAmount: string;
  sellLoading: string | null;
  onSellAmountChange: (symbol: string, value: string) => void;
  onSell: (symbol: string) => void;
}

const PositionRow = memo(function PositionRow({ 
  pos, 
  sellAmount, 
  sellLoading, 
  onSellAmountChange, 
  onSell 
}: PositionRowProps) {
  const isPositive = (pos.pnl || 0) >= 0;
  
  return (
    <tr className="border-b border-border hover:bg-card-secondary/50 transition">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <StockLogo symbol={pos.symbol} size="sm" />
          <span className="text-foreground font-medium">{pos.symbol}</span>
        </div>
      </td>
      <td className="p-4 text-right text-foreground">{(pos.shares || 0).toFixed(4)}</td>
      <td className="p-4 text-right text-muted-foreground">${(pos.avg_price || pos.current_price || 0).toFixed(2)}</td>
      <td className="p-4 text-right text-foreground font-medium">${(pos.current_price || 0).toFixed(2)}</td>
      <td className="p-4 text-right text-foreground font-medium">${(pos.value || 0).toFixed(2)}</td>
      <td className="p-4 text-right">
        <div className={`flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          <span>{isPositive ? '+' : ''}${(pos.pnl || 0).toFixed(2)}</span>
          <span className="text-xs">({isPositive ? '+' : ''}{(pos.pnl_pct || 0).toFixed(1)}%)</span>
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="$"
            min="5"
            value={sellAmount}
            onChange={(e) => onSellAmountChange(pos.symbol, e.target.value)}
            className="w-20 bg-card-secondary border border-border rounded px-2 py-1 text-foreground text-sm focus:outline-none focus:border-red-500"
          />
          <button
            onClick={() => onSell(pos.symbol)}
            disabled={sellLoading === pos.symbol || parseFloat(sellAmount || '0') < 5}
            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sellLoading === pos.symbol ? '...' : 'Sell'}
          </button>
        </div>
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if price-related data changes
  return (
    prevProps.pos.current_price === nextProps.pos.current_price &&
    prevProps.pos.value === nextProps.pos.value &&
    prevProps.pos.pnl === nextProps.pos.pnl &&
    prevProps.pos.pnl_pct === nextProps.pos.pnl_pct &&
    prevProps.sellAmount === nextProps.sellAmount &&
    prevProps.sellLoading === nextProps.sellLoading
  );
});

export default function PortfolioPage() {
  const { 
    portfolio, 
    totalBalance, 
    availableCash, 
    fetchPortfolio, 
    fetchRecommendations,
    initializeFromStorage,
    loadingStates,
    executeTrade,
    updatePricesOnly
  } = useDashboardStore();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [sellAmount, setSellAmount] = useState<Record<string, string>>({});
  const [sellLoading, setSellLoading] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initializeFromStorage();
    fetchPortfolio();  // Full fetch on mount
    fetchRecommendations();
    setLastUpdate(new Date());
    
    // Optimized: Only update prices every 30 seconds (not full portfolio)
    // This prevents full page re-renders - only price values update
    const priceInterval = setInterval(() => {
      updatePricesOnly();
      setLastUpdate(new Date());
    }, 30000);
    
    // Full portfolio refresh every 5 minutes (for new positions, trades, etc.)
    const fullRefreshInterval = setInterval(() => {
      fetchPortfolio();
    }, 300000);
    
    return () => {
      clearInterval(priceInterval);
      clearInterval(fullRefreshInterval);
    };
  }, []);

  const positions = portfolio?.positions || [];
  const investedAmount = totalBalance - availableCash;

  const pieData = positions.map((pos, index) => ({
    name: pos.symbol,
    value: pos.value,
    color: COLORS[index % COLORS.length],
    allocation: ((pos.value / investedAmount) * 100).toFixed(1),
  }));

  // Only show stocks in allocation - no cash
  const totalPnL = positions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);
  const totalPnLPercent = investedAmount > 0 ? (totalPnL / investedAmount) * 100 : 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPortfolio();
    setIsRefreshing(false);
  };

  const handleSell = useCallback(async (symbol: string) => {
    const amount = parseFloat(sellAmount[symbol] || '0');
    if (amount < 5) return;
    
    setSellLoading(symbol);
    try {
      await executeTrade(symbol, 'sell', amount);
      setSellAmount({ ...sellAmount, [symbol]: '' });
    } catch (error) {
      console.error('Sell failed:', error);
    } finally {
      setSellLoading(null);
    }
  }, [sellAmount, executeTrade]);

  const handleSellAmountChange = useCallback((symbol: string, value: string) => {
    setSellAmount(prev => ({ ...prev, [symbol]: value }));
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded p-3 shadow-xl">
          <p className="text-foreground font-medium">{payload[0].name}</p>
          <p className="text-muted-foreground text-sm">
            ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({payload[0].payload.allocation}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
            <p className="text-muted-foreground text-sm mt-1">Track your investments and performance</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Live Indicator */}
            <div className="flex items-center gap-2 px-3 py-2 bg-card rounded border border-border">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-green-400 text-sm font-medium">LIVE</span>
              <span className="text-muted text-xs">
                {mounted ? lastUpdate.toLocaleTimeString() : '--:--:--'}
              </span>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-card-secondary text-foreground rounded transition border border-border"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowInvestModal(true)}
              className="flex items-center gap-2 px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded transition"
            >
              <DollarSign className="w-5 h-5" />
              Invest More
            </button>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {loadingStates.portfolio ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card border border-border rounded p-5 space-y-3">
                  <Skeleton width={100} height={14} />
                  <Skeleton width={140} height={28} />
                  <Skeleton width={80} height={14} />
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="bg-card border border-border rounded p-5">
                <p className="text-muted-foreground text-sm mb-2">Total Portfolio</p>
                <p className="text-2xl font-bold text-foreground">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <div className="flex items-center gap-1 mt-2 text-muted-foreground">
                  <BarChart3 className="w-4 h-4" />
                  <span className="text-sm">{positions.length} positions</span>
                </div>
              </div>

              <div className="bg-card border border-border rounded p-5">
                <p className="text-muted-foreground text-sm mb-2">Total P&L</p>
                <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <div className={`flex items-center gap-1 mt-2 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-sm">{totalPnL >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%</span>
                </div>
              </div>

              <div className="bg-card border border-border rounded p-5">
                <p className="text-muted-foreground text-sm mb-2">Invested</p>
                <p className="text-2xl font-bold text-foreground">${investedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p className="text-muted text-sm mt-2">Across {positions.length} stocks</p>
              </div>

              <div className="bg-card border border-border rounded p-5">
                <p className="text-muted-foreground text-sm mb-2">Available Cash</p>
                <p className="text-2xl font-bold text-muted-foreground">${availableCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p className="text-muted text-sm mt-2">Ready to invest</p>
              </div>
            </>
          )}
        </motion.div>

        {/* Charts Row */}
        <div className="grid grid-cols-12 gap-6">
          {/* Allocation Pie Chart */}
          <motion.div
            variants={itemVariants}
            className="col-span-12 lg:col-span-5 bg-card border border-border rounded p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <PieChartIcon className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">Asset Allocation</h3>
            </div>

            {pieData.length > 0 ? (
              <>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        onMouseEnter={(_, index) => setSelectedAsset(pieData[index].name)}
                        onMouseLeave={() => setSelectedAsset(null)}
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke="none"
                            style={{
                              filter: selectedAsset === entry.name ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' : 'none',
                              transform: selectedAsset === entry.name ? 'scale(1.05)' : 'scale(1)',
                              transformOrigin: 'center',
                              transition: 'all 0.2s ease',
                            }}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {pieData.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-2 p-2 rounded hover:bg-card-secondary transition cursor-pointer"
                      onMouseEnter={() => setSelectedAsset(item.name)}
                      onMouseLeave={() => setSelectedAsset(null)}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground text-sm">{item.name}</span>
                      <span className="text-foreground text-sm ml-auto">{item.allocation}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted">
                <PieChartIcon className="w-12 h-12 mb-4 opacity-30" />
                <p>No positions yet</p>
                <button
                  onClick={() => setShowInvestModal(true)}
                  className="mt-4 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition text-sm"
                >
                  Start Investing
                </button>
              </div>
            )}
          </motion.div>

          {/* Positions Table */}
          <motion.div
            variants={itemVariants}
            className="col-span-12 lg:col-span-7 bg-card border border-border rounded overflow-hidden"
          >
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-foreground">Your Positions</h3>
              </div>
            </div>

            {loadingStates.portfolio ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-2">
                    <Skeleton variant="circular" width={32} height={32} />
                    <div className="flex-1 space-y-2">
                      <Skeleton width="30%" height={14} />
                    </div>
                    <Skeleton width={60} height={14} />
                    <Skeleton width={60} height={14} />
                    <Skeleton width={80} height={14} />
                    <Skeleton width={70} height={24} />
                  </div>
                ))}
              </div>
            ) : positions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-muted-foreground text-sm font-medium p-4">Asset</th>
                      <th className="text-right text-muted-foreground text-sm font-medium p-4">Shares</th>
                      <th className="text-right text-muted-foreground text-sm font-medium p-4">Avg Price</th>
                      <th className="text-right text-muted-foreground text-sm font-medium p-4">Current</th>
                      <th className="text-right text-muted-foreground text-sm font-medium p-4">Value</th>
                      <th className="text-right text-muted-foreground text-sm font-medium p-4">P&L</th>
                      <th className="text-right text-muted-foreground text-sm font-medium p-4">Sell</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos) => (
                      <PositionRow
                        key={pos.symbol}
                        pos={pos}
                        sellAmount={sellAmount[pos.symbol] || ''}
                        sellLoading={sellLoading}
                        onSellAmountChange={handleSellAmountChange}
                        onSell={handleSell}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-muted">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="mb-4">No positions yet</p>
                <button
                  onClick={() => setShowInvestModal(true)}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition"
                >
                  Start Investing
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* Investment Modal */}
      <InvestModal
        isOpen={showInvestModal}
        onClose={() => setShowInvestModal(false)}
        mode="batch"
        stock={null}
      />
    </>
  );
}
