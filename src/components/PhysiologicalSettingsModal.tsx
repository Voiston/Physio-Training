import React, { useState, useMemo } from 'react';
import type { EventsByQuality } from '../types';
import type { DailyMetrics } from '../hooks/useMetricsState';
import { PhysiologicalSettings } from '../hooks/useData';
import { computeBanisterPerformance } from '../utils/physiology';
import { 
  Sliders, X, Check, RotateCcw, Shield, 
  Sparkles, Info, HeartPulse, User, Zap 
} from 'lucide-react';

interface PhysiologicalSettingsModalProps {
  settings: PhysiologicalSettings;
  events: EventsByQuality;
  dailyMetrics: Record<string, DailyMetrics>;
  onSave: (settings: PhysiologicalSettings) => void;
  onClose: () => void;
}

export interface PresetProfile {
  id: string;
  name: string;
  tauFatigue: number;
  tauFitness: number;
  description: string;
  badge: string;
  color: string;
}

export const PRESET_PROFILES: PresetProfile[] = [
  {
    id: 'pmc_coggan',
    name: 'Référence PMC Coggan (Classique)',
    tauFatigue: 7,
    tauFitness: 42,
    description: 'Norme de référence du Performance Management Chart (Coggan & Allen). Fatigue aiguë sur 7j (ATL) et condition chronique sur 6 semaines (CTL = 42j).',
    badge: 'PMC Coggan (42j)',
    color: 'emerald'
  },
  {
    id: 'standard',
    name: 'Standard Méso-cycles (4 semaines)',
    tauFatigue: 7,
    tauFitness: 28,
    description: 'Calibrage adapté aux blocs de 4 semaines (3 semaines de charge + 1 semaine d\'assimilation). Demi-vie de fatigue à 7j et CTL sur 28j.',
    badge: 'Cycle 4 sem (28j)',
    color: 'blue'
  },
  {
    id: 'master',
    name: 'Profil Empirique Récupération Lente',
    tauFatigue: 10,
    tauFitness: 35,
    description: 'Modèle indicatif : dissipation plus lente de la fatigue neuromusculaire (10j) et consolidation sur 5 semaines.',
    badge: 'Récup Lente',
    color: 'amber'
  },
  {
    id: 'elite',
    name: 'Profil Empirique Haute Assimilation',
    tauFatigue: 5,
    tauFitness: 42,
    description: 'Modèle indicatif pour athlètes aguerris : évacuation rapide du stress aigu (5j) et socle aérobie durable sur 6 semaines.',
    badge: 'Haute Assimilation',
    color: 'purple'
  }
];

