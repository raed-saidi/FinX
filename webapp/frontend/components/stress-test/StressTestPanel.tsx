'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  TrendingDown,
  Activity,
  BarChart3,
  Shield,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { StressTestResult, StressScenario } from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface RiskGaugeProps {
  score: number;
  level: string;
}

function RiskGauge({ score, level }: RiskGaugeProps) {
  const getColor = () => {
    if (score < 30) return 'text-green-400';
    if (score < 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBgColor = () => {
    if (score < 30) return 'bg-green-500/20';
    if (score < 60) return 'bg-yellow-500/20';
    return 'bg-red-500/20';
  };

  return (
    <div className="flex flex-col items-center p-6 rounded-xl bg-card border border-border">
      <div className="text-sm text-muted-foreground mb-2">Overall Risk Score</div>
      <div className={`text-5xl font-bold ${getColor()}`}>{score.toFixed(0)}</div>
      <div className="text-sm text-muted-foreground">/100</div>
      <div className={`mt-3 px-4 py-1 rounded-full text-sm font-medium ${getBgColor()} ${getColor()}`}>
        {level} RISK
      </div>
      <div className="w-full mt-4 h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full ${score < 30 ? 'bg-green-500' : score < 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
        />
      </div>
    </div>
  );
}

interface VaRCardProps {
  title: string;
  var_pct: number;
  cvar_pct: number;
  portfolioValue: number;
}

function VaRCard({ title, var_pct, cvar_pct, portfolioValue }: VaRCardProps) {
  const varDollars = (var_pct / 100) * portfolioValue;
  const cvarDollars = (cvar_pct / 100) * portfolioValue;

  return (
    <div className="p-4 rounded-lg bg-card-secondary border border-border">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{title}</div>
      <div className="flex justify-between items-end">
        <div>
          <div className="text-lg font-semibold text-foreground">{var_pct.toFixed(2)}%</div>
          <div className="text-xs text-muted-foreground">${varDollars.toFixed(0)} at risk</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-red-400">{cvar_pct.toFixed(2)}%</div>
          <div className="text-xs text-muted-foreground">CVaR/ES</div>
        </div>
      </div>
    </div>
  );
}

interface ScenarioTableProps {
  scenarios: StressScenario[];
  title: string;
}

function ScenarioTable({ scenarios, title }: ScenarioTableProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayScenarios = isExpanded ? scenarios : scenarios.slice(0, 4);

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex justify-between items-center">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-card-secondary">
            <tr>
              <th className="px-4 py-2 text-left text-muted-foreground font-medium">Scenario</th>
              <th className="px-4 py-2 text-right text-muted-foreground font-medium">Impact</th>
              <th className="px-4 py-2 text-right text-muted-foreground font-medium">Loss</th>
            </tr>
          </thead>
          <tbody>
            {displayScenarios.map((scenario, idx) => (
              <tr key={idx} className="border-t border-border hover:bg-card-secondary/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{scenario.Scenario}</div>
                  <div className="text-xs text-muted-foreground">{scenario.Description}</div>
                </td>
                <td className={`px-4 py-3 text-right font-medium ${
                  scenario['Portfolio Return (%)'] < -20 ? 'text-red-400' :
                  scenario['Portfolio Return (%)'] < -10 ? 'text-orange-400' :
                  scenario['Portfolio Return (%)'] < 0 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {scenario['Portfolio Return (%)'].toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  ${Math.abs(scenario['Loss ($)']).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {scenarios.length > 4 && (
        <div className="p-2 text-center border-t border-border">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {isExpanded ? 'Show Less' : `Show ${scenarios.length - 4} More`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function StressTestPanel() {
  const [stressTest, setStressTest] = useState<StressTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portfolioValue, setPortfolioValue] = useState(100000);

  const fetchStressTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/stress-test`);
      if (!res.ok) {
        throw new Error('Failed to fetch stress test data');
      }
      const data = await res.json();
      setStressTest(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStressTest();
  }, []);

  if (loading && !stressTest) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-muted-foreground">Running stress tests...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <span>Error: {error}</span>
        </div>
        <button
          onClick={fetchStressTest}
          className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stressTest) return null;

  const var95 = stressTest.var['95pct']?.historical;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Shield className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Stress Testing & Risk Assessment</h2>
            <p className="text-sm text-muted-foreground">VaR, Monte Carlo, Scenario Analysis</p>
          </div>
        </div>
        <button
          onClick={fetchStressTest}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-400 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Risk Score and VaR Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RiskGauge score={stressTest.risk_score} level={stressTest.risk_level} />
        
        <div className="md:col-span-2 grid grid-cols-3 gap-3">
          {var95 && (
            <>
              <VaRCard
                title="1-Day VaR (90%)"
                var_pct={stressTest.var['90pct']?.historical?.var_pct || 0}
                cvar_pct={stressTest.var['90pct']?.historical?.cvar_pct || 0}
                portfolioValue={portfolioValue}
              />
              <VaRCard
                title="1-Day VaR (95%)"
                var_pct={var95.var_pct}
                cvar_pct={var95.cvar_pct}
                portfolioValue={portfolioValue}
              />
              <VaRCard
                title="1-Day VaR (99%)"
                var_pct={stressTest.var['99pct']?.historical?.var_pct || 0}
                cvar_pct={stressTest.var['99pct']?.historical?.cvar_pct || 0}
                portfolioValue={portfolioValue}
              />
            </>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <TrendingDown className="w-4 h-4" />
            Worst Case
          </div>
          <div className="text-2xl font-bold text-red-400">
            {stressTest.scenarios.summary.worst_case.toFixed(1)}%
          </div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Activity className="w-4 h-4" />
            Avg Stress Loss
          </div>
          <div className="text-2xl font-bold text-orange-400">
            {stressTest.scenarios.summary.average_loss.toFixed(1)}%
          </div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <BarChart3 className="w-4 h-4" />
            Annualized Vol
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {(stressTest.tail_risk.annualized_volatility * 100).toFixed(1)}%
          </div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Zap className="w-4 h-4" />
            Scenarios Tested
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {stressTest.scenarios.summary.scenarios_tested}
          </div>
        </div>
      </div>

      {/* Tail Risk Info */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-blue-400" />
          <span className="font-medium text-foreground">Tail Risk Characteristics</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Skewness</div>
            <div className={`font-medium ${stressTest.tail_risk.is_negatively_skewed ? 'text-red-400' : 'text-green-400'}`}>
              {stressTest.tail_risk.skewness.toFixed(3)}
              <span className="text-xs text-muted-foreground ml-1">
                ({stressTest.tail_risk.is_negatively_skewed ? 'Downside Risk' : 'Normal'})
              </span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Kurtosis</div>
            <div className={`font-medium ${stressTest.tail_risk.is_fat_tailed ? 'text-yellow-400' : 'text-green-400'}`}>
              {stressTest.tail_risk.excess_kurtosis.toFixed(3)}
              <span className="text-xs text-muted-foreground ml-1">
                ({stressTest.tail_risk.is_fat_tailed ? 'Fat Tails' : 'Normal'})
              </span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Left Tail (1%)</div>
            <div className="font-medium text-red-400">
              {(stressTest.tail_risk.left_tail_1pct * 100).toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Right Tail (99%)</div>
            <div className="font-medium text-green-400">
              {(stressTest.tail_risk.right_tail_99pct * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Scenario Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ScenarioTable
          title="📅 Historical Stress Scenarios"
          scenarios={stressTest.scenarios.historical}
        />
        <ScenarioTable
          title="🔮 Hypothetical Stress Scenarios"
          scenarios={stressTest.scenarios.hypothetical}
        />
      </div>

      {/* Disclaimer */}
      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400/80">
        <strong>Disclaimer:</strong> Stress test results are based on historical data and statistical models. 
        Actual losses may exceed modeled estimates. Past performance does not guarantee future results.
      </div>
    </div>
  );
}
