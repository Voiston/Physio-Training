import React, { useState } from 'react';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  Smartphone,
  Monitor,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  LogOut,
  ExternalLink,
  Wifi,
  WifiOff,
  Zap
} from 'lucide-react';
import type { SyncStatus, UserAccount } from '../hooks/useCloudSync';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncKey: string;
  userAccount: UserAccount | null;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  activeDevicesCount: number;
  pairingUrl: string;
  qrCodeUrl: string;
  onUpdateSyncKey: (key: string) => void;
  onLoginWithGoogle: (email: string, name?: string) => void;
  onLogout: () => void;
  onPushToCloud: () => void;
  onPullFromCloud: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  syncKey,
  userAccount,
  syncStatus,
  lastSyncedAt,
  activeDevicesCount,
  pairingUrl,
  qrCodeUrl,
  onUpdateSyncKey,
  onLoginWithGoogle,
  onLogout,
  onPushToCloud,
  onPullFromCloud,
}) => {
  const [customKeyInput, setCustomKeyInput] = useState(syncKey);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [isEditingKey, setIsEditingKey] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(pairingUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(syncKey);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleApplyKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (customKeyInput.trim()) {
      onUpdateSyncKey(customKeyInput.trim());
      setIsEditingKey(false);
    }
  };

  const handleGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (googleEmailInput.trim()) {
      onLoginWithGoogle(googleEmailInput.trim());
    }
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
                Synchronisation Smartphone ↔ PC
              </h2>
              <p className="text-xs text-slate-400">
                Vos séances et métriques synchronisées en direct sur tous vos appareils
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
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
              ) : (
                <WifiOff className="w-4 h-4 text-amber-500" />
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
                    : 'Mode Hors-ligne (local)'}
                </span>
                {syncStatus === 'synced' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Firestore Cloud
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400">
                Dernière synchro : <span className="text-slate-200 font-medium">{formatLastSync(lastSyncedAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onPushToCloud}
              title="Envoyer les données locales vers le cloud"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Forcer sync</span>
            </button>
          </div>
        </div>

        {/* Google Authentication Box */}
        <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Compte Google Cloud
            </span>
            {userAccount && (
              <span className="text-[11px] px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-medium">
                Connecté
              </span>
            )}
          </div>

          {userAccount ? (
            <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
                  {userAccount.name ? userAccount.name.charAt(0).toUpperCase() : 'G'}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{userAccount.name || userAccount.email}</div>
                  <div className="text-xs text-slate-400">{userAccount.email}</div>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg text-xs flex items-center gap-1 transition-colors border border-rose-500/20"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Déconnexion</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleGoogleSubmit} className="flex flex-col gap-3">
              <p className="text-xs text-slate-400">
                Liez vos séances à votre compte Google pour une synchronisation automatique et transparente entre smartphone et PC sans aucun code à saisir.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="email"
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    placeholder="votre-compte@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                  <span>Connexion Google en 1 clic</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Smartphone QR Code & Pairing Section */}
        <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              Ouvrir sur votre Smartphone (Scan QR Code)
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-900 border border-slate-800/80 rounded-xl">
            {qrCodeUrl ? (
              <div className="p-2.5 bg-slate-950 border border-blue-500/40 rounded-xl shadow-lg shrink-0">
                <img
                  src={qrCodeUrl}
                  alt="QR Code de synchronisation smartphone"
                  className="w-36 h-36 rounded-lg object-contain"
                />
              </div>
            ) : (
              <div className="w-36 h-36 bg-slate-950 rounded-xl flex items-center justify-center">
                <QrCode className="w-8 h-8 text-slate-600 animate-pulse" />
              </div>
            )}

            <div className="flex flex-col gap-2.5 text-center sm:text-left">
              <h4 className="text-sm font-semibold text-white">
                Pointez votre smartphone vers ce QR code
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                L'appareil photo de votre téléphone ouvrira directement l'application, 
                <span className="text-emerald-400 font-medium"> déjà configurée et jumelée en direct</span> avec ce PC.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Lien copié !' : 'Copier le lien direct'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sync Code manual entry */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Code de jumelage actif :</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2.5 py-1 bg-slate-900 text-blue-400 border border-blue-500/30 rounded font-bold tracking-wider">
                  {syncKey}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-1 text-slate-400 hover:text-white rounded transition-colors"
                  title="Copier le code"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setIsEditingKey(!isEditingKey)}
                  className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 ml-1"
                >
                  {isEditingKey ? 'Fermer' : 'Modifier'}
                </button>
              </div>
            </div>

            {isEditingKey && (
              <form onSubmit={handleApplyKey} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={customKeyInput}
                  onChange={(e) => setCustomKeyInput(e.target.value)}
                  placeholder="Ex: MON_CODE_PERSO"
                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white uppercase focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
                >
                  Rejoindre ce code
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Gym offline guarantee notice */}
        <div className="p-3 bg-blue-950/20 border border-blue-900/30 rounded-xl flex items-start gap-3 text-xs text-slate-400">
          <Zap className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-slate-200">Garantie 100% Hors-Ligne à la salle : </strong>
            Même si vous perdez le réseau dans un sous-sol de salle de sport, toutes vos séries et temps de repos continuent de s'enregistrer localement. Dès que le smartphone retrouve du réseau ou le Wi-Fi, la synchronisation avec votre PC se fait automatiquement sans conflit.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
