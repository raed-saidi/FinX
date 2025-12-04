'use client';

// components/layout/Sidebar.tsx - Fixed left sidebar navigation with mobile support

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/theme';

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
  const { sidebarCollapsed, toggleSidebar, mobileMenuOpen, closeMobileMenu, logout } = useDashboardStore();
  
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
      {/* Logo */}
      <div className="h-20 flex items-center justify-between px-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={handleNavClick}>
          <div className="w-10 h-10 bg-neutral-800 dark:bg-neutral-200 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-white dark:text-neutral-900" />
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
