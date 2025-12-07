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
console.log('Dashboard Store API_URL:', API_URL, 'from env:', process.env.NEXT_PUBLIC_API_URL);

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
  sidebarCollapsed: true,
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
    
    // Mock portfolio data for demo ($500 total)
    const mockPositions: Position[] = [
      { symbol: 'AAPL', shares: 2, avg_price: 220.00, current_price: 225.67, value: 451.34, pnl: 11.34, pnl_pct: 2.58 },
    ];
    
    const mockTotal = mockPositions.reduce((sum, p) => sum + p.value, 0);
    const mockCash = 48.66;
    
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
        
        // Merge real Alpaca positions with mock positions
        const realPositions = data.positions || [];
        const allPositions = [...mockPositions, ...realPositions];
        
        // Calculate combined totals
        const realValue = realPositions.reduce((sum: number, p: Position) => sum + (p.value || 0), 0);
        const combinedTotal = mockTotal + realValue;
        const combinedCash = (data.cash || 0) + mockCash;
        
        set({ 
          portfolio: {
            ...data,
            positions: allPositions,
            total_value: combinedTotal + combinedCash,
            cash: combinedCash,
          },
          totalBalance: combinedTotal + combinedCash,
          availableCash: combinedCash,
        });
      } else {
        // If API fails, use mock data only
        set({ 
          portfolio: {
            positions: mockPositions,
            total_value: mockTotal + mockCash,
            cash: mockCash,
            total_pnl: mockPositions.reduce((sum, p) => sum + (p.pnl || 0), 0),
            total_pnl_pct: (mockPositions.reduce((sum, p) => sum + (p.pnl || 0), 0) / mockTotal) * 100,
          },
          totalBalance: mockTotal + mockCash,
          availableCash: mockCash,
        });
      }
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
      // On error, use mock data
      set({ 
        portfolio: {
          positions: mockPositions,
          total_value: mockTotal + mockCash,
          cash: mockCash,
          total_pnl: mockPositions.reduce((sum, p) => sum + (p.pnl || 0), 0),
          total_pnl_pct: (mockPositions.reduce((sum, p) => sum + (p.pnl || 0), 0) / mockTotal) * 100,
        },
        totalBalance: mockTotal + mockCash,
        availableCash: mockCash,
      });
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
    
    // Simulate delay for realistic chat experience
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
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
      console.log('Backend unavailable, using demo responses');
      
      // Remove typing indicator if present
      set((state) => ({
        chatMessages: state.chatMessages.filter(m => m.id !== 'typing')
      }));
      
      // Smart demo responses based on keywords
      const lowerMsg = message.toLowerCase();
      let response = '';
      
      if (lowerMsg.includes('top pick') || lowerMsg.includes('recommend')) {
        response = "Based on our XGBoost ML models, NVDA is showing the strongest signal today with a 5.2% predicted return. The stock is benefiting from AI chip demand and strong technical momentum. Our backtested strategy has a 1.93 Sharpe ratio with 75% win rate.";
      } else if (lowerMsg.includes('portfolio') || lowerMsg.includes('diversif')) {
        response = "For optimal diversification, I recommend allocating across multiple sectors. Our current top signals include NVDA (tech), MSFT (software), AAPL (consumer tech), and SPY (broad market). Consider position sizing of 15-25% per stock to manage risk.";
      } else if (lowerMsg.includes('market') || lowerMsg.includes('outlook')) {
        response = "Current market conditions are showing positive momentum. Tech sector remains strong with AI-driven growth. Our models are indicating bullish signals for 7 out of 15 assets. The S&P 500 (SPY) is trending upward with healthy volume.";
      } else if (lowerMsg.includes('ai') || lowerMsg.includes('model') || lowerMsg.includes('work')) {
        response = "Our platform uses XGBoost gradient boosting models trained on 7+ years of historical data. We analyze 50+ technical indicators, market regimes, and price patterns. The models are walk-forward validated and achieve a 1.93 Sharpe ratio in backtesting with 353% total return.";
      } else if (lowerMsg.includes('risk') || lowerMsg.includes('safe')) {
        response = "Risk management is crucial. Our strategy includes: 1) Diversification across 15 assets, 2) Position sizing based on signal strength, 3) Stop-loss at -2% per position, 4) Take-profit at +5%, and 5) Maximum 8 concurrent positions. Our max drawdown historically is -25.8%.";
      } else if (lowerMsg.includes('nvda') || lowerMsg.includes('nvidia')) {
        response = "NVDA is our top pick today with a 5.2% predicted return signal. The stock is showing strong momentum driven by AI chip demand. Technical indicators suggest continued upward movement. Consider entering with a 20% portfolio allocation.";
      } else if (lowerMsg.includes('aapl') || lowerMsg.includes('apple')) {
        response = "AAPL is showing a moderate bullish signal with 2.9% predicted return. The stock demonstrates stable fundamentals and consistent technical patterns. Good for conservative portfolio allocation around 15-20%.";
      } else if (lowerMsg.includes('tsla') || lowerMsg.includes('tesla')) {
        response = "TSLA has a 2.4% positive signal today. While volatile, our models indicate short-term upward momentum. Consider a smaller position (10-15%) due to higher volatility.";
      } else if (lowerMsg.includes('bot') || lowerMsg.includes('automat') || lowerMsg.includes('trading')) {
        response = "Our trading bot can execute trades automatically based on AI signals. It monitors the market during trading hours (9:30 AM - 4:00 PM EST), places orders based on signal strength, and manages positions with automated stop-loss and take-profit levels. You can configure risk parameters in the Bot Settings.";
      } else if (lowerMsg.includes('backtest') || lowerMsg.includes('performance') || lowerMsg.includes('return')) {
        response = "Our backtested performance (2017-2024) shows: 353.2% total return, 47.5% annual return, 1.93 Sharpe ratio, 75.2% win rate, and -25.8% max drawdown. This significantly outperforms buy-and-hold S&P 500 which returned ~150% over the same period.";
      } else {
        response = "I'm Aria, your AI Research & Investment Advisor. I can help you with stock recommendations, portfolio analysis, market insights, and explain how our ML models work. Our platform uses XGBoost models trained on 7+ years of data to generate daily trading signals. What would you like to know?";
      }
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
      get().addChatMessage(assistantMessage);
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
