'use client';

import { useState, useEffect } from 'react';

export interface AppSettings {
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

const DEFAULT_SETTINGS: AppSettings = {
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

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('app_settings');
    if (savedSettings) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      } catch {
        // Use defaults
      }
    }
    setLoaded(true);
  }, []);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('app_settings', JSON.stringify(updated));
  };

  const updateNestedSettings = <K extends keyof AppSettings>(
    key: K,
    nestedKey: keyof AppSettings[K],
    value: any
  ) => {
    const updated = {
      ...settings,
      [key]: {
        ...(settings[key] as object),
        [nestedKey]: value,
      },
    };
    setSettings(updated);
    localStorage.setItem('app_settings', JSON.stringify(updated));
  };

  return {
    settings,
    loaded,
    updateSettings,
    updateNestedSettings,
    // Convenience getters
    refreshRate: settings.refreshRate,
    confirmTrades: settings.trading.confirmTrades,
    defaultInvestment: settings.trading.defaultInvestment,
    riskLevel: settings.trading.riskLevel,
    notificationsEnabled: settings.notifications,
  };
}

export default useAppSettings;
