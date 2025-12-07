'use client';

import { motion } from 'framer-motion';
import {
  HelpCircle,
  Bot,
  DollarSign,
  TrendingUp,
  Shield,
  Zap,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Book,
  Mail,
} from 'lucide-react';
import Link from 'next/link';

const faqs = [
  {
    question: "How does the AI trading bot work?",
    answer: "Our AI uses XGBoost machine learning models trained on historical market data to generate trading signals. The walk-forward validation ensures the model's predictions are reliable for real trading scenarios."
  },
  {
    question: "Is my money safe?",
    answer: "We use Alpaca's Paper Trading account for demonstration. No real money is at risk. For live trading, funds are held and protected by Alpaca Markets, an SEC-registered broker-dealer."
  },
  {
    question: "What is Smart Invest?",
    answer: "Smart Invest automatically allocates your investment across multiple stocks based on AI recommendations. It diversifies your portfolio according to signal strength and market conditions."
  },
  {
    question: "How often are signals updated?",
    answer: "AI signals are generated daily based on the latest market data. The dashboard updates every 3 seconds to show real-time prices and portfolio values."
  },
  {
    question: "What do LONG/SHORT/HOLD signals mean?",
    answer: "LONG means the AI predicts the stock will go up (buy signal). SHORT means it expects the price to drop. HOLD suggests waiting for a clearer opportunity."
  },
  {
    question: "How is the signal strength calculated?",
    answer: "Signal strength is the AI's confidence level expressed as a percentage. Higher values indicate stronger conviction in the prediction direction."
  },
];

const features = [
  { icon: Bot, title: 'AI Trading Bot', description: 'Automated trading based on ML models', color: 'gray' },
  { icon: TrendingUp, title: 'Real-Time Data', description: 'Live market prices updated every 3s', color: 'emerald' },
  { icon: DollarSign, title: 'Smart Invest', description: 'AI-optimized portfolio allocation', color: 'purple' },
  { icon: Shield, title: 'Paper Trading', description: 'Risk-free demo environment', color: 'amber' },
];

export default function HelpPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-4xl"
      style={{ paddingTop: '40px' }}
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-foreground">Help Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Learn how to use the AI trading platform</p>
      </motion.div>

      {/* Quick Links */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="bg-card border border-border rounded p-5 hover:border-neutral-500/30 transition"
          >
            <div
              className={`w-12 h-12 rounded mb-4 flex items-center justify-center ${
                feature.color === 'gray' ? 'bg-gray-500/20' :
                feature.color === 'emerald' ? 'bg-emerald-500/20' :
                feature.color === 'purple' ? 'bg-purple-500/20' :
                'bg-amber-500/20'
              }`}
            >
              <feature.icon
                className={`w-6 h-6 ${
                  feature.color === 'gray' ? 'text-gray-400' :
                  feature.color === 'emerald' ? 'text-emerald-400' :
                  feature.color === 'purple' ? 'text-purple-400' :
                  'text-amber-400'
                }`}
              />
            </div>
            <h3 className="text-foreground font-semibold mb-1">{feature.title}</h3>
            <p className="text-muted text-sm">{feature.description}</p>
          </div>
        ))}
      </motion.div>

      {/* FAQs */}
      <motion.div variants={itemVariants} className="bg-card border border-border rounded overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-500/20 rounded flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Frequently Asked Questions</h2>
              <p className="text-muted text-sm">Common questions about the platform</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-border">
          {faqs.map((faq, index) => (
            <details key={index} className="group">
              <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-card-secondary/50 transition">
                <span className="text-foreground font-medium">{faq.question}</span>
                <ChevronRight className="w-5 h-5 text-muted group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-6 pb-6 text-muted-foreground">{faq.answer}</div>
            </details>
          ))}
        </div>
      </motion.div>

      {/* Getting Started */}
      <motion.div variants={itemVariants} className="bg-card border border-border rounded p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-500/20 rounded flex items-center justify-center">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Getting Started</h2>
            <p className="text-muted text-sm">Quick guide to start trading</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-card-secondary rounded">
            <div className="w-8 h-8 bg-neutral-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              1
            </div>
            <div>
              <h4 className="text-foreground font-medium">Check AI Recommendations</h4>
              <p className="text-muted-foreground text-sm">View the AI-generated signals on the Dashboard. LONG signals indicate potential buying opportunities.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-card-secondary rounded">
            <div className="w-8 h-8 bg-neutral-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              2
            </div>
            <div>
              <h4 className="text-foreground font-medium">Use Smart Invest</h4>
              <p className="text-muted-foreground text-sm">Click "Smart Invest" to automatically allocate funds across recommended stocks based on AI signals.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-card-secondary rounded">
            <div className="w-8 h-8 bg-neutral-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              3
            </div>
            <div>
              <h4 className="text-foreground font-medium">Start the Trading Bot</h4>
              <p className="text-muted-foreground text-sm">Enable the AI bot from the Trading Bot page to automate trades based on real-time signals.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-card-secondary rounded">
            <div className="w-8 h-8 bg-neutral-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              4
            </div>
            <div>
              <h4 className="text-foreground font-medium">Monitor Performance</h4>
              <p className="text-muted-foreground text-sm">Track your portfolio's performance, view order history, and analyze equity curves on the Dashboard.</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Contact */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href="#"
          className="flex items-center gap-4 p-5 bg-card border border-border rounded hover:border-neutral-500/30 transition"
        >
          <div className="w-12 h-12 bg-neutral-500/20 rounded flex items-center justify-center">
            <Book className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h4 className="text-foreground font-medium">Documentation</h4>
            <p className="text-muted text-sm">Read the full guide</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted ml-auto" />
        </a>

        <a
          href="#"
          className="flex items-center gap-4 p-5 bg-card border border-border rounded hover:border-neutral-500/30 transition"
        >
          <div className="w-12 h-12 bg-purple-500/20 rounded flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h4 className="text-foreground font-medium">Chat Support</h4>
            <p className="text-muted text-sm">Ask the AI assistant</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted ml-auto" />
        </a>

        <a
          href="#"
          className="flex items-center gap-4 p-5 bg-card border border-border rounded hover:border-neutral-500/30 transition"
        >
          <div className="w-12 h-12 bg-emerald-500/20 rounded flex items-center justify-center">
            <Mail className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-foreground font-medium">Contact Us</h4>
            <p className="text-muted text-sm">Get in touch</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted ml-auto" />
        </a>
      </motion.div>
    </motion.div>
  );
}
