'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  AreaData,
  Time,
  AreaSeries,
} from 'lightweight-charts';
import { TrendingUp, TrendingDown, Calendar, RefreshCw } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface EquityPoint {
  time: string;
  value: number;
}

const timeframes = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' },
];

export default function EquityChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  
  const { portfolio } = useDashboardStore();
  const [selectedTimeframe, setSelectedTimeframe] = useState('1m');
  const [equityData, setEquityData] = useState<EquityPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    startValue: 0,
    endValue: 0,
    change: 0,
    changePercent: 0,
    high: 0,
    low: 0,
  });

  const [noDataMessage, setNoDataMessage] = useState<string | null>(null);

  const fetchEquityHistory = async () => {
    setIsLoading(true);
    setNoDataMessage(null);
    try {
      // Get REAL data from Alpaca portfolio history - NO FALLBACK TO FAKE DATA
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_URL}/api/alpaca/portfolio/history?period=${selectedTimeframe}&timeframe=1D`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.error) {
          setNoDataMessage(`Alpaca API: ${data.error}`);
          setEquityData([]);
          return;
        }
        
        if (data.equity && data.equity.length > 0 && data.timestamp && data.timestamp.length > 0) {
          const formattedData = data.timestamp.map((ts: number, i: number) => ({
            time: new Date(ts * 1000).toISOString().split('T')[0],
            value: data.equity[i],
          }));
          setEquityData(formattedData);
          calculateStats(formattedData);
          return;
        } else {
          setNoDataMessage('No trading history yet. Make some trades to see your portfolio performance.');
          setEquityData([]);
        }
      } else {
        setNoDataMessage('Failed to fetch portfolio history from Alpaca');
        setEquityData([]);
      }
    } catch (error) {
      setNoDataMessage('Error connecting to Alpaca. Check your API connection.');
      setEquityData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (data: EquityPoint[]) => {
    if (data.length === 0) return;
    
    const startValue = data[0].value;
    const endValue = data[data.length - 1].value;
    const values = data.map(d => d.value);
    
    setStats({
      startValue,
      endValue,
      change: endValue - startValue,
      changePercent: ((endValue - startValue) / startValue) * 100,
      high: Math.max(...values),
      low: Math.min(...values),
    });
  };

  useEffect(() => {
    fetchEquityHistory();
  }, [selectedTimeframe, portfolio?.total_value]);

  useEffect(() => {
    if (!chartContainerRef.current || equityData.length === 0) return;

    // Create chart
    chartRef.current = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6B7280',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.2)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.2)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.4)',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 0.4)',
      },
      crosshair: {
        vertLine: {
          labelBackgroundColor: '#2563eb',
        },
        horzLine: {
          labelBackgroundColor: '#2563eb',
        },
      },
    });

    // Add area series using the new addSeries API
    const isPositive = stats.change >= 0;
    const areaSeries = chartRef.current.addSeries(AreaSeries, {
      lineColor: isPositive ? '#10b981' : '#ef4444',
      topColor: isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
      bottomColor: isPositive ? 'rgba(16, 185, 129, 0.0)' : 'rgba(239, 68, 68, 0.0)',
      lineWidth: 2,
    });
    seriesRef.current = areaSeries;

    // Set data
    const chartData: AreaData<Time>[] = equityData.map((d) => ({
      time: d.time as Time,
      value: d.value,
    }));
    areaSeries.setData(chartData);
    chartRef.current.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current?.remove();
    };
  }, [equityData, stats.change]);

  const isPositive = stats.change >= 0;

  return (
    <div className="bg-card border border-border rounded overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Portfolio Performance</h3>
            <p className="text-muted text-sm">Track your equity over time</p>
          </div>
          <button
            onClick={fetchEquityHistory}
            disabled={isLoading}
            className="p-2 hover:bg-card-secondary rounded transition"
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6">
          <div>
            <p className="text-2xl font-bold text-foreground">
              ${stats.endValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>
                {isPositive ? '+' : ''}${stats.change.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                {' '}({isPositive ? '+' : ''}{stats.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 ml-auto text-sm">
            <div>
              <p className="text-muted">High</p>
              <p className="text-foreground font-medium">
                ${stats.high.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-muted">Low</p>
              <p className="text-foreground font-medium">
                ${stats.low.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeframe Buttons */}
      <div className="flex items-center gap-1 p-4 border-b border-border bg-background">
        {timeframes.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setSelectedTimeframe(tf.value)}
            className={`px-4 py-2 rounded text-sm font-medium transition ${
              selectedTimeframe === tf.value
                ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="p-4">
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-muted animate-spin" />
          </div>
        ) : noDataMessage ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-center px-4">
            <TrendingUp className="w-12 h-12 text-muted mb-4" />
            <p className="text-muted-foreground mb-2">{noDataMessage}</p>
            <p className="text-muted text-sm">Real Alpaca portfolio data will appear here once you have trading activity.</p>
          </div>
        ) : equityData.length === 0 ? (
          <div className="h-[300px] flex flex-col items-center justify-center text-center px-4">
            <TrendingUp className="w-12 h-12 text-muted mb-4" />
            <p className="text-muted-foreground">No portfolio history available</p>
          </div>
        ) : (
          <div ref={chartContainerRef} className="w-full h-[300px]" />
        )}
      </div>
    </div>
  );
}
