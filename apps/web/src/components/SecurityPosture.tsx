'use client';

import { Lock, ShieldAlert, ShieldCheck } from 'lucide-react';

interface SecurityPostureProps {
  /** Agent-reported Windows Firewall state; null when the agent never reported it. */
  firewallEnabled: boolean | null;
  /** Agent-reported antivirus/defender state; null when never reported. */
  antivirusEnabled: boolean | null;
  /** `card` renders a standalone panel, `pills` renders inline chips for dense lists. */
  variant?: 'card' | 'pills';
}

function StatusChip({ label, enabled, compact = false }: { label: string; enabled: boolean | null; compact?: boolean }) {
  const base = `inline-flex items-center gap-1.5 border rounded-md font-medium ${
    compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
  }`;

  if (enabled === null) {
    return (
      <span className={`${base} bg-slate-50 border-slate-200 text-slate-500`} title={`${label} state not reported by the agent`}>
        <Lock className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        {label}: Not reported
      </span>
    );
  }

  if (enabled) {
    return (
      <span className={`${base} bg-emerald-50 border-emerald-200 text-emerald-700`}>
        <ShieldCheck className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        {label}: On
      </span>
    );
  }

  return (
    <span className={`${base} bg-rose-50 border-rose-200 text-rose-700`}>
      <ShieldAlert className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {label}: Off
    </span>
  );
}

export function SecurityPosture({ firewallEnabled, antivirusEnabled, variant = 'card' }: SecurityPostureProps) {
  const chips = (
    <>
      <StatusChip label="Firewall" enabled={firewallEnabled} compact={variant === 'pills'} />
      <StatusChip label="Antivirus" enabled={antivirusEnabled} compact={variant === 'pills'} />
    </>
  );

  if (variant === 'pills') {
    return <span className="inline-flex items-center gap-1.5 flex-wrap">{chips}</span>;
  }

  const failing = firewallEnabled === false || antivirusEnabled === false;

  return (
    <section className="rounded-lg bg-white border border-slate-200 shadow-xs p-4" aria-label="Security posture">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`p-1.5 rounded-md border ${
              failing ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-blue-50 border-blue-200 text-blue-600'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Security Posture</div>
            <div className="text-[11px] text-slate-400">Reported by the endpoint agent on each heartbeat</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">{chips}</div>
      </div>
    </section>
  );
}
