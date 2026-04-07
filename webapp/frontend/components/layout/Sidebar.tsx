'use client';

// components/layout/Sidebar.tsx - Fixed left sidebar navigation with mobile support

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Wallet,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
  Bot,
  TrendingUp,
  Settings,
  ClipboardList,
  X,
  Shield,
  Brain,
  Bell,
  Search,
  Menu,
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/theme';
import MarketStatusBadge from '@/components/ui/MarketStatusBadge';

const menuItems = [
  { icon: LayoutDashboard, label: 'Home', href: '/dashboard' },
  { icon: Brain, label: 'AI Picks', href: '/dashboard/recommendations' },
  { icon: ArrowLeftRight, label: 'Transactions', href: '/dashboard/transactions' },
  { icon: PieChart, label: 'Portfolio', href: '/dashboard/portfolio' },
  { icon: ClipboardList, label: 'Orders', href: '/dashboard/orders' },
  { icon: Wallet, label: 'Wallet', href: '/dashboard/wallet' },
  { icon: Bot, label: 'Trading Bot', href: '/dashboard/bot' },
  { icon: TrendingUp, label: 'Markets', href: '/dashboard/markets' },
  { icon: Shield, label: 'Stress Test', href: '/dashboard/stress-test' },
];

const bottomItems = [
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
  { icon: HelpCircle, label: 'Help', href: '/dashboard/help' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar, mobileMenuOpen, closeMobileMenu, toggleMobileMenu, logout, portfolio } = useDashboardStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // Generate notifications from recent trades
  useEffect(() => {
    if (portfolio?.trades && portfolio.trades.length > 0) {
      const recentTrades = portfolio.trades
        .slice(-3)
        .map((trade: any, idx: number) => ({
          id: `trade-${idx}`,
          title: 'Trade Executed',
          message: `${trade.action.toUpperCase()} ${trade.shares} ${trade.symbol} @ $${trade.price?.toFixed(2)}`,
          type: 'success' as const,
          time: new Date(trade.timestamp).toLocaleTimeString(),
        }));
      setNotifications(recentTrades);
    }
  }, [portfolio?.trades]);
  
  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleNavClick = () => {
    // Close mobile menu on navigation
    closeMobileMenu();
  };

  const sidebarContent = (isMobile: boolean = false) => (
    <>
      {/* Logo & Header Actions */}
      <div className="border-b border-border">
        <div className="h-20 flex items-center justify-between px-6">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={handleNavClick}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <AnimatePresence>
              {(!sidebarCollapsed || isMobile) && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="text-xl font-bold text-foreground"
                >
                  FinX
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          {isMobile && (
            <button onClick={closeMobileMenu} className="p-2 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {/* Quick Actions - Market Status, Notifications, Search */}
        <AnimatePresence>
          {(!sidebarCollapsed || isMobile) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 pb-3 space-y-2"
            >
              {/* Market Status */}
              <div className="px-3 py-2 bg-card border border-border rounded">
                <MarketStatusBadge />
              </div>
              
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="w-full flex items-center gap-3 px-3 py-2 bg-card border border-border rounded text-muted-foreground hover:text-foreground hover:border-muted-foreground transition"
                >
                  <Bell className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">Notifications</span>
                  {notifications.length > 0 && (
                    <span className="ml-auto w-5 h-5 bg-red-500 text-white text-xs flex items-center justify-center rounded-full">
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
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute left-full ml-2 top-0 w-80 bg-card border border-border shadow-2xl rounded z-50 overflow-hidden"
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
                                <div className="flex items-start gap-3">
                                  <div className="mt-1">{notification.type === 'success' && '✓'}</div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-foreground">{notification.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Search */}
              <button
                onClick={() => {
                  // Trigger global search modal
                  const searchButton = document.querySelector('[data-search-trigger]') as HTMLButtonElement;
                  searchButton?.click();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 bg-card border border-border rounded text-muted-foreground hover:text-foreground hover:border-muted-foreground transition"
              >
                <Search className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">Search assets...</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toggle button (desktop only) */}
      {!isMobile && (
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-24 w-6 h-6 bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Main Menu */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={`
                relative flex items-center gap-3 px-3 py-3 transition-all duration-200
                ${isActive 
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId={isMobile ? "activeTabMobile" : "activeTab"}
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-neutral-800 dark:bg-neutral-200"
                />
              )}
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-foreground' : ''}`} />
              <AnimatePresence>
                {(!sidebarCollapsed || isMobile) && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="font-medium"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Menu */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        {/* Theme Toggle */}
        <div className={`flex items-center gap-3 px-3 py-2 ${sidebarCollapsed && !isMobile ? 'justify-center' : ''}`}>
          <ThemeToggle />
          <AnimatePresence>
            {(!sidebarCollapsed || isMobile) && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-medium text-muted-foreground"
              >
                Theme
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={handleNavClick}
            className="flex items-center gap-3 px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence>
              {(!sidebarCollapsed || isMobile) && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="font-medium"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        ))}
        
        {/* Logout */}
        <button
          onClick={() => {
            handleNavClick();
            handleLogout();
          }}
          className="w-full flex items-center gap-3 px-3 py-3 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {(!sidebarCollapsed || isMobile) && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-medium"
              >
                Log Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 80 : 260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden md:flex fixed left-0 top-0 h-screen bg-background border-r border-border z-50 flex-col"
      >
        {sidebarContent(false)}
      </motion.aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMobileMenu}
              className="md:hidden fixed inset-0 bg-black/50 z-50"
            />
            {/* Sidebar */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="md:hidden fixed left-0 top-0 h-screen w-72 bg-background border-r border-border z-50 flex flex-col"
            >
              {sidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
