'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Loader2, 
  Check,
  DollarSign,
  ShieldAlert
} from 'lucide-react';
import StockLogo from '@/components/ui/StockLogo';

interface TradeConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  symbol: string;
  action: 'buy' | 'sell';
  shares: number;
  price: number;
  total: number;
}

export default function TradeConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  symbol,
  action,
  shares,
  price,
  total,
}: TradeConfirmationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBuy = action === 'buy';

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Trade failed');
    } finally {
      setIsLoading(false);
    }
  };

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
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="bg-card border border-border rounded-lg w-full max-w-md shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isBuy ? 'bg-emerald-500/20' : 'bg-red-500/20'
              }`}>
                {isBuy ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Confirm {isBuy ? 'Buy' : 'Sell'} Order
                </h2>
                <p className="text-sm text-muted-foreground">Review your trade details</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-card-secondary transition text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Stock Info */}
            <div className="flex items-center justify-center gap-4 p-4 bg-card-secondary rounded-lg">
              <StockLogo symbol={symbol} size="xl" />
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{symbol}</p>
                <p className={`text-sm font-medium ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isBuy ? 'BUY ORDER' : 'SELL ORDER'}
                </p>
              </div>
            </div>

            {/* Trade Details */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <span className="text-muted-foreground">Shares</span>
                <span className="text-foreground font-medium">{shares.toFixed(6)}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-border">
                <span className="text-muted-foreground">Price per share</span>
                <span className="text-foreground font-medium">${price.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-foreground font-medium">Total Amount</span>
                <span className={`text-xl font-bold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Warning */}
            <div className={`flex items-start gap-3 p-4 rounded-lg ${
              isBuy ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-red-500/10 border border-red-500/20'
            }`}>
              <ShieldAlert className={`w-5 h-5 mt-0.5 ${isBuy ? 'text-amber-400' : 'text-red-400'}`} />
              <div>
                <p className={`text-sm font-medium ${isBuy ? 'text-amber-400' : 'text-red-400'}`}>
                  {isBuy ? 'Investment Warning' : 'Sell Warning'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isBuy 
                    ? 'This will use your available cash to purchase shares. Market prices may vary.'
                    : 'This will sell your shares at the current market price. This action cannot be undone.'
                  }
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-border">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-lg border border-border text-foreground hover:bg-card-secondary transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                isBuy 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                  : 'bg-red-600 hover:bg-red-700 text-white'
              } disabled:opacity-50`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Confirm {isBuy ? 'Buy' : 'Sell'}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
