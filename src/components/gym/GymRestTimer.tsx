import { useState, useEffect, useCallback, memo } from 'react';
import { Timer, Play, Pause } from 'lucide-react';
import { 
  playCountdownBeep, 
  playRestCompleteChime, 
  triggerVibration 
} from '../../utils/audioHelpers';

export interface GymRestTimerState {
  endsAt: number;
  targetSeconds: number;
  label?: string;
  pausedRemainingMs: number | null;
}

export interface GymRestTimerProps {
  timerState: GymRestTimerState;
  soundEnabled: boolean;
  onDone: () => void;
  onAdjust: (deltaSecs: number) => void;
  onTogglePause: () => void;
  onSkip: () => void;
  className?: string;
}

function formatTime(secs: number): string {
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
}

/**
 * Minuteur de repos autonome recalé sur l'horloge système sans dérive.
 * Isole les re-rendus toutes les secondes du reste du modal de musculation.
 */
export const GymRestTimer = memo(function GymRestTimer({
  timerState,
  soundEnabled,
  onDone,
  onAdjust,
  onTogglePause,
  onSkip,
  className = ''
}: GymRestTimerProps) {
  const isPaused = timerState.pausedRemainingMs !== null;

  const calculateRemaining = useCallback(() => {
    if (timerState.pausedRemainingMs !== null) {
      return Math.max(0, Math.ceil(timerState.pausedRemainingMs / 1000));
    }
    return Math.max(0, Math.ceil((timerState.endsAt - Date.now()) / 1000));
  }, [timerState.endsAt, timerState.pausedRemainingMs]);

  const [remainingSecs, setRemainingSecs] = useState<number>(calculateRemaining);

  useEffect(() => {
    if (isPaused) {
      setRemainingSecs(calculateRemaining());
      return;
    }

    let timeoutId: number;
    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.ceil((timerState.endsAt - now) / 1000));
      setRemainingSecs(left);

      if (left <= 0) {
        if (soundEnabled) {
          playRestCompleteChime();
          triggerVibration([200, 100, 200, 100, 400]);
        }
        onDone();
        return;
      }

      if (soundEnabled && left <= 3 && left >= 1) {
        playCountdownBeep(left === 1 ? 660 : 520, 80);
        triggerVibration(40);
      }

      // Recalage précis sur la seconde pour éviter les dérives de throttle
      const msUntilNextSecond = Math.max(30, (timerState.endsAt - now) - (left - 1) * 1000);
      timeoutId = window.setTimeout(tick, msUntilNextSecond);
    };

    tick();
    return () => clearTimeout(timeoutId);
  }, [timerState.endsAt, isPaused, soundEnabled, onDone, calculateRemaining]);

  return (
    <div 
      role="timer"
      aria-label={`Minuteur de repos : ${Math.floor(remainingSecs / 60)} minutes et ${remainingSecs % 60} secondes restantes`}
      className={`bg-gradient-to-r from-blue-900/90 via-indigo-900/90 to-purple-900/90 border-b border-indigo-500/40 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 animate-fadeIn shrink-0 shadow-lg ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/30 border border-indigo-400/50" aria-hidden="true">
          <Timer size={18} className="text-indigo-200 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Repos en cours</span>
            {timerState.label && (
              <span className="text-[11px] text-indigo-300/80 truncate max-w-[150px] sm:max-w-xs">
                {timerState.label}
              </span>
            )}
          </div>
          <div 
            className="font-mono font-black text-xl sm:text-2xl text-white tracking-tight tabular-nums"
            aria-hidden="true"
          >
            {formatTime(remainingSecs)}
          </div>
        </div>
      </div>

      {/* Commandes rapides de repos (+30s, -15s, pause, passer) avec cibles tactiles 44px */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => onAdjust(-15)}
          className="min-h-[44px] px-2.5 sm:px-3 py-1 rounded-xl bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-400/30 text-xs font-bold text-indigo-200 active:scale-95 transition-transform cursor-pointer"
          title="Enlever 15 secondes"
          aria-label="Enlever 15 secondes au minuteur de repos"
        >
          -15s
        </button>
        <button
          type="button"
          onClick={() => onAdjust(30)}
          className="min-h-[44px] px-2.5 sm:px-3 py-1 rounded-xl bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-400/30 text-xs font-bold text-indigo-200 active:scale-95 transition-transform cursor-pointer"
          title="Ajouter 30 secondes"
          aria-label="Ajouter 30 secondes au minuteur de repos"
        >
          +30s
        </button>
        <button
          type="button"
          onClick={onTogglePause}
          className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-400/30 text-indigo-200 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
          title={isPaused ? 'Reprendre le repos' : 'Mettre le repos en pause'}
          aria-label={isPaused ? 'Reprendre le chronomètre de repos' : 'Mettre le chronomètre de repos en pause'}
        >
          {isPaused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="min-h-[44px] px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors active:scale-95 flex items-center justify-center cursor-pointer"
          aria-label="Passer le minuteur de repos et reprendre l'entraînement"
        >
          Passer
        </button>
      </div>
    </div>
  );
});

export default GymRestTimer;
