import React, { useState } from 'react';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  Smartphone,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  LogOut,
  WifiOff,
  Zap,
  Lock,
  ArrowRight
} from 'lucide-react';
import type { SyncStatus, UserAccount } from '../hooks/useCloudSync';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAccount: UserAccount | null;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  pairingUrl: string;
  qrCodeUrl: string;
  onLoginWithGoogle: () => void;
  onLogout: () => void;
  onPushToCloud: () => void;
  onPullFromCloud: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  userAccount,
  syncStatus,
  lastSyncedAt,
  pairingUrl,
  qrCodeUrl,
  onLoginWithGoogle,
  onLogout,
  onPushToCloud,
  onPullFromCloud,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(pairingUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Jamais';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'À l\'instant';
    if (seconds < 60) return `Il y a ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Il y a ${minutes} min`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 p-6 flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
              <Cloud className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">
                Synchronisation Sécurisée Google Cloud
              </h2>
              <p className="text-xs text-slate-400">
                Vos séances et métriques synchronisées automatiquement entre Smartphone et PC
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              {syncStatus === 'synced' ? (
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
              ) : syncStatus === 'syncing' ? (
                <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
              ) : syncStatus === 'offline' ? (
                <WifiOff className="w-4 h-4 text-amber-500" />
              ) : (
                <Lock className="w-4 h-4 text-slate-400" />
              )}
              {syncStatus === 'synced' && (
                <div className="absolute inset-0 w-3 h-3 bg-emerald-500 rounded-full" />
              )}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>
                  {syncStatus === 'synced'
                    ? 'Synchronisation temps réel active'
                    : syncStatus === 'syncing'
                    ? 'Synchronisation en cours...'
                    : syncStatus === 'offline'
                    ? 'Mode Hors-ligne (local)'
                    : 'Non connecté (données locales uniquement)'}
                </span>
                {syncStatus === 'synced' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    Firestore UID Protégé
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400">
                {userAccount ? (
                  <>Dernière synchro : <span className="text-slate-200 font-medium">{formatLastSync(lastSyncedAt)}</span></>
                ) : (
                  <span>Connectez votre compte Google pour activer le Cloud</span>
                )}
              </div>
            </div>
          </div>

          {userAccount && (
            <div className="flex items-center gap-2">
              <button
                onClick={onPushToCloud}
                title="Envoyer manuellement les données vers le cloud"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Forcer sync</span>
              </button>
            </div>
          )}
        </div>

        {/* Google Authentication Box */}
        <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Authentification Chiffrée Google
            </span>
            {userAccount ? (
              <span className="text-[11px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Connecté
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-medium">
                Hors-ligne / Local
              </span>
            )}
          </div>

          {userAccount ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-3">
                {userAccount.avatar ? (
                  <img
                    src={userAccount.avatar}
                    alt={userAccount.name || 'Avatar'}
                    className="w-10 h-10 rounded-full border border-blue-500/30 object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
                    {userAccount.name ? userAccount.name.charAt(0).toUpperCase() : 'G'}
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold text-white">{userAccount.name || userAccount.email}</div>
                  <div className="text-xs text-slate-400 font-mono">{userAccount.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onPullFromCloud}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                  title="Recharger depuis le Cloud"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Recharger</span>
                </button>
                <button
                  onClick={onLogout}
                  className="px-3 py-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg text-xs flex items-center gap-1 transition-colors border border-rose-500/20 cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Déconnexion</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Connectez-vous avec votre compte Google. Vos séances, métriques de fatigue et programmations par blocs seront <strong>sécurisées et synchronisées en temps réel</strong> entre tous vos appareils.
              </p>
              
              <button
                type="button"
                onClick={onLoginWithGoogle}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/25 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Se connecter avec Google en 1 clic</span>
              </button>
            </div>
          )}
        </div>

        {/* Smartphone QR Code Section */}
        <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-blue-400" />
              Ouvrir sur votre Smartphone
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-900 border border-slate-800/80 rounded-xl">
            {qrCodeUrl ? (
              <div className="p-2.5 bg-slate-950 border border-blue-500/30 rounded-xl shadow-lg shrink-0">
                <img
                  src={qrCodeUrl}
                  alt="QR Code d'ouverture sur smartphone"
                  className="w-32 h-32 rounded-lg object-contain"
                />
              </div>
            ) : (
              <div className="w-32 h-32 bg-slate-950 rounded-xl flex items-center justify-center">
                <QrCode className="w-8 h-8 text-slate-600 animate-pulse" />
              </div>
            )}

            <div className="flex flex-col gap-2 text-center sm:text-left">
              <h4 className="text-sm font-semibold text-white flex items-center justify-center sm:justify-start gap-1.5">
                <span>1. Scannez le QR Code avec votre téléphone</span>
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                2. Connectez-vous avec le <strong>même compte Google</strong> sur votre mobile : vos données seront automatiquement en miroir parfait.
              </p>

              <div className="flex flex-wrap gap-2 pt-1 justify-center sm:justify-start">
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Lien copié !' : 'Copier l\'adresse'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Offline & Security Guarantee */}
        <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col gap-2.5 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-slate-200 font-semibold uppercase tracking-wider text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Périmètre de synchronisation intégrale (100% de l'application) :</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
            <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800/80 text-slate-300 flex items-center gap-1.5">
              <span>📅</span> <span>Grille & Toutes séances</span>
            </div>
            <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800/80 text-slate-300 flex items-center gap-1.5">
              <span>💓</span> <span>VFC & Forme / Readiness</span>
            </div>
            <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800/80 text-slate-300 flex items-center gap-1.5">
              <span>🧱</span> <span>Blocs de préparation</span>
            </div>
            <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800/80 text-slate-300 flex items-center gap-1.5">
              <span>🎯</span> <span>Compétition & Tapering</span>
            </div>
            <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800/80 text-slate-300 flex items-center gap-1.5">
              <span>🧬</span> <span>Modèle Banister (τ₁ / τ₂)</span>
            </div>
            <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800/80 text-slate-300 flex items-center gap-1.5">
              <span>🏋️</span> <span>Mode Salle & Exercices</span>
            </div>
          </div>
        </div>

        {/* Guarantee */}
        <div className="p-3 bg-blue-950/20 border border-blue-900/30 rounded-xl flex items-start gap-3 text-xs text-slate-400">
          <Zap className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-slate-200">Garantie Hors-Ligne & Zéro-Fuite : </strong>
            Vos données sont isolées sur Firestore sous votre identifiant Google chiffré unique (UID). À la salle de sport sans réseau, tout est sauvegardé en local puis synchronisé dès que le Wi-Fi ou la 4G/5G revient.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
