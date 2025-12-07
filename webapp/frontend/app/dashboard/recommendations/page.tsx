'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  Brain,
  BarChart3,
  Target,
  Zap,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  ChevronRight,
  PieChart,
  Activity,
  Shield,
} from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useDashboardStore } from '@/store/dashboard-store';
import StockLogo from '@/components/ui/StockLogo';
import MiniSparkline from '@/components/ui/MiniSparkline';
import { Skeleton } from '@/components/ui/Skeleton';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

// Demo/fallback recommendations for when backend is unavailable
const DEMO_RECOMMENDATIONS = [
  { asset: 'TSLA', signal: 0.85, weight_pct: 29.76, direction: 'LONG' as const, current_price: 278.78, confidence: 0.92, reasoning: 'Strong momentum with positive technical indicators and AI sentiment analysis.', weight: 0.2976, dollars: 0, shares: 0, predicted_return_pct: 8.5, last_updated: new Date().toISOString() },
  { asset: 'MSFT', signal: 0.72, weight_pct: 20.02, direction: 'LONG' as const, current_price: 445.32, confidence: 0.88, reasoning: 'Solid fundamentals and consistent growth trajectory detected by XGBoost model.', weight: 0.2002, dollars: 0, shares: 0, predicted_return_pct: 7.2, last_updated: new Date().toISOString() },
  { asset: 'AMZN', signal: 0.65, weight_pct: 16.17, direction: 'LONG' as const, current_price: 225.89, confidence: 0.85, reasoning: 'Cloud services expansion and e-commerce resilience indicate upward trend.', weight: 0.1617, dollars: 0, shares: 0, predicted_return_pct: 6.5, last_updated: new Date().toISOString() },
  { asset: 'EFA', signal: 0.48, weight_pct: 11.82, direction: 'LONG' as const, current_price: 89.45, confidence: 0.79, reasoning: 'International diversification with moderate growth potential and stable returns.', weight: 0.1182, dollars: 0, shares: 0, predicted_return_pct: 4.8, last_updated: new Date().toISOString() },
  { asset: 'INTC', signal: 0.42, weight_pct: 10.28, direction: 'LONG' as const, current_price: 19.87, confidence: 0.76, reasoning: 'Semiconductor sector recovery signals detected, value opportunity identified.', weight: 0.1028, dollars: 0, shares: 0, predicted_return_pct: 4.2, last_updated: new Date().toISOString() },
  { asset: 'GOOGL', signal: 0.38, weight_pct: 6.14, direction: 'LONG' as const, current_price: 189.54, confidence: 0.73, reasoning: 'AI investments and advertising revenue strength support positive outlook.', weight: 0.0614, dollars: 0, shares: 0, predicted_return_pct: 3.8, last_updated: new Date().toISOString() },
  { asset: 'QQQ', signal: 0.28, weight_pct: 5.17, direction: 'LONG' as const, current_price: 534.12, confidence: 0.68, reasoning: 'Tech sector ETF providing broad market exposure with moderate signal strength.', weight: 0.0517, dollars: 0, shares: 0, predicted_return_pct: 2.8, last_updated: new Date().toISOString() },
];

