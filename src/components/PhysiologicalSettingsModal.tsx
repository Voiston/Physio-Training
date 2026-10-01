import React, { useState, useMemo } from 'react';
import { PhysiologicalSettings } from '../hooks/useData';
import { computeBanisterPerformance } from '../utils/physiology';
import { 
  Sliders, X, Check, RotateCcw, Activity, Shield, 
  Sparkles, Info, HeartPulse, User, Zap 
} from 'lucide-react';

interface PhysiologicalSettingsModalProps {
  settings: PhysiologicalSettings;
  events: Record<string, Record<string, any>>;
  dailyMetrics: Record<string, any>;
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
    id: 'standard',
    name: 'Standard / Athlète Intermédiaire',
    tauFatigue: 7,
    tauFitness: 28,
    description: 'Calibrage de référence Banister/Coggan. Demi-vie de fatigue à 7j et assimilation chronique sur 4 semaines.',
    badge: 'Standard',
    color: 'blue'
  },
  {
    id: 'master',
    name: 'Master (+40 ans) / Récupération Lente',
    tauFatigue: 10,
    tauFitness: 35,
    description: 'La fatigue résiduelle persiste plus longtemps (10j) avant retour au calme, et la condition physique nécessite une consolidation plus graduelle.',
    badge: 'Master / Récup Lente',
    color: 'amber'
  },
  {
    id: 'elite',
    name: 'Élite / Haute Capacité d\'Assimilation',
    tauFatigue: 5,
    tauFitness: 42,
    description: 'Évacuation ultra-rapide du stress d\'entraînement (5j) et inertie physiologique très forte sur cycle de 6 semaines.',
    badge: 'Élite',
    color: 'emerald'
  },
  {
    id: 'reprise',
    name: 'Débutant / Reprise Progressive',
    tauFatigue: 9,
    tauFitness: 21,
    description: 'Fatigue nerveuse et courbatures prolongées (9j), avec une mémoire musculaire/cardio encore courte (3 semaines).',
    badge: 'Reprise',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0f0f15] border border-white/15 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/25 to-blue-500/25 text-blue-400 border border-blue-500/30">
              <Sliders size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Calibrage des Constantes Physiologiques (Banister)
              </h2>
              <p className="text-xs text-slate-400">
                Ajustement personnalisé des vitesses d'élimination de la fatigue (ATL) et de condition (CTL)
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

        {/* Profils Préconfigurés */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <User size={13} className="text-blue-400" /> Profils & Archétypes recommandés
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PRESET_PROFILES.map(p => {
              const isSelected = tauFatigue === p.tauFatigue && tauFitness === p.tauFitness;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 shadow-md shadow-blue-500/10'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-white">{p.name}</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300 shrink-0">
                      τ1: {p.tauFatigue}j | τ2: {p.tauFitness}j
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Zap size={14} className="text-red-400" />
                Constante de Fatigue Aiguë &tau;₁ (ATL) : <strong className="text-red-400 font-mono text-sm">{tauFatigue} jours</strong>
              </label>
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                Plage : 5 à 12 jours (défaut : 7j)
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="12"
              step="1"
              value={tauFatigue}
              onChange={(e) => {
                setTauFatigue(Number(e.target.value));
                setProfileName('Personnalisé');
              }}
              className="w-full accent-red-500 h-2 bg-white/10 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              <strong>Interprétation :</strong> Détermine la vitesse à laquelle votre organisme évacue l'acidose, le stress nerveux et la fatigue musculaire. Une valeur basse (ex: 5j) modélise une régénération rapide ; une valeur haute (ex: 10j) convient aux profils sensibles ou masters.
            </p>
          </div>

          {/* Curseur 2 : Constante de Condition Physique (tauFitness, 21 à 45 jours) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <HeartPulse size={14} className="text-sky-400" />
                Constante de Condition Physique &tau;₂ (CTL) : <strong className="text-sky-400 font-mono text-sm">{tauFitness} jours</strong>
              </label>
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                Plage : 21 à 45 jours (défaut : 28j)
              </span>
            </div>
            <input
              type="range"
              min="21"
              max="45"
              step="1"
              value={tauFitness}
              onChange={(e) => {
                setTauFitness(Number(e.target.value));
                setProfileName('Personnalisé');
              }}
              className="w-full accent-sky-500 h-2 bg-white/10 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              <strong>Interprétation :</strong> Durée de rétention des adaptations cardiovasculaires et enzymatiques chroniques. Une valeur élevée (35 à 42j) protège la condition sur la durée ; une valeur plus courte (21 à 28j) réagit plus vivement aux cycles de relance.
            </p>
          </div>

          {/* Optionnel : CTL Initiale de Démarrage (C4) */}
          <div className="pt-3 border-t border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Shield size={14} className="text-indigo-400" />
                Condition Initiale &tau;₀ (CTL de départ) :
              </label>
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                Optionnel (défaut : 0 UA)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="250"
                step="5"
                placeholder="Ex: 40 (si historique antérieur)"
                value={initialCtl}
                onChange={(e) => setInitialCtl(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-44 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-slate-400">UA (Unités de Charge)</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              Permet d'initialiser votre niveau de condition préalable afin d'éviter un démarrage à froid artificiel à 0 UA.
            </p>
          </div>

        </div>

        {/* Aperçu en Direct des Conséquences Physiologiques (Live Preview) */}
        <div className="mb-6 p-3.5 rounded-xl bg-gradient-to-r from-blue-950/30 to-purple-950/30 border border-blue-500/25">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              Impact Immédiat sur vos Métriques du Jour
            </span>
            <span className="text-[10px] font-mono text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded">
              Profil : {profileName}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            {/* ATL */}
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 block">Fatigue ATL</span>
              <span className="text-base font-bold font-mono text-red-400 block mt-0.5">
                {liveBanister.current.atl}
              </span>
              <span className="text-[10px] font-mono block text-slate-400">
                {atlDiff > 0 ? `+${atlDiff}` : atlDiff} vs avant
              </span>
            </div>

            {/* CTL */}
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 block">Condition CTL</span>
              <span className="text-base font-bold font-mono text-sky-400 block mt-0.5">
                {liveBanister.current.ctl}
              </span>
              <span className="text-[10px] font-mono block text-slate-400">
                {ctlDiff > 0 ? `+${ctlDiff}` : ctlDiff} vs avant
              </span>
            </div>

            {/* TSB */}
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 block">Forme TSB (CTL - ATL)</span>
              <span className={`text-base font-bold font-mono block mt-0.5 ${
                liveBanister.current.tsb >= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {liveBanister.current.tsb >= 0 ? `+${liveBanister.current.tsb}` : liveBanister.current.tsb}
              </span>
              <span className="text-[10px] font-mono block text-slate-400">
                {tsbDiff > 0 ? `+${tsbDiff}` : tsbDiff} vs avant
              </span>
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Réinitialiser par défaut</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all cursor-pointer border border-blue-400/30"
            >
              <Check size={14} className="stroke-[3]" />
              Appliquer le Calibrage
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
