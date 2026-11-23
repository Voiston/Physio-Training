import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Award, Dumbbell, TrendingUp } from 'lucide-react';
import type { DualBanisterResult, StrengthProgressionSummary } from '../utils/hybridIntelligence';

interface StrengthProgressPanelProps {
  progression: StrengthProgressionSummary;
  dualBanister?: DualBanisterResult;
  onOpenLiveGym?: () => void;
}

export const StrengthProgressPanel: React.FC<StrengthProgressPanelProps> = ({
  progression,
  dualBanister,
  onOpenLiveGym,
}) => {
  const [selectedKey, setSelectedKey] = useState<string>('');

  const activeExercise = useMemo(() => {
    if (progression.exercises.length === 0) return null;
    return (
      progression.exercises.find((e) => e.exerciseKey === selectedKey) ||
      progression.exercises[0]
    );
  }, [progression.exercises, selectedKey]);

  if (progression.exercises.length === 0 || !activeExercise) {
    return (
      <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center gap-3">
        <Dumbbell size={26} className="text-emerald-400" aria-hidden="true" />
        <h3 className="text-base font-bold text-white">
          Suivi longitudinal de la force (e1RM ajusté au RIR)
        </h3>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed">
          Enregistrez vos exercices avec charge (kg × reps + RIR) dans le Mode Salle ou dans l’éditeur de séance pour suivre automatiquement l’évolution de votre 1RM estimé et détecter vos records personnels.
        </p>
        {onOpenLiveGym && (
          <button
            type="button"
            onClick={onOpenLiveGym}
            className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs sm:text-sm font-bold text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Dumbbell size={15} aria-hidden="true" />
            <span>Démarrer une séance en Mode Salle</span>
          </button>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label="Progression longitudinale de la force et e1RM"
      className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-5"
    >
      {/* En-tête + sélecteur d'exercice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/10">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp size={17} className="text-emerald-400" aria-hidden="true" />
            <span>Progression Force & e1RM (ajusté RIR)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {progression.totalStrengthSessions} séance{progression.totalStrengthSessions > 1 ? 's' : ''} détaillée{progression.totalStrengthSessions > 1 ? 's' : ''} · {progression.exercises.length} exercice{progression.exercises.length > 1 ? 's' : ''} suivi{progression.exercises.length > 1 ? 's' : ''} · {progression.totalPRCount} record{progression.totalPRCount > 1 ? 's' : ''} détecté{progression.totalPRCount > 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="strength-exercise-select" className="sr-only">
            Choisir un exercice
          </label>
          <select
            id="strength-exercise-select"
            value={activeExercise.exerciseKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="bg-[#121218] border border-white/15 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
          >
            {progression.exercises.map((ex) => (
              <option key={ex.exerciseKey} value={ex.exerciseKey}>
                {ex.exerciseName} ({ex.bestE1RM} kg · {ex.sessionCount}×)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI tabulaires de l'exercice sélectionné */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-3.5 border-b border-white/10">
        <div>
          <div className="text-[11px] text-slate-400 font-medium">Record e1RM</div>
          <div className="text-xl font-mono tabular-nums font-bold text-emerald-400 mt-0.5">
            {activeExercise.bestE1RM} kg
          </div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
            {activeExercise.bestSetLabel}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-slate-400 font-medium">Dernier e1RM</div>
          <div className="text-xl font-mono tabular-nums font-bold text-white mt-0.5">
            {activeExercise.currentE1RM} kg
          </div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
            Séance du {activeExercise.lastDateStr}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-slate-400 font-medium">Progression historique</div>
          <div
            className={`text-xl font-mono tabular-nums font-bold mt-0.5 ${
              activeExercise.deltaPercent === null
                ? 'text-slate-400'
                : activeExercise.deltaPercent >= 0
                ? 'text-emerald-400'
                : 'text-amber-300'
            }`}
          >
            {activeExercise.deltaPercent === null
              ? '—'
              : `${activeExercise.deltaPercent >= 0 ? '+' : ''}${activeExercise.deltaPercent} %`}
          </div>
          <div className="text-[11px] text-slate-400">
            Sur {activeExercise.sessionCount} séance{activeExercise.sessionCount > 1 ? 's' : ''}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-slate-400 font-medium">Contexte hybride actuel</div>
          <div className="text-xl font-mono tabular-nums font-bold text-sky-300 mt-0.5">
            {dualBanister ? `CTL ${Math.round(dualBanister.today.cardioCtl)}` : '—'}
          </div>
          <div className="text-[11px] text-slate-400">
            {dualBanister
              ? `TSB Muscu ${dualBanister.today.muscTsb >= 0 ? '+' : ''}${Math.round(dualBanister.today.muscTsb)}`
              : 'Charge cardio chronique'}
          </div>
        </div>
      </div>

      {/* Courbe e1RM */}
      <div className="w-full h-[240px] min-w-0">
        <ResponsiveContainer width="100%" height={240} minWidth={0}>
          <LineChart data={activeExercise.points} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              unit=" kg"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111116',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#f8fafc',
              }}
              formatter={(value: unknown) => [`${value} kg`, 'e1RM estimé']}
            />
            <Line
              type="monotone"
              dataKey="e1rm"
              stroke="#34d399"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#34d399', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#6ee7b7' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tableau des derniers PRs */}
      {progression.recentPRs.length > 0 && (
        <div className="pt-3.5 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2">
            <Award size={14} aria-hidden="true" />
            <span>Derniers records personnels (PR e1RM)</span>
          </div>
          <div className="divide-y divide-white/10">
            {progression.recentPRs.map((pr, idx) => (
              <div
                key={`${pr.exerciseName}_${pr.dateStr}_${idx}`}
                className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-white truncate">{pr.exerciseName}</span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="text-slate-400 font-mono tabular-nums">{pr.setLabel}</span>
                </div>
                <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                  <span className="text-emerald-400 font-bold">{pr.e1rm} kg</span>
                  <span className="text-slate-500">{pr.dateStr}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default StrengthProgressPanel;
