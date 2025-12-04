'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Auth Modal Component
function AuthModal({ isOpen, onClose, onSuccess }: { 
  isOpen: boolean; 
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

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

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Authentication failed');
      }

      const data = await res.json();
      
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
      <div className="bg-[#12121A] border border-[#1E1E24] rounded p-8 w-full max-w-md relative animate-fade-in">
        <button 
          onClick={() => { onClose(); resetForm(); }} 
          className="absolute top-4 right-4 text-gray-500 hover:text-white text-2xl transition"
        >
          ×
        </button>
        
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
            {requires2FA ? <Shield className="w-7 h-7 text-white" /> : <Zap className="w-7 h-7 text-white" />}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {requires2FA ? 'Two-Factor Authentication' : isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-gray-500">
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
                className="w-full bg-[#1E1E24] border border-[#2A2A35] rounded px-4 py-3 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                maxLength={6}
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="w-full py-4 rounded font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/25"
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
                  className="w-full bg-[#1E1E24] border border-[#2A2A35] rounded px-4 py-3 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition"
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
                className="w-full bg-[#1E1E24] border border-[#2A2A35] rounded px-4 py-3 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition"
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
                className="w-full bg-[#1E1E24] border border-[#2A2A35] rounded px-4 py-3 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition"
                placeholder="••••••••"
                required
              />
              {isRegister && (
                <p className="text-xs text-gray-600 mt-1">
                  Min 8 chars with uppercase, lowercase, and number
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/25"
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
              className="text-emerald-400 hover:text-emerald-300 font-medium transition"
            >
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </p>
        )}
      </div>
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
    <div className="bg-[#12121A] border border-[#1E1E24] rounded p-6 hover:border-[#2A2A35] transition-all group">
      <div className={`w-14 h-14 rounded ${gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

// Stat Card
function StatCard({ value, label, suffix }: { value: string; label: string; suffix?: string }) {
  return (
    <div className="text-center">
      <p className="text-4xl md:text-5xl font-bold text-white mb-2">
        {value}<span className="text-emerald-400">{suffix}</span>
      </p>
      <p className="text-gray-500">{label}</p>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);

  const handleAuthSuccess = () => {
    setShowAuth(false);
    router.push('/dashboard');
  };

  return (
    <main className="min-h-screen bg-[#08080C]">
      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuth} 
        onClose={() => setShowAuth(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-[#08080C]/80 backdrop-blur-xl border-b border-[#1E1E24]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white">SmartInvest</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-400 hover:text-white transition">Features</a>
            <a href="#performance" className="text-gray-400 hover:text-white transition">Performance</a>
            <a href="#pricing" className="text-gray-400 hover:text-white transition">Pricing</a>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowAuth(true)}
              className="text-gray-400 hover:text-white transition font-medium"
            >
              Sign In
            </button>
            <button 
              onClick={() => setShowAuth(true)}
              className="px-5 py-2.5 rounded font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-5 py-2 mb-8">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-sm text-emerald-400 font-medium">AI Models Active — Trading 15 Assets</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight text-white">
            Trade Smarter with
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">AI-Powered</span> Insights
          </h1>
          
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Let machine learning analyze the market for you. Our XGBoost models 
            deliver 47.5% annual returns with institutional-grade risk management.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => setShowAuth(true)}
              className="w-full sm:w-auto px-8 py-4 rounded font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 text-lg"
            >
              Start Trading <ArrowRight className="w-5 h-5" />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 rounded font-semibold text-white bg-[#12121A] border border-[#1E1E24] hover:border-[#2A2A35] transition-all flex items-center justify-center gap-2 text-lg">
              <BarChart3 className="w-5 h-5" />
              View Performance
            </button>
          </div>
          
          {/* Trust badges */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Bank-level Security</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>5,000+ Active Traders</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span>Alpaca Markets Integration</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="performance" className="py-20 px-6 border-y border-[#1E1E24]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            <StatCard value="47.5" suffix="%" label="Annual Return" />
            <StatCard value="1.93" suffix="x" label="Sharpe Ratio" />
            <StatCard value="75.2" suffix="%" label="Win Rate" />
            <StatCard value="15" suffix="+" label="Assets Tracked" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[#12121A] border border-[#1E1E24] rounded-full px-4 py-2 mb-6">
              <Star className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-gray-400">Powerful Features</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Everything You Need to Trade
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Professional-grade tools powered by machine learning, designed for both 
              beginners and experienced traders.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={Brain}
              title="AI Recommendations"
              description="XGBoost models analyze 15 assets daily, providing buy/sell signals with predicted returns."
              gradient="bg-gradient-to-br from-violet-500 to-purple-600"
            />
            <FeatureCard 
              icon={Bot}
              title="Automated Trading"
              description="Set it and forget it. Our bot executes trades automatically based on AI signals."
              gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
            />
            <FeatureCard 
              icon={BarChart3}
              title="Live Charts"
              description="Real-time price charts with technical indicators for all tracked assets."
              gradient="bg-gradient-to-br from-gray-500 to-slate-600"
            />
            <FeatureCard 
              icon={Shield}
              title="Risk Management"
              description="Built-in position limits, drawdown protection, and portfolio diversification."
              gradient="bg-gradient-to-br from-orange-500 to-amber-600"
            />
            <FeatureCard 
              icon={TrendingUp}
              title="Portfolio Tracking"
              description="Monitor your holdings, P&L, and trade history in one dashboard."
              gradient="bg-gradient-to-br from-pink-500 to-rose-600"
            />
            <FeatureCard 
              icon={Lock}
              title="Paper Trading"
              description="Practice with $100k virtual money before going live. No risk, real learning."
              gradient="bg-gradient-to-br from-gray-500 to-slate-600"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-[#12121A] to-[#0B0B0F] border border-[#1E1E24] rounded p-12 md:p-16 text-center relative overflow-hidden">
            {/* Glow effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-emerald-500/20 rounded-full blur-3xl" />
            
            <div className="relative">
              <div className="w-16 h-16 rounded bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto mb-8">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">Ready to Start?</h2>
              <p className="text-gray-400 mb-10 max-w-lg mx-auto text-lg">
                Create a free account and get $100,000 in virtual funds to practice. 
                No credit card required.
              </p>
              <button 
                onClick={() => setShowAuth(true)}
                className="px-10 py-4 rounded font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25 text-lg inline-flex items-center gap-2"
              >
                Create Free Account <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#1E1E24]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-white">SmartInvest AI</span>
            </div>
            <div className="flex items-center gap-8 text-gray-500">
              <a href="#" className="hover:text-white transition">Terms</a>
              <a href="#" className="hover:text-white transition">Privacy</a>
              <a href="#" className="hover:text-white transition">Contact</a>
            </div>
            <p className="text-gray-600 text-sm">
              © 2024 SmartInvest. For educational purposes only.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
