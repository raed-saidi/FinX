'use client';

import Image from 'next/image';
import { useState } from 'react';

// Stock logo URLs from various free APIs and CDNs
const LOGO_SOURCES = {
  // Primary: Logo.dev (free tier available)
  logodev: (symbol: string) => `https://img.logo.dev/ticker/${symbol}?token=pk_X-1ZO13GSgeOoUrIuJ6GMQ`,
  // Fallback 1: Clearbit (works for company domains)
  clearbit: (symbol: string) => {
    const domains: Record<string, string> = {
      'AAPL': 'apple.com',
      'GOOGL': 'google.com',
      'GOOG': 'google.com',
      'MSFT': 'microsoft.com',
      'AMZN': 'amazon.com',
      'META': 'meta.com',
      'TSLA': 'tesla.com',
      'NVDA': 'nvidia.com',
      'AMD': 'amd.com',
      'INTC': 'intel.com',
      'NFLX': 'netflix.com',
      'DIS': 'disney.com',
      'PYPL': 'paypal.com',
      'V': 'visa.com',
      'MA': 'mastercard.com',
      'JPM': 'jpmorganchase.com',
      'BAC': 'bankofamerica.com',
      'WMT': 'walmart.com',
      'PG': 'pg.com',
      'JNJ': 'jnj.com',
      'UNH': 'unitedhealthgroup.com',
      'HD': 'homedepot.com',
      'KO': 'coca-cola.com',
      'PEP': 'pepsico.com',
      'MRK': 'merck.com',
      'ABBV': 'abbvie.com',
      'CVX': 'chevron.com',
      'XOM': 'exxonmobil.com',
      'LLY': 'lilly.com',
      'AVGO': 'broadcom.com',
      'COST': 'costco.com',
      'TMO': 'thermofisher.com',
      'MCD': 'mcdonalds.com',
      'CSCO': 'cisco.com',
      'ACN': 'accenture.com',
      'ABT': 'abbott.com',
      'DHR': 'danaher.com',
      'CMCSA': 'comcast.com',
      'VZ': 'verizon.com',
      'ADBE': 'adobe.com',
      'CRM': 'salesforce.com',
      'NKE': 'nike.com',
      'PFE': 'pfizer.com',
      'ORCL': 'oracle.com',
      'TXN': 'ti.com',
      'QCOM': 'qualcomm.com',
      'SPY': 'ssga.com',
      'QQQ': 'invesco.com',
      'IWM': 'ishares.com',
      'VOO': 'vanguard.com',
      'BRK.B': 'berkshirehathaway.com',
      'COIN': 'coinbase.com',
      'SQ': 'squareup.com',
      'SHOP': 'shopify.com',
      'UBER': 'uber.com',
      'LYFT': 'lyft.com',
      'SNAP': 'snap.com',
      'TWTR': 'twitter.com',
      'PINS': 'pinterest.com',
      'ZM': 'zoom.us',
      'DOCU': 'docusign.com',
      'PLTR': 'palantir.com',
      'SNOW': 'snowflake.com',
      'NET': 'cloudflare.com',
      'CRWD': 'crowdstrike.com',
      'ZS': 'zscaler.com',
      'DDOG': 'datadoghq.com',
      'MDB': 'mongodb.com',
      'OKTA': 'okta.com',
    };
    const domain = domains[symbol.toUpperCase()];
    return domain ? `https://logo.clearbit.com/${domain}` : null;
  },
  // Fallback 2: Financial Modeling Prep (limited free tier)
  fmp: (symbol: string) => `https://financialmodelingprep.com/image-stock/${symbol}.png`,
};

