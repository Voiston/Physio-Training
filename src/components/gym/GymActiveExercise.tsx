import { memo } from 'react';
import { Trash2, Sparkles, Check, Plus, X } from 'lucide-react';
import type { LiveExercise, LiveSet } from '../LiveGymModal';
import type { computeAdaptiveProgression } from '../../utils/muscleHelpers';

export interface GymActiveExerciseProps {
  exercise: LiveExercise;
  exerciseIndex: number;
  adaptiveSuggestion?: ReturnType<typeof computeAdaptiveProgression>;
  onUpdateSetValue: (exIdx: number, sIdx: number, field: keyof LiveSet, value: any) => void;
  onQuickAdjustWeight: (exIdx: number, sIdx: number, delta: number) => void;
  onQuickAdjustReps: (exIdx: number, sIdx: number, delta: number) => void;
  onValidateSet: (exIdx: number, sIdx: number) => void;
  onRemoveSet: (exIdx: number, sIdx: number) => void;
  onAddSet: (exIdx: number) => void;
  onRemoveExercise: (exIdx: number) => void;
  onApplyAdaptiveSuggestion: (exIdx: number) => void;
}

export const GymActiveExercise = memo(function GymActiveExercise({
  exercise,
  exerciseIndex,
  adaptiveSuggestion,
  onUpdateSetValue,
  onQuickAdjustWeight,
  onQuickAdjustReps,
  onValidateSet,
  onRemoveSet,
  onAddSet,
  onRemoveExercise,
  onApplyAdaptiveSuggestion
}: GymActiveExerciseProps) {
  const completedSetsCount = exercise.sets.filter(s => s.completed).length;

  return (
    <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
      {/* Header de l'exercice */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-700/50 pb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-base sm:text-lg text-white tracking-tight truncate">
              {exercise.name}
            </h3>
            {exercise.category && (
              <span className="px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                {exercise.category === 'lower' ? 'Bas' : exercise.category === 'upper_push' ? 'Push' : exercise.category === 'upper_pull' ? 'Pull' : 'Core'}
              </span>
            )}
          </div>

          {/* Suggestion adaptative si historique */}
          {adaptiveSuggestion && adaptiveSuggestion.hasHistory && (
            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 border ${
                adaptiveSuggestion.status === 'increase'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : adaptiveSuggestion.status === 'decrease'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              }`}>
                <Sparkles size={11} />
                {adaptiveSuggestion.status === 'increase' ? 'Cible +' : adaptiveSuggestion.status === 'decrease' ? 'Décharge' : 'Maintien'} : 
                {adaptiveSuggestion.suggestedWeightKg ? ` ${adaptiveSuggestion.suggestedWeightKg} kg` : ''} 
                {adaptiveSuggestion.suggestedReps ? ` × ${adaptiveSuggestion.suggestedReps} reps` : ''} 
                (RIR {adaptiveSuggestion.suggestedRir})
              </span>
              <span className="text-[11px] text-slate-400">
                Précédent : {adaptiveSuggestion.lastWeightKg ? `${adaptiveSuggestion.lastWeightKg} kg` : ''} {adaptiveSuggestion.lastReps ? `× ${adaptiveSuggestion.lastReps}` : ''} ({adaptiveSuggestion.lastRir} RIR le {adaptiveSuggestion.lastDate})
              </span>
              <button
                type="button"
                onClick={() => onApplyAdaptiveSuggestion(exerciseIndex)}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-bold cursor-pointer"
              >
                Appliquer à cet exercice
              </button>
            </div>
          )}
        </div>

        {/* Supprimer exercice */}
        <button
          type="button"
          onClick={() => onRemoveExercise(exerciseIndex)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          title="Retirer cet exercice"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* TABLEAU / CARTES DES SÉRIES TACTILES */}
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-1 sm:gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
          <div className="col-span-1 text-center">Set</div>
          <div className="col-span-5 sm:col-span-3 text-center">Charge (kg)</div>
          <div className="col-span-4 sm:col-span-2 text-center">Reps</div>
          <div className="hidden sm:block sm:col-span-2 text-center">RIR</div>
          <div className="hidden sm:block sm:col-span-2 text-center">Repos</div>
          <div className="col-span-2 sm:col-span-2 text-center flex items-center justify-center" title="Validation de série">
            <Check size={14} className="text-emerald-400" />
          </div>
        </div>

        {exercise.sets.map((set, sIdx) => {
          const isSetDone = set.completed;

          return (
            <div 
              key={set.id}
              className={`grid grid-cols-12 gap-1 sm:gap-1.5 items-center p-2 rounded-xl border transition-all ${
                isSetDone
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-100 shadow-sm'
                  : 'bg-slate-900/60 border-slate-700/60 text-slate-200'
              }`}
            >
              {/* Numéro de série */}
              <div className="col-span-1 flex flex-col items-center justify-center">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                  isSetDone ? 'bg-emerald-500/30 text-emerald-300 font-black' : 'bg-slate-800 text-slate-300'
                }`}>
                  {set.setNumber}
                </span>
              </div>

              {/* Charge (kg) avec boutons tactiles +/- agrandis à 44px de hauteur */}
              <div className="col-span-5 sm:col-span-3 flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={isSetDone}
                  onClick={() => onQuickAdjustWeight(exerciseIndex, sIdx, -2.5)}
                  className="min-w-[36px] sm:min-w-[32px] min-h-[44px] sm:min-h-[40px] px-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-90 disabled:opacity-30 text-slate-200 text-base font-black flex items-center justify-center shrink-0 touch-manipulation select-none transition-transform"
                  title="-2.5 kg"
                  aria-label={`Diminuer le poids de 2.5 kg pour la série ${set.setNumber} de ${exercise.name}`}
                >
                  -
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  disabled={isSetDone}
                  value={set.weightKg === 0 ? '' : set.weightKg}
                  onChange={(e) => onUpdateSetValue(exerciseIndex, sIdx, 'weightKg', Number(e.target.value) || 0)}
                  placeholder="0"
                  aria-label={`Poids en kg pour la série ${set.setNumber} de ${exercise.name}`}
                  className="w-13 sm:w-16 min-h-[44px] sm:min-h-[40px] text-center font-mono font-bold text-sm bg-black/40 border border-slate-700 disabled:border-transparent rounded-lg text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isSetDone}
                  onClick={() => onQuickAdjustWeight(exerciseIndex, sIdx, 2.5)}
                  className="min-w-[36px] sm:min-w-[32px] min-h-[44px] sm:min-h-[40px] px-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-90 disabled:opacity-30 text-slate-200 text-base font-black flex items-center justify-center shrink-0 touch-manipulation select-none transition-transform"
                  title="+2.5 kg"
                  aria-label={`Augmenter le poids de 2.5 kg pour la série ${set.setNumber} de ${exercise.name}`}
                >
                  +
                </button>
              </div>

              {/* Répétitions avec boutons tactiles +/- agrandis à 44px de hauteur */}
              <div className="col-span-4 sm:col-span-2 flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={isSetDone}
                  onClick={() => onQuickAdjustReps(exerciseIndex, sIdx, -1)}
                  className="min-w-[34px] sm:min-w-[30px] min-h-[44px] sm:min-h-[40px] px-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-90 disabled:opacity-30 text-slate-200 text-base font-black flex items-center justify-center shrink-0 touch-manipulation select-none transition-transform"
                  title="-1 rep"
                  aria-label={`Diminuer d'une répétition pour la série ${set.setNumber} de ${exercise.name}`}
                >
                  -
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  disabled={isSetDone}
                  value={set.reps || ''}
                  onChange={(e) => onUpdateSetValue(exerciseIndex, sIdx, 'reps', Math.max(1, Number(e.target.value) || 1))}
                  placeholder="10"
                  aria-label={`Nombre de répétitions pour la série ${set.setNumber} de ${exercise.name}`}
                  className="w-10 sm:w-12 min-h-[44px] sm:min-h-[40px] text-center font-mono font-bold text-sm bg-black/40 border border-slate-700 disabled:border-transparent rounded-lg text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isSetDone}
                  onClick={() => onQuickAdjustReps(exerciseIndex, sIdx, 1)}
                  className="min-w-[34px] sm:min-w-[30px] min-h-[44px] sm:min-h-[40px] px-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-90 disabled:opacity-30 text-slate-200 text-base font-black flex items-center justify-center shrink-0 touch-manipulation select-none transition-transform"
                  title="+1 rep"
                  aria-label={`Augmenter d'une répétition pour la série ${set.setNumber} de ${exercise.name}`}
                >
                  +
                </button>
              </div>

              {/* RIR (Répétitions en réserve) */}
              <div className="hidden sm:flex sm:col-span-2 items-center justify-center">
                <select
                  disabled={isSetDone}
                  value={set.rir}
                  onChange={(e) => onUpdateSetValue(exerciseIndex, sIdx, 'rir', Number(e.target.value))}
                  aria-label={`Répétitions en réserve RIR pour la série ${set.setNumber} de ${exercise.name}`}
                  className="min-h-[40px] px-2 bg-black/40 border border-slate-700 disabled:border-transparent rounded-lg text-xs font-bold text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="0">0 (Échec)</option>
                  <option value="1">1 (Trés dur)</option>
                  <option value="2">2 (Optimal)</option>
                  <option value="3">3 (Modéré)</option>
                  <option value="4">4+ (Léger)</option>
                </select>
              </div>

              {/* Temps de repos par défaut pour ce set */}
              <div className="hidden sm:flex sm:col-span-2 items-center justify-center">
                <select
                  disabled={isSetDone}
                  value={set.restSeconds}
                  onChange={(e) => onUpdateSetValue(exerciseIndex, sIdx, 'restSeconds', Number(e.target.value))}
                  aria-label={`Temps de repos prévu après la série ${set.setNumber} de ${exercise.name}`}
                  className="min-h-[40px] px-2 bg-black/40 border border-slate-700 disabled:border-transparent rounded-lg text-xs font-bold text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="45">45s</option>
                  <option value="60">60s</option>
                  <option value="90">90s (1m30)</option>
                  <option value="120">120s (2m)</option>
                  <option value="180">180s (3m)</option>
                </select>
              </div>

              {/* BOUTON TACTILE DE VALIDATION (MIN-H 44PX WCAG 2.2) */}
              <div className="col-span-2 sm:col-span-2 flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => onValidateSet(exerciseIndex, sIdx)}
                  className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-all shadow-sm touch-manipulation active:scale-95 ${
                    isSetDone
                      ? 'bg-emerald-500/25 hover:bg-emerald-500/35 border-2 border-emerald-400 text-emerald-400 shadow-emerald-500/20 ring-2 ring-emerald-500/30'
                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/35 border border-emerald-500/40 text-emerald-400'
                  }`}
                  title={isSetDone ? 'Série validée (cliquer pour annuler)' : 'Valider la série'}
                  aria-label={isSetDone ? `Série ${set.setNumber} de ${exercise.name} validée. Cliquer pour annuler.` : `Valider la série ${set.setNumber} de ${exercise.name}`}
                >
                  <Check size={20} className="text-emerald-400 stroke-[3]" />
                </button>

                {/* Supprimer la série si plus d'une */}
                {exercise.sets.length > 1 && !isSetDone && (
                  <button
                    type="button"
                    onClick={() => onRemoveSet(exerciseIndex, sIdx)}
                    className="min-w-[36px] min-h-[44px] text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 flex items-center justify-center transition-colors touch-manipulation active:scale-90"
                    title="Retirer cette série"
                    aria-label={`Supprimer la série ${set.setNumber} de ${exercise.name}`}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ajouter une série à cet exercice */}
      <div className="pt-1 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onAddSet(exerciseIndex)}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 border border-slate-700/80 cursor-pointer"
        >
          <Plus size={13} /> Ajouter une série
        </button>

        <span className="text-[11px] text-slate-400">
          {completedSetsCount} / {exercise.sets.length} séries validées
        </span>
      </div>
    </div>
  );
});

export default GymActiveExercise;
