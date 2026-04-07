'use client';

// components/charts/EnhancedChart.tsx - Enhanced trading chart with candlestick/line toggle and timeframe filters

import { useEffect, useRef, useState, memo } from 'react';
import { 
  createChart, 
  ColorType, 
  CandlestickSeries, 
  LineSeries,
  AreaSeries,
  HistogramSeries,
  CrosshairMode
} from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { CandlestickChart as CandleIcon, LineChart, BarChart3, TrendingUp } from 'lucide-react';

interface ChartData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface EnhancedChartProps {
  symbol: string;
  onTimeframeChange?: (interval: string) => void;
  height?: number;
  initialInterval?: string;
}

type ChartType = 'candlestick' | 'line' | 'area';

const TIMEFRAMES = [
  { label: '1m', value: '1m', name: '1 Min' },
  { label: '5m', value: '5m', name: '5 Min' },
  { label: '15m', value: '15m', name: '15 Min' },
  { label: '30m', value: '30m', name: '30 Min' },
  { label: '1H', value: '1h', name: '1 Hour' },
  { label: '1D', value: '1d', name: '1 Day' },
  { label: '1W', value: '1wk', name: '1 Week' },
  { label: '1M', value: '1mo', name: '1 Month' },
];

const CHART_TYPES: { type: ChartType; icon: any; label: string }[] = [
  { type: 'candlestick', icon: CandleIcon, label: 'Candlestick' },
  { type: 'line', icon: LineChart, label: 'Line' },
  { type: 'area', icon: TrendingUp, label: 'Area' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function EnhancedChart({ 
  symbol, 
  onTimeframeChange,
  height = 450,
  initialInterval = '1d'
}: EnhancedChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [selectedInterval, setSelectedInterval] = useState(initialInterval);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [priceInfo, setPriceInfo] = useState<{
    current: number;
    change: number;
    high: number;
    low: number;
  } | null>(null);

  // Fetch chart data
  const fetchChartData = async (sym: string, interval: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_URL}/api/chart/${sym}?interval=${interval}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      
      if (res.ok) {
        const data = await res.json();
        setChartData(data.data || []);
        setPriceInfo({
          current: data.current_price,
          change: data.change_pct,
          high: data.period_high,
          low: data.period_low,
        });
      }
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data when symbol or interval changes
  useEffect(() => {
    if (symbol) {
      fetchChartData(symbol, selectedInterval);
    }
  }, [symbol, selectedInterval]);

  // No auto-refresh for chart data - user can manually refresh if needed

  // Create and update chart
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;

    // Remove existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create new chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6B7280',
      },
      grid: {
        vertLines: { color: '#1E1E28' },
        horzLines: { color: '#1E1E28' },
      },
      width: chartContainerRef.current.clientWidth,
      height: height - 60, // Account for controls
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#3B82F6',
          width: 1,
          style: 2,
          labelBackgroundColor: '#3B82F6',
        },
        horzLine: {
          color: '#3B82F6',
          width: 1,
          style: 2,
          labelBackgroundColor: '#3B82F6',
        },
      },
      timeScale: {
        borderColor: '#1E1E28',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1E1E28',
      },
    });

    chartRef.current = chart;

    // Format data for chart
    const formattedData = chartData.map(d => {
      // Parse time - handle both date and datetime formats
      let timestamp: number;
      if (d.time.includes(' ')) {
        timestamp = Math.floor(new Date(d.time).getTime() / 1000);
      } else {
        timestamp = Math.floor(new Date(d.time + 'T00:00:00').getTime() / 1000);
      }
      return {
        time: timestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        value: d.close, // For line/area charts
        volume: d.volume || 0,
      };
    });

    // Add main series based on chart type
    if (chartType === 'candlestick') {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#10B981',
        downColor: '#EF4444',
        borderUpColor: '#10B981',
        borderDownColor: '#EF4444',
        wickUpColor: '#10B981',
        wickDownColor: '#EF4444',
      });
      series.setData(formattedData as any);
      mainSeriesRef.current = series;
    } else if (chartType === 'line') {
      const series = chart.addSeries(LineSeries, {
        color: '#3B82F6',
        lineWidth: 2,
      });
      series.setData(formattedData.map(d => ({ time: d.time, value: d.close })) as any);
      mainSeriesRef.current = series;
    } else if (chartType === 'area') {
      const series = chart.addSeries(AreaSeries, {
        topColor: 'rgba(59, 130, 246, 0.4)',
        bottomColor: 'rgba(59, 130, 246, 0.0)',
        lineColor: '#3B82F6',
        lineWidth: 2,
      });
      series.setData(formattedData.map(d => ({ time: d.time, value: d.close })) as any);
      mainSeriesRef.current = series;
    }

    // Add volume series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#3B82F6',
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });

    const volumeData = formattedData.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
    }));

    volumeSeries.setData(volumeData as any);
    volumeSeriesRef.current = volumeSeries;

    // Fit content
    chart.timeScale().fitContent();

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
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [chartData, chartType, height]);

  const handleIntervalChange = (interval: string) => {
    setSelectedInterval(interval);
    onTimeframeChange?.(interval);
  };

  return (
    <div className="bg-card border border-border rounded overflow-hidden">
      {/* Chart Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">{symbol}</h3>
            {priceInfo && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl font-bold text-foreground">
                  ${priceInfo.current.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-sm font-medium ${priceInfo.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {priceInfo.change >= 0 ? '+' : ''}{priceInfo.change.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          
          {priceInfo && (
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted">High: </span>
                <span className="text-foreground">${priceInfo.high.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted">Low: </span>
                <span className="text-foreground">${priceInfo.low.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Chart Type Toggle */}
        <div className="flex items-center gap-1 bg-card-secondary rounded p-1">
          {CHART_TYPES.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={`p-2 rounded-sm transition ${
                chartType === type
                  ? 'bg-neutral-600 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Timeframe Filters */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 overflow-x-auto">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => handleIntervalChange(tf.value)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition whitespace-nowrap ${
              selectedInterval === tf.value
                ? 'bg-neutral-600 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-card-secondary'
            }`}
            title={tf.name}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Chart Container */}
      <div className="relative" style={{ height: height - 60 }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading chart...</span>
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
}

export default memo(EnhancedChart);
