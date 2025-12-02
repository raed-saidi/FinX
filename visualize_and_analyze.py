# visualize_and_analyze.py
# Comprehensive feature analysis and visualization for your hackathon presentation

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from zenml.client import Client
import warnings
warnings.filterwarnings('ignore')

# Set style
plt.style.use('seaborn-v0_8-darkgrid')
sns.set_palette("husl")


def load_latest_artifacts():
    """Load the latest pipeline artifacts."""
    client = Client()
    
    runs = client.list_pipeline_runs(pipeline_name="data_pipeline", size=10)
    
    if not runs:
        raise ValueError("No pipeline runs found. Run the pipeline first!")
    
    # Find latest successful run
    successful_run = None
    for run in runs:
        if run.status == "completed":
            successful_run = run
            break
    
    if not successful_run:
        raise ValueError("No successful pipeline runs found!")
    
    print(f"Loading artifacts from run: {successful_run.name}")
    
    artifacts = {}
    
    # Load key artifacts
    for step_name in successful_run.steps:
        step = successful_run.steps[step_name]
        
        if step.status != "completed":
            continue
        
        for output_name in step.outputs:
            artifact = step.outputs[output_name].load()
            
            # Store with meaningful names
            if step_name == "preprocess_prices":
                artifacts['prices'] = artifact
            elif step_name == "compute_and_clip_returns" and output_name == "output":
                artifacts['returns'] = artifact
            elif step_name == "compute_and_clip_returns" and output_name == "output_1":
                artifacts['clip_stats'] = artifact
            elif step_name == "feature_engineering" and output_name == "output":
                artifacts['features'] = artifact
            elif step_name == "feature_engineering" and output_name == "output_2":
                artifacts['kmeans'] = artifact
            elif step_name == "scale_features" and output_name == "output":
                artifacts['features_scaled'] = artifact
    
    return artifacts


def create_output_dir():
    """Create output directory for visualizations."""
    output_dir = Path("visualizations")
    output_dir.mkdir(exist_ok=True)
    return output_dir


def plot_price_history(prices, output_dir):
    """Plot normalized price history."""
    print("\nGenerating price history plot...")
    
    # Normalize prices to 100
    prices_norm = prices / prices.iloc[0] * 100
    
    fig, ax = plt.subplots(figsize=(14, 7))
    
    for col in prices_norm.columns:
        ax.plot(prices_norm.index, prices_norm[col], label=col, linewidth=2)
    
    ax.set_title("Normalized Price History (Base = 100)", fontsize=16, fontweight='bold')
    ax.set_xlabel("Date", fontsize=12)
    ax.set_ylabel("Normalized Price", fontsize=12)
    ax.legend(loc='best', fontsize=10)
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(output_dir / "01_price_history.png", dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"  ✅ Saved: {output_dir / '01_price_history.png'}")


