import React from 'react';
import { MuscleGroup } from '../utils/muscleHelpers';

export interface MuscleRegionProps {
  id: MuscleGroup | string;
  label: string;
  path?: string;
  children?: React.ReactNode;
  fatigueLevel?: number;
  effectiveSets?: number;
  isSelected: boolean;
  onSelect: (id: any) => void;
  onHover?: (id: string | null) => void;
  gradientId?: string;
  glowFilter?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fill?: string;
  className?: string;
}

/**
 * Sous-composant SVG MuscleRegion
 * Factorise les attributs d'accessibilité, d'interaction clavier/touch et de style récurrents
 * pour chaque région anatomique de la cartographie corporelle.
 */
export const MuscleRegion: React.FC<MuscleRegionProps> = ({
  id,
  label,
  path,
  children,
  fatigueLevel = 0,
  effectiveSets = 0,
  isSelected,
  onSelect,
  onHover,
  gradientId,
  glowFilter,
  strokeColor,
  strokeWidth = 1.2,
  fill,
  className = ''
}) => {
  const muscleId = typeof id === 'object' && id !== null ? (id as MuscleGroup).id : String(id);

  const handleClick = () => {
    onSelect(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${label} : ${effectiveSets} séries effectives`}
      aria-pressed={isSelected}
      onMouseEnter={() => onHover?.(muscleId)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(muscleId)}
      onBlur={() => onHover?.(null)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-fatigue={fatigueLevel}
      style={{ filter: glowFilter }}
      className={`transition-all cursor-pointer outline-none focus-visible:stroke-sky-400 focus-visible:stroke-[2.5] ${className}`}
    >
      {path && (
        <path
          d={path}
          fill={fill || (gradientId ? `url(#${gradientId})` : '#1e293b')}
          stroke={isSelected ? '#38bdf8' : (strokeColor || '#ffffff20')}
          strokeWidth={strokeWidth}
        />
      )}
      {children}
    </g>
  );
};

export default MuscleRegion;
