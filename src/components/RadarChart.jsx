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
      return {
        quality: q.name.substring(0, 10) + (q.name.length > 10 ? '.' : ''),
        niveau: Math.max(0, Math.round(state.currentLevel)),
        fullMark: 100,
      };
    });
  }, [qualities, events, dailyMetrics, trainingBlocks]);

  return (
    <div className="w-full h-[300px] flex flex-col">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center mb-2">Athlete Aptitude Profile</h3>
      <div className="flex-1 w-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadar cx="50%" cy="50%" outerRadius="70%" data={radarData}>
            <PolarGrid stroke="rgba(255, 255, 255, 0.1)" />
            <PolarAngleAxis dataKey="quality" tick={{ fill: '#94a3b8', fontSize: 10, letterSpacing: '0.05em' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            
            <Radar 
              name="Niveau d'effet résiduel (%)" 
              dataKey="niveau" 
              stroke="#4dabf5" 
              strokeWidth={1}
              fill="rgba(77, 171, 245, 0.4)" 
              fillOpacity={1} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#f1f5f9' }} 
              itemStyle={{ color: '#4dabf5', fontWeight: 'bold' }}
            />
          </RechartsRadar>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
