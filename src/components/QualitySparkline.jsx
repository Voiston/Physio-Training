import { useState, useRef } from 'react';

export default function QualitySparkline({ data, current, width = 115, height = 30 }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const containerRef = useRef(null);

  if (!data || data.length < 2) {
    return (
      <div className="text-[10px] text-slate-500 italic">Pas de données</div>
    );
  }

  // Find max across all 3 EMAs and loads to scale correctly
  let maxVal = 10;
  data.forEach(d => {
    maxVal = Math.max(maxVal, d.ema3 || 0, d.ema7 || 0, d.ema21 || 0, d.load || 0);
  });

  const padding = 4;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const getX = (index) => padding + (index / (data.length - 1)) * usableWidth;
  const getY = (val) => height - padding - ((val || 0) / maxVal) * usableHeight;

  const createPath = (key) => {
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d[key]).toFixed(1)}`)
      .join(' ');
  };

  const pathEma21 = createPath('ema21');
  const pathEma7 = createPath('ema7');
  const pathEma3 = createPath('ema3');

  const lastIndex = data.length - 1;
  const lastX = getX(lastIndex);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Clamp inside usable boundaries
    const clampedX = Math.max(padding, Math.min(width - padding, mouseX));
    const ratio = (clampedX - padding) / usableWidth;
    const closestIdx = Math.round(ratio * (data.length - 1));
    const safeIdx = Math.max(0, Math.min(data.length - 1, closestIdx));
    
    setHoverIndex(safeIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activePoint = hoverIndex !== null ? data[hoverIndex] : null;
  const activeX = hoverIndex !== null ? getX(hoverIndex) : lastX;

  return (
    <div 
      ref={containerRef}
      className="relative flex items-center group/sparkline cursor-crosshair select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg width={width} height={height} className="overflow-visible shrink-0">
        {/* Baseline */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />

        {/* EMA 21 (Chronique / Fond) */}
        <path
          d={pathEma21}
          fill="none"
          stroke="#818cf8"
          strokeWidth="1.5"
          strokeDasharray="3 2"
          opacity="0.85"
        />

        {/* EMA 7 (Moyen terme / ATL) */}
        <path
          d={pathEma7}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
          opacity="0.9"
        />

        {/* EMA 3 (Court terme) */}
        <path
          d={pathEma3}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
        />

        {/* Ligne verticale au survol (Crosshair) */}
        {hoverIndex !== null && (
          <line
            x1={activeX}
            y1={1}
            x2={activeX}
            y2={height - 1}
            stroke="#ffffff"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.8"
          />
        )}

        {/* Cercles sur le point sélectionné ou sur Aujourd'hui */}
        {activePoint ? (
          <>
            <circle cx={activeX} cy={getY(activePoint.ema21)} r="3" fill="#818cf8" stroke="#1e1b4b" strokeWidth="1" />
            <circle cx={activeX} cy={getY(activePoint.ema7)} r="3" fill="#3b82f6" stroke="#172554" strokeWidth="1" />
            <circle cx={activeX} cy={getY(activePoint.ema3)} r="3.5" fill="#38bdf8" stroke="#082f49" strokeWidth="1" className="animate-pulse" />
          </>
        ) : (
          <>
            <circle cx={lastX} cy={getY(data[lastIndex]?.ema21)} r="2" fill="#818cf8" />
            <circle cx={lastX} cy={getY(data[lastIndex]?.ema7)} r="2" fill="#3b82f6" />
            <circle cx={lastX} cy={getY(data[lastIndex]?.ema3)} r="2.5" fill="#38bdf8" />
          </>
        )}
      </svg>

      {/* Tooltip interactif flottant au survol */}
      {activePoint && (
        <div 
          className="absolute z-50 pointer-events-none -top-14 bg-slate-950/95 border border-white/20 rounded-xl px-2.5 py-1.5 shadow-2xl backdrop-blur-md text-[10px] font-mono text-white whitespace-nowrap transition-all duration-75"
          style={{
            left: `${Math.min(Math.max(activeX - 45, -20), width - 70)}px`
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-0.5 mb-1 text-[9px]">
            <span className="font-bold text-slate-300">{activePoint.dateStr || `J-${data.length - 1 - hoverIndex}`}</span>
            {activePoint.load > 0 && (
              <span className="text-amber-300 font-bold bg-amber-500/20 px-1 rounded">
                ⚡ {activePoint.load} pts
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-sky-300 font-bold">3j: {Math.round(activePoint.ema3 || 0)}</span>
            <span className="text-blue-400 font-bold">7j: {Math.round(activePoint.ema7 || 0)}</span>
            <span className="text-indigo-300 font-bold">21j: {Math.round(activePoint.ema21 || 0)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
