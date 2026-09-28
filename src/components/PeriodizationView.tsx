import React from 'react';
import { 
  Calendar, Trophy, FileText, Sliders, Zap, Shield, Plus, 
  Sparkles, CheckCircle2, ArrowRight, Activity, Clock, Flame 
} from 'lucide-react';
import { TrainingBlock, BlockTemplate, TargetCompetition } from '../hooks/useData';

interface PeriodizationViewProps {
  activeBlock: TrainingBlock | null;
  blocks: TrainingBlock[];
  templates: BlockTemplate[];
  qualities: any[];
  targetCompetition: TargetCompetition | null;
  taperingAnalysis: any;
  fosterMetrics: any;
  banisterPerformance: any;
  cardioMuscularBalance: any;
  physioSettings: any;
  onOpenBlocksModal: () => void;
  onOpenCompetitionModal: () => void;
  onOpenReportModal: () => void;
  onOpenPhysioSettingsModal: () => void;
  onApplyTemplate?: (template: BlockTemplate) => void;
}

export const PeriodizationView: React.FC<PeriodizationViewProps> = ({
  activeBlock,
  blocks,
  templates,
  qualities,
  targetCompetition,
  taperingAnalysis,
  fosterMetrics,
  banisterPerformance,
  cardioMuscularBalance,
  physioSettings,
  onOpenBlocksModal,
  onOpenCompetitionModal,
  onOpenReportModal,
  onOpenPhysioSettingsModal
}) => {
  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 w-full">
      {/* HEADER SECTION DE LA PÉRIODISATION */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Calendar size={18} />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight m-0">
                Périodisation & Objectifs Athlétiques
              </h2>
              <p className="text-xs text-slate-400 m-0 mt-0.5">
                Cycles de développement par blocs, affûtage pré-course et calibrage
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenBlocksModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-600/20"
          >
            <Plus size={15} />
            <span>Gérer les Blocs</span>
          </button>

          <button
            onClick={onOpenCompetitionModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer"
          >
            <Trophy size={15} className="text-amber-400" />
            <span>{targetCompetition ? targetCompetition.name : 'Définir un Objectif'}</span>
          </button>

          <button
            onClick={onOpenPhysioSettingsModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer"
          >
            <Sliders size={15} className="text-indigo-400" />
            <span>Calibrage (τ₁:{physioSettings.tauFatigue}j / τ₂:{physioSettings.tauFitness}j)</span>
          </button>

          <button
            onClick={onOpenReportModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer"
          >
            <FileText size={15} className="text-emerald-400" />
            <span>Bilan PDF Coach</span>
          </button>
        </div>
      </div>

      {/* GRILLE CENTRALE 2 COLONNES : BLOC ACTIF VS AFFÛTAGE COMPÉTITION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CARTE 1 : BLOC DE PRÉPARATION ACTIF */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 via-purple-950/20 to-black/40 border border-blue-500/30 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Zap size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider m-0">
                    Cycle en Cours
                  </h3>
                  <p className="text-xs text-slate-400 m-0">
                    {activeBlock ? activeBlock.name : 'Aucun bloc actif'}
                  </p>
                </div>
              </div>

              {activeBlock && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  En cours
                </span>
              )}
            </div>

            {activeBlock ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Période : {activeBlock.startDate} &rarr; {activeBlock.endDate}</span>
                    <span className="text-blue-300 font-bold">{activeBlock.durationWeeks} semaines</span>
                  </div>
                </div>

                {/* Qualités ciblées */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-300">
                    <Zap size={13} className="text-red-400 shrink-0" />
                    <span>Qualités Prioritaires Renforcées (Fréquence +25%) :</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-4">
                    {activeBlock.focusQualities.map(id => {
                      const qName = qualities.find(q => q.id === id)?.name || id;
                      return (
                        <span key={id} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/15 text-red-200 border border-red-500/30">
                          {qName}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                    <Shield size={13} className="text-sky-400 shrink-0" />
                    <span>Qualités en Maintien (Intervalle Étendu +35%) :</span>
                  </div>
                  <p className="text-xs text-slate-400 pl-4 leading-relaxed">
                    Les autres filières sont sollicitées à cadence espacée pour préserver les adaptations sans accumuler de fatigue résiduelle.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-3 bg-white/[0.02] border border-dashed border-white/10 rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-200">Aucun bloc de périodisation sélectionné</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Structurez vos prochaines semaines en choisissant un cycle spécifique (Force Max 4 sem., Seuil 3 sem., Volume 6 sem.) pour ordonner vos séances.
                </p>
                <button
                  onClick={onOpenBlocksModal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <Plus size={14} /> Choisir ou Créer un Bloc
                </button>
              </div>
            )}
          </div>

          {activeBlock && (
            <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                {blocks.length} bloc(s) programmés
              </span>
              <button
                onClick={onOpenBlocksModal}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Modifier le bloc</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* CARTE 2 : OBJECTIF COMPÉTITION & AFFÛTAGE (TAPERING) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900/40 to-black/40 border border-amber-500/30 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Trophy size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider m-0">
                    Objectif & Pic de Forme
                  </h3>
                  <p className="text-xs text-slate-400 m-0">
                    {targetCompetition ? targetCompetition.name : 'Aucune compétition configurée'}
                  </p>
                </div>
              </div>

              {targetCompetition && (
                <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {taperingAnalysis?.daysRemaining >= 0 ? `J-${taperingAnalysis.daysRemaining}` : 'Terminé'}
                </span>
              )}
            </div>

            {targetCompetition && taperingAnalysis ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Date Course</span>
                    <span className="text-xs font-mono font-bold text-white block mt-1">
                      {targetCompetition.date}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">TSB Projeté Jour J</span>
                    <span className="text-xs font-mono font-bold text-emerald-400 block mt-1">
                      {taperingAnalysis.projectedTsb > 0 ? `+${taperingAnalysis.projectedTsb}` : taperingAnalysis.projectedTsb}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Cible Idéale</span>
                    <span className="text-xs font-mono font-bold text-blue-300 block mt-1">
                      +{taperingAnalysis.targetTsb} TSB
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Protocole d'Affûtage :</span>
                    <span className="text-xs font-bold text-amber-300">{taperingAnalysis.statusBadge}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed m-0">
                    {taperingAnalysis.advice}
                  </p>
                </div>

                {targetCompetition.targetTime && (
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Clock size={13} className="text-amber-400" /> Chrono visé :
                    </span>
                    <span className="font-mono font-bold text-amber-300">{targetCompetition.targetTime}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 space-y-3 bg-white/[0.02] border border-dashed border-white/10 rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-200">Aucun objectif de course défini</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Renseignez la date de votre objectif clé (Marathon, Trail, Cyclosportive) pour modéliser votre courbe de décroissance et le pic TSB.
                </p>
                <button
                  onClick={onOpenCompetitionModal}
                  className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <Trophy size={14} /> Définir une Compétition
                </button>
              </div>
            )}
          </div>

          {targetCompetition && (
            <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                Modèle Banister Tapering actif
              </span>
              <button
                onClick={onOpenCompetitionModal}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Ajuster l'objectif</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* SECTION MODÈLES DE BLOCS STANDARDS (TEMPLATES) */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider m-0">
              Modèles de Blocs Prédéfinis & Protocoles Clés
            </h3>
          </div>
          <button
            onClick={onOpenBlocksModal}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
          >
            Voir tous les modèles ({templates.length})
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {templates.slice(0, 4).map(tmpl => (
            <div 
              key={tmpl.id}
              onClick={onOpenBlocksModal}
              className="p-4 rounded-xl bg-black/40 border border-white/10 hover:border-blue-500/40 hover:bg-blue-950/20 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors truncate">
                    {tmpl.name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300">
                    {tmpl.durationWeeks} sem.
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                  {tmpl.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-1 pt-2 border-t border-white/5">
                {tmpl.focusQualities.map(id => {
                  const qName = qualities.find(q => q.id === id)?.name || id;
                  return (
                    <span key={id} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {qName}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
