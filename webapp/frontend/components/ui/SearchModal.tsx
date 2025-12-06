'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, TrendingUp, TrendingDown, Command, BarChart3, Wallet, Bot, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDashboardStore } from '@/store/dashboard-store';

interface SearchResult {
  type: 'stock' | 'page' | 'action';
  title: string;
  subtitle?: string;
  icon?: any;
  path?: string;
  action?: () => void;
  signal?: number;
  price?: number;
}

const PAGES: SearchResult[] = [
  { type: 'page', title: 'Dashboard', subtitle: 'Overview and portfolio', icon: BarChart3, path: '/dashboard' },
  { type: 'page', title: 'Markets', subtitle: 'All stocks and prices', icon: TrendingUp, path: '/dashboard/markets' },
  { type: 'page', title: 'Portfolio', subtitle: 'Your positions', icon: BarChart3, path: '/dashboard/portfolio' },
  { type: 'page', title: 'Wallet', subtitle: 'Manage funds', icon: Wallet, path: '/dashboard/wallet' },
  { type: 'page', title: 'Trading Bot', subtitle: 'AI automation', icon: Bot, path: '/dashboard/bot' },
  { type: 'page', title: 'Orders', subtitle: 'Trade history', icon: BarChart3, path: '/dashboard/orders' },
  { type: 'page', title: 'Settings', subtitle: 'Preferences', icon: Settings, path: '/dashboard/settings' },
];

export function SearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const { recommendations } = useDashboardStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search logic
  useEffect(() => {
    if (!query.trim()) {
      setResults(PAGES);
      return;
    }

    const q = query.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search pages
    PAGES.forEach((page) => {
      if (page.title.toLowerCase().includes(q) || page.subtitle?.toLowerCase().includes(q)) {
        searchResults.push(page);
      }
    });

    // Search stocks from recommendations
    recommendations.forEach((rec) => {
      if (rec.asset.toLowerCase().includes(q)) {
        searchResults.push({
          type: 'stock',
          title: rec.asset,
          subtitle: rec.direction,
          signal: rec.signal,
          price: rec.current_price,
          path: `/dashboard/markets?stock=${rec.asset}`,
        });
      }
    });

    setResults(searchResults);
    setSelectedIndex(0);
  }, [query, recommendations]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      const result = results[selectedIndex];
      if (result.path) {
        router.push(result.path);
        onClose();
      } else if (result.action) {
        result.action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [results, selectedIndex, router, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center pt-[15vh]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="bg-card border border-border rounded w-full max-w-xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Search className="w-5 h-5 text-muted" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search stocks, pages, actions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-foreground placeholder:text-muted focus:outline-none text-lg"
            />
            <div className="flex items-center gap-1 text-muted text-xs">
              <kbd className="px-1.5 py-0.5 bg-card-secondary rounded text-muted-foreground">ESC</kbd>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {results.length > 0 ? (
              <div className="p-2">
                {results.map((result, index) => {
                  const Icon = result.icon || (result.type === 'stock' ? TrendingUp : BarChart3);
                  const isSelected = index === selectedIndex;
                  
                  return (
                    <button
                      key={`${result.type}-${result.title}`}
                      onClick={() => {
                        if (result.path) {
                          router.push(result.path);
                          onClose();
                        }
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded transition ${
                        isSelected ? 'bg-neutral-500/20' : 'hover:bg-card-secondary'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded flex items-center justify-center ${
                        result.type === 'stock' 
                          ? result.signal && result.signal > 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
                          : 'bg-card-secondary'
                      }`}>
                        <Icon className={`w-5 h-5 ${
                          result.type === 'stock'
                            ? result.signal && result.signal > 0 ? 'text-emerald-400' : 'text-red-400'
                            : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-foreground font-medium">{result.title}</p>
                        {result.subtitle && (
                          <p className="text-muted text-sm">{result.subtitle}</p>
                        )}
                      </div>
                      {result.price && (
                        <span className="text-muted-foreground text-sm">${result.price.toFixed(2)}</span>
                      )}
                      {result.signal !== undefined && (
                        <span className={`text-sm font-medium ${result.signal > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {result.signal > 0 ? '+' : ''}{(result.signal * 100).toFixed(1)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-muted">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No results found</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-card-secondary rounded">↑↓</kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-card-secondary rounded">↵</kbd> Select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Command className="w-3 h-3" />
              <kbd className="px-1.5 py-0.5 bg-card-secondary rounded">K</kbd> to open
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Global search modal component that handles its own state (default export)
export default function GlobalSearchModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return <SearchModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}
