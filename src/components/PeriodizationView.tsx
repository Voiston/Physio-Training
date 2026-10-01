import React from 'react';
import { 
  Calendar, Trophy, FileText, Sliders, Zap, Shield, Plus, 
  Sparkles, CheckCircle2, ArrowRight, Activity, Clock, Flame 
} from 'lucide-react';
import { TrainingBlock, BlockTemplate, TargetCompetition } from '../hooks/useData';
import { getBlockProgress } from '../utils/physiology';

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

// Fonction de formatage littéral fluide des dates en français (ex: 29 sept. 2026)
function formatLiteralDate(dateInput: string | Date, includeYear = true): string {
  if (!dateInput) return '';
  let d: Date;
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('-');
    if (parts.length === 3) {
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = dateInput;
  }
  if (isNaN(d.getTime())) return String(dateInput);
  
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  return includeYear ? `${day} ${month} ${year}` : `${day} ${month}`;
}

// Formate un intervalle de dates : 29 sept. – 26 oct. 2026
function formatDateRange(startStr: string, endStr: string): string {
  if (!startStr || !endStr) return `${startStr || ''} – ${endStr || ''}`;
  const startParts = startStr.split('-').map(Number);
  const endParts = endStr.split('-').map(Number);
  if (startParts.length !== 3 || endParts.length !== 3) return `${startStr} – ${endStr}`;
  
  const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
  
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${formatLiteralDate(start, !sameYear)} – ${formatLiteralDate(end, true)}`;
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
  // Calcul de la progression du bloc de cycle actif
  const progress = React.useMemo(() => {
    if (!activeBlock) return null;
    return getBlockProgress(activeBlock);
  }, [activeBlock]);

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 w-full">
      {/* 1. HEADER SECTION DE LA PÉRIODISATION AVEC BOUTONS HARMONISÉS */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 shadow-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
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

        {/* Boutons d'action : 1 bouton principal plein + 3 actions secondaires neutres */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Action Principale */}
          <button
            onClick={onOpenBlocksModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-600/25 active:scale-95"
          >
            <Plus size={15} />
            <span>Gérer les Blocs</span>
          </button>

          {/* Boutons Secondaires Neutres */}
          <button
            onClick={onOpenCompetitionModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-200 hover:text-white text-xs sm:text-sm font-medium rounded-xl transition-all cursor-pointer"
            title="Configurer la course objectif et le protocole d'affûtage"
          >
            <Trophy size={15} className={targetCompetition ? "text-amber-400" : "text-slate-400"} />
            <span>{targetCompetition ? targetCompetition.name : 'Course Objectif'}</span>
          </button>

          <button
            onClick={onOpenPhysioSettingsModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-200 hover:text-white text-xs sm:text-sm font-medium rounded-xl transition-all cursor-pointer"
            title="Ajuster les constantes de temps de Banister (Fatigue et Fitness)"
          >
            <Sliders size={15} className="text-slate-400" />
            <span>Calibrage ({physioSettings?.tauFatigue || 7}j / {physioSettings?.tauFitness || 28}j)</span>
          </button>

          <button
            onClick={onOpenReportModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-200 hover:text-white text-xs sm:text-sm font-medium rounded-xl transition-all cursor-pointer"
            title="Générer un bilan synthétique imprimable"
          >
            <FileText size={15} className="text-slate-400" />
            <span>Bilan PDF</span>
          </button>
        </div>
      </div>

      {/* GRILLE CENTRALE 2 COLONNES : BLOC ACTIF VS AFFÛTAGE COMPÉTITION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CARTE 1 : BLOC DE PRÉPARATION ACTIF */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-blue-500/30 flex flex-col justify-between shadow-xl transition-all">
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
                  <p className="text-xs text-slate-300 font-medium m-0 mt-0.5">
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
                {/* 2. INTERVALLE DE DATES LISIBLE + PROGRESSION TEMPORELLE DU CYCLE */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar size={13} className="text-blue-400 shrink-0" />
                      <span className="text-slate-200 font-medium">
                        {formatDateRange(activeBlock.startDate, activeBlock.endDate)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 font-bold font-mono text-[11px]">
                      {activeBlock.durationWeeks} semaines
                    </span>
                  </div>

                  {/* Indicateur de progression temporelle */}
                  {progress && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <Clock size={12} className="text-blue-400" />
                            Semaine {progress.currentWeek} / {progress.totalWeeks}
                          </span>
                          <span className="px-2 py-0.2 rounded-md bg-blue-500/20 text-blue-300 font-bold text-[11px] border border-blue-500/30">
                            {progress.percent}%
                          </span>
                        </div>
                        <span className="text-slate-400 text-[11px]">
                          {progress.remainingDays > 0 
                            ? `${progress.remainingDays} j restants (Jour ${progress.currentDay}/${progress.totalDays})` 
                            : 'Cycle achevé'}
                        </span>
                      </div>
                      
                      {/* Barre de progression avec dégradé soigné */}
                      <div className="w-full bg-slate-950/80 rounded-full h-2.5 p-0.5 border border-white/10 overflow-hidden shadow-inner">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400 transition-all duration-700 shadow-sm shadow-blue-500/40"
                          style={{ width: `${Math.max(4, Math.min(100, progress.percent))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. QUALITÉS CIBLÉES : BADGES À CONTRASTE ÉLEVÉ & FOND ADOUCI */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                    <Zap size={13} className="text-rose-400 shrink-0" />
                    <span>Qualités ciblées en développement prioritaire (délais raccourcis x0.45) :</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-4">
                    {activeBlock.focusQualities.map(id => {
                      const qName = qualities.find(q => q.id === id)?.name || id;
                      return (
                        <span 
                          key={id} 
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-100 border border-rose-400/40 shadow-sm flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          {qName}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                    <Shield size={13} className="text-sky-400 shrink-0" />
                    <span>Qualités en Maintien (délais nominaux pleins) :</span>
                  </div>
                  <p className="text-xs text-slate-300 pl-4 leading-relaxed m-0">
                    Les autres filières conservent leur délai nominal de maintien pour préserver les adaptations sans surcharger la semaine.
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
                {blocks.length} bloc(s) programmés au total
              </span>
              <button
                onClick={onOpenBlocksModal}
                className="text-xs font-bold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Gérer les blocs</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* 4. CARTE 2 : OBJECTIF & PIC DE FORME REHAUSSÉE */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-amber-500/30 flex flex-col justify-between shadow-xl transition-all">
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
                  <p className="text-xs text-slate-300 font-medium m-0 mt-0.5">
                    {targetCompetition ? targetCompetition.name : 'Aucune compétition configurée'}
                  </p>
                </div>
              </div>

              {targetCompetition && (
                <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm">
                  {taperingAnalysis?.daysRemaining >= 0 ? `J-${taperingAnalysis.daysRemaining}` : 'Terminé'}
                </span>
              )}
            </div>

            {targetCompetition && taperingAnalysis ? (
              <div className="space-y-4">
                {/* Métriques KPI rehaussées avec grande typographie & code couleur sémantique */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Date Course */}
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date Course</span>
                    <div className="my-1">
                      <span className="text-sm sm:text-base font-black font-mono text-white block">
                        {formatLiteralDate(targetCompetition.date)}
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-300 font-mono font-semibold">
                      {taperingAnalysis?.daysRemaining >= 0 ? `J-${taperingAnalysis.daysRemaining}` : 'Terminé'}
                    </span>
                  </div>

                  {/* TSB Projeté Jour J */}
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TSB Projeté Jour J</span>
                    <div className="my-1">
                      <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight block ${
                        taperingAnalysis.projectedTsb >= 10 
                          ? 'text-emerald-400' 
                          : taperingAnalysis.projectedTsb >= 0 
                            ? 'text-sky-300' 
                            : 'text-amber-400'
                      }`}>
                        {taperingAnalysis.projectedTsb > 0 ? `+${taperingAnalysis.projectedTsb}` : taperingAnalysis.projectedTsb}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {taperingAnalysis.projectedTsb >= 10 && taperingAnalysis.projectedTsb <= 25 
                        ? '✅ Pic Optimal' 
                        : taperingAnalysis.projectedTsb > 25 
                          ? '⚠️ Sur-affûtage' 
                          : '⚡ En montée'}
                    </span>
                  </div>

                  {/* Cible Idéale */}
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cible Idéale</span>
                    <div className="my-1">
                      <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-blue-300 block">
                        +{taperingAnalysis.targetTsb}
                      </span>
                    </div>
                    <span className="text-[10px] text-blue-400 font-mono font-semibold">
                      Balance TSB
                    </span>
                  </div>
                </div>

                {/* Séparateur horizontal discret pour aérer */}
                <div className="border-t border-white/10 my-1" />

                {/* Protocole d'affûtage aéré */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-amber-500/20 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Activity size={14} className="text-amber-400 shrink-0" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Protocole d'Affûtage Scientifique
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {taperingAnalysis.statusBadge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed m-0 pl-1">
                    {taperingAnalysis.advice}
                  </p>
                </div>

                {targetCompetition.targetTime && (
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-slate-300 flex items-center gap-1.5">
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

      {/* 5. SECTION BIBLIOTHÈQUE DE MODÈLES DE BLOCS STANDARDS (TEMPLATES) */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
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
            Voir tous les modèles ({templates.length}) &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {templates.slice(0, 4).map(tmpl => (
            <div 
              key={tmpl.id}
              onClick={onOpenBlocksModal}
              className="p-4 rounded-xl bg-black/40 border border-white/10 hover:border-blue-500/40 hover:bg-slate-800/30 transition-all cursor-pointer flex flex-col justify-between group shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors truncate">
                    {tmpl.name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/10 text-slate-200 border border-white/5 font-semibold">
                    {tmpl.durationWeeks} sem.
                  </span>
                </div>
                {/* Description en texte clair et contrasté */}
                <p className="text-xs text-slate-300 line-clamp-2 mb-3 leading-relaxed">
                  {tmpl.description}
                </p>
              </div>

              {/* Badges de filières aérés avec gap et contraste élevé */}
              <div className="flex flex-wrap gap-2 pt-2.5 border-t border-white/10">
                {tmpl.focusQualities.map(id => {
                  const qName = qualities.find(q => q.id === id)?.name || id;
                  return (
                    <span 
                      key={id} 
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-200 border border-blue-400/25"
                    >
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

