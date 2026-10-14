import React from 'react';
import { 
  Calendar, Trophy, FileText, Sliders, Zap, Shield, Plus, 
  Sparkles, ArrowRight, Activity, Clock 
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
  fosterMetrics?: any;
  banisterPerformance?: any;
  cardioMuscularBalance?: any;
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
  physioSettings,
  onOpenBlocksModal,
  onOpenCompetitionModal,
  onOpenReportModal,
  onOpenPhysioSettingsModal,
  onApplyTemplate
}) => {
  // Calcul de la progression du bloc de cycle actif
  const progress = React.useMemo(() => {
    if (!activeBlock) return null;
    return getBlockProgress(activeBlock);
  }, [activeBlock]);

  return (
    <section 
      role="region" 
      aria-label="Vue Périodisation et Planification par Blocs" 
      className="p-4 md:p-6 flex flex-col gap-6 w-full"
    >
      {/* 1. HEADER SECTION DE LA PÉRIODISATION AVEC BOUTONS HARMONISÉS */}
      <header className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 shadow-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Calendar size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight m-0">
                Périodisation & Objectifs Athlétiques
              </h2>
              <p className="text-xs text-slate-300 m-0 mt-0.5">
                Cycles de développement par blocs, affûtage pré-course et calibrage physiologique
              </p>
            </div>
          </div>
        </div>

        {/* Boutons d'action : 1 bouton principal plein + 3 actions secondaires neutres */}
        <div className="flex flex-wrap items-center gap-2.5" role="toolbar" aria-label="Actions de périodisation">
          {/* Action Principale */}
          <button
            type="button"
            onClick={onOpenBlocksModal}
            className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-600/25 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <Plus size={16} aria-hidden="true" />
            <span>Gérer les Blocs</span>
          </button>

          {/* Boutons Secondaires Neutres */}
          <button
            type="button"
            onClick={onOpenCompetitionModal}
            aria-label={targetCompetition ? `Course objectif : ${targetCompetition.name}. Modifier l'objectif` : "Configurer une course objectif"}
            className="flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-200 hover:text-white text-xs sm:text-sm font-medium rounded-xl transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            title="Configurer la course objectif et le protocole d'affûtage"
          >
            <Trophy size={16} className={targetCompetition ? "text-amber-400" : "text-slate-400"} aria-hidden="true" />
            <span>{targetCompetition ? targetCompetition.name : 'Course Objectif'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenPhysioSettingsModal}
            aria-label={`Calibrage Banister : fatigue ${physioSettings?.tauFatigue || 7} jours, fitness ${physioSettings?.tauFitness || 28} jours`}
            className="flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-200 hover:text-white text-xs sm:text-sm font-medium rounded-xl transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            title="Ajuster les constantes de temps de Banister (Fatigue et Fitness)"
          >
            <Sliders size={16} className="text-slate-400" aria-hidden="true" />
            <span>Calibrage ({physioSettings?.tauFatigue || 7}j / {physioSettings?.tauFitness || 28}j)</span>
          </button>

          <button
            type="button"
            onClick={onOpenReportModal}
            aria-label="Générer un bilan synthétique imprimable en PDF"
            className="flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-200 hover:text-white text-xs sm:text-sm font-medium rounded-xl transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            title="Générer un bilan synthétique imprimable"
          >
            <FileText size={16} className="text-slate-400" aria-hidden="true" />
            <span>Bilan PDF</span>
          </button>
        </div>
      </header>

      {/* GRILLE CENTRALE 2 COLONNES : BLOC ACTIF VS AFFÛTAGE COMPÉTITION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CARTE 1 : BLOC DE PRÉPARATION ACTIF */}
        <article 
          aria-label="Cycle d'entraînement en cours" 
          className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-blue-500/30 flex flex-col justify-between shadow-xl transition-all"
        >
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Zap size={18} aria-hidden="true" />
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
                <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true"></span>
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
                      <Calendar size={14} className="text-blue-400 shrink-0" aria-hidden="true" />
                      <span className="text-slate-200 font-medium">
                        {formatDateRange(activeBlock.startDate, activeBlock.endDate)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-200 border border-blue-500/30 font-bold font-mono text-xs">
                      {activeBlock.durationWeeks} semaines
                    </span>
                  </div>

                  {/* Indicateur de progression temporelle */}
                  {progress && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <Clock size={13} className="text-blue-400" aria-hidden="true" />
                            Semaine {progress.currentWeek} / {progress.totalWeeks}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-200 font-bold text-xs border border-blue-500/30">
                            {progress.percent}%
                          </span>
                        </div>
                        <span className="text-slate-300 text-xs">
                          {progress.remainingDays > 0 
                            ? `${progress.remainingDays} j restants (Jour ${progress.currentDay}/${progress.totalDays})` 
                            : 'Cycle achevé'}
                        </span>
                      </div>
                      
                      {/* Barre de progression avec dégradé soigné */}
                      <div 
                        role="progressbar"
                        aria-valuenow={progress.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progression temporelle du cycle : semaine ${progress.currentWeek} sur ${progress.totalWeeks}, ${progress.percent}%`}
                        className="w-full bg-slate-950/80 rounded-full h-2.5 p-0.5 border border-white/10 overflow-hidden shadow-inner"
                      >
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
                    <Zap size={14} className="text-rose-400 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">Qualités ciblées en développement prioritaire (délais raccourcis x0.45) :</span>
                    <span className="sm:hidden">Développement prioritaire (x0.45) :</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-4">
                    {activeBlock.focusQualities.map(id => {
                      const qName = qualities.find(q => q.id === id)?.name || id;
                      return (
                        <span 
                          key={id} 
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-100 border border-rose-400/40 shadow-sm flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" aria-hidden="true" />
                          {qName}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                    <Shield size={14} className="text-sky-400 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">Qualités en Maintien (délais nominaux pleins) :</span>
                    <span className="sm:hidden">Qualités en Maintien :</span>
                  </div>
                  <p className="text-xs text-slate-300 pl-4 leading-relaxed m-0 block">
                    Les autres filières conservent leur délai nominal de maintien pour préserver les adaptations sans surcharger la semaine.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-3 bg-white/[0.02] border border-dashed border-white/10 rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-200">Aucun bloc de périodisation sélectionné</p>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Structurez vos prochaines semaines en choisissant un cycle spécifique (Force Max 4 sem., Seuil 3 sem., Volume 6 sem.) pour ordonner vos séances.
                </p>
                <button
                  type="button"
                  onClick={onOpenBlocksModal}
                  className="px-4 py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-md shadow-blue-600/25 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                >
                  <Plus size={16} aria-hidden="true" /> 
                  <span>Choisir ou Créer un Bloc</span>
                </button>
              </div>
            )}
          </div>

          {activeBlock && (
            <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-mono">
                {blocks.length} bloc(s) programmés au total
              </span>
              <button
                type="button"
                onClick={onOpenBlocksModal}
                className="min-h-[44px] px-2 py-1 text-xs font-bold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1.5 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <span>Gérer les blocs</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </article>

        {/* 4. CARTE 2 : OBJECTIF & PIC DE FORME REHAUSSÉE */}
        <article 
          aria-label="Objectif et pic de forme pré-compétition" 
          className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-amber-500/30 flex flex-col justify-between shadow-xl transition-all"
        >
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Trophy size={18} aria-hidden="true" />
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
                <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-sm">
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
                    <span className="text-xs uppercase font-bold text-slate-300 tracking-wider">Date Course</span>
                    <div className="my-1">
                      <span className="text-sm sm:text-base font-black font-mono text-white block">
                        {formatLiteralDate(targetCompetition.date)}
                      </span>
                    </div>
                    <span className="text-xs text-amber-300 font-mono font-semibold">
                      {taperingAnalysis?.daysRemaining >= 0 ? `J-${taperingAnalysis.daysRemaining}` : 'Terminé'}
                    </span>
                  </div>

                  {/* TSB Projeté Jour J */}
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between text-center">
                    <span className="text-xs uppercase font-bold text-slate-300 tracking-wider">TSB Jour J</span>
                    <div className="my-1">
                      <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight block ${
                        taperingAnalysis.projectedTsbPercent !== null
                          ? (taperingAnalysis.projectedTsbPercent >= 5 && taperingAnalysis.projectedTsbPercent <= 25 
                              ? 'text-emerald-400' 
                              : taperingAnalysis.projectedTsbPercent > 25 
                                ? 'text-amber-400' 
                                : 'text-sky-300')
                          : (taperingAnalysis.projectedTsb >= 10 ? 'text-emerald-400' : 'text-sky-300')
                      }`}>
                        {taperingAnalysis.projectedTsbPercent !== null
                          ? (taperingAnalysis.projectedTsbPercent > 0 ? `+${taperingAnalysis.projectedTsbPercent}%` : `${taperingAnalysis.projectedTsbPercent}%`)
                          : (taperingAnalysis.projectedTsb > 0 ? `+${taperingAnalysis.projectedTsb} pts` : `${taperingAnalysis.projectedTsb} pts`)}
                      </span>
                    </div>
                    <span className="text-xs text-slate-300 font-mono">
                      {taperingAnalysis.projectedTsbPercent !== null
                        ? (taperingAnalysis.projectedTsbPercent >= 5 && taperingAnalysis.projectedTsbPercent <= 25
                            ? '✅ Pic Optimal'
                            : taperingAnalysis.projectedTsbPercent > 25
                              ? '⚠️ Sur-affûtage'
                              : '⚡ En montée')
                        : (taperingAnalysis.projectedTsb >= 10 && taperingAnalysis.projectedTsb <= 25 ? '✅ Pic Optimal' : '⚡ En montée')}
                    </span>
                  </div>

                  {/* Cible Idéale */}
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between text-center">
                    <span className="text-xs uppercase font-bold text-slate-300 tracking-wider">Cible Idéale</span>
                    <div className="my-1">
                      <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-blue-300 block">
                        +{taperingAnalysis.targetTsb}{taperingAnalysis.targetTsbUnit === 'percent' ? '% CTL' : ' pts'}
                      </span>
                    </div>
                    <span className="text-xs text-blue-300 font-mono font-semibold">
                      {taperingAnalysis.targetTsbUnit === 'percent' ? 'Fraîcheur relative' : 'Balance TSB'}
                    </span>
                  </div>
                </div>

                {/* Séparateur horizontal discret pour aérer */}
                <div className="border-t border-white/10 my-1" />

                {/* Protocole d'affûtage aéré */}
                <div 
                  role="region" 
                  aria-label="Protocole d'affûtage scientifique pour la compétition"
                  className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-amber-500/20 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Activity size={14} className="text-amber-400 shrink-0" aria-hidden="true" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider m-0">
                        Protocole d'Affûtage Scientifique
                      </h4>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-200 border border-amber-500/40">
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
                      <Clock size={13} className="text-amber-400" aria-hidden="true" /> Chrono visé :
                    </span>
                    <span className="font-mono font-bold text-amber-300">{targetCompetition.targetTime}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 space-y-3 bg-white/[0.02] border border-dashed border-white/10 rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-200">Aucun objectif de course défini</p>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Renseignez la date de votre objectif clé (Marathon, Trail, Cyclosportive) pour modéliser votre courbe de décroissance et le pic TSB.
                </p>
                <button
                  type="button"
                  onClick={onOpenCompetitionModal}
                  className="px-4 py-2.5 min-h-[44px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-md active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                >
                  <Trophy size={16} aria-hidden="true" /> 
                  <span>Définir une Compétition</span>
                </button>
              </div>
            )}
          </div>

          {targetCompetition && (
            <div className="pt-4 border-t border-white/10 mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-mono">
                Modèle Banister Tapering actif
              </span>
              <button
                type="button"
                onClick={onOpenCompetitionModal}
                className="min-h-[44px] px-2 py-1 text-xs font-bold text-amber-300 hover:text-amber-200 inline-flex items-center gap-1.5 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <span>Ajuster l'objectif</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </article>

      </div>

      {/* 5. SECTION BIBLIOTHÈQUE DE MODÈLES DE BLOCS STANDARDS (TEMPLATES) */}
      <section 
        aria-label="Bibliothèque de modèles de blocs standards"
        className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" aria-hidden="true" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider m-0">
              Modèles de Blocs Prédéfinis & Protocoles Clés
            </h3>
          </div>
          <button
            type="button"
            onClick={onOpenBlocksModal}
            className="min-h-[44px] px-2.5 py-1 text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 inline-flex items-center gap-1"
          >
            <span>Voir tous les modèles ({templates.length})</span>
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {templates.slice(0, 4).map(tmpl => {
            const focusNames = tmpl.focusQualities.map(id => qualities.find(q => q.id === id)?.name || id).join(', ');
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => {
                  if (onApplyTemplate) {
                    onApplyTemplate(tmpl);
                  } else {
                    onOpenBlocksModal();
                  }
                }}
                aria-label={`Modèle ${tmpl.name}, durée ${tmpl.durationWeeks} semaines. Description : ${tmpl.description}. Filières ciblées : ${focusNames}. Cliquer pour charger dans la programmation.`}
                className="p-4 rounded-xl bg-black/40 border border-white/10 hover:border-blue-500/40 hover:bg-slate-800/30 transition-all cursor-pointer flex flex-col justify-between group shadow-md text-left min-h-[140px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                <div className="w-full">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors truncate">
                      {tmpl.name}
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-white/10 text-slate-100 border border-white/10 font-semibold">
                      {tmpl.durationWeeks} sem.
                    </span>
                  </div>
                  {/* Description en texte clair et contrasté */}
                  <p className="text-xs text-slate-300 line-clamp-2 mb-3 leading-relaxed">
                    {tmpl.description}
                  </p>
                </div>

                {/* Badges de filières aérés avec gap et contraste élevé */}
                <div className="flex flex-wrap gap-2 pt-2.5 border-t border-white/10 w-full">
                  {tmpl.focusQualities.map(id => {
                    const qName = qualities.find(q => q.id === id)?.name || id;
                    return (
                      <span 
                        key={id} 
                        className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-100 border border-blue-400/30"
                      >
                        {qName}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
};