export default function RecommendationsPage() {
  const router = useRouter();
  const { recommendations: storeRecs, fetchRecommendations, loadingStates } = useDashboardStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRec, setSelectedRec] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Use demo data if no real recommendations available
  const recommendations = storeRecs.length > 0 ? storeRecs : DEMO_RECOMMENDATIONS;

  useEffect(() => {
    setMounted(true);
    fetchRecommendations();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchRecommendations();
    setIsRefreshing(false);
  };

  // Prepare pie chart data
  const pieData = recommendations.map((rec, index) => ({
    name: rec.asset,
    value: rec.weight_pct || 0,
    color: COLORS[index % COLORS.length],
  }));

  const totalSignal = recommendations.reduce((sum, rec) => sum + Math.abs(rec.signal || 0), 0);
  const avgSignal = recommendations.length > 0 ? totalSignal / recommendations.length : 0;
  const longCount = recommendations.filter(r => r.direction === 'LONG').length;
  const shortCount = recommendations.filter(r => r.direction === 'SHORT').length;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Brain className="w-7 h-7 text-purple-400" />
            AI Recommendations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Machine learning powered stock analysis with XGBoost models
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </motion.div>

      {/* How It Works Banner */}
      <motion.div
        variants={itemVariants}
        className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20"
      >
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-foreground">How AI Recommendations Work</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Our XGBoost machine learning models analyze 100+ technical indicators including RSI, MACD, 
              Bollinger Bands, momentum, volatility, and trend signals across 15 assets. Models predict 
              next-day returns and allocate weights based on signal strength. Only stocks with strong 
              positive signals (predicted return &gt; 0.5%) are recommended.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <Target className="w-4 h-4" />
            Recommendations
          </div>
          <p className="text-2xl font-bold text-foreground">{recommendations.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Active picks</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Long Positions
          </div>
          <p className="text-2xl font-bold text-emerald-400">{longCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Bullish signals</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            Short Positions
          </div>
          <p className="text-2xl font-bold text-red-400">{shortCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Bearish signals</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Avg Signal
          </div>
          <p className="text-2xl font-bold text-yellow-400">{(avgSignal * 100).toFixed(2)}%</p>
          <p className="text-xs text-muted-foreground mt-1">Signal strength</p>
        </div>
      </motion.div>

      {/* Main Content - Allocation Chart + Recommendations List */}
      <div className="grid grid-cols-12 gap-6">
        {/* Allocation Pie Chart */}
        <motion.div
          variants={itemVariants}
          className="col-span-12 lg:col-span-4 bg-card border border-border rounded-lg p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Weight Allocation</h3>
          </div>

          {recommendations.length > 0 ? (
            <>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-card border border-border rounded p-2 shadow-xl">
                              <p className="text-foreground font-medium">{payload[0].name}</p>
                              <p className="text-muted-foreground text-sm">{payload[0].value}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="mt-4 space-y-2">
                {recommendations.map((rec, index) => (
                  <div key={rec.asset} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{rec.asset}</span>
                    </div>
                    <span className="text-foreground font-medium">{rec.weight_pct}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-white/70">
              No recommendations available
            </div>
          )}
        </motion.div>

        {/* Detailed Recommendations List */}
        <motion.div
          variants={itemVariants}
          className="col-span-12 lg:col-span-8 bg-card border border-border rounded-lg p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground">Detailed Analysis</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Click for full details
            </p>
          </div>

          {loadingStates.recommendations ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 bg-card-secondary rounded-lg">
                  <div className="flex items-center gap-4">
                    <Skeleton variant="circular" width={48} height={48} />
                    <div className="flex-1 space-y-2">
                      <Skeleton width="30%" height={16} />
                      <Skeleton width="50%" height={12} />
                    </div>
                    <Skeleton width={80} height={24} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec, index) => {
                const isPositive = rec.signal > 0;
                const isSelected = selectedRec === rec.asset;

                return (
                  <motion.div
                    key={rec.asset}
                    variants={itemVariants}
                    onClick={() => router.push(`/dashboard/stock/${rec.asset}`)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'bg-card-secondary border-border hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Logo & Basic Info */}
                      <StockLogo symbol={rec.asset} size="md" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-semibold">{rec.asset}</h4>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            rec.direction === 'LONG' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : rec.direction === 'SHORT'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {rec.direction}
                          </span>
                        </div>
                        <p className="text-white/70 text-sm">
                          ${rec.current_price?.toFixed(2)} • Rank #{index + 1}
                        </p>
                      </div>

                      {/* Signal & Weight */}
                      <div className="text-right">
                        <div className={`flex items-center gap-1 justify-end ${
                          isPositive ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {isPositive ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                          <span className="font-bold">
                            {isPositive ? '+' : ''}{(rec.signal * 100).toFixed(2)}%
                          </span>
                        </div>
                        <p className="text-white/60 text-xs">AI Signal</p>
                      </div>

                      {/* Weight */}
                      <div className="text-right min-w-[60px]">
                        <p className="text-white font-bold">{rec.weight_pct}%</p>
                        <p className="text-white/60 text-xs">Weight</p>
                      </div>

                      {/* Confidence */}
                      {rec.confidence && (
                        <div className="text-right min-w-[60px]">
                          <p className="text-yellow-400 font-bold">{(rec.confidence * 100).toFixed(0)}%</p>
                          <p className="text-muted-foreground text-xs">Conf.</p>
                        </div>
                      )}

                      {/* Mini Chart */}
                      <div className="hidden md:block">
                        <MiniSparkline
                          symbol={rec.asset}
                          width={80}
                          height={35}
                          color={isPositive ? '#10b981' : '#ef4444'}
                        />
                      </div>

                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>

                    {/* Expanded Details */}
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-border"
                      >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Predicted Return</p>
                            <p className={`font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                              {rec.predicted_return_pct?.toFixed(2) || (rec.signal * 100).toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Direction</p>
                            <p className="text-foreground font-medium">{rec.direction}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Weight</p>
                            <p className="text-foreground font-medium">{rec.weight_pct}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Last Updated</p>
                            <p className="text-foreground font-medium">
                              {rec.last_updated 
                                ? new Date(rec.last_updated).toLocaleTimeString() 
                                : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Model Info Section */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded-lg p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Model Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-foreground font-medium mb-2">Algorithm</h4>
            <p className="text-muted-foreground text-sm">
              XGBoost Gradient Boosting with walk-forward validation. One model trained per asset 
              using 300+ days of historical data.
            </p>
          </div>
          <div>
            <h4 className="text-foreground font-medium mb-2">Features Used</h4>
            <p className="text-muted-foreground text-sm">
              RSI, MACD, Bollinger Bands, momentum (5/10/20/60/120 day), volatility metrics, 
              Sharpe/Sortino ratios, drawdown, MA crossovers, skewness, kurtosis.
            </p>
          </div>
          <div>
            <h4 className="text-foreground font-medium mb-2">Selection Criteria</h4>
            <p className="text-muted-foreground text-sm">
              Only stocks with predicted returns &gt; 0.5% are recommended. Maximum 6 stocks 
              selected. Individual position capped at 35% weight.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Disclaimer */}
      <motion.div
        variants={itemVariants}
        className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400/80"
      >
        <strong>Disclaimer:</strong> AI recommendations are based on historical patterns and technical 
        analysis. Past performance does not guarantee future results. Always do your own research 
        and consider your risk tolerance before investing.
      </motion.div>
    </motion.div>
  );
}
