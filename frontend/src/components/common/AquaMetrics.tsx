import React from 'react';
import { ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

export type MetricColor = 'red' | 'blue' | 'emerald' | 'purple' | 'slate' | 'amber';

export interface AquaMetricCardProps {
  icon: React.ReactNode;
  color?: MetricColor;
  title: string;
  value: string | number;
  subtitle: string;
  onClick?: () => void;
  className?: string;
}

const colorMap: Record<MetricColor, { bg: string; iconColor: string; valueColor: string }> = {
  red: {
    bg: 'bg-red-50 text-red-600',
    iconColor: 'text-red-500',
    valueColor: 'text-red-600',
  },
  blue: {
    bg: 'bg-blue-50 text-blue-600',
    iconColor: 'text-blue-500',
    valueColor: 'text-slate-900',
  },
  emerald: {
    bg: 'bg-emerald-50 text-emerald-600',
    iconColor: 'text-emerald-500',
    valueColor: 'text-emerald-600',
  },
  purple: {
    bg: 'bg-purple-50 text-purple-600',
    iconColor: 'text-purple-500',
    valueColor: 'text-slate-900',
  },
  slate: {
    bg: 'bg-slate-100 text-slate-600',
    iconColor: 'text-slate-500',
    valueColor: 'text-slate-900',
  },
  amber: {
    bg: 'bg-amber-50 text-amber-600',
    iconColor: 'text-amber-500',
    valueColor: 'text-amber-700',
  },
};

export const AquaMetricCard: React.FC<AquaMetricCardProps> = ({
  icon,
  color = 'blue',
  title,
  value,
  subtitle,
  onClick,
  className,
}) => {
  const c = colorMap[color];

  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:border-slate-300',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center', c.bg)}>
            {icon}
          </div>
          <span className="text-xs font-medium text-slate-500">{title}</span>
        </div>
        {onClick && <ChevronRight size={16} className="text-slate-400 mt-1" />}
      </div>
      <div className="mt-4">
        <div className={clsx('text-2xl font-bold tracking-tight', c.valueColor)}>{value}</div>
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      </div>
    </div>
  );
};
