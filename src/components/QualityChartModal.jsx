import { useState, useMemo } from 'react';
import { 
  LineChart, Line, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { computeQualityEMAData } from '../utils/physiology';
import { X, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

export default function QualityChartModal({ quality, events, onClose }) {
  const [timeframe, setTimeframe] = useState(30);

  const emaData = useMemo(() => {
    return computeQualityEMAData(quality.id, events, timeframe, 0);
  }, [quality.id, events, timeframe]);

  const { series, current } = emaData;

  const acwrStatus = useMemo(() => {
    const r = current.acwr;
    if (r === null) {
      return { 
        text: 'Fréquence insuffisante', 
        badge: 'bg-white/5 text-slate-400 border-white/10',
        detail: 'Moins de 4 séances sur 28 jours : ratio non calculable de manière fiable.' 
      };
    }
    if (r > 1.5) {
      return { 
        text: 'Augmentation rapide de charge', 
        badge: 'bg-red-500/20 text-red-400 border-red-500/30',
        detail: 'Charge récente (7j) nettement supérieure à la moyenne (21j).' 
      };
    } else if (r > 1.3) {
      return { 
        text: 'Surcharge stimulante', 
        badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        detail: 'Bonne stimulation si planifiée dans un cycle actif.' 
      };
    } else if (r >= 0.8) {
      return { 
        text: 'Plage Équilibrée', 
        badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        detail: 'Progression continue bien proportionnée.' 
      };
    } else {
      return { 
        text: 'Sous-charge / Affûtage', 
        badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        detail: 'Charge réduite sur cette filière, utile en régénération ou affûtage.' 
      };
    }
  }, [current.acwr]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      return (
        <div className="bg-[#121216]/95 backdrop-blur-md p-3 border border-white/10 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.6)] text-xs">
          <p className="m-0 mb-2 font-bold text-slate-200 uppercase text-[10px] tracking-wider border-b border-white/10 pb-1">
            {dataPoint?.dateStr} (Jour {label})
          </p>
          {payload.map((p, i) => (
            <div key={i} className="flex justify-between items-center gap-4 py-0.5 font-medium">
              <span style={{ color: p.color }}>{p.name}</span>
              <span className="font-bold text-slate-100">{p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-content !w-[860px] !max-w-[95vw] flex flex-col gap-5" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-white/10">
          <div>
            <h3 className="text-xl font-bold text-slate-100 tracking-tight m-0 flex items-center gap-2">
              <span className="text-blue-400">📈</span> Courbes EMA (3j / 7j / 21j) : {quality.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Suivi de la dynamique de charge aiguë vs chronique et des effets résiduels
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white cursor-pointer border-none bg-transparent"
          >
            <X size={20} />
          </button>
        </div>

        {/* KPIs Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">EMA 3j (Aiguë)</span>
              {current.periodDelta3 > 0.05 ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  <TrendingUp size={11} className="stroke-[2.5]" />
                  <span>+{current.periodDelta3}</span>
                  <span className="text-[9px] opacity-75">({current.periodPercent3 > 0 ? `+${current.periodPercent3}%` : `${current.periodPercent3}%`})</span>
                </span>
              ) : current.periodDelta3 < -0.05 ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                  <TrendingDown size={11} className="stroke-[2.5]" />
                  <span>{current.periodDelta3}</span>
                  <span className="text-[9px] opacity-75">({current.periodPercent3}%)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                  <Minus size={9} />
                  <span>0.0</span>
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-extrabold text-red-400">{current.ema3}</span>
              <span className="text-[10px] text-slate-400 font-mono">vs J-3 ({current.prevPeriodEma3 || 0})</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">EMA 7j (Récente)</span>
              {current.periodDelta7 > 0.05 ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  <TrendingUp size={11} className="stroke-[2.5]" />
                  <span>+{current.periodDelta7}</span>
                  <span className="text-[9px] opacity-75">({current.periodPercent7 > 0 ? `+${current.periodPercent7}%` : `${current.periodPercent7}%`})</span>
                </span>
              ) : current.periodDelta7 < -0.05 ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                  <TrendingDown size={11} className="stroke-[2.5]" />
                  <span>{current.periodDelta7}</span>
                  <span className="text-[9px] opacity-75">({current.periodPercent7}%)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                  <Minus size={9} />
                  <span>0.0</span>
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-extrabold text-amber-400">{current.ema7}</span>
              <span className="text-[10px] text-slate-400 font-mono">vs J-7 ({current.prevPeriodEma7 || 0})</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Charge pondérée 21j</span>
              {current.periodDelta21 > 0.05 ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  <TrendingUp size={11} className="stroke-[2.5]" />
                  <span>+{current.periodDelta21}</span>
                  <span className="text-[9px] opacity-75">({current.periodPercent21 > 0 ? `+${current.periodPercent21}%` : `${current.periodPercent21}%`})</span>
                </span>
              ) : current.periodDelta21 < -0.05 ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                  <TrendingDown size={11} className="stroke-[2.5]" />
                  <span>{current.periodDelta21}</span>
                  <span className="text-[9px] opacity-75">({current.periodPercent21}%)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                  <Minus size={9} />
                  <span>0.0</span>
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-extrabold text-sky-400">{current.ema21}</span>
              <span className="text-[10px] text-slate-400 font-mono">vs J-21 ({current.prevPeriodEma21 || 0})</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Ratio ACWR (7/21 · indicatif)</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-extrabold text-white">{current.acwr !== null ? current.acwr : '—'}</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${current.acwr === null ? 'bg-white/5 text-slate-400 border-white/10' : acwrStatus.badge}`}>
                {current.acwr === null ? 'Données insuffisantes' : current.acwr >= 0.8 && current.acwr <= 1.3 ? 'Optimal' : current.acwr > 1.3 ? 'Surcharge' : 'Décharge'}
              </span>
            </div>
          </div>
        </div>

        {/* Timeframe Controls & Legend guide */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Fenêtre d'analyse :</span>
            {[14, 30, 45, 60].map(days => (
              <button
                key={days}
                onClick={() => setTimeframe(days)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
                  timeframe === days 
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm' 
                    : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white'
                }`}
              >
                {days} jours
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-300 font-medium">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span> EMA 3j</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> EMA 7j</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span> EMA 21j</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2 bg-white/25 rounded"></span> Charge brute</span>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[340px] w-full min-h-[300px] min-w-0 bg-slate-950/70 p-3 rounded-2xl border border-white/10 relative shadow-inner">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.2)" vertical={false} />
              <XAxis 
                dataKey="dateStr" 
                tickFormatter={(str) => {
                  if (!str) return '';
                  const parts = str.split('-');
                  return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : str;
                }}
                stroke="#64748b" 
                tick={{ fontSize: 11, fill: '#f1f5f9', fontWeight: 600 }} 
                tickLine={{ stroke: '#64748b', strokeWidth: 1.5 }} 
                axisLine={{ stroke: '#64748b', strokeWidth: 1.5 }}
                minTickGap={28}
                dy={3}
              />
              <YAxis 
                stroke="#64748b" 
                tick={{ fontSize: 10, fill: '#cbd5e1', fontWeight: 500 }} 
                tickLine={{ stroke: '#64748b' }} 
                axisLine={{ stroke: '#64748b', strokeWidth: 1.2 }} 
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
              
              <Bar dataKey="load" name="Charge Quotidienne" fill="rgba(255,255,255,0.25)" radius={[2, 2, 0, 0]} maxBarSize={18} />
              <Line type="monotone" dataKey="ema3" name="EMA 3j (Court terme)" stroke="#38bdf8" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="ema7" name="EMA 7j (Aigu / Fatigue filière)" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="ema21" name="EMA 21j (Fond / Charge chronique filière)" stroke="#818cf8" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Interpretive Banner */}
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
          <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white">Diagnostic Physiologique : </span>
            <span>{acwrStatus.text}. </span>
            <span className="text-slate-400">{acwrStatus.detail}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
