'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, Activity } from 'lucide-react';
import StressTestPanel from '@/components/stress-test/StressTestPanel';

export default function StressTestPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stress Testing</h1>
          <p className="text-muted-foreground text-sm mt-1">Risk Assessment & VaR Analysis</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="w-4 h-4" />
          <span>Comprehensive Risk Analysis</span>
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-foreground">Risk Management Suite</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This module performs comprehensive stress testing including Value at Risk (VaR) calculations, 
              Monte Carlo simulations, historical stress scenarios, and tail risk analysis to help you 
              understand potential portfolio risks under various market conditions.
            </p>
          </div>
        </div>
      </div>

      {/* Stress Test Panel */}
      <StressTestPanel />
    </motion.div>
  );
}
