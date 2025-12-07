'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Bot, 
  Shield, 
  Zap,
  ArrowRight,
  BarChart3,
  Brain,
  Lock,
  ChevronRight,
  Star,
  Users,
  Globe,
  Smartphone,
  LineChart,
  Activity,
} from 'lucide-react';
import MarketTicker from '@/components/ui/MarketTicker';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Auth Modal Component
function AuthModal({ isOpen, onClose, onSuccess, initialMode = 'signin' }: { 
  isOpen: boolean; 
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'signin' | 'register';
}) {
  const [isRegister, setIsRegister] = useState(initialMode === 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  // Reset form state when modal opens with new mode
  useEffect(() => {
    if (isOpen) {
      setIsRegister(initialMode === 'register');
      setError('');
      setEmail('');
      setPassword('');
      setName('');
      setTotpCode('');
      setRequires2FA(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister 
        ? { email, password, name } 
        : { email, password, totp_code: totpCode || null };

      console.log(`${isRegister ? 'Registration' : 'Login'} request to:`, `${API_URL}${endpoint}`);
      console.log('Request body:', JSON.stringify({ ...body, password: '[REDACTED]' }));

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      console.log(`${isRegister ? 'Registration' : 'Login'} response status:`, res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`${isRegister ? 'Registration' : 'Login'} failed:`, res.status, errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText || 'Authentication failed' };
        }
        
        // Handle validation errors from FastAPI
        if (errorData.detail && Array.isArray(errorData.detail)) {
          const messages = errorData.detail.map((err: any) => err.msg).join(', ');
          throw new Error(messages);
        }
        
        throw new Error(typeof errorData.detail === 'string' ? errorData.detail : 'Authentication failed');
      }

      const data = await res.json();
      console.log(`${isRegister ? 'Registration' : 'Login'} successful:`, { ...data, access_token: data.access_token ? '[REDACTED]' : undefined });
      
      // Check if 2FA is required
      if (data.requires_2fa && data.temp_token) {
        setRequires2FA(true);
        setTempToken(data.temp_token);
        setLoading(false);
        return;
      }

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode, temp_token: tempToken })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || '2FA verification failed');
      }

      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRequires2FA(false);
    setTempToken('');
    setTotpCode('');
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0B0F1A] border border-[#1a2332] rounded-lg p-8 w-full max-w-md relative shadow-2xl"
      >
        <button 
          onClick={() => { onClose(); resetForm(); }} 
          className="absolute top-4 right-4 text-gray-500 hover:text-white text-2xl transition"
        >
          ×
        </button>
        
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center mx-auto mb-4">
            {requires2FA ? <Shield className="w-7 h-7 text-white" /> : <LineChart className="w-7 h-7 text-white" />}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {requires2FA ? 'Two-Factor Authentication' : isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-gray-400">
            {requires2FA 
              ? 'Enter the 6-digit code from your authenticator app'
              : isRegister 
              ? 'Start trading with AI-powered insights' 
              : 'Sign in to access your dashboard'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {/* 2FA Verification Form */}
        {requires2FA ? (
          <form onSubmit={handleVerify2FA} className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Authentication Code</label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-[#0B0F1A] border border-[#1a2332] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                maxLength={6}
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="w-full py-4 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 transition-all"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="w-full py-2 text-gray-500 hover:text-white text-sm transition"
            >
              ← Back to login
            </button>
          </form>
        ) : (
          /* Standard Login/Register Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0B0F1A] border border-[#1a2332] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition"
                  placeholder="John Doe"
                  required
                />
              </div>
            )}
            
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0B0F1A] border border-[#1a2332] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition"
                placeholder="you@example.com"
                required
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0B0F1A] border border-[#1a2332] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition"
                placeholder="••••••••"
                required
              />
              {isRegister && (
                <p className="text-xs text-gray-500 mt-1">
                  Min 8 chars with uppercase, lowercase, and number
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 transition-all"
            >
              {loading ? 'Loading...' : (isRegister ? 'Create Account' : 'Sign In')}
            </button>
          </form>
        )}

        {!requires2FA && (
          <p className="text-center text-gray-500 mt-6 text-sm">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button 
              onClick={() => setIsRegister(!isRegister)}
              className="text-blue-400 hover:text-blue-300 font-medium transition"
            >
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </p>
        )}
      </motion.div>
    </div>
  );
}

// Feature Card
function FeatureCard({ icon: Icon, title, description, gradient }: {
  icon: any;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.2 }}
      className="bg-[#0B0F1A] border border-[#1a2332] rounded-lg p-6 hover:border-blue-500/30 transition-all group"
    >
      <div className={`w-14 h-14 rounded-lg ${gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{description}</p>
    </motion.div>
  );
}

// Stat Card
function StatCard({ value, label, suffix }: { value: string; label: string; suffix?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <p className="text-4xl md:text-5xl font-bold text-white mb-2">
        {value}<span className="text-blue-400">{suffix}</span>
      </p>
      <p className="text-gray-400">{label}</p>
    </motion.div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');

  const handleAuthSuccess = () => {
    setShowAuth(false);
    router.push('/dashboard');
  };

  // Hide navbar on scroll down, show on scroll up
  useEffect(() => {
    let lastScrollY = 0;
    const navbar = document.getElementById('landing-navbar');
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (!navbar) return;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down & past threshold - hide navbar
        navbar.style.transform = 'translateY(-100%)';
      } else {
        // Scrolling up - show navbar
        navbar.style.transform = 'translateY(0)';
      }
      
      lastScrollY = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <main className="min-h-screen bg-[#06080F]">
      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuth} 
        onClose={() => setShowAuth(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authMode}
      />

      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Navbar */}
      <nav id="landing-navbar" className={`fixed top-0 left-0 right-0 z-50 bg-[#06080F]/90 backdrop-blur-xl border-b border-[#1a2332] transition-all duration-300 ${showAuth ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
              <LineChart className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white">FinX</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-400 hover:text-white transition">Features</a>
            <a href="#performance" className="text-gray-400 hover:text-white transition">Performance</a>
            <a href="#pricing" className="text-gray-400 hover:text-white transition">Pricing</a>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setAuthMode('signin'); setShowAuth(true); }}
              className="text-gray-400 hover:text-white transition font-medium"
            >
              Sign In
            </button>
            <button 
              onClick={() => { setAuthMode('register'); setShowAuth(true); }}
              className="px-5 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 transition-all"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Market Ticker - Below Navbar */}
      <MarketTicker className="fixed top-[73px] left-0 right-0 z-40" height={36} />


      {/* Hero Section */}
      <section className="relative pt-40 pb-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 rounded-full px-5 py-2 mb-8"
          >
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-sm text-blue-400 font-medium">Live Market Data — 15 Assets Tracked</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold mb-8 leading-tight text-white"
          >
            Master the Markets with
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600 bg-clip-text text-transparent">AI-Driven</span> Intelligence
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Deploy institutional-grade XGBoost models that analyze market data in real-time. 
            Achieve 47.5% returns with automated risk management and AI-powered insights.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button 
              onClick={() => setShowAuth(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2 text-lg"
            >
              Start Trading <ArrowRight className="w-5 h-5" />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 rounded-lg font-semibold text-white bg-[#0B0F1A] border border-[#1a2332] hover:border-blue-500/50 transition-all flex items-center justify-center gap-2 text-lg">
              <Activity className="w-5 h-5" />
              View Performance
            </button>
          </motion.div>
          
          {/* Trust badges */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-8 text-gray-400 text-sm"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span>Bank-level Security</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>5,000+ Active Traders</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>Real-time Market Data</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="performance" className="py-20 px-6 border-y border-[#1a2332]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            <StatCard value="353.2" suffix="%" label="Total Return" />
            <StatCard value="1.93" suffix="" label="Sharpe Ratio" />
            <StatCard value="25.8" suffix="%" label="Max Drawdown" />
            <StatCard value="47.5" suffix="%" label="Annual Return" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 bg-[#0B0F1A] border border-[#1a2332] rounded-full px-4 py-2 mb-6"
            >
              <Star className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-400">Institutional-Grade Tools</span>
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold mb-6 text-white"
            >
              Professional Trading Platform
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-gray-400 max-w-2xl mx-auto text-lg"
            >
              Advanced machine learning algorithms meet real-time market data. 
              Built for traders who demand precision and performance.
            </motion.p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={Brain}
              title="ML Predictions"
              description="XGBoost models with 353.2% total return analyze 15 assets, delivering actionable buy/sell signals with confidence scores."
              gradient="bg-gradient-to-br from-blue-600 to-indigo-700"
            />
            <FeatureCard 
              icon={Bot}
              title="Algorithmic Execution"
              description="Automated trading bot executes strategies 24/7 with real-time risk monitoring and position management."
              gradient="bg-gradient-to-br from-indigo-600 to-purple-700"
            />
            <FeatureCard 
              icon={Activity}
              title="Real-Time Analytics"
              description="Live market data, interactive charts, and technical indicators powered by Yahoo Finance integration."
              gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
            />
            <FeatureCard 
              icon={Shield}
              title="Smart Risk Controls"
              description="Dynamic position sizing, stop-loss automation, and portfolio rebalancing to protect your capital."
              gradient="bg-gradient-to-br from-slate-600 to-gray-700"
            />
            <FeatureCard 
              icon={BarChart3}
              title="Performance Dashboard"
              description="Track portfolio metrics, sharpe ratio, drawdown, and compare against benchmark indices like SPY."
              gradient="bg-gradient-to-br from-blue-600 to-indigo-600"
            />
            <FeatureCard 
              icon={Lock}
              title="Paper Trading Mode"
              description="Test strategies with $100k virtual capital. Full market simulation with zero risk."
              gradient="bg-gradient-to-br from-indigo-700 to-blue-800"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-[#0B0F1A] to-[#06080F] border border-[#1a2332] rounded-lg p-12 md:p-16 text-center relative overflow-hidden"
          >
            {/* Glow effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-blue-600/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
            
            <div className="relative">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center mx-auto mb-8">
                <LineChart className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">Start Trading Today</h2>
              <p className="text-gray-400 mb-10 max-w-lg mx-auto text-lg">
                Launch your account with $100,000 virtual capital. 
                No credit card. No risk. Just pure market intelligence.
              </p>
              <button 
                onClick={() => setShowAuth(true)}
                className="px-10 py-4 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 transition-all text-lg inline-flex items-center gap-2"
              >
                Create Free Account <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#1a2332]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                <LineChart className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-white">FinX</span>
            </div>
            <div className="flex items-center gap-8 text-gray-400">
              <a href="#" className="hover:text-white transition">Terms</a>
              <a href="#" className="hover:text-white transition">Privacy</a>
              <a href="#" className="hover:text-white transition">Documentation</a>
            </div>
            <p className="text-gray-500 text-sm">
              © 2025 FinX. Markets are unpredictable. Trade responsibly.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
