'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, AlertTriangle, Activity } from 'lucide-react';
import StressTestPanel from '@/components/stress-test/StressTestPanel';

export default function StressTestPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0f0f1a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Stress Testing</h1>
                  <p className="text-xs text-gray-500">Risk Assessment & VaR Analysis</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
                <Activity className="w-4 h-4" />
                <span>Comprehensive Risk Analysis</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Info Banner */}
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-white">Risk Management Suite</h3>
                <p className="text-sm text-gray-400 mt-1">
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
      </main>
    </div>
  );
}
