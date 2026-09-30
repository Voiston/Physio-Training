import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, Sparkles, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { ...toast, id };
    setToasts(prev => [...prev.slice(-3), newToast]); // Garder au maximum 4 toasts

    const duration = toast.duration ?? 2800;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Floating Container */}
      <div 
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-3 sm:px-0"
      >
        {toasts.map(toast => {
          const isSuccess = toast.type === 'success' || !toast.type;
          const isWarning = toast.type === 'warning';
          const isError = toast.type === 'error';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-200 transform translate-y-0 opacity-100 animate-slide-up ${
                isSuccess
                  ? 'bg-slate-900/95 border-emerald-500/40 text-slate-100 shadow-[0_8px_24px_rgba(16,185,129,0.15)]'
                  : isWarning
                  ? 'bg-slate-900/95 border-amber-500/40 text-slate-100 shadow-[0_8px_24px_rgba(245,158,11,0.15)]'
                  : isError
                  ? 'bg-slate-900/95 border-rose-500/40 text-slate-100 shadow-[0_8px_24px_rgba(244,67,54,0.15)]'
                  : 'bg-slate-900/95 border-blue-500/40 text-slate-100 shadow-[0_8px_24px_rgba(59,130,246,0.15)]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">
                  {isSuccess && <CheckCircle2 size={16} className="text-emerald-400" />}
                  {isWarning && <AlertCircle size={16} className="text-amber-400" />}
                  {isError && <AlertCircle size={16} className="text-rose-400" />}
                  {toast.type === 'info' && <Sparkles size={16} className="text-blue-400" />}
                </div>
                <div>
                  <h6 className="text-xs font-bold text-white tracking-tight m-0">
                    {toast.title}
                  </h6>
                  {toast.message && (
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug m-0">
                      {toast.message}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
