// lib/types.ts - Type definitions for the dashboard

export interface Position {
  symbol: string;
  shares: number;
  avg_price: number;
  current_price: number;
  value: number;
  pnl: number;
  pnl_pct: number;
}

export interface Trade {
  symbol: string;
  action: 'buy' | 'sell';
  shares: number;
  price: number;
  total: number;
  timestamp: string;
  alpaca_order_id?: string | null;
}

export interface Portfolio {
  cash: number;
  positions: Position[];
  total_value: number;
  trades?: Trade[];
  total_pnl?: number;
  total_pnl_pct?: number;
}

export interface Recommendation {
  asset: string;
  signal: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  weight: number;
  weight_pct: number;
  dollars: number;
  shares: number;
  current_price: number;
  confidence?: number;
  predicted_return_pct?: number;
  last_updated?: string;
}

export interface BotStatus {
  running: boolean;
  mode: string;
  last_trade?: string;
  trades_today: number;
  next_rebalance?: string;
  strategy: string;
  assets_tracked: number;
  started_at?: string;
  alpaca_connected: boolean;
  alpaca_account?: {
    buying_power: number;
    cash: number;
    portfolio_value: number;
    equity: number;
    status: string;
  };
  config?: {
    investment_amount: number;
    per_trade_amount: number;
    max_positions: number;
    run_duration_hours: number;
    trade_frequency_minutes: number;
    use_ai_signals: boolean;
    min_signal_strength: number;
    stop_loss_pct: number;
    take_profit_pct: number;
  };
}

export interface ChartData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface StockPrice {
  symbol: string;
  current_price: number;
  change_pct: number;
  high_52w: number;
  low_52w: number;
  data: ChartData[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface User {
  email: string;
  name: string;
}

export interface AlpacaPosition {
  symbol: string;
  qty: number;
  avg_entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  side: string;
}

export interface AlpacaOrder {
  id: string;
  symbol: string;
  qty: string;
  side: string;
  type: string;
  status: string;
  created_at: string;
  filled_avg_price?: string;
}

export interface BacktestMetrics {
  total_return: number;
  annual_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
}

// Stress Testing Types
export interface VaRResult {
  method: string;
  confidence: number;
  horizon_days: number;
  var: number;
  var_pct: number;
  cvar: number;
  cvar_pct: number;
}

export interface StressScenario {
  Scenario: string;
  Description: string;
  'Portfolio Return (%)': number;
  'Loss ($)': number;
  'Final Value ($)': number;
  'Vol Spike': string;
}

export interface TailRisk {
  mean_daily_return: number;
  daily_volatility: number;
  annualized_volatility: number;
  skewness: number;
  excess_kurtosis: number;
  is_fat_tailed: boolean;
  is_negatively_skewed: boolean;
  left_tail_5pct: number;
  left_tail_1pct: number;
  right_tail_95pct: number;
  right_tail_99pct: number;
}

export interface StressTestResult {
  success: boolean;
  weights_used: Record<string, number>;
  portfolio_value: number;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  var: Record<string, {
    historical: VaRResult;
    parametric: VaRResult;
    monte_carlo: VaRResult;
  }>;
  scenarios: {
    historical: StressScenario[];
    hypothetical: StressScenario[];
    summary: {
      worst_case: number;
      best_case: number;
      average_loss: number;
      scenarios_tested: number;
    };
  };
  tail_risk: TailRisk;
  timestamp: string;
}
