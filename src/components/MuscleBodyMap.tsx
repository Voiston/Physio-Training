import React, { useState, useMemo } from 'react';
import { MUSCLE_GROUPS, VolumeStatus, getVolumeLandmark, MuscleGroup } from '../utils/muscleHelpers';
import { Dumbbell, Check, ChevronRight, Eye, Info, X, Activity, Target, Flame, ShieldAlert, Zap } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { MuscleRegion, type MuscleRegionProps } from './MuscleRegion';

export { MuscleRegion, type MuscleRegionProps };

interface MuscleData {
  effectiveSets: number;
  repsTotal?: number;
  volumeStatus?: VolumeStatus | string;
  name?: string;
  color?: string;
  exercises?: { 
    name?: string; 
    exerciseName?: string; 
    sets: number;
    reps?: number;
    isPrimary?: boolean;
  }[];
}

interface MuscleBodyMapProps {
  muscleLoads: Record<string, MuscleData>;
  onSelectMuscle?: (muscleId: string) => void;
  selectedMuscleId?: string | null;
  className?: string;
}

// Paires biomécaniques antagonistes pour le diagnostic d'équilibre articulaire
const ANTAGONIST_PAIRS: Record<string, { partnerId: string; name: string; targetRatio?: number; label: string }> = {
  quadriceps: { partnerId: 'ischios', name: 'Ischio-jambiers', targetRatio: 0.60, label: 'Ratio H:Q (Ischios / Quad)' },
  ischios: { partnerId: 'quadriceps', name: 'Quadriceps', targetRatio: 0.60, label: 'Ratio H:Q (Ischios / Quad)' },
  pectoraux: { partnerId: 'dorsaux', name: 'Grand Dorsal', targetRatio: 1.0, label: 'Équilibre Poussée / Tirage' },
  deltoides_ant: { partnerId: 'dorsaux', name: 'Grand Dorsal', targetRatio: 1.0, label: 'Équilibre Poussée / Tirage' },
  deltoides_post: { partnerId: 'deltoides_ant', name: 'Deltoïdes Antérieurs', targetRatio: 1.0, label: 'Équilibre Antérieur / Postérieur Épaules' },
  dorsaux: { partnerId: 'pectoraux', name: 'Pectoraux', targetRatio: 1.0, label: 'Équilibre Tirage / Poussée' },
  trapezes: { partnerId: 'pectoraux', name: 'Pectoraux', targetRatio: 1.0, label: 'Équilibre Tirage / Poussée' },
  biceps: { partnerId: 'triceps', name: 'Triceps', label: 'Fléchisseurs / Extenseurs bras' },
  triceps: { partnerId: 'biceps', name: 'Biceps', label: 'Extenseurs / Fléchisseurs bras' },
  abdos: { partnerId: 'lombaires', name: 'Érecteurs rachis (Lombaires)', label: 'Équilibre Core Tronc' },
  lombaires: { partnerId: 'abdos', name: 'Sangle abdominale', label: 'Équilibre Core Tronc' },
  glutes: { partnerId: 'quadriceps', name: 'Quadriceps', label: 'Chaîne postérieure / antérieure' },
  mollets: { partnerId: 'quadriceps', name: 'Quadriceps', label: 'Chaîne inférieure' }
};

