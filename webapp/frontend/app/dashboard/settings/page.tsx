'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Settings,
  Bell,
  Palette,
  Clock,
  Shield,
  Zap,
  Save,
  RefreshCw,
  Moon,
  Sun,
  Monitor,
  Volume2,
  VolumeX,
  ChevronRight,
  Smartphone,
  Lock,
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import { useTheme } from '@/components/theme';

interface SettingsState {
  theme: 'dark' | 'light' | 'system';
  refreshRate: number;
  notifications: {
    trades: boolean;
    priceAlerts: boolean;
    botStatus: boolean;
    sound: boolean;
  };
  trading: {
    confirmTrades: boolean;
    defaultInvestment: number;
    riskLevel: 'conservative' | 'moderate' | 'aggressive';
  };
}

const DEFAULT_SETTINGS: SettingsState = {
  theme: 'dark',
  refreshRate: 5000,
  notifications: {
    trades: true,
    priceAlerts: true,
    botStatus: true,
    sound: false,
  },
  trading: {
    confirmTrades: true,
    defaultInvestment: 100,
    riskLevel: 'moderate',
  },
};

export default function SettingsPage() {
  const { botStatus } = useDashboardStore();
  const { setTheme: applyTheme, theme: currentTheme } = useTheme();
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('app_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
      } catch {
        // Use defaults
      }
    }
  }, []);

  const saveSettings = () => {
    setIsSaving(true);
    localStorage.setItem('app_settings', JSON.stringify(settings));
    
    // Apply theme setting
    if (settings.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    } else {
      applyTheme(settings.theme);
    }
    
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 500);
  };

  const updateSettings = <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    
    // Apply theme immediately when changed
    if (key === 'theme') {
      const themeValue = value as 'dark' | 'light' | 'system';
      if (themeValue === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light');
      } else {
        applyTheme(themeValue);
      }
    }
  };

  const updateNestedSettings = <K extends keyof SettingsState>(
    key: K,
    nestedKey: keyof SettingsState[K],
    value: any
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] as object),
        [nestedKey]: value,
      },
    }));
  };

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
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Customize your trading experience</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-3 rounded font-medium transition ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-gray-600 hover:bg-gray-700 text-white'
          }`}
        >
          {isSaving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <>
              <Settings className="w-4 h-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Settings
            </>
          )}
        </button>
      </motion.div>

      {/* Security Section - Link to Security Page */}
      <motion.div variants={itemVariants}>
        <Link href="/dashboard/settings/security">
          <div className="bg-card border border-border rounded p-6 hover:border-purple-500/50 transition cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground group-hover:text-purple-400 transition">
                    Security & Privacy
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Two-factor authentication, sessions, login history
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 text-sm">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">2FA</span>
                  <Lock className="w-4 h-4 text-muted-foreground ml-2" />
                  <span className="text-muted-foreground">Sessions</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-purple-400 transition" />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Appearance */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-500/20 rounded flex items-center justify-center">
            <Palette className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
            <p className="text-muted text-sm">Customize how the app looks</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-muted-foreground text-sm mb-3 block">Theme</label>
            <div className="flex gap-3">
              {[
                { value: 'dark', icon: Moon, label: 'Dark' },
                { value: 'light', icon: Sun, label: 'Light' },
                { value: 'system', icon: Monitor, label: 'System' },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => updateSettings('theme', value as any)}
                  className={`flex-1 flex items-center justify-center gap-2 p-4 rounded border transition ${
                    settings.theme === value
                      ? 'bg-gray-500/20 border-gray-500 text-gray-300'
                      : 'bg-card-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Data & Refresh */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gray-500/20 rounded flex items-center justify-center">
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Data & Refresh</h2>
            <p className="text-muted text-sm">Control how often data updates</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-muted-foreground text-sm mb-3 block">
              Refresh Rate: {settings.refreshRate / 1000}s
            </label>
            <input
              type="range"
              min={1000}
              max={30000}
              step={1000}
              value={settings.refreshRate}
              onChange={(e) => updateSettings('refreshRate', parseInt(e.target.value))}
              className="w-full h-2 bg-card-secondary rounded appearance-none cursor-pointer accent-gray-500"
            />
            <div className="flex justify-between text-xs text-muted mt-2">
              <span>1s (Real-time)</span>
              <span>30s (Battery saver)</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-500/20 rounded flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
            <p className="text-muted text-sm">Choose what alerts you receive</p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { key: 'trades', label: 'Trade Executions', desc: 'Get notified when trades are executed' },
            { key: 'priceAlerts', label: 'Price Alerts', desc: 'Alerts for significant price movements' },
            { key: 'botStatus', label: 'Bot Status', desc: 'Updates when bot starts/stops' },
            { key: 'sound', label: 'Sound Effects', desc: 'Play sounds for notifications', icon: settings.notifications.sound ? Volume2 : VolumeX },
          ].map(({ key, label, desc, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between p-4 bg-card-secondary rounded">
              <div className="flex items-center gap-3">
                {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
                <div>
                  <p className="text-foreground font-medium">{label}</p>
                  <p className="text-muted text-sm">{desc}</p>
                </div>
              </div>
              <button
                onClick={() => updateNestedSettings('notifications', key as any, !settings.notifications[key as keyof typeof settings.notifications])}
                className={`w-12 h-6 rounded-full transition ${
                  settings.notifications[key as keyof typeof settings.notifications]
                    ? 'bg-emerald-500'
                    : 'bg-card'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition transform ${
                    settings.notifications[key as keyof typeof settings.notifications]
                      ? 'translate-x-6'
                      : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Trading */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-500/20 rounded flex items-center justify-center">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Trading Preferences</h2>
            <p className="text-muted text-sm">Configure your trading behavior</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-card-secondary rounded">
            <div>
              <p className="text-foreground font-medium">Confirm Trades</p>
              <p className="text-muted text-sm">Show confirmation before executing trades</p>
            </div>
            <button
              onClick={() => updateNestedSettings('trading', 'confirmTrades', !settings.trading.confirmTrades)}
              className={`w-12 h-6 rounded-full transition ${
                settings.trading.confirmTrades ? 'bg-emerald-500' : 'bg-card'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition transform ${
                  settings.trading.confirmTrades ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="p-4 bg-card-secondary rounded">
            <label className="text-foreground font-medium block mb-2">Default Investment Amount</label>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">$</span>
              <input
                type="number"
                min={5}
                max={10000}
                value={settings.trading.defaultInvestment}
                onChange={(e) => updateNestedSettings('trading', 'defaultInvestment', parseInt(e.target.value) || 100)}
                className="flex-1 bg-card border border-border rounded px-4 py-2 text-foreground focus:outline-none focus:border-muted-foreground"
              />
            </div>
          </div>

          <div className="p-4 bg-card-secondary rounded">
            <label className="text-foreground font-medium block mb-3">Risk Level</label>
            <div className="flex gap-3">
              {[
                { value: 'conservative', label: 'Conservative', color: 'emerald' },
                { value: 'moderate', label: 'Moderate', color: 'gray' },
                { value: 'aggressive', label: 'Aggressive', color: 'red' },
              ].map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() => updateNestedSettings('trading', 'riskLevel', value as any)}
                  className={`flex-1 p-3 rounded border transition ${
                    settings.trading.riskLevel === value
                      ? `bg-${color}-500/20 border-${color}-500 text-${color}-400`
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                  style={{
                    backgroundColor: settings.trading.riskLevel === value 
                      ? color === 'emerald' ? 'rgba(16, 185, 129, 0.2)' 
                      : color === 'gray' ? 'rgba(107, 114, 128, 0.2)'
                      : 'rgba(239, 68, 68, 0.2)'
                      : undefined,
                    borderColor: settings.trading.riskLevel === value
                      ? color === 'emerald' ? '#10B981'
                      : color === 'gray' ? '#6B7280'
                      : '#EF4444'
                      : undefined,
                    color: settings.trading.riskLevel === value
                      ? color === 'emerald' ? '#34D399'
                      : color === 'gray' ? '#9CA3AF'
                      : '#F87171'
                      : undefined,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Account Status */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-cyan-500/20 rounded flex items-center justify-center">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Account Status</h2>
            <p className="text-muted text-sm">Your connection and account info</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-card-secondary rounded">
            <p className="text-muted-foreground text-sm">Alpaca Connection</p>
            <p className={`text-lg font-semibold ${botStatus?.alpaca_connected ? 'text-emerald-400' : 'text-red-400'}`}>
              {botStatus?.alpaca_connected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          <div className="p-4 bg-card-secondary rounded">
            <p className="text-muted-foreground text-sm">Account Type</p>
            <p className="text-lg font-semibold text-amber-400">Paper Trading</p>
          </div>
          <div className="p-4 bg-card-secondary rounded">
            <p className="text-muted-foreground text-sm">Bot Status</p>
            <p className={`text-lg font-semibold ${botStatus?.running ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {botStatus?.running ? 'Running' : 'Stopped'}
            </p>
          </div>
          <div className="p-4 bg-card-secondary rounded">
            <p className="text-muted-foreground text-sm">Strategy</p>
            <p className="text-lg font-semibold text-foreground">{botStatus?.strategy || 'XGBoost'}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
