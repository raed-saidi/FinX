'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Clock,
  Filter,
  Search,
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import { Trade } from '@/lib/types';
import { Skeleton } from '@/components/ui/Skeleton';

const filterOptions = ['all', 'buy', 'sell'];

export default function TransactionsPage() {
  const { portfolio, loadingStates, fetchPortfolio, initializeFromStorage } = useDashboardStore();
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    initializeFromStorage();
    fetchPortfolio();
    // No auto-refresh - use manual refresh or WebSocket for updates
  }, []);

  const trades = portfolio?.trades || [];

  // Filter and search trades
  const filteredTrades = trades.filter((trade) => {
    const matchesFilter = filter === 'all' || trade.action === filter;
    const matchesSearch = trade.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Sort by timestamp (newest first)
  const sortedTrades = [...filteredTrades].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPortfolio();
    setIsRefreshing(false);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
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
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">Your complete trade history</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-card-secondary text-foreground rounded transition border border-border"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded p-5">
          <p className="text-muted-foreground text-sm mb-2">Total Trades</p>
          {loadingStates.portfolio ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{trades.length}</p>
          )}
        </div>
        <div className="bg-card border border-border rounded p-5">
          <p className="text-muted-foreground text-sm mb-2">Buy Orders</p>
          {loadingStates.portfolio ? (
            <Skeleton className="h-8 w-12" />
          ) : (
            <p className="text-2xl font-bold text-emerald-400">
              {trades.filter(t => t.action === 'buy').length}
            </p>
          )}
        </div>
        <div className="bg-card border border-border rounded p-5">
          <p className="text-muted-foreground text-sm mb-2">Sell Orders</p>
          {loadingStates.portfolio ? (
            <Skeleton className="h-8 w-12" />
          ) : (
            <p className="text-2xl font-bold text-red-400">
              {trades.filter(t => t.action === 'sell').length}
            </p>
          )}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-4">
        {/* Filter Buttons */}
        <div className="flex gap-2 bg-card p-1 rounded border border-border">
          {filterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`px-4 py-2 rounded text-sm font-medium transition capitalize ${
                filter === option
                  ? 'bg-neutral-600 text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search by symbol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded py-2.5 pl-11 pr-4 text-foreground placeholder-muted focus:outline-none focus:border-neutral-500 transition"
          />
        </div>
      </motion.div>

      {/* Transactions Table */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded overflow-hidden"
      >
        {loadingStates.portfolio ? (
          // Skeleton loading state
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground text-sm font-medium p-4">Type</th>
                  <th className="text-left text-muted-foreground text-sm font-medium p-4">Symbol</th>
                  <th className="text-right text-muted-foreground text-sm font-medium p-4">Shares</th>
                  <th className="text-right text-muted-foreground text-sm font-medium p-4">Price</th>
                  <th className="text-right text-muted-foreground text-sm font-medium p-4">Total</th>
                  <th className="text-right text-muted-foreground text-sm font-medium p-4">Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="p-4"><Skeleton className="h-7 w-20 rounded" /></td>
                    <td className="p-4"><Skeleton className="h-5 w-14" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-5 w-16 ml-auto" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-5 w-16 ml-auto" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-5 w-18 ml-auto" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-5 w-32 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : sortedTrades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground text-sm font-medium p-4">Type</th>
                  <th className="text-left text-muted-foreground text-sm font-medium p-4">Symbol</th>
                  <th className="text-right text-muted-foreground text-sm font-medium p-4">Shares</th>
                  <th className="text-right text-muted-foreground text-sm font-medium p-4">Price</th>
                  <th className="text-right text-muted-foreground text-sm font-medium p-4">Total</th>
                  <th className="text-right text-muted-foreground text-sm font-medium p-4">Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {sortedTrades.map((trade, index) => {
                  const isBuy = trade.action === 'buy';
                  return (
                    <motion.tr
                      key={`${trade.symbol}-${trade.timestamp}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="border-b border-border hover:bg-card-secondary/50 transition"
                    >
                      <td className="p-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded ${
                          isBuy 
                            ? 'bg-emerald-500/10 text-emerald-400' 
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {isBuy ? (
                            <ArrowDownRight className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                          <span className="font-medium capitalize">{trade.action}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-foreground font-medium">{trade.symbol}</span>
                      </td>
                      <td className="p-4 text-right text-foreground">
                        {trade.shares.toFixed(6)}
                      </td>
                      <td className="p-4 text-right text-muted-foreground">
                        ${trade.price.toFixed(2)}
                      </td>
                      <td className="p-4 text-right">
                        <span className={isBuy ? 'text-emerald-400' : 'text-red-400'}>
                          {isBuy ? '-' : '+'}${trade.total.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{formatDate(trade.timestamp)}</span>
                          <span className="text-muted">{formatTime(trade.timestamp)}</span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-muted">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="mb-2">No transactions yet</p>
            <p className="text-sm">Your trade history will appear here once you start investing</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
