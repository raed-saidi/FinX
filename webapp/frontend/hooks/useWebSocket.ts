'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';

interface WebSocketMessage {
  type: string;
  data?: any;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onTrade?: (trade: any) => void;
  onAlert?: (alert: any) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onTrade,
    onAlert,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        reconnectCount.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Call general message handler
          onMessage?.(message);

          // Call specific handlers based on message type
          if (message.type === 'trade' && onTrade) {
            onTrade(message.data);
          }
          if (message.type === 'alert' && onAlert) {
            onAlert(message.data);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);

        // Attempt to reconnect
        if (reconnectCount.current < maxReconnectAttempts) {
          reconnectCount.current++;
          console.log(`Reconnecting... (${reconnectCount.current}/${maxReconnectAttempts})`);
          reconnectTimeout.current = setTimeout(connect, reconnectInterval);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [onMessage, onTrade, onAlert, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    reconnectCount.current = maxReconnectAttempts; // Prevent reconnection
    ws.current?.close();
    ws.current = null;
    setIsConnected(false);
  }, [maxReconnectAttempts]);

  const send = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback((symbols: string[]) => {
    send({ type: 'subscribe', symbols });
  }, [send]);

  const ping = useCallback(() => {
    send({ type: 'ping' });
  }, [send]);

  useEffect(() => {
    connect();

    // Keep-alive ping every 30 seconds
    const pingInterval = setInterval(ping, 30000);

    return () => {
      clearInterval(pingInterval);
      disconnect();
    };
  }, [connect, disconnect, ping]);

  return {
    isConnected,
    lastMessage,
    send,
    subscribe,
    connect,
    disconnect,
  };
}

export default useWebSocket;
