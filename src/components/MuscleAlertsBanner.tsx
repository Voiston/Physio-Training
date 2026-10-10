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
    <div className={`space-y-2.5 ${className}`}>
      {alerts.map(alert => {
        let borderClass = 'border-blue-500/30 bg-blue-950/20';
        let titleColor = 'text-blue-300';
        let Icon = Info;
        let badgeStyle = 'bg-blue-500/20 text-blue-300 border-blue-500/30';

        if (alert.type === 'danger') {
          borderClass = 'border-rose-500/40 bg-gradient-to-r from-rose-950/30 via-slate-900/60 to-slate-900/80 shadow-[0_0_15px_rgba(244,63,94,0.1)]';
          titleColor = 'text-rose-300';
          Icon = ShieldAlert;
          badgeStyle = 'bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold';
        } else if (alert.type === 'warning') {
          borderClass = 'border-amber-500/35 bg-gradient-to-r from-amber-950/25 via-slate-900/60 to-slate-900/80';
          titleColor = 'text-amber-300';
          Icon = AlertTriangle;
          badgeStyle = 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-semibold';
        } else if (alert.type === 'success') {
          borderClass = 'border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-slate-900/60 to-slate-900/80';
          titleColor = 'text-emerald-300';
          Icon = CheckCircle2;
          badgeStyle = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
        }

        return (
          <div
            key={alert.id}
            className={`p-3.5 sm:p-4 rounded-2xl border backdrop-blur-md transition-all ${borderClass}`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-xl border shrink-0 ${badgeStyle}`}>
                  <Icon size={16} />
                </div>
                <div>
                  <h4 className={`text-xs sm:text-sm font-bold tracking-tight ${titleColor} m-0`}>
                    {alert.title}
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    {alert.metric}
                  </span>
                </div>
              </div>

              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase font-bold border ${badgeStyle}`}>
                {alert.type === 'danger' ? 'Vigilance Blessure' : alert.type === 'warning' ? 'Déséquilibre' : alert.type === 'success' ? 'Équilibré' : 'Conseil'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mt-2 mb-2">
              {alert.message}
            </p>

            {alert.recommendations && alert.recommendations.length > 0 && (
              <div className="pt-2 border-t border-white/5 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                  Recommandations du préparateur :
                </span>
                <ul className="list-none p-0 m-0 space-y-1">
                  {alert.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-center gap-1.5 text-xs text-slate-300">
                      <ArrowRight size={12} className="text-blue-400 shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
