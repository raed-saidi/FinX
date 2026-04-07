"""
Stress Testing Module - Comprehensive risk analysis and stress testing.

Implements:
- Value at Risk (VaR) - Historical, Parametric, and Monte Carlo
- Conditional VaR (CVaR / Expected Shortfall)
- Stress Scenarios (Historical and Hypothetical)
- Monte Carlo Portfolio Simulation
- Tail Risk Analysis
"""

import numpy as np
import pandas as pd
from scipy import stats
from scipy.stats import norm, t as t_dist
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import warnings
warnings.filterwarnings('ignore')


class StressTesting:
    """
    Comprehensive stress testing and risk analysis for portfolios.
    """
    
    def __init__(self, returns_data: pd.DataFrame = None, confidence_levels: List[float] = None):
        """
        Initialize stress testing module.
        
        Args:
            returns_data: DataFrame with daily returns (columns = assets)
            confidence_levels: VaR confidence levels (default: [0.95, 0.99])
        """
        self.returns_data = returns_data
        self.confidence_levels = confidence_levels or [0.90, 0.95, 0.99]
        self.base_dir = Path(__file__).parent.parent
        
        # Historical stress scenarios
        self.HISTORICAL_SCENARIOS = {
            'Black Monday 1987': {
                'description': 'Single-day market crash of 22.6%',
                'equity_shock': -0.226,
                'bond_shock': 0.02,
                'volatility_spike': 3.0
            },
            'Asian Financial Crisis 1997': {
                'description': 'Asian markets collapse, contagion effects',
                'equity_shock': -0.15,
                'bond_shock': 0.01,
                'volatility_spike': 2.0
            },
            'Dot-Com Crash 2000-2002': {
                'description': 'Tech bubble burst, prolonged decline',
                'equity_shock': -0.20,
                'tech_shock': -0.40,
                'bond_shock': 0.03,
                'volatility_spike': 1.8
            },
            'Global Financial Crisis 2008': {
                'description': 'Lehman collapse, credit freeze',
                'equity_shock': -0.35,
                'bond_shock': 0.05,
                'high_yield_shock': -0.25,
                'volatility_spike': 4.0
            },
            'Flash Crash 2010': {
                'description': 'Rapid intraday crash and recovery',
                'equity_shock': -0.09,
                'bond_shock': 0.01,
                'volatility_spike': 2.5
            },
            'COVID-19 Crash 2020': {
                'description': 'Pandemic-driven market collapse',
                'equity_shock': -0.34,
                'bond_shock': 0.04,
                'high_yield_shock': -0.20,
                'volatility_spike': 5.0
            },
            '2022 Rate Shock': {
                'description': 'Aggressive Fed tightening',
                'equity_shock': -0.25,
                'bond_shock': -0.15,
                'tech_shock': -0.35,
                'volatility_spike': 1.5
            }
        }
        
        # Hypothetical stress scenarios
        self.HYPOTHETICAL_SCENARIOS = {
            'Mild Correction': {
                'description': '10% market pullback',
                'equity_shock': -0.10,
                'bond_shock': 0.02,
                'volatility_spike': 1.3
            },
            'Moderate Bear Market': {
                'description': '20% decline over months',
                'equity_shock': -0.20,
                'bond_shock': 0.03,
                'volatility_spike': 1.8
            },
            'Severe Bear Market': {
                'description': '30% crash scenario',
                'equity_shock': -0.30,
                'bond_shock': 0.05,
                'volatility_spike': 2.5
            },
            'Extreme Crash': {
                'description': '40%+ catastrophic decline',
                'equity_shock': -0.40,
                'bond_shock': 0.06,
                'volatility_spike': 4.0
            },
            'Stagflation': {
                'description': 'High inflation + recession',
                'equity_shock': -0.25,
                'bond_shock': -0.10,
                'volatility_spike': 2.0
            },
            'Liquidity Crisis': {
                'description': 'Credit markets freeze',
                'equity_shock': -0.20,
                'bond_shock': -0.05,
                'high_yield_shock': -0.30,
                'volatility_spike': 3.5
            },
            'Tech Sector Collapse': {
                'description': 'Technology bubble burst',
                'equity_shock': -0.15,
                'tech_shock': -0.50,
                'bond_shock': 0.02,
                'volatility_spike': 2.0
            },
            'Geopolitical Shock': {
                'description': 'Major geopolitical crisis',
                'equity_shock': -0.15,
                'bond_shock': 0.03,
                'international_shock': -0.25,
                'volatility_spike': 2.5
            }
        }
        
        # Asset classification for stress scenarios
        self.ASSET_CLASSIFICATION = {
            'equity': ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'INTC', 'AMD', 'SPY', 'QQQ'],
            'tech': ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'INTC', 'AMD', 'QQQ'],
            'bond': ['IEF', 'BIL'],
            'high_yield': ['HYG'],
            'international': ['EFA']
        }
    
    def load_returns_data(self):
        """Load returns data from exported data or compute from prices."""
        try:
            # Try loading from exported data
            data_dir = self.base_dir / "data" / "exported_data" / "per_asset"
            
            returns_dict = {}
            assets = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META',
                     'SPY', 'QQQ', 'EFA', 'IEF', 'HYG', 'BIL', 'INTC', 'AMD']
            
            for asset in assets:
                asset_file = data_dir / f"{asset}_features.csv"
                if asset_file.exists():
                    df = pd.read_csv(asset_file, index_col=0, parse_dates=True)
                    # Look for return column
                    ret_col = f"{asset}_ret_1d" if f"{asset}_ret_1d" in df.columns else 'ret_1d'
                    if ret_col in df.columns:
                        returns_dict[asset] = df[ret_col]
            
            if returns_dict:
                self.returns_data = pd.DataFrame(returns_dict)
                print(f"✅ Loaded returns for {len(returns_dict)} assets")
                return True
            
        except Exception as e:
            print(f"⚠️ Could not load returns: {e}")
        
        return False
    
    # ===================== VALUE AT RISK (VaR) =====================
    
    def historical_var(self, weights: Dict[str, float], 
                       confidence: float = 0.95,
                       horizon_days: int = 1) -> Dict:
        """
        Calculate Historical VaR using actual return distribution.
        
        Args:
            weights: Portfolio weights {asset: weight}
            confidence: Confidence level (e.g., 0.95 for 95%)
            horizon_days: Time horizon in days
            
        Returns:
            Dictionary with VaR metrics
        """
        if self.returns_data is None:
            self.load_returns_data()
        
        # Calculate portfolio returns
        assets = [a for a in weights.keys() if a in self.returns_data.columns]
        w = np.array([weights[a] for a in assets])
        w = w / w.sum()  # Normalize
        
        returns = self.returns_data[assets].dropna()
        portfolio_returns = (returns * w).sum(axis=1)
        
        # Scale for horizon
        if horizon_days > 1:
            portfolio_returns = portfolio_returns.rolling(horizon_days).sum().dropna()
        
        # Calculate VaR (loss is negative return)
        var_percentile = (1 - confidence) * 100
        var = -np.percentile(portfolio_returns, var_percentile)
        
        # CVaR (Expected Shortfall) - average of losses beyond VaR
        losses = -portfolio_returns
        cvar = losses[losses >= var].mean()
        
        return {
            'method': 'Historical',
            'confidence': confidence,
            'horizon_days': horizon_days,
            'var': var,
            'var_pct': var * 100,
            'cvar': cvar,
            'cvar_pct': cvar * 100,
            'samples': len(portfolio_returns),
            'worst_loss': -portfolio_returns.min(),
            'worst_loss_pct': -portfolio_returns.min() * 100
        }
    
    def parametric_var(self, weights: Dict[str, float],
                       confidence: float = 0.95,
                       horizon_days: int = 1) -> Dict:
        """
        Calculate Parametric (Delta-Normal) VaR assuming normal distribution.
        
        Args:
            weights: Portfolio weights
            confidence: Confidence level
            horizon_days: Time horizon
            
        Returns:
            Dictionary with VaR metrics
        """
        if self.returns_data is None:
            self.load_returns_data()
        
        assets = [a for a in weights.keys() if a in self.returns_data.columns]
        w = np.array([weights[a] for a in assets])
        w = w / w.sum()
        
        returns = self.returns_data[assets].dropna()
        
        # Portfolio mean and volatility
        mean_returns = returns.mean()
        cov_matrix = returns.cov()
        
        portfolio_mean = np.dot(w, mean_returns) * horizon_days
        portfolio_var = np.dot(w.T, np.dot(cov_matrix, w)) * horizon_days
        portfolio_std = np.sqrt(portfolio_var)
        
        # Z-score for confidence level
        z_score = norm.ppf(confidence)
        
        # VaR = -mean + z * std (loss measure)
        var = -portfolio_mean + z_score * portfolio_std
        
        # CVaR for normal distribution
        cvar = -portfolio_mean + portfolio_std * norm.pdf(z_score) / (1 - confidence)
        
        return {
            'method': 'Parametric (Normal)',
            'confidence': confidence,
            'horizon_days': horizon_days,
            'var': var,
            'var_pct': var * 100,
            'cvar': cvar,
            'cvar_pct': cvar * 100,
            'portfolio_mean': portfolio_mean,
            'portfolio_std': portfolio_std,
            'z_score': z_score
        }
    
    def monte_carlo_var(self, weights: Dict[str, float],
                        confidence: float = 0.95,
                        horizon_days: int = 1,
                        n_simulations: int = 10000) -> Dict:
        """
        Calculate VaR using Monte Carlo simulation.
        
        Args:
            weights: Portfolio weights
            confidence: Confidence level
            horizon_days: Time horizon
            n_simulations: Number of simulation paths
            
        Returns:
            Dictionary with VaR metrics and simulation results
        """
        if self.returns_data is None:
            self.load_returns_data()
        
        assets = [a for a in weights.keys() if a in self.returns_data.columns]
        w = np.array([weights[a] for a in assets])
        w = w / w.sum()
        
        returns = self.returns_data[assets].dropna()
        
        # Estimate parameters
        mean_returns = returns.mean().values
        cov_matrix = returns.cov().values
        
        # Generate correlated random returns
        np.random.seed(42)
        simulated_returns = np.random.multivariate_normal(
            mean_returns * horizon_days,
            cov_matrix * horizon_days,
            n_simulations
        )
        
        # Portfolio returns
        portfolio_returns = np.dot(simulated_returns, w)
        
        # Calculate VaR
        var_percentile = (1 - confidence) * 100
        var = -np.percentile(portfolio_returns, var_percentile)
        
        # CVaR
        losses = -portfolio_returns
        cvar = losses[losses >= var].mean()
        
        return {
            'method': 'Monte Carlo',
            'confidence': confidence,
            'horizon_days': horizon_days,
            'n_simulations': n_simulations,
            'var': var,
            'var_pct': var * 100,
            'cvar': cvar,
            'cvar_pct': cvar * 100,
            'simulated_mean': portfolio_returns.mean(),
            'simulated_std': portfolio_returns.std(),
            'worst_simulation': -portfolio_returns.min(),
            'best_simulation': portfolio_returns.max(),
            'percentiles': {
                '1%': -np.percentile(portfolio_returns, 1),
                '5%': -np.percentile(portfolio_returns, 5),
                '10%': -np.percentile(portfolio_returns, 10),
                '25%': -np.percentile(portfolio_returns, 25),
                '50%': -np.percentile(portfolio_returns, 50),
                '75%': -np.percentile(portfolio_returns, 75),
                '90%': -np.percentile(portfolio_returns, 90),
                '95%': -np.percentile(portfolio_returns, 95),
                '99%': -np.percentile(portfolio_returns, 99),
            }
        }
    
    def calculate_all_var(self, weights: Dict[str, float],
                          horizon_days: int = 1) -> pd.DataFrame:
        """
        Calculate VaR using all methods and confidence levels.
        
        Returns:
            DataFrame comparing all VaR estimates
        """
        results = []
        
        for conf in self.confidence_levels:
            # Historical VaR
            hist = self.historical_var(weights, conf, horizon_days)
            results.append({
                'Method': 'Historical',
                'Confidence': f"{conf*100:.0f}%",
                'VaR (%)': hist['var_pct'],
                'CVaR (%)': hist['cvar_pct']
            })
            
            # Parametric VaR
            param = self.parametric_var(weights, conf, horizon_days)
            results.append({
                'Method': 'Parametric',
                'Confidence': f"{conf*100:.0f}%",
                'VaR (%)': param['var_pct'],
                'CVaR (%)': param['cvar_pct']
            })
            
            # Monte Carlo VaR
            mc = self.monte_carlo_var(weights, conf, horizon_days)
            results.append({
                'Method': 'Monte Carlo',
                'Confidence': f"{conf*100:.0f}%",
                'VaR (%)': mc['var_pct'],
                'CVaR (%)': mc['cvar_pct']
            })
        
        return pd.DataFrame(results)
    
    # ===================== STRESS SCENARIOS =====================
    
    def apply_stress_scenario(self, weights: Dict[str, float],
                              scenario: Dict,
                              portfolio_value: float = 100000) -> Dict:
        """
        Apply a stress scenario to the portfolio.
        
        Args:
            weights: Portfolio weights
            scenario: Scenario definition dictionary
            portfolio_value: Current portfolio value
            
        Returns:
            Stressed portfolio results
        """
        asset_returns = {}
        
        for asset, weight in weights.items():
            # Determine shock based on asset classification
            shock = 0
            
            # Check asset type and apply appropriate shock
            if asset in self.ASSET_CLASSIFICATION.get('tech', []):
                shock = scenario.get('tech_shock', scenario.get('equity_shock', 0))
            elif asset in self.ASSET_CLASSIFICATION.get('equity', []):
                shock = scenario.get('equity_shock', 0)
            elif asset in self.ASSET_CLASSIFICATION.get('high_yield', []):
                shock = scenario.get('high_yield_shock', scenario.get('bond_shock', 0))
            elif asset in self.ASSET_CLASSIFICATION.get('bond', []):
                shock = scenario.get('bond_shock', 0)
            elif asset in self.ASSET_CLASSIFICATION.get('international', []):
                shock = scenario.get('international_shock', scenario.get('equity_shock', 0))
            else:
                shock = scenario.get('equity_shock', 0)  # Default to equity
            
            asset_returns[asset] = shock
        
        # Calculate portfolio impact
        portfolio_return = sum(weights.get(a, 0) * asset_returns.get(a, 0) 
                               for a in weights.keys())
        
        loss_dollars = -portfolio_return * portfolio_value
        
        return {
            'portfolio_return': portfolio_return,
            'portfolio_return_pct': portfolio_return * 100,
            'loss_dollars': loss_dollars,
            'new_portfolio_value': portfolio_value * (1 + portfolio_return),
            'asset_returns': asset_returns,
            'volatility_spike': scenario.get('volatility_spike', 1.0)
        }
    
    def run_historical_scenarios(self, weights: Dict[str, float],
                                  portfolio_value: float = 100000) -> pd.DataFrame:
        """
        Run all historical stress scenarios.
        
        Returns:
            DataFrame with scenario results
        """
        results = []
        
        for name, scenario in self.HISTORICAL_SCENARIOS.items():
            stress_result = self.apply_stress_scenario(weights, scenario, portfolio_value)
            
            results.append({
                'Scenario': name,
                'Description': scenario['description'],
                'Portfolio Return (%)': stress_result['portfolio_return_pct'],
                'Loss ($)': stress_result['loss_dollars'],
                'Final Value ($)': stress_result['new_portfolio_value'],
                'Vol Spike': f"{scenario.get('volatility_spike', 1):.1f}x"
            })
        
        return pd.DataFrame(results)
    
    def run_hypothetical_scenarios(self, weights: Dict[str, float],
                                    portfolio_value: float = 100000) -> pd.DataFrame:
        """
        Run all hypothetical stress scenarios.
        
        Returns:
            DataFrame with scenario results
        """
        results = []
        
        for name, scenario in self.HYPOTHETICAL_SCENARIOS.items():
            stress_result = self.apply_stress_scenario(weights, scenario, portfolio_value)
            
            results.append({
                'Scenario': name,
                'Description': scenario['description'],
                'Portfolio Return (%)': stress_result['portfolio_return_pct'],
                'Loss ($)': stress_result['loss_dollars'],
                'Final Value ($)': stress_result['new_portfolio_value'],
                'Vol Spike': f"{scenario.get('volatility_spike', 1):.1f}x"
            })
        
        return pd.DataFrame(results)
    
    def run_all_scenarios(self, weights: Dict[str, float],
                          portfolio_value: float = 100000) -> Dict:
        """
        Run both historical and hypothetical scenarios.
        
        Returns:
            Dictionary with all scenario results
        """
        historical = self.run_historical_scenarios(weights, portfolio_value)
        hypothetical = self.run_hypothetical_scenarios(weights, portfolio_value)
        
        # Summary statistics
        all_returns = list(historical['Portfolio Return (%)']) + list(hypothetical['Portfolio Return (%)'])
        
        return {
            'historical_scenarios': historical,
            'hypothetical_scenarios': hypothetical,
            'summary': {
                'worst_case': min(all_returns),
                'best_case': max(all_returns),
                'average_loss': np.mean([r for r in all_returns if r < 0]),
                'scenarios_tested': len(all_returns)
            }
        }
    
    # ===================== TAIL RISK ANALYSIS =====================
    
    def tail_risk_analysis(self, weights: Dict[str, float]) -> Dict:
        """
        Analyze tail risk characteristics of the portfolio.
        
        Returns:
            Dictionary with tail risk metrics
        """
        if self.returns_data is None:
            self.load_returns_data()
        
        assets = [a for a in weights.keys() if a in self.returns_data.columns]
        w = np.array([weights[a] for a in assets])
        w = w / w.sum()
        
        returns = self.returns_data[assets].dropna()
        portfolio_returns = (returns * w).sum(axis=1)
        
        # Basic statistics
        mean_ret = portfolio_returns.mean()
        std_ret = portfolio_returns.std()
        
        # Higher moments
        skewness = portfolio_returns.skew()
        kurtosis = portfolio_returns.kurtosis()  # Excess kurtosis
        
        # Tail metrics
        left_tail_5pct = np.percentile(portfolio_returns, 5)
        left_tail_1pct = np.percentile(portfolio_returns, 1)
        right_tail_95pct = np.percentile(portfolio_returns, 95)
        right_tail_99pct = np.percentile(portfolio_returns, 99)
        
        # Count extreme events
        threshold_2std = -2 * std_ret
        threshold_3std = -3 * std_ret
        
        extreme_2std = (portfolio_returns < threshold_2std).sum()
        extreme_3std = (portfolio_returns < threshold_3std).sum()
        
        # Expected under normal distribution
        expected_2std = len(portfolio_returns) * (1 - norm.cdf(2))
        expected_3std = len(portfolio_returns) * (1 - norm.cdf(3))
        
        return {
            'mean_daily_return': mean_ret,
            'daily_volatility': std_ret,
            'annualized_volatility': std_ret * np.sqrt(252),
            'skewness': skewness,
            'excess_kurtosis': kurtosis,
            'is_fat_tailed': kurtosis > 0,
            'is_negatively_skewed': skewness < 0,
            'left_tail_5pct': left_tail_5pct,
            'left_tail_1pct': left_tail_1pct,
            'right_tail_95pct': right_tail_95pct,
            'right_tail_99pct': right_tail_99pct,
            'extreme_events_2std': {
                'observed': extreme_2std,
                'expected_normal': expected_2std,
                'ratio': extreme_2std / expected_2std if expected_2std > 0 else 0
            },
            'extreme_events_3std': {
                'observed': extreme_3std,
                'expected_normal': expected_3std,
                'ratio': extreme_3std / expected_3std if expected_3std > 0 else 0
            },
            'total_observations': len(portfolio_returns)
        }
    
    # ===================== COMPREHENSIVE REPORT =====================
    
    def generate_stress_report(self, weights: Dict[str, float],
                                portfolio_value: float = 100000) -> str:
        """
        Generate a comprehensive stress testing report.
        
        Returns:
            Formatted report string
        """
        report = []
        report.append("\n" + "="*80)
        report.append("📊 COMPREHENSIVE STRESS TESTING REPORT")
        report.append("="*80)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        report.append(f"Portfolio Value: ${portfolio_value:,.2f}")
        
        # VaR Section
        report.append("\n" + "─"*80)
        report.append("📉 VALUE AT RISK (VaR) ANALYSIS")
        report.append("─"*80)
        
        var_df = self.calculate_all_var(weights, horizon_days=1)
        report.append("\n1-Day VaR (at different confidence levels):\n")
        report.append(var_df.to_string(index=False))
        
        # Interpretation
        var_95 = self.historical_var(weights, 0.95)
        report.append(f"\n📌 Interpretation:")
        report.append(f"   With 95% confidence, daily loss will not exceed {var_95['var_pct']:.2f}%")
        report.append(f"   (${var_95['var'] * portfolio_value:,.2f} on ${portfolio_value:,.2f} portfolio)")
        
        # Stress Scenarios Section
        report.append("\n" + "─"*80)
        report.append("🔥 STRESS SCENARIO ANALYSIS")
        report.append("─"*80)
        
        scenarios = self.run_all_scenarios(weights, portfolio_value)
        
        report.append("\n📅 HISTORICAL SCENARIOS:")
        report.append(scenarios['historical_scenarios'].to_string(index=False))
        
        report.append("\n\n🔮 HYPOTHETICAL SCENARIOS:")
        report.append(scenarios['hypothetical_scenarios'].to_string(index=False))
        
        report.append(f"\n📊 Scenario Summary:")
        report.append(f"   Worst Case: {scenarios['summary']['worst_case']:.1f}%")
        report.append(f"   Average Stress Loss: {scenarios['summary']['average_loss']:.1f}%")
        report.append(f"   Scenarios Tested: {scenarios['summary']['scenarios_tested']}")
        
        # Tail Risk Section
        report.append("\n" + "─"*80)
        report.append("📈 TAIL RISK ANALYSIS")
        report.append("─"*80)
        
        tail = self.tail_risk_analysis(weights)
        
        report.append(f"\n   Daily Volatility: {tail['daily_volatility']*100:.2f}%")
        report.append(f"   Annualized Volatility: {tail['annualized_volatility']*100:.1f}%")
        report.append(f"   Skewness: {tail['skewness']:.3f} {'(negative - more downside risk)' if tail['is_negatively_skewed'] else '(positive)'}")
        report.append(f"   Excess Kurtosis: {tail['excess_kurtosis']:.3f} {'(fat tails - extreme events more likely)' if tail['is_fat_tailed'] else '(thin tails)'}")
        
        report.append(f"\n   Extreme Events (>2σ): {tail['extreme_events_2std']['observed']} observed vs {tail['extreme_events_2std']['expected_normal']:.0f} expected")
        report.append(f"   Extreme Events (>3σ): {tail['extreme_events_3std']['observed']} observed vs {tail['extreme_events_3std']['expected_normal']:.0f} expected")
        
        # Risk Summary
        report.append("\n" + "─"*80)
        report.append("⚠️ RISK SUMMARY & RECOMMENDATIONS")
        report.append("─"*80)
        
        # Risk flags
        risk_flags = []
        
        if var_95['var_pct'] > 3:
            risk_flags.append("HIGH: Daily VaR exceeds 3% - consider reducing position sizes")
        
        if abs(scenarios['summary']['worst_case']) > 30:
            risk_flags.append("HIGH: Worst-case scenario loss exceeds 30% - increase diversification")
        
        if tail['is_fat_tailed'] and tail['excess_kurtosis'] > 3:
            risk_flags.append("MEDIUM: Fat tails detected - extreme events more likely than normal")
        
        if tail['is_negatively_skewed'] and tail['skewness'] < -0.5:
            risk_flags.append("MEDIUM: Negative skew - downside risk elevated")
        
        if not risk_flags:
            risk_flags.append("LOW: No major risk concerns identified")
        
        for flag in risk_flags:
            report.append(f"   • {flag}")
        
        report.append("\n" + "="*80)
        
        return "\n".join(report)
    
    def get_stress_test_summary(self, weights: Dict[str, float],
                                 portfolio_value: float = 100000) -> Dict:
        """
        Get stress test results as a dictionary (for API use).
        
        Returns:
            Dictionary with all stress test results
        """
        # Calculate all metrics
        var_results = {}
        for conf in self.confidence_levels:
            conf_key = f"{int(conf*100)}pct"
            var_results[conf_key] = {
                'historical': self.historical_var(weights, conf),
                'parametric': self.parametric_var(weights, conf),
                'monte_carlo': self.monte_carlo_var(weights, conf)
            }
        
        scenarios = self.run_all_scenarios(weights, portfolio_value)
        tail = self.tail_risk_analysis(weights)
        
        # Calculate risk score (0-100, higher = more risky)
        var_95 = var_results['95pct']['historical']['var_pct']
        worst_scenario = abs(scenarios['summary']['worst_case'])
        fat_tail_factor = max(0, tail['excess_kurtosis']) / 3
        skew_factor = max(0, -tail['skewness']) / 0.5
        
        risk_score = min(100, (var_95 * 10 + worst_scenario * 1.5 + 
                               fat_tail_factor * 10 + skew_factor * 10))
        
        return {
            'var': var_results,
            'scenarios': {
                'historical': scenarios['historical_scenarios'].to_dict('records'),
                'hypothetical': scenarios['hypothetical_scenarios'].to_dict('records'),
                'summary': scenarios['summary']
            },
            'tail_risk': tail,
            'risk_score': round(risk_score, 1),
            'risk_level': 'LOW' if risk_score < 30 else 'MEDIUM' if risk_score < 60 else 'HIGH',
            'portfolio_value': portfolio_value,
            'timestamp': datetime.now().isoformat()
        }


# Convenience function for quick stress testing
def quick_stress_test(weights: Dict[str, float], 
                      portfolio_value: float = 100000,
                      print_report: bool = True) -> Dict:
    """
    Quick stress test with default settings.
    
    Args:
        weights: Portfolio weights
        portfolio_value: Portfolio value
        print_report: Whether to print the report
        
    Returns:
        Stress test results dictionary
    """
    st = StressTesting()
    st.load_returns_data()
    
    if print_report:
        report = st.generate_stress_report(weights, portfolio_value)
        print(report)
    
    return st.get_stress_test_summary(weights, portfolio_value)


if __name__ == "__main__":
    # Example usage
    test_weights = {
        'AAPL': 0.15,
        'NVDA': 0.15,
        'MSFT': 0.12,
        'GOOGL': 0.10,
        'AMZN': 0.10,
        'SPY': 0.15,
        'IEF': 0.10,
        'HYG': 0.08,
        'EFA': 0.05
    }
    
    results = quick_stress_test(test_weights, portfolio_value=100000)
    
    print(f"\n📊 Risk Score: {results['risk_score']}/100 ({results['risk_level']})")
