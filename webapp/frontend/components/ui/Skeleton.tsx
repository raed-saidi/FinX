'use client';

import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'circular' | 'text';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className = '', variant = 'default', width, height }: SkeletonProps) {
  const baseClasses = 'bg-muted animate-pulse';
  
  const variantClasses = {
    default: 'rounded',
    circular: 'rounded-full',
    text: 'rounded-md',
  };

  const style = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1rem' : '100%'),
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

// Card skeleton for dashboard cards
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-card border border-border rounded p-5 ${className}`}>
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" height={14} />
          <Skeleton variant="text" width="40%" height={20} />
        </div>
      </div>
    </div>
  );
}

// Chart skeleton
export function ChartSkeleton({ height = 400 }: { height?: number }) {
  return (
    <div className="bg-card border border-border rounded p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="space-y-2">
            <Skeleton variant="text" width={100} height={16} />
            <Skeleton variant="text" width={60} height={12} />
          </div>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={50} height={32} />
          ))}
        </div>
      </div>
      <Skeleton height={height - 100} className="mt-4" />
    </div>
  );
}

// Table skeleton
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card border border-border rounded overflow-hidden">
      <div className="p-4 border-b border-border">
        <Skeleton variant="text" width={150} height={20} />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <Skeleton variant="circular" width={40} height={40} />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" width="30%" height={14} />
              <Skeleton variant="text" width="20%" height={12} />
            </div>
            <Skeleton variant="text" width={80} height={16} />
            <Skeleton variant="text" width={60} height={16} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Stats grid skeleton
export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// Portfolio card skeleton
export function PortfolioCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-gray-600/50 to-gray-800/50 rounded p-8">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="space-y-2">
          <Skeleton variant="text" width={120} height={14} className="bg-white/20" />
          <Skeleton variant="text" width={180} height={28} className="bg-white/20" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white/10 rounded p-4">
            <Skeleton variant="text" width="80%" height={12} className="bg-white/20 mb-2" />
            <Skeleton variant="text" width="60%" height={20} className="bg-white/20" />
          </div>
        ))}
      </div>
      <div className="flex gap-4">
        <Skeleton width={140} height={48} className="bg-white/20" />
        <Skeleton width={140} height={48} className="bg-white/20" />
      </div>
    </div>
  );
}
