import { useState, useMemo } from 'react';
import { 
  Radar, RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, Tooltip 
} from 'recharts';
import { Table as TableIcon, Eye, Zap } from 'lucide-react';
import { computeCellState } from '../utils/physiology';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';

export default function RadarChart({ qualities, events, dailyMetrics, trainingBlocks = [] }) {
  const [showTableMode, setShowTableMode] = useState(false);
  
  const radarData = useMemo(() => {
    const todayStr = getLocalYYYYMMDD(new Date());
    const readiness = dailyMetrics?.[todayStr]?.readiness || 7;

    return qualities.map((q) => {
      const state = computeCellState(q, todayStr, events[q.id], readiness, trainingBlocks);
      const shortName = q.name.length > 12 ? q.name.substring(0, 11) + '…' : q.name;
      // Le radar reflète la rétention physiologique pure
      const level = state.physio ? state.physio.currentLevel : state.currentLevel;
      const levelNum = Math.max(0, Math.round(level));
      
      let statusLabel = 'Rappel recommandé';
      let statusBadge = 'text-rose-300 bg-rose-500/20 border-rose-500/30';
      if (levelNum >= 75) {
        statusLabel = 'Actif / Consolidé';
        statusBadge = 'text-emerald-300 bg-emerald-500/20 border-emerald-500/30';
      } else if (levelNum >= 55) {
        statusLabel = 'Rappel optimal';
        statusBadge = 'text-amber-300 bg-amber-500/20 border-amber-500/30';
      }

      return {
        id: q.id,
        quality: shortName,
        fullName: q.name,
        niveau: levelNum,
        statusLabel,
        statusBadge,
        fullMark: 100,
      };
    });
  }, [qualities, events, dailyMetrics, trainingBlocks]);

  return (
    <section 
      aria-label="Statut de stimulation et fraîcheur athlétique"
      className="w-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-blue-400" aria-hidden="true" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider m-0">
            Stimulation & Rappels
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-blue-300 font-semibold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
            Fenêtre active
          </span>
          {/* Bascule Vue Graphique Radar vs Vue Tableau Accessible */}
          <button
            type="button"
            aria-pressed={showTableMode}
            aria-label={showTableMode ? "Afficher le graphique radar" : "Afficher le tableau accessible des stimuli"}
            onClick={() => setShowTableMode(prev => !prev)}
            className={`p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg border text-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              showTableMode 
                ? 'bg-blue-600 text-white border-blue-400 shadow-sm' 
                : 'bg-white/5 text-slate-300 hover:text-white border-white/10'
            }`}
            title={showTableMode ? "Afficher le graphique radar" : "Afficher les valeurs en tableau"}
          >
            {showTableMode ? <Eye size={14} aria-hidden="true" /> : <TableIcon size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {showTableMode ? (
        /* Tableau accessible complet des stimuli par qualité */
        <div className="w-full max-h-[250px] overflow-y-auto custom-scrollbar border border-white/10 rounded-xl bg-slate-950/60 p-2">
          <table className="w-full text-left text-xs border-collapse">
            <caption className="sr-only">Niveau de rétention physiologique et statut de rappel pour chaque qualité</caption>
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase font-mono text-slate-300">
                <th scope="col" className="p-2">Qualité</th>
                <th scope="col" className="p-2 text-center">Niveau</th>
                <th scope="col" className="p-2 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {radarData.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-2 font-medium text-slate-100">
                    {item.fullName}
                  </td>
                  <td className="p-2 text-center font-mono font-bold text-sky-300">
                    {item.niveau}%
                  </td>
                  <td className="p-2 text-right">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${item.statusBadge}`}>
                      {item.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Visualisation Graphique Radar Recharts */
        <div className="w-full h-[240px]">
          {/* Table masquée pour les lecteurs d'écran (WCAG 2.2 AA) */}
          <div className="sr-only">
            <table>
              <caption className="sr-only">Rétention physiologique des qualités</caption>
              <thead>
                <tr>
                  <th scope="col">Qualité</th>
                  <th scope="col">Fraîcheur</th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {radarData.map((d) => (
                  <tr key={d.id}>
                    <td>{d.fullName}</td>
                    <td>{d.niveau}%</td>
                    <td>{d.statusLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <RechartsRadar cx="50%" cy="50%" outerRadius="68%" data={radarData}>
              <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
              <PolarAngleAxis 
                dataKey="quality" 
                tick={{ 
                  fill: '#FFFFFF', 
                  fontSize: 11, 
                  fontWeight: 600,
                  letterSpacing: '0.02em' 
                }} 
              />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              
              <Radar 
                name="Fraîcheur du stimulus" 
                dataKey="niveau" 
                stroke="#38bdf8" 
                strokeWidth={2.5}
                fill="rgba(56, 189, 248, 0.35)" 
                fillOpacity={1} 
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                  backdropFilter: 'blur(10px)', 
                  border: '1px solid rgba(255, 255, 255, 0.2)', 
                  borderRadius: '10px', 
                  color: '#ffffff',
                  fontSize: '12px'
                }} 
                itemStyle={{ color: '#38bdf8', fontWeight: 'bold' }}
                formatter={(value, name, item) => [
                  `${value}% (${item.payload.statusLabel})`, 
                  item.payload.fullName
                ]}
              />
            </RechartsRadar>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
