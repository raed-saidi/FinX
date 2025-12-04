'use client';

import { useState, useEffect } from 'react';
import { Clock, Sun, Moon } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface MarketStatus {
  is_open: boolean;
  current_time_et: string;
  next_event: string;
  next_event_time: string;
  message: string;
}

export default function MarketStatusBadge() {
  const [status, setStatus] = useState<MarketStatus | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/market/hours`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch market status:', error);
      }
    };

    fetchStatus();
    // Refresh every 5 minutes (market status doesn't change often)
    const interval = setInterval(fetchStatus, 300000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted || !status) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted border border-border rounded text-muted-foreground text-xs">
        <Clock className="w-3 h-3" />
        <span>Loading...</span>
      </div>
    );
  }

  const isOpen = status.is_open;

  return (
    <div 
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
        isOpen 
          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
          : 'bg-slate-500/10 border border-slate-500/30 text-slate-400'
      }`}
      title={status.message}
    >
      {isOpen ? (
        <>
          <Sun className="w-3 h-3" />
          <span>MARKET OPEN</span>
        </>
      ) : (
        <>
          <Moon className="w-3 h-3" />
          <span>CLOSED</span>
        </>
      )}
    </div>
  );
}
