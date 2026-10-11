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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fermeture accessible sur touche Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setErrorMsg('Veuillez sélectionner la date du Jour J de votre événement.');
      return;
    }
    setErrorMsg(null);
    onSave({
      name: name.trim() || 'Objectif Compétition',
      date,
      type,
      targetTsb: Number(targetTsb),
      targetTsbUnit: 'percent',
      notes
    });
    onClose();
  };

  const handleRemove = () => {
    onSave(null);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="competition-modal-title"
      aria-describedby="competition-modal-desc"
    >
      <div 
        className="w-full max-w-2xl bg-[#0f0f14] border border-white/15 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy size={22} aria-hidden="true" />
            </div>
            <div>
              <h2 id="competition-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
                Objectif Compétition & Affûtage (Tapering)
              </h2>
              <p id="competition-modal-desc" className="text-xs text-slate-400">
                Planification du pic de forme (TSB) et suivi de la monotonie de Foster
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la boîte de dialogue de compétition"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors cursor-pointer"
          >
            <X size={20} aria-hidden="true" />
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
                <span className="text-[10px] text-slate-300 block font-medium">Forme TSB Jour J</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {taperingAnalysis.projectedTsbPercent !== null 
                    ? (taperingAnalysis.projectedTsbPercent > 0 ? `+${taperingAnalysis.projectedTsbPercent}%` : `${taperingAnalysis.projectedTsbPercent}%`)
                    : (taperingAnalysis.projectedTsb > 0 ? `+${taperingAnalysis.projectedTsb} pts` : `${taperingAnalysis.projectedTsb} pts`)}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Cible : +{taperingAnalysis.targetTsb}{taperingAnalysis.targetTsbUnit === 'percent' ? '% CTL' : ' pts'}
                  {taperingAnalysis.projectedTsbPercent !== null && ` (${taperingAnalysis.projectedTsb > 0 ? `+${taperingAnalysis.projectedTsb}` : taperingAnalysis.projectedTsb} pts)`}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-300 block font-medium">Fatigue ATL Jour J</span>
                <span className="text-base font-bold font-mono text-rose-400">
                  {taperingAnalysis.compDayData?.atl ?? 0}
                </span>
                <span className="text-[10px] text-slate-400 block font-medium">Doit être basse</span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-300 block font-medium">Monotonie Foster</span>
                <span className={`text-base font-bold font-mono ${fosterMetrics.monotony > 2.0 ? 'text-rose-400' : fosterMetrics.monotony > 1.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {fosterMetrics.monotony}
                </span>
                <span className="text-[10px] text-slate-400 block font-medium">Idéal &lt; 1.5</span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-300 block font-medium">Strain Hebdo</span>
                <span className={`text-base font-bold font-mono ${fosterMetrics.strain > 4000 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {fosterMetrics.strain}
                </span>
                <span className="text-[10px] text-slate-400 block font-medium">Charge × Monotonie</span>
              </div>
            </div>

            {/* Conseil physiologique */}
            <div className="text-xs text-slate-300 bg-white/5 p-2.5 rounded-lg border border-white/5 flex items-start gap-2">
              <Sparkles size={14} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{taperingAnalysis.advice}</span>
            </div>
          </div>
        )}

        {/* Message d'erreur accessible en cas de champ invalide */}
        {errorMsg && (
          <div 
            role="alert" 
            className="mb-4 p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2.5"
          >
            <AlertTriangle size={16} className="text-red-400 shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulaire de configuration */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="comp-name" className="block text-xs font-semibold text-slate-200 mb-1.5">
              Nom de la course / objectif athlétique
            </label>
            <input
              id="comp-name"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Ex: Marathon de Paris, Trail des Aiguilles, Compétition Force..."
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="comp-date" className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-400" aria-hidden="true" /> Date de l'événement (Jour J)
              </label>
              <input
                id="comp-date"
                type="date"
                required
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                aria-invalid={!date && !!errorMsg}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="comp-type" className="block text-xs font-semibold text-slate-200 mb-1.5">
                Discipline / Format
              </label>
              <select
                id="comp-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label htmlFor="comp-target-tsb" className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Gauge size={14} className="text-emerald-400" aria-hidden="true" />
                Niveau de Forme TSB visé le Jour J (<span className="text-emerald-400 font-mono font-bold">+{targetTsb}%</span> de la CTL)
              </label>
              
              {/* Presets rapides agrandis avec cibles tactiles WCAG 2.5.8 */}
              <div className="flex items-center gap-1.5" role="group" aria-label="Préréglages d'affûtage TSB">
                {[
                  { label: 'Modéré (+10%)', val: 10 },
                  { label: 'Standard (+15%)', val: 15 },
                  { label: 'Fraîcheur (+22%)', val: 22 }
                ].map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setTargetTsb(p.val)}
                    aria-pressed={targetTsb === p.val}
                    aria-label={`Régler l'affûtage TSB sur ${p.label}`}
                    className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                      targetTsb === p.val 
                        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20' 
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <input
              id="comp-target-tsb"
              type="range"
              min="5"
              max="30"
              step="1"
              value={targetTsb}
              aria-valuemin={5}
              aria-valuemax={30}
              aria-valuenow={targetTsb}
              aria-valuetext={`+${targetTsb}% de la charge d'entraînement à long terme (CTL)`}
              onChange={(e) => setTargetTsb(Number(e.target.value))}
              className="w-full accent-emerald-500 h-2 bg-white/15 rounded-lg cursor-pointer"
            />
            
            <div className="flex justify-between items-center text-[10px] text-slate-400 px-0.5 mt-1 font-mono">
              <span>+5% (Reprise active)</span>
              <span>+15% (Idéal standard)</span>
              <span>+22% (Pic optimal)</span>
              <span>+30% (Risque désentraînement)</span>
            </div>

            <p className="text-[11px] text-slate-300/80 mt-1.5 leading-relaxed">
              En sciences du sport (modèle PMC), un TSB compris entre +5% et +25% de la CTL vise un équilibre optimal entre fraîcheur (ATL basse) et maintien de la cylindrée de fond (CTL).
            </p>
          </div>

          <div>
            <label htmlFor="comp-notes" className="block text-xs font-semibold text-slate-200 mb-1.5">
              Notes du plan d'affûtage / consignes
            </label>
            <textarea
              id="comp-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Maintenir l'intensité de course lors de 2 piqûres de rappel (10 min à J-7 et 5 min à J-3), baisser le volume global de 40%."
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-5">
            {competition ? (
              <button
                type="button"
                onClick={handleRemove}
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/15 border border-red-500/30 transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                Supprimer l'objectif
              </button>
            ) : <div />}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Check size={16} className="stroke-[3]" aria-hidden="true" />
                Enregistrer l'Objectif
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
