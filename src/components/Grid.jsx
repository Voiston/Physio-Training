import { useState, useRef, useEffect, Fragment } from 'react';
import { 
  LineChart, Line, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { computeCellState, getActiveBlockForDate } from '../utils/physiology';
import QualitySparkline from './QualitySparkline';
import { 
  ChevronDown, ChevronUp, BarChart2, GripVertical, 
  ChevronLeft, ChevronRight, Calendar, Compass, ArrowLeftRight 
} from 'lucide-react';

export default function Grid({ 
  timeline, 
  events, 
  qualities, 
  dailyMetrics, 
  qualitiesEMA, 
  trainingBlocks = [],
  moveQuality,
  reorderQualities,
  onCellClick, 
  onMetricClick, 
  onQualityClick 
}) {
  const [expandedQualityId, setExpandedQualityId] = useState(null);
  const [draggedQualityId, setDraggedQualityId] = useState(null);
  const [dragOverQualityId, setDragOverQualityId] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // 'before' | 'after'

  // Ref pour le conteneur de défilement horizontal
  const scrollContainerRef = useRef(null);

  // État pour le glisser-déposer horizontal à la souris (Mouse Pan)
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panScrollLeft, setPanScrollLeft] = useState(0);

  const handleDragStart = (e, qId, index) => {
    setDraggedQualityId(qId);
    e.dataTransfer.setData('text/plain', qId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetQId) => {
    if (!draggedQualityId || draggedQualityId === targetQId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const position = relY < rect.height / 2 ? 'before' : 'after';

    if (dragOverQualityId !== targetQId || dropPosition !== position) {
      setDragOverQualityId(targetQId);
      setDropPosition(position);
    }
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverQualityId(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e, targetQId) => {
    e.preventDefault();
    if (draggedQualityId && targetQId && draggedQualityId !== targetQId) {
      if (reorderQualities) {
        reorderQualities(draggedQualityId, targetQId, dropPosition || 'before');
      } else if (moveQuality) {
        const sourceIdx = qualities.findIndex(q => q.id === draggedQualityId);
        const targetIdx = qualities.findIndex(q => q.id === targetQId);
        if (sourceIdx !== -1 && targetIdx !== -1) {
          moveQuality(draggedQualityId, sourceIdx < targetIdx ? 'down' : 'up');
        }
      }
    }
    setDraggedQualityId(null);
    setDragOverQualityId(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedQualityId(null);
    setDragOverQualityId(null);
    setDropPosition(null);
  };

  const todayStr = timeline.find(d => d.offset === 0)?.dateStr;
  const activeBlockToday = getActiveBlockForDate(todayStr, trainingBlocks);

  // Défilement automatique initial vers "Aujourd'hui"
  const scrollToToday = () => {
    if (scrollContainerRef.current) {
      const todayEl = scrollContainerRef.current.querySelector('[data-today="true"]');
      if (todayEl) {
        const container = scrollContainerRef.current;
        const offset = todayEl.offsetLeft - (container.clientWidth / 2) + (todayEl.clientWidth / 2);
        container.scrollTo({ left: Math.max(0, offset - 150), behavior: 'smooth' });
      }
    }
  };

  useEffect(() => {
    // Petit timeout pour laisser le rendu DOM s'effectuer
    const timer = setTimeout(() => {
      scrollToToday();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Déplacement horizontal par boutons
  const scrollHorizontally = (amount) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // Gestion du glisser horizontal fluide à la souris (Mouse Drag-to-Scroll)
  const handleMouseDown = (e) => {
    // Ne pas déclencher si on clique sur un élément interactif ou une poignée de drag
    if (e.target.closest('button') || e.target.closest('[draggable="true"]') || e.target.closest('.cell-interactive') || e.target.closest('input')) {
      return;
    }
    if (e.button !== 0) return; // Uniquement clic gauche
    setIsPanning(true);
    setPanStartX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setPanScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };

  const handleMouseMove = (e) => {
    if (!isPanning || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - (scrollContainerRef.current.offsetLeft || 0);
    const walk = (x - panStartX) * 1.4; // Vitesse de défilement
    scrollContainerRef.current.scrollLeft = panScrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
  };

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

  const firstDay = timeline[0];
  const lastDay = timeline[timeline.length - 1];

  return (
    <div className="w-full flex flex-col">
      {/* BARRE DE CONTRÔLE DE NAVIGATION HORIZONTALE DE LA TIMELINE */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#161619] border-b border-white/10 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
            <ArrowLeftRight size={14} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-200 block">
              Navigation Temporelle de la Grille
            </span>
            <span className="text-[10px] font-mono text-slate-400 block">
              Plage affichée : {firstDay?.display.date} ({firstDay?.display.prefix}) → {lastDay?.display.date} ({lastDay?.display.prefix})
            </span>
          </div>
        </div>

        {/* Boutons de navigation rapide Passé / Aujourd'hui / Futur */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollHorizontally(-400)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer shadow-sm"
            title="Glisser vers le passé (-7 jours)"
          >
            <ChevronLeft size={14} className="text-sky-400" />
            <span>Passé (-7j)</span>
          </button>

          <button
            type="button"
            onClick={scrollToToday}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer border border-blue-400/40"
            title="Recentrer immédiatement la vue sur le jour d'aujourd'hui"
          >
            <Calendar size={13} />
            <span>Aujourd'hui (J+0)</span>
          </button>

          <button
            type="button"
            onClick={() => scrollHorizontally(400)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer shadow-sm"
            title="Glisser vers le futur (+7 jours)"
          >
            <span>Futur (+7j)</span>
            <ChevronRight size={14} className="text-sky-400" />
          </button>
        </div>
      </div>

      {/* CONTENEUR SCROLLABLE & DRAGGABLE HORIZONTALEMENT */}
      <div 
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className={`w-full overflow-x-auto custom-scrollbar select-none transition-colors ${
          isPanning ? 'cursor-grabbing' : 'cursor-default'
        }`}
        style={{ scrollBehavior: 'smooth' }}
      >
        <table className="w-full text-left border-collapse table-fixed min-w-[1300px]">
          <thead>
            <tr className="bg-[#161619] text-[10px] uppercase text-slate-400 border-b border-white/10">
              {/* Colonne 1 : Qualité Physique (Largeur augmentée à w-72 min-w-[280px] pour éviter toute troncature) */}
              <th className="p-3 w-72 min-w-[280px] sticky left-0 bg-[#161619] z-20 shadow-[3px_0_10px_rgba(0,0,0,0.5)] border-r border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-slate-200 font-bold tracking-wider flex items-center gap-1.5 text-xs" title="Glisser-déposer les qualités pour réorganiser l'ordre de priorité">
                    <GripVertical size={13} className="text-slate-400" />
                    <span>Qualités Physiques</span>
                  </span>
                  {activeBlockToday && (
                    <span className="text-[9px] px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                      {activeBlockToday.name}
                    </span>
                  )}
                </div>
              </th>

              {/* Colonne 2 : Courbes EMA 3/7/21j */}
              <th className="p-2 w-64 min-w-[250px] border-r border-white/10 bg-[#161619] z-10 text-center shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                <div className="flex flex-col items-center justify-center">
                  <span className="text-slate-200 font-bold tracking-wider text-[10px]">Courbes EMA (3j / 7j / 21j)</span>
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

              {/* Colonnes Timeline J-X à J+Y */}
              {timeline.map((day) => {
                const dayBlock = getActiveBlockForDate(day.dateStr, trainingBlocks);
                const isToday = day.offset === 0;
                return (
                  <th 
                    key={day.dateStr} 
                    data-today={isToday ? "true" : undefined}
                    className={`py-2 px-1 w-[64px] min-w-[64px] text-center border-r border-white/5 relative transition-colors ${
                      isToday 
                        ? 'bg-blue-600/25 text-blue-200 border-x-2 border-x-blue-500/50 shadow-inner' 
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
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${isToday ? 'text-blue-300 font-black' : 'text-slate-400'}`}>
                        {isToday ? 'AUJ.' : day.display.prefix}
                      </span>
                      <span className={`text-[11px] font-mono mt-0.5 ${isToday ? 'text-white font-extrabold underline decoration-blue-400 decoration-2' : 'text-slate-300 font-medium'}`}>
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
              <td className="p-3 font-bold bg-[#161619] sticky left-0 z-10 shadow-[3px_0_10px_rgba(0,0,0,0.5)] border-r border-white/10 text-blue-400">
                <div className="flex items-center justify-between">
                  <span>Readiness (1-10)</span>
                  <span className="text-[10px] text-slate-500 font-normal">Auto-évaluation</span>
                </div>
              </td>
              <td className="p-2 border-r border-white/10 text-center text-slate-400 text-[11px] font-medium bg-[#161619]/60">
                Modulateur de récupération
              </td>
              {timeline.map((day) => {
                const score = dailyMetrics[day.dateStr]?.readiness || '-';
                
                const badgeClass = score === '-' ? 'text-slate-500 font-normal'
                                 : score >= 8 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                                 : score >= 5 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                                 : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold';

                return (
                  <td 
                    key={`ready-${day.dateStr}`} 
                    className={`p-1 text-center cursor-pointer hover:bg-white/5 transition-colors border-r border-white/5 ${day.offset === 0 ? 'bg-blue-500/10 border-x-2 border-x-blue-500/30' : ''}`}
                    onClick={() => onMetricClick(day.dateStr, 'readiness', score)}
                  >
                    <div className="flex justify-center items-center h-8">
                       <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] ${badgeClass}`}>
                          {score !== '-' ? `${score}/10` : '—'}
                       </span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* LIGNE SPECIALE : VFC */}
            <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
              <td className="p-3 font-bold bg-[#161619] sticky left-0 z-10 shadow-[3px_0_10px_rgba(0,0,0,0.5)] border-r border-white/10 text-emerald-400">
                <div className="flex items-center justify-between">
                  <span>VFC Matinale (ms)</span>
                  <span className="text-[10px] text-slate-500 font-normal">RMSSD</span>
                </div>
              </td>
              <td className="p-2 border-r border-white/10 text-center text-slate-400 text-[11px] font-medium bg-[#161619]/60">
                Indicateur parasympathique
              </td>
              {timeline.map((day) => {
                  const vfc = dailyMetrics[day.dateStr]?.vfc || '-';
                  return (
                  <td 
                      key={`vfc-${day.dateStr}`} 
                      className={`p-1 text-center cursor-pointer hover:bg-white/5 transition-colors border-r border-white/5 ${day.offset === 0 ? 'bg-blue-500/10 border-x-2 border-x-blue-500/30' : ''}`}
                      onClick={() => onMetricClick(day.dateStr, 'vfc', vfc)}
                  >
                      <div className={`flex justify-center items-center h-8 font-bold font-mono text-[11px] ${vfc !== '-' ? 'text-emerald-300' : 'text-slate-500 font-normal'}`}>
                          {vfc !== '-' ? `${vfc} ms` : '—'}
                      </div>
                  </td>
                  );
              })}
            </tr>

            {/* LIGNE SPECIALE : FC DE REPOS (BPM) */}
            <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
              <td className="p-3 font-bold bg-[#161619] sticky left-0 z-10 shadow-[3px_0_10px_rgba(0,0,0,0.5)] border-r border-white/10 text-rose-400">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>FC de Repos (bpm)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">Basal / Réveil</span>
                </div>
              </td>
              <td className="p-2 border-r border-white/10 text-center text-slate-400 text-[11px] font-medium bg-[#161619]/60">
                Tonus cardiaque au réveil
              </td>
              {timeline.map((day) => {
                const hrRest = dailyMetrics[day.dateStr]?.hrRest ?? dailyMetrics[day.dateStr]?.rhr ?? '-';
                
                let badgeClass = 'text-slate-500 font-normal';
                if (hrRest !== '-') {
                  const numHr = Number(hrRest);
                  if (numHr <= 52) {
                    badgeClass = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold';
                  } else if (numHr <= 58) {
                    badgeClass = 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold';
                  } else if (numHr <= 65) {
                    badgeClass = 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold';
                  } else {
                    badgeClass = 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold';
                  }
                }

                return (
                  <td 
                    key={`hrRest-${day.dateStr}`} 
                    className={`p-1 text-center cursor-pointer hover:bg-white/5 transition-colors border-r border-white/5 ${day.offset === 0 ? 'bg-blue-500/10 border-x-2 border-x-blue-500/30' : ''}`}
                    onClick={() => onMetricClick(day.dateStr, 'hrRest', hrRest)}
                  >
                    <div className="flex justify-center items-center h-8">
                       <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] ${badgeClass}`}>
                          {hrRest !== '-' ? `${hrRest} bpm` : '—'}
                       </span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* LIGNES DES QUALITÉS PHYSIQUES */}
            {qualities.map((q, index) => {
              const emaInfo = qualitiesEMA?.[q.id];
              const isExpanded = expandedQualityId === q.id;
              const current = emaInfo?.current || { ema3: 0, ema7: 0, ema21: 0, acwr: 1 };
              const isDragging = draggedQualityId === q.id;
              const isOver = dragOverQualityId === q.id;

              const acwrBadge = current.acwr > 1.5 
                ? 'bg-red-500/20 text-red-400 border-red-500/30 font-bold'
                : current.acwr > 1.3
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 font-semibold'
                : current.acwr >= 0.8
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-semibold'
                : 'bg-blue-500/20 text-blue-400 border-blue-500/30 font-semibold';

              const isFocusInActiveBlock = activeBlockToday?.focusQualities?.includes(q.id);

              return (
                <Fragment key={q.id}>
                  <tr 
                    onDragOver={(e) => handleDragOver(e, q.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, q.id)}
                    className={`border-b transition-colors ${
                      isDragging
                        ? 'opacity-35 bg-blue-950/30'
                        : isOver && dropPosition === 'before'
                        ? 'shadow-[inset_0_2px_0_0_#3b82f6] bg-blue-500/10'
                        : isOver && dropPosition === 'after'
                        ? 'shadow-[inset_0_-2px_0_0_#3b82f6] bg-blue-500/10'
                        : 'border-white/5 hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Colonne Nom de la Qualité (Non tronqué avec largeur confortable w-72) */}
                    <td 
                      className="p-2.5 font-semibold bg-[#161619] sticky left-0 z-10 shadow-[3px_0_10px_rgba(0,0,0,0.5)] border-r border-white/10 text-slate-200 cursor-pointer hover:text-blue-400 transition-colors group"
                      onClick={() => onQualityClick(q)}
                      title={`Cliquer pour analyser ${q.name} en détail (Priorité #${index + 1})`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* Poignée de Glisser-Déposer */}
                          <div
                            draggable={true}
                            onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, q.id, index); }}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => e.stopPropagation()}
                            tabIndex={0}
                            role="button"
                            aria-label={`Glisser pour réorganiser la qualité ${q.name}, priorité #${index + 1}`}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                e.stopPropagation();
                                moveQuality?.(q.id, 'up');
                              } else if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                e.stopPropagation();
                                moveQuality?.(q.id, 'down');
                              }
                            }}
                            className="flex items-center gap-1 px-1.5 py-1 -my-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 active:bg-blue-600/30 active:text-blue-200 cursor-grab active:cursor-grabbing border border-transparent hover:border-white/10 transition-all shrink-0 select-none group/grip"
                            title={`Glisser-déposer pour changer la priorité de ${q.name} (Rang #${index + 1})`}
                          >
                            <GripVertical size={13} className="text-slate-500 group-hover/grip:text-blue-400 transition-colors" />
                            <span className="text-[10px] font-mono font-bold text-slate-400 group-hover/grip:text-blue-300">
                              #{index + 1}
                            </span>
                          </div>

                          {/* Nom complet de la qualité physique (jamais tronqué) */}
                          <span className="font-bold text-xs sm:text-sm text-slate-100 whitespace-normal leading-tight group-hover:text-blue-300 transition-colors break-words">
                            {q.name}
                          </span>

                          {activeBlockToday && (
                            <span 
                              className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
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
                          className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors shrink-0"
                          title={isExpanded ? "Masquer la courbe détaillée" : "Déplier la courbe détaillée"}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </td>

                    {/* Colonne Courbes EMA (3j / 7j / 21j) */}
                    <td 
                      className="p-1.5 border-r border-white/10 bg-[#161619]/70 hover:bg-white/[0.04] cursor-pointer transition-colors shadow-[2px_0_5px_rgba(0,0,0,0.2)]"
                      onClick={() => onQualityClick(q)}
                      title="Cliquer pour ouvrir l'analyse graphique complète"
                    >
                      <div className="flex items-center justify-between gap-2 px-1">
                        {/* Mini Sparkline interactive avec survol et crosshair */}
                        <QualitySparkline 
                          data={emaInfo?.sparkline || []} 
                          current={current} 
                          width={100} 
                          height={28} 
                        />

                        {/* Valeurs numériques 3j / 7j / 21j avec indicateurs de tendance */}
                        <div className="flex flex-col text-[10px] leading-tight shrink-0 font-mono">
                          <div className="flex items-center gap-1">
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

                    {/* Colonnes de timeline (J-X à J+Y) */}
                    {timeline.map((day) => {
                      const readiness = dailyMetrics[day.dateStr]?.readiness || 7;
                      const cellState = computeCellState(q, day.dateStr, events[q.id], readiness, trainingBlocks);
                      const sessionData = events[q.id]?.[day.dateStr];
                      
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
                          className={`p-1 text-center border-r border-white/5 ${
                            day.offset === 0 ? 'bg-blue-600/10 border-x-2 border-x-blue-500/30' : ''
                          }`}
                        >
                           <div 
                              className={`relative flex items-center justify-center w-full h-8 rounded-lg border transition-all cursor-pointer cell-interactive ${cellHeatmapStyle} ${cellState.isBurnout ? 'burnout' : ''}`}
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

                            <div className="flex items-center gap-3 text-[10px] font-mono">
                              <span className="text-sky-300">EMA 3j : {Math.round(current.ema3)}</span>
                              <span className="text-blue-400">EMA 7j : {Math.round(current.ema7)}</span>
                              <span className="text-indigo-300">EMA 21j : {Math.round(current.ema21)}</span>
                            </div>
                          </div>

                          <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart data={emaInfo?.series || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                <XAxis dataKey="day" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip content={<CustomInlineTooltip />} />
                                <Bar dataKey="load" fill="#3b82f6" opacity={0.35} radius={[3, 3, 0, 0]} name="Charge" />
                                <Line type="monotone" dataKey="ema3" stroke="#38bdf8" strokeWidth={2} dot={false} name="EMA 3j" />
                                <Line type="monotone" dataKey="ema7" stroke="#3b82f6" strokeWidth={2} dot={false} name="EMA 7j" />
                                <Line type="monotone" dataKey="ema21" stroke="#818cf8" strokeWidth={2} strokeDasharray="4 4" dot={false} name="EMA 21j" />
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
    </div>
  );
}
