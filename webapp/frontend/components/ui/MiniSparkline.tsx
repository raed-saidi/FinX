'use client';

import { useEffect, useState, memo } from 'react';
import { motion } from 'framer-motion';

interface MiniSparklineProps {
  symbol: string;
  width?: number;
  height?: number;
  color?: string;
  showAnimation?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Generate mock data for fallback
const generateMockData = (trend: 'up' | 'down' | 'neutral' = 'up', points: number = 20): number[] => {
  const data: number[] = [];
  let value = 100;
  
  for (let i = 0; i < points; i++) {
    const trendFactor = trend === 'up' ? 0.6 : trend === 'down' ? 0.4 : 0.5;
    const change = (Math.random() - trendFactor) * 5;
    value = Math.max(50, Math.min(150, value + change));
    data.push(value);
  }
  
  return data;
};

function MiniSparkline({ 
  symbol, 
  width = 100, 
  height = 40, 
  color,
  showAnimation = true 
}: MiniSparklineProps) {
  const [data, setData] = useState<number[]>([]);
  const [isPositive, setIsPositive] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/chart/${symbol}?interval=1h`);
        if (res.ok) {
          const chartData = await res.json();
          if (chartData.data && chartData.data.length > 0) {
            // Get last 20 close prices
            const prices = chartData.data.slice(-20).map((d: any) => d.close);
            setData(prices);
            setIsPositive(prices[prices.length - 1] >= prices[0]);
            return;
          }
        }
      } catch (error) {
        console.debug('Sparkline fetch failed:', error);
      }
      
      // Fallback to mock data
      const trend = Math.random() > 0.5 ? 'up' : 'down';
      setData(generateMockData(trend));
      setIsPositive(trend === 'up');
    };

    fetchData();
  }, [symbol]);

  if (data.length === 0) {
    // Loading skeleton
    return (
      <div 
        className="animate-pulse bg-gray-700/30 rounded"
        style={{ width, height }}
      />
    );
  }

  // Calculate SVG path
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });
  
  const pathD = `M ${points.join(' L ')}`;
  const lineColor = color || (isPositive ? '#10b981' : '#ef4444');
  const gradientId = `gradient-${symbol}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg 
      width={width} 
      height={height} 
      className="overflow-visible"
      style={{ filter: `drop-shadow(0 0 3px ${lineColor}40)` }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {/* Area fill */}
      <motion.path
        d={`${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`}
        fill={`url(#${gradientId})`}
        initial={showAnimation ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
      
      {/* Line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={showAnimation ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      
      {/* End dot */}
      <motion.circle
        cx={width - padding}
        cy={padding + chartHeight - ((data[data.length - 1] - min) / range) * chartHeight}
        r="2"
        fill={lineColor}
        initial={showAnimation ? { scale: 0 } : false}
        animate={{ scale: 1 }}
        transition={{ delay: 0.8, duration: 0.3 }}
      />
    </svg>
  );
}

export default memo(MiniSparkline);
