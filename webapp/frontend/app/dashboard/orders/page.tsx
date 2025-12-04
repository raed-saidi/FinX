'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Filter,
  Calendar,
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import { TableSkeleton } from '@/components/ui/Skeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface AlpacaOrder {
  id: string;
  symbol: string;
  side: string;
  type: string;
  qty: string;
  filled_qty: string;
  filled_avg_price: string | null;
  status: string;
  created_at: string;
  filled_at: string | null;
  submitted_at: string;
}

export default function OrdersPage() {
  const { initializeFromStorage } = useDashboardStore();
  const [orders, setOrders] = useState<AlpacaOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'filled' | 'open' | 'cancelled'>('all');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/alpaca/orders?status=all&limit=100`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    initializeFromStorage();
    fetchOrders();
    // No auto-refresh - use manual refresh button
  }, []);

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'filled') return order.status === 'filled';
    if (filter === 'open') return ['new', 'accepted', 'pending_new', 'partially_filled'].includes(order.status);
    if (filter === 'cancelled') return ['cancelled', 'expired', 'rejected'].includes(order.status);
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'filled':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'partially_filled':
        return 'bg-gray-500/20 text-gray-400';
      case 'new':
      case 'accepted':
      case 'pending_new':
        return 'bg-amber-500/20 text-amber-400';
      case 'cancelled':
      case 'expired':
      case 'rejected':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'filled':
        return CheckCircle;
      case 'cancelled':
      case 'rejected':
        return XCircle;
      default:
        return Clock;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const filledOrders = orders.filter(o => o.status === 'filled');
  const openOrders = orders.filter(o => ['new', 'accepted', 'pending_new', 'partially_filled'].includes(o.status));
  const totalVolume = filledOrders.reduce((sum, o) => {
    const price = parseFloat(o.filled_avg_price || '0');
    const qty = parseFloat(o.filled_qty || '0');
    return sum + (price * qty);
  }, 0);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Order History</h1>
          <p className="text-muted-foreground text-sm mt-1">All trades from Alpaca Paper Trading</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-card rounded border border-border">
            <Clock className="w-4 h-4 text-muted" />
            <span className="text-muted-foreground text-sm">{mounted ? lastUpdate.toLocaleTimeString() : '--:--:--'}</span>
          </div>
          <button
            onClick={() => { setIsLoading(true); fetchOrders(); }}
            className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-card-secondary text-foreground rounded transition border border-border"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-neutral-500/20 rounded flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground text-sm">Total Orders</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{orders.length}</p>
        </div>

        <div className="bg-card border border-border rounded p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-500/20 rounded flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-muted-foreground text-sm">Filled</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{filledOrders.length}</p>
        </div>

        <div className="bg-card border border-border rounded p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-500/20 rounded flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-muted-foreground text-sm">Open Orders</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{openOrders.length}</p>
        </div>

        <div className="bg-card border border-border rounded p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-500/20 rounded flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-muted-foreground text-sm">Total Volume</span>
          </div>
          <p className="text-2xl font-bold text-foreground">${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted" />
        {(['all', 'filled', 'open', 'cancelled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded text-sm font-medium transition ${
              filter === f
                ? 'bg-neutral-600 text-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </motion.div>

      {/* Orders Table */}
      <motion.div variants={itemVariants}>
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : (
          <div className="bg-card border border-border rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-card-secondary">
                  <tr>
                    <th className="text-left text-muted-foreground text-xs font-medium px-6 py-4">Symbol</th>
                    <th className="text-left text-muted-foreground text-xs font-medium px-6 py-4">Side</th>
                    <th className="text-left text-muted-foreground text-xs font-medium px-6 py-4">Type</th>
                    <th className="text-right text-muted-foreground text-xs font-medium px-6 py-4">Qty</th>
                    <th className="text-right text-muted-foreground text-xs font-medium px-6 py-4">Filled</th>
                    <th className="text-right text-muted-foreground text-xs font-medium px-6 py-4">Price</th>
                    <th className="text-right text-muted-foreground text-xs font-medium px-6 py-4">Total</th>
                    <th className="text-center text-muted-foreground text-xs font-medium px-6 py-4">Status</th>
                    <th className="text-right text-muted-foreground text-xs font-medium px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-muted">
                        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No orders found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const StatusIcon = getStatusIcon(order.status);
                      const isBuy = order.side === 'buy';
                      const filledPrice = parseFloat(order.filled_avg_price || '0');
                      const filledQty = parseFloat(order.filled_qty || '0');
                      const total = filledPrice * filledQty;
                      const date = new Date(order.filled_at || order.created_at);

                      return (
                        <tr key={order.id} className="hover:bg-card-secondary/50 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded flex items-center justify-center ${
                                isBuy ? 'bg-emerald-500/20' : 'bg-red-500/20'
                              }`}>
                                {isBuy ? (
                                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                                ) : (
                                  <TrendingDown className="w-5 h-5 text-red-400" />
                                )}
                              </div>
                              <span className="text-foreground font-medium">{order.symbol}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-medium ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                              {order.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-muted-foreground text-sm">{order.type}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-foreground">{parseFloat(order.qty).toFixed(4)}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-muted-foreground">{filledQty.toFixed(4)}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-foreground">
                              {filledPrice > 0 ? `$${filledPrice.toFixed(2)}` : '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`font-medium ${isBuy ? 'text-red-400' : 'text-emerald-400'}`}>
                              {total > 0 ? `${isBuy ? '-' : '+'}$${total.toFixed(2)}` : '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                              <StatusIcon className="w-3 h-3" />
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-sm">
                              <p className="text-foreground">{date.toLocaleDateString()}</p>
                              <p className="text-muted">{date.toLocaleTimeString()}</p>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
