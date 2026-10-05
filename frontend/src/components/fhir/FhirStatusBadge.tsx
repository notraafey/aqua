import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';

export type FhirSyncStatus = 'SYNCHRONIZED' | 'PENDING' | 'FAILED';

interface FhirStatusBadgeProps {
  status?: FhirSyncStatus | string;
  fhirId?: string;
  onViewResource?: () => void;
  className?: string;
  showDetails?: boolean;
}

export const FhirStatusBadge: React.FC<FhirStatusBadgeProps> = ({
  status = 'PENDING',
  fhirId,
  onViewResource,
  className,
  showDetails = true,
}) => {
  const normalizedStatus = (
    fhirId ? 'SYNCHRONIZED' : status.toUpperCase()
  ) as FhirSyncStatus;

  const config = {
    SYNCHRONIZED: {
      label: 'FHIR Synchronized',
      icon: CheckCircle2,
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      iconClass: 'text-emerald-600',
    },
    PENDING: {
      label: 'FHIR Sync Pending',
      icon: Clock,
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
      iconClass: 'text-amber-600',
    },
    FAILED: {
      label: 'FHIR Sync Failed',
      icon: AlertTriangle,
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
      iconClass: 'text-rose-600',
    },
  }[normalizedStatus] || {
    label: 'FHIR Unlinked',
    icon: Clock,
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    iconClass: 'text-slate-400',
  };

  const Icon = config.icon;

  return (
    <div className={clsx('inline-flex items-center gap-2', className)}>
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors',
          config.badgeClass
        )}
        title={fhirId ? `HL7 FHIR R4 Resource: Task/${fhirId}` : config.label}
      >
        <Icon size={13} className={config.iconClass} />
        <span>{config.label}</span>
        {showDetails && fhirId && (
          <span className="font-mono text-[10px] opacity-80 pl-1 border-l border-emerald-300">
            {fhirId.slice(0, 8)}...
          </span>
        )}
      </span>

      {onViewResource && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewResource();
          }}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold transition-colors"
          title="View raw HL7 FHIR R4 Task JSON"
        >
          <ExternalLink size={12} />
          <span>FHIR View</span>
        </button>
      )}
    </div>
  );
};
