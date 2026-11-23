import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Dumbbell, ShieldAlert } from 'lucide-react';
import type { DailyBriefingResult, DualBanisterResult } from '../utils/hybridIntelligence';

interface TodayBriefingBarProps {
  briefing: DailyBriefingResult;
  dualBanister: DualBanisterResult;
  isSimulationActive?: boolean;
  onOpenBanister: () => void;
  onOpenLiveGym: () => void;
}

const STATUS_STYLES = {
  green: {
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    icon: CheckCircle2,
  },
  amber: {
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    icon: AlertTriangle,
  },
  red: {
    text: 'text-rose-400',
    dot: 'bg-rose-400',
    icon: ShieldAlert,
  },
} as const;

const SIGNAL_TONES = {
  good: 'text-emerald-300',
  warn: 'text-amber-300',
  bad: 'text-rose-300',
  neutral: 'text-slate-300',
} as const;

export const TodayBriefingBar: React.FC<TodayBriefingBarProps> = ({
  briefing,
  dualBanister,
  isSimulationActive = false,
  onOpenBanister,
  onOpenLiveGym,
}) => {
  const style = STATUS_STYLES[briefing.status];
  const StatusIcon = style.icon;

  return (
    <section
      aria-label="Briefing physiologique du jour"
      className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col gap-3"
    >
      {/* Ligne principale : Feu tricolore + 4 signaux tabulaires + actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 shrink-0 ${style.text}`} aria-hidden="true">
            <StatusIcon size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className={`text-xs font-bold uppercase tracking-wider ${style.text}`}>
                {briefing.badgeText}
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <h2 className="text-sm sm:text-base font-bold text-white leading-snug">
                {briefing.headline}
              </h2>
              {isSimulationActive && (
                <>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="text-xs font-semibold text-purple-300">Simulation active</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {briefing.actionTip}
            </p>
          </div>
        </div>

        {/* 4 signaux mesurables en police tabulaire */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:shrink-0 border-t lg:border-t-0 border-white/10 pt-2.5 lg:pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-2">
            {briefing.signals.map((sig) => (
              <div key={sig.label} className="flex flex-col">
                <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                  {sig.label}
                </span>
                <span className={`text-sm font-mono tabular-nums font-bold ${SIGNAL_TONES[sig.tone]}`}>
                  {sig.value}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:pl-3 sm:border-l border-white/10">
            <button
              type="button"
              onClick={onOpenBanister}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Dual-Banister</span>
              <ArrowRight size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onOpenLiveGym}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Dumbbell size={13} aria-hidden="true" />
              <span>Mode Salle</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ligne secondaire intégrée : Interférence concurrente active OU répartition 7j Cardio/Muscu */}
      {briefing.topConflict ? (
        <div className="pt-2.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-start gap-2 text-amber-200 min-w-0">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <span className="font-semibold text-amber-300">
                {briefing.topConflict.title}
                {briefing.activeConflictsCount > 1 ? ` (+${briefing.activeConflictsCount - 1})` : ''}
              </span>
              <span className="text-slate-400"> · {briefing.topConflict.recommendation}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            Équilibre 7j :{' '}
            <strong className="font-mono tabular-nums text-sky-300">{dualBanister.cardioShare7d} % Cardio</strong>
            <span className="mx-1.5 text-slate-500" aria-hidden="true">·</span>
            <strong className="font-mono tabular-nums text-amber-300">{dualBanister.muscularShare7d} % Musculaire</strong>
          </span>
          <span className="text-slate-400">{dualBanister.limitingLabel}</span>
        </div>
      )}
    </section>
  );
};

export default TodayBriefingBar;
