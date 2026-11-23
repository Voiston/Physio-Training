import { useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { generateTimeline, formatDisplayDate, getLocalYYYYMMDD } from './utils/dateHelpers';
import { useData, BlockTemplate } from './hooks/useData';
import { getBlockProgress } from './utils/physiology';
import Grid from './components/Grid';
const RadarChart = lazy(() => import('./components/RadarChart'));
import SmartSuggestions from './components/SmartSuggestions';
import { SimulationBanner } from './components/SimulationBanner';
import { OfflineIndicator } from './components/OfflineIndicator';
import { GarminInboxBanner } from './components/GarminInboxBanner';
import { TodayBriefingBar } from './components/TodayBriefingBar';
import { AppHeader, MobileBottomNav, type AppTab } from './components/AppHeader';
import { ToastProvider, useToast } from './components/Toast';
import { useIntervalsSync } from './hooks/useIntervalsSync';
import type { ScoreModalInfo } from './components/ScoreModal';
import type { MetricModalInfo } from './components/MetricModal';
import type { Quality, SessionData } from './types';

// Vues découpées en code-splitting asynchrone (chargement à la demande par onglet)
const PhysiologyDashboard = lazy(() => import('./components/PhysiologyDashboard'));
const QualitiesDashboard = lazy(() => import('./components/QualitiesDashboard'));
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
const GarminSyncModal = lazy(() => import('./components/GarminSyncModal').then(m => ({ default: m.GarminSyncModal })));

const ViewFallback = () => (
  <div className="w-full min-h-[380px] flex flex-col items-center justify-center p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md animate-pulse">
    <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
    <span className="text-xs text-slate-400 font-mono">Chargement du module d'analyse...</span>
  </div>
);
import { haptics } from './utils/haptics';
import { 
  computeWeeklyMuscularSummary, 
  computeMuscularAlerts, 
  getSavedCustomExercises 
} from './utils/muscleHelpers';
import { 
  Activity, Calendar, Zap, Shield, Plus,
  PanelLeftClose, PanelLeftOpen
} from 'lucide-react';

function AppContent() {
  const { 
    events, 
    rawEvents,
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
    applyGarminWellnessBatch,
    intervalsProcessedIds,
    markIntervalsIdsProcessed,
    clearIntervalsProcessedIds,
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
    dualBanister,
    interferenceAnalysis,
    dailyBriefing,
    strengthProgression,
    // Simulation (What-If)
    isSimulationActive,
    simulatedEvents,
    toggleSimulation,
    addSimulatedEvent,
    applySimulationScenario,
    clearSimulation,
    commitSimulation,
    // Synchronisation Cloud Smartphone ↔ PC
    cloudSync,
    allWeeksStats,
    currentWeekStats
  } = useData();

  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<AppTab>('grid');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [modalInfo, setModalInfo] = useState<ScoreModalInfo | null>(null);
  const [metricModalInfo, setMetricModalInfo] = useState<MetricModalInfo | null>(null);
  const [qualityChartInfo, setQualityChartInfo] = useState<Quality | null>(null);
  const [showBlocksModal, setShowBlocksModal] = useState<boolean>(false);
  const [selectedTemplateForModal, setSelectedTemplateForModal] = useState<BlockTemplate | null>(null);
  const [showCompetitionModal, setShowCompetitionModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showPhysioSettingsModal, setShowPhysioSettingsModal] = useState<boolean>(false);
  const [showLiveGymModal, setShowLiveGymModal] = useState<boolean>(false);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState<boolean>(false);
  const [showGarminSyncModal, setShowGarminSyncModal] = useState<boolean>(false);

  // Synchronisation automatique Garmin via Intervals.icu (VFC/FC/Readiness auto + séances 1 clic)
  const intervalsSync = useIntervalsSync({
    currentUser: cloudSync.currentUser,
    qualities,
    rawEvents,
    activeBlockToday,
    intervalsProcessedIds,
    markIntervalsIdsProcessed,
    clearIntervalsProcessedIds,
    saveEventWithImpacts,
    applyGarminWellnessBatch,
    isPaused: showLiveGymModal,
    onAutoMetricsImported: (summary) => {
      const parts: string[] = [];
      if (summary.latestValues?.vfc !== undefined) parts.push(`VFC ${summary.latestValues.vfc} ms`);
      if (summary.latestValues?.hrRest !== undefined) parts.push(`FC ${summary.latestValues.hrRest} bpm`);
      if (summary.latestValues?.readiness !== undefined) parts.push(`Forme ${summary.latestValues.readiness}/10`);
      showToast({
        type: 'success',
        title: 'Garmin synchronisé',
        message: parts.length > 0
          ? `${parts.join(' · ')} (${summary.updatedCount} mesure${summary.updatedCount > 1 ? 's' : ''})`
          : `${summary.updatedCount} métrique${summary.updatedCount > 1 ? 's' : ''} matinale${summary.updatedCount > 1 ? 's' : ''} mise${summary.updatedCount > 1 ? 's' : ''} à jour.`,
      });
    },
  });

  // Précharger le SDK Firebase dès l'ouverture des modales Cloud/Garmin pour préserver le geste clic du popup Google
  const { preloadFirebase } = cloudSync;
  useEffect(() => {
    if (showCloudSyncModal || showGarminSyncModal) {
      preloadFirebase();
    }
  }, [showCloudSyncModal, showGarminSyncModal, preloadFirebase]);

  // Relayer les notifications Cloud / Google Auth dans le système de toasts global
  useEffect(() => {
    if (!cloudSync.syncNotification) return;
    const msg = cloudSync.syncNotification;
    const isErrorMsg = /impossible|bloquée|refusé|non autorisé|dépassé|❌/i.test(msg);
    const isSuccessMsg = /connecté avec|synchronisées|associées|⚡/i.test(msg);
    showToast({
      type: isErrorMsg ? 'error' : isSuccessMsg ? 'success' : 'info',
      title: isErrorMsg ? 'Connexion Google / Cloud' : 'Cloud Sync',
      message: msg,
    });
  }, [cloudSync.syncNotification, showToast]);
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
  const { setNetworkState } = cloudSync;
  useEffect(() => {
    setNetworkState(!showLiveGymModal);
  }, [showLiveGymModal, setNetworkState]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // État today rafraîchi dynamiquement (visibilitychange, focus et tick périodique)
  // pour éviter qu'une PWA rouverte le lendemain depuis l'arrière-plan n'enregistre sur la veille
  const [today, setToday] = useState<Date>(() => new Date());

  useEffect(() => {
    const refreshTodayIfNeeded = () => {
      const now = new Date();
      if (getLocalYYYYMMDD(now) !== getLocalYYYYMMDD(today)) {
        setToday(now);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshTodayIfNeeded();
      }
    };

    const handleFocus = () => {
      refreshTodayIfNeeded();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    // Vérification de sécurité toutes les 60 secondes pour le passage de minuit
    const timer = setInterval(refreshTodayIfNeeded, 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(timer);
    };
  }, [today]);

  const todayStr = useMemo(() => getLocalYYYYMMDD(today), [today]);
  const blockProgress = useMemo(() => {
    return activeBlockToday ? getBlockProgress(activeBlockToday, todayStr) : null;
  }, [activeBlockToday, todayStr]);


  // Alertes biomécaniques et musculaires de la semaine courante (H:Q, Pull:Push, MRV)
  const currentMuscularAlerts = useMemo(() => {
    if (!currentWeekStats) return [];
    const customCatalog = getSavedCustomExercises();
    const summary = computeWeeklyMuscularSummary(events, currentWeekStats.startDate, currentWeekStats.endDate, customCatalog);
    return computeMuscularAlerts(summary);
  }, [events, currentWeekStats]);

  const timeline = useMemo(() => {
    return generateTimeline(21, 14, today).map(day => ({
      ...day,
      display: formatDisplayDate(day.dateObj, day.offset)
    }));
  }, [today]);

  const handleGridCellClick = useCallback((q: Quality, dateStr: string, currentData?: SessionData | null) => {
    setModalInfo({ qId: q.id, qName: q.name, dateStr, currentData });
  }, []);

  const handleGridQualityClick = useCallback((q: Quality) => {
    setQualityChartInfo(q);
  }, []);

  const handleGridMetricClick = useCallback((dateStr: string, type: string, currentValue: number | string) => {
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
  }, []);

  const handleOpenWeeklyView = useCallback(() => {
    setActiveTab('weeks');
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
        
        {/* En-tête, tiroir mobile & barre d'onglets principale */}
        <AppHeader
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          garminPendingCount={intervalsSync.pendingActivities.length}
          garminConnectionState={intervalsSync.connectionState}
          garminIsSyncing={intervalsSync.isSyncing}
          onOpenGarminSync={() => setShowGarminSyncModal(true)}
          cloudSyncStatus={cloudSync.syncStatus}
          onOpenCloudSync={() => setShowCloudSyncModal(true)}
          hasGymDraft={hasGymDraft}
          onOpenLiveGym={() => setShowLiveGymModal(true)}
          isSimulationActive={isSimulationActive}
          onToggleSimulation={() => {
            haptics.modeSwitch();
            toggleSimulation();
            showToast({
              type: 'info',
              title: isSimulationActive ? 'Simulation désactivée' : 'Mode simulation activé',
              message: isSimulationActive ? 'Retour aux charges réelles.' : 'Testez des séances prévisionnelles sur 14 jours.'
            });
          }}
          physioSettings={physioSettings}
          onOpenPhysioSettings={() => setShowPhysioSettingsModal(true)}
          onOpenReportModal={() => setShowReportModal(true)}
          onExportData={() => {
            exportData();
            showToast({
              type: 'success',
              title: 'Données exportées',
              message: 'Fichier de sauvegarde JSON téléchargé.'
            });
          }}
          fileInputRef={fileInputRef}
          onImportFileChange={(e) => {
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
          showMobileTools={showMobileTools}
          setShowMobileTools={setShowMobileTools}
          currentWeekStats={currentWeekStats}
          currentTsb={banisterPerformance?.current?.tsb ?? 0}
          qualitiesCount={qualities.length}
          activeBlockToday={activeBlockToday}
          targetCompetition={targetCompetition}
          daysRemaining={taperingAnalysis?.daysRemaining}
        />

        {/* Bannière active du mode Simulation What-If */}
        <SimulationBanner
          isActive={isSimulationActive}
          simulatedEvents={simulatedEvents}
          qualities={qualities}
          interference={interferenceAnalysis}
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
            {/* Briefing "Aujourd'hui en 5 secondes" */}
            <TodayBriefingBar
              briefing={dailyBriefing}
              dualBanister={dualBanister}
              isSimulationActive={isSimulationActive}
              onOpenBanister={() => setActiveTab('physiology')}
              onOpenLiveGym={() => setShowLiveGymModal(true)}
            />
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
                  {qualities.length} qualités · −21j à +14j
                </span>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 min-h-0">
              {/* Left Sidebar (escamotable sur desktop, contrôlée par bascule sur mobile) */}
              {(isSidebarOpen || mobileGridTab === 'athlete') && (
                <aside className={`${mobileGridTab === 'athlete' ? 'flex' : 'hidden'} xl:flex xl:w-80 flex-col gap-5 shrink-0 transition-all`}>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md shadow-xl">
                    <Suspense fallback={<div className="h-64 flex items-center justify-center text-xs text-slate-500 font-mono">Chargement du radar...</div>}>
                      <RadarChart 
                        qualities={qualities} 
                        events={events} 
                        dailyMetrics={dailyMetrics} 
                        trainingBlocks={trainingBlocks}
                      />
                    </Suspense>
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
                              {activeBlockToday.focusQualities.map((id: string) => qualities.find(q => q.id === id)?.name || id).join(', ')}
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
              <section 
                aria-label="Grille de planification et suggestions" 
                className={`${mobileGridTab === 'grid' ? 'flex' : 'hidden'} xl:flex flex-1 min-w-0 flex-col gap-5`}
              >
                {/* Boîte de réception 1 clic des séances Garmin (Intervals.icu) */}
                <GarminInboxBanner
                  pendingActivities={intervalsSync.pendingActivities}
                  qualities={qualities}
                  rawEvents={rawEvents}
                  isSyncing={intervalsSync.isSyncing}
                  onValidate={(activity, override) => {
                    const result = intervalsSync.validateActivity(activity, override);
                    const qName = qualities.find(q => q.id === result.qualityId)?.name || result.qualityId;
                    showToast({
                      type: 'success',
                      title: result.wasMerged ? 'Sous-séance Garmin ajoutée' : 'Séance Garmin validée',
                      message: `${qName} · ${activity.duration} min · Charge ${result.sessionData.load} UA`,
                    });
                  }}
                  onValidateAll={(overridesMap) => {
                    const count = intervalsSync.validateAllActivities(overridesMap);
                    if (count > 0) {
                      showToast({
                        type: 'success',
                        title: `${count} séances Garmin validées`,
                        message: 'Grille et courbes Banister / EMA mises à jour.',
                      });
                    }
                  }}
                  onDismiss={(externalId) => {
                    intervalsSync.dismissActivity(externalId);
                    showToast({
                      type: 'info',
                      title: 'Activité ignorée',
                      message: 'Vous pouvez la réafficher depuis Réglages Garmin si besoin.',
                    });
                  }}
                  onRefresh={() => {
                    intervalsSync.syncNow(14, { silent: false });
                  }}
                  onOpenModal={() => setShowGarminSyncModal(true)}
                />

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
                  currentWeekStats={currentWeekStats}
                  moveQuality={moveQuality}
                  reorderQualities={reorderQualities}
                  onCellClick={handleGridCellClick}
                  onQualityClick={handleGridQualityClick}
                  onMetricClick={handleGridMetricClick}
                  onOpenWeeklyView={handleOpenWeeklyView}
                  conflictsByDate={interferenceAnalysis.conflictsByDate}
                />
              </div>
            </section>
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
                allWeeksStats={allWeeksStats}
                strengthProgression={strengthProgression}
                dualBanister={dualBanister}
                onOpenLiveGym={() => setShowLiveGymModal(true)}
                onOpenScoreModal={(q: Quality, dateStr: string, currentData?: SessionData) => {
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
              <PhysiologyDashboard 
                events={events} 
                dailyMetrics={dailyMetrics} 
                qualities={qualities} 
                fosterMetrics={fosterMetrics}
                banisterPerformance={banisterPerformance}
                taperingAnalysis={taperingAnalysis}
                cardioMuscularBalance={cardioMuscularBalance}
                intensityDistribution={intensityDistribution}
                perceivedFatigueAnalysis={perceivedFatigueAnalysis}
                dualBanister={dualBanister}
                interferenceAnalysis={interferenceAnalysis}
                isSimulationActive={isSimulationActive}
                physioSettings={physioSettings}
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
              <QualitiesDashboard 
                events={events} 
                qualities={qualities}
                qualitiesEMA={qualitiesEMA}
                trainingBlocks={trainingBlocks}
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
                onOpenBlocksModal={() => {
                  setSelectedTemplateForModal(null);
                  setShowBlocksModal(true);
                }}
                onApplyTemplate={(template) => {
                  setSelectedTemplateForModal(template);
                  setShowBlocksModal(true);
                }}
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
          onSave={(sessionData: SessionData | null, applyImpacts: boolean, targetDateStr?: string) => {
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
          onSave={(val: number | null) => {
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
          initialTemplate={selectedTemplateForModal}
          onClose={() => {
            setShowBlocksModal(false);
            setSelectedTemplateForModal(null);
          }}
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
      {showCloudSyncModal && (
        <CloudSyncModal
          isOpen={showCloudSyncModal}
          onClose={() => setShowCloudSyncModal(false)}
          userAccount={cloudSync.userAccount}
          syncStatus={cloudSync.syncStatus}
          lastSyncedAt={cloudSync.lastSyncedAt}
          pairingUrl={cloudSync.pairingUrl}
          qrCodeUrl={cloudSync.qrCodeUrl}
          confirmFirstPush={cloudSync.confirmFirstPush}
          quotaUsage={cloudSync.quotaUsage}
          syncErrorDetail={cloudSync.syncErrorDetail}
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
          onResetSyncState={() => {
            cloudSync.resetSyncState();
            showToast({
              type: 'info',
              title: 'Synchronisation Débloquée',
              message: 'L\'état de synchronisation a été débloqué et réinitialisé.'
            });
          }}
        />
      )}
      {/* Modal Synchronisation Garmin via Intervals.icu */}
      {showGarminSyncModal && (
        <GarminSyncModal
          isOpen={showGarminSyncModal}
          onClose={() => setShowGarminSyncModal(false)}
          connectionState={intervalsSync.connectionState}
          isConfigured={intervalsSync.isConfigured}
          isSyncing={intervalsSync.isSyncing}
          athleteName={intervalsSync.athleteName}
          lastSyncedAt={intervalsSync.lastSyncedAt}
          lastMetricsSummary={intervalsSync.lastMetricsSummary}
          dailyMetrics={dailyMetrics}
          error={intervalsSync.error}
          pendingActivities={intervalsSync.pendingActivities}
          processedCount={intervalsSync.processedCount}
          userAccount={cloudSync.userAccount}
          authError={cloudSync.syncErrorDetail}
          isSigningIn={cloudSync.syncStatus === 'syncing'}
          onLoginWithGoogle={cloudSync.loginWithGoogle}
          onCheckStatus={() => {
            intervalsSync.checkStatus().then((res) => {
              if (res.configured && res.connected) {
                showToast({
                  type: 'success',
                  title: 'Passerelle Garmin connectée',
                  message: 'Synchronisation automatique activée.',
                });
                intervalsSync.syncNow(14, { silent: false });
              } else if (res.staticHost) {
                showToast({
                  type: 'info',
                  title: 'Passerelle GitHub Pages à relier',
                  message: 'Déployez workers/intervals-proxy.js puis ajoutez VITE_INTERVALS_PROXY_URL dans GitHub Actions.',
                });
              } else if (!res.configured) {
                showToast({
                  type: 'info',
                  title: 'Clé serveur non détectée',
                  message: 'Ajoutez INTERVALS_ICU_API_KEY dans Settings → Secrets puis réessayez.',
                });
              }
            });
          }}
          onSyncNow={(days) => {
            intervalsSync.syncNow(days, { silent: false }).then((res) => {
              if (!res.ok) return;
              if (res.metricsUpdated === 0 && res.wellnessDaysReceived === 0) {
                showToast({
                  type: 'info',
                  title: 'Aucune métrique bien-être reçue',
                  message:
                    'Vérifiez que « Download wellness data » (VFC, FC repos, Sommeil) est activé dans Garmin Connect sur intervals.icu/settings.',
                });
              } else if (res.metricsUpdated === 0) {
                showToast({
                  type: 'info',
                  title: 'Synchronisation Garmin terminée',
                  message: `${res.wellnessDaysReceived} jour${res.wellnessDaysReceived > 1 ? 's' : ''} de métriques vérifié${res.wellnessDaysReceived > 1 ? 's' : ''} — déjà à jour dans la grille.`,
                });
              }
            });
          }}
          onValidateAll={() => {
            const count = intervalsSync.validateAllActivities();
            if (count > 0) {
              showToast({
                type: 'success',
                title: `${count} séance${count > 1 ? 's' : ''} Garmin validée${count > 1 ? 's' : ''}`,
                message: 'Grille et courbes Banister / EMA mises à jour.',
              });
            }
          }}
          onRestoreDismissed={() => {
            intervalsSync.restoreDismissedActivities().then(() => {
              showToast({
                type: 'info',
                title: 'Historique réinitialisé',
                message: 'Les activités Garmin récentes ont été rechargées.',
              });
            });
          }}
        />
      )}
      </Suspense>

      {/* Barre de navigation inférieure mobile */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasGymDraft={hasGymDraft}
        onOpenLiveGym={() => setShowLiveGymModal(true)}
      />
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