def plot_returns_distribution(returns, output_dir):
    """Plot return distributions."""
    print("\nGenerating returns distribution plots...")
    
    n_assets = len(returns.columns)
    n_cols = 3
    n_rows = (n_assets + n_cols - 1) // n_cols
    
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(15, 4*n_rows))
    axes = axes.flatten() if n_assets > 1 else [axes]
    
    for i, col in enumerate(returns.columns):
        ax = axes[i]
        
        # Histogram
        ax.hist(returns[col].dropna() * 100, bins=50, alpha=0.7, edgecolor='black')
        
        # Add normal distribution overlay
        mu = returns[col].mean() * 100
        sigma = returns[col].std() * 100
        x = np.linspace(returns[col].min() * 100, returns[col].max() * 100, 100)
        ax.plot(x, len(returns[col]) * (returns[col].max() - returns[col].min()) / 50 * 
                np.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * np.sqrt(2 * np.pi)),
                'r-', linewidth=2, label='Normal')
        
        ax.set_title(f"{col} Daily Returns", fontweight='bold')
        ax.set_xlabel("Return (%)")
        ax.set_ylabel("Frequency")
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        # Add statistics
        skew = returns[col].skew()
        kurt = returns[col].kurtosis()
        ax.text(0.02, 0.98, f"μ={mu:.3f}%\nσ={sigma:.3f}%\nSkew={skew:.2f}\nKurt={kurt:.2f}",
                transform=ax.transAxes, fontsize=9, verticalalignment='top',
                bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    # Hide unused subplots
    for i in range(n_assets, len(axes)):
        axes[i].axis('off')
    
    plt.tight_layout()
    plt.savefig(output_dir / "02_returns_distribution.png", dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"  ✅ Saved: {output_dir / '02_returns_distribution.png'}")


def plot_rolling_metrics(returns, output_dir):
    """Plot rolling volatility and Sharpe ratio."""
    print("\nGenerating rolling metrics plots...")
    
    # Calculate rolling metrics
    window = 60
    roll_vol = returns.rolling(window).std() * np.sqrt(252) * 100
    roll_sharpe = (returns.rolling(window).mean() * 252) / (returns.rolling(window).std() * np.sqrt(252))
    
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 10))
    
    # Rolling volatility
    for col in roll_vol.columns:
        ax1.plot(roll_vol.index, roll_vol[col], label=col, linewidth=1.5)
    
    ax1.set_title(f"Rolling {window}-Day Volatility (Annualized)", fontsize=14, fontweight='bold')
    ax1.set_xlabel("Date")
    ax1.set_ylabel("Volatility (%)")
    ax1.legend(loc='best')
    ax1.grid(True, alpha=0.3)
    
    # Rolling Sharpe
    for col in roll_sharpe.columns:
        ax2.plot(roll_sharpe.index, roll_sharpe[col], label=col, linewidth=1.5)
    
    ax2.axhline(y=0, color='red', linestyle='--', alpha=0.5)
    ax2.set_title(f"Rolling {window}-Day Sharpe Ratio", fontsize=14, fontweight='bold')
    ax2.set_xlabel("Date")
    ax2.set_ylabel("Sharpe Ratio")
    ax2.legend(loc='best')
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(output_dir / "03_rolling_metrics.png", dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"  ✅ Saved: {output_dir / '03_rolling_metrics.png'}")


