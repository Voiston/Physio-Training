import React, { memo } from 'react';
import { Dumbbell, CheckCircle2, Trophy, Clock } from 'lucide-react';
import type { LiveExercise } from '../LiveGymModal';

export interface GymSetHistoryProps {
  exercises: LiveExercise[];
  totalTonnageKg: number;
  totalCompletedSets: number;
  totalPlannedSets: number;
  elapsedSeconds?: number;
  className?: string;
}

function formatTime(secs: number): string {
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
}

export const GymSetHistory = memo(function GymSetHistory({
  exercises,
  totalTonnageKg,
  totalCompletedSets,
  totalPlannedSets,
  elapsedSeconds,
  className = ''
}: GymSetHistoryProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Statistiques clés de la séance */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/20 text-blue-400">
            <Dumbbell size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tonnage total</div>
            <div className="font-mono font-black text-lg text-white tabular-nums">
              {totalTonnageKg.toLocaleString()} <span className="text-xs font-normal text-slate-400">kg</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Séries validées</div>
            <div className="font-mono font-black text-lg text-emerald-300 tabular-nums">
              {totalCompletedSets} <span className="text-xs font-normal text-slate-500">/ {totalPlannedSets}</span>
            </div>
          </div>
        </div>

        {elapsedSeconds !== undefined && (
          <div className="col-span-2 sm:col-span-1 bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Clock size={18} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Temps effectif</div>
              <div className="font-mono font-black text-lg text-indigo-200 tabular-nums">
                {formatTime(elapsedSeconds)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Détail par exercice des séries complétées */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          Historique des séries de la séance
        </div>
        {exercises.map((ex) => {
          const completedSets = ex.sets.filter(s => s.completed);
          if (completedSets.length === 0) return null;

          return (
            <div 
              key={ex.id}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white truncate max-w-[200px] sm:max-w-xs">{ex.name}</span>
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                  {completedSets.length} {completedSets.length > 1 ? 'séries' : 'série'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {completedSets.map((s) => (
                  <span 
                    key={s.id}
                    className="px-2 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] font-mono text-emerald-200"
                  >
                    Set {s.setNumber}: {s.weightKg}kg × {s.reps} (RIR {s.rir})
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default GymSetHistory;
