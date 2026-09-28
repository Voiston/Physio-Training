import React from 'react';

export default function QualitySparkline({ data, current, width = 110, height = 30 }) {
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

  const padding = 3;
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

  return (
    <div className="flex items-center gap-2">
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

        {/* EMA 21 (Chronique) */}
        <path
          d={pathEma21}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.5"
          strokeDasharray="3 2"
          opacity="0.8"
        />

        {/* EMA 7 (Récente) */}
        <path
          d={pathEma7}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.5"
          opacity="0.9"
        />

        {/* EMA 3 (Aiguë) */}
        <path
          d={pathEma3}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
        />

        {/* Dots on today */}
        <circle cx={lastX} cy={getY(data[lastIndex]?.ema21)} r="2" fill="#38bdf8" />
        <circle cx={lastX} cy={getY(data[lastIndex]?.ema7)} r="2" fill="#f59e0b" />
        <circle cx={lastX} cy={getY(data[lastIndex]?.ema3)} r="2.5" fill="#ef4444" />
      </svg>
    </div>
  );
}
