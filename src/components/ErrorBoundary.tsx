import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  confirmingReset: boolean;
}

/**
 * Purge hermétique des données applicatives locales de PhysioTracker PRO.
 * Supprime uniquement les séances/métriques (YYYY-MM-DD_*), les données physio_*
 * et les brouillons training_*, en préservant strictement les jetons d'authentification
 * Firebase et les clés tierces du domaine.
 */
export function purgeAppLocalStorage(storage: Storage = localStorage): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      if (/^\d{4}-\d{2}-\d{2}_/.test(key) || key.startsWith('physio_') || key.startsWith('training_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => storage.removeItem(k));
  } catch (e) {
    console.warn('Erreur lors de la purge ciblée de localStorage:', e);
  }
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      confirmingReset: false,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, confirmingReset: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in PhysioTracker PRO:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleRequestReset = () => {
    this.setState({ confirmingReset: true });
  };

  private handleCancelReset = () => {
    this.setState({ confirmingReset: false });
  };

  private handleConfirmReset = () => {
    purgeAppLocalStorage();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0c] text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white/5 border border-red-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={24} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Une erreur d'affichage est survenue</h2>
              <p className="text-xs text-slate-400 mt-1">
                L'application a rencontré une exception inattendue. Vous pouvez tenter de recharger ou réinitialiser le cache local.
              </p>
            </div>

            {/* Affichage assaini et anonymisé : aucune PII (email, UID, JSON brut) n'est exposée */}
            <div className="p-3.5 bg-black/60 border border-white/10 rounded-xl text-left space-y-1.5">
              <div className="text-xs font-mono font-bold text-red-300">
                Incident applicatif intercepté
              </div>
              <p className="text-xs text-slate-300 m-0 leading-relaxed">
                Les données locales sont sécurisées. Vous pouvez rafraîchir l'application ou réinitialiser le cache local si le problème persiste.
              </p>
            </div>

            {this.state.confirmingReset ? (
              <div
                role="alert"
                className="p-3.5 bg-red-950/50 border border-red-500/40 rounded-xl space-y-3 text-left"
              >
                <p className="text-xs text-red-100 m-0 leading-relaxed">
                  Confirmer la purge des données locales du navigateur ? Vos données déjà synchronisées sur Google Cloud resteront intactes.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={this.handleCancelReset}
                    className="min-h-[44px] flex-1 py-2 px-3 bg-white/10 hover:bg-white/15 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={this.handleConfirmReset}
                    className="min-h-[44px] flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Confirmer la purge
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="min-h-[44px] flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  <span>Recharger la page</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleRequestReset}
                  className="min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 hover:bg-red-500/20 text-slate-200 hover:text-red-200 border border-white/10 hover:border-red-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  title="Vider le stockage local pour réparer une structure corrompue"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  <span>Réinitialiser</span>
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
