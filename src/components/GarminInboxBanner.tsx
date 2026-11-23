import React, { useState } from 'react';
import {
  Watch,
  Check,
  CheckCheck,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
} from 'lucide-react';
import type { Quality, SessionData } from '../types';
import type { PendingGarminActivity } from '../utils/intervalsMapper';
import type { ActivityOverride } from '../hooks/useIntervalsSync';
import { computeDetailedSessionLoad } from '../utils/loadHelpers';
import { isForceQuality } from '../utils/qualities';
import { parseLocalDate } from '../utils/dateHelpers';
import { haptics } from '../utils/haptics';

interface GarminInboxBannerProps {
  pendingActivities: PendingGarminActivity[];
  qualities: Quality[];
  rawEvents: Record<string, Record<string, SessionData>>;
  isSyncing: boolean;
  onValidate: (activity: PendingGarminActivity, override?: ActivityOverride) => void;
  onValidateAll: (overridesByExternalId: Record<string, ActivityOverride>) => void;
  onDismiss: (externalId: string) => void;
  onRefresh: () => void;
  onOpenModal: () => void;
}

const WEEKDAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

function formatShortFrDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${WEEKDAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

function sportLabel(sport: 'run' | 'bike' | 'muscu'): string {
  if (sport === 'bike') return 'Vélo';
  if (sport === 'muscu') return 'Force';
  return 'Course';
}

export const GarminInboxBanner: React.FC<GarminInboxBannerProps> = ({
  pendingActivities,
  qualities,
  rawEvents,
  isSyncing,
  onValidate,
  onValidateAll,
  onDismiss,
  onRefresh,
  onOpenModal,
}) => {
  const [overrides, setOverrides] = useState<Record<string, ActivityOverride>>({});
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  if (pendingActivities.length === 0) return null;

  const getEffective = (act: PendingGarminActivity) => {
    const ov = overrides[act.externalId];
    const qualityId = ov?.qualityId || act.suggestedQualityId;
    const rpeCardio = ov?.rpeCardio ?? act.suggestedRpeCardio;
    const rpeMusc = ov?.rpeMusc ?? act.suggestedRpeMusc;
    return { qualityId, rpeCardio, rpeMusc };
  };

  const updateOverride = (externalId: string, patch: ActivityOverride) => {
    setOverrides((prev) => ({
      ...prev,
      [externalId]: { ...(prev[externalId] || {}), ...patch },
    }));
  };

  const adjustPrimaryRpe = (act: PendingGarminActivity, delta: number) => {
    const { qualityId, rpeCardio, rpeMusc } = getEffective(act);
    const isForce = isForceQuality(qualityId, qualities);
    const nextCardio = Math.max(1, Math.min(10, rpeCardio + delta));
    const nextMusc = Math.max(1, Math.min(10, rpeMusc + delta));
    haptics.tap();
    updateOverride(act.externalId, {
      rpeCardio: isForce ? rpeCardio : nextCardio,
      rpeMusc: isForce ? nextMusc : Math.max(1, Math.min(10, nextMusc)),
    });
  };

  return (
    <section
      aria-label="Séances Garmin en attente de validation"
      className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md shadow-xl overflow-hidden"
    >
      {/* En-tête compacte */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 shrink-0">
            <Watch size={16} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white m-0 tracking-tight">
                Séances Garmin à valider
              </h2>
              <span className="text-xs font-mono tabular-nums text-amber-300 font-semibold">
                {pendingActivities.length} en attente
              </span>
            </div>
            <p className="text-xs text-slate-400 m-0">
              Pré-classées via Intervals.icu · 1 clic pour intégrer dans la grille et les courbes Banister
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {pendingActivities.length > 1 && (
            <button
              type="button"
              onClick={() => {
                haptics.validate();
                onValidateAll(overrides);
              }}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-md shadow-blue-600/20"
            >
              <CheckCheck size={14} aria-hidden="true" />
              <span>Tout valider ({pendingActivities.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={isSyncing}
            aria-label="Actualiser les activités Garmin"
            title="Actualiser depuis Intervals.icu"
            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin text-blue-400' : ''} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onOpenModal}
            className="min-h-[40px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap hidden sm:inline-flex items-center"
          >
            Réglages
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? 'Déplier la liste des séances Garmin' : 'Replier la liste des séances Garmin'}
            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {isCollapsed ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Liste des activités en attente (filets 1px, zéro carte imbriquée) */}
      {!isCollapsed && (
        <div className="divide-y divide-white/10">
          {pendingActivities.map((act) => {
            const { qualityId, rpeCardio, rpeMusc } = getEffective(act);
            const isForce = isForceQuality(qualityId, qualities);
            const displayRpe = isForce ? rpeMusc : rpeCardio;
            const loadPreview = computeDetailedSessionLoad(
              qualityId,
              act.duration,
              rpeCardio,
              rpeMusc,
              qualityId === 'descente'
            ).load;
            const willMerge = Boolean(rawEvents[qualityId]?.[act.dateStr]);

            return (
              <div
                key={act.externalId}
                className="px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
              >
                {/* Informations d'activité (métadonnées propres sans pilules) */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-white truncate">{act.title}</span>
                    <span className="text-xs text-slate-400 shrink-0">· {sportLabel(act.sport)}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-mono tabular-nums text-slate-400">
                    <span className="text-slate-300">{formatShortFrDate(act.dateStr)}</span>
                    {act.startTime && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{act.startTime}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-200 font-semibold">{act.duration} min</span>
                    {act.distanceKm !== undefined && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{act.distanceKm} km</span>
                      </>
                    )}
                    {act.elevationGainM !== undefined && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>+{act.elevationGainM} m</span>
                      </>
                    )}
                    {act.avgHr !== undefined && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{act.avgHr} bpm</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-500 font-sans">{act.classificationReason}</span>
                  </div>

                  {willMerge && (
                    <p className="text-[11px] text-amber-300/90 m-0">
                      Une séance existe déjà ce jour sur cette filière · ajout automatique en sous-séance
                    </p>
                  )}
                </div>

                {/* Contrôles compacts en ligne + Validation 1 clic */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    aria-label={`Filière physiologique pour ${act.title}`}
                    value={qualityId}
                    onChange={(e) => updateOverride(act.externalId, { qualityId: e.target.value })}
                    className="min-h-[42px] px-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/15 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {qualities.map((q) => (
                      <option key={q.id} value={q.id} className="bg-slate-900 text-slate-100">
                        {q.name}
                      </option>
                    ))}
                  </select>

                  {/* Stepper RPE rapide */}
                  <div
                    className="inline-flex items-center rounded-xl bg-slate-900/90 border border-white/15 overflow-hidden"
                    aria-label={`Ajuster le RPE pour ${act.title}`}
                  >
                    <button
                      type="button"
                      onClick={() => adjustPrimaryRpe(act, -1)}
                      disabled={displayRpe <= 1}
                      aria-label="Diminuer le RPE"
                      className="min-w-[38px] min-h-[42px] inline-flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
                    >
                      <Minus size={13} aria-hidden="true" />
                    </button>
                    <span className="px-2 text-xs font-mono tabular-nums text-slate-200 whitespace-nowrap select-none">
                      RPE {displayRpe}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustPrimaryRpe(act, 1)}
                      disabled={displayRpe >= 10}
                      aria-label="Augmenter le RPE"
                      className="min-w-[38px] min-h-[42px] inline-flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
                    >
                      <Plus size={13} aria-hidden="true" />
                    </button>
                  </div>

                  {/* Charge Foster calculée en direct */}
                  <span className="text-xs font-mono tabular-nums font-semibold text-blue-300 min-w-[58px] text-right whitespace-nowrap">
                    {loadPreview} UA
                  </span>

                  {/* Bouton 1 clic Valider */}
                  <button
                    type="button"
                    onClick={() => {
                      haptics.validate();
                      onValidate(act, { qualityId, rpeCardio, rpeMusc });
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-sm shadow-blue-600/25"
                  >
                    <Check size={14} aria-hidden="true" />
                    <span>Valider</span>
                  </button>

                  {/* Ignorer */}
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      onDismiss(act.externalId);
                    }}
                    aria-label={`Ignorer l'activité ${act.title}`}
                    title="Ignorer définitivement cette activité"
                    className="min-w-[42px] min-h-[42px] inline-flex items-center justify-center rounded-xl bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default GarminInboxBanner;
