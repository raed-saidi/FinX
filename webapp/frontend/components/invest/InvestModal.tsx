'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, TrendingUp, AlertCircle, Loader2, Check } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import { Recommendation } from '@/lib/types';
import TradeConfirmationModal from '@/components/trade/TradeConfirmationModal';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useToast } from '@/components/ui/Toast';

interface InvestModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'single' | 'batch';
  stock?: Recommendation | null;
}

export default function InvestModal({ isOpen, onClose, mode, stock }: InvestModalProps) {
  const { recommendations, executeTrade, batchInvest, availableCash, fetchPortfolio } = useDashboardStore();
  const { settings, defaultInvestment, confirmTrades, notificationsEnabled } = useAppSettings();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const MIN_INVESTMENT = 5;

  // Set default investment amount from settings when modal opens
  useEffect(() => {
    if (isOpen && !amount && defaultInvestment) {
      setAmount(defaultInvestment.toString());
    }
  }, [isOpen, defaultInvestment]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const handleInvest = async () => {
    const dollars = parseFloat(amount);
    
    if (isNaN(dollars) || dollars < MIN_INVESTMENT) {
      setError(`Minimum investment is $${MIN_INVESTMENT}`);
      return;
    }

    if (dollars > availableCash) {
      setError(`Insufficient funds. Available: $${availableCash.toFixed(2)}`);
      return;
    }

    setError(null);
    
    // For single stock trades, show confirmation modal if setting enabled
    if (mode === 'single' && stock && confirmTrades) {
      setShowConfirmation(true);
      return;
    }
    
    // Execute trade directly if confirmation disabled or batch mode
    await executeTradeAction();
  };

  const executeTradeAction = async () => {
    const dollars = parseFloat(amount);
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'single' && stock) {
        const result = await executeTrade(stock.asset, 'buy', dollars);
        setSuccess(result.message);
        if (notificationsEnabled.trades) {
          toast.success('Trade Executed', `Bought $${dollars} of ${stock.asset}`);
        }
      } else {
        const result = await batchInvest(dollars, true);
        setSuccess(result.message);
        if (notificationsEnabled.trades) {
          toast.success('Batch Investment Complete', `Invested $${dollars} across AI picks`);
        }
      }
      
      // Refresh portfolio
      await fetchPortfolio();
      
      // Close modal after success
      setTimeout(() => {
        onClose();
        setAmount('');
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Investment failed');
    } finally {
      setIsLoading(false);
    }
  };

  const longRecommendations = recommendations.filter(r => r.direction === 'LONG');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-border w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {mode === 'single' ? `Invest in ${stock?.asset}` : 'Smart Invest'}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {mode === 'single' 
                  ? `Current price: $${stock?.current_price?.toFixed(2)}`
                  : 'Invest in AI-recommended stocks'
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted transition"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Available Cash */}
            <div className="bg-muted p-4">
              <p className="text-muted-foreground text-sm">Available Cash</p>
              <p className="text-2xl font-bold text-foreground">${availableCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-muted-foreground text-sm mb-2">Investment Amount (USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min={MIN_INVESTMENT}
                  step="0.01"
                  className="w-full bg-muted border border-border py-3 pl-12 pr-4 text-foreground text-lg focus:outline-none focus:border-muted-foreground transition"
                />
              </div>
              <p className="text-muted-foreground text-xs mt-2">Minimum investment: ${MIN_INVESTMENT}</p>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex gap-2">
              {[10, 25, 50, 100, 500].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className="flex-1 py-2 bg-muted hover:bg-border text-foreground text-sm font-medium transition"
                >
                  ${amt}
                </button>
              ))}
            </div>

            {/* Batch Investment Preview */}
            {mode === 'batch' && amount && parseFloat(amount) >= MIN_INVESTMENT && (
              <div className="bg-muted p-4 space-y-3">
                <div className="flex items-center gap-2 text-foreground mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">AI Allocation Preview</span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {longRecommendations.slice(0, 5).map((rec) => (
                    <div key={rec.asset} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{rec.asset}</span>
                      <div className="text-right">
                        <span className="text-muted-foreground">{(rec.weight * 100).toFixed(1)}%</span>
                        <span className="text-profit ml-2">
                          ${(parseFloat(amount) * rec.weight).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Single Stock Info with P&L Calculator */}
            {mode === 'single' && stock && (
              <div className="bg-muted p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Signal Strength</span>
                  <span className={`text-sm font-medium ${stock.signal > 0 ? 'text-profit' : 'text-loss'}`}>
                    {stock.signal > 0 ? '+' : ''}{(stock.signal * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Direction</span>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                    stock.direction === 'LONG' ? 'bg-profit/20 text-profit' : 
                    stock.direction === 'SHORT' ? 'bg-loss/20 text-loss' : 
                    'bg-muted text-muted-foreground'
                  }`}>
                    {stock.direction}
                  </span>
                </div>
                {amount && parseFloat(amount) >= MIN_INVESTMENT && (
                  <>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-muted-foreground text-sm">Est. Shares</span>
                      <span className="text-foreground font-medium">
                        {(parseFloat(amount) / stock.current_price).toFixed(6)}
                      </span>
                    </div>
                    
                    {/* P&L Calculator */}
                    <div className="mt-3 p-3 bg-background space-y-2">
                      <p className="text-xs text-muted-foreground font-medium mb-2">📊 Potential P&L (based on signal)</p>
                      {(() => {
                        const investment = parseFloat(amount);
                        const shares = investment / stock.current_price;
                        const expectedMove = stock.signal * stock.current_price;
                        const targetPrice = stock.current_price + expectedMove;
                        const potentialProfit = shares * expectedMove;
                        const potentialReturn = (potentialProfit / investment) * 100;
                        
                        // Calculate scenarios
                        const bullCase = investment * 0.1; // +10%
                        const bearCase = investment * -0.05; // -5%
                        
                        return (
                          <>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Target Price</span>
                              <span className="text-foreground">${targetPrice.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Expected P&L</span>
                              <span className={potentialProfit >= 0 ? 'text-profit' : 'text-loss'}>
                                {potentialProfit >= 0 ? '+' : ''}${potentialProfit.toFixed(2)} ({potentialReturn >= 0 ? '+' : ''}{potentialReturn.toFixed(2)}%)
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                              <span className="text-muted-foreground">If +10%</span>
                              <span className="text-profit">+${bullCase.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">If -5%</span>
                              <span className="text-loss">-${Math.abs(bearCase).toFixed(2)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Error/Success Messages */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-loss/10 border border-loss/20 text-loss">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 bg-profit/10 border border-profit/20 text-profit">
                <Check className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{success}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleInvest}
              disabled={isLoading || !amount || parseFloat(amount) < MIN_INVESTMENT}
              className="w-full py-4 bg-neutral-800 dark:bg-neutral-200 hover:bg-neutral-700 dark:hover:bg-neutral-300 disabled:bg-neutral-500 disabled:cursor-not-allowed text-white dark:text-neutral-900 font-semibold transition flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5" />
                  {mode === 'single' ? `Invest $${amount || '0'} in ${stock?.asset}` : `Invest $${amount || '0'}`}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* Trade Confirmation Modal for single stock */}
      {mode === 'single' && stock && (
        <TradeConfirmationModal
          isOpen={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          onConfirm={executeTradeAction}
          symbol={stock.asset}
          action="buy"
          shares={parseFloat(amount) / stock.current_price || 0}
          price={stock.current_price}
          total={parseFloat(amount) || 0}
        />
      )}
    </AnimatePresence>
  );
}
