import React from 'react';
import { 
  LineChart, Line, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';

function CustomInlineTooltip({ active, payload, label }) {
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
}

export default function GridQualityChart({ series = [] }) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
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
  );
}
