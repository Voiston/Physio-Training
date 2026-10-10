import React, { useState } from 'react';
import { MUSCLE_GROUPS, VolumeStatus } from '../utils/muscleHelpers';

interface MuscleData {
  effectiveSets: number;
  repsTotal?: number;
  volumeStatus?: VolumeStatus | string;
  name?: string;
  color?: string;
  exercises?: { name: string; sets: number }[];
}

interface MuscleBodyMapProps {
  muscleLoads: Record<string, MuscleData>;
  onSelectMuscle?: (muscleId: string) => void;
  selectedMuscleId?: string | null;
  className?: string;
}

export const MuscleBodyMap: React.FC<MuscleBodyMapProps> = ({
  muscleLoads = {},
  onSelectMuscle,
  selectedMuscleId = null,
  className = ''
}) => {
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'both' | 'front' | 'back'>('both');

  const getMuscleStatusColor = (muscleId: string) => {
    const data = muscleLoads[muscleId];
    const sets = data?.effectiveSets || 0;

    if (sets === 0) return '#1e293b'; // Slate 800 - Non travaillé
    if (sets < 6) return '#475569';   // Slate 600 - Maintien (< 6)
    if (sets <= 10) return '#0284c7';  // Sky 600 - MEV (6-10)
    if (sets <= 20) return '#10b981';  // Emerald 500 - MAV (10-20 Optimal)
    return '#f59e0b';                 // Amber 500 - MRV (> 20 Plafond)
  };

  const getMuscleGlow = (muscleId: string) => {
    const isSelected = selectedMuscleId === muscleId;
    const isHovered = hoveredMuscle === muscleId;
    if (isSelected || isHovered) {
      return 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.8))';
    }
    const sets = muscleLoads[muscleId]?.effectiveSets || 0;
    if (sets >= 10 && sets <= 20) {
      return 'drop-shadow(0 0 3px rgba(16, 185, 129, 0.4))';
    }
    return 'none';
  };

  const activeHoverData = hoveredMuscle ? {
    id: hoveredMuscle,
    name: MUSCLE_GROUPS[hoveredMuscle]?.name || hoveredMuscle,
    data: muscleLoads[hoveredMuscle] || { effectiveSets: 0, repsTotal: 0 }
  } : null;

  return (
    <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-white/10 backdrop-blur-md shadow-xl ${className}`}>
      
      {/* Header avec sélecteur de vue (Face, Dos, Les deux) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
        <div>
          <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 m-0">
            <span>🧬 Cartographie Musculaire Anatomique (Face & Dos)</span>
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5 m-0">
            Survolez ou cliquez sur un muscle pour inspecter le volume et les exercices associés.
          </p>
        </div>

        {/* Boutons de bascule vue */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('both')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              viewMode === 'both' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Face & Dos
          </button>
          <button
            type="button"
            onClick={() => setViewMode('front')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              viewMode === 'front' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Face
          </button>
          <button
            type="button"
            onClick={() => setViewMode('back')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              viewMode === 'back' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Dos
          </button>
        </div>
      </div>

      {/* Légende Scientifique de Couleur */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-4 text-[10px] font-mono px-2 py-1.5 rounded-xl bg-black/30 border border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1e293b] border border-white/20" />
          <span className="text-slate-400">0 s : Inactif</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#475569]" />
          <span className="text-slate-300">&lt;6 s : Maintien</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]" />
          <span className="text-sky-300">6-10 s : MEV</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          <span className="text-emerald-300 font-bold">10-20 s : MAV (Optimal)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
          <span className="text-amber-300">&gt;20 s : MRV (Plafond)</span>
        </div>
      </div>

      {/* ZONE D'AFFICHAGE DES MANNEQUINS SVG VECTORIELS */}
      <div className="flex flex-wrap items-center justify-around gap-6 py-2 min-h-[340px]">
        
        {/* --- MANNEQUIN VUE DE FACE --- */}
        {(viewMode === 'both' || viewMode === 'front') && (
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-slate-400 mb-2">
              Vue de Face (Antérieur)
            </span>

            <svg
              viewBox="0 0 200 420"
              className="w-44 sm:w-52 h-[340px] overflow-visible select-none transition-all drop-shadow-md"
            >
              {/* Silhouette de fond / Tête / Cou neutre */}
              <g fill="#0f172a" stroke="#334155" strokeWidth="1.5" opacity="0.6">
                {/* Tête */}
                <ellipse cx="100" cy="30" rx="16" ry="20" />
                {/* Cou */}
                <path d="M94 48 L106 48 L108 62 L92 62 Z" />
                {/* Mains */}
                <circle cx="28" cy="208" r="7" />
                <circle cx="172" cy="208" r="7" />
                {/* Pieds */}
                <ellipse cx="78" cy="406" rx="9" ry="6" />
                <ellipse cx="122" cy="406" rx="9" ry="6" />
              </g>

              {/* ÉPAULES / DELTOÏDES ANTÉRIEURS */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('deltoides_ant')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('deltoides_ant')}
                style={{ filter: getMuscleGlow('deltoides_ant') }}
                className="transition-all"
              >
                {/* Deltoïde gauche */}
                <path
                  d="M58 66 C50 68 40 76 42 94 C44 104 54 106 58 100 C62 94 66 84 66 74 Z"
                  fill={getMuscleStatusColor('deltoides_ant')}
                  stroke={selectedMuscleId === 'deltoides_ant' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Deltoïde droit */}
                <path
                  d="M142 66 C150 68 160 76 158 94 C156 104 146 106 142 100 C138 94 134 84 134 74 Z"
                  fill={getMuscleStatusColor('deltoides_ant')}
                  stroke={selectedMuscleId === 'deltoides_ant' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
              </g>

              {/* PECTORAUX */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('pectoraux')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('pectoraux')}
                style={{ filter: getMuscleGlow('pectoraux') }}
                className="transition-all"
              >
                {/* Pec gauche */}
                <path
                  d="M68 70 C76 68 96 68 98 78 C99 92 98 106 88 110 C76 112 64 106 64 94 C64 84 66 76 68 70 Z"
                  fill={getMuscleStatusColor('pectoraux')}
                  stroke={selectedMuscleId === 'pectoraux' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Pec droit */}
                <path
                  d="M132 70 C124 68 104 68 102 78 C101 92 102 106 112 110 C124 112 136 106 136 94 C136 84 134 76 132 70 Z"
                  fill={getMuscleStatusColor('pectoraux')}
                  stroke={selectedMuscleId === 'pectoraux' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
              </g>

              {/* BICEPS */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('biceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('biceps')}
                style={{ filter: getMuscleGlow('biceps') }}
                className="transition-all"
              >
                {/* Biceps gauche */}
                <path
                  d="M44 102 C38 106 34 122 36 142 C38 148 48 148 52 142 C56 132 58 116 54 104 Z"
                  fill={getMuscleStatusColor('biceps')}
                  stroke={selectedMuscleId === 'biceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Biceps droit */}
                <path
                  d="M156 102 C162 106 166 122 164 142 C162 148 152 148 148 142 C144 132 142 116 146 104 Z"
                  fill={getMuscleStatusColor('biceps')}
                  stroke={selectedMuscleId === 'biceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Avant-bras gauche */}
                <path
                  d="M36 146 C32 154 28 178 30 196 C32 200 40 200 44 194 C48 184 50 162 48 148 Z"
                  fill={getMuscleStatusColor('biceps')}
                  stroke={selectedMuscleId === 'biceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                  opacity="0.8"
                />
                {/* Avant-bras droit */}
                <path
                  d="M164 146 C168 154 172 178 170 196 C168 200 160 200 156 194 C152 184 150 162 152 148 Z"
                  fill={getMuscleStatusColor('biceps')}
                  stroke={selectedMuscleId === 'biceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                  opacity="0.8"
                />
              </g>

              {/* SANGLE ABDOMINALE & CORE */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('abdos')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('abdos')}
                style={{ filter: getMuscleGlow('abdos') }}
                className="transition-all"
              >
                {/* Abdos centre (6-pack) */}
                <path
                  d="M74 114 C82 114 96 114 98 114 L98 170 C94 176 86 178 78 174 C72 164 70 140 72 118 Z"
                  fill={getMuscleStatusColor('abdos')}
                  stroke={selectedMuscleId === 'abdos' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                />
                <path
                  d="M126 114 C118 114 104 114 102 114 L102 170 C106 176 114 178 122 174 C128 164 130 140 128 118 Z"
                  fill={getMuscleStatusColor('abdos')}
                  stroke={selectedMuscleId === 'abdos' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                />
                {/* Lignes segmentaires abdos */}
                <line x1="74" y1="132" x2="126" y2="132" stroke="#00000040" strokeWidth="1" />
                <line x1="74" y1="150" x2="126" y2="150" stroke="#00000040" strokeWidth="1" />
                {/* Obliques / Hanche */}
                <path
                  d="M66 124 C64 140 64 162 72 178 L78 176 C72 160 72 138 72 124 Z"
                  fill={getMuscleStatusColor('abdos')}
                  opacity="0.8"
                />
                <path
                  d="M134 124 C136 140 136 162 128 178 L122 176 C128 160 128 138 128 124 Z"
                  fill={getMuscleStatusColor('abdos')}
                  opacity="0.8"
                />
              </g>

              {/* BASSIN / HANCHES NEUTRE */}
              <path
                d="M74 178 C84 186 116 186 126 178 L124 196 C114 204 86 204 76 196 Z"
                fill="#1e293b"
                stroke="#334155"
                strokeWidth="1.2"
              />

              {/* QUADRICEPS */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('quadriceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('quadriceps')}
                style={{ filter: getMuscleGlow('quadriceps') }}
                className="transition-all"
              >
                {/* Quad gauche */}
                <path
                  d="M68 200 C62 216 58 248 64 290 C68 304 88 304 90 292 C94 266 96 230 94 204 Z"
                  fill={getMuscleStatusColor('quadriceps')}
                  stroke={selectedMuscleId === 'quadriceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Quad droit */}
                <path
                  d="M132 200 C138 216 142 248 136 290 C132 304 112 304 110 292 C106 266 104 230 106 204 Z"
                  fill={getMuscleStatusColor('quadriceps')}
                  stroke={selectedMuscleId === 'quadriceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Genoux neutres */}
                <circle cx="78" cy="306" r="6" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                <circle cx="122" cy="306" r="6" fill="#1e293b" stroke="#334155" strokeWidth="1" />
              </g>

              {/* MOLLETS (FACE / TIBIA) */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('mollets')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('mollets')}
                style={{ filter: getMuscleGlow('mollets') }}
                className="transition-all"
              >
                {/* Mollet gauche */}
                <path
                  d="M70 316 C62 332 60 360 70 392 C74 398 84 398 86 392 C90 368 90 338 86 316 Z"
                  fill={getMuscleStatusColor('mollets')}
                  stroke={selectedMuscleId === 'mollets' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Mollet droit */}
                <path
                  d="M130 316 C138 332 140 360 130 392 C126 398 116 398 114 392 C110 368 110 338 114 316 Z"
                  fill={getMuscleStatusColor('mollets')}
                  stroke={selectedMuscleId === 'mollets' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
              </g>
            </svg>
          </div>
        )}

        {/* --- MANNEQUIN VUE DE DOS --- */}
        {(viewMode === 'both' || viewMode === 'back') && (
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-slate-400 mb-2">
              Vue de Dos (Postérieur)
            </span>

            <svg
              viewBox="0 0 200 420"
              className="w-44 sm:w-52 h-[340px] overflow-visible select-none transition-all drop-shadow-md"
            >
              {/* Silhouette de fond / Tête / Cou neutre */}
              <g fill="#0f172a" stroke="#334155" strokeWidth="1.5" opacity="0.6">
                {/* Tête dos */}
                <ellipse cx="100" cy="30" rx="16" ry="20" />
                {/* Mains */}
                <circle cx="28" cy="208" r="7" />
                <circle cx="172" cy="208" r="7" />
                {/* Pieds (talons) */}
                <ellipse cx="78" cy="406" rx="9" ry="6" />
                <ellipse cx="122" cy="406" rx="9" ry="6" />
              </g>

              {/* TRAPÈZES & HAUT DU DOS */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('trapezes')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('trapezes')}
                style={{ filter: getMuscleGlow('trapezes') }}
                className="transition-all"
              >
                {/* Trapèzes losange cervical / dorsal */}
                <path
                  d="M94 48 L106 48 L126 68 L100 112 L74 68 Z"
                  fill={getMuscleStatusColor('trapezes')}
                  stroke={selectedMuscleId === 'trapezes' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
              </g>

              {/* ÉPAULES / ARRIÈRE D'ÉPAULE */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('deltoides_ant')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('deltoides_ant')}
                style={{ filter: getMuscleGlow('deltoides_ant') }}
                className="transition-all"
              >
                {/* Deltoïde post gauche */}
                <path
                  d="M58 66 C48 70 40 82 42 98 C46 104 54 104 58 98 C62 90 68 80 72 70 Z"
                  fill={getMuscleStatusColor('deltoides_ant')}
                  stroke={selectedMuscleId === 'deltoides_ant' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Deltoïde post droit */}
                <path
                  d="M142 66 C152 70 160 82 158 98 C154 104 146 104 142 98 C138 90 132 80 128 70 Z"
                  fill={getMuscleStatusColor('deltoides_ant')}
                  stroke={selectedMuscleId === 'deltoides_ant' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
              </g>

              {/* TRICEPS */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('triceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('triceps')}
                style={{ filter: getMuscleGlow('triceps') }}
                className="transition-all"
              >
                {/* Triceps gauche */}
                <path
                  d="M44 102 C38 112 34 130 36 144 C40 148 50 148 54 140 C56 128 56 114 52 102 Z"
                  fill={getMuscleStatusColor('triceps')}
                  stroke={selectedMuscleId === 'triceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Triceps droit */}
                <path
                  d="M156 102 C162 112 166 130 164 144 C160 148 150 148 146 140 C144 128 144 114 148 102 Z"
                  fill={getMuscleStatusColor('triceps')}
                  stroke={selectedMuscleId === 'triceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Avant-bras dos gauche */}
                <path
                  d="M36 148 C30 160 28 182 30 196 C34 200 42 200 46 194 C48 182 50 162 48 148 Z"
                  fill={getMuscleStatusColor('triceps')}
                  stroke={selectedMuscleId === 'triceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                  opacity="0.8"
                />
                {/* Avant-bras dos droit */}
                <path
                  d="M164 148 C170 160 172 182 170 196 C166 200 158 200 154 194 C152 182 150 162 152 148 Z"
                  fill={getMuscleStatusColor('triceps')}
                  stroke={selectedMuscleId === 'triceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                  opacity="0.8"
                />
              </g>

              {/* GRAND DORSAL (LATS) */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('dorsaux')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('dorsaux')}
                style={{ filter: getMuscleGlow('dorsaux') }}
                className="transition-all"
              >
                {/* Dorsal gauche */}
                <path
                  d="M72 74 C62 88 60 114 66 144 C72 154 84 156 94 150 L98 116 L74 72 Z"
                  fill={getMuscleStatusColor('dorsaux')}
                  stroke={selectedMuscleId === 'dorsaux' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Dorsal droit */}
                <path
                  d="M128 74 C138 88 140 114 134 144 C128 154 116 156 106 150 L102 116 L126 72 Z"
                  fill={getMuscleStatusColor('dorsaux')}
                  stroke={selectedMuscleId === 'dorsaux' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
              </g>

              {/* LOMBAIRES / ÉRECTEURS DU RACHIS */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('lombaires')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('lombaires')}
                style={{ filter: getMuscleGlow('lombaires') }}
                className="transition-all"
              >
                {/* Lombaires gauche */}
                <path
                  d="M86 146 L98 146 L98 184 L80 184 C78 170 80 156 86 146 Z"
                  fill={getMuscleStatusColor('lombaires')}
                  stroke={selectedMuscleId === 'lombaires' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                />
                {/* Lombaires droit */}
                <path
                  d="M114 146 L102 146 L102 184 L120 184 C122 170 120 156 114 146 Z"
                  fill={getMuscleStatusColor('lombaires')}
                  stroke={selectedMuscleId === 'lombaires' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                />
              </g>

              {/* FESSIERS (GLUTES) */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('glutes')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('glutes')}
                style={{ filter: getMuscleGlow('glutes') }}
                className="transition-all"
              >
                {/* Fessier gauche */}
                <path
                  d="M74 186 C64 192 60 212 66 230 C72 242 90 242 98 234 L98 186 Z"
                  fill={getMuscleStatusColor('glutes')}
                  stroke={selectedMuscleId === 'glutes' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Fessier droit */}
                <path
                  d="M126 186 C136 192 140 212 134 230 C128 242 110 242 102 234 L102 186 Z"
                  fill={getMuscleStatusColor('glutes')}
                  stroke={selectedMuscleId === 'glutes' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
              </g>

              {/* ISCHIO-JAMBIERS */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('ischios')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('ischios')}
                style={{ filter: getMuscleGlow('ischios') }}
                className="transition-all"
              >
                {/* Ischios gauche */}
                <path
                  d="M68 236 C64 250 62 278 70 298 C76 304 88 304 92 296 C96 274 96 252 96 236 Z"
                  fill={getMuscleStatusColor('ischios')}
                  stroke={selectedMuscleId === 'ischios' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Ischios droit */}
                <path
                  d="M132 236 C136 250 138 278 130 298 C124 304 112 304 108 296 C104 274 104 252 104 236 Z"
                  fill={getMuscleStatusColor('ischios')}
                  stroke={selectedMuscleId === 'ischios' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Creux poplité neutre */}
                <circle cx="78" cy="306" r="5" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                <circle cx="122" cy="306" r="5" fill="#1e293b" stroke="#334155" strokeWidth="1" />
              </g>

              {/* MOLLETS (POSTÉRIEUR / GASTROCNÉMIEN) */}
              <g
                cursor="pointer"
                onMouseEnter={() => setHoveredMuscle('mollets')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => onSelectMuscle?.('mollets')}
                style={{ filter: getMuscleGlow('mollets') }}
                className="transition-all"
              >
                {/* Mollet dos gauche */}
                <path
                  d="M70 314 C60 328 58 356 68 388 C74 396 84 396 86 388 C92 360 92 334 86 314 Z"
                  fill={getMuscleStatusColor('mollets')}
                  stroke={selectedMuscleId === 'mollets' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Mollet dos droit */}
                <path
                  d="M130 314 C140 328 142 356 132 388 C126 396 116 396 114 388 C108 360 108 334 114 314 Z"
                  fill={getMuscleStatusColor('mollets')}
                  stroke={selectedMuscleId === 'mollets' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
              </g>
            </svg>
          </div>
        )}
      </div>

      {/* CARTE TOOLTIP EN BAS LORS DU SURVOL D'UN MUSCLE */}
      <div className="mt-3 p-2.5 rounded-xl bg-black/50 border border-white/10 min-h-[50px] flex items-center justify-between">
        {activeHoverData ? (
          <div className="flex items-center justify-between w-full flex-wrap gap-2 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: getMuscleStatusColor(activeHoverData.id) }}
              />
              <div>
                <span className="font-bold text-xs text-white block">
                  {activeHoverData.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {activeHoverData.data.repsTotal || 0} répétitions cumulées
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-mono font-extrabold text-white">
                {activeHoverData.data.effectiveSets || 0} <span className="text-xs font-normal text-slate-400">séries</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-mono">
                {activeHoverData.data.effectiveSets >= 10 && activeHoverData.data.effectiveSets <= 20
                  ? '✓ MAV Optimal'
                  : activeHoverData.data.effectiveSets > 20
                  ? '⚠️ MRV Plafond'
                  : activeHoverData.data.effectiveSets >= 6
                  ? 'MEV Minimal'
                  : 'Maintien (<6s)'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 italic text-center w-full">
            Survolez une région musculaire pour afficher son volume hebdomadaire détaillé.
          </div>
        )}
      </div>

    </div>
  );
};
