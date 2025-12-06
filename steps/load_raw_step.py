# steps/load_raw_step.py
# ADVANCED DATA LOADER with Alternative Data Support

from typing import List, Dict, Tuple, Optional
import pandas as pd
import yfinance as yf
from fredapi import Fred
from zenml import step
import warnings
import os
warnings.filterwarnings('ignore')

# FRED API Configuration
# SECURITY: API key should be in environment variable, not hardcoded
# Original hardcoded key removed for security: FRED_API_KEY = "****************************" (Line 13)
FRED_API_KEY = os.getenv("FRED_API_KEY", "")
if not FRED_API_KEY:
    print("WARNING: FRED_API_KEY not set. Alternative data features will be limited.")
    print("Set FRED_API_KEY environment variable to enable FRED data fetching.")
    fred = None
else:
    fred = Fred(api_key=FRED_API_KEY)


def fetch_vix_data(start_date: str, end_date: str) -> pd.DataFrame:
    """Fetch VIX (Volatility Index) data from FRED."""
    try:
        print("  Fetching VIX (Volatility Index) from FRED...")
        vix = fred.get_series("VIXCLS", observation_start=start_date, observation_end=end_date)
        if not vix.empty:
            return vix.to_frame(name='VIX')
    except Exception as e:
        print(f"  ⚠️  Failed to fetch VIX from FRED: {e}")
        # Fallback to yfinance
        try:
            print("  Trying yfinance as fallback...")
            vix = yf.download("^VIX", start=start_date, end=end_date, progress=False)
            if not vix.empty and 'Close' in vix.columns:
                return vix[['Close']].rename(columns={'Close': 'VIX'})
        except Exception as e2:
            print(f"  ⚠️  Fallback also failed: {e2}")
    return pd.DataFrame()


def fetch_treasury_yields(start_date: str, end_date: str) -> pd.DataFrame:
    """Fetch Treasury yield data from FRED (10Y, 2Y, yield curve)."""
    try:
        print("  Fetching Treasury yields from FRED...")
        yields = pd.DataFrame()
        
        # 10-Year Treasury Constant Maturity Rate
        try:
            dgs10 = fred.get_series("DGS10", observation_start=start_date, observation_end=end_date)
            if not dgs10.empty:
                yields['YIELD_10Y'] = dgs10
        except Exception as e:
            print(f"    ⚠️  Failed to fetch 10Y yield: {e}")
        
        # 2-Year Treasury Constant Maturity Rate
        try:
            dgs2 = fred.get_series("DGS2", observation_start=start_date, observation_end=end_date)
            if not dgs2.empty:
                yields['YIELD_2Y'] = dgs2
        except Exception as e:
            print(f"    ⚠️  Failed to fetch 2Y yield: {e}")
        
        # Calculate yield curve spread
        if 'YIELD_10Y' in yields.columns and 'YIELD_2Y' in yields.columns:
            yields['YIELD_CURVE'] = yields['YIELD_10Y'] - yields['YIELD_2Y']
        
        return yields
    except Exception as e:
        print(f"  ⚠️  Failed to fetch Treasury yields from FRED: {e}")
    return pd.DataFrame()


def fetch_dollar_index(start_date: str, end_date: str) -> pd.DataFrame:
    """Fetch US Dollar Index from FRED."""
    try:
        print("  Fetching Dollar Index from FRED...")
        # Trade Weighted U.S. Dollar Index: Broad, Goods and Services
        dxy = fred.get_series("DTWEXBGS", observation_start=start_date, observation_end=end_date)
        if not dxy.empty:
            return dxy.to_frame(name='DXY')
    except Exception as e:
        print(f"  ⚠️  Failed to fetch Dollar Index from FRED: {e}")
    return pd.DataFrame()


def fetch_commodities(start_date: str, end_date: str) -> pd.DataFrame:
    """Fetch commodity prices from FRED (Gold, Oil)."""
    try:
        print("  Fetching commodities from FRED...")
        commodities = pd.DataFrame()
        
        # Gold Fixing Price (London PM, USD per Troy Ounce)
        try:
            gold = fred.get_series("GOLDPMGBD228NLBM", observation_start=start_date, observation_end=end_date)
            if not gold.empty:
                commodities['GOLD'] = gold
        except Exception as e:
            print(f"    ⚠️  Failed to fetch Gold: {e}")
        
        # Crude Oil Prices: West Texas Intermediate (WTI)
        try:
            oil = fred.get_series("DCOILWTICO", observation_start=start_date, observation_end=end_date)
            if not oil.empty:
                commodities['OIL'] = oil
        except Exception as e:
            print(f"    ⚠️  Failed to fetch Oil: {e}")
        
        return commodities
    except Exception as e:
        print(f"  ⚠️  Failed to fetch commodities from FRED: {e}")
    return pd.DataFrame()


