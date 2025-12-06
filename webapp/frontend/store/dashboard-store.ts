// store/dashboard-store.ts - Zustand store for dashboard state with real API integration

import { create } from 'zustand';
import { 
  Portfolio, 
  Position, 
  Trade, 
  ChatMessage, 
  BotStatus, 
  Recommendation,
  StockPrice,
  BacktestMetrics
} from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface DashboardState {
  // User
  user: { name: string; email: string } | null;
  isAuthenticated: boolean;
  
  // Portfolio Data
  portfolio: Portfolio | null;
  recommendations: Recommendation[];
  botStatus: BotStatus | null;
  backtest: BacktestMetrics | null;
  
  // Stock Data
  stockPrices: Record<string, StockPrice>;
  
  // Watchlist
  watchlist: string[];
  
  // UI State
  selectedTimeframe: string;
  selectedSymbol: string;
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  chatOpen: boolean;
  chatMessages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  
  // Granular loading states
  loadingStates: {
    portfolio: boolean;
    recommendations: boolean;
    botStatus: boolean;
    backtest: boolean;
    chart: boolean;
  };
  
  // Computed values
  totalBalance: number;
  availableCash: number;
  
  // Actions
  setUser: (user: { name: string; email: string } | null) => void;
  setAuthenticated: (auth: boolean) => void;
  setSelectedTimeframe: (tf: string) => void;
  setSelectedSymbol: (symbol: string) => void;
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  toggleChat: () => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Watchlist Actions
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  isInWatchlist: (symbol: string) => boolean;
  
  // Price update (optimized - only updates prices without full re-render)
  updatePricesOnly: () => Promise<void>;
  
  // API Actions
  fetchPortfolio: () => Promise<void>;
  fetchBotStatus: () => Promise<void>;
  fetchRecommendations: () => Promise<void>;
  fetchBacktest: () => Promise<void>;
  fetchStockPrice: (symbol: string, period?: string) => Promise<StockPrice | null>;
  startBot: (config?: {
    investment_amount?: number;
    per_trade_amount?: number;
    max_positions?: number;
    run_duration_hours?: number;
    trade_frequency_minutes?: number;
    use_ai_signals?: boolean;
    min_signal_strength?: number;
    stop_loss_pct?: number;
    take_profit_pct?: number;
  }) => Promise<any>;
  stopBot: () => Promise<void>;
  executeTrade: (symbol: string, action: 'buy' | 'sell', dollars: number) => Promise<any>;
  batchInvest: (totalDollars: number, useRecommendations?: boolean, customAllocations?: Array<{symbol: string; weight: number}>) => Promise<any>;
  sendChatMessage: (message: string) => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  initializeFromStorage: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  portfolio: null,
  recommendations: [],
  botStatus: null,
  backtest: null,
  stockPrices: {},
  watchlist: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('watchlist') || '["AAPL", "GOOGL", "MSFT", "TSLA", "NVDA"]') : [],
  selectedTimeframe: '1D',
  selectedSymbol: 'AAPL',
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  chatOpen: false,
  chatMessages: [],
  isLoading: false,
  error: null,
  loadingStates: {
    portfolio: true,
    recommendations: true,
    botStatus: true,
    backtest: true,
    chart: false,
  },
  totalBalance: 0,
  availableCash: 0,
  
  // Actions
  setUser: (user) => set({ user }),
  setAuthenticated: (auth) => set({ isAuthenticated: auth }),
  setSelectedTimeframe: (tf) => set({ selectedTimeframe: tf }),
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
  toggleChat: () => set((state) => ({ chatOpen: !state.chatOpen })),
  addChatMessage: (message) => set((state) => {
    const newMessages = [...state.chatMessages, message];
    // Persist to localStorage (only non-typing messages, max 50)
    if (message.id !== 'typing' && typeof window !== 'undefined') {
      const toSave = newMessages
        .filter(m => m.id !== 'typing')
        .slice(-50); // Keep last 50 messages
      localStorage.setItem('chatMessages', JSON.stringify(toSave));
    }
    return { chatMessages: newMessages };
  }),
  clearChat: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chatMessages');
    }
    set({ chatMessages: [] });
  },
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  // Watchlist Actions
  addToWatchlist: (symbol: string) => {
    const current = get().watchlist;
    if (!current.includes(symbol)) {
      const updated = [...current, symbol];
      localStorage.setItem('watchlist', JSON.stringify(updated));
      set({ watchlist: updated });
    }
  },
  removeFromWatchlist: (symbol: string) => {
    const updated = get().watchlist.filter(s => s !== symbol);
    localStorage.setItem('watchlist', JSON.stringify(updated));
    set({ watchlist: updated });
  },
  isInWatchlist: (symbol: string) => get().watchlist.includes(symbol),
  
  // Initialize from localStorage
  initializeFromStorage: () => {
    if (typeof window === 'undefined') return;
    
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, isAuthenticated: true });
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    
    // Load chat messages from localStorage
    try {
      const chatStr = localStorage.getItem('chatMessages');
      if (chatStr) {
        const messages = JSON.parse(chatStr).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        set({ chatMessages: messages });
      }
    } catch {
      console.error('Failed to load chat messages from localStorage');
    }
  },
  
  // Optimized price-only update (doesn't trigger full re-render)
  updatePricesOnly: async () => {
    try {
      const currentPortfolio = get().portfolio;
      if (!currentPortfolio || !currentPortfolio.positions?.length) return;
      
      // Fetch only the prices for current positions
      const symbols = currentPortfolio.positions.map(p => p.symbol).join(',');
      const res = await fetch(`${API_URL}/api/prices?symbols=${symbols}`);
      
      if (res.ok) {
        const priceData = await res.json();
        
        // Only update if prices actually changed
        const updatedPositions = currentPortfolio.positions.map(pos => {
          const newPrice = priceData[pos.symbol]?.current_price;
          if (newPrice && newPrice !== pos.current_price) {
            const newValue = pos.shares * newPrice;
            const newPnl = newValue - (pos.shares * pos.avg_price);
            const newPnlPct = ((newPrice - pos.avg_price) / pos.avg_price) * 100;
            return {
              ...pos,
              current_price: newPrice,
              value: newValue,
              pnl: newPnl,
              pnl_pct: newPnlPct,
            };
          }
          return pos;
        });
        
        // Check if any prices actually changed
        const hasChanges = updatedPositions.some((pos, i) => 
          pos.current_price !== currentPortfolio.positions[i].current_price
        );
        
        if (hasChanges) {
          const newTotalValue = updatedPositions.reduce((sum, p) => sum + p.value, 0) + currentPortfolio.cash;
          set({
            portfolio: {
              ...currentPortfolio,
              positions: updatedPositions,
              total_value: newTotalValue,
            },
            totalBalance: newTotalValue,
          });
        }
      }
    } catch (error) {
      // Silent fail for price updates - not critical
      console.debug('Price update failed:', error);
    }
  },
  
  // API Actions
  fetchPortfolio: async () => {
    set((state) => ({ loadingStates: { ...state.loadingStates, portfolio: true } }));
    try {
      const token = localStorage.getItem('token');
      
      // Try authenticated endpoint first, fallback to public endpoint
      let res;
      if (token) {
        res = await fetch(`${API_URL}/api/user/portfolio`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
      
      // If no token or auth failed, use public portfolio endpoint
      if (!token || !res?.ok) {
        res = await fetch(`${API_URL}/api/portfolio`);
      }
      
      if (res.ok) {
        const data = await res.json();
        set({ 
          portfolio: data,
          totalBalance: data.total_value || 0,
          availableCash: data.cash || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
    } finally {
      set((state) => ({ loadingStates: { ...state.loadingStates, portfolio: false } }));
    }
  },
  
  fetchBotStatus: async () => {
    set((state) => ({ loadingStates: { ...state.loadingStates, botStatus: true } }));
    try {
      // No auth required for bot status
      const res = await fetch(`${API_URL}/api/bot/status`);
      
      if (res.ok) {
        const data = await res.json();
        set({ botStatus: data });
      }
    } catch (error) {
      console.error('Failed to fetch bot status:', error);
    } finally {
      set((state) => ({ loadingStates: { ...state.loadingStates, botStatus: false } }));
    }
  },
  
  fetchRecommendations: async () => {
    set((state) => ({ loadingStates: { ...state.loadingStates, recommendations: true } }));
    try {
      console.log('Fetching recommendations from:', `${API_URL}/api/recommendations`);
      const res = await fetch(`${API_URL}/api/recommendations`);
      
      console.log('Recommendations response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('Recommendations data received:', data);
        console.log('Number of recommendations:', data?.length || 0);
        set({ recommendations: data || [] });
      } else {
        const errorText = await res.text();
        console.error('Recommendations fetch failed:', res.status, errorText);
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      set((state) => ({ loadingStates: { ...state.loadingStates, recommendations: false } }));
    }
  },
  
  fetchBacktest: async () => {
    set((state) => ({ loadingStates: { ...state.loadingStates, backtest: true } }));
    try {
      const res = await fetch(`${API_URL}/api/backtest`);
      
      if (res.ok) {
        const data = await res.json();
        set({ backtest: data });
      }
    } catch (error) {
      console.error('Failed to fetch backtest:', error);
    } finally {
      set((state) => ({ loadingStates: { ...state.loadingStates, backtest: false } }));
    }
  },
  
  fetchStockPrice: async (symbol: string, period: string = '3mo') => {
    set((state) => ({ loadingStates: { ...state.loadingStates, chart: true } }));
    try {
      const res = await fetch(`${API_URL}/api/chart/${symbol}?period=${period}`);
      
      if (res.ok) {
        const data = await res.json();
        set((state) => ({
          stockPrices: { ...state.stockPrices, [symbol]: data }
        }));
        return data;
      }
      return null;
    } catch (error) {
      console.error(`Failed to fetch price for ${symbol}:`, error);
      return null;
    } finally {
      set((state) => ({ loadingStates: { ...state.loadingStates, chart: false } }));
    }
  },
  
  startBot: async (config?: {
    investment_amount?: number;
    per_trade_amount?: number;
    max_positions?: number;
    run_duration_hours?: number;
    trade_frequency_minutes?: number;
    use_ai_signals?: boolean;
    min_signal_strength?: number;
    stop_loss_pct?: number;
    take_profit_pct?: number;
  }) => {
    try {
      const res = await fetch(`${API_URL}/api/bot/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: config ? JSON.stringify(config) : undefined
      });
      
      const data = await res.json();
      get().fetchBotStatus();
      return data;
    } catch (error) {
      console.error('Failed to start bot:', error);
      throw error;
    }
  },
  
  stopBot: async () => {
    try {
      await fetch(`${API_URL}/api/bot/stop`, {
        method: 'POST'
      });
      
      get().fetchBotStatus();
    } catch (error) {
      console.error('Failed to stop bot:', error);
    }
  },
  
  executeTrade: async (symbol: string, action: 'buy' | 'sell', dollars: number) => {
    // Use direct Alpaca trade endpoint - no auth required
    const res = await fetch(`${API_URL}/api/trade`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ symbol, action, dollars })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.detail || 'Trade failed');
    }
    
    // Refresh portfolio after trade
    get().fetchPortfolio();
    return data;
  },
  
  batchInvest: async (totalDollars: number, useRecommendations: boolean = true, customAllocations?: Array<{symbol: string; weight: number}>) => {
    // Use direct batch trade endpoint - no auth required
    const params = new URLSearchParams({
      total_dollars: totalDollars.toString(),
      use_ai_signals: useRecommendations.toString()
    });
    
    if (!useRecommendations && customAllocations) {
      params.append('custom_symbols', customAllocations.map(a => a.symbol).join(','));
    }
    
    const res = await fetch(`${API_URL}/api/trade/batch?${params}`, {
      method: 'POST'
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.detail || 'Batch investment failed');
    }
    
    // Refresh portfolio after investment
    get().fetchPortfolio();
    return data;
  },
  
  sendChatMessage: async (message) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    
    get().addChatMessage(userMessage);
    
    // Add typing indicator
    const typingMessage: ChatMessage = {
      id: 'typing',
      role: 'assistant',
      content: '...',
      timestamp: new Date()
    };
    get().addChatMessage(typingMessage);
    
    try {
      console.log('Sending chat message to:', `${API_URL}/api/chat`);
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });
      
      console.log('Chat response status:', res.status);
      
      // Remove typing indicator
      set((state) => ({
        chatMessages: state.chatMessages.filter(m => m.id !== 'typing')
      }));
      
      if (res.ok) {
        const data = await res.json();
        console.log('Chat response received:', data);
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        };
        get().addChatMessage(assistantMessage);
      } else {
        const errorText = await res.text();
        console.error('Chat request failed:', res.status, errorText);
        throw new Error('Failed to get response');
      }
    } catch (error) {
      // Remove typing indicator if present
      set((state) => ({
        chatMessages: state.chatMessages.filter(m => m.id !== 'typing')
      }));
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error connecting to the AI service. Please make sure the backend server is running.',
        timestamp: new Date()
      };
      get().addChatMessage(errorMessage);
    }
  },
  
  login: async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!res.ok) return false;
      
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      set({ 
        user: data.user, 
        isAuthenticated: true 
      });
      
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  },
  
  register: async (email, password, name) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      
      if (!res.ok) return false;
      
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      set({ 
        user: data.user, 
        isAuthenticated: true 
      });
      
      return true;
    } catch (error) {
      console.error('Registration failed:', error);
      return false;
    }
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ 
      user: null, 
      isAuthenticated: false,
      portfolio: null,
      chatMessages: [],
      totalBalance: 0,
      availableCash: 0
    });
  }
}));
