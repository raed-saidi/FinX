'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Star,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Activity,
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import EnhancedChart from '@/components/charts/EnhancedChart';
import StockLogo from '@/components/ui/StockLogo';
import { Skeleton } from '@/components/ui/Skeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface MarketStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  signal?: number;
  direction?: string;
}

const STOCK_NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.',
  NVDA: 'NVIDIA Corp.',
  TSLA: 'Tesla Inc.',
  MSFT: 'Microsoft Corp.',
  GOOGL: 'Alphabet Inc.',
  AMZN: 'Amazon.com Inc.',
  META: 'Meta Platforms',
  SPY: 'S&P 500 ETF',
  QQQ: 'Nasdaq-100 ETF',
  AMD: 'AMD Inc.',
  INTC: 'Intel Corp.',
  IEF: 'Treasury Bond ETF',
  HYG: 'High Yield Bond ETF',
  BIL: 'Treasury Bill ETF',
  EFA: 'EAFE ETF',
};

// Memoized stock row component - only re-renders when its data changes
const StockRow = memo(function StockRow({ 
  stock, 
  onSelect,
  isSelected 
}: { 
  stock: MarketStock; 
  onSelect: (symbol: string) => void;
  isSelected: boolean;
}) {
  const isPositive = stock.changePct >= 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => onSelect(stock.symbol)}
      className={`flex items-center justify-between p-4 rounded-lg hover:bg-muted transition cursor-pointer border ${
        isSelected ? 'border-blue-500/50 bg-blue-500/5' : 'border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <StockLogo symbol={stock.symbol} size="sm" />
        <div>
          <span className="text-foreground font-medium">{stock.symbol}</span>
          <p className="text-muted-foreground text-xs">{stock.name}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-foreground font-medium">${stock.price?.toFixed(2) || '0.00'}</p>
          <div className={`flex items-center justify-end gap-1 text-xs ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {isPositive ? '+' : ''}{stock.changePct?.toFixed(2) || '0.00'}%
          </div>
        </div>
        
        {stock.signal !== undefined && (
          <div className="w-20 text-right">
            <span className={`text-xs px-2 py-1 rounded ${
              stock.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' :
              stock.direction === 'SHORT' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {stock.direction}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if price or selection changed
  return (
    prevProps.stock.price === nextProps.stock.price &&
    prevProps.stock.changePct === nextProps.stock.changePct &&
    prevProps.isSelected === nextProps.isSelected
  );
});

export default function MarketsPage() {
  const { recommendations, fetchRecommendations, initializeFromStorage } = useDashboardStore();
  
  const [stocks, setStocks] = useState<MarketStock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<MarketStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'symbol' | 'change' | 'signal'>('signal');
  const [filterDirection, setFilterDirection] = useState<'all' | 'LONG' | 'SHORT' | 'NEUTRAL'>('all');
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);
  const previousPricesRef = useRef<Record<string, number>>({});

  // Initial data fetch
  const fetchMarketData = useCallback(async (isInitial: boolean = false) => {
    if (isInitial) setIsLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Fetch prices for all tracked stocks
      const symbols = Object.keys(STOCK_NAMES);
      const pricePromises = symbols.map(async (symbol) => {
        try {
          const res = await fetch(`${API_URL}/api/chart/${symbol}?interval=1d`, { headers });
          if (res.ok) {
            const data = await res.json();
            return {
              symbol,
              name: STOCK_NAMES[symbol],
              price: data.current_price,
              change: data.current_price * (data.change_pct / 100),
              changePct: data.change_pct,
              volume: data.data?.[data.data.length - 1]?.volume || 0,
            };
          }
        } catch (e) {
          console.error(`Failed to fetch ${symbol}:`, e);
        }
        return null;
      });

      const results = await Promise.all(pricePromises);
      const validResults = results.filter(Boolean) as MarketStock[];
      
      // Merge with recommendations
      const merged = validResults.map(stock => {
        const rec = recommendations.find(r => r.asset === stock.symbol);
        return {
          ...stock,
          signal: rec?.signal || 0,
          direction: rec?.direction || 'NEUTRAL',
        };
      });

      // Check if any prices actually changed
      const hasChanges = merged.some(stock => {
        const prevPrice = previousPricesRef.current[stock.symbol];
        return prevPrice === undefined || prevPrice !== stock.price;
      });

      if (hasChanges || isInitial) {
        // Update previous prices ref
        merged.forEach(stock => {
          previousPricesRef.current[stock.symbol] = stock.price;
        });
        
        setStocks(merged);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch market data:', error);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, [recommendations]);

  useEffect(() => {
    setMounted(true);
    initializeFromStorage();
    fetchRecommendations();
  }, []);

  useEffect(() => {
    if (recommendations.length > 0) {
      fetchMarketData(true);
      
      // Auto-refresh market data every 30 seconds (changed from 5 seconds)
      // Only update if prices actually changed
      const interval = setInterval(() => {
        fetchMarketData(false);
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [recommendations, fetchMarketData]);

  useEffect(() => {
    let filtered = [...stocks];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        s => s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
             s.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Direction filter
    if (filterDirection !== 'all') {
      filtered = filtered.filter(s => s.direction === filterDirection);
    }

    // Sort
    if (sortBy === 'symbol') {
      filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));
    } else if (sortBy === 'change') {
      filtered.sort((a, b) => b.changePct - a.changePct);
    } else if (sortBy === 'signal') {
      filtered.sort((a, b) => Math.abs(b.signal || 0) - Math.abs(a.signal || 0));
    }

    setFilteredStocks(filtered);
  }, [stocks, searchQuery, sortBy, filterDirection]);

  const handleRefresh = useCallback(() => {
    fetchRecommendations();
    fetchMarketData(true);
  }, [fetchRecommendations, fetchMarketData]);

  const handleSelectStock = useCallback((symbol: string) => {
    setSelectedStock(symbol);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const gainers = stocks.filter(s => s.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const losers = stocks.filter(s => s.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 5);

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
          <h1 className="text-2xl font-bold text-foreground">Markets</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time stock prices and AI signals</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-card rounded border border-border">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-green-400 text-sm font-medium">LIVE</span>
            <span className="text-muted text-xs">{mounted ? lastUpdate.toLocaleTimeString() : '--:--:--'}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-card-secondary text-foreground rounded transition border border-border"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Market Overview Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Gainers */}
        <div className="bg-card border border-border rounded p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-foreground font-semibold">Top Gainers</h3>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              // Skeleton for gainers
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded" />
                    <div>
                      <Skeleton className="h-4 w-12 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
              ))
            ) : gainers.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">No gainers today</p>
            ) : (
              gainers.map((stock) => (
                <div 
                  key={stock.symbol} 
                  className="flex items-center justify-between p-2 rounded hover:bg-card-secondary cursor-pointer transition"
                  onClick={() => setSelectedStock(stock.symbol)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-foreground font-medium text-sm">{stock.symbol}</p>
                      <p className="text-muted text-xs">${stock.price.toFixed(2)}</p>
                    </div>
                  </div>
                  <span className="text-emerald-400 font-medium">+{stock.changePct.toFixed(2)}%</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Losers */}
        <div className="bg-card border border-border rounded p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <h3 className="text-foreground font-semibold">Top Losers</h3>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              // Skeleton for losers
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded" />
                    <div>
                      <Skeleton className="h-4 w-12 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
              ))
            ) : losers.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">No losers today</p>
            ) : (
              losers.map((stock) => (
                <div 
                  key={stock.symbol} 
                  className="flex items-center justify-between p-2 rounded hover:bg-card-secondary cursor-pointer transition"
                  onClick={() => setSelectedStock(stock.symbol)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-500/20 rounded flex items-center justify-center">
                      <ArrowDownRight className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <p className="text-foreground font-medium text-sm">{stock.symbol}</p>
                      <p className="text-muted text-xs">${stock.price.toFixed(2)}</p>
                    </div>
                  </div>
                  <span className="text-red-400 font-medium">{stock.changePct.toFixed(2)}%</span>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>

      {/* Chart Section */}
      {selectedStock && (
        <motion.div variants={itemVariants}>
          <EnhancedChart symbol={selectedStock} height={400} />
        </motion.div>
      )}

      {/* Search and Filters */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search stocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded pl-11 pr-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-neutral-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted" />
          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value as any)}
            className="bg-card border border-border rounded px-4 py-3 text-foreground focus:outline-none focus:border-neutral-500"
          >
            <option value="all">All Signals</option>
            <option value="LONG">LONG Only</option>
            <option value="SHORT">SHORT Only</option>
            <option value="NEUTRAL">NEUTRAL Only</option>
          </select>
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-card border border-border rounded px-4 py-3 text-foreground focus:outline-none focus:border-neutral-500"
        >
          <option value="signal">Sort by Signal</option>
          <option value="change">Sort by Change</option>
          <option value="symbol">Sort by Symbol</option>
        </select>
      </motion.div>

      {/* Stock List */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card-secondary">
              <tr>
                <th className="text-left text-muted-foreground text-xs font-medium px-6 py-4">Symbol</th>
                <th className="text-left text-muted-foreground text-xs font-medium px-6 py-4">Name</th>
                <th className="text-right text-muted-foreground text-xs font-medium px-6 py-4">Price</th>
                <th className="text-right text-muted-foreground text-xs font-medium px-6 py-4">Change</th>
                <th className="text-right text-muted-foreground text-xs font-medium px-6 py-4">AI Signal</th>
                <th className="text-center text-muted-foreground text-xs font-medium px-6 py-4">Direction</th>
                <th className="text-center text-muted-foreground text-xs font-medium px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                // Skeleton table rows
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-4 w-14" />
                      </div>
                    </td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                    <td className="px-6 py-4 text-center"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></td>
                    <td className="px-6 py-4 text-center"><Skeleton className="h-8 w-16 mx-auto rounded" /></td>
                  </tr>
                ))
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted">
                    <Activity className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p>No stocks found</p>
                  </td>
                </tr>
              ) : (
                filteredStocks.map((stock) => (
                  <tr 
                    key={stock.symbol} 
                    className="hover:bg-card-secondary/50 transition cursor-pointer"
                    onClick={() => setSelectedStock(stock.symbol)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <StockLogo symbol={stock.symbol} size="md" />
                        <span className="text-foreground font-medium">{stock.symbol}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-muted-foreground text-sm">{stock.name}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-foreground font-medium">${stock.price.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {stock.changePct >= 0 ? (
                          <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-red-400" />
                        )}
                        <span className={`font-medium ${stock.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {stock.changePct >= 0 ? '+' : ''}{stock.changePct.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-medium ${
                        (stock.signal || 0) > 0 ? 'text-emerald-400' : 
                        (stock.signal || 0) < 0 ? 'text-red-400' : 'text-muted-foreground'
                      }`}>
                        {(stock.signal || 0) > 0 ? '+' : ''}{((stock.signal || 0) * 100).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                        stock.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' :
                        stock.direction === 'SHORT' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {stock.direction}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStock(stock.symbol);
                        }}
                        className="px-4 py-2 bg-gray-500/20 text-gray-300 rounded hover:bg-gray-500/30 transition text-sm font-medium"
                      >
                        View Chart
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
