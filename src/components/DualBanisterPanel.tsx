import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { AlertTriangle, HeartPulse, Layers, ShieldAlert } from 'lucide-react';
import type { DualBanisterResult, InterferenceAnalysis } from '../utils/hybridIntelligence';

interface DualBanisterPanelProps {
  dualBanister: DualBanisterResult;
  interference: InterferenceAnalysis;
}

const LIMITING_COLOR = {
  fresh: 'text-emerald-400',
  balanced: 'text-sky-400',
  cardio: 'text-sky-300',
  muscular: 'text-amber-300',
  both: 'text-rose-400',
} as const;

export const DualBanisterPanel: React.FC<DualBanisterPanelProps> = ({
  dualBanister,
  interference,
}) => {
  const { today, series, limitingFactor, limitingLabel, summary, cardioShare7d, muscularShare7d } =
    dualBanister;

  const formatSigned = (val: number) => `${val >= 0 ? '+' : ''}${Math.round(val)}`;

  return (
    <section
      aria-label="Modèle Dual-Banister hybride et interférences concurrentes"
      className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-5"
    >
      {/* En-tête + facteur limitant */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 pb-3.5 border-b border-white/10">
        <div className="flex items-start gap-2.5">
          <Layers size={18} className="text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h3 className="text-base font-bold text-white leading-snug">
              Dual-Banister Hybride · Cardio vs Musculaire
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Sépare la fatigue centrale cardiovasculaire (SNC / aérobie) de la fatigue périphérique musculaire et tendineuse (force, excentrique, D+ trail).
            </p>
          </div>
        </div>
        <div className="text-left md:text-right shrink-0">
          <div className={`text-xs font-bold uppercase tracking-wider ${LIMITING_COLOR[limitingFactor]}`}>
            {limitingLabel}
          </div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
            7j : {cardioShare7d} % Cardio · {muscularShare7d} % Muscu
          </div>
        </div>
      </div>

      {/* Synthèse KPI tabulaire des deux compartiments */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-3.5 border-b border-white/10">
        <div>
          <div className="text-[11px] text-slate-400 font-medium">TSB Cardio (Central)</div>
          <div
            className={`text-xl font-mono tabular-nums font-bold mt-0.5 ${
              today.cardioTsb <= -20
                ? 'text-rose-400'
                : today.cardioTsb <= -10
                ? 'text-amber-300'
                : 'text-sky-300'
            }`}
          >
            {formatSigned(today.cardioTsb)}
          </div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
            CTL {Math.round(today.cardioCtl)} · ATL {Math.round(today.cardioAtl)}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-slate-400 font-medium">TSB Musculaire (Périph.)</div>
          <div
            className={`text-xl font-mono tabular-nums font-bold mt-0.5 ${
              today.muscTsb <= -20
                ? 'text-rose-400'
                : today.muscTsb <= -10
                ? 'text-amber-300'
                : 'text-emerald-300'
            }`}
          >
            {formatSigned(today.muscTsb)}
          </div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
            CTL {Math.round(today.muscCtl)} · ATL {Math.round(today.muscAtl)}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-slate-400 font-medium">Écart Cardio − Muscu</div>
          <div className="text-xl font-mono tabular-nums font-bold text-white mt-0.5">
            {formatSigned(today.cardioTsb - today.muscTsb)}
          </div>
          <div className="text-[11px] text-slate-400">
            {today.cardioTsb - today.muscTsb >= 8
              ? 'Jambes / tissus plus fatigués'
              : today.cardioTsb - today.muscTsb <= -8
              ? 'Cardio / SNC plus sollicité'
              : 'Profil équilibré'}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-slate-400 font-medium">Interférences (J−2 → J+7)</div>
          <div
            className={`text-xl font-mono tabular-nums font-bold mt-0.5 ${
              interference.criticalCount > 0
                ? 'text-rose-400'
                : interference.warningCount > 0
                ? 'text-amber-300'
                : 'text-emerald-400'
            }`}
          >
            {interference.upcomingConflicts.length}
          </div>
          <div className="text-[11px] text-slate-400">
            {interference.upcomingConflicts.length === 0
              ? 'Aucune collision détectée'
              : `${interference.criticalCount} critique${interference.criticalCount > 1 ? 's' : ''} · ${interference.warningCount} vigilance`}
          </div>
        </div>
      </div>

      {/* Courbe comparée TSB Cardio vs TSB Musculaire */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-4 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-sky-400 inline-block" aria-hidden="true" />
              TSB Cardio
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-400 inline-block" aria-hidden="true" />
              TSB Musculaire
            </span>
          </div>
          <span className="text-[11px] text-slate-400">{summary}</span>
        </div>

        <div className="w-full h-[240px] min-w-0">
          <ResponsiveContainer width="100%" height={240} minWidth={0}>
            <ComposedChart data={series} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
                minTickGap={22}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111116',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
                formatter={(value: unknown, name: unknown) => {
                  const num = typeof value === 'number' ? Math.round(value) : 0;
                  const label = name === 'cardioTsb' ? 'TSB Cardio' : 'TSB Musculaire';
                  return [`${num >= 0 ? '+' : ''}${num}`, label];
                }}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" strokeDasharray="3 3" />
              <ReferenceLine
                x={today.label}
                stroke="rgba(56,189,248,0.5)"
                strokeDasharray="4 4"
              />
              <Line
                type="monotone"
                dataKey="cardioTsb"
                name="cardioTsb"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#38bdf8' }}
              />
              <Line
                type="monotone"
                dataKey="muscTsb"
                name="muscTsb"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#fbbf24' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Liste des interférences concurrentes actives / imminentes */}
      {interference.upcomingConflicts.length > 0 && (
        <div className="pt-3.5 border-t border-white/10 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            <HeartPulse size={14} aria-hidden="true" />
            <span>Collisions concurrentes détectées (0–48 h)</span>
          </div>
          <div className="divide-y divide-white/10">
            {interference.upcomingConflicts.slice(0, 4).map((conflict) => {
              const isCritical = conflict.severity === 'critical';
              return (
                <div key={conflict.id} className="py-2.5 first:pt-1 last:pb-0 flex items-start gap-2.5">
                  {isCritical ? (
                    <ShieldAlert size={15} className="text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 text-xs">
                      <span className={`font-bold ${isCritical ? 'text-rose-300' : 'text-amber-300'}`}>
                        {isCritical ? 'Critique' : 'Vigilance'}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="font-semibold text-white">{conflict.title}</span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-slate-400">{conflict.dateStr}</span>
                      {conflict.isSimulated && (
                        <>
                          <span className="text-slate-600" aria-hidden="true">·</span>
                          <span className="text-purple-300 font-semibold">Simulé</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      {conflict.recommendation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

export default DualBanisterPanel;
