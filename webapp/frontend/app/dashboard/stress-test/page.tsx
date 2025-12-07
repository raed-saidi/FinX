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
      style={{ paddingTop: '40px' }}
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

      {/* Under Construction Banner */}
      <div className="p-6 rounded-lg bg-amber-500/10 border border-amber-500/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground mb-2">🚧 Under Construction</h3>
            <p className="text-foreground mb-3">
              This advanced stress testing module is currently under development. Coming soon:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 ml-4">
              <li>• Value at Risk (VaR) calculations</li>
              <li>• Monte Carlo simulations</li>
              <li>• Historical stress scenarios</li>
              <li>• Tail risk analysis</li>
              <li>• Correlation breakdowns</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 opacity-50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-white">Risk Management Suite (Preview)</h3>
            <p className="text-sm text-white/70 mt-1">
              This module will perform comprehensive stress testing to help you 
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
