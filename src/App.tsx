import { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from './firebase';
import { generateTimeline, formatDisplayDate, getLocalYYYYMMDD } from './utils/dateHelpers';
import { useData } from './hooks/useData';
import { getBlockProgress } from './utils/physiology';
import Grid from './components/Grid';
import RadarChart from './components/RadarChart';
import SmartSuggestions from './components/SmartSuggestions';
import { SimulationBanner } from './components/SimulationBanner';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ToastProvider, useToast } from './components/Toast';

// Vues découpées en code-splitting asynchrone (chargement à la demande par onglet)
const MetricsDashboard = lazy(() => import('./components/MetricsDashboard'));
const WeeklyAnalysisView = lazy(() => import('./components/WeeklyAnalysisView').then(m => ({ default: m.WeeklyAnalysisView })));
const PeriodizationView = lazy(() => import('./components/PeriodizationView').then(m => ({ default: m.PeriodizationView })));

// Modales découpées en code-splitting (chargées uniquement lors de l'interaction utilisateur)
const ScoreModal = lazy(() => import('./components/ScoreModal'));
const MetricModal = lazy(() => import('./components/MetricModal'));
const QualityChartModal = lazy(() => import('./components/QualityChartModal'));
const TrainingBlocksModal = lazy(() => import('./components/TrainingBlocksModal'));
const CompetitionModal = lazy(() => import('./components/CompetitionModal').then(m => ({ default: m.CompetitionModal })));
const TrainingReportModal = lazy(() => import('./components/TrainingReportModal').then(m => ({ default: m.TrainingReportModal })));
const PhysiologicalSettingsModal = lazy(() => import('./components/PhysiologicalSettingsModal').then(m => ({ default: m.PhysiologicalSettingsModal })));
const LiveGymModal = lazy(() => import('./components/LiveGymModal').then(m => ({ default: m.LiveGymModal })));
const CloudSyncModal = lazy(() => import('./components/CloudSyncModal').then(m => ({ default: m.CloudSyncModal })));

const ViewFallback = () => (
  <div className="w-full min-h-[380px] flex flex-col items-center justify-center p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md animate-pulse">
    <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
    <span className="text-xs text-slate-400 font-mono">Chargement du module d'analyse...</span>
  </div>
);
import { haptics } from './utils/haptics';
import { computeAllWeeksStats } from './utils/weekHelpers';
import { 
  computeWeeklyMuscularSummary, 
  computeMuscularAlerts, 
  getSavedCustomExercises 
} from './utils/muscleHelpers';
import { 
  FileUp, FileDown, Activity, Calendar, Zap, Shield, Plus, 
  Trophy, FileText, Sparkles, Sliders, TrendingUp, Layers, Target,
  PanelLeftClose, PanelLeftOpen, BarChart3, Dumbbell, Cloud,
  MoreVertical, X
} from 'lucide-react';

