import { useState, Fragment } from 'react';
import { 
  LineChart, Line, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { computeCellState, getActiveBlockForDate } from '../utils/physiology';
import QualitySparkline from './QualitySparkline';
import { ChevronDown, ChevronUp, BarChart2, ArrowUp, ArrowDown } from 'lucide-react';

export default function Grid({ 
  timeline, 
  events, 
  qualities, 
  dailyMetrics, 
  qualitiesEMA, 
  trainingBlocks = [],
  moveQuality,
  onCellClick, 
  onMetricClick, 
  onQualityClick 
}) {
  const [expandedQualityId, setExpandedQualityId] = useState(null);

  const todayStr = timeline.find(d => d.offset === 0)?.dateStr;
  const activeBlockToday = getActiveBlockForDate(todayStr, trainingBlocks);

  const toggleExpand = (qId, e) => {
    e.stopPropagation();
    setExpandedQualityId(prev => prev === qId ? null : qId);
  };

  const CustomInlineTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      return (
        <div className="bg-slate-950/95 backdrop-blur-md p-3 border border-white/15 rounded-xl shadow-2xl text-xs min-w-[170px]">
          <p className="m-0 mb-1.5 font-bold text-white uppercase text-[10px] tracking-wider border-b border-white/10 pb-1 flex items-center justify-between">
            <span>{dataPoint?.dateStr}</span>
            <span className="text-slate-400 font-mono">Jour {label}</span>
          </p>
          {payload.map((p, i) => (
            <div key={i} className="flex justify-between items-center gap-3 py-0.5 text-[11px] font-medium">
              <span className="flex items-center gap-1.5" style={{ color: p.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </span>
              <span className="font-bold font-mono text-white">{p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full min-w-[1100px]">
      <table className="w-full text-left border-collapse table-fixed">
        <thead>
          <tr className="bg-[#161619] text-[10px] uppercase text-slate-400 border-b border-white/10">
            {/* Colonne 1 : Qualité */}
            <th className="p-3 w-48 sticky left-0 bg-[#161619] z-20 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-bold tracking-wider">Qualité Physique</span>
                {activeBlockToday && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                    {activeBlockToday.name}
                  </span>
                )}
              </div>
            </th>

            {/* Colonne 2 : Courbes EMA 3/7/21j */}
            <th className="p-2 w-64 border-l border-white/5 bg-[#161619] z-10 text-center">
              <div className="flex flex-col items-center justify-center">
                <span className="text-slate-200 font-bold tracking-wider">Courbes EMA (3j / 7j / 21j)</span>
                <div className="flex items-center gap-2 mt-0.5 text-[9px] font-semibold">
                  <span className="text-sky-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span> 3j Court
                  </span>
                  <span className="text-blue-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 7j Récent
                  </span>
                  <span className="text-indigo-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> 21j Fond
                  </span>
                </div>
              </div>
            </th>

            {/* Colonnes Timeline J-2 à J+10 */}
            {timeline.map((day) => {
              const dayBlock = getActiveBlockForDate(day.dateStr, trainingBlocks);
              const isToday = day.offset === 0;
              return (
                <th 
                  key={day.dateStr} 
                  className={`py-1.5 px-1 w-[60px] text-center border-l border-white/5 relative transition-colors ${
                    isToday 
                      ? 'bg-blue-600/15 text-blue-200 border-x border-x-blue-500/30' 
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  {dayBlock && (
                    <span 
                      className="block text-[7.5px] font-bold text-amber-300 truncate tracking-tight mb-0.5"
                      title={`Bloc actif : ${dayBlock.name}`}
                    >
                      ⚡ {dayBlock.name.substring(0, 6)}
                    </span>
                  )}
                  <div className="flex flex-col items-center justify-center leading-none">
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>
                      {isToday ? 'Auj.' : day.display.prefix}
                    </span>
                    <span className={`text-[11px] font-mono mt-0.5 ${isToday ? 'text-white font-extrabold' : 'text-slate-300 font-medium'}`}>
                      {day.display.date}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="text-xs">
          {/* LIGNE SPECIALE : READINESS */}
          <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
            <td className="p-3 font-bold bg-[#161619] sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.2)] text-blue-400">
              Readiness (1-10)
            </td>
            <td className="p-2 border-l border-white/5 text-center text-slate-400 text-[11px] font-medium">
              Modulateur de récupération
            </td>
            {timeline.map((day) => {
              const score = dailyMetrics[day.dateStr]?.readiness || '-';
              
              const badgeClass = score === '-' ? 'text-slate-500 font-normal'
                               : score >= 8 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                               : score >= 5 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                               : 'bg-rose-500/20 text-rose-300 border border-rose-500/30';

              return (
                <td 
                  key={`ready-${day.dateStr}`} 
                  className={`p-1 text-center cursor-pointer hover:bg-white/5 transition-colors border-l border-white/5 ${day.offset === 0 ? 'bg-blue-500/5 border-x border-x-blue-500/20' : ''}`}
                  onClick={() => onMetricClick(day.dateStr, 'readiness', score)}
                >
                  <div className="flex justify-center items-center h-8">
                     <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${badgeClass}`}>
                        {score !== '-' ? `${score}/10` : '—'}
                     </span>
                  </div>
                </td>
              );
            })}
          </tr>

          {/* LIGNE SPECIALE : VFC */}
          <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
            <td className="p-3 font-bold bg-[#161619] sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.2)] text-emerald-400">
              VFC Matinale (ms)
            </td>
            <td className="p-2 border-l border-white/5 text-center text-slate-400 text-[11px] font-medium">
              Indicateur parasympathique
            </td>
            {timeline.map((day) => {
                const vfc = dailyMetrics[day.dateStr]?.vfc || '-';
                return (
                <td 
                    key={`vfc-${day.dateStr}`} 
                    className={`p-1 text-center cursor-pointer hover:bg-white/5 transition-colors border-l border-white/5 ${day.offset === 0 ? 'bg-blue-500/5 border-x border-x-blue-500/20' : ''}`}
                    onClick={() => onMetricClick(day.dateStr, 'vfc', vfc)}
                >
                    <div className={`flex justify-center items-center h-8 font-bold font-mono text-[11px] ${vfc !== '-' ? 'text-emerald-300' : 'text-slate-500 font-normal'}`}>
                        {vfc !== '-' ? vfc : '—'}
                    </div>
                </td>
                );
            })}
          </tr>

          {/* LIGNES DES QUALITÉS */}
          {qualities.map((q, index) => {
            const emaInfo = qualitiesEMA?.[q.id];
            const isExpanded = expandedQualityId === q.id;
            const current = emaInfo?.current || { ema3: 0, ema7: 0, ema21: 0, acwr: 1 };

            const acwrBadge = current.acwr > 1.5 
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : current.acwr > 1.3
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : current.acwr >= 0.8
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-blue-500/20 text-blue-400 border-blue-500/30';

            const isFocusInActiveBlock = activeBlockToday?.focusQualities?.includes(q.id);

            return (
              <Fragment key={q.id}>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  {/* Colonne Nom de la Qualité */}
                  <td 
                    className="p-2.5 font-semibold bg-[#161619] sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.2)] text-slate-200 cursor-pointer hover:text-blue-400 transition-colors group"
                    onClick={() => onQualityClick(q)}
                    title={`Cliquer pour analyser ${q.name} en détail (Priorité #${index + 1})`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Boutons monter / descendre et rang */}
                        <div className="flex flex-col items-center justify-center shrink-0 -my-1 text-slate-500">
                          <button
                            onClick={(e) => { e.stopPropagation(); moveQuality?.(q.id, 'up'); }}
                            disabled={index === 0}
                            className="p-0.5 rounded hover:text-white hover:bg-white/10 disabled:opacity-15 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            title="Monter cette qualité (priorité plus haute)"
                          >
                            <ArrowUp size={10} />
                          </button>
                          <span className="text-[9px] font-mono font-bold text-slate-400 leading-none">
                            #{index + 1}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveQuality?.(q.id, 'down'); }}
                            disabled={index === qualities.length - 1}
                            className="p-0.5 rounded hover:text-white hover:bg-white/10 disabled:opacity-15 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            title="Descendre cette qualité (priorité plus basse)"
                          >
                            <ArrowDown size={10} />
                          </button>
                        </div>

                        <span className="truncate">{q.name}</span>
                        {activeBlockToday && (
                          <span 
                            className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                              isFocusInActiveBlock
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            }`}
                            title={isFocusInActiveBlock ? "Qualité ciblée : répétée plus souvent (-25% délai)" : "Maintien : délai prolongé (+35% délai)"}
                          >
                            {isFocusInActiveBlock ? '⚡ Répéter +' : '🛡️ Maintien'}
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={(e) => toggleExpand(q.id, e)}
                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors ml-1 shrink-0"
                        title={isExpanded ? "Masquer la courbe détaillée" : "Déplier la courbe détaillée"}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </td>

                  {/* Colonne Courbes EMA (3j / 7j / 21j) */}
                  <td 
                    className="p-1.5 border-l border-white/5 bg-[#161619]/60 hover:bg-white/[0.04] cursor-pointer transition-colors"
                    onClick={() => onQualityClick(q)}
                    title="Cliquer pour ouvrir l'analyse graphique complète"
                  >
                    <div className="flex items-center justify-between gap-2 px-1">
                      {/* Mini Sparkline des 3 courbes */}
                      <QualitySparkline 
                        data={emaInfo?.sparkline || []} 
                        current={current} 
                        width={95} 
                        height={26} 
                      />

                      {/* Valeurs numériques 3j / 7j / 21j avec indicateurs de tendance */}
                      <div className="flex flex-col text-[10px] leading-tight shrink-0 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sky-300 font-bold inline-flex items-center" title={`EMA 3j (Court terme) : ${current.ema3} (${(current.periodDelta3 ?? 0) > 0 ? '+' : ''}${current.periodDelta3 || 0} vs J-3)`}>
                            {Math.round(current.ema3)}
                            {(current.periodDelta3 ?? 0) > 0.05 && <span className="text-[8px] text-emerald-400 ml-0.5">▲</span>}
                            {(current.periodDelta3 ?? 0) < -0.05 && <span className="text-[8px] text-rose-400 ml-0.5">▼</span>}
                          </span>
                          <span className="text-slate-500">/</span>
                          <span className="text-blue-400 font-bold inline-flex items-center" title={`EMA 7j (Moyen terme / ATL) : ${current.ema7} (${(current.periodDelta7 ?? 0) > 0 ? '+' : ''}${current.periodDelta7 || 0} vs J-7)`}>
                            {Math.round(current.ema7)}
                            {(current.periodDelta7 ?? 0) > 0.05 && <span className="text-[8px] text-emerald-400 ml-0.5">▲</span>}
                            {(current.periodDelta7 ?? 0) < -0.05 && <span className="text-[8px] text-rose-400 ml-0.5">▼</span>}
                          </span>
                          <span className="text-slate-500">/</span>
                          <span className="text-indigo-300 font-bold inline-flex items-center" title={`EMA 21j (Fond / CTL) : ${current.ema21} (${(current.periodDelta21 ?? 0) > 0 ? '+' : ''}${current.periodDelta21 || 0} vs J-21)`}>
                            {Math.round(current.ema21)}
                            {(current.periodDelta21 ?? 0) > 0.05 && <span className="text-[8px] text-emerald-400 ml-0.5">▲</span>}
                            {(current.periodDelta21 ?? 0) < -0.05 && <span className="text-[8px] text-rose-400 ml-0.5">▼</span>}
                          </span>
                        </div>
                        <div className="mt-0.5">
                          <span className={`px-1 py-0.2 rounded text-[9px] font-bold border ${acwrBadge}`}>
                            ACWR {current.acwr}
                          </span>
                        </div>
                      </div>

                      {/* Bouton loupe / modal */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onQualityClick(q); }}
                        className="text-slate-500 hover:text-blue-400 p-1 rounded hover:bg-white/10 transition-colors"
                        title="Ouvrir le graphique modal"
                      >
                        <BarChart2 size={13} />
                      </button>
                    </div>
                  </td>

                  {/* Colonnes de timeline (J-2 à J+10) */}
                  {timeline.map((day) => {
                    const readiness = dailyMetrics[day.dateStr]?.readiness || 7;
                    const cellState = computeCellState(q, day.dateStr, events[q.id], readiness, trainingBlocks);
                    const sessionData = events[q.id]?.[day.dateStr];
                    
                    // Logique Heatmap Athlétique : fonds neutres calmes par défaut, saturation réservée aux données
                    let cellHeatmapStyle = 'bg-slate-900/30 border-white/[0.03] text-slate-600 hover:bg-white/[0.04] hover:border-white/10';
                    
                    if (sessionData) {
                      const loadVal = Number(sessionData.load) || 5;
                      if (sessionData.isSimulated) {
                        cellHeatmapStyle = 'bg-purple-600/75 border-purple-400 text-purple-100 shadow-[0_0_8px_rgba(168,85,247,0.35)] font-bold';
                      } else if (loadVal >= 8) {
                        cellHeatmapStyle = 'bg-blue-600 border-blue-300 text-white font-black shadow-md shadow-blue-600/30';
                      } else if (loadVal >= 5) {
                        cellHeatmapStyle = 'bg-blue-600/60 border-blue-400/60 text-white font-bold';
                      } else {
                        cellHeatmapStyle = 'bg-sky-600/35 border-sky-400/40 text-sky-100 font-semibold';
                      }
                    } else if (cellState.status === 'green') {
                      cellHeatmapStyle = 'bg-emerald-500/12 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20';
                    } else if (cellState.status === 'orange') {
                      cellHeatmapStyle = 'bg-amber-500/12 border-amber-500/25 text-amber-300 hover:bg-amber-500/20';
                    }

                    return (
                      <td 
                        key={day.dateStr} 
                        title={cellState.tooltip}
                        className={`p-1 text-center border-l border-white/5 ${
                          day.offset === 0 ? 'bg-blue-600/5 border-x border-x-blue-500/20' : ''
                        }`}
                      >
                         <div 
                            className={`relative flex items-center justify-center w-full h-8 rounded border transition-all cursor-pointer cell-interactive ${cellHeatmapStyle} ${cellState.isBurnout ? 'burnout' : ''}`}
                            onClick={() => onCellClick(q, day.dateStr, sessionData)}
                         >
                           {cellState.isBurnout && (
                             <span className="absolute top-0 right-0 -mt-1 -mr-1 text-[10px] z-20">🔥</span>
                           )}
                           {sessionData ? (
                             <span className="font-mono text-xs font-bold leading-none tracking-tight flex items-center justify-center">
                               {sessionData.load}
                               {sessionData.isSecondary && <span className="text-[8px] ml-0.5 opacity-70">s</span>}
                               {sessionData.isSimulated && <span className="text-[8px] ml-0.5 opacity-90">🔮</span>}
                             </span>
                           ) : cellState.status === 'green' ? (
                             <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60"></span>
                           ) : cellState.status === 'orange' ? (
                             <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60"></span>
                           ) : null}
                         </div>
                      </td>
                    );
                  })}
                </tr>

                {/* SOUS-LIGNE DÉPLIABLE : COURBE DÉTAILLÉE EMA 3/7/21 POUR CETTE LIGNE DE QUALITÉ */}
                {isExpanded && (
                  <tr className="bg-white/[0.02] border-b border-white/10">
                    <td colSpan={2 + timeline.length} className="p-3">
                      <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                        <div className="flex flex-wrap items-center justify-between mb-2 px-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-200">
                              Courbes EMA (3j, 7j, 21j) & Charges Quotidiennes : {q.name}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${acwrBadge}`}>
                              Ratio Aiguë:Chronique (ACWR) : {current.acwr}
                            </span>
                          </div>
                          <button
                            onClick={() => onQualityClick(q)}
                            className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer bg-transparent border-none"
                          >
                            Vue plein écran / Zoom →
                          </button>
                        </div>

                        <div className="h-[180px] w-full min-h-[160px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart 
                              data={emaInfo?.series || []} 
                              margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                              <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                              <YAxis stroke="#64748b" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                              <Tooltip content={<CustomInlineTooltip />} />
                              <Legend verticalAlign="top" height={26} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                              
                              <Bar dataKey="load" name="Charge Quotidienne" fill="rgba(255,255,255,0.15)" radius={[2, 2, 0, 0]} maxBarSize={14} />
                              <Line type="monotone" dataKey="ema3" name="EMA 3j (Aiguë)" stroke="#ef4444" strokeWidth={2} dot={false} />
                              <Line type="monotone" dataKey="ema7" name="EMA 7j (Récente)" stroke="#f59e0b" strokeWidth={1.8} dot={false} />
                              <Line type="monotone" dataKey="ema21" name="EMA 21j (Chronique)" stroke="#38bdf8" strokeWidth={1.8} strokeDasharray="3 3" dot={false} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
