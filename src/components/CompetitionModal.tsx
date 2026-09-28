import React, { useState } from 'react';
import { TargetCompetition } from '../hooks/useData';
import { 
  Trophy, Calendar, AlertTriangle, ShieldCheck, Flame, 
  X, Check, Gauge, Sparkles, TrendingUp, HelpCircle 
} from 'lucide-react';

interface CompetitionModalProps {
  competition: TargetCompetition | null;
  taperingAnalysis: any;
  fosterMetrics: any;
  onSave: (comp: TargetCompetition | null) => void;
  onClose: () => void;
}

export const CompetitionModal: React.FC<CompetitionModalProps> = ({
  competition,
  taperingAnalysis,
  fosterMetrics,
  onSave,
  onClose
}) => {
  const [name, setName] = useState(competition?.name || 'Objectif Course / Compétition');
  const [date, setDate] = useState(competition?.date || '');
  const [type, setType] = useState(competition?.type || 'course');
  const [targetTsb, setTargetTsb] = useState(competition?.targetTsb ?? 18);
  const [notes, setNotes] = useState(competition?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    onSave({
      name,
      date,
      type,
      targetTsb: Number(targetTsb),
      notes
    });
    onClose();
  };

  const handleRemove = () => {
    onSave(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0f0f14] border border-white/15 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Objectif Compétition & Affûtage (Tapering)
              </h2>
              <p className="text-xs text-slate-400">
                Planification du pic de forme (TSB) et suivi de la monotonie de Foster
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Diagnostic Actuel (si un objectif est déjà configuré) */}
        {taperingAnalysis && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-amber-950/20 border border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Statut d'Affûtage :</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/10 border border-white/15">
                  {taperingAnalysis.statusBadge}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                {taperingAnalysis.daysRemaining >= 0 ? `J-${taperingAnalysis.daysRemaining} jours restants` : 'Objectif passé'}
              </span>
            </div>

            {/* KPIs Clés */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Forme TSB Prévue</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {taperingAnalysis.projectedTsb > 0 ? `+${taperingAnalysis.projectedTsb}` : taperingAnalysis.projectedTsb}
                </span>
                <span className="text-[10px] text-slate-500 block">Cible : +{taperingAnalysis.targetTsb}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Fatigue ATL Jour J</span>
                <span className="text-base font-bold font-mono text-red-400">
                  {taperingAnalysis.compDayData?.atl ?? 0}
                </span>
                <span className="text-[10px] text-slate-500 block">Doit être basse</span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Monotonie Foster</span>
                <span className={`text-base font-bold font-mono ${fosterMetrics.monotony > 2.0 ? 'text-red-400' : fosterMetrics.monotony > 1.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {fosterMetrics.monotony}
                </span>
                <span className="text-[10px] text-slate-500 block">Idéal &lt; 1.5</span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Strain Hebdo</span>
                <span className={`text-base font-bold font-mono ${fosterMetrics.strain > 4000 ? 'text-red-400' : 'text-slate-200'}`}>
                  {fosterMetrics.strain}
                </span>
                <span className="text-[10px] text-slate-500 block">Charge × Monotonie</span>
              </div>
            </div>

            {/* Conseil physiologique */}
            <div className="text-xs text-slate-300 bg-white/5 p-2.5 rounded-lg border border-white/5 flex items-start gap-2">
              <Sparkles size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <span>{taperingAnalysis.advice}</span>
            </div>
          </div>
        )}

        {/* Formulaire de configuration */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nom de la course / objectif athlétique
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marathon de Paris, Trail des Aiguilles, Compétition Force..."
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar size={13} className="text-blue-400" /> Date de l'événement (Jour J)
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Discipline / Format
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3.5 py-2 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="course">Course à pied / Semi / Marathon</option>
                <option value="trail">Trail / Ultra</option>
                <option value="triathlon">Triathlon / Ironman</option>
                <option value="cyclisme">Cyclisme / Gran Fondo</option>
                <option value="force">Force / Haltérophilie / Powerlifting</option>
                <option value="autre">Autre défi sportif</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Gauge size={13} className="text-emerald-400" />
                Niveau de Forme TSB visé le Jour J (+{targetTsb})
              </label>
              <div className="flex items-center gap-1">
                {[
                  { label: 'Modéré (+12)', val: 12 },
                  { label: 'Standard (+18)', val: 18 },
                  { label: 'Max Fraîcheur (+24)', val: 24 }
                ].map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setTargetTsb(p.val)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer border ${
                      targetTsb === p.val 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={targetTsb}
              onChange={(e) => setTargetTsb(Number(e.target.value))}
              className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              En science du sport (modèle Banister/Coggan), un TSB compris entre +15 et +22 garantit une fraîcheur maximale (ATL basse) sans perte de condition physique (CTL conservée).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Notes du plan d'affûtage / consignes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Maintenir l'intensité de course lors de 2 piqûres de rappel (10 min à J-7 et 5 min à J-3), baisser le volume de 40%."
              className="w-full px-3.5 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            {competition ? (
              <button
                type="button"
                onClick={handleRemove}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors cursor-pointer"
              >
                Supprimer l'objectif
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Check size={14} className="stroke-[3]" />
                Enregistrer l'Objectif
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
