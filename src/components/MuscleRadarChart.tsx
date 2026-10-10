import React, { useMemo } from 'react';
import { 
  Radar, RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, Tooltip 
} from 'recharts';
import { WeeklyMuscleItem, MUSCLE_GROUPS } from '../utils/muscleHelpers';

interface MuscleRadarChartProps {
  muscles: Record<string, WeeklyMuscleItem>;
  selectedMuscleId?: string | null;
  onSelectMuscle?: (muscleId: string) => void;
  className?: string;
}

const SHORT_NAMES: Record<string, string> = {
  quadriceps: 'Quads',
  ischios: 'Ischios',
  glutes: 'Fessiers',
  mollets: 'Mollets',
  pectoraux: 'Pecs',
  deltoides_ant: 'Épaules',
  triceps: 'Triceps',
  dorsaux: 'Dorsaux',
  trapezes: 'Trapèzes',
  biceps: 'Biceps',
  abdos: 'Abdos',
  lombaires: 'Lombaires'
};

export const MuscleRadarChart: React.FC<MuscleRadarChartProps> = ({
  muscles,
  selectedMuscleId = null,
  onSelectMuscle,
  className = ''
}) => {
  // Préparation des données du radar dans un ordre anatomique cohérent
  const orderedMuscleIds = [
    'quadriceps', 'glutes', 'ischios', 'mollets', 
    'lombaires', 'abdos',
    'dorsaux', 'trapezes', 'biceps', 
    'deltoides_ant', 'pectoraux', 'triceps'
  ];

  const radarData = useMemo(() => {
    return orderedMuscleIds.map(mId => {
      const item = muscles[mId] || {
        effectiveSets: 0,
        name: MUSCLE_GROUPS[mId]?.name || mId,
        categoryLabel: MUSCLE_GROUPS[mId]?.categoryLabel || ''
      };

      return {
        muscleId: mId,
        shortLabel: SHORT_NAMES[mId] || item.name,
        fullName: item.name,
        category: item.categoryLabel,
        sets: item.effectiveSets || 0,
        mavTarget: 15, // Repère moyen du couloir MAV (10-20 séries)
        mevLimit: 6,   // Seuil de maintien / MEV
        isSelected: selectedMuscleId === mId
      };
    });
  }, [muscles, selectedMuscleId]);

  const maxSets = useMemo(() => {
    const highest = Math.max(0, ...radarData.map(d => d.sets));
    return Math.max(22, highest + 2);
  }, [radarData]);

  // Tooltip personnalisé pour expliquer le volume et les repères MAV
  const CustomRadarTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    const sets = data.sets;
    let statusText = 'Maintien (<6s)';
    let statusColor = 'text-slate-400';

    if (sets >= 10 && sets <= 20) {
      statusText = '✓ Zone Optimale MAV (10-20s)';
      statusColor = 'text-emerald-400 font-bold';
    } else if (sets > 20) {
      statusText = '⚠️ Plafond MRV Dépassé (>20s)';
      statusColor = 'text-amber-400 font-bold';
    } else if (sets >= 6) {
      statusText = 'Stimulus Minimal MEV (6-10s)';
      statusColor = 'text-sky-400';
    } else if (sets === 0) {
      statusText = 'Inactif (0 série)';
      statusColor = 'text-slate-500';
    }

    return (
      <div className="p-3 bg-slate-900/95 border border-white/15 rounded-xl shadow-2xl backdrop-blur-md text-xs font-sans space-y-1 z-50">
        <div className="font-bold text-white text-sm flex items-center justify-between gap-3">
          <span>{data.fullName}</span>
          <span className="text-[10px] font-normal text-slate-400 font-mono">
            {data.category}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/10">
          <span className="text-slate-300">Volume réalisé :</span>
          <span className="font-mono font-extrabold text-blue-400 text-sm">{sets} séries</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400 text-[11px]">Couloir MAV optimal :</span>
          <span className="font-mono text-emerald-400 text-[11px]">10 - 20 séries</span>
        </div>
        <div className={`text-[11px] pt-1 ${statusColor}`}>
          {statusText}
        </div>
      </div>
    );
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-white/10 backdrop-blur-md shadow-xl flex flex-col justify-between ${className}`}>
      
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2 pb-3 border-b border-white/10">
        <div>
          <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 m-0">
            <span>🕸️ Radar Musculaire (Couloir Optimal MAV 10-20s)</span>
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5 m-0">
            Repérez instantanément les déséquilibres et les groupes musculaires sous-stimulés.
          </p>
        </div>

        {selectedMuscleId && (
          <button
            type="button"
            onClick={() => onSelectMuscle?.(selectedMuscleId)}
            className="px-2 py-1 text-[10px] font-mono rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* Légende du radar */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] font-mono px-2 py-1 rounded-xl bg-black/30 border border-white/5 mb-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-blue-400 rounded-full inline-block" />
          <span className="text-blue-300 font-semibold">Volume Réalisé (séries)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-emerald-400 border border-dashed border-emerald-400 rounded-full inline-block" />
          <span className="text-emerald-300">Couloir MAV Optimal (10-20)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
          <span className="text-slate-400">MEV Minimal (6s)</span>
        </div>
      </div>

      {/* Zone Graphique Radar */}
      <div className="w-full h-[320px] sm:h-[350px] relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadar 
            cx="50%" 
            cy="50%" 
            outerRadius="75%" 
            data={radarData}
          >
            <PolarGrid stroke="rgba(255, 255, 255, 0.12)" strokeDasharray="3 3" />
            <PolarAngleAxis 
              dataKey="shortLabel" 
              tick={(props) => {
                const { payload, x, y, textAnchor } = props;
                const mData = radarData.find(d => d.shortLabel === payload.value);
                const isSelected = mData?.muscleId === selectedMuscleId;
                const sets = mData?.sets || 0;
                const isOptimal = sets >= 10 && sets <= 20;

                return (
                  <text
                    x={x}
                    y={y}
                    textAnchor={textAnchor}
                    className="cursor-pointer select-none transition-all"
                    onClick={() => mData && onSelectMuscle?.(mData.muscleId)}
                    fill={isSelected ? '#38bdf8' : isOptimal ? '#10b981' : sets > 20 ? '#f59e0b' : sets > 0 ? '#cbd5e1' : '#64748b'}
                    fontSize={11}
                    fontWeight={isSelected ? 800 : isOptimal ? 700 : 500}
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, maxSets]} 
              stroke="rgba(255, 255, 255, 0.2)" 
              tick={{ fill: '#94a3b8', fontSize: 9 }} 
              axisLine={false} 
            />

            {/* Zone de référence : Couloir MAV Moyen (15 séries) */}
            <Radar 
              name="Couloir MAV Optimal" 
              dataKey="mavTarget" 
              stroke="#10b981" 
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="rgba(16, 185, 129, 0.12)" 
              fillOpacity={0.5} 
            />

            {/* Volume réel de l'athlète */}
            <Radar 
              name="Séries Effectives" 
              dataKey="sets" 
              stroke="#38bdf8" 
              strokeWidth={2.5}
              fill="rgba(56, 189, 248, 0.4)" 
              fillOpacity={0.8}
              dot={{ r: 3, fill: '#38bdf8', strokeWidth: 1, stroke: '#ffffff' }}
              activeDot={{ r: 5, fill: '#60a5fa', stroke: '#ffffff', strokeWidth: 2 }}
            />

            <Tooltip content={<CustomRadarTooltip />} />
          </RechartsRadar>
        </ResponsiveContainer>
      </div>

      {/* Guide informatif en bas */}
      <div className="mt-2 text-[11px] text-slate-400 italic text-center">
        Cliquez sur un groupe musculaire pour le mettre en évidence dans l'ensemble des analyses.
      </div>
    </div>
  );
};