export const PhysiologicalSettingsModal: React.FC<PhysiologicalSettingsModalProps> = ({
  settings,
  events,
  dailyMetrics,
  onSave,
  onClose
}) => {
  const [tauFatigue, setTauFatigue] = useState<number>(settings.tauFatigue || 7);
  const [tauFitness, setTauFitness] = useState<number>(settings.tauFitness || 28);
  const [profileName, setProfileName] = useState<string>(settings.profileName || 'Standard');
  const [initialCtl, setInitialCtl] = useState<number | ''>(settings.initialCtl ?? '');

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

  // Calcul live avec les paramètres actuels de l'UI
  const liveBanister = useMemo(() => {
    return computeBanisterPerformance(
      events, 
      dailyMetrics, 
      30, 
      0, 
      tauFatigue, 
      tauFitness, 
      initialCtl !== '' ? Number(initialCtl) : null
    );
  }, [events, dailyMetrics, tauFatigue, tauFitness, initialCtl]);

  // Calcul de base avec les paramètres enregistrés originaux
  const originalBanister = useMemo(() => {
    return computeBanisterPerformance(
      events, 
      dailyMetrics, 
      30, 
      0, 
      settings.tauFatigue || 7, 
      settings.tauFitness || 28,
      settings.initialCtl ?? null
    );
  }, [events, dailyMetrics, settings]);

  const handleApplyPreset = (preset: PresetProfile) => {
    setTauFatigue(preset.tauFatigue);
    setTauFitness(preset.tauFitness);
    setProfileName(preset.badge);
  };

  const handleReset = () => {
    setTauFatigue(7);
    setTauFitness(28);
    setProfileName('Standard');
    setInitialCtl('');
  };

  const handleSave = () => {
    onSave({
      tauFatigue: Number(tauFatigue),
      tauFitness: Number(tauFitness),
      profileName,
      initialCtl: initialCtl !== '' ? Number(initialCtl) : undefined
    });
    onClose();
  };

  const atlDiff = Math.round((liveBanister.current.atl - originalBanister.current.atl) * 10) / 10;
  const ctlDiff = Math.round((liveBanister.current.ctl - originalBanister.current.ctl) * 10) / 10;
  const tsbDiff = Math.round((liveBanister.current.tsb - originalBanister.current.tsb) * 10) / 10;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="physio-modal-title"
      aria-describedby="physio-modal-desc"
    >
      <div 
        className="w-full max-w-2xl bg-[#0f0f15] border border-white/15 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/25 to-blue-500/25 text-blue-400 border border-blue-500/30">
              <Sliders size={22} aria-hidden="true" />
            </div>
            <div>
              <h2 id="physio-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
                Calibrage des Constantes Physiologiques (Banister)
              </h2>
              <p id="physio-modal-desc" className="text-xs text-slate-400">
                Ajustement personnalisé des vitesses d'élimination de la fatigue (ATL) et de condition (CTL)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la boîte de dialogue de calibrage"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors cursor-pointer"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Profils Préconfigurés */}
        <div className="mb-5">
          <span className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <User size={13} className="text-blue-400" aria-hidden="true" /> Profils & Archétypes recommandés
          </span>
          <div 
            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
            role="group"
            aria-label="Profils physiologiques préconfigurés"
          >
            {PRESET_PROFILES.map(p => {
              const isSelected = tauFatigue === p.tauFatigue && tauFitness === p.tauFitness;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  aria-pressed={isSelected}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    isSelected
                      ? 'bg-blue-600/25 border-blue-500 shadow-md shadow-blue-500/15'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-blue-400' : 'bg-transparent border border-slate-500'}`} aria-hidden="true" />
                      <span className="text-xs font-bold text-white">{p.name}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300 shrink-0">
                      τ1: {p.tauFatigue}j | τ2: {p.tauFitness}j
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300/90 leading-relaxed">
                    {p.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Curseurs de réglage manuel */}
        <div className="space-y-5 bg-white/[0.02] p-4 rounded-xl border border-white/10 mb-5">
          
          {/* Curseur 1 : Constante de Fatigue (tauFatigue, 5 à 12 jours) */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
              <label 
                htmlFor="tau-fatigue-slider" 
                className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Zap size={14} className="text-red-400" aria-hidden="true" />
                Constante de Fatigue Aiguë &tau;<sub>fatigue</sub> (ATL) : <strong className="text-red-400 font-mono text-sm">{tauFatigue} jours</strong>
              </label>
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                Plage : 5 à 12 jours (défaut : 7j)
              </span>
            </div>
            <input
              id="tau-fatigue-slider"
              type="range"
              min="5"
              max="12"
              step="1"
              value={tauFatigue}
              aria-valuemin={5}
              aria-valuemax={12}
              aria-valuenow={tauFatigue}
              aria-valuetext={`${tauFatigue} jours de demi-vie de fatigue aiguë`}
              onChange={(e) => {
                setTauFatigue(Number(e.target.value));
                setProfileName('Personnalisé');
              }}
              className="w-full accent-red-500 h-2 bg-white/10 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-300/80 mt-1.5 leading-relaxed">
              <strong>Interprétation :</strong> Détermine la vitesse à laquelle votre organisme dissipe la fatigue aiguë (réparation des micro-lésions musculaires, reconstitution du glycogène et récupération neuromusculaire). Une valeur basse (ex: 5j) modélise une régénération rapide ; une valeur haute (ex: 10j) convient aux profils sensibles ou masters.
            </p>
          </div>

          {/* Curseur 2 : Constante de Condition Physique (tauFitness, 21 à 45 jours) */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
              <label 
                htmlFor="tau-fitness-slider" 
                className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <HeartPulse size={14} className="text-sky-400" aria-hidden="true" />
                Constante de Condition Physique &tau;<sub>fitness</sub> (CTL) : <strong className="text-sky-400 font-mono text-sm">{tauFitness} jours</strong>
              </label>
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                Plage : 21 à 45 jours (défaut : 28j)
              </span>
            </div>
            <input
              id="tau-fitness-slider"
              type="range"
              min="21"
              max="45"
              step="1"
              value={tauFitness}
              aria-valuemin={21}
              aria-valuemax={45}
              aria-valuenow={tauFitness}
              aria-valuetext={`${tauFitness} jours de rétention de condition physique chronique`}
              onChange={(e) => {
                setTauFitness(Number(e.target.value));
                setProfileName('Personnalisé');
              }}
              className="w-full accent-sky-500 h-2 bg-white/10 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-300/80 mt-1.5 leading-relaxed">
              <strong>Interprétation :</strong> Durée de rétention des adaptations cardiovasculaires et enzymatiques chroniques. Une valeur élevée (35 à 42j) protège la condition sur la durée ; une valeur plus courte (21 à 28j) réagit plus vivement aux cycles de relance.
            </p>
          </div>

          {/* Optionnel : CTL Initiale de Démarrage (C4) */}
          <div className="pt-3 border-t border-white/5">
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
              <label 
                htmlFor="initial-ctl-input" 
                className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Shield size={14} className="text-indigo-400" aria-hidden="true" />
                Condition Initiale &tau;₀ (CTL de départ) :
              </label>
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                Optionnel (défaut : 0 UA)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="initial-ctl-input"
                type="number"
                min="0"
                max="250"
                step="5"
                placeholder="Ex: 40 (si historique)"
                value={initialCtl}
                onChange={(e) => setInitialCtl(e.target.value === '' ? '' : Number(e.target.value))}
                aria-label="Condition initiale CTL de départ en unités de charge"
                className="w-44 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-300 font-medium">UA (Unités de Charge)</span>
            </div>
            <p className="text-[11px] text-slate-300/80 mt-1.5 leading-relaxed">
              Permet d'initialiser votre niveau de condition préalable afin d'éviter un démarrage à froid artificiel à 0 UA.
            </p>
          </div>

          {/* Note méthodologique de transparence */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300/90 flex items-start gap-2.5">
            <Info size={16} className="text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed">
              <strong>Note méthodologique :</strong> Ce module s'appuie sur la dynamique de charge de type <em>Performance Management Chart</em> (PMC Coggan / formalisme Banister simplifié : TSB = CTL − ATL). Les profils ci-dessus sont des repères empiriques indicatifs, personnalisables selon votre tolérance et vos temps de récupération observés.
            </span>
          </div>

        </div>

        {/* Aperçu en Direct des Conséquences Physiologiques (Live Preview) */}
        <div 
          className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-950/40 to-purple-950/40 border border-blue-500/30"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" aria-hidden="true" />
              Impact Immédiat sur vos Métriques du Jour
            </span>
            <span className="text-xs font-mono font-semibold text-blue-300 bg-blue-500/20 px-2.5 py-0.5 rounded-lg border border-blue-500/30">
              Profil : {profileName}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            {/* ATL */}
            <div className="p-3 rounded-xl bg-black/50 border border-white/10">
              <span className="text-[11px] text-slate-300 font-medium block">Fatigue ATL</span>
              <span className="text-lg font-bold font-mono text-red-400 block mt-0.5">
                {liveBanister.current.atl}
              </span>
              <span className="text-[10px] font-mono block text-slate-400 mt-0.5">
                {atlDiff > 0 ? `+${atlDiff}` : atlDiff} vs avant
              </span>
            </div>

            {/* CTL */}
            <div className="p-3 rounded-xl bg-black/50 border border-white/10">
              <span className="text-[11px] text-slate-300 font-medium block">Condition CTL</span>
              <span className="text-lg font-bold font-mono text-sky-400 block mt-0.5">
                {liveBanister.current.ctl}
              </span>
              <span className="text-[10px] font-mono block text-slate-400 mt-0.5">
                {ctlDiff > 0 ? `+${ctlDiff}` : ctlDiff} vs avant
              </span>
            </div>

            {/* TSB */}
            <div className="p-3 rounded-xl bg-black/50 border border-white/10">
              <span className="text-[11px] text-slate-300 font-medium block">Forme TSB (CTL - ATL)</span>
              <span className={`text-lg font-bold font-mono block mt-0.5 ${
                liveBanister.current.tsb >= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {liveBanister.current.tsb >= 0 ? `+${liveBanister.current.tsb}` : liveBanister.current.tsb}
              </span>
              <span className="text-[10px] font-mono block text-slate-400 mt-0.5">
                {tsbDiff > 0 ? `+${tsbDiff}` : tsbDiff} vs avant
              </span>
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleReset}
            className="min-h-[44px] flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>Réinitialiser par défaut</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all cursor-pointer border border-blue-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 active:scale-95"
            >
              <Check size={16} className="stroke-[3]" aria-hidden="true" />
              Appliquer le Calibrage
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