// Color mappings for fallback display
const STOCK_COLORS: Record<string, { bg: string; text: string }> = {
  'AAPL': { bg: 'bg-neutral-800', text: 'text-white' },
  'GOOGL': { bg: 'bg-blue-500', text: 'text-white' },
  'GOOG': { bg: 'bg-blue-500', text: 'text-white' },
  'MSFT': { bg: 'bg-blue-600', text: 'text-white' },
  'AMZN': { bg: 'bg-orange-500', text: 'text-white' },
  'META': { bg: 'bg-blue-500', text: 'text-white' },
  'TSLA': { bg: 'bg-red-600', text: 'text-white' },
  'NVDA': { bg: 'bg-green-600', text: 'text-white' },
  'AMD': { bg: 'bg-red-700', text: 'text-white' },
  'INTC': { bg: 'bg-blue-600', text: 'text-white' },
  'NFLX': { bg: 'bg-red-600', text: 'text-white' },
  'DIS': { bg: 'bg-blue-700', text: 'text-white' },
  'PYPL': { bg: 'bg-blue-700', text: 'text-white' },
  'V': { bg: 'bg-blue-800', text: 'text-yellow-400' },
  'MA': { bg: 'bg-red-600', text: 'text-yellow-400' },
  'JPM': { bg: 'bg-blue-900', text: 'text-white' },
  'SPY': { bg: 'bg-green-700', text: 'text-white' },
  'QQQ': { bg: 'bg-purple-600', text: 'text-white' },
  'COIN': { bg: 'bg-blue-600', text: 'text-white' },
};

interface StockLogoProps {
  symbol: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallback?: boolean;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[8px]',
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-base',
};

const imageSizes = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

export default function StockLogo({ symbol, size = 'md', className = '', showFallback = true }: StockLogoProps) {
  const [imageError, setImageError] = useState(false);
  const [currentSource, setCurrentSource] = useState<'logodev' | 'clearbit' | 'fmp' | 'fallback'>('logodev');
  
  // Guard against undefined symbol
  if (!symbol) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-gray-600 flex items-center justify-center ${className}`}>
        <span className="text-white font-bold" style={{ fontSize: imageSizes[size] * 0.4 }}>?</span>
      </div>
    );
  }
  
  const upperSymbol = symbol.toUpperCase();
  const sizeClass = sizeClasses[size];
  const imgSize = imageSizes[size];
  
  const colors = STOCK_COLORS[upperSymbol] || { bg: 'bg-gray-600', text: 'text-white' };
  
  const handleImageError = () => {
    if (currentSource === 'logodev') {
      // Try clearbit
      const clearbitUrl = LOGO_SOURCES.clearbit(upperSymbol);
      if (clearbitUrl) {
        setCurrentSource('clearbit');
        return;
      }
      setCurrentSource('fmp');
    } else if (currentSource === 'clearbit') {
      setCurrentSource('fmp');
    } else {
      setImageError(true);
      setCurrentSource('fallback');
    }
  };
  
  const getLogoUrl = () => {
    switch (currentSource) {
      case 'logodev':
        return LOGO_SOURCES.logodev(upperSymbol);
      case 'clearbit':
        return LOGO_SOURCES.clearbit(upperSymbol) || LOGO_SOURCES.fmp(upperSymbol);
      case 'fmp':
        return LOGO_SOURCES.fmp(upperSymbol);
      default:
        return null;
    }
  };
  
  // If all logo sources failed, show fallback
  if (imageError || currentSource === 'fallback') {
    if (!showFallback) return null;
    
    return (
      <div 
        className={`${sizeClass} ${colors.bg} ${colors.text} rounded flex items-center justify-center font-bold ${className}`}
      >
        {upperSymbol.substring(0, 2)}
      </div>
    );
  }
  
  const logoUrl = getLogoUrl();
  
  return (
    <div className={`${sizeClass} rounded overflow-hidden flex items-center justify-center bg-white ${className}`}>
      <img
        src={logoUrl || ''}
        alt={`${upperSymbol} logo`}
        width={imgSize}
        height={imgSize}
        className="w-full h-full object-contain"
        onError={handleImageError}
        loading="lazy"
      />
    </div>
  );
}

// Export utility function to get logo URL directly
export function getStockLogoUrl(symbol: string): string {
  return LOGO_SOURCES.logodev(symbol.toUpperCase());
}