def plot_correlation_heatmap(returns, output_dir):
    """Plot correlation heatmap."""
    print("\nGenerating correlation heatmap...")
    
    corr = returns.corr()
    
    fig, ax = plt.subplots(figsize=(10, 8))
    
    sns.heatmap(corr, annot=True, fmt='.2f', cmap='coolwarm', center=0,
                square=True, linewidths=1, cbar_kws={"shrink": 0.8}, ax=ax)
    
    ax.set_title("Asset Return Correlations", fontsize=16, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(output_dir / "04_correlation_heatmap.png", dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"  ✅ Saved: {output_dir / '04_correlation_heatmap.png'}")


def plot_feature_importance_proxy(features, output_dir):
    """Plot feature variance as proxy for importance."""
    print("\nGenerating feature importance proxy...")
    
    # Use variance as a simple proxy for feature importance
    feature_var = features.var().sort_values(ascending=False).head(30)
    
    fig, ax = plt.subplots(figsize=(12, 8))
    
    feature_var.plot(kind='barh', ax=ax, color='steelblue')
    
    ax.set_title("Top 30 Features by Variance", fontsize=16, fontweight='bold')
    ax.set_xlabel("Variance")
    ax.set_ylabel("Feature")
    ax.grid(True, alpha=0.3, axis='x')
    
    plt.tight_layout()
    plt.savefig(output_dir / "05_feature_importance.png", dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"  ✅ Saved: {output_dir / '05_feature_importance.png'}")


def plot_regime_analysis(features, output_dir):
    """Plot market regime analysis."""
    print("\nGenerating regime analysis...")
    
    if 'regime' not in features.columns:
        # Check for one-hot encoded regimes
        regime_cols = [c for c in features.columns if c.startswith('regime_')]
        if regime_cols:
            # Reconstruct regime from one-hot
            regime = features[regime_cols].idxmax(axis=1).str.replace('regime_', '').astype(int)
        else:
            print("  ⚠️  No regime information found, skipping...")
            return
    else:
        regime = features['regime']
    
    # Get portfolio metrics
    ew_ret = features['ew_ret_1d'] if 'ew_ret_1d' in features.columns else None
    ew_vol = features['ew_vol_20'] if 'ew_vol_20' in features.columns else None
    
    if ew_ret is None or ew_vol is None:
        print("  ⚠️  Portfolio metrics not found, skipping...")
        return
    
    fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(14, 12))
    
    # Regime timeline
    colors = ['green', 'orange', 'red']
    for i in range(3):
        mask = regime == i
        ax1.fill_between(regime.index, 0, 1, where=mask, alpha=0.3, 
                         color=colors[i], label=f'Regime {i}')
    
    ax1.set_title("Market Regime Classification Over Time", fontsize=14, fontweight='bold')
    ax1.set_ylabel("Regime")
    ax1.legend(loc='best')
    ax1.set_ylim(0, 1)
    ax1.grid(True, alpha=0.3)
    
    # Returns by regime
    ax2.plot(ew_ret.index, ew_ret.cumsum() * 100, color='black', linewidth=2)
    for i in range(3):
        mask = regime == i
        ax2.fill_between(ew_ret.index, -10, 50, where=mask, alpha=0.2, color=colors[i])
    
    ax2.set_title("Cumulative Returns with Regime Overlay", fontsize=14, fontweight='bold')
    ax2.set_ylabel("Cumulative Return (%)")
    ax2.grid(True, alpha=0.3)
    
    # Regime statistics
    regime_stats = pd.DataFrame({
        'Mean Return': [ew_ret[regime == i].mean() * 252 * 100 for i in range(3)],
        'Volatility': [ew_ret[regime == i].std() * np.sqrt(252) * 100 for i in range(3)],
        'Sharpe': [(ew_ret[regime == i].mean() * 252) / (ew_ret[regime == i].std() * np.sqrt(252)) for i in range(3)]
    }, index=[f'Regime {i}' for i in range(3)])
    
    x = np.arange(len(regime_stats))
    width = 0.25
    
    ax3.bar(x - width, regime_stats['Mean Return'], width, label='Mean Return (%)', color='steelblue')
    ax3.bar(x, regime_stats['Volatility'], width, label='Volatility (%)', color='orange')
    ax3.bar(x + width, regime_stats['Sharpe'], width, label='Sharpe Ratio', color='green')
    
    ax3.set_title("Performance Metrics by Regime", fontsize=14, fontweight='bold')
    ax3.set_xticks(x)
    ax3.set_xticklabels(regime_stats.index)
    ax3.legend()
    ax3.grid(True, alpha=0.3, axis='y')
    ax3.axhline(y=0, color='red', linestyle='--', alpha=0.5)
    
    plt.tight_layout()
    plt.savefig(output_dir / "06_regime_analysis.png", dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"  ✅ Saved: {output_dir / '06_regime_analysis.png'}")


