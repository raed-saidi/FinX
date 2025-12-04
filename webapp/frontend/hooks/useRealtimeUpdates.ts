'use client';

import { useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast } from '@/components/ui/Toast';
import { useDashboardStore } from '@/store/dashboard-store';
import { useAppSettings } from '@/hooks/useAppSettings';

/**
 * Hook to integrate WebSocket real-time updates into the app.
 * Use this in your layout or main dashboard component.
 */
export function useRealtimeUpdates() {
  const toast = useToast();
  const { fetchPortfolio, fetchBotStatus, fetchRecommendations } = useDashboardStore();
  const { notificationsEnabled } = useAppSettings();

  const { isConnected, lastMessage } = useWebSocket({
    onTrade: (trade) => {
      console.log('📈 Real-time trade:', trade);
      
      // Show toast notification if enabled
      if (notificationsEnabled?.trades) {
        toast.success(
          'Trade Executed',
          `${trade.action.toUpperCase()} ${trade.qty} ${trade.symbol} @ $${trade.price?.toFixed(2)}`
        );
      }
      
      // Refresh portfolio data
      fetchPortfolio();
    },
    onAlert: (alert) => {
      console.log('🔔 Price alert triggered:', alert);
      
      // Show toast notification if enabled
      if (notificationsEnabled?.priceAlerts) {
        toast.warning(
          'Price Alert',
          `${alert.symbol} ${alert.condition} $${alert.target_price} (now $${alert.current_price?.toFixed(2)})`
        );
      }
    },
    onMessage: (message) => {
      // Handle other message types
      if (message.type === 'bot_status') {
        fetchBotStatus();
      }
      if (message.type === 'recommendations') {
        fetchRecommendations();
      }
    },
  });

  return { isConnected, lastMessage };
}

export default useRealtimeUpdates;
