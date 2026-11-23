import React, { useState, useRef } from 'react';
import {
  Watch,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  Lock,
  ExternalLink,
  RotateCcw,
  CheckCheck,
  ShieldCheck,
} from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';
import type { UserAccount } from '../hooks/useCloudSync';
import type {
  IntervalsConnectionState,
  AutoMetricsImportSummary,
} from '../hooks/useIntervalsSync';
import type { PendingGarminActivity } from '../utils/intervalsMapper';

import type { DailyMetrics } from '../hooks/useMetricsState';

interface GarminSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionState: IntervalsConnectionState;
  isConfigured: boolean;
  isSyncing: boolean;
  athleteName: string | null;
  lastSyncedAt: Date | null;
  lastMetricsSummary: AutoMetricsImportSummary | null;
  dailyMetrics?: Record<string, DailyMetrics>;
  error: string | null;
  pendingActivities: PendingGarminActivity[];
  processedCount: number;
  userAccount: UserAccount | null;
  authError?: string | null;
  isSigningIn?: boolean;
  onLoginWithGoogle: () => void;
  onCheckStatus: () => void;
  onSyncNow: (daysBack: number) => void;
  onValidateAll: () => void;
  onRestoreDismissed: () => void;
}

function formatSyncTime(date: Date | null): string {
  if (!date) return 'Pas encore synchronisé';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 15) return 'À l’instant';
  if (seconds < 60) return `Il y a ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Il y a ${minutes} min`;
  return `À ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export const GarminSyncModal: React.FC<GarminSyncModalProps> = ({
  isOpen,
  onClose,
  connectionState,
  isConfigured,
  isSyncing,
  athleteName,
  lastSyncedAt,
  lastMetricsSummary,
  dailyMetrics,
  error,
  pendingActivities,
  processedCount,
  userAccount,
  authError = null,
  isSigningIn = false,
  onLoginWithGoogle,
  onCheckStatus,
  onSyncNow,
  onValidateAll,
  onRestoreDismissed,
}) => {
  const [daysBack, setDaysBack] = useState<7 | 14 | 30>(14);
  const [confirmRestore, setConfirmRestore] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalA11y(isOpen, onClose, modalRef);

  if (!isOpen) return null;

  // Fallback sur les dernières métriques déjà présentes dans la grille avant toute synchro manuelle
  const latestLocalFallback = (() => {
    if (!dailyMetrics) return null;
    const dates = Object.keys(dailyMetrics).sort();
    let vfc: number | undefined;
    let hrRest: number | undefined;
    let readiness: number | undefined;
    let latestDate: string | undefined;
    for (const d of dates) {
      const m = dailyMetrics[d];
      if (!m) continue;
      let hasAny = false;
      if (typeof m.vfc === 'number') { vfc = m.vfc; hasAny = true; }
      if (typeof m.hrRest === 'number') { hrRest = m.hrRest; hasAny = true; }
      if (typeof m.readiness === 'number') { readiness = m.readiness; hasAny = true; }
      if (hasAny) latestDate = d;
    }
    if (!latestDate) return null;
    return { latestDate, latestValues: { vfc, hrRest, readiness } };
  })();

  const displayedDate = lastMetricsSummary?.latestDate || latestLocalFallback?.latestDate;
  const displayedValues = lastMetricsSummary?.latestValues || latestLocalFallback?.latestValues;
  const noWellnessFromIntervals =
    Boolean(lastSyncedAt) && lastMetricsSummary !== null && (lastMetricsSummary.receivedDays ?? 0) === 0;

  const statusMeta = (() => {
    switch (connectionState) {
      case 'ready':
        return {
          label: athleteName ? `Connecté · ${athleteName}` : 'Passerelle Garmin active',
          tone: 'text-emerald-300',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />,
        };
      case 'syncing':
        return {
          label: 'Synchronisation Garmin en cours…',
          tone: 'text-blue-300',
          icon: <RefreshCw className="w-4 h-4 text-blue-400 animate-spin shrink-0" aria-hidden="true" />,
        };
      case 'checking':
        return {
          label: 'Vérification de la passerelle…',
          tone: 'text-slate-300',
          icon: <RefreshCw className="w-4 h-4 text-slate-400 animate-spin shrink-0" aria-hidden="true" />,
        };
      case 'offline':
        return {
          label: 'Hors-ligne · reprise automatique au retour du réseau',
          tone: 'text-amber-300',
          icon: <WifiOff className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />,
        };
      case 'auth_required':
        return {
          label: 'Connexion Google requise pour sécuriser l’accès',
          tone: 'text-amber-300',
          icon: <Lock className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />,
        };
      case 'static_host':
        return {
          label: 'Hébergement statique (GitHub Pages) · passerelle requise',
          tone: 'text-amber-300',
          icon: <Watch className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />,
        };
      case 'unconfigured':
        return {
          label: 'Configuration initiale requise (1 fois)',
          tone: 'text-slate-200',
          icon: <Watch className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />,
        };
      case 'error':
      default:
        return {
          label: 'Connexion interrompue',
          tone: 'text-rose-300',
          icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />,
        };
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="garmin-sync-title"
        aria-describedby="garmin-sync-desc"
        className="relative w-full sm:max-w-xl max-h-[92vh] overflow-y-auto bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl text-slate-100 p-5 sm:p-6 pb-[max(env(safe-area-inset-bottom,0px),20px)] flex flex-col gap-5 focus:outline-none animate-sheet-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Poignée mobile */}
        <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto -mt-1 mb-1 sm:hidden" aria-hidden="true" />

        {/* En-tête */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400" aria-hidden="true">
              <Watch className="w-5 h-5" />
            </div>
            <div>
              <h2 id="garmin-sync-title" className="text-lg font-bold text-white tracking-tight m-0">
                Synchronisation Garmin
              </h2>
              <p id="garmin-sync-desc" className="text-xs text-slate-400 m-0">
                Passerelle Intervals.icu · VFC, FC repos, Readiness & séances 1 clic
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre de synchronisation Garmin"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Bandeau d'état */}
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {statusMeta.icon}
            <div className="min-w-0">
              <div className={`text-xs font-semibold ${statusMeta.tone} truncate`}>{statusMeta.label}</div>
              <div className="text-xs text-slate-400 font-mono tabular-nums">
                {formatSyncTime(lastSyncedAt)}
              </div>
            </div>
          </div>

          {isConfigured && userAccount && (
            <button
              type="button"
              onClick={() => onSyncNow(daysBack)}
              disabled={isSyncing || connectionState === 'offline'}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Synchroniser</span>
            </button>
          )}
        </div>

        {/* Erreur éventuelle */}
        {error && (
          <div
            role="alert"
            className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-xs text-rose-200"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 space-y-2">
              <p className="m-0 leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => (isConfigured && userAccount ? onSyncNow(daysBack) : onCheckStatus())}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 font-semibold transition-colors cursor-pointer"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* ÉTAT A0 : Hébergement statique (GitHub Pages) sans URL de passerelle configurée */}
        {connectionState === 'static_host' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3.5">
              <div className="text-xs font-semibold text-slate-200">
                Activer Garmin sur GitHub Pages (passerelle Cloudflare gratuite, 1 fois)
              </div>
              <p className="m-0 text-xs text-slate-400 leading-relaxed">
                GitHub Pages héberge uniquement des fichiers statiques et ne peut pas stocker votre clé API secrète. Le dépôt inclut déjà le fichier{' '}
                <code className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">
                  workers/intervals-proxy.js
                </code>{' '}
                prêt à déployer gratuitement :
              </p>

              <ol className="space-y-3 m-0 p-0 list-none text-xs text-slate-300 leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="font-mono text-blue-400 font-bold shrink-0">01.</span>
                  <div>
                    <span className="text-white font-semibold">Créez un Cloudflare Worker gratuit</span>
                    <p className="m-0 mt-0.5 text-slate-400">
                      Sur{' '}
                      <a
                        href="https://dash.cloudflare.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-0.5"
                      >
                        dash.cloudflare.com
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                      {' '}→ <strong className="text-slate-200">Workers &amp; Pages → Create Worker</strong>, collez le contenu de{' '}
                      <code className="px-1 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">workers/intervals-proxy.js</code>{' '}
                      et cliquez sur <strong className="text-slate-200">Deploy</strong>.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="font-mono text-blue-400 font-bold shrink-0">02.</span>
                  <div>
                    <span className="text-white font-semibold">Ajoutez votre clé Intervals.icu dans Cloudflare</span>
                    <p className="m-0 mt-0.5 text-slate-400">
                      Dans le Worker → <strong className="text-slate-200">Settings → Variables and Secrets → Add Secret</strong>, créez{' '}
                      <code className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">
                        INTERVALS_ICU_API_KEY
                      </code>{' '}
                      avec votre clé API Intervals.icu.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="font-mono text-blue-400 font-bold shrink-0">03.</span>
                  <div>
                    <span className="text-white font-semibold">Renseignez l’URL du Worker dans GitHub</span>
                    <p className="m-0 mt-0.5 text-slate-400">
                      Dans votre dépôt GitHub → <strong className="text-slate-200">Settings → Secrets and variables → Actions → Variables</strong>, ajoutez{' '}
                      <code className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">
                        VITE_INTERVALS_PROXY_URL
                      </code>{' '}
                      avec l’URL <code className="text-slate-200 font-mono">https://…workers.dev</code> puis relancez le déploiement GitHub Pages.
                    </p>
                  </div>
                </li>
              </ol>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>Clé isolée dans Cloudflare · accès vérifié par votre compte Google</span>
                </div>
                <button
                  type="button"
                  onClick={onCheckStatus}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Revérifier</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ÉTAT A : Clé serveur INTERVALS_ICU_API_KEY non encore configurée */}
        {!isConfigured && connectionState !== 'checking' && connectionState !== 'static_host' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3.5">
              <div className="text-xs font-semibold text-slate-200">
                Configuration initiale en 3 étapes (environ 2 minutes, une seule fois)
              </div>

              <ol className="space-y-3 m-0 p-0 list-none text-xs text-slate-300 leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="font-mono text-blue-400 font-bold shrink-0">01.</span>
                  <div>
                    <span className="text-white font-semibold">Reliez Garmin Connect à Intervals.icu</span>
                    <p className="m-0 mt-0.5 text-slate-400">
                      Sur{' '}
                      <a
                        href="https://intervals.icu/settings"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-0.5"
                      >
                        intervals.icu/settings
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                      , activez la connexion <strong className="text-slate-200">Garmin Connect</strong> (activités + bien-être VFC, FC repos et sommeil).
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="font-mono text-blue-400 font-bold shrink-0">02.</span>
                  <div>
                    <span className="text-white font-semibold">Générez votre clé API personnelle</span>
                    <p className="m-0 mt-0.5 text-slate-400">
                      En bas de la page <strong className="text-slate-200">Settings → Developer Settings</strong> d’Intervals.icu, cliquez sur <strong className="text-slate-200">API Key</strong> et copiez-la.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="font-mono text-blue-400 font-bold shrink-0">03.</span>
                  <div>
                    <span className="text-white font-semibold">Ajoutez le secret côté serveur</span>
                    <p className="m-0 mt-0.5 text-slate-400">
                      Dans les paramètres <strong className="text-slate-200">Settings → Secrets</strong> de votre environnement, ajoutez la variable{' '}
                      <code className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">
                        INTERVALS_ICU_API_KEY
                      </code>
                      . Votre clé reste strictement isolée côté serveur et n’est jamais exposée au navigateur.
                    </p>
                  </div>
                </li>
              </ol>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>Identifiant athlète résolu automatiquement (0)</span>
                </div>
                <button
                  type="button"
                  onClick={onCheckStatus}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Vérifier la connexion</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ÉTAT B : Configuré mais compte Google non connecté */}
        {isConfigured && !userAccount && (
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3.5">
            <p className="text-xs text-slate-300 leading-relaxed m-0">
              Votre passerelle Garmin est configurée sur le serveur. Connectez votre compte Google autorisé en 1 clic pour déverrouiller la synchronisation automatique et éviter les doublons entre smartphone et PC.
            </p>
            {authError && (
              <div
                role="alert"
                className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-200 leading-relaxed"
              >
                {authError}
              </div>
            )}
            <button
              type="button"
              onClick={onLoginWithGoogle}
              disabled={isSigningIn}
              className="w-full min-h-[46px] py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isSigningIn && <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />}
              <span>{isSigningIn ? 'Connexion Google en cours…' : 'Se connecter avec Google'}</span>
            </button>
          </div>
        )}

        {/* ÉTAT C : Opérationnel */}
        {isConfigured && userAccount && (
          <div className="space-y-4">
            {/* Fenêtre de synchronisation */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div>
                <div className="text-xs font-semibold text-slate-200">Fenêtre d’import manuel</div>
                <div className="text-[11px] text-slate-400">
                  Synchro auto silencieuse sur 14 jours à chaque ouverture
                </div>
              </div>
              <div className="inline-flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                {([7, 14, 30] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDaysBack(d)}
                    className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-mono tabular-nums font-semibold transition-colors cursor-pointer ${
                      daysBack === d
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {d}j
                  </button>
                ))}
              </div>
            </div>

            {/* Résumé des dernières métriques matinales importées */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200">
                  Métriques quotidiennes (import silencieux)
                </span>
                {displayedDate && (
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {displayedDate}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="py-2.5 px-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div className="text-[11px] text-slate-400">VFC</div>
                  <div className="text-base font-mono tabular-nums font-bold text-white mt-0.5">
                    {displayedValues?.vfc !== undefined
                      ? `${displayedValues.vfc} ms`
                      : '—'}
                  </div>
                </div>
                <div className="py-2.5 px-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div className="text-[11px] text-slate-400">FC repos</div>
                  <div className="text-base font-mono tabular-nums font-bold text-white mt-0.5">
                    {displayedValues?.hrRest !== undefined
                      ? `${displayedValues.hrRest} bpm`
                      : '—'}
                  </div>
                </div>
                <div className="py-2.5 px-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Readiness</div>
                  <div className="text-base font-mono tabular-nums font-bold text-white mt-0.5">
                    {displayedValues?.readiness !== undefined
                      ? `${displayedValues.readiness}/10`
                      : '—'}
                  </div>
                </div>
              </div>

              {noWellnessFromIntervals ? (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 space-y-1.5 leading-relaxed">
                  <div className="font-semibold text-amber-100">
                    Aucune donnée bien-être (VFC, FC repos, Sommeil) reçue d’Intervals.icu sur les {daysBack} derniers jours.
                  </div>
                  <p className="m-0 text-amber-200/90">
                    Sur{' '}
                    <a
                      href="https://intervals.icu/settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-amber-100 hover:text-white inline-flex items-center gap-0.5"
                    >
                      intervals.icu/settings
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>{' '}
                    → <strong>Garmin Connect</strong>, vérifiez que <strong>« Download wellness data »</strong> est bien coché (puis cliquez sur <em>Download old data</em> si activé récemment), puis relancez <strong>Synchroniser</strong>.
                  </p>
                </div>
              ) : lastMetricsSummary && (lastMetricsSummary.receivedDays ?? 0) > 0 ? (
                <p className="text-[11px] text-emerald-300/90 m-0 leading-relaxed">
                  {lastMetricsSummary.receivedDays} jour{(lastMetricsSummary.receivedDays ?? 0) > 1 ? 's' : ''} reçu{(lastMetricsSummary.receivedDays ?? 0) > 1 ? 's' : ''} d’Intervals.icu
                  {lastMetricsSummary.updatedCount > 0
                    ? ` · ${lastMetricsSummary.updatedCount} mesure${lastMetricsSummary.updatedCount > 1 ? 's' : ''} mise${lastMetricsSummary.updatedCount > 1 ? 's' : ''} à jour dans la grille.`
                    : ' · déjà à jour dans la grille.'}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 m-0 leading-relaxed">
                  Vos saisies manuelles dans la grille ne sont jamais écrasées par la synchronisation Garmin.
                </p>
              )}
            </div>

            {/* État de la boîte de réception des séances */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  {pendingActivities.length > 0
                    ? `${pendingActivities.length} séance${pendingActivities.length > 1 ? 's' : ''} Garmin en attente`
                    : 'Toutes vos séances Garmin sont à jour'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {pendingActivities.length > 0
                    ? 'Ajustez la filière ou validez en 1 clic depuis la grille.'
                    : 'Vos prochaines sorties apparaîtront automatiquement au-dessus de la grille.'}
                </div>
              </div>

              {pendingActivities.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onValidateAll();
                    onClose();
                  }}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Tout valider</span>
                </button>
              )}
            </div>

            {/* Option de récupération des activités ignorées */}
            {processedCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
                <span className="font-mono tabular-nums">
                  {processedCount} activité{processedCount > 1 ? 's' : ''} déjà traitée{processedCount > 1 ? 's' : ''}
                </span>
                {confirmRestore ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmRestore(false);
                        onRestoreDismissed();
                      }}
                      className="min-h-[36px] px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 font-semibold cursor-pointer"
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRestore(false)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRestore(true)}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Réafficher les activités ignorées</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pied de modale */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default GarminSyncModal;