def plot_feature_correlation_matrix(features, output_dir):
    """Plot correlation matrix of top features."""
    print("\nGenerating feature correlation matrix...")
    
    # Select top features by variance
    top_features = features.var().sort_values(ascending=False).head(20).index
    corr = features[top_features].corr()
    
    fig, ax = plt.subplots(figsize=(14, 12))
    
    sns.heatmap(corr, annot=False, cmap='coolwarm', center=0,
                square=True, linewidths=0.5, cbar_kws={"shrink": 0.8}, ax=ax)
    
    ax.set_title("Top 20 Feature Correlations", fontsize=16, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(output_dir / "07_feature_correlation.png", dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"  ✅ Saved: {output_dir / '07_feature_correlation.png'}")


def generate_summary_statistics(artifacts, output_dir):
    """Generate comprehensive summary statistics."""
    print("\nGenerating summary statistics...")
    
    prices = artifacts.get('prices')
    returns = artifacts.get('returns')
    features = artifacts.get('features')
    clip_stats = artifacts.get('clip_stats')
    
    with open(output_dir / "summary_statistics.txt", 'w') as f:
        f.write("="*80 + "\n")
        f.write("COMPREHENSIVE DATA PIPELINE SUMMARY\n")
        f.write("="*80 + "\n\n")
        
        # Price data
        if prices is not None:
            f.write("PRICE DATA\n")
            f.write("-"*80 + "\n")
            f.write(f"Assets: {list(prices.columns)}\n")
            f.write(f"Date range: {prices.index.min().date()} to {prices.index.max().date()}\n")
            f.write(f"Trading days: {len(prices)}\n\n")
            
            f.write("Price statistics:\n")
            f.write(prices.describe().to_string())
            f.write("\n\n")
        
        # Returns
        if returns is not None:
            f.write("RETURNS DATA\n")
            f.write("-"*80 + "\n")
            f.write(f"Shape: {returns.shape}\n\n")
            
            f.write("Annualized statistics:\n")
            ann_return = returns.mean() * 252 * 100
            ann_vol = returns.std() * np.sqrt(252) * 100
            sharpe = ann_return / ann_vol
            
            stats_df = pd.DataFrame({
                'Ann. Return (%)': ann_return,
                'Ann. Vol (%)': ann_vol,
                'Sharpe Ratio': sharpe,
                'Skewness': returns.skew(),
                'Kurtosis': returns.kurtosis()
            })
            f.write(stats_df.to_string())
            f.write("\n\n")
        
        # Clipping stats
        if clip_stats:
            f.write("RETURN CLIPPING\n")
            f.write("-"*80 + "\n")
            for key, value in clip_stats.items():
                if key not in ['asset_stats']:
                    f.write(f"{key}: {value}\n")
            f.write("\n")
        
        # Features
        if features is not None:
            f.write("FEATURES\n")
            f.write("-"*80 + "\n")
            f.write(f"Shape: {features.shape}\n")
            f.write(f"Total features: {features.shape[1]}\n")
            f.write(f"Date range: {features.index.min().date()} to {features.index.max().date()}\n\n")
            
            f.write("Feature categories:\n")
            categories = {}
            for col in features.columns:
                if any(x in col for x in ['ret_', 'mom_', 'roc_']):
                    cat = 'Momentum'
                elif any(x in col for x in ['vol_', 'vol', 'downside']):
                    cat = 'Volatility'
                elif any(x in col for x in ['dd_', 'drawdown', 'sharpe', 'sortino', 'calmar']):
                    cat = 'Risk'
                elif any(x in col for x in ['ma_', 'macd', 'rsi', 'bb_', 'stoch', 'adx', 'trend']):
                    cat = 'Technical'
                elif any(x in col for x in ['corr', 'beta', 'rel_']):
                    cat = 'Cross-Asset'
                elif col.startswith('ew_'):
                    cat = 'Portfolio'
                elif col.startswith('regime'):
                    cat = 'Regime'
                else:
                    cat = 'Other'
                
                categories[cat] = categories.get(cat, 0) + 1
            
            for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
                f.write(f"  {cat}: {count} features\n")
    
    print(f"  ✅ Saved: {output_dir / 'summary_statistics.txt'}")


def main():
    """Main execution function."""
    print("\n" + "="*80)
    print("COMPREHENSIVE FEATURE ANALYSIS AND VISUALIZATION")
    print("="*80)
    
    # Load artifacts
    print("\nLoading pipeline artifacts...")
    artifacts = load_latest_artifacts()
    
    # Create output directory
    output_dir = create_output_dir()
    print(f"\nOutput directory: {output_dir}")
    
    # Generate visualizations
    print("\n" + "="*80)
    print("GENERATING VISUALIZATIONS")
    print("="*80)
    
    if 'prices' in artifacts:
        plot_price_history(artifacts['prices'], output_dir)
    
    if 'returns' in artifacts:
        plot_returns_distribution(artifacts['returns'], output_dir)
        plot_rolling_metrics(artifacts['returns'], output_dir)
        plot_correlation_heatmap(artifacts['returns'], output_dir)
    
    if 'features' in artifacts:
        plot_feature_importance_proxy(artifacts['features'], output_dir)
        plot_regime_analysis(artifacts['features'], output_dir)
        plot_feature_correlation_matrix(artifacts['features'], output_dir)
    
    # Generate summary statistics
    generate_summary_statistics(artifacts, output_dir)
    
    print("\n" + "="*80)
    print("VISUALIZATION COMPLETE")
    print("="*80)
    print(f"\nAll visualizations saved to: {output_dir}/")
    print("\nGenerated files:")
    for file in sorted(output_dir.glob("*.png")):
        print(f"  📊 {file.name}")
    for file in sorted(output_dir.glob("*.txt")):
        print(f"  📄 {file.name}")
    
    print("\n💡 Use these visualizations in your hackathon presentation!")


if __name__ == "__main__":
    main()