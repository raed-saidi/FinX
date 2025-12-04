'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Clock, RefreshCw } from 'lucide-react';

interface DataFreshnessIndicatorProps {
  lastUpdate: Date;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showLabel?: boolean;
}

export default function DataFreshnessIndicator({
  lastUpdate,
  onRefresh,
  isRefreshing = false,
  showLabel = true,
}: DataFreshnessIndicatorProps) {
  const [mounted, setMounted] = useState(false);
  const [timeAgo, setTimeAgo] = useState<string>('');
  const [freshness, setFreshness] = useState<'fresh' | 'stale' | 'old'>('fresh');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const updateFreshness = () => {
      const now = new Date();
      const diff = now.getTime() - lastUpdate.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);

      // Determine freshness level
      if (seconds < 30) {
        setFreshness('fresh');
        setTimeAgo('Just now');
      } else if (seconds < 60) {
        setFreshness('fresh');
        setTimeAgo(`${seconds}s ago`);
      } else if (minutes < 5) {
        setFreshness('fresh');
        setTimeAgo(`${minutes}m ago`);
      } else if (minutes < 15) {
        setFreshness('stale');
        setTimeAgo(`${minutes}m ago`);
      } else {
        setFreshness('old');
        setTimeAgo(`${minutes}m ago`);
      }
    };

    updateFreshness();
    const interval = setInterval(updateFreshness, 10000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-card rounded border border-border">
        <div className="w-2.5 h-2.5 rounded-full bg-muted animate-pulse" />
        <span className="text-muted text-xs">--:--:--</span>
      </div>
    );
  }

  const colors = {
    fresh: {
      dot: 'bg-green-500',
      ping: 'bg-green-400',
      text: 'text-green-400',
      label: 'LIVE',
      icon: Wifi,
    },
    stale: {
      dot: 'bg-amber-500',
      ping: 'bg-amber-400',
      text: 'text-amber-400',
      label: 'UPDATING',
      icon: Clock,
    },
    old: {
      dot: 'bg-red-500',
      ping: 'bg-red-400',
      text: 'text-red-400',
      label: 'OFFLINE',
      icon: WifiOff,
    },
  };

  const current = colors[freshness];
  const Icon = current.icon;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-card rounded border border-border">
        <span className="relative flex h-2.5 w-2.5">
          {freshness === 'fresh' && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${current.ping} opacity-75`} />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${current.dot}`} />
        </span>
        <span className={`${current.text} text-sm font-medium`}>{current.label}</span>
        {showLabel && (
          <span className="text-muted text-xs">{timeAgo}</span>
        )}
      </div>
      
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-2 bg-card hover:bg-card-secondary text-foreground rounded transition border border-border disabled:opacity-50"
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );
}
