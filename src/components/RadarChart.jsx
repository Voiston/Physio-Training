import { useMemo } from 'react';
import { 
  Radar, RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, Tooltip 
} from 'recharts';
import { computeCellState } from '../utils/physiology';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';

export default function RadarChart({ qualities, events, dailyMetrics, trainingBlocks = [] }) {
  
  const radarData = useMemo(() => {
    const todayStr = getLocalYYYYMMDD(new Date());
    const readiness = dailyMetrics?.[todayStr]?.readiness || 7;

    return qualities.map((q) => {
      const state = computeCellState(q, todayStr, events[q.id], readiness, trainingBlocks);
      const shortName = q.name.length > 12 ? q.name.substring(0, 11) + '…' : q.name;
      return {
        quality: shortName,
        fullName: q.name,
        niveau: Math.max(0, Math.round(state.currentLevel)),
        fullMark: 100,
      };
    });
  }, [qualities, events, dailyMetrics, trainingBlocks]);

  return (
    <div className="w-full h-[300px] flex flex-col">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider m-0">
          Profil d'Aptitude Athlétique
        </h3>
        <span className="text-[10px] font-mono text-blue-400 font-semibold">
          Effet résiduel
        </span>
      </div>
      <div className="flex-1 w-full min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadar cx="50%" cy="50%" outerRadius="70%" data={radarData}>
            <PolarGrid stroke="rgba(255, 255, 255, 0.16)" />
            <PolarAngleAxis 
              dataKey="quality" 
              tick={{ 
                fill: '#F1F5F9', 
                fontSize: 11, 
                fontWeight: 600,
                letterSpacing: '0.02em' 
              }} 
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            
            <Radar 
              name="Effet résiduel" 
              dataKey="niveau" 
              stroke="#3b82f6" 
              strokeWidth={2}
              fill="rgba(59, 130, 246, 0.35)" 
              fillOpacity={1} 
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                backdropFilter: 'blur(10px)', 
                border: '1px solid rgba(255, 255, 255, 0.15)', 
                borderRadius: '10px', 
                color: '#f8fafc',
                fontSize: '12px'
              }} 
              itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
              formatter={(value, name, item) => [`${value}% d'effet résiduel`, item.payload.fullName]}
            />
          </RechartsRadar>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
