import pandas as pd
import numpy as np

# Load SPY test data
X = pd.read_csv(r'c:\Users\Raed\Desktop\ai-odissey\smart_investment_ai\data\exported_data\per_asset\SPY\X_test.csv', index_col=0)
y = pd.read_csv(r'c:\Users\Raed\Desktop\ai-odissey\smart_investment_ai\data\exported_data\per_asset\SPY\y_test.csv', index_col=0).values.ravel()

print('='*80)
print('FEATURE-TARGET CORRELATION ANALYSIS')
print('='*80)

correlations = []
for col in X.columns:
    corr = np.corrcoef(X[col], y)[0, 1]
    correlations.append((col, corr))

correlations.sort(key=lambda x: abs(x[1]), reverse=True)

print('\nTop 15 strongest correlations:')
for i in range(min(15, len(correlations))):
    feat, corr = correlations[i]
    print(f'  {i+1:2d}. {feat:30s}: {corr:8.6f}')

print(f'\n{"="*80}')
print('CORRELATION SUMMARY:')
print(f'{"="*80}')
print(f'Max |corr|: {abs(correlations[0][1]):.6f}')
print(f'Features with |corr| > 0.10: {sum(1 for c in correlations if abs(c[1]) > 0.10)}')
print(f'Features with |corr| > 0.05: {sum(1 for c in correlations if abs(c[1]) > 0.05)}')
print(f'Features with |corr| > 0.01: {sum(1 for c in correlations if abs(c[1]) > 0.01)}')

print(f'\n{"="*80}')
print('FEATURE VALUE RANGES (checking for leakage):')
print(f'{"="*80}')
print('\nSample of feature values (first 10 rows):')
print(X.head(10))

print(f'\n{"="*80}')
print('CHECKING FOR LOOK-AHEAD BIAS:')
print(f'{"="*80}')
print('\nFeatures that should NOT contain future info:')
suspicious = ['ret_1d', 'target', 'return', 'next']
suspicious_cols = [c for c in X.columns if any(s in c.lower() for s in suspicious)]
if suspicious_cols:
    print(f'⚠️  SUSPICIOUS COLUMNS: {suspicious_cols}')
else:
    print('✓ No obviously suspicious column names')

print(f'\n{"="*80}')
print('REGIME COLUMNS ANALYSIS:')
print(f'{"="*80}')
regime_cols = [c for c in X.columns if 'regime' in c.lower()]
if regime_cols:
    print(f'Regime columns: {regime_cols}')
    for col in regime_cols:
        print(f'\n{col}:')
        print(f'  Mean: {X[col].mean():.6f}')
        print(f'  Std:  {X[col].std():.6f}')
        print(f'  Min:  {X[col].min():.6f}')
        print(f'  Max:  {X[col].max():.6f}')
        print(f'  Correlation with target: {np.corrcoef(X[col], y)[0, 1]:.6f}')
