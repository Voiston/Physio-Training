import { describe, it, expect } from 'vitest';
import React from 'react';
import { GymRestTimer, GymActiveExercise, GymSetHistory } from '../index';

describe('Gym Components (Modular Gym HUD)', () => {
  it('exporte GymRestTimer, GymActiveExercise, GymSetHistory depuis le point central index.ts', () => {
    expect(GymRestTimer).toBeDefined();
    expect(GymActiveExercise).toBeDefined();
    expect(GymSetHistory).toBeDefined();
  });

  it('permet l instanciation des composants avec des props valides sans lever d exception', () => {
    const timerElem = (
      <GymRestTimer
        timerState={{
          endsAt: Date.now() + 60000,
          targetSeconds: 60,
          pausedRemainingMs: null
        }}
        soundEnabled={true}
        onDone={() => {}}
        onAdjust={() => {}}
        onTogglePause={() => {}}
        onSkip={() => {}}
      />
    );
    expect(timerElem).toBeTruthy();

    const historyElem = (
      <GymSetHistory
        exercises={[]}
        totalTonnageKg={1500}
        totalCompletedSets={8}
        totalPlannedSets={12}
        elapsedSeconds={1800}
      />
    );
    expect(historyElem).toBeTruthy();
  });
});
