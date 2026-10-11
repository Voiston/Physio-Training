import React from 'react';
import { MuscularAlert } from '../utils/muscleHelpers';
import { AlertTriangle, ShieldAlert, CheckCircle2, Info, ArrowRight } from 'lucide-react';

interface MuscleAlertsBannerProps {
  alerts: MuscularAlert[];
  className?: string;
}

export const MuscleAlertsBanner: React.FC<MuscleAlertsBannerProps> = ({ alerts, className = '' }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <section 
      aria-label="Alertes et équilibre biomécanique musculaire" 
      className={`space-y-2.5 ${className}`}
    >
      {alerts.map(alert => {
        let borderClass = 'border-blue-500/30 bg-blue-950/20';
        let titleColor = 'text-blue-200';
        let Icon = Info;
        let badgeStyle = 'bg-blue-500/20 text-blue-200 border-blue-500/40';

        if (alert.type === 'danger') {
          borderClass = 'border-rose-500/50 bg-gradient-to-r from-rose-950/40 via-slate-900/70 to-slate-900/90 shadow-[0_0_15px_rgba(244,63,94,0.15)]';
          titleColor = 'text-rose-200';
          Icon = ShieldAlert;
          badgeStyle = 'bg-rose-500/25 text-rose-200 border-rose-500/40 font-bold';
        } else if (alert.type === 'warning') {
          borderClass = 'border-amber-500/45 bg-gradient-to-r from-amber-950/35 via-slate-900/70 to-slate-900/90';
          titleColor = 'text-amber-200';
          Icon = AlertTriangle;
          badgeStyle = 'bg-amber-500/25 text-amber-200 border-amber-500/40 font-semibold';
        } else if (alert.type === 'success') {
          borderClass = 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/30 via-slate-900/70 to-slate-900/90';
          titleColor = 'text-emerald-200';
          Icon = CheckCircle2;
          badgeStyle = 'bg-emerald-500/25 text-emerald-200 border-emerald-500/40 font-semibold';
        }

        return (
          <article
            key={alert.id}
            role="alert"
            className={`p-3.5 sm:p-4 rounded-2xl border backdrop-blur-md transition-all ${borderClass}`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-xl border shrink-0 ${badgeStyle}`} aria-hidden="true">
                  <Icon size={16} />
                </div>
                <div>
                  <h4 className={`text-xs sm:text-sm font-bold tracking-tight ${titleColor} m-0`}>
                    {alert.title}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-300">
                    {alert.metric}
                  </span>
                </div>
              </div>

              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase font-bold border ${badgeStyle}`}>
                {alert.type === 'danger' ? 'Vigilance Blessure' : alert.type === 'warning' ? 'Déséquilibre' : alert.type === 'success' ? 'Équilibré' : 'Conseil'}
              </span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed mt-2.5 mb-2.5">
              {alert.message}
            </p>

            {alert.recommendations && alert.recommendations.length > 0 && (
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-300 tracking-wider block">
                  Recommandations du préparateur :
                </span>
                <ul className="list-none p-0 m-0 space-y-1.5">
                  {alert.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-slate-200">
                      <ArrowRight size={13} className="text-blue-400 shrink-0" aria-hidden="true" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
};
