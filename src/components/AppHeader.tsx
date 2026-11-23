import React, { type ChangeEvent, type RefObject } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Cloud,
  Dumbbell,
  FileDown,
  FileText,
  FileUp,
  Layers,
  MoreVertical,
  Sliders,
  Sparkles,
  Target,
  TrendingUp,
  Watch,
  X,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import type { PhysiologicalSettings, TargetCompetition, TrainingBlock } from '../hooks/useData';
import type { WeekStats } from '../utils/weekHelpers';
import type { IntervalsConnectionState } from '../hooks/useIntervalsSync';
import { haptics } from '../utils/haptics';

export type AppTab = 'grid' | 'weeks' | 'physiology' | 'qualities' | 'periodization';

interface AppHeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  // Garmin Sync
  garminPendingCount: number;
  garminConnectionState: IntervalsConnectionState;
  garminIsSyncing: boolean;
  onOpenGarminSync: () => void;
  // Cloud Sync
  cloudSyncStatus: string;
  onOpenCloudSync: () => void;
  // Live Gym
  hasGymDraft: boolean;
  onOpenLiveGym: () => void;
  // Simulation
  isSimulationActive: boolean;
  onToggleSimulation: () => void;
  // Settings / Reports / JSON
  physioSettings: PhysiologicalSettings;
  onOpenPhysioSettings: () => void;
  onOpenReportModal: () => void;
  onExportData: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImportFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  // Mobile tools drawer
  showMobileTools: boolean;
  setShowMobileTools: React.Dispatch<React.SetStateAction<boolean>>;
  // Tab badges
  currentWeekStats?: WeekStats;
  currentTsb: number;
  qualitiesCount: number;
  activeBlockToday: TrainingBlock | null;
  targetCompetition: TargetCompetition | null;
  daysRemaining?: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  onSelectTab,
  garminPendingCount,
  garminConnectionState,
  garminIsSyncing,
  onOpenGarminSync,
  cloudSyncStatus,
  onOpenCloudSync,
  hasGymDraft,
  onOpenLiveGym,
  isSimulationActive,
  onToggleSimulation,
  physioSettings,
  onOpenPhysioSettings,
  onOpenReportModal,
  onExportData,
  fileInputRef,
  onImportFileChange,
  showMobileTools,
  setShowMobileTools,
  currentWeekStats,
  currentTsb,
  qualitiesCount,
  activeBlockToday,
  targetCompetition,
  daysRemaining,
}) => {
  return (
    <>
      {/* En-tête principal */}
      <header
        className="flex flex-wrap items-center justify-between px-4 lg:px-6 py-3.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md shadow-2xl gap-4"
        role="banner"
      >
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
              Périodisation par Blocs · Dual-Banister & Suivi Hybride
            </p>
          </div>
        </div>

        {/* Actions Desktop */}
        <div className="hidden md:flex items-center gap-2">
          <PWAInstallButton />

          <button
            type="button"
            onClick={onOpenGarminSync}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border whitespace-nowrap shrink-0 ${
              garminPendingCount > 0
                ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-200'
                : garminConnectionState === 'ready'
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
            title="Import automatique Garmin (VFC, FC repos, Readiness & séances via Intervals.icu)"
          >
            <Watch
              size={15}
              className={
                garminIsSyncing
                  ? 'animate-spin text-blue-400'
                  : garminPendingCount > 0
                  ? 'text-amber-400'
                  : 'text-blue-400'
              }
              aria-hidden="true"
            />
            <span>Garmin</span>
            {garminPendingCount > 0 && (
              <span className="font-mono tabular-nums text-[11px] font-bold text-amber-300">
                ({garminPendingCount})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenCloudSync}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border whitespace-nowrap shrink-0 ${
              cloudSyncStatus === 'synced'
                ? 'bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/40 text-blue-300'
                : cloudSyncStatus === 'syncing'
                ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
            title="Synchronisation automatique temps réel entre votre smartphone et votre PC"
          >
            <Cloud
              size={15}
              className={cloudSyncStatus === 'syncing' ? 'animate-spin text-amber-400' : 'text-blue-400'}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Synchro Cloud</span>
            <span className="sm:hidden">Sync</span>
            {cloudSyncStatus === 'synced' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.modeSwitch();
              onOpenLiveGym();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/10 group whitespace-nowrap shrink-0"
            title="Lancer le Mode Salle : suivi tactile en direct, minuteur de repos et charge adaptative"
          >
            <Dumbbell size={15} className="text-emerald-400 group-hover:rotate-12 transition-transform" aria-hidden="true" />
            <span>Mode Salle</span>
            {hasGymDraft && (
              <span className="text-[10px] font-mono font-bold text-emerald-300 ml-0.5">· En cours</span>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleSimulation}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border whitespace-nowrap shrink-0 ${
              isSimulationActive
                ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/25'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
            title="Tester des séances prévisionnelles et anticiper la forme (TSB) future"
          >
            <Sparkles size={14} className={isSimulationActive ? 'text-purple-200' : 'text-purple-400'} aria-hidden="true" />
            <span>{isSimulationActive ? 'Simulation Active' : 'Simulation'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenPhysioSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
            title="Calibrer les constantes de rémanence Banister (tau fatigue 5-12j, tau condition 21-45j)"
          >
            <Sliders size={14} className="text-blue-400 shrink-0" aria-hidden="true" />
            <span className="font-mono tabular-nums">
              τ₁:{physioSettings.tauFatigue}j τ₂:{physioSettings.tauFitness}j
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenReportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
            title="Générer un bilan hebdomadaire ou mensuel PDF pour votre entraîneur"
          >
            <FileText size={14} className="text-blue-400 shrink-0" aria-hidden="true" />
            <span>Bilan PDF</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl transition-all cursor-pointer shrink-0"
            title="Importer des données JSON"
            aria-label="Importer des données JSON"
          >
            <FileUp size={14} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onExportData}
            className="p-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-xl transition-all cursor-pointer shrink-0"
            title="Exporter toutes les données en JSON"
            aria-label="Exporter toutes les données en JSON"
          >
            <FileDown size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Actions rapides Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={onOpenGarminSync}
            className={`min-w-[40px] min-h-[40px] p-2 rounded-xl border text-xs font-semibold touch-press cursor-pointer flex items-center justify-center gap-1 active:scale-90 transition-all ${
              garminPendingCount > 0
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                : garminConnectionState === 'ready'
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                : 'bg-white/5 text-slate-300 border-white/10 active:bg-white/15'
            }`}
            aria-label="Synchronisation Garmin"
            title="Synchronisation Garmin (Intervals.icu)"
          >
            <Watch size={16} className={garminIsSyncing ? 'animate-spin text-blue-400' : ''} aria-hidden="true" />
            {garminPendingCount > 0 && (
              <span className="font-mono tabular-nums text-[11px] font-bold">{garminPendingCount}</span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenCloudSync}
            className={`min-w-[40px] min-h-[40px] p-2 rounded-xl border text-xs font-semibold touch-press cursor-pointer flex items-center justify-center gap-1 active:scale-90 transition-all ${
              cloudSyncStatus === 'synced'
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : cloudSyncStatus === 'syncing'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-white/5 text-slate-300 border-white/10 active:bg-white/15'
            }`}
            aria-label="Synchronisation Cloud"
            title="Synchronisation Cloud"
          >
            <Cloud size={16} className={cloudSyncStatus === 'syncing' ? 'animate-spin text-amber-400' : 'text-blue-400'} aria-hidden="true" />
            {cloudSyncStatus === 'synced' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.tap();
              setShowMobileTools((prev) => !prev);
            }}
            className="min-w-[40px] min-h-[40px] p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 touch-press active:scale-90 active:bg-white/15 transition-all inline-flex items-center justify-center"
            aria-label="Outils et réglages"
            title="Outils et réglages"
          >
            <MoreVertical size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Input file caché pour Import JSON */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={onImportFileChange}
          accept=".json,application/json"
          className="hidden"
        />
      </header>

      {/* Tiroir d'outils Mobile */}
      {showMobileTools && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm md:hidden animate-fadeIn"
          onClick={() => setShowMobileTools(false)}
        >
          <div
            className="w-full bg-[#121217] border-t border-white/15 rounded-t-3xl p-5 shadow-2xl flex flex-col gap-3.5 pb-[max(env(safe-area-inset-bottom,0px),20px)] animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                  <Sliders size={15} aria-hidden="true" />
                </div>
                <span className="font-bold text-sm text-white">Outils & Actions Rapides</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileTools(false)}
                className="p-1.5 rounded-xl bg-white/5 text-slate-400 hover:text-white touch-press active:scale-90"
                aria-label="Fermer le tiroir"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowMobileTools(false);
                  onOpenGarminSync();
                }}
                className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-slate-200 touch-press active:scale-[0.96] active:bg-white/10 text-left"
              >
                <Watch size={16} className="text-blue-400 shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-bold">Garmin Sync</div>
                  <div className="text-[10px] text-slate-400">
                    {garminPendingCount > 0 ? `${garminPendingCount} séance(s) à valider` : 'Via Intervals.icu'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileTools(false);
                  onToggleSimulation();
                }}
                className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold border touch-press active:scale-[0.96] text-left ${
                  isSimulationActive
                    ? 'bg-purple-600/30 border-purple-400 text-purple-200'
                    : 'bg-white/5 border-white/10 text-slate-200'
                }`}
              >
                <Sparkles size={16} className="text-purple-400 shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-bold">Simulation</div>
                  <div className="text-[10px] text-slate-400">
                    {isSimulationActive ? 'Désactiver' : 'What-If (14j)'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileTools(false);
                  onOpenReportModal();
                }}
                className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-slate-200 touch-press active:scale-[0.96] text-left"
              >
                <FileText size={16} className="text-blue-400 shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-bold">Bilan PDF</div>
                  <div className="text-[10px] text-slate-400">Export rapport</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileTools(false);
                  onOpenPhysioSettings();
                }}
                className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-slate-200 touch-press active:scale-[0.96] text-left"
              >
                <Sliders size={16} className="text-blue-400 shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-bold">Constantes τ</div>
                  <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                    τ₁:{physioSettings.tauFatigue}j τ₂:{physioSettings.tauFitness}j
                  </div>
                </div>
              </button>

              <PWAInstallButton variant="tile" />

              <button
                type="button"
                onClick={() => {
                  setShowMobileTools(false);
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-slate-200 touch-press active:scale-[0.96] text-left"
              >
                <FileUp size={16} className="text-emerald-400 shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-bold">Importer JSON</div>
                  <div className="text-[10px] text-slate-400">Restaurer fichier</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileTools(false);
                  onExportData();
                }}
                className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-300 touch-press active:scale-[0.96] text-left"
              >
                <FileDown size={16} className="text-blue-400 shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-bold">Exporter JSON</div>
                  <div className="text-[10px] text-slate-400">Sauvegarde locale</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barre d'onglets principale Desktop */}
      <nav
        aria-label="Navigation principale"
        className="hidden md:flex items-center gap-1.5 p-1.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-x-auto custom-scrollbar shadow-lg"
      >
        <button
          type="button"
          onClick={() => onSelectTab('grid')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'grid'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Calendar size={15} aria-hidden="true" />
          <span>Grille & Planification</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('weeks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'weeks'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <BarChart3 size={15} aria-hidden="true" />
          <span>Totaux & Semaines</span>
          {currentWeekStats && (
            <span className="font-mono tabular-nums text-[11px] opacity-80">
              · {currentWeekStats.totalLoad} UA
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('physiology')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'physiology'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <TrendingUp size={15} aria-hidden="true" />
          <span>Analyses Banister</span>
          <span
            className={`font-mono tabular-nums text-[11px] font-bold ${
              activeTab === 'physiology'
                ? 'text-blue-100'
                : currentTsb >= 0
                ? 'text-emerald-400'
                : 'text-amber-300'
            }`}
          >
            · {currentTsb >= 0 ? `+${currentTsb}` : currentTsb} TSB
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('qualities')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'qualities'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers size={15} aria-hidden="true" />
          <span>Qualités EMA</span>
          <span className="font-mono tabular-nums text-[11px] opacity-75">· {qualitiesCount}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('periodization')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'periodization'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Target size={15} aria-hidden="true" />
          <span>Cycles & Objectifs</span>
          {activeBlockToday ? (
            <span className="text-[11px] opacity-80 truncate max-w-[120px]">· {activeBlockToday.name}</span>
          ) : targetCompetition && daysRemaining !== undefined ? (
            <span className="font-mono tabular-nums text-[11px] opacity-80">· J-{daysRemaining}</span>
          ) : null}
        </button>
      </nav>
    </>
  );
};

interface MobileBottomNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  hasGymDraft: boolean;
  onOpenLiveGym: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  hasGymDraft,
  onOpenLiveGym,
}) => {
  return (
    <nav
      aria-label="Navigation principale mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d12]/95 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 flex items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.8)] pb-[max(env(safe-area-inset-bottom,0px),8px)] select-none"
    >
      <button
        type="button"
        onClick={() => onSelectTab('grid')}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 touch-press active:scale-90 transition-all cursor-pointer ${
          activeTab === 'grid' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Calendar size={18} aria-hidden="true" />
        <span className="text-[10px] tracking-tight">Grille</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectTab('weeks')}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 touch-press active:scale-90 transition-all cursor-pointer ${
          activeTab === 'weeks' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <BarChart3 size={18} aria-hidden="true" />
        <span className="text-[10px] tracking-tight">Semaines</span>
      </button>

      <button
        type="button"
        onClick={onOpenLiveGym}
        className="relative -mt-6 mx-1 flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-600/40 border border-emerald-400/50 touch-press active:scale-90 transition-all cursor-pointer group"
        title="Lancer le Mode Salle"
        aria-label="Lancer le Mode Salle d'entraînement"
      >
        <Dumbbell size={20} className="group-hover:rotate-12 transition-transform" aria-hidden="true" />
        <span className="text-[9px] font-extrabold mt-0.5 tracking-tight whitespace-nowrap">
          {hasGymDraft ? 'En cours' : 'Salle'}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSelectTab('physiology')}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 touch-press active:scale-90 transition-all cursor-pointer ${
          activeTab === 'physiology' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <TrendingUp size={18} aria-hidden="true" />
        <span className="text-[10px] tracking-tight">Banister</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectTab('periodization')}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 touch-press active:scale-90 transition-all cursor-pointer ${
          activeTab === 'periodization' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Target size={18} aria-hidden="true" />
        <span className="text-[10px] tracking-tight">Cycles</span>
      </button>
    </nav>
  );
};
