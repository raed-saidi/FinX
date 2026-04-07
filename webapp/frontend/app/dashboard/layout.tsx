'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import ChatWidget from '@/components/chat/ChatWidget';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import SearchModal from '@/components/ui/SearchModal';
import { useDashboardStore } from '@/store/dashboard-store';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import MarketTicker from '@/components/ui/MarketTicker';

// Wrapper component to use hooks inside ToastProvider
function DashboardContent({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useDashboardStore();
  const [isMobile, setIsMobile] = useState(false);
  
  // Connect to WebSocket for real-time updates
  const { isConnected } = useRealtimeUpdates();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const mainMargin = isMobile ? 0 : (sidebarCollapsed ? 80 : 260);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className="transition-all duration-300"
        style={{ marginLeft: mainMargin }}
      >
        {/* Market Ticker - At the top */}
        <div className="fixed top-0 left-0 right-0 z-30 transition-all duration-300" style={{ paddingLeft: mainMargin }}>
          <MarketTicker height={36} speed={100} />
        </div>
        {/* pt-[100px] = ticker (36px) + spacing (64px) */}
        <main  className="  p-4 md:p-6 pt-[100px] min-h-screen">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
      <ChatWidget />
      <SearchModal />
      
      {/* WebSocket Connection Status (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className={`fixed bottom-4 left-4 px-2 py-1 text-xs rounded z-50 ${
          isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          WS: {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <DashboardContent>{children}</DashboardContent>
    </ToastProvider>
  );
}
