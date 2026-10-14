import React, { useState, useRef, useEffect } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { TargetCompetition } from '../hooks/useData';
import { 
  Trophy, Calendar, AlertTriangle, ShieldCheck, Flame, 
  X, Check, Gauge, Sparkles, TrendingUp, HelpCircle 
} from 'lucide-react';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';

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
  const modalRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(competition?.name || 'Objectif Course / Compétition');
  const [date, setDate] = useState(competition?.date || '');
  const [type, setType] = useState(competition?.type || 'course');
  const [targetTsb, setTargetTsb] = useState(competition?.targetTsb ?? 18);
  const [notes, setNotes] = useState(competition?.notes || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const todayStr = getLocalYYYYMMDD(new Date());
  const isDateInPast = Boolean(date && date < todayStr);

  // Focus trap, Escape listener & Focus restoration (WCAG 2.2 SC 2.1.2 & 2.4.3)
  useModalA11y(true, onClose, modalRef);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="competition-modal-title"
      aria-describedby="competition-modal-desc"
    >
      <div 
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-2xl bg-[#0f0f14] border border-white/15 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0" aria-hidden="true">
              <Trophy size={22} />
            </div>
            <div className="min-w-0">
              <h2 id="competition-modal-title" className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 m-0 truncate">
                Objectif Compétition & Affûtage (Tapering)
              </h2>
              <p id="competition-modal-desc" className="text-xs text-slate-300 mt-0.5 m-0 line-clamp-1">
                Planification du pic de forme (TSB) et surveillance de la charge et monotonie de Foster
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la boîte de dialogue de compétition"
            title="Fermer (Échap)"
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors cursor-pointer shrink-0"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Diagnostic Actuel (si un objectif est déjà configuré) */}
        {taperingAnalysis && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-amber-950/20 border border-white/15 space-y-3.5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Statut d'Affûtage :</span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 border border-white/20 text-white">
                  {taperingAnalysis.statusBadge}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/30">
                {taperingAnalysis.daysRemaining >= 0 ? `J-${taperingAnalysis.daysRemaining} jours restants` : 'Objectif passé'}
              </span>
            </div>

            {/* KPIs Clés avec typographie accessible >= 12px */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-3 rounded-xl bg-black/50 border border-white/10">
                <span className="text-xs text-slate-300 block font-semibold mb-0.5">Forme TSB Jour J</span>
                <span className="text-lg font-black font-mono text-emerald-400 block">
                  {taperingAnalysis.projectedTsbPercent !== null 
                    ? (taperingAnalysis.projectedTsbPercent > 0 ? `+${taperingAnalysis.projectedTsbPercent}%` : `${taperingAnalysis.projectedTsbPercent}%`)
                    : (taperingAnalysis.projectedTsb > 0 ? `+${taperingAnalysis.projectedTsb} pts` : `${taperingAnalysis.projectedTsb} pts`)}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5 font-medium">
                  Cible : +{taperingAnalysis.targetTsb}{taperingAnalysis.targetTsbUnit === 'percent' ? '% CTL' : ' pts'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-black/50 border border-white/10">
                <span className="text-xs text-slate-300 block font-semibold mb-0.5">Fatigue ATL Jour J</span>
                <span className="text-lg font-black font-mono text-rose-400 block">
                  {taperingAnalysis.compDayData?.atl ?? 0}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5 font-medium">Doit être basse</span>
              </div>

              <div className="p-3 rounded-xl bg-black/50 border border-white/10">
                <span className="text-xs text-slate-300 block font-semibold mb-0.5">Monotonie Foster</span>
                <span className={`text-lg font-black font-mono block ${fosterMetrics.monotony > 2.0 ? 'text-rose-400' : fosterMetrics.monotony > 1.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {fosterMetrics.monotony}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5 font-medium">Idéal &lt; 1.5</span>
              </div>

              <div className="p-3 rounded-xl bg-black/50 border border-white/10">
                <span className="text-xs text-slate-300 block font-semibold mb-0.5">Strain Hebdo</span>
                <span className={`text-lg font-black font-mono block ${fosterMetrics.strain > 4000 ? 'text-rose-400' : 'text-slate-100'}`}>
                  {fosterMetrics.strain}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5 font-medium">Charge × Monotonie</span>
              </div>
            </div>

            {/* Conseil physiologique */}
            <div className="text-xs text-slate-200 bg-white/5 p-3 rounded-xl border border-white/10 flex items-start gap-2.5 leading-relaxed">
              <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
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
            <label htmlFor="comp-name" className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
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
              className="w-full min-h-[44px] px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="comp-date" className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Calendar size={15} className="text-blue-400" aria-hidden="true" /> Date de l'événement (Jour J)
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
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 font-mono transition-colors"
              />
              {isDateInPast && (
                <p className="text-xs text-amber-300 mt-1.5 flex items-center gap-1 m-0">
                  <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                  Cette date est passée. L'objectif sera affiché comme clôturé.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="comp-type" className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                Discipline / Format
              </label>
              <select
                id="comp-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
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
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
              <label htmlFor="comp-target-tsb" className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Gauge size={15} className="text-emerald-400" aria-hidden="true" />
                Niveau de Forme TSB visé le Jour J (<span className="text-emerald-400 font-mono font-bold text-sm">+{targetTsb}%</span> de la CTL)
              </label>
              
              {/* Presets rapides agrandis avec cibles tactiles WCAG 2.5.8 (min-h-[44px]) */}
              <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Préréglages d'affûtage TSB">
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
                    className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      targetTsb === p.val 
                        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30' 
                        : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="py-2">
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
                className="w-full accent-emerald-400 h-3 bg-white/15 rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
            </div>
            
            <div className="flex justify-between items-center text-xs text-slate-300 px-0.5 mt-1 font-mono flex-wrap gap-1">
              <span>+5% (Reprise active)</span>
              <span>+15% (Idéal standard)</span>
              <span>+22% (Pic optimal)</span>
              <span>+30% (Risque désentraînement)</span>
            </div>

            <p className="text-xs text-slate-300 mt-2 leading-relaxed m-0">
              En sciences du sport (modèle PMC), un TSB compris entre +5% et +25% de la CTL vise un équilibre optimal entre fraîcheur (ATL basse) et maintien de la cylindrée de fond (CTL).
            </p>
          </div>

          <div>
            <label htmlFor="comp-notes" className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
              Notes du plan d'affûtage / consignes
            </label>
            <textarea
              id="comp-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Maintenir l'intensité de course lors de 2 piqûres de rappel (10 min à J-7 et 5 min à J-3), baisser le volume global de 40%."
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors leading-relaxed"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-5 flex-wrap gap-3">
            {competition ? (
              <button
                type="button"
                onClick={handleRemove}
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                aria-label="Supprimer cet objectif d'affûtage"
              >
                Supprimer l'objectif
              </button>
            ) : <div />}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Check size={16} className="stroke-[3]" aria-hidden="true" />
                <span>{competition ? "Mettre à jour l'objectif" : `Activer l'affûtage · ${name || 'Jour J'}`}</span>
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
