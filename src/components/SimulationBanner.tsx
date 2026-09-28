import React, { useState } from 'react';
import { Quality, SessionData } from '../hooks/useData';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';
import { 
  Sparkles, Play, CheckCircle2, RotateCcw, X, Plus, 
  Calendar, Zap, Shield, ArrowRight, Activity 
} from 'lucide-react';

interface SimulationBannerProps {
  isActive: boolean;
  simulatedEvents: Record<string, Record<string, SessionData>>;
  qualities: Quality[];
  onToggle: (active?: boolean) => void;
  onApplyScenario: (type: 'tapering' | 'overload' | 'recovery') => void;
  onAddSimulatedSession: (qId: string, dateStr: string, sessionData: SessionData) => void;
  onClear: () => void;
  onCommit: () => void;
}

export const SimulationBanner: React.FC<SimulationBannerProps> = ({
  isActive,
  simulatedEvents,
  qualities,
  onToggle,
  onApplyScenario,
  onAddSimulatedSession,
  onClear,
  onCommit
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState(qualities[0]?.id || 'vo2max');
  const [simDaysOffset, setSimDaysOffset] = useState(2); // J+2
  const [duration, setDuration] = useState(45);
  const [rpe, setRpe] = useState(7);

  const totalSimulatedCount: number = Object.values(simulatedEvents).reduce<number>((acc, qDates) => {
    return acc + Object.keys(qDates || {}).length;
  }, 0);

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date();
    const target = new Date(today);
    target.setDate(today.getDate() + Number(simDaysOffset));
    const dateStr = getLocalYYYYMMDD(target);

    const calculatedLoad = Math.round(Number(duration) * Number(rpe));
    const sessionData: SessionData = {
      duration: Number(duration),
      rpeCardio: Number(rpe),
      rpeMusc: Number(rpe),
      load: calculatedLoad,
      isSimulated: true
    };

    onAddSimulatedSession(selectedQuality, dateStr, sessionData);
    setShowAddForm(false);
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className="w-full bg-gradient-to-r from-purple-950/80 via-blue-950/80 to-indigo-950/80 border-2 border-purple-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-fadeIn text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/25 border border-purple-400/40 text-purple-300">
            <Sparkles size={20} className="animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                Mode Simulation Prédictive <span className="text-purple-300">(What-If)</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/30 text-purple-200 border border-purple-400/30">
                {totalSimulatedCount} séance{totalSimulatedCount > 1 ? 's' : ''} simulée{totalSimulatedCount > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-purple-200/80">
              Modélisation en temps réel de votre fatigue (ATL), condition (CTL), forme (TSB) et courbes EMA futures.
            </p>
          </div>
        </div>

        {/* Boutons d'action rapides */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-xs font-semibold text-purple-200 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Ajouter une séance simulée</span>
          </button>

          <button
            onClick={onCommit}
            disabled={totalSimulatedCount === 0}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
              totalSimulatedCount > 0 
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/40' 
                : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
            }`}
            title="Enregistrer ces séances fictives dans le calendrier réel"
          >
            <CheckCircle2 size={14} />
            <span>Valider dans le calendrier réel</span>
          </button>

          <button
            onClick={onClear}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border border-transparent"
            title="Effacer les séances simulées"
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={() => onToggle(false)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
          >
            <X size={14} />
            <span>Fermer</span>
          </button>
        </div>
      </div>

      {/* Scénarios types en 1-clic */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-purple-500/20 text-xs">
        <span className="text-purple-300 font-semibold text-[11px] flex items-center gap-1 mr-1">
          <Play size={12} className="text-purple-400" />
          Scénarios prédéfinis :
        </span>

        <button
          onClick={() => onApplyScenario('tapering')}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition-colors cursor-pointer"
        >
          <span>📉 Affûtage Compétition (-35% volume, 2 rappels toniques)</span>
        </button>

        <button
          onClick={() => onApplyScenario('overload')}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-[11px] font-semibold transition-colors cursor-pointer"
        >
          <span>🔥 Surcharge de Bloc (+30% charge sur 7 jours)</span>
        </button>

        <button
          onClick={() => onApplyScenario('recovery')}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-[11px] font-semibold transition-colors cursor-pointer"
        >
          <span>🧘 Semaine de Récupération Active (Charge minimale)</span>
        </button>
      </div>

      {/* Mini-formulaire dépliable pour injecter une séance personnalisée */}
      {showAddForm && (
        <form onSubmit={handleAddCustom} className="mt-3 p-3 rounded-xl bg-black/40 border border-purple-400/30 flex flex-wrap items-end gap-3 animate-fadeIn text-xs">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Qualité simulée</label>
            <select
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#121218] border border-white/20 rounded-lg text-white font-medium"
            >
              {qualities.map(q => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </div>

          <div className="w-28">
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Date</label>
            <select
              value={simDaysOffset}
              onChange={(e) => setSimDaysOffset(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-[#121218] border border-white/20 rounded-lg text-white font-mono"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(day => (
                <option key={day} value={day}>J+{day}</option>
              ))}
            </select>
          </div>

          <div className="w-24">
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Durée (min)</label>
            <input
              type="number"
              min="10"
              max="240"
              step="5"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-2 py-1.5 bg-[#121218] border border-white/20 rounded-lg text-white font-mono text-center"
            />
          </div>

          <div className="w-24">
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">RPE (1 à 10)</label>
            <input
              type="number"
              min="1"
              max="10"
              value={rpe}
              onChange={(e) => setRpe(Number(e.target.value))}
              className="w-full px-2 py-1.5 bg-[#121218] border border-white/20 rounded-lg text-white font-mono text-center"
            />
          </div>

          <div className="text-[11px] font-mono text-purple-300 py-2">
            Charge : <strong className="text-white">{duration * rpe}</strong>
          </div>

          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors cursor-pointer shadow-md"
          >
            Injecter
          </button>
        </form>
      )}
    </div>
  );
};