def fetch_market_breadth(start_date: str, end_date: str) -> pd.DataFrame:
    """Fetch market breadth indicators (small cap Russell 2000 from yfinance)."""
    try:
        print("  Fetching market breadth indicators...")
        breadth = pd.DataFrame()
        iwm = yf.download("IWM", start=start_date, end=end_date, progress=False)
        if not iwm.empty and 'Close' in iwm.columns:
            breadth['SMALL_CAP'] = iwm['Close']
        return breadth
    except Exception as e:
        print(f"  ⚠️  Failed to fetch market breadth: {e}")
    return pd.DataFrame()


@step
def load_raw_data(
    tickers: List[str],
    start_date: str,
    end_date: str,
    include_alternative_data: bool = True,
) -> Tuple[pd.DataFrame, Dict[str, List[str]], Optional[pd.DataFrame]]:
    """Advanced data loader with OHLCV + optional alternative/macro features."""

    print("\n" + "="*80)
    print("ADVANCED DATA LOADING")
    print("="*80)

    print(f"\nConfiguration:")
    print(f"  Tickers: {tickers}")
    print(f"  Date range: {start_date} to {end_date}")
    print(f"  Alternative data: {'Enabled' if include_alternative_data else 'Disabled'}")

    # -----------------------------
    # 1. Download main asset data
    # -----------------------------
    print("\n" + "-"*80)
    print("DOWNLOADING MAIN ASSET DATA")
    print("-"*80)

    df = yf.download(
        tickers=tickers,
        start=start_date,
        end=end_date,
        auto_adjust=False,
        progress=False,
        threads=True
    )

    if df.empty:
        raise ValueError("❌ Downloaded data is empty. Check tickers and dates.")

    df = df.sort_index()

    # Detect price types
    if isinstance(df.columns, pd.MultiIndex):
        price_types = df.columns.get_level_values(0).unique().tolist()
    else:
        price_types = []

    # -----------------------------
    # 2. Data quality checks
    # -----------------------------
    if isinstance(df.columns, pd.MultiIndex) and 'Close' in df.columns.get_level_values(0):
        completeness = {}
        for ticker in tickers:
            if ticker in df['Close'].columns:
                non_null = df['Close'][ticker].notna().sum()
                completeness[ticker] = non_null / len(df) * 100
        print(f"\nData completeness (% of trading days with valid Close prices):")
        for ticker, pct in sorted(completeness.items(), key=lambda x: x[1]):
            status = "✅" if pct > 95 else "⚠️"
            print(f"  {status} {ticker}: {pct:.1f}%")

    # -----------------------------
    # 3. Fetch alternative data
    # -----------------------------
    alternative_data = None
    alternative_features: List[str] = []

    if include_alternative_data:
        print("\n" + "-"*80)
        print("FETCHING ALTERNATIVE DATA")
        print("-"*80)

        alt_data_sources = []

        # Fetch each alternative source
        vix = fetch_vix_data(start_date, end_date)
        if not vix.empty:
            alt_data_sources.append(vix)
            alternative_features.append("VIX")

        yields = fetch_treasury_yields(start_date, end_date)
        if not yields.empty:
            alt_data_sources.append(yields)
            alternative_features.extend(list(yields.columns))

        dxy = fetch_dollar_index(start_date, end_date)
        if not dxy.empty:
            alt_data_sources.append(dxy)
            alternative_features.append("DXY")

        commodities = fetch_commodities(start_date, end_date)
        if not commodities.empty:
            alt_data_sources.append(commodities)
            alternative_features.extend(list(commodities.columns))

        breadth = fetch_market_breadth(start_date, end_date)
        if not breadth.empty:
            alt_data_sources.append(breadth)
            alternative_features.extend(list(breadth.columns))

        if alt_data_sources:
            alternative_data = pd.concat(alt_data_sources, axis=1).sort_index()

    # -----------------------------
    # 4. Metadata
    # -----------------------------
    metadata = {
        "tickers": tickers,
        "price_types": price_types,
        "alternative_features": alternative_features
    }

    # -----------------------------
    # 5. Summary
    # -----------------------------
    print("\n" + "="*80)
    print("DATA LOADING COMPLETE")
    print("="*80)
    print(f"\nMain Asset Data: {len(tickers)} tickers, {len(df)} trading days")
    if alternative_data is not None:
        print(f"Alternative Data: {len(alternative_features)} features, {len(alternative_data)} trading days")
    print("\n" + "="*80 + "\n")

    return df, metadata, alternative_data
