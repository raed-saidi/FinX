"""Analyze model predictions for realism check."""
import pandas as pd
import numpy as np

assets = ['AAPL', 'NVDA', 'SPY', 'TSLA', 'META', 'MSFT', 'GOOGL', 'AMD']

print('='*70)
print('MODEL PREDICTION ANALYSIS - Reality Check')
print('='*70)

all_preds = []
all_true = []

for asset in assets:
    df = pd.read_csv(f'models/xgboost_walkforward/{asset}_oos_predictions.csv', parse_dates=['date'])
    
    pred_mean = df['pred'].mean() * 100
    pred_std = df['pred'].std() * 100
    true_mean = df['true'].mean() * 100
    true_std = df['true'].std() * 100
    corr = df['pred'].corr(df['true'])
    
    # Directional accuracy
    dir_acc = ((df['pred'] > 0) == (df['true'] > 0)).mean() * 100
    
    print(f'\n{asset}:')
    print(f'  Predicted 5-day return: {pred_mean:+.2f}% ± {pred_std:.2f}%')
    print(f'  Actual 5-day return:    {true_mean:+.2f}% ± {true_std:.2f}%')
    print(f'  Correlation:            {corr:.3f}')
    print(f'  Directional accuracy:   {dir_acc:.1f}%')
    
    all_preds.extend(df['pred'].values)
    all_true.extend(df['true'].values)

print('\n' + '='*70)
print('OVERALL STATISTICS')
print('='*70)

all_preds = np.array(all_preds)
all_true = np.array(all_true)

print(f'\nPredictions:')
print(f'  Range: {all_preds.min()*100:.2f}% to {all_preds.max()*100:.2f}%')
print(f'  Mean:  {all_preds.mean()*100:.2f}%')
print(f'  Std:   {all_preds.std()*100:.2f}%')

print(f'\nActual Returns:')
print(f'  Range: {all_true.min()*100:.2f}% to {all_true.max()*100:.2f}%')
print(f'  Mean:  {all_true.mean()*100:.2f}%')
print(f'  Std:   {all_true.std()*100:.2f}%')

print(f'\nCorrelation (all): {np.corrcoef(all_preds, all_true)[0,1]:.3f}')
dir_acc_all = ((all_preds > 0) == (all_true > 0)).mean() * 100
print(f'Directional accuracy (all): {dir_acc_all:.1f}%')

# Check if predictions are too narrow (overconfident) or too wide
pred_range = all_preds.std()
true_range = all_true.std()
print(f'\nPrediction calibration: {pred_range/true_range:.2f}x actual volatility')

print('\n' + '='*70)
print('REALITY CHECK VERDICT')
print('='*70)

# Assess realism
issues = []
if abs(all_preds.mean() - all_true.mean()) > 0.005:
    issues.append(f'Mean bias: predictions avg {all_preds.mean()*100:.2f}% vs actual {all_true.mean()*100:.2f}%')
    
if pred_range/true_range < 0.3:
    issues.append('Predictions too narrow (overconfident)')
elif pred_range/true_range > 1.5:
    issues.append('Predictions too wide (underconfident)')

if dir_acc_all < 52:
    issues.append(f'Directional accuracy ({dir_acc_all:.1f}%) barely better than random (50%)')

corr_overall = np.corrcoef(all_preds, all_true)[0,1]
if corr_overall < 0.05:
    issues.append(f'Very weak correlation ({corr_overall:.3f}) - predictions may be noise')

if issues:
    print('\n⚠️  CONCERNS:')
    for issue in issues:
        print(f'  - {issue}')
else:
    print('\n✅ Predictions appear realistic!')

print('\n📊 INTERPRETATION:')
if corr_overall > 0.1:
    print(f'  - Correlation of {corr_overall:.3f} is GOOD for financial predictions')
    print(f'  - Even 0.05-0.10 correlation can generate significant alpha')
if dir_acc_all > 52:
    print(f'  - {dir_acc_all:.1f}% directional accuracy is meaningful edge')
    print(f'  - 52-55% accuracy can be highly profitable with proper sizing')
