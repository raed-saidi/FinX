'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface PriceAlert {
  id: number;
  symbol: string;
  target_price: number;
  condition: 'above' | 'below';
  message: string;
  created_at: string;
  triggered: boolean;
  triggered_at?: string;
}

interface PriceAlertsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PriceAlerts({ isOpen, onClose }: PriceAlertsProps) {
  const toast = useToast();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAlert, setNewAlert] = useState({
    symbol: '',
    target_price: '',
    condition: 'above' as 'above' | 'below',
  });

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/alerts`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen]);

  const handleCreateAlert = async () => {
    if (!newAlert.symbol || !newAlert.target_price) {
      toast.error('Missing Fields', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: newAlert.symbol.toUpperCase(),
          target_price: parseFloat(newAlert.target_price),
          condition: newAlert.condition,
        }),
      });

      if (res.ok) {
        toast.success('Alert Created', `${newAlert.symbol} ${newAlert.condition} $${newAlert.target_price}`);
        setNewAlert({ symbol: '', target_price: '', condition: 'above' });
        setShowAddForm(false);
        fetchAlerts();
      } else {
        toast.error('Failed', 'Could not create alert');
      }
    } catch (error) {
      toast.error('Error', 'Failed to create alert');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAlert = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/api/alerts/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.info('Alert Deleted');
        fetchAlerts();
      }
    } catch (error) {
      toast.error('Error', 'Failed to delete alert');
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
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-border w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Price Alerts</h2>
                <p className="text-xs text-muted-foreground">{alerts.length} active alerts</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded transition">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Add Alert Form */}
          {showAddForm ? (
            <div className="p-4 border-b border-border bg-background">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Symbol (e.g., AAPL)"
                  value={newAlert.symbol}
                  onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value })}
                  className="w-full px-3 py-2 bg-card border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-2">
                  <select
                    value={newAlert.condition}
                    onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value as 'above' | 'below' })}
                    className="px-3 py-2 bg-card border border-border rounded text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Target Price"
                    value={newAlert.target_price}
                    onChange={(e) => setNewAlert({ ...newAlert, target_price: e.target.value })}
                    className="flex-1 px-3 py-2 bg-card border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateAlert}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Create
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 border-b border-border">
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition"
              >
                <Plus className="w-4 h-4" />
                Add Price Alert
              </button>
            </div>
          )}

          {/* Alerts List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground opacity-30 mb-3" />
                <p className="text-muted-foreground">No price alerts set</p>
                <p className="text-xs text-muted-foreground mt-1">Create alerts to get notified when prices hit your targets</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center justify-between p-3 rounded border ${
                    alert.triggered 
                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 flex items-center justify-center rounded ${
                      alert.condition === 'above' 
                        ? 'bg-emerald-500/20' 
                        : 'bg-red-500/20'
                    }`}>
                      {alert.condition === 'above' ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {alert.symbol} {alert.condition} ${alert.target_price}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {alert.triggered ? (
                          <span className="text-emerald-400">✓ Triggered</span>
                        ) : (
                          'Watching...'
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="p-2 hover:bg-red-500/20 rounded transition"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
