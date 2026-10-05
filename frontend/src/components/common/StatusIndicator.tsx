import React from 'react';
import { clsx } from 'clsx';

interface StatusIndicatorProps {
  status: 'healthy' | 'warning' | 'critical' | 'neutral' | 'pulse';
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = 'md',
}) => {
  const dotSizes = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';

  const dotColors = {
    healthy: 'bg-emerald-400 shadow-emerald-500/50',
    warning: 'bg-amber-400 shadow-amber-500/50',
    critical: 'bg-rose-500 shadow-rose-500/50',
    neutral: 'bg-slate-500',
    pulse: 'bg-cyan-400 animate-pulse shadow-cyan-500/50',
  };

  return (
    <div className="inline-flex items-center gap-2">
      <span className={clsx('relative flex', dotSizes)}>
        {status === 'pulse' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
        )}
        <span className={clsx('relative inline-flex rounded-full shadow-sm', dotSizes, dotColors[status])}></span>
      </span>
      {label && <span className="text-xs font-medium text-slate-700">{label}</span>}
    </div>
  );
};
