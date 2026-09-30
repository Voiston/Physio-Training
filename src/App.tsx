import { useState, useMemo, useRef } from 'react';
import { generateTimeline, formatDisplayDate, getLocalYYYYMMDD } from './utils/dateHelpers';
import { useData } from './hooks/useData';
import { getBlockProgress } from './utils/physiology';
import Grid from './components/Grid';
import ScoreModal from './components/ScoreModal';
import MetricModal from './components/MetricModal';
import QualityChartModal from './components/QualityChartModal';
import RadarChart from './components/RadarChart';
import MetricsDashboard from './components/MetricsDashboard';
import TrainingBlocksModal from './components/TrainingBlocksModal';
import SmartSuggestions from './components/SmartSuggestions';
import { PeriodizationView } from './components/PeriodizationView';
import { WeeklyAnalysisView } from './components/WeeklyAnalysisView';
import { CompetitionModal } from './components/CompetitionModal';
import { TrainingReportModal } from './components/TrainingReportModal';
import { PhysiologicalSettingsModal } from './components/PhysiologicalSettingsModal';
import { SimulationBanner } from './components/SimulationBanner';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ToastProvider, useToast } from './components/Toast';
import { computeAllWeeksStats } from './utils/weekHelpers';
import { 
  FileUp, FileDown, Activity, Calendar, Zap, Shield, Plus, 
  Trophy, FileText, Sparkles, Sliders, TrendingUp, Layers, Target,
  PanelLeftClose, PanelLeftOpen, BarChart3
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
    // TRIMP Multi-Facteurs (Cardio vs Musculaire)
    cardioMuscularBalance,
    // Simulation (What-If)
    isSimulationActive,
    simulatedEvents,
    toggleSimulation,
    addSimulatedEvent,
    applySimulationScenario,
    clearSimulation,
    commitSimulation
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

  const timeline = useMemo(() => {
    return generateTimeline(21, 14).map(day => ({
      ...day,
      display: formatDisplayDate(day.dateObj, day.offset)
    }));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-100 font-sans p-3 sm:p-4 md:p-6 overflow-x-hidden relative">
      {/* Background Mesh Gradients */}
      <div className="fixed top-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Indicateur mode hors-ligne */}
      <OfflineIndicator />

      <div className="relative z-10 flex flex-col h-full gap-5 max-w-[1550px] mx-auto">
        
        {/* Header Section */}
        <header className="flex flex-wrap items-center justify-between px-4 lg:px-6 py-3.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md shadow-2xl gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-xl shadow-inner border border-blue-500/30 text-blue-400">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
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
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Bouton PWA Install */}
            <PWAInstallButton />

            {/* Bouton Mode Simulation (What-If) */}
            <button
              onClick={() => {
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
              <span className="hidden sm:inline">{isSimulationActive ? 'Simulation Active' : 'Simulation'}</span>
              <span className="sm:hidden">Simu</span>
            </button>

            {/* Bouton Calibrage Constantes Physiologiques */}
            <button
              onClick={() => setShowPhysioSettingsModal(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              title="Calibrer les constantes de rémanence Banister (tau fatigue 5-12j, tau condition 21-45j)"
            >
              <Sliders size={14} className="text-blue-400 shrink-0" />
              <span className="hidden md:inline font-mono">τ₁:{physioSettings.tauFatigue}j τ₂:{physioSettings.tauFitness}j</span>
              <span className="md:hidden">τ</span>
            </button>

            {/* Bouton Export Bilan PDF */}
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              title="Générer un bilan hebdomadaire ou mensuel PDF pour votre entraîneur"
            >
              <FileText size={14} className="text-blue-400 shrink-0" />
              <span className="hidden sm:inline">Bilan PDF</span>
            </button>

            {/* Import / Export JSON */}
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl transition-all cursor-pointer"
              title="Importer des données JSON"
            >
              <FileUp size={14} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={(e) => {
                importData(e);
                showToast({
                  type: 'success',
                  title: 'Importation effectuée',
                  message: 'Données et historique restaurés.'
                });
              }} 
              accept=".json" 
              className="hidden" 
            />
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
        </header>

        {/* BARRE D'ONGLETS PRINCIPALE */}
        <nav className="flex items-center gap-1.5 p-1.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-x-auto custom-scrollbar shadow-lg">
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
          onCommit={commitSimulation}
        />

        {/* CONTENU SELON L'ONGLET ACTIF */}

        {/* ONGLET 1 : GRILLE & PLANIFICATION */}
        {activeTab === 'grid' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            {/* Barre d'outils secondaire : Masquer / Afficher le volet athlète latéral */}
            <div className="flex items-center justify-between px-1">
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
                <span className="hidden sm:inline">Matrice d'entraînement :</span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-slate-300">
                  {qualities.length} qualités · -14j à +14j
                </span>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 min-h-0">
              {/* Left Sidebar (escamotable) */}
              {isSidebarOpen && (
                <aside className="w-full xl:w-80 flex flex-col gap-5 shrink-0 transition-all">
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

                  {/* Guide Physiologique EMA Aéré & Lisible (Polices >= 12px, Interligne Souple) */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-xl text-slate-200">
                    <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2.5">
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider m-0">
                        Guide Physiologique EMA
                      </h3>
                      <span className="text-[10px] font-mono text-slate-400">Banister</span>
                    </div>

                    <div className="space-y-2.5">
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
                          <span className="text-xs font-bold text-indigo-300">EMA 21j · Condition Durable (CTL)</span>
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
                          CTL − ATL. Visez +15 à +25 le Jour J pour un affûtage optimal en compétition.
                        </p>
                      </div>
                    </div>
                  </div>
                </aside>
              )}

              {/* Center Content */}
              <main className="flex-1 min-w-0 flex flex-col gap-5">
                {/* Suggestions & Priorités d'entraînement algorithmiques */}
                <SmartSuggestions 
                  recommendations={trainingRecommendations}
                  activeBlock={activeBlockToday}
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
        )}

        {/* ONGLET 2 : ANALYSES PHYSIOLOGIQUES & BANISTER */}
        {activeTab === 'physiology' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md w-full animate-fadeIn">
            <MetricsDashboard 
              events={events} 
              dailyMetrics={dailyMetrics} 
              qualities={qualities}
              qualitiesEMA={qualitiesEMA}
              fosterMetrics={fosterMetrics}
              taperingAnalysis={taperingAnalysis}
              cardioMuscularBalance={cardioMuscularBalance}
              isSimulationActive={isSimulationActive}
              physioSettings={physioSettings}
              viewMode="physiology"
              onOpenCompetitionModal={() => setShowCompetitionModal(true)}
              onOpenReportModal={() => setShowReportModal(true)}
              onOpenPhysioSettingsModal={() => setShowPhysioSettingsModal(true)}
              onToggleSimulation={toggleSimulation}
            />
          </div>
        )}

        {/* ONGLET 3 : QUALITÉS & RÉMANENCE EMA */}
        {activeTab === 'qualities' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md w-full animate-fadeIn">
            <MetricsDashboard 
              events={events} 
              dailyMetrics={dailyMetrics} 
              qualities={qualities}
              qualitiesEMA={qualitiesEMA}
              fosterMetrics={fosterMetrics}
              taperingAnalysis={taperingAnalysis}
              cardioMuscularBalance={cardioMuscularBalance}
              isSimulationActive={isSimulationActive}
              physioSettings={physioSettings}
              viewMode="qualities"
              onOpenCompetitionModal={() => setShowCompetitionModal(true)}
              onOpenReportModal={() => setShowReportModal(true)}
              onOpenPhysioSettingsModal={() => setShowPhysioSettingsModal(true)}
              onToggleSimulation={toggleSimulation}
            />
          </div>
        )}

        {/* ONGLET 4 : PÉRIODISATION & OBJECTIFS */}
        {activeTab === 'periodization' && (
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
        )}

      </div>

      {modalInfo && (
        <ScoreModal 
          info={modalInfo}
          qualities={qualities}
          events={events}
          onClose={() => setModalInfo(null)}
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

