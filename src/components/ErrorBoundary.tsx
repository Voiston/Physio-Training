import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in PhysioTracker PRO:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetData = () => {
    if (window.confirm('Voulez-vous réinitialiser les données locales du navigateur en cas de corruption ? (Pensez à sauvegarder un export si possible)')) {
      localStorage.clear();
      window.location.reload();
    }
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

            {this.state.error && (
              <div className="p-3 bg-black/50 border border-white/5 rounded-xl text-left overflow-x-auto text-[11px] font-mono text-red-300 max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                <RefreshCw size={14} /> Recharger la page
              </button>

              <button
                onClick={this.handleResetData}
                className="flex items-center justify-center gap-2 py-2 px-3 bg-white/5 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-white/10 hover:border-red-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                title="Vider le stockage local pour réparer une structure corrompue"
              >
                <Trash2 size={14} /> Réinitialiser
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
