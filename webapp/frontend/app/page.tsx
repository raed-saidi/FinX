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
  Lock
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister ? { email, password, name } : { email, password };

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
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="card p-8 w-full max-w-md relative animate-fade-in">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-500 hover:text-white text-2xl"
        >
          ×
        </button>
        
        <h2 className="text-2xl font-bold mb-2">
          {isRegister ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p className="text-gray-500 mb-6">
          {isRegister ? 'Start trading with AI' : 'Sign in to continue'}
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Full name"
              required
            />
          )}
          
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="Email address"
            required
          />
          
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="Password"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Loading...' : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <p className="text-center text-gray-500 mt-6 text-sm">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-white hover:underline"
          >
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );
}

// Feature Card
function FeatureCard({ icon: Icon, title, description }: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="card card-hover p-6">
      <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// Stat Card
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-4xl font-bold mb-1">{value}</p>
      <p className="text-gray-500 text-sm">{label}</p>
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
    <main className="min-h-screen">
      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuth} 
        onClose={() => setShowAuth(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6" />
            <span className="font-semibold text-lg">SmartInvest</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowAuth(true)}
              className="text-gray-400 hover:text-white transition text-sm"
            >
              Sign In
            </button>
            <button 
              onClick={() => setShowAuth(true)}
              className="btn-primary text-sm"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-400">AI Models Active</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Trade Smarter with
            <br />
            <span className="gradient-text">AI-Powered</span> Insights
          </h1>
          
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Let machine learning analyze the market for you. Our XGBoost models 
            deliver 47.5% annual returns with institutional-grade risk management.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => setShowAuth(true)}
              className="btn-primary flex items-center gap-2 text-lg px-8 py-3"
            >
              Start Trading <ArrowRight className="w-5 h-5" />
            </button>
            <button className="btn-secondary flex items-center gap-2 text-lg px-8 py-3">
              View Performance
            </button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 border-y border-white/5">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCard value="47.5%" label="Annual Return" />
          <StatCard value="1.93" label="Sharpe Ratio" />
          <StatCard value="75.2%" label="Win Rate" />
          <StatCard value="15" label="Assets Tracked" />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Trade
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Professional-grade tools powered by machine learning, designed for both 
              beginners and experienced traders.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={Brain}
              title="AI Recommendations"
              description="XGBoost models analyze 15 assets daily, providing buy/sell signals with predicted returns."
            />
            <FeatureCard 
              icon={Bot}
              title="Automated Trading"
              description="Set it and forget it. Our bot executes trades automatically based on AI signals."
            />
            <FeatureCard 
              icon={BarChart3}
              title="Live Charts"
              description="Real-time price charts with technical indicators for all tracked assets."
            />
            <FeatureCard 
              icon={Shield}
              title="Risk Management"
              description="Built-in position limits, drawdown protection, and portfolio diversification."
            />
            <FeatureCard 
              icon={TrendingUp}
              title="Portfolio Tracking"
              description="Monitor your holdings, P&L, and trade history in one dashboard."
            />
            <FeatureCard 
              icon={Lock}
              title="Paper Trading"
              description="Practice with $100k virtual money before going live. No risk, real learning."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="card p-12">
            <h2 className="text-3xl font-bold mb-4">Ready to Start?</h2>
            <p className="text-gray-500 mb-8 max-w-lg mx-auto">
              Create a free account and get $100,000 in virtual funds to practice. 
              No credit card required.
            </p>
            <button 
              onClick={() => setShowAuth(true)}
              className="btn-primary text-lg px-10 py-4"
            >
              Create Free Account
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            <span className="font-semibold">SmartInvest AI</span>
          </div>
          <p className="text-gray-600 text-sm">
            © 2024 SmartInvest. For educational purposes only. Not financial advice.
          </p>
        </div>
      </footer>
    </main>
  );
}
