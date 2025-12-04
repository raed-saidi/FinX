'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, TrendingUp, TrendingDown, X, Plus, ExternalLink } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import StockLogo from '@/components/ui/StockLogo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface WatchlistItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

interface WatchlistProps {
  onSelectStock?: (symbol: string) => void;
}

export default function Watchlist({ onSelectStock }: WatchlistProps) {
  const router = useRouter();
  const { watchlist, removeFromWatchlist, addToWatchlist, setSelectedSymbol } = useDashboardStore();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchWatchlistData = async () => {
    if (watchlist.length === 0) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    try {
      const promises = watchlist.map(async (symbol) => {
        try {
          const res = await fetch(`${API_URL}/api/stock/${symbol}`);
          if (res.ok) {
            const data = await res.json();
            return {
              symbol,
              price: data.price || 0,
              change: data.change || 0,
              changePercent: data.changePercent || data.change_percent || 0,
            };
          }
        } catch {
          return { symbol, price: 0, change: 0, changePercent: 0 };
        }
        return { symbol, price: 0, change: 0, changePercent: 0 };
      });

      const results = await Promise.all(promises);
      setItems(results);
    } catch (error) {
      console.error('Failed to fetch watchlist data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlistData();
    // No auto-refresh - use manual refresh for updates
  }, [watchlist]);

  const handleAddSymbol = () => {
    const symbol = newSymbol.toUpperCase().trim();
    if (symbol && !watchlist.includes(symbol)) {
      addToWatchlist(symbol);
      setNewSymbol('');
      setShowAddModal(false);
    }
  };

  const handleSelectStock = (symbol: string) => {
    setSelectedSymbol(symbol);
    onSelectStock?.(symbol);
  };

  return (
    <div className="bg-card border border-border rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-warning fill-warning" />
          <h3 className="text-foreground font-semibold">Watchlist</h3>
          <span className="text-muted-foreground text-sm">({mounted ? watchlist.length : 0})</span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-muted hover:bg-border text-foreground rounded text-sm transition"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded" />
                  <div>
                    <div className="h-4 w-16 bg-muted rounded mb-1" />
                    <div className="h-3 w-20 bg-muted rounded" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-4 w-16 bg-muted rounded mb-1" />
                  <div className="h-3 w-12 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Eye className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No stocks in watchlist</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-foreground hover:underline text-sm"
            >
              Add your first stock
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <motion.div
                key={item.symbol}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition cursor-pointer group"
                onClick={() => router.push(`/dashboard/stock/${item.symbol}`)}
              >
                <div className="flex items-center gap-3">
                  <StockLogo symbol={item.symbol} size="md" />
                  <div>
                    <p className="text-foreground font-medium flex items-center gap-1">
                      {item.symbol}
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {item.change >= 0 ? '+' : ''}
                      {item.changePercent.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-foreground font-medium">
                      ${item.price.toFixed(2)}
                    </p>
                    <p
                      className={`text-sm ${
                        item.change >= 0 ? 'text-profit' : 'text-loss'
                      }`}
                    >
                      {item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(item.symbol);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-loss/20 rounded transition"
                  >
                    <X className="w-4 h-4 text-loss" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-foreground mb-4">Add to Watchlist</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
                  placeholder="Enter symbol (e.g., AAPL)"
                  className="flex-1 bg-muted border border-border rounded px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-muted-foreground"
                  autoFocus
                />
                <button
                  onClick={handleAddSymbol}
                  disabled={!newSymbol.trim()}
                  className="px-6 py-3 bg-neutral-800 dark:bg-neutral-200 hover:bg-neutral-700 dark:hover:bg-neutral-300 disabled:bg-neutral-500 disabled:text-neutral-400 text-white dark:text-neutral-900 rounded font-medium transition"
                >
                  Add
                </button>
              </div>
              <p className="text-muted-foreground text-sm mt-3">
                Enter a stock ticker symbol to add it to your watchlist
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