function AppContent() {
  const { 
    events, 
    qualities, 
    moveQuality,
    reorderQualities,
    reorderByBlockFocus,
    reorderByUrgency,
    resetQualitiesOrder,
    dailyMetrics, 
    trainingBlocks,
    activeBlockToday,
    saveTrainingBlock,
    deleteTrainingBlock,
    blockTemplates,
    saveBlockTemplate,
    resetBlockTemplates,
    trainingRecommendations,
    qualitiesEMA, 
    saveEventWithImpacts, 
    saveDailyMetric, 
    exportData, 
    importData,
    // Compétition & Tapering
    targetCompetition,
    saveTargetCompetition,
    fosterMetrics,
    taperingAnalysis,
    banisterPerformance,
    // Constantes physiologiques
    physioSettings,
    savePhysioSettings,
    // Modélisation physiologique avancée
    cardioMuscularBalance,
    intensityDistribution,
    perceivedFatigueAnalysis,
    // Simulation (What-If)
    isSimulationActive,
    simulatedEvents,
    toggleSimulation,
    addSimulatedEvent,
    applySimulationScenario,
    clearSimulation,
    commitSimulation,
    // Synchronisation Cloud Smartphone ↔ PC
    cloudSync
  } = useData();

  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'grid' | 'weeks' | 'physiology' | 'qualities' | 'periodization'>('grid');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [modalInfo, setModalInfo] = useState<any>(null);
  const [metricModalInfo, setMetricModalInfo] = useState<any>(null);
  const [qualityChartInfo, setQualityChartInfo] = useState<any>(null);
  const [showBlocksModal, setShowBlocksModal] = useState<boolean>(false);
  const [showCompetitionModal, setShowCompetitionModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showPhysioSettingsModal, setShowPhysioSettingsModal] = useState<boolean>(false);
  const [showLiveGymModal, setShowLiveGymModal] = useState<boolean>(false);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState<boolean>(false);
  const [hasGymDraft, setHasGymDraft] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem('training_live_session_draft_v1'));
    } catch {
      return false;
    }
  });

  // États dédiés à l'ergonomie mobile
  const [showMobileTools, setShowMobileTools] = useState<boolean>(false);
  const [mobileGridTab, setMobileGridTab] = useState<'grid' | 'athlete'>('grid');

  // Coupure réseau Firestore pendant la séance live : le modem radio peut dormir, toutes les données sont locales
  useEffect(() => {
    if (showLiveGymModal) {
      disableNetwork(db).catch(() => {});
    } else {
      enableNetwork(db).catch(() => {});
    }
  }, [showLiveGymModal]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayStr = useMemo(() => getLocalYYYYMMDD(new Date()), []);
  const blockProgress = useMemo(() => {
    return activeBlockToday ? getBlockProgress(activeBlockToday, todayStr) : null;
  }, [activeBlockToday, todayStr]);

  // Statistiques de la semaine en cours
  const currentWeekStats = useMemo(() => {
    const weeks = computeAllWeeksStats(events, qualities, 1, 0);
    return weeks.find(w => w.isCurrentWeek) || weeks[weeks.length - 1];
  }, [events, qualities]);

  // Alertes biomécaniques et musculaires de la semaine courante (H:Q, Pull:Push, MRV)
  const currentMuscularAlerts = useMemo(() => {
    if (!currentWeekStats) return [];
    const customCatalog = getSavedCustomExercises();
    const summary = computeWeeklyMuscularSummary(events, currentWeekStats.startDate, currentWeekStats.endDate, customCatalog);
    return computeMuscularAlerts(summary);
  }, [events, currentWeekStats]);

  const timeline = useMemo(() => {
    return generateTimeline(21, 14).map(day => ({
      ...day,
      display: formatDisplayDate(day.dateObj, day.offset)
    }));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0c] bg-[radial-gradient(ellipse_80%_80%_at_10%_-20%,rgba(30,58,138,0.18),transparent),radial-gradient(ellipse_80%_80%_at_90%_120%,rgba(153,27,27,0.12),transparent)] text-slate-100 font-sans p-2 sm:p-4 md:p-6 pb-24 md:pb-6 overflow-x-hidden relative">
      {/* Skip-link d'accès direct au contenu pour navigation clavier et lecteurs d'écran */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:font-bold focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white transition-all"
      >
        Passer au contenu principal
      </a>

      {/* Indicateur mode hors-ligne */}
      <OfflineIndicator />

      <div className="relative z-10 flex flex-col h-full gap-5 max-w-[1550px] mx-auto">
        
        {/* Header Section */}
        <header className="flex flex-wrap items-center justify-between px-4 lg:px-6 py-3.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md shadow-2xl gap-4" role="banner">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-xl shadow-inner border border-blue-500/30 text-blue-400">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-white">PhysioTracker</span>
                <span className="text-xs text-blue-400 font-mono font-semibold">Pro</span>
              </div>
              <p className="text-[11px] text-slate-400 tracking-wide hidden sm:block m-0">
                Périodisation par Blocs · Modélisation Banister & Courbes EMA
              </p>
            </div>
          </div>
          
          {/* BOUTONS D'ACTIONS DESKTOP (Inchangés, masqués sur mobile) */}
          <div className="hidden md:flex items-center gap-2">
            {/* Bouton PWA Install */}
            <PWAInstallButton />

            {/* Bouton Synchronisation Cloud Smartphone ↔ PC */}
            <button
              onClick={() => setShowCloudSyncModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border ${
                cloudSync.syncStatus === 'synced'
                  ? 'bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/40 text-blue-300'
                  : cloudSync.syncStatus === 'syncing'
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
              title="Synchronisation automatique temps réel entre votre smartphone et votre PC"
            >
              <Cloud size={15} className={cloudSync.syncStatus === 'syncing' ? 'animate-spin text-amber-400' : 'text-blue-400'} aria-hidden="true" />
              <span className="hidden sm:inline">Synchro Cloud</span>
              <span className="sm:hidden">Sync</span>
              {cloudSync.syncStatus === 'synced' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              )}
            </button>

            {/* Bouton Mode Salle / Live Gym Tracker */}
            <button
              onClick={() => {
                haptics.modeSwitch();
                setShowLiveGymModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/10 group"
              title="Lancer le Mode Salle : suivi tactile en direct, minuteur de repos et charge adaptative"
            >
              <Dumbbell size={15} className="text-emerald-400 group-hover:rotate-12 transition-transform" aria-hidden="true" />
              <span>Mode Salle</span>
              {hasGymDraft && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" title="Séance en cours" />
              )}
            </button>

            {/* Bouton Mode Simulation (What-If) */}
            <button
              onClick={() => {
                haptics.modeSwitch();
                toggleSimulation();
                showToast({
                  type: 'info',
                  title: isSimulationActive ? 'Simulation désactivée' : 'Mode simulation activé',
                  message: isSimulationActive ? 'Retour aux charges réelles.' : 'Testez des séances prévisionnelles sur 14 jours.'
                });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border ${
                isSimulationActive 
                  ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/25' 
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
              title="Tester des séances prévisionnelles et anticiper la forme (TSB) future"
            >
              <Sparkles size={14} className={isSimulationActive ? 'text-purple-200' : 'text-purple-400'} />
              <span>{isSimulationActive ? 'Simulation Active' : 'Simulation'}</span>
            </button>

            {/* Bouton Calibrage Constantes Physiologiques */}
            <button
              onClick={() => setShowPhysioSettingsModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              title="Calibrer les constantes de rémanence Banister (tau fatigue 5-12j, tau condition 21-45j)"
            >
              <Sliders size={14} className="text-blue-400 shrink-0" />
              <span className="font-mono">τ₁:{physioSettings.tauFatigue}j τ₂:{physioSettings.tauFitness}j</span>
            </button>

            {/* Bouton Export Bilan PDF */}
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              title="Générer un bilan hebdomadaire ou mensuel PDF pour votre entraîneur"
            >
              <FileText size={14} className="text-blue-400 shrink-0" />
              <span>Bilan PDF</span>
            </button>

            {/* Import / Export JSON */}
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl transition-all cursor-pointer"
              title="Importer des données JSON"
            >
              <FileUp size={14} />
            </button>
            <button 
              onClick={() => {
                exportData();
                showToast({
                  type: 'success',
                  title: 'Données exportées',
                  message: 'Fichier de sauvegarde JSON téléchargé.'
                });
              }} 
              className="p-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-xl transition-all cursor-pointer"
              title="Exporter toutes les données en JSON"
            >
              <FileDown size={14} />
            </button>
          </div>

          {/* ACTIONS RAPIDES MOBILE (Compact, épuré, sans surcharge) */}
          <div className="flex md:hidden items-center gap-2">
            {/* Synchro Cloud Mobile */}
            <button
              onClick={() => setShowCloudSyncModal(true)}
              className={`p-2 rounded-xl border text-xs font-semibold touch-press cursor-pointer flex items-center gap-1 active:scale-90 transition-all ${
                cloudSync.syncStatus === 'synced'
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                  : cloudSync.syncStatus === 'syncing'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 text-slate-300 border-white/10 active:bg-white/15'
              }`}
              title="Synchronisation Cloud"
            >
              <Cloud size={16} className={cloudSync.syncStatus === 'syncing' ? 'animate-spin text-amber-400' : 'text-blue-400'} />
              {cloudSync.syncStatus === 'synced' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              )}
            </button>

            {/* Bouton Menu Outils Mobile */}
            <button
              onClick={() => {
                haptics.tap();
                setShowMobileTools(prev => !prev);
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 touch-press active:scale-90 active:bg-white/15 transition-all"
              title="Outils et réglages"
            >
              <MoreVertical size={16} />
            </button>
          </div>

          {/* Input file caché pour Import JSON */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => {
              importData(
                e,
                () => {
                  showToast({
                    type: 'success',
                    title: 'Importation effectuée',
                    message: 'Données et historique restaurés.'
                  });
                },
                (errorMsg) => {
                  showToast({
                    type: 'error',
                    title: "Échec de l'importation",
                    message: errorMsg
                  });
                }
              );
            }} 
            accept=".json,application/json" 
            className="hidden" 
          />
        </header>

        {/* TIROIR D'OUTILS ET PARAMÈTRES POUR MOBILE */}
        {showMobileTools && (
          <div 
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm md:hidden animate-fadeIn"
            onClick={() => setShowMobileTools(false)}
          >
            <div 
              className="w-full bg-[#121217] border-t border-white/15 rounded-t-3xl p-5 shadow-2xl flex flex-col gap-3.5 pb-[max(env(safe-area-inset-bottom,0px),20px)] animate-sheet-up"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                    <Sliders size={15} />
                  </div>
                  <span className="font-bold text-sm text-white">Outils & Actions Rapides</span>
                </div>
                <button 
                  onClick={() => setShowMobileTools(false)}
                  className="p-1.5 rounded-xl bg-white/5 text-slate-400 hover:text-white touch-press active:scale-90"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {/* Simulation What-If */}
                <button
                  onClick={() => {
                    haptics.modeSwitch();
                    setShowMobileTools(false);
                    toggleSimulation();
                    showToast({
                      type: 'info',
                      title: isSimulationActive ? 'Simulation désactivée' : 'Mode simulation activé',
                      message: isSimulationActive ? 'Retour aux charges réelles.' : 'Testez des séances prévisionnelles sur 14 jours.'
                    });
                  }}
                  className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold border touch-press active:scale-[0.96] text-left ${
                    isSimulationActive 
                      ? 'bg-purple-600/30 border-purple-400 text-purple-200 active:bg-purple-600/40' 
                      : 'bg-white/5 border-white/10 text-slate-200 active:bg-white/10 active:border-white/20'
                  }`}
                >
                  <Sparkles size={16} className="text-purple-400 shrink-0" />
                  <div>
                    <div className="font-bold">Simulation</div>
                    <div className="text-[10px] text-slate-400">{isSimulationActive ? 'Désactiver' : 'What-If (14j)'}</div>
                  </div>
                </button>

                {/* Bilan PDF */}
                <button
                  onClick={() => {
                    setShowMobileTools(false);
                    setShowReportModal(true);
                  }}
                  className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-slate-200 touch-press active:scale-[0.96] active:bg-white/10 active:border-white/20 text-left"
                >
                  <FileText size={16} className="text-blue-400 shrink-0" />
                  <div>
                    <div className="font-bold">Bilan PDF</div>
                    <div className="text-[10px] text-slate-400">Export rapport</div>
                  </div>
                </button>

                {/* Calibrage Banister */}
                <button
                  onClick={() => {
                    setShowMobileTools(false);
                    setShowPhysioSettingsModal(true);
                  }}
                  className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-slate-200 touch-press active:scale-[0.96] active:bg-white/10 active:border-white/20 text-left"
                >
                  <Sliders size={16} className="text-blue-400 shrink-0" />
                  <div>
                    <div className="font-bold">Constantes τ</div>
                    <div className="text-[10px] text-slate-400 font-mono">τ₁:{physioSettings.tauFatigue}j τ₂:{physioSettings.tauFitness}j</div>
                  </div>
                </button>

                {/* Bouton PWA Install */}
                <div className="flex items-center p-2.5 rounded-xl bg-white/5 border border-white/10 touch-press active:scale-[0.96]">
                  <PWAInstallButton />
                </div>

                {/* Import JSON */}
                <button
                  onClick={() => {
                    setShowMobileTools(false);
                    fileInputRef.current?.click();
                  }}
                  className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-slate-200 touch-press active:scale-[0.96] active:bg-white/10 active:border-white/20 text-left"
                >
                  <FileUp size={16} className="text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold">Importer JSON</div>
                    <div className="text-[10px] text-slate-400">Restaurer fichier</div>
                  </div>
                </button>

                {/* Export JSON */}
                <button
                  onClick={() => {
                    setShowMobileTools(false);
                    exportData();
                    showToast({
                      type: 'success',
                      title: 'Données exportées',
                      message: 'Fichier de sauvegarde JSON téléchargé.'
                    });
                  }}
                  className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-300 touch-press active:scale-[0.96] active:bg-blue-500/20 text-left"
                >
                  <FileDown size={16} className="text-blue-400 shrink-0" />
                  <div>
                    <div className="font-bold">Exporter JSON</div>
                    <div className="text-[10px] text-slate-400">Sauvegarde locale</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BARRE D'ONGLETS PRINCIPALE (Visible sur desktop et tablettes, gérée en bas sur smartphone) */}
        <nav className="hidden md:flex items-center gap-1.5 p-1.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-x-auto custom-scrollbar shadow-lg">
          <button
            onClick={() => setActiveTab('grid')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'grid'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar size={15} />
            <span>Grille & Planification</span>
          </button>

          <button
            onClick={() => setActiveTab('weeks')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'weeks'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 size={15} />
            <span>Totaux & Semaines</span>
            {currentWeekStats && (
              <span className={`inline-flex items-center justify-center h-5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border shrink-0 ${
                currentWeekStats.comparison.percentLoadChange !== null && currentWeekStats.comparison.percentLoadChange > 15
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : currentWeekStats.comparison.percentLoadChange !== null && currentWeekStats.comparison.percentLoadChange < -15
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                  : 'bg-white/10 text-slate-200 border-white/10'
              }`}>
                {currentWeekStats.totalLoad} UA
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('physiology')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'physiology'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp size={15} />
            <span>Analyses Banister</span>
            <span className={`inline-flex items-center justify-center h-5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border shrink-0 ${
              (banisterPerformance?.current?.tsb ?? 0) >= 0 
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}>
              {(banisterPerformance?.current?.tsb ?? 0) >= 0 ? `+${banisterPerformance?.current?.tsb ?? 0}` : banisterPerformance?.current?.tsb} TSB
            </span>
          </button>

          <button
            onClick={() => setActiveTab('qualities')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'qualities'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers size={15} />
            <span>Qualités EMA</span>
            <span className="inline-flex items-center justify-center h-5 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-white/10 text-slate-300 border border-white/10 shrink-0">
              {qualities.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('periodization')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'periodization'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Target size={15} />
            <span>Cycles & Objectifs</span>
            {activeBlockToday ? (
              <span className="inline-flex items-center justify-center h-5 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 truncate max-w-[120px] shrink-0">
                {activeBlockToday.name}
              </span>
            ) : targetCompetition ? (
              <span className="inline-flex items-center justify-center h-5 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                J-{taperingAnalysis?.daysRemaining}
              </span>
            ) : null}
          </button>
        </nav>

        {/* Bannière active du mode Simulation What-If */}
        <SimulationBanner
          isActive={isSimulationActive}
          simulatedEvents={simulatedEvents}
          qualities={qualities}
          onToggle={toggleSimulation}
          onApplyScenario={applySimulationScenario}
          onAddSimulatedSession={addSimulatedEvent}
          onClear={clearSimulation}
          onCommit={() => {
            commitSimulation();
            showToast({
              title: 'Simulation validée',
              message: 'Séances intégrées au calendrier réel avec propagation des impacts.',
              type: 'success'
            });
          }}
        />

        {/* CONTENU SELON L'ONGLET ACTIF (Encapsulé dans le repère sémantique main) */}
        <main id="main-content" tabIndex={-1} className="flex flex-col gap-5 focus:outline-none" role="main">

        {/* ONGLET 1 : GRILLE & PLANIFICATION */}
        {activeTab === 'grid' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            {/* Bascule Mobile : Grille vs Profil Athlète (évite de scroller 900px sur téléphone avant d'atteindre la grille) */}
            <div className="flex xl:hidden items-center p-1 bg-white/5 border border-white/10 rounded-2xl shadow-sm">
              <button
                type="button"
                onClick={() => {
                  haptics.modeSwitch();
                  setMobileGridTab('grid');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer touch-press active:scale-95 ${
                  mobileGridTab === 'grid'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white active:bg-white/5'
                }`}
              >
                <Calendar size={14} className={mobileGridTab === 'grid' ? 'scale-110 transition-transform' : ''} />
                <span>Grille des Séances</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.modeSwitch();
                  setMobileGridTab('athlete');
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer touch-press active:scale-95 ${
                  mobileGridTab === 'athlete'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white active:bg-white/5'
                }`}
              >
                <Activity size={14} className={mobileGridTab === 'athlete' ? 'scale-110 transition-transform' : ''} />
                <span>Profil Athlète & Cycle</span>
              </button>
            </div>

            {/* Barre d'outils secondaire Desktop : Masquer / Afficher le volet athlète latéral */}
            <div className="hidden xl:flex items-center justify-between px-1">
              <button
                onClick={() => setIsSidebarOpen(prev => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer shadow-sm"
                title={isSidebarOpen ? "Masquer le volet athlète pour étendre la grille de planification au maximum" : "Afficher le profil athlétique et le bloc actif"}
              >
                {isSidebarOpen ? (
                  <PanelLeftClose size={15} className="text-blue-400 shrink-0" />
                ) : (
                  <PanelLeftOpen size={15} className="text-blue-400 shrink-0" />
                )}
                <span>{isSidebarOpen ? "Masquer volet athlète (Plein écran)" : "Afficher volet athlète (Radar & Bloc)"}</span>
              </button>

              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span>Matrice d'entraînement :</span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-slate-300">
                  {qualities.length} qualités · -14j à +14j
                </span>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 min-h-0">
              {/* Left Sidebar (escamotable sur desktop, contrôlée par bascule sur mobile) */}
              {(isSidebarOpen || mobileGridTab === 'athlete') && (
                <aside className={`${mobileGridTab === 'athlete' ? 'flex' : 'hidden'} xl:flex xl:w-80 flex-col gap-5 shrink-0 transition-all`}>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md shadow-xl">
                    <RadarChart 
                      qualities={qualities} 
                      events={events} 
                      dailyMetrics={dailyMetrics} 
                      trainingBlocks={trainingBlocks}
                    />
                  </div>

                  {/* Widget Bloc de Préparation Actif */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md shadow-xl">
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 m-0">
                        <Calendar size={13} className="text-blue-400" />
                        Cycle de Préparation
                      </h3>
                      <button
                        onClick={() => setShowBlocksModal(true)}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline"
                      >
                        {activeBlockToday ? 'Gérer' : 'Planifier'}
                      </button>
                    </div>

                    {activeBlockToday ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-gradient-to-r from-blue-950/40 via-purple-950/20 to-transparent border border-blue-500/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm text-white">{activeBlockToday.name}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Sem. {blockProgress?.currentWeek}/{activeBlockToday.durationWeeks}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 font-mono mb-2">
                            Fin le {activeBlockToday.endDate} • reste {blockProgress?.remainingDays} j
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500 shimmer-bar" 
                              style={{ width: `${blockProgress?.percent || 0}%` }}
                            />
                          </div>

                          {/* Impacts Summary */}
                          <div className="space-y-1.5 text-[11px] border-t border-white/5 pt-2">
                            <div className="flex items-center gap-1.5 text-red-300">
                              <Zap size={11} className="text-red-400 shrink-0" />
                              <span className="font-semibold">Fréquence de développement (x0.45 · 2-3x/sem) :</span>
                            </div>
                            <p className="text-[10px] text-slate-400 pl-4 leading-tight m-0">
                              {activeBlockToday.focusQualities.map(id => qualities.find(q => q.id === id)?.name || id).join(', ')}
                            </p>

                            <div className="flex items-center gap-1.5 text-sky-300 pt-1">
                              <Shield size={11} className="text-sky-400 shrink-0" />
                              <span className="font-semibold">Maintien nominal (x1.0 · rémanence pleine) :</span>
                            </div>
                            <p className="text-[10px] text-slate-400 pl-4 leading-tight m-0">
                              Qualités hors-bloc protégées selon leur durée nominale de rémanence.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center">
                        <p className="text-xs text-slate-300 font-medium mb-1">Aucun bloc actif</p>
                        <p className="text-[10px] text-slate-500 mb-3">
                          Déclarez un bloc spécifique (ex: Force max 4 sem., Seuil/VMA 3 sem.) pour rythmer votre progression.
                        </p>
                        <button
                          onClick={() => setShowBlocksModal(true)}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Plus size={13} /> Déclarer un bloc (3, 4, 6 sem.)
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Guide Physiologique EMA (Déroulant sur mobile pour désencombrer, ouvert sur grand écran) */}
                  <details className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-xl text-slate-200 group xl:open">
                    <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider m-0">
                          Guide Physiologique EMA
                        </h3>
                        <span className="text-[10px] text-blue-400 font-mono">Banister</span>
                      </div>
                      <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform font-bold">
                        ▼
                      </span>
                    </summary>

                    <div className="space-y-2.5 mt-3 border-t border-white/10 pt-3">
                      {/* EMA 3j */}
                      <div className="p-2.5 rounded-xl bg-slate-900/60 border border-sky-500/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0"></span>
                          <span className="text-xs font-bold text-sky-300">EMA 3j · Fatigue Aiguë (Court Terme)</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed m-0 pl-4">
                          Stress immédiat du système nerveux. Décroît rapidement après 48h à 72h de repos.
                        </p>
                      </div>

                      {/* EMA 7j */}
                      <div className="p-2.5 rounded-xl bg-slate-900/60 border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>
                          <span className="text-xs font-bold text-blue-300">EMA 7j · Charge Récente (ATL)</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed m-0 pl-4">
                          Fatigue accumulée sur la semaine. Pilote le ratio de surcharge (ACWR).
                        </p>
                      </div>

                      {/* EMA 21j */}
                      <div className="p-2.5 rounded-xl bg-slate-900/60 border border-indigo-500/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
                          <span className="text-xs font-bold text-indigo-300">EMA 21j · Charge Chronique Filière</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed m-0 pl-4">
                          Fitness de fond acquis sur le cycle. Résistance structurelle à l'effort.
                        </p>
                      </div>

                      {/* TSB */}
                      <div className="p-2.5 rounded-xl bg-slate-900/60 border border-emerald-500/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                          <span className="text-xs font-bold text-emerald-300">Balance de Forme (TSB)</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed m-0 pl-4">
                          CTL − ATL. Visez +5% à +25% de la CTL le Jour J (+10 à +25 pts selon profil) pour un affûtage optimal en compétition.
                        </p>
                      </div>
                    </div>
                  </details>
                </aside>
              )}

              {/* Center Content */}
              <main className={`${mobileGridTab === 'grid' ? 'flex' : 'hidden'} xl:flex flex-1 min-w-0 flex-col gap-5`}>
                {/* Suggestions & Priorités d'entraînement algorithmiques */}
                <SmartSuggestions 
                  recommendations={trainingRecommendations}
                  activeBlock={activeBlockToday}
                  muscularAlerts={currentMuscularAlerts}
                  onNavigateToMuscles={() => setActiveTab('weeks')}
                  onOpenSessionModal={(q) => {
                    setModalInfo({ 
                      qId: q.id, 
                      qName: q.name, 
                      dateStr: todayStr, 
                      currentData: events[q.id]?.[todayStr] 
                    });
                  }}
                  onReorderByUrgency={reorderByUrgency}
                  onReorderByBlock={() => reorderByBlockFocus(activeBlockToday)}
                  onResetOrder={resetQualitiesOrder}
                />

                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-x-auto backdrop-blur-md shadow-xl custom-scrollbar flex-1 w-full">
                <Grid 
                  timeline={timeline} 
                  events={events} 
                  qualities={qualities} 
                  dailyMetrics={dailyMetrics}
                  qualitiesEMA={qualitiesEMA}
                  trainingBlocks={trainingBlocks}
                  moveQuality={moveQuality}
                  reorderQualities={reorderQualities}
                  onCellClick={(q: any, dateStr: string, currentData: any) => setModalInfo({ qId: q.id, qName: q.name, dateStr, currentData })}
                  onQualityClick={(q: any) => setQualityChartInfo(q)}
                  onMetricClick={(dateStr: string, type: string, currentValue: any) => {
                    let title = 'Métrique Physiologique';
                    let label = 'Valeur';
                    let min = 1;
                    let max = 300;
                    let placeholder = 'Ex: 50';

                    if (type === 'readiness') {
                      title = 'Readiness Score';
                      label = 'Score de Forme (1 à 10)';
                      min = 1;
                      max = 10;
                      placeholder = 'Ex: 7';
                    } else if (type === 'vfc') {
                      title = 'VFC Matinale';
                      label = 'Valeur VFC RMSSD (ms)';
                      min = 10;
                      max = 300;
                      placeholder = 'Ex: 65';
                    } else if (type === 'hrRest') {
                      title = 'FC de Repos Matinale';
                      label = 'Fréquence Cardiaque de Repos (bpm)';
                      min = 30;
                      max = 150;
                      placeholder = 'Ex: 48';
                    }

                    setMetricModalInfo({
                      type,
                      dateStr,
                      currentValue,
                      title,
                      label,
                      min,
                      max,
                      placeholder
                    });
                  }}
                  onOpenWeeklyView={() => setActiveTab('weeks')}
                />
              </div>
            </main>
            </div>
          </div>
        )}

        {/* ONGLET NOUVEAU : SYNTHÈSE & VOLUMES HEBDOMADAIRES */}
        {activeTab === 'weeks' && (
          <Suspense fallback={<ViewFallback />}>
            <div className="w-full animate-fadeIn">
              <WeeklyAnalysisView 
                events={events} 
                qualities={qualities}
                onOpenScoreModal={(q: any, dateStr: string, currentData: any) => {
                  setModalInfo({ qId: q.id, qName: q.name, dateStr, currentData });
                }}
                showToast={showToast}
              />
            </div>
          </Suspense>
        )}

        {/* ONGLET 2 : ANALYSES PHYSIOLOGIQUES & BANISTER */}
        {activeTab === 'physiology' && (
          <Suspense fallback={<ViewFallback />}>
            <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md w-full animate-fadeIn">
              <MetricsDashboard 
                events={events} 
                dailyMetrics={dailyMetrics} 
                qualities={qualities}
                qualitiesEMA={qualitiesEMA}
                fosterMetrics={fosterMetrics}
                banisterPerformance={banisterPerformance}
                taperingAnalysis={taperingAnalysis}
                cardioMuscularBalance={cardioMuscularBalance}
                intensityDistribution={intensityDistribution}
                perceivedFatigueAnalysis={perceivedFatigueAnalysis}
                isSimulationActive={isSimulationActive}
                physioSettings={physioSettings}
                trainingBlocks={trainingBlocks}
                viewMode="physiology"
                onOpenCompetitionModal={() => setShowCompetitionModal(true)}
                onOpenReportModal={() => setShowReportModal(true)}
                onOpenPhysioSettingsModal={() => setShowPhysioSettingsModal(true)}
                onToggleSimulation={toggleSimulation}
              />
            </div>
          </Suspense>
        )}

        {/* ONGLET 3 : QUALITÉS & RÉMANENCE EMA */}
        {activeTab === 'qualities' && (
          <Suspense fallback={<ViewFallback />}>
            <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md w-full animate-fadeIn">
              <MetricsDashboard 
                events={events} 
                dailyMetrics={dailyMetrics} 
                qualities={qualities}
                qualitiesEMA={qualitiesEMA}
                fosterMetrics={fosterMetrics}
                banisterPerformance={banisterPerformance}
                taperingAnalysis={taperingAnalysis}
                cardioMuscularBalance={cardioMuscularBalance}
                intensityDistribution={intensityDistribution}
                perceivedFatigueAnalysis={perceivedFatigueAnalysis}
                isSimulationActive={isSimulationActive}
                physioSettings={physioSettings}
                trainingBlocks={trainingBlocks}
                viewMode="qualities"
                onOpenCompetitionModal={() => setShowCompetitionModal(true)}
                onOpenReportModal={() => setShowReportModal(true)}
                onOpenPhysioSettingsModal={() => setShowPhysioSettingsModal(true)}
                onToggleSimulation={toggleSimulation}
              />
            </div>
          </Suspense>
        )}

        {/* ONGLET 4 : PÉRIODISATION & OBJECTIFS */}
        {activeTab === 'periodization' && (
          <Suspense fallback={<ViewFallback />}>
            <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md w-full animate-fadeIn">
              <PeriodizationView
                activeBlock={activeBlockToday}
                blocks={trainingBlocks}
                templates={blockTemplates}
                qualities={qualities}
                targetCompetition={targetCompetition}
                taperingAnalysis={taperingAnalysis}
                fosterMetrics={fosterMetrics}
                banisterPerformance={banisterPerformance}
                cardioMuscularBalance={cardioMuscularBalance}
                physioSettings={physioSettings}
                onOpenBlocksModal={() => setShowBlocksModal(true)}
                onOpenCompetitionModal={() => setShowCompetitionModal(true)}
                onOpenReportModal={() => setShowReportModal(true)}
                onOpenPhysioSettingsModal={() => setShowPhysioSettingsModal(true)}
              />
            </div>
          </Suspense>
        )}

        </main>
      </div>

      {/* Modales asynchrones avec frontière Suspense */}
      <Suspense fallback={null}>
        {modalInfo && (
        <ScoreModal 
          info={modalInfo}
          qualities={qualities}
          events={events}
          onClose={() => setModalInfo(null)}
          onOpenLiveGym={() => {
            setModalInfo(null);
            setShowLiveGymModal(true);
          }}
          onSave={(sessionData: any, applyImpacts: boolean, targetDateStr?: string) => {
            const finalDate = targetDateStr || modalInfo.dateStr;
            saveEventWithImpacts(modalInfo.qId, finalDate, sessionData, applyImpacts);
            if (sessionData) {
              const sportLabel = sessionData.sport === 'bike' ? '🚴 Vélo' : '🏃 Course';
              showToast({
                type: 'success',
                title: 'Séance enregistrée',
                message: `${modalInfo.qName} · ${sportLabel} · Charge ${sessionData.load} pts (Fatigue ${sessionData.fatigue}/10)`
              });
            } else {
              showToast({
                type: 'info',
                title: 'Séance supprimée',
                message: `Séance du ${finalDate} pour ${modalInfo.qName} effacée.`
              });
            }
          }}
        />
      )}

      {metricModalInfo && (
        <MetricModal 
          info={metricModalInfo}
          onClose={() => setMetricModalInfo(null)}
          onSave={(val: any) => {
            saveDailyMetric(metricModalInfo.dateStr, metricModalInfo.type, val);
            if (val !== null) {
              showToast({
                type: 'success',
                title: 'Métrique enregistrée',
                message: `${metricModalInfo.title} : ${val} (${metricModalInfo.dateStr})`
              });
            } else {
              showToast({
                type: 'info',
                title: 'Métrique effacée',
                message: `${metricModalInfo.title} pour le ${metricModalInfo.dateStr}`
              });
            }
          }}
        />
      )}

      {qualityChartInfo && (
        <QualityChartModal 
          quality={qualityChartInfo}
          events={events[qualityChartInfo.id] || {}}
          onClose={() => setQualityChartInfo(null)}
        />
      )}

      {showBlocksModal && (
        <TrainingBlocksModal
          qualities={qualities}
          blocks={trainingBlocks}
          templates={blockTemplates}
          onClose={() => setShowBlocksModal(false)}
          onSaveBlock={(block, autoReorder) => {
            saveTrainingBlock(block);
            if (autoReorder) {
              reorderByBlockFocus(block);
            }
            showToast({
              type: 'success',
              title: 'Cycle de préparation enregistré',
              message: `Bloc « ${block.name} » (${block.durationWeeks} sem.) activé.`
            });
          }}
          onDeleteBlock={(blockId) => {
            deleteTrainingBlock(blockId);
            showToast({
              type: 'info',
              title: 'Cycle supprimé',
              message: 'Le bloc de préparation a été retiré.'
            });
          }}
          onSaveTemplate={saveBlockTemplate}
          onResetTemplates={resetBlockTemplates}
          onReorderByBlock={(block) => reorderByBlockFocus(block)}
        />
      )}

      {showCompetitionModal && (
        <CompetitionModal
          competition={targetCompetition}
          taperingAnalysis={taperingAnalysis}
          fosterMetrics={fosterMetrics}
          onSave={(comp) => {
            saveTargetCompetition(comp);
            showToast({
              type: 'success',
              title: comp ? 'Objectif de course enregistré' : 'Objectif supprimé',
              message: comp ? `${comp.name} le ${comp.date} (Affûtage ciblé)` : 'Aucun objectif programmé.'
            });
          }}
          onClose={() => setShowCompetitionModal(false)}
        />
      )}

      {showReportModal && (
        <TrainingReportModal
          events={events}
          qualities={qualities}
          dailyMetrics={dailyMetrics}
          qualitiesEMA={qualitiesEMA}
          activeBlock={activeBlockToday}
          targetCompetition={targetCompetition}
          fosterMetrics={fosterMetrics}
          banisterPerformance={banisterPerformance}
          cardioMuscularBalance={cardioMuscularBalance}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {showPhysioSettingsModal && (
        <PhysiologicalSettingsModal
          settings={physioSettings}
          events={events}
          dailyMetrics={dailyMetrics}
          onSave={(settings) => {
            savePhysioSettings(settings);
            showToast({
              type: 'success',
              title: 'Constantes Banister calibrées',
              message: `τ₁ (fatigue): ${settings.tauFatigue}j · τ₂ (condition): ${settings.tauFitness}j`
            });
          }}
          onClose={() => setShowPhysioSettingsModal(false)}
        />
      )}

      {showLiveGymModal && (
        <LiveGymModal
          isOpen={showLiveGymModal}
          onClose={() => {
            setShowLiveGymModal(false);
            try {
              setHasGymDraft(Boolean(localStorage.getItem('training_live_session_draft_v1')));
            } catch {
              // Ignore
            }
          }}
          qualities={qualities}
          events={events}
          initialDateStr={todayStr}
          onSaveSession={(qualityId, dateStr, sessionData, applyImpacts) => {
            saveEventWithImpacts(qualityId, dateStr, sessionData, applyImpacts);
            const qObj = qualities.find(q => q.id === qualityId);
            const qName = qObj ? qObj.name : qualityId;
            showToast({
              type: 'success',
              title: 'Séance en direct enregistrée',
              message: `${qName} · ${sessionData.duration} min · Tonnage : ${(sessionData.tonnageKg || 0).toLocaleString()} kg · Charge : ${sessionData.load} pts`
            });
            setShowLiveGymModal(false);
            setHasGymDraft(false);
          }}
        />
      )}

      {/* Modal Synchronisation Cloud Smartphone ↔ PC */}
      <CloudSyncModal
        isOpen={showCloudSyncModal}
        onClose={() => setShowCloudSyncModal(false)}
        userAccount={cloudSync.userAccount}
        syncStatus={cloudSync.syncStatus}
        lastSyncedAt={cloudSync.lastSyncedAt}
        pairingUrl={cloudSync.pairingUrl}
        qrCodeUrl={cloudSync.qrCodeUrl}
        confirmFirstPush={cloudSync.confirmFirstPush}
        onAcceptFirstPush={cloudSync.acceptFirstPush}
        onRejectFirstPush={cloudSync.rejectFirstPush}
        onLoginWithGoogle={cloudSync.loginWithGoogle}
        onLogout={cloudSync.logout}
        onPushToCloud={() => {
          cloudSync.pushToCloud();
          showToast({
            type: 'info',
            title: 'Synchronisation Cloud',
            message: 'Données locales envoyées vers Firebase Cloud.'
          });
        }}
        onPullFromCloud={() => {
          cloudSync.pullFromCloud();
          showToast({
            type: 'info',
            title: 'Synchronisation Cloud',
            message: 'Données rechargées depuis Firebase Cloud.'
          });
        }}
      />
      </Suspense>

      {/* BARRE DE NAVIGATION INFÉRIEURE MOBILE (Sticky bottom tactile avec bouton central Mode Salle) */}
      <nav 
        aria-label="Navigation principale mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d12]/95 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.8)] pb-[max(env(safe-area-inset-bottom,0px),8px)] select-none"
      >
        {/* Onglet 1: Grille */}
        <button
          type="button"
          onClick={() => setActiveTab('grid')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 touch-press active:scale-90 transition-all cursor-pointer ${
            activeTab === 'grid' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200 active:text-blue-300'
          }`}
        >
          <Calendar size={18} className={`transition-transform duration-200 ${activeTab === 'grid' ? 'text-blue-400 scale-110 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : ''}`} />
          <span className="text-[10px] tracking-tight">Grille</span>
        </button>

        {/* Onglet 2: Semaines */}
        <button
          type="button"
          onClick={() => setActiveTab('weeks')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 touch-press active:scale-90 transition-all cursor-pointer ${
            activeTab === 'weeks' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200 active:text-blue-300'
          }`}
        >
          <BarChart3 size={18} className={`transition-transform duration-200 ${activeTab === 'weeks' ? 'text-blue-400 scale-110 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : ''}`} />
          <span className="text-[10px] tracking-tight">Semaines</span>
        </button>

        {/* Bouton central surélevé Mode Salle (accès instantané en 1 clic pour la séance gym) */}
        <button
          type="button"
          onClick={() => setShowLiveGymModal(true)}
          className="relative -mt-6 mx-1 flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-600/40 border border-emerald-400/50 touch-press active:scale-88 active:brightness-125 active:shadow-emerald-500/60 transition-all cursor-pointer group"
          title="Lancer le Mode Salle"
          aria-label="Lancer le Mode Salle d'entraînement"
        >
          <Dumbbell size={20} className={`group-hover:rotate-12 transition-transform ${hasGymDraft ? 'animate-pulse' : ''}`} aria-hidden="true" />
          <span className="text-[9px] font-extrabold mt-0.5 tracking-tight whitespace-nowrap">Salle</span>
          {hasGymDraft && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
          )}
        </button>

        {/* Onglet 4: Banister */}
        <button
          type="button"
          onClick={() => setActiveTab('physiology')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 touch-press active:scale-90 transition-all cursor-pointer ${
            activeTab === 'physiology' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200 active:text-blue-300'
          }`}
        >
          <TrendingUp size={18} className={`transition-transform duration-200 ${activeTab === 'physiology' ? 'text-blue-400 scale-110 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : ''}`} />
          <span className="text-[10px] tracking-tight">Banister</span>
        </button>

        {/* Onglet 5: Cycles */}
        <button
          type="button"
          onClick={() => setActiveTab('periodization')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 touch-press active:scale-90 transition-all cursor-pointer ${
            activeTab === 'periodization' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200 active:text-blue-300'
          }`}
        >
          <Target size={18} className={`transition-transform duration-200 ${activeTab === 'periodization' ? 'text-blue-400 scale-110 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : ''}`} />
          <span className="text-[10px] tracking-tight">Cycles</span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

