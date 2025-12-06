'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  type: 'stock' | 'crypto' | 'forex';
}

interface MarketTickerProps {
  data?: TickerItem[];
  speed?: number; // pixels per second
  height?: number;
  className?: string;
}

// Stock symbols with initial placeholder values (replaced by live Yahoo Finance data)
const DEFAULT_DATA: TickerItem[] = [
  { symbol: 'AAPL', price: 0, change: 0, type: 'stock' },
  { symbol: 'NVDA', price: 0, change: 0, type: 'stock' },
  { symbol: 'TSLA', price: 0, change: 0, type: 'stock' },
  { symbol: 'MSFT', price: 0, change: 0, type: 'stock' },
  { symbol: 'GOOGL', price: 0, change: 0, type: 'stock' },
  { symbol: 'AMZN', price: 0, change: 0, type: 'stock' },
  { symbol: 'META', price: 0, change: 0, type: 'stock' },
  { symbol: 'AMD', price: 0, change: 0, type: 'stock' },
  { symbol: 'SPY', price: 0, change: 0, type: 'stock' },
  { symbol: 'QQQ', price: 0, change: 0, type: 'stock' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Memoized ticker item to prevent unnecessary re-renders
const TickerItemDisplay = memo(function TickerItemDisplay({ 
  item, 
  previousPrice 
}: { 
  item: TickerItem; 
  previousPrice?: number;
}) {
  const isPositive = item.change >= 0;
  const hasChanged = previousPrice !== undefined && previousPrice !== item.price;
  
  return (
    <div className="flex items-center gap-3 px-6 py-2 whitespace-nowrap">
      {/* Symbol */}
      <span className="font-bold text-white/90 tracking-wider text-sm">
        {item.symbol}
      </span>
      
      {/* Price with animation on change */}
      <AnimatePresence mode="wait">
        <motion.span
          key={item.price}
          initial={hasChanged ? { scale: 1.1, opacity: 0.7 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="font-mono text-white/80 text-sm"
          style={{
            textShadow: '0 0 10px rgba(255,255,255,0.3)',
          }}
        >
          {item.type === 'forex' 
            ? item.price.toFixed(3) 
            : item.type === 'crypto' && item.price > 1000
              ? item.price.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : item.price.toFixed(2)
          }
        </motion.span>
      </AnimatePresence>
      
      {/* Change percentage with glow */}
      <AnimatePresence mode="wait">
        <motion.span
          key={item.change}
          initial={hasChanged ? { scale: 1.15 } : false}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
          className={`font-mono font-semibold text-sm ${
            isPositive ? 'text-[#00ff88]' : 'text-[#ff4444]'
          }`}
          style={{
            textShadow: isPositive 
              ? '0 0 8px rgba(0,255,136,0.6), 0 0 16px rgba(0,255,136,0.3)' 
              : '0 0 8px rgba(255,68,68,0.6), 0 0 16px rgba(255,68,68,0.3)',
          }}
        >
          {isPositive ? '+' : ''}{item.change.toFixed(2)}%
        </motion.span>
      </AnimatePresence>
      
      {/* Separator dot */}
      <span className="text-white/20 mx-2">•</span>
    </div>
  );
});

export default function MarketTicker({ 
  data: initialData, 
  speed = 50, 
  height = 50,
  className = ''
}: MarketTickerProps) {
  const [tickerData, setTickerData] = useState<TickerItem[]>(initialData || DEFAULT_DATA);
  const [previousPrices, setPreviousPrices] = useState<Record<string, number>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(2000); // Start with default width so content is visible

  // Fetch real prices from API
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const symbols = tickerData.filter(t => t.type === 'stock').map(t => t.symbol).join(',');
        console.log('Fetching ticker prices from:', `${API_URL}/api/prices?symbols=${symbols}`);
        const res = await fetch(`${API_URL}/api/prices?symbols=${symbols}`);
        
        console.log('Ticker response status:', res.status);
        
        if (res.ok) {
          const priceData = await res.json();
          console.log('Ticker price data received:', Object.keys(priceData).length, 'symbols');
          
          // Store previous prices for animation
          const prevPrices: Record<string, number> = {};
          tickerData.forEach(item => {
            if (item.price > 0) {
              prevPrices[item.symbol] = item.price;
            }
          });
          setPreviousPrices(prevPrices);
          
          // Update with new prices
          setTickerData(prev => prev.map(item => {
            if (priceData[item.symbol]) {
              return {
                ...item,
                price: priceData[item.symbol].current_price,
                change: priceData[item.symbol].change_pct,
              };
            }
            return item;
          }));
          setIsLoading(false);
        } else {
          const errorText = await res.text();
          console.error('Ticker prices fetch failed:', res.status, errorText);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Ticker price fetch error:', error);
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchPrices();
    
    // Update every 10 seconds
    const interval = setInterval(fetchPrices, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Calculate content width for seamless loop
  useEffect(() => {
    if (containerRef.current) {
      const firstChild = containerRef.current.querySelector('.ticker-content');
      if (firstChild) {
        setContentWidth(firstChild.scrollWidth);
      }
    }
  }, [tickerData, isLoading]);

  // Filter to only show items with loaded prices
  const displayData = tickerData.filter(item => item.price > 0);

  // Duration for one complete scroll
  const duration = contentWidth / speed;

  // Don't render until we have data
  if (isLoading || displayData.length === 0) {
    return (
      <div 
        className={`relative overflow-hidden bg-[#0a0a0a] border-b border-gray-800/50 ${className}`}
        style={{ height }}
      >
        <div className="flex items-center justify-center h-full">
          <span className="text-gray-500 text-sm animate-pulse">Loading live market data...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* CSS Keyframes for smooth ticker animation */}
      <style jsx>{`
        @keyframes ticker-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .ticker-animate {
          animation: ticker-scroll ${duration || 40}s linear infinite;
        }
        .ticker-animate:hover,
        .ticker-paused {
          animation-play-state: paused;
        }
      `}</style>
      
      <div 
        className={`relative overflow-hidden bg-[#0a0a0a] border-b border-gray-800/50 ${className}`}
        style={{ height }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Gradient overlays for fade effect */}
        <div className="absolute left-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-r from-[#0a0a0a] to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-l from-[#0a0a0a] to-transparent pointer-events-none" />
        
        {/* Scrolling container */}
        <div 
          ref={containerRef}
          className="flex items-center h-full"
        >
          <div
            className={`ticker-content flex items-center ticker-animate ${isPaused ? 'ticker-paused' : ''}`}
            style={{
              willChange: 'transform',
            }}
          >
            {/* Duplicate content for seamless loop */}
            {[...displayData, ...displayData].map((item, index) => (
              <TickerItemDisplay 
                key={`${item.symbol}-${index}`} 
                item={item} 
                previousPrice={previousPrices[item.symbol]}
              />
            ))}
          </div>
        </div>
        
        {/* Subtle scan line effect for LED look */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
          }}
        />
      </div>
    </>
  );
}