export const MuscleBodyMap: React.FC<MuscleBodyMapProps> = ({
  muscleLoads = {},
  onSelectMuscle,
  selectedMuscleId = null,
  className = ''
}) => {
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'both' | 'front' | 'back'>('both');
  const [showBadges, setShowBadges] = useState<boolean>(true);
  const [colorMode, setColorMode] = useState<'landmarks' | 'heatmap'>('landmarks');

  // Volume total hebdomadaire cumulé sur tous les muscles
  const totalWeeklySets = useMemo(() => {
    return Object.values(muscleLoads).reduce((acc, m) => acc + (m?.effectiveSets || 0), 0);
  }, [muscleLoads]);

  // Déterminer la couleur de statut physiologique selon Israetel / Schoenfeld
  const getMuscleStatusColor = (muscleId: string) => {
    const data = muscleLoads[muscleId];
    const sets = data?.effectiveSets || 0;

    if (colorMode === 'heatmap') {
      if (sets === 0) return '#1e293b';
      const pct = totalWeeklySets > 0 ? (sets / totalWeeklySets) * 100 : 0;
      if (pct > 20) return '#f43f5e'; // Rose/Rouge intensité max
      if (pct > 12) return '#f97316'; // Orange fort
      if (pct > 7) return '#10b981';  // Émeraude optimal
      return '#0284c7';               // Bleu modéré
    }

    if (sets === 0) return '#1e293b'; // Inactif - Slate 800
    return getVolumeLandmark(sets).hexColor;
  };

  const getMuscleGradientId = (muscleId: string) => {
    const data = muscleLoads[muscleId];
    const sets = data?.effectiveSets || 0;

    if (colorMode === 'heatmap') {
      if (sets === 0) return 'grad-inactive';
      const pct = totalWeeklySets > 0 ? (sets / totalWeeklySets) * 100 : 0;
      if (pct > 20) return 'grad-heat-max';
      if (pct > 12) return 'grad-heat-high';
      if (pct > 7) return 'grad-mav';
      return 'grad-mev';
    }

    if (sets === 0) return 'grad-inactive';
    return getVolumeLandmark(sets).gradientId;
  };

  const getMuscleGlow = (muscleId: string) => {
    const isSelected = selectedMuscleId === muscleId;
    const isHovered = hoveredMuscle === muscleId;
    if (isSelected) {
      return 'drop-shadow(0 0 12px rgba(56, 189, 248, 1)) drop-shadow(0 0 2px rgba(255, 255, 255, 0.8))';
    }
    if (isHovered) {
      return 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.9))';
    }
    const sets = muscleLoads[muscleId]?.effectiveSets || 0;
    if (getVolumeLandmark(sets).status === 'mav') {
      return 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.35))';
    }
    return 'none';
  };

  const handleMuscleClick = (muscle: MuscleGroup | string) => {
    const muscleId = typeof muscle === 'object' && muscle !== null ? (muscle as MuscleGroup).id : String(muscle);
    haptics.tap();
    onSelectMuscle?.(muscleId);
  };

  const activeInspectId = selectedMuscleId || hoveredMuscle;
  const inspectedData = activeInspectId ? {
    id: activeInspectId,
    name: MUSCLE_GROUPS[activeInspectId]?.name || activeInspectId,
    categoryLabel: MUSCLE_GROUPS[activeInspectId]?.categoryLabel || 'Zone musculaire',
    color: MUSCLE_GROUPS[activeInspectId]?.color || '#38bdf8',
    data: muscleLoads[activeInspectId] || { effectiveSets: 0, repsTotal: 0, exercises: [] }
  } : null;

  // Calcul du total de muscles actifs
  const totalWorkedMuscles = Object.values(muscleLoads).filter(m => (m?.effectiveSets || 0) > 0).length;
  const totalMuscleCount = Object.keys(MUSCLE_GROUPS).length;

  // Données de l'antagoniste pour le diagnostic biomécanique
  const antagonistInfo = useMemo(() => {
    if (!activeInspectId || !ANTAGONIST_PAIRS[activeInspectId]) return null;
    const pair = ANTAGONIST_PAIRS[activeInspectId];
    const partnerData = muscleLoads[pair.partnerId] || { effectiveSets: 0 };
    const mySets = muscleLoads[activeInspectId]?.effectiveSets || 0;
    const partnerSets = partnerData.effectiveSets || 0;

    let ratioNum: number | null = null;
    let isBalanced: boolean | null = null;
    let ratioText = '';

    if (activeInspectId === 'quadriceps' || activeInspectId === 'ischios') {
      const qSets = activeInspectId === 'quadriceps' ? mySets : partnerSets;
      const hSets = activeInspectId === 'ischios' ? mySets : partnerSets;
      if (qSets > 0) {
        ratioNum = Math.round((hSets / qSets) * 100) / 100;
        isBalanced = ratioNum >= 0.60;
        ratioText = `Ratio H:Q = ${ratioNum} (visée ≥ 0.60)`;
      }
    } else if (pair.targetRatio) {
      if (partnerSets > 0) {
        ratioNum = Math.round((mySets / partnerSets) * 100) / 100;
        isBalanced = ratioNum >= 0.8 && ratioNum <= 1.3;
        ratioText = `Ratio = ${ratioNum}`;
      }
    }

    return {
      partnerId: pair.partnerId,
      partnerName: pair.name,
      partnerSets,
      label: pair.label,
      ratioText,
      isBalanced
    };
  }, [activeInspectId, muscleLoads]);

  // Rendu d'un badge de séries sur le mannequin
  const renderBadge = (muscleId: string, x: number, y: number) => {
    if (!showBadges) return null;
    const sets = muscleLoads[muscleId]?.effectiveSets || 0;
    if (sets === 0) return null;

    const isSelected = selectedMuscleId === muscleId;
    const isHovered = hoveredMuscle === muscleId;
    const statusColor = getMuscleStatusColor(muscleId);

    return (
      <g 
        transform={`translate(${x}, ${y})`} 
        className="pointer-events-none select-none transition-transform duration-200"
        style={{
          transform: isSelected || isHovered ? `translate(${x}px, ${y}px) scale(1.18)` : `translate(${x}px, ${y}px)`
        }}
      >
        <rect
          x="-14"
          y="-8"
          width="28"
          height="16"
          rx="8"
          fill="#090d16"
          stroke={isSelected ? '#38bdf8' : statusColor}
          strokeWidth={isSelected ? '2' : '1.3'}
          opacity="0.95"
        />
        <text
          x="0"
          y="3.5"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
          fontWeight="bold"
        >
          {sets}s
        </text>
      </g>
    );
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-black/95 border border-white/10 backdrop-blur-md shadow-2xl flex flex-col justify-between ${className}`}>
      
      {/* HEADER : TITRE, COMPTEUR, MODES COLOR & BASCULES DE VUE */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <Dumbbell size={15} />
            </span>
            <h4 className="text-sm sm:text-base font-bold text-white tracking-tight m-0">
              Cartographie Musculaire Haute Définition
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
              {totalWorkedMuscles}/{totalMuscleCount} ciblés
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 m-0">
            Modélisation biomécanique des {totalMuscleCount} filières musculaires, équilibre articulaire et volume effectif.
          </p>
        </div>

        {/* Contrôles tactiles (Face, Dos, Les deux, Badges, Heatmap) */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap" role="toolbar" aria-label="Affichage de la cartographie musculaire">
          {/* Bascule Mode Repères Scientifiques vs Heatmap Stimulus */}
          <button
            type="button"
            aria-pressed={colorMode === 'heatmap'}
            onClick={() => {
              haptics.tap();
              setColorMode(prev => prev === 'landmarks' ? 'heatmap' : 'landmarks');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold rounded-xl border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              colorMode === 'heatmap'
                ? 'bg-rose-500/20 text-rose-200 border-rose-500/50 shadow-sm'
                : 'bg-white/5 text-slate-200 border-white/10 hover:text-white hover:bg-white/10'
            }`}
            title={colorMode === 'heatmap' ? 'Passer en mode Repères MV/MEV/MAV' : 'Passer en mode Heatmap de charge'}
          >
            <Flame size={14} className={colorMode === 'heatmap' ? 'text-rose-400 animate-pulse' : 'text-slate-400'} aria-hidden="true" />
            <span>{colorMode === 'heatmap' ? 'Heatmap %' : 'Repères MAV'}</span>
          </button>

          {/* Vues Face / Dos / Les deux */}
          <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/10" role="radiogroup" aria-label="Perspective anatomique">
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === 'both'}
              onClick={() => {
                haptics.tap();
                setViewMode('both');
              }}
              className={`px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-lg transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                viewMode === 'both' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Face & Dos
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === 'front'}
              onClick={() => {
                haptics.tap();
                setViewMode('front');
              }}
              className={`px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-lg transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                viewMode === 'front' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Face
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === 'back'}
              onClick={() => {
                haptics.tap();
                setViewMode('back');
              }}
              className={`px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-lg transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                viewMode === 'back' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Dos
            </button>
          </div>

          {/* Bouton afficher/masquer les pastilles de séries */}
          <button
            type="button"
            aria-pressed={showBadges}
            aria-label={showBadges ? 'Masquer les pastilles de séries sur les mannequins' : 'Afficher les pastilles de séries sur les mannequins'}
            onClick={() => {
              haptics.tap();
              setShowBadges(prev => !prev);
            }}
            className={`p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              showBadges 
                ? 'bg-blue-500/20 text-blue-200 border-blue-500/40' 
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
            title={showBadges ? 'Masquer les badges de séries' : 'Afficher les badges de séries'}
          >
            {showBadges ? <Eye size={16} aria-hidden="true" /> : <Eye size={16} className="opacity-40" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* LÉGENDE DE COULEUR INTERACTIVE SELON LE MODE */}
      <div className="flex flex-wrap items-center justify-between gap-2 my-2.5 text-[10px] font-mono px-3 py-2 rounded-xl bg-black/40 border border-white/5">
        {colorMode === 'landmarks' ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1e293b] border border-white/20" />
              <span className="text-slate-400">0s : Inactif</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#475569]" />
              <span className="text-slate-300">&lt;6s : Maintien</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7] shadow-[0_0_6px_rgba(2,132,199,0.5)]" />
              <span className="text-sky-300">6-9s : MEV Minimal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.8)] ring-1 ring-emerald-400" />
              <span className="text-emerald-300 font-bold">10-20s : MAV Optimal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              <span className="text-amber-300">&gt;20s : MRV Plafond</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1e293b] border border-white/20" />
              <span className="text-slate-400">0% Inactif</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]" />
              <span className="text-sky-300">&lt;7% Modéré</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
              <span className="text-emerald-300 font-bold">7-12% Équilibré</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
              <span className="text-orange-300 font-bold">12-20% Prioritaire</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] animate-pulse" />
              <span className="text-rose-400 font-black">&gt;20% Forte charge</span>
            </div>
          </>
        )}
      </div>

      {/* ZONE D'AFFICHAGE DES MANNEQUINS SVG VECTORIELS HAUTE PRÉCISION */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 py-2 min-h-[350px] overflow-hidden">
        
        {/* --- DÉFINITIONS SVG COMMUNES (GRADIENTS 3D & GLOW) --- */}
        <svg className="w-0 h-0 absolute">
          <defs>
            {/* Dégradé Inactif */}
            <linearGradient id="grad-inactive" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            {/* Dégradé Maintien (<6s) */}
            <linearGradient id="grad-maintien" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>

            {/* Dégradé MEV (6-10s) */}
            <linearGradient id="grad-mev" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>

            {/* Dégradé MAV (10-20s Optimal) */}
            <linearGradient id="grad-mav" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Dégradé MRV (>20s Surcharge) */}
            <linearGradient id="grad-mrv" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>

            {/* Dégradés Heatmap */}
            <linearGradient id="grad-heat-high" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            <linearGradient id="grad-heat-max" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
          </defs>
        </svg>

        {/* --- MANNEQUIN VUE DE FACE (ANTÉRIEUR) --- */}
        {(viewMode === 'both' || viewMode === 'front') && (
          <div className="flex flex-col items-center animate-fadeIn">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400 mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              Face (Antérieur)
            </span>

            <svg
              viewBox="0 0 200 420"
              className="w-36 sm:w-48 h-[340px] select-none transition-all drop-shadow-xl overflow-visible cursor-pointer"
            >
              {/* Silhouette osseuse et neutre de fond */}
              <g fill="#0b1120" stroke="#1e293b" strokeWidth="1.5" opacity="0.8">
                {/* Tête anatomique avec menton athlétique */}
                <path d="M100 14 C112 14 117 22 117 34 C117 44 110 52 100 52 C90 52 83 44 83 34 C83 22 88 14 100 14 Z" />
                {/* Cou avec sterno-cléido-mastoïdiens */}
                <path d="M92 48 L108 48 L111 64 L89 64 Z" />
                <line x1="94" y1="48" x2="98" y2="64" stroke="#ffffff15" strokeWidth="1" />
                <line x1="106" y1="48" x2="102" y2="64" stroke="#ffffff15" strokeWidth="1" />
                {/* Clavicules */}
                <path d="M78 64 C88 66 98 66 100 66 C102 66 112 66 122 64" stroke="#ffffff20" strokeWidth="1.2" fill="none" />
                {/* Mains */}
                <path d="M26 198 C22 202 22 214 26 218 C30 220 34 216 34 208 C34 200 30 196 26 198 Z" />
                <path d="M174 198 C178 202 178 214 174 218 C170 220 166 216 166 208 C166 200 170 196 174 198 Z" />
                {/* Pieds / Chevilles */}
                <path d="M72 396 L82 396 L86 412 L68 412 Z" />
                <path d="M128 396 L118 396 L114 412 L132 412 Z" />
              </g>

              {/* TRAPÈZES SUPÉRIEURS (FACE) */}
              <MuscleRegion
                id="trapezes"
                label="Trapèzes supérieurs"
                effectiveSets={muscleLoads['trapezes']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'trapezes'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('trapezes')}
              >
                <path
                  d="M91 52 L89 64 L78 64 C82 58 86 54 91 52 Z"
                  fill={`url(#${getMuscleGradientId('trapezes')})`}
                  stroke={selectedMuscleId === 'trapezes' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                />
                <path
                  d="M109 52 L111 64 L122 64 C118 58 114 54 109 52 Z"
                  fill={`url(#${getMuscleGradientId('trapezes')})`}
                  stroke={selectedMuscleId === 'trapezes' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                />
              </MuscleRegion>

              {/* DELTOÏDES (ANTÉRIEUR & LATÉRAL) */}
              <MuscleRegion
                id="deltoides_ant"
                label="Épaules et deltoïdes"
                effectiveSets={muscleLoads['deltoides_ant']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'deltoides_ant'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('deltoides_ant')}
              >
                {/* Deltoïde gauche */}
                <path
                  d="M78 64 C70 65 52 70 48 84 C45 96 52 106 58 104 C64 98 68 88 70 78 Z"
                  fill={`url(#${getMuscleGradientId('deltoides_ant')})`}
                  stroke={selectedMuscleId === 'deltoides_ant' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                {/* Fibres deltoïdiennes gauche */}
                <path d="M64 74 C58 84 58 92 60 98" stroke="#ffffff18" strokeWidth="1" fill="none" />

                {/* Deltoïde droit */}
                <path
                  d="M122 64 C130 65 148 70 152 84 C155 96 148 106 142 104 C136 98 132 88 130 78 Z"
                  fill={`url(#${getMuscleGradientId('deltoides_ant')})`}
                  stroke={selectedMuscleId === 'deltoides_ant' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                {/* Fibres deltoïdiennes droite */}
                <path d="M136 74 C142 84 142 92 140 98" stroke="#ffffff18" strokeWidth="1" fill="none" />
              </MuscleRegion>

              {/* PECTORAUX (GRAND PECTORAL) */}
              <MuscleRegion
                id="pectoraux"
                label="Pectoraux"
                effectiveSets={muscleLoads['pectoraux']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'pectoraux'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('pectoraux')}
              >
                {/* Pec gauche avec courbe claviculaire et sternale */}
                <path
                  d="M72 68 C80 66 96 66 98 76 C99 92 98 108 88 112 C74 114 66 104 64 90 C64 80 68 72 72 68 Z"
                  fill={`url(#${getMuscleGradientId('pectoraux')})`}
                  stroke={selectedMuscleId === 'pectoraux' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                {/* Striation pectoral gauche */}
                <path d="M96 82 C86 86 76 90 68 88" stroke="#ffffff18" strokeWidth="1" fill="none" />
                <path d="M96 94 C86 98 78 100 72 98" stroke="#ffffff18" strokeWidth="1" fill="none" />

                {/* Pec droit */}
                <path
                  d="M128 68 C120 66 104 66 102 76 C101 92 102 108 112 112 C126 114 134 104 136 90 C136 80 132 72 128 68 Z"
                  fill={`url(#${getMuscleGradientId('pectoraux')})`}
                  stroke={selectedMuscleId === 'pectoraux' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                {/* Striation pectoral droit */}
                <path d="M104 82 C114 86 124 90 132 88" stroke="#ffffff18" strokeWidth="1" fill="none" />
                <path d="M104 94 C114 98 122 100 128 98" stroke="#ffffff18" strokeWidth="1" fill="none" />

                {/* Sillon sterno-pectoral */}
                <line x1="100" y1="68" x2="100" y2="114" stroke="#00000050" strokeWidth="1.3" />
              </MuscleRegion>

              {/* BICEPS & FLÉCHISSEURS (BRAS & AVANT-BRAS) */}
              <MuscleRegion
                id="biceps"
                label="Biceps et avant-bras"
                effectiveSets={muscleLoads['biceps']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'biceps'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('biceps')}
              >
                {/* Biceps gauche */}
                <path
                  d="M48 98 C42 104 38 118 40 134 C44 142 52 142 56 134 C60 124 60 110 56 98 Z"
                  fill={`url(#${getMuscleGradientId('biceps')})`}
                  stroke={selectedMuscleId === 'biceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.4"
                />
                {/* Crête bicipitale gauche */}
                <path d="M48 108 C46 118 46 128 50 134" stroke="#ffffff15" strokeWidth="1" fill="none" />

                {/* Biceps droit */}
                <path
                  d="M152 98 C158 104 162 118 160 134 C156 142 148 142 144 134 C140 124 140 110 144 98 Z"
                  fill={`url(#${getMuscleGradientId('biceps')})`}
                  stroke={selectedMuscleId === 'biceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.4"
                />
                <path d="M152 108 C154 118 154 128 150 134" stroke="#ffffff15" strokeWidth="1" fill="none" />

                {/* Avant-bras / Brachioradialis gauche */}
                <path
                  d="M40 138 C34 146 30 166 32 188 C34 196 42 196 46 190 C50 180 52 158 50 140 Z"
                  fill={`url(#${getMuscleGradientId('biceps')})`}
                  stroke={selectedMuscleId === 'biceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                  opacity="0.9"
                />
                {/* Avant-bras / Brachioradialis droit */}
                <path
                  d="M160 138 C166 146 170 166 168 188 C166 196 158 196 154 190 C150 180 148 158 150 140 Z"
                  fill={`url(#${getMuscleGradientId('biceps')})`}
                  stroke={selectedMuscleId === 'biceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                  opacity="0.9"
                />
              </MuscleRegion>

              {/* SANGLE ABDOMINALE & CORE (RECTUS ABDOMINIS + OBLIQUES) */}
              <MuscleRegion
                id="abdos"
                label="Sangle abdominale et gainage"
                effectiveSets={muscleLoads['abdos']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'abdos'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('abdos')}
              >
                {/* Abdos gauche (3 segments) */}
                <path
                  d="M78 116 L98 116 L98 174 C92 178 84 176 78 170 C74 160 74 136 78 116 Z"
                  fill={`url(#${getMuscleGradientId('abdos')})`}
                  stroke={selectedMuscleId === 'abdos' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.3"
                />
                {/* Abdos droit (3 segments) */}
                <path
                  d="M122 116 L102 116 L102 174 C108 178 116 176 122 170 C126 160 126 136 122 116 Z"
                  fill={`url(#${getMuscleGradientId('abdos')})`}
                  stroke={selectedMuscleId === 'abdos' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.3"
                />
                {/* Intersections tendineuses (Tablettes) */}
                <line x1="78" y1="134" x2="122" y2="134" stroke="#00000045" strokeWidth="1.2" />
                <line x1="78" y1="152" x2="122" y2="152" stroke="#00000045" strokeWidth="1.2" />
                <line x1="100" y1="116" x2="100" y2="174" stroke="#00000050" strokeWidth="1.2" />

                {/* Reflets subtils tablettes */}
                <ellipse cx="88" cy="125" rx="5" ry="3" fill="#ffffff10" />
                <ellipse cx="112" cy="125" rx="5" ry="3" fill="#ffffff10" />
                <ellipse cx="88" cy="143" rx="5" ry="3" fill="#ffffff10" />
                <ellipse cx="112" cy="143" rx="5" ry="3" fill="#ffffff10" />

                {/* Obliques externes gauche (V-taper) */}
                <path
                  d="M68 126 C64 140 64 160 72 176 L76 174 C72 160 72 138 74 126 Z"
                  fill={`url(#${getMuscleGradientId('abdos')})`}
                  opacity="0.85"
                />
                {/* Obliques externes droit */}
                <path
                  d="M132 126 C136 140 136 160 128 176 L124 174 C128 160 128 138 126 126 Z"
                  fill={`url(#${getMuscleGradientId('abdos')})`}
                  opacity="0.85"
                />
              </MuscleRegion>

              {/* BASSIN & CRÊTE ILIAQUE (NEUTRE) */}
              <path
                d="M74 176 C84 184 116 184 126 176 L124 196 C114 204 86 204 76 196 Z"
                fill="#111827"
                stroke="#1f2937"
                strokeWidth="1.2"
              />

              {/* QUADRICEPS (RECTUS FEMORIS + VASTUS LATERALIS + VASTUS MEDIALIS) */}
              <MuscleRegion
                id="quadriceps"
                label="Quadriceps"
                effectiveSets={muscleLoads['quadriceps']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'quadriceps'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('quadriceps')}
              >
                {/* Cuisses gauche (Galbe externe + vaste interne) */}
                <path
                  d="M72 198 C62 216 58 248 64 288 C68 300 86 300 90 290 C96 266 96 230 94 200 Z"
                  fill={`url(#${getMuscleGradientId('quadriceps')})`}
                  stroke={selectedMuscleId === 'quadriceps' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                {/* Ligne de séparation musculaire vaste externe & droit fémoral */}
                <path d="M78 214 C74 238 74 264 78 284" stroke="#ffffff18" strokeWidth="1" fill="none" />
                {/* Goutte d'eau vaste interne (Vastus Medialis) */}
                <path d="M86 260 C88 272 88 284 84 290" stroke="#ffffff18" strokeWidth="1" fill="none" />

                {/* Cuisses droite */}
                <path
                  d="M128 198 C138 216 142 248 136 288 C132 300 114 300 110 290 C104 266 104 230 106 200 Z"
                  fill={`url(#${getMuscleGradientId('quadriceps')})`}
                  stroke={selectedMuscleId === 'quadriceps' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                <path d="M122 214 C126 238 126 264 122 284" stroke="#ffffff18" strokeWidth="1" fill="none" />
                <path d="M114 260 C112 272 112 284 116 290" stroke="#ffffff18" strokeWidth="1" fill="none" />

                {/* Rotules anatomiques (Genoux neutres) */}
                <ellipse cx="77" cy="302" rx="6" ry="5" fill="#111827" stroke="#334155" strokeWidth="1" />
                <ellipse cx="123" cy="302" rx="6" ry="5" fill="#111827" stroke="#334155" strokeWidth="1" />
              </MuscleRegion>

              {/* MOLLETS & TIBIAS (FACE) */}
              <MuscleRegion
                id="mollets"
                label="Mollets antérieurs"
                effectiveSets={muscleLoads['mollets']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'mollets'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('mollets')}
              >
                {/* Mollet antérieur gauche */}
                <path
                  d="M70 312 C60 328 60 358 70 392 C74 396 82 396 86 390 C90 366 90 336 84 312 Z"
                  fill={`url(#${getMuscleGradientId('mollets')})`}
                  stroke={selectedMuscleId === 'mollets' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.4"
                />
                <line x1="77" y1="324" x2="77" y2="384" stroke="#ffffff15" strokeWidth="1" />

                {/* Mollet antérieur droit */}
                <path
                  d="M130 312 C140 328 140 358 130 392 C126 396 118 396 114 390 C110 366 110 336 116 312 Z"
                  fill={`url(#${getMuscleGradientId('mollets')})`}
                  stroke={selectedMuscleId === 'mollets' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.4"
                />
                <line x1="123" y1="324" x2="123" y2="384" stroke="#ffffff15" strokeWidth="1" />
              </MuscleRegion>

              {/* BADGES NUMÉRIQUES FLOTTANTS DE SÉRIES SUR LE MANNEQUIN FACE */}
              {renderBadge('deltoides_ant', 44, 76)}
              {renderBadge('pectoraux', 100, 88)}
              {renderBadge('biceps', 42, 126)}
              {renderBadge('abdos', 100, 144)}
              {renderBadge('quadriceps', 78, 252)}
              {renderBadge('mollets', 76, 354)}
            </svg>
          </div>
        )}

        {/* --- MANNEQUIN VUE DE DOS (POSTÉRIEUR) --- */}
        {(viewMode === 'both' || viewMode === 'back') && (
          <div className="flex flex-col items-center animate-fadeIn">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400 mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Dos (Postérieur)
            </span>

            <svg
              viewBox="0 0 200 420"
              className="w-36 sm:w-48 h-[340px] select-none transition-all drop-shadow-xl overflow-visible cursor-pointer"
            >
              {/* Silhouette osseuse et neutre de fond dos */}
              <g fill="#0b1120" stroke="#1e293b" strokeWidth="1.5" opacity="0.8">
                {/* Tête dos */}
                <path d="M100 14 C112 14 117 22 117 34 C117 44 110 52 100 52 C90 52 83 44 83 34 C83 22 88 14 100 14 Z" />
                {/* Mains */}
                <path d="M26 198 C22 202 22 214 26 218 C30 220 34 216 34 208 C34 200 30 196 26 198 Z" />
                <path d="M174 198 C178 202 178 214 174 218 C170 220 166 216 166 208 C166 200 170 196 174 198 Z" />
                {/* Talons */}
                <path d="M72 396 L82 396 L86 412 L68 412 Z" />
                <path d="M128 396 L118 396 L114 412 L132 412 Z" />
              </g>

              {/* TRAPÈZES & HAUT DU DOS (GRAND LOSANGE ANATOMIQUE C1-T12) */}
              <MuscleRegion
                id="trapezes"
                label="Trapèzes et haut du dos"
                effectiveSets={muscleLoads['trapezes']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'trapezes'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('trapezes')}
              >
                {/* Losange dorsal complet */}
                <path
                  d="M93 48 L107 48 L126 66 L100 120 L74 66 Z"
                  fill={`url(#${getMuscleGradientId('trapezes')})`}
                  stroke={selectedMuscleId === 'trapezes' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                {/* Colonne vertébrale thoracique & fibres trapézoïdales */}
                <line x1="100" y1="52" x2="100" y2="120" stroke="#00000045" strokeWidth="1.2" />
                <path d="M100 68 L80 66" stroke="#ffffff15" strokeWidth="1" />
                <path d="M100 68 L120 66" stroke="#ffffff15" strokeWidth="1" />
                <path d="M100 90 L88 78" stroke="#ffffff15" strokeWidth="1" />
                <path d="M100 90 L112 78" stroke="#ffffff15" strokeWidth="1" />
              </MuscleRegion>

              {/* DELTOÏDES POSTÉRIEURS (ARRIÈRE D'ÉPAULE) */}
              <MuscleRegion
                id="deltoides_post"
                label="Deltoïdes postérieurs"
                effectiveSets={muscleLoads['deltoides_post']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'deltoides_post'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('deltoides_post')}
              >
                {/* Deltoïde post gauche */}
                <path
                  d="M74 66 C64 68 48 76 46 90 C46 98 52 102 56 100 C62 92 68 82 72 72 Z"
                  fill={`url(#${getMuscleGradientId('deltoides_post')})`}
                  stroke={selectedMuscleId === 'deltoides_post' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.4"
                />
                {/* Deltoïde post droit */}
                <path
                  d="M126 66 C136 68 152 76 154 90 C154 98 148 102 144 100 C138 92 132 82 128 72 Z"
                  fill={`url(#${getMuscleGradientId('deltoides_post')})`}
                  stroke={selectedMuscleId === 'deltoides_post' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.4"
                />
              </MuscleRegion>

              {/* TRICEPS BRACHII (FER À CHEVAL POSTÉRIEUR) */}
              <MuscleRegion
                id="triceps"
                label="Triceps"
                effectiveSets={muscleLoads['triceps']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'triceps'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('triceps')}
              >
                {/* Triceps gauche */}
                <path
                  d="M48 96 C42 106 38 124 40 138 C44 144 54 144 58 136 C60 124 58 110 54 96 Z"
                  fill={`url(#${getMuscleGradientId('triceps')})`}
                  stroke={selectedMuscleId === 'triceps' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                {/* Fer à cheval tendon tricipital */}
                <path d="M48 116 C48 126 50 134 52 138" stroke="#ffffff15" strokeWidth="1" fill="none" />

                {/* Triceps droit */}
                <path
                  d="M152 96 C158 106 162 124 160 138 C156 144 146 144 142 136 C140 124 142 110 146 96 Z"
                  fill={`url(#${getMuscleGradientId('triceps')})`}
                  stroke={selectedMuscleId === 'triceps' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                <path d="M152 116 C152 126 150 134 148 138" stroke="#ffffff15" strokeWidth="1" fill="none" />

                {/* Avant-bras dos gauche */}
                <path
                  d="M40 140 C34 150 30 170 32 188 C36 196 44 196 48 188 C50 176 52 156 50 140 Z"
                  fill={`url(#${getMuscleGradientId('triceps')})`}
                  stroke={selectedMuscleId === 'triceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                  opacity="0.85"
                />
                {/* Avant-bras dos droit */}
                <path
                  d="M160 140 C166 150 170 170 168 188 C164 196 156 196 152 188 C150 176 148 156 150 140 Z"
                  fill={`url(#${getMuscleGradientId('triceps')})`}
                  stroke={selectedMuscleId === 'triceps' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.2"
                  opacity="0.85"
                />
              </MuscleRegion>

              {/* GRAND DORSAL (LATISSIMUS DORSI - LARGEUR DOS) */}
              <MuscleRegion
                id="dorsaux"
                label="Dorsaux et grand dorsal"
                effectiveSets={muscleLoads['dorsaux']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'dorsaux'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('dorsaux')}
              >
                {/* Dorsal gauche (V-taper) */}
                <path
                  d="M72 74 C62 90 60 118 66 146 C72 156 84 156 94 150 L98 122 L74 72 Z"
                  fill={`url(#${getMuscleGradientId('dorsaux')})`}
                  stroke={selectedMuscleId === 'dorsaux' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                {/* Lignes de balayage dorsal */}
                <path d="M72 98 C78 114 86 128 92 136" stroke="#ffffff18" strokeWidth="1" fill="none" />

                {/* Dorsal droit */}
                <path
                  d="M128 74 C138 90 140 118 134 146 C128 156 116 156 106 150 L102 122 L126 72 Z"
                  fill={`url(#${getMuscleGradientId('dorsaux')})`}
                  stroke={selectedMuscleId === 'dorsaux' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                <path d="M128 98 C122 114 114 128 108 136" stroke="#ffffff18" strokeWidth="1" fill="none" />
              </MuscleRegion>

              {/* LOMBAIRES / ÉRECTEURS DU RACHIS (BAS DU DOS) */}
              <MuscleRegion
                id="lombaires"
                label="Lombaires et bas du dos"
                effectiveSets={muscleLoads['lombaires']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'lombaires'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('lombaires')}
              >
                {/* Colonne lombaire gauche */}
                <path
                  d="M86 148 L98 148 L98 184 L80 184 C78 170 80 156 86 148 Z"
                  fill={`url(#${getMuscleGradientId('lombaires')})`}
                  stroke={selectedMuscleId === 'lombaires' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.3"
                />
                {/* Colonne lombaire droite */}
                <path
                  d="M114 148 L102 148 L102 184 L120 184 C122 170 120 156 114 148 Z"
                  fill={`url(#${getMuscleGradientId('lombaires')})`}
                  stroke={selectedMuscleId === 'lombaires' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.3"
                />
                <line x1="100" y1="146" x2="100" y2="184" stroke="#00000050" strokeWidth="1.2" />
              </MuscleRegion>

              {/* FESSIERS (GLUTEUS MAXIMUS) */}
              <MuscleRegion
                id="glutes"
                label="Fessiers"
                effectiveSets={muscleLoads['glutes']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'glutes'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('glutes')}
              >
                {/* Fessier gauche avec courbe athlétique */}
                <path
                  d="M74 184 C62 192 58 214 66 234 C72 244 90 244 98 234 L98 184 Z"
                  fill={`url(#${getMuscleGradientId('glutes')})`}
                  stroke={selectedMuscleId === 'glutes' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                {/* Galbe fessier gauche */}
                <path d="M72 202 C74 216 82 226 92 230" stroke="#ffffff18" strokeWidth="1" fill="none" />

                {/* Fessier droit */}
                <path
                  d="M126 184 C138 192 142 214 134 234 C128 244 110 244 102 234 L102 184 Z"
                  fill={`url(#${getMuscleGradientId('glutes')})`}
                  stroke={selectedMuscleId === 'glutes' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                <path d="M128 202 C126 216 118 226 108 230" stroke="#ffffff18" strokeWidth="1" fill="none" />

                {/* Sillon interfessier */}
                <line x1="100" y1="184" x2="100" y2="236" stroke="#00000050" strokeWidth="1.4" />
              </MuscleRegion>

              {/* ISCHIO-JAMBIERS (BICEPS FEMORIS & SEMITENDINOSUS) */}
              <MuscleRegion
                id="ischios"
                label="Ischio-jambiers"
                effectiveSets={muscleLoads['ischios']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'ischios'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('ischios')}
              >
                {/* Ischios gauche */}
                <path
                  d="M68 238 C64 252 62 278 70 298 C76 304 88 304 92 296 C96 274 96 252 96 238 Z"
                  fill={`url(#${getMuscleGradientId('ischios')})`}
                  stroke={selectedMuscleId === 'ischios' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                {/* Séparation chefs ischios gauche */}
                <line x1="82" y1="246" x2="82" y2="292" stroke="#ffffff18" strokeWidth="1" />

                {/* Ischios droit */}
                <path
                  d="M132 238 C136 252 138 278 130 298 C124 304 112 304 108 296 C104 274 104 252 104 238 Z"
                  fill={`url(#${getMuscleGradientId('ischios')})`}
                  stroke={selectedMuscleId === 'ischios' ? '#38bdf8' : '#ffffff25'}
                  strokeWidth="1.5"
                />
                <line x1="118" y1="246" x2="118" y2="292" stroke="#ffffff18" strokeWidth="1" />

                {/* Creux poplité neutre dos */}
                <ellipse cx="78" cy="304" rx="5" ry="4" fill="#111827" stroke="#334155" strokeWidth="1" />
                <ellipse cx="122" cy="304" rx="5" ry="4" fill="#111827" stroke="#334155" strokeWidth="1" />
              </MuscleRegion>

              {/* MOLLETS POSTÉRIEURS (GASTROCNÉMIEN JUMEAUX & SOLÉAIRE) */}
              <MuscleRegion
                id="mollets"
                label="Mollets postérieurs"
                effectiveSets={muscleLoads['mollets']?.effectiveSets || 0}
                isSelected={selectedMuscleId === 'mollets'}
                onSelect={handleMuscleClick}
                onHover={setHoveredMuscle}
                glowFilter={getMuscleGlow('mollets')}
              >
                {/* Mollet dos gauche (double chef) */}
                <path
                  d="M70 312 C58 326 56 354 66 388 C72 396 82 396 86 388 C92 360 92 334 86 312 Z"
                  fill={`url(#${getMuscleGradientId('mollets')})`}
                  stroke={selectedMuscleId === 'mollets' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                {/* Cœur gastrocnémien gauche */}
                <path d="M78 322 C74 336 74 350 78 360" stroke="#ffffff18" strokeWidth="1" fill="none" />

                {/* Mollet dos droit */}
                <path
                  d="M130 312 C142 326 144 354 134 388 C128 396 118 396 114 388 C108 360 108 334 114 312 Z"
                  fill={`url(#${getMuscleGradientId('mollets')})`}
                  stroke={selectedMuscleId === 'mollets' ? '#38bdf8' : '#ffffff20'}
                  strokeWidth="1.5"
                />
                <path d="M122 322 C126 336 126 350 122 360" stroke="#ffffff18" strokeWidth="1" fill="none" />

                {/* Tendons d'Achille */}
                <line x1="78" y1="384" x2="78" y2="400" stroke="#ffffff18" strokeWidth="1.5" />
                <line x1="122" y1="384" x2="122" y2="400" stroke="#ffffff18" strokeWidth="1.5" />
              </MuscleRegion>

              {/* BADGES NUMÉRIQUES FLOTTANTS DE SÉRIES SUR LE MANNEQUIN DOS */}
              {renderBadge('trapezes', 100, 78)}
              {renderBadge('deltoides_post', 52, 84)}
              {renderBadge('triceps', 44, 116)}
              {renderBadge('dorsaux', 68, 132)}
              {renderBadge('lombaires', 100, 166)}
              {renderBadge('glutes', 100, 214)}
              {renderBadge('ischios', 80, 268)}
              {renderBadge('mollets', 76, 354)}
            </svg>
          </div>
        )}
      </div>

      {/* PANNEAU D'INSPECTION DÉTAILLÉ DE LA ZONE SÉLECTIONNÉE AVEC ÉQUILIBRE ANTAGONISTE */}
      <div className="mt-3 p-3 sm:p-4 rounded-xl bg-black/70 border border-white/10 min-h-[70px] flex items-center justify-between transition-all shadow-inner">
        {inspectedData ? (
          <div className="flex flex-col w-full gap-3 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-2.5">
              
              {/* Nom & Catégorie */}
              <div className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full shrink-0 shadow-md ring-2 ring-white/20 animate-pulse"
                  style={{ backgroundColor: getMuscleStatusColor(inspectedData.id) }}
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm sm:text-base text-white">
                      {inspectedData.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-white/10 text-slate-300 font-semibold">
                      {inspectedData.categoryLabel}
                    </span>
                    {selectedMuscleId === inspectedData.id && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        FILTRÉ DANS LE DASHBOARD
                      </span>
                    )}
                  </div>
                  
                  {/* Exercices associés */}
                  {inspectedData.data.exercises && inspectedData.data.exercises.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <Activity size={11} className="text-blue-400" />
                        Exercices :
                      </span>
                      {inspectedData.data.exercises.slice(0, 4).map((ex, i) => (
                        <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-200 border border-white/5">
                          {ex.exerciseName || ex.name} ({ex.sets}s)
                        </span>
                      ))}
                      {inspectedData.data.exercises.length > 4 && (
                        <span className="text-[9px] text-slate-500 font-mono">
                          +{inspectedData.data.exercises.length - 4} autres
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                      Aucun exercice direct enregistré sur cette semaine
                    </span>
                  )}
                </div>
              </div>

              {/* Volume & Statut */}
              <div className="flex items-center gap-3 self-end sm:self-center">
                <div className="text-right font-mono">
                  <div className="text-base sm:text-lg font-black text-white tracking-tight">
                    {inspectedData.data.effectiveSets || 0} <span className="text-xs font-normal text-slate-400">séries</span>
                  </div>
                  <div className="text-[10px] font-bold">
                    {(() => {
                      const sets = inspectedData.data.effectiveSets || 0;
                      if (sets === 0) {
                        return <span className="text-slate-600">0s : Inactif</span>;
                      }
                      const landmark = getVolumeLandmark(sets);
                      return (
                        <span className={`${landmark.textColor} flex items-center gap-1 justify-end`}>
                          {landmark.status === 'mav' && <Check size={11} />}
                          {landmark.status === 'mrv' && <ShieldAlert size={11} />}
                          {landmark.status === 'mev' && <Zap size={11} />}
                          {landmark.status === 'under' && <span>🛡️</span>}
                          {landmark.shortLabel}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Bouton Filtrer / Isoler ce muscle */}
                {onSelectMuscle && (
                  <button
                    type="button"
                    aria-pressed={selectedMuscleId === inspectedData.id}
                    aria-label={selectedMuscleId === inspectedData.id ? `Désactiver le filtre pour ${inspectedData.name}` : `Filtrer le tableau pour ${inspectedData.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMuscleClick(inspectedData.id);
                    }}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      selectedMuscleId === inspectedData.id
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30'
                        : 'bg-white/10 hover:bg-white/15 text-white border-white/20'
                    }`}
                  >
                    <span>{selectedMuscleId === inspectedData.id ? 'Filtre actif' : 'Filtrer'}</span>
                    {selectedMuscleId === inspectedData.id ? <X size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                  </button>
                )}
              </div>
            </div>

            {/* BARRE DE PROGRESSION MAV ET DIAGNOSTIC ANTAGONISTE ARTICULAIRE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
              
              {/* Jauge de Progression vers le Volume Optimal (MAV 10-20 séries) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Target size={12} className="text-emerald-400" />
                    Cible Adaptative (MAV) :
                  </span>
                  <span className="font-bold text-slate-200">
                    {inspectedData.data.effectiveSets}/20 séries
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 p-0.5 border border-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      getVolumeLandmark(inspectedData.data.effectiveSets || 0).status === 'mrv'
                        ? 'bg-amber-500 shadow-sm shadow-amber-500/50'
                        : getVolumeLandmark(inspectedData.data.effectiveSets || 0).status === 'mav'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50'
                        : getVolumeLandmark(inspectedData.data.effectiveSets || 0).status === 'mev'
                        ? 'bg-sky-500'
                        : 'bg-slate-600'
                    }`}
                    style={{ width: `${Math.min(100, (inspectedData.data.effectiveSets / 20) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Équilibre Biologique Antagoniste */}
              {antagonistInfo && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-medium">
                      {antagonistInfo.label} :
                    </span>
                    <span className="text-slate-200 font-mono text-[10px]">
                      {inspectedData.name} ({inspectedData.data.effectiveSets}s) vs {antagonistInfo.partnerName} ({antagonistInfo.partnerSets}s)
                    </span>
                  </div>
                  {antagonistInfo.isBalanced !== null && (
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                      antagonistInfo.isBalanced 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {antagonistInfo.isBalanced ? '✓ Équilibré' : '⚠️ Déséquilibre'}
                    </span>
                  )}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex items-center justify-between w-full text-slate-400 text-xs py-1">
            <span className="italic flex items-center gap-2">
              <Info size={14} className="text-blue-400 shrink-0" />
              Touchez ou survolez un muscle pour afficher son stimulus, jauge MAV et balance articulaire.
            </span>
            <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
              {totalMuscleCount} groupes musculaires • Sciences du sport (Schoenfeld / Israetel)
            </span>
          </div>
        )}
      </div>

    </div>
  );
};
