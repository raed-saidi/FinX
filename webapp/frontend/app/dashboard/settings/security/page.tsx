'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Smartphone,
  Key,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  Copy,
  AlertTriangle,
  Clock,
  Globe,
  RefreshCw,
  Loader2,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Session {
  device: string;
  ip: string;
  created_at: string;
  last_active: string;
}

interface LoginHistory {
  timestamp: string;
  ip: string;
  success: boolean;
}

export default function SecuritySettingsPage() {
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [password, setPassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [showDisable, setShowDisable] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    fetch2FAStatus();
    fetchSessions();
    fetchLoginHistory();
  }, []);

  const getToken = () => localStorage.getItem('token');

  const fetch2FAStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/2fa/status`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setIs2FAEnabled(data.two_factor_enabled);
    } catch (err) {
      console.error('Failed to fetch 2FA status');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/sessions`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions');
    }
  };

  const fetchLoginHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login-history`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setLoginHistory(data.history || []);
    } catch (err) {
      console.error('Failed to fetch login history');
    }
  };

  const handleSetup2FA = async () => {
    setError('');
    if (!password) {
      setError('Please enter your password');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/2fa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to setup 2FA');
      }

      const data = await res.json();
      setQrUri(data.qr_uri);
      setSecret(data.secret);
      setSetupMode(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEnable2FA = async () => {
    setError('');
    if (!verifyCode || verifyCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/2fa/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ code: verifyCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to enable 2FA');
      }

      const data = await res.json();
      setBackupCodes(data.backup_codes);
      setShowBackupCodes(true);
      setIs2FAEnabled(true);
      setSetupMode(false);
      setSuccess('2FA enabled successfully!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDisable2FA = async () => {
    setError('');
    if (!password || !disableCode) {
      setError('Please enter both password and 2FA code');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/2fa/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ password, code: disableCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to disable 2FA');
      }

      setIs2FAEnabled(false);
      setShowDisable(false);
      setPassword('');
      setDisableCode('');
      setSuccess('2FA disabled successfully');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setSuccess('Backup codes copied to clipboard');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-4xl mx-auto"
      style={{ paddingTop: '40px' }}
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Shield className="w-7 h-7 text-purple-400" />
          Security Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your account security and two-factor authentication
        </p>
      </motion.div>

      {/* Alerts */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2"
        >
          <AlertTriangle className="w-5 h-5" />
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 flex items-center gap-2"
        >
          <Check className="w-5 h-5" />
          {success}
        </motion.div>
      )}

      {/* 2FA Section */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded-lg p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Two-Factor Authentication</h3>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            is2FAEnabled 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {is2FAEnabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>

        {/* Backup Codes Display */}
        {showBackupCodes && backupCodes.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-400">Save Your Backup Codes</h4>
                <p className="text-sm text-yellow-400/70">
                  Store these codes safely. You'll need them if you lose access to your authenticator.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              {backupCodes.map((code, i) => (
                <div key={i} className="bg-card border border-border rounded px-3 py-2 text-center font-mono text-foreground">
                  {code}
                </div>
              ))}
            </div>
            <button
              onClick={copyBackupCodes}
              className="flex items-center gap-2 text-sm text-yellow-400 hover:text-yellow-300"
            >
              <Copy className="w-4 h-4" />
              Copy all codes
            </button>
          </div>
        )}

        {/* Setup Flow */}
        {!is2FAEnabled && !setupMode && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use an authenticator app like Google Authenticator, Authy, or 1Password to generate codes.
            </p>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Enter your password to continue</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full md:w-80 bg-card-secondary border border-border rounded px-4 py-2 text-foreground"
                placeholder="Your password"
              />
            </div>
            <button
              onClick={handleSetup2FA}
              className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition"
            >
              Set Up 2FA
            </button>
          </div>
        )}

        {/* QR Code & Verify */}
        {setupMode && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* QR Code */}
              <div className="flex-shrink-0">
                <p className="text-sm text-muted-foreground mb-2">1. Scan this QR code:</p>
                <div className="bg-white p-4 rounded-lg inline-block">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUri)}`}
                    alt="2FA QR Code"
                    className="w-44 h-44"
                  />
                </div>
              </div>

              {/* Manual Entry */}
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">Or enter this code manually:</p>
                <div className="flex items-center gap-2 mb-4">
                  <code className="bg-card-secondary border border-border rounded px-3 py-2 text-foreground font-mono text-sm break-all">
                    {secret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="p-2 hover:bg-card-secondary rounded transition"
                  >
                    {copiedSecret ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>

                <p className="text-sm text-muted-foreground mb-2">2. Enter the 6-digit code from your app:</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-32 bg-card-secondary border border-border rounded px-4 py-2 text-foreground text-center font-mono text-lg tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                  />
                  <button
                    onClick={handleEnable2FA}
                    disabled={verifyCode.length !== 6}
                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg transition"
                  >
                    Verify & Enable
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setSetupMode(false);
                setPassword('');
                setVerifyCode('');
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Disable 2FA */}
        {is2FAEnabled && !showDisable && (
          <button
            onClick={() => setShowDisable(true)}
            className="text-sm text-red-400 hover:text-red-300"
          >
            Disable Two-Factor Authentication
          </button>
        )}

        {showDisable && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-4">
            <p className="text-sm text-red-400">
              Disabling 2FA will make your account less secure. You'll need your password and current 2FA code.
            </p>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full md:w-48 bg-card-secondary border border-border rounded px-4 py-2 text-foreground"
                placeholder="Password"
              />
              <input
                type="text"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full md:w-32 bg-card-secondary border border-border rounded px-4 py-2 text-foreground text-center font-mono"
                placeholder="2FA Code"
                maxLength={6}
              />
              <button
                onClick={handleDisable2FA}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
              >
                Disable 2FA
              </button>
              <button
                onClick={() => {
                  setShowDisable(false);
                  setPassword('');
                  setDisableCode('');
                }}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Active Sessions */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded-lg p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Active Sessions</h3>
              <p className="text-sm text-muted-foreground">
                Devices currently logged into your account
              </p>
            </div>
          </div>
          <button
            onClick={fetchSessions}
            className="p-2 hover:bg-card-secondary rounded transition"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-3">
          {sessions.length > 0 ? (
            sessions.map((session, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-card-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-card flex items-center justify-center">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{session.device?.slice(0, 40) || 'Unknown device'}...</p>
                    <p className="text-xs text-muted-foreground">IP: {session.ip}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Last active: {new Date(session.last_active).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No active sessions</p>
          )}
        </div>
      </motion.div>

      {/* Login History */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded-lg p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Recent Login History</h3>
            <p className="text-sm text-muted-foreground">
              Last 10 login attempts to your account
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {loginHistory.length > 0 ? (
            loginHistory.slice().reverse().map((entry, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-card-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  {entry.success ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <X className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-sm text-foreground">
                    {entry.success ? 'Successful login' : 'Failed attempt'}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">IP: {entry.ip}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No login history</p>
          )}
        </div>
      </motion.div>

      {/* Security Tips */}
      <motion.div
        variants={itemVariants}
        className="bg-card border border-border rounded-lg p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-emerald-400" />
          Security Tips
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            Use a strong, unique password with uppercase, lowercase, numbers, and symbols
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            Enable two-factor authentication for maximum account protection
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            Never share your password or 2FA codes with anyone
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            Review your login history regularly for suspicious activity
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            Store backup codes in a secure location (password manager, safe)
          </li>
        </ul>
      </motion.div>
    </motion.div>
  );
}
