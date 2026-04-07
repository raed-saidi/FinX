'use client';

// components/layout/Navbar.tsx - Top navigation bar with mobile menu button

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bell,
  ChevronDown,
  X,
  Check,
  AlertCircle,
  TrendingUp,
  Info,
  Menu,
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import MarketStatusBadge from '@/components/ui/MarketStatusBadge';
import PriceAlerts from '@/components/alerts/PriceAlerts';

// No dummy notifications - will be populated by real events
interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'info' | 'error';
  time: string;
}

interface NavbarProps {
  title?: string;
  className?: string;
}

export default function Navbar({ title = 'Home', className = '' }: NavbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPriceAlerts, setShowPriceAlerts] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user, sidebarCollapsed, toggleMobileMenu, portfolio } = useDashboardStore();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Generate notifications from recent trades
  useEffect(() => {
    if (portfolio?.trades && portfolio.trades.length > 0) {
      const recentTrades = portfolio.trades
        .slice(-3)  // Last 3 trades
        .map((trade, idx) => ({
          id: `trade-${idx}`,
          title: 'Trade Executed',
          message: `${trade.action.toUpperCase()} ${trade.shares} ${trade.symbol} @ $${trade.price?.toFixed(2)}`,
          type: 'success' as const,
          time: new Date(trade.timestamp).toLocaleTimeString(),
        }));
      setNotifications(recentTrades);
    }
  }, [portfolio?.trades]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <Check className="w-4 h-4 text-profit" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case 'info':
        return <Info className="w-4 h-4 text-muted-foreground" />;
      default:
        return <TrendingUp className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Calculate left position - 0 on mobile, 80px/260px on desktop
  const headerLeft = isMobile ? 0 : (sidebarCollapsed ? 80 : 260);

  return (
    <header 
      className={`fixed right-0 h-14 bg-background/90 backdrop-blur-xl border-b border-border z-40 transition-all duration-300 ${className}`}
      style={{ left: headerLeft, top: 0 }}
    >
      <div className="h-full px-4 md:px-6 flex items-center justify-between">
        {/* Left - Mobile menu button + Title */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg md:text-xl font-semibold text-foreground">{title}</h1>
          
          {/* Paper Trading Badge */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded text-amber-400 text-[10px] font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
            </span>
            PAPER
          </div>
          
          {/* Market Status Badge */}
          <div className="hidden md:block">
            <MarketStatusBadge />
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Price Alerts Button */}
          <button
            onClick={() => setShowPriceAlerts(true)}
            className="hidden sm:flex w-8 h-8 bg-card border border-border items-center justify-center text-muted-foreground hover:text-amber-400 hover:border-amber-500/50 transition rounded"
            title="Price Alerts"
          >
            <AlertCircle className="w-4 h-4" />
          </button>
          
          {/* Search */}
          <div className="relative hidden sm:block">
            <AnimatePresence>
              {searchOpen ? (
                <motion.div
                  initial={{ width: 32, opacity: 0 }}
                  animate={{ width: 240, opacity: 1 }}
                  exit={{ width: 32, opacity: 0 }}
                  className="relative"
                >
                  <input
                    type="text"
                    placeholder="Search assets..."
                    className="w-full h-8 pl-8 pr-8 bg-card border border-border rounded text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-muted-foreground transition"
                    autoFocus
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <button
                    onClick={() => setSearchOpen(false)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-8 h-8 bg-card border border-border rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground transition"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
            </AnimatePresence>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative w-8 h-8 bg-card border border-border rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground transition"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[10px] text-white flex items-center justify-center rounded-full">
                  {notifications.length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-14 w-80 bg-card border border-border shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-border">
                      <h3 className="font-semibold text-foreground">Notifications</h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                          <p className="text-muted-foreground text-sm">No notifications yet</p>
                          <p className="text-muted-foreground text-xs mt-1">Trade activity will appear here</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="p-4 border-b border-border hover:bg-muted transition cursor-pointer"
                        >
                          <div className="flex gap-3">
                            <div className="w-8 h-8 bg-muted flex items-center justify-center flex-shrink-0">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                {notification.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground/60 mt-1">
                                {notification.time}
                              </p>
                            </div>
                          </div>
                        </div>
                        ))
                      )}
                    </div>
                    <div className="p-3 border-t border-border">
                      <button className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition">
                        View all notifications
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1 bg-card border border-border rounded hover:border-muted-foreground transition"
            >
              <div className="w-6 h-6 bg-neutral-800 dark:bg-neutral-200 rounded flex items-center justify-center text-white dark:text-neutral-900 font-medium text-xs">
                {user?.name?.charAt(0) || 'J'}
              </div>
              <span className="text-foreground font-medium text-sm hidden md:block">
                {user?.name || 'John Doe'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>

            <AnimatePresence>
              {showProfile && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfile(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-14 w-56 bg-card border border-border shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-border">
                      <p className="font-semibold text-foreground">{user?.name || 'John Doe'}</p>
                      <p className="text-sm text-muted-foreground">{user?.email || 'john@example.com'}</p>
                    </div>
                    <div className="p-2">
                      <button className="w-full text-left px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition">
                        Profile Settings
                      </button>
                      <button className="w-full text-left px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition">
                        Security
                      </button>
                      <button className="w-full text-left px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition">
                        API Keys
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* Price Alerts Modal */}
      <PriceAlerts isOpen={showPriceAlerts} onClose={() => setShowPriceAlerts(false)} />
    </header>
  );
}
