import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CompetitionModal, buildTargetCompetitionPayload } from '../CompetitionModal';
import { getTsbZone } from '../../utils/zones';
import type { TargetCompetition } from '../../hooks/useData';
import type { TaperingAnalysis, FosterMetrics } from '../../types';

describe('CompetitionModal - Préservation des métadonnées (P2-04)', () => {
  const dummyZone = getTsbZone(18, 65, 47);

  const dummyTapering: TaperingAnalysis = {
    targetCompetition: { name: 'Test', date: '2026-11-20', type: 'course', targetTsb: 18 },
    daysRemaining: 36,
    banister: {
      tauFatigue: 7,
      tauFitness: 28,
      series: [],
      current: {
        dateStr: '2026-10-15', day: 15, month: 10, offset: 0,
        isToday: true, isFuture: false, load: 100, vfc: null, readiness: null,
        atl: 45, ctl: 65, tsb: 18, tsbPercent: 18, acwr: 1.0, acwrUncoupled: 1.0
      },
      todayIndex: 0,
      futureSeries: [],
      peakDay: null,
      historyDays: 28,
      isWarmedUp: true,
      tsbZone: dummyZone
    },
    compDayData: {
      dateStr: '2026-11-20', day: 20, month: 11, offset: 36,
      isToday: false, isFuture: true, load: 0, vfc: null, readiness: null,
      atl: 45, ctl: 65, tsb: 18, tsbPercent: 18, acwr: 0.8, acwrUncoupled: 0.8
    },
    targetTsb: 18,
    targetTsbUnit: 'percent',
    projectedTsb: 18,
    projectedTsbPercent: 18,
    tsbGap: 0,
    tsbZone: dummyZone,
    foster: {
      windowDays: 7,
      dailyLoads: [],
      totalLoad: 2500,
      meanLoad: 357,
      stdDev: 120,
      monotony: 1.2,
      strain: 3000,
      riskLevel: 'OPTIMAL',
      riskBadge: 'Optimal',
      riskColor: 'emerald',
      advice: 'Charge équilibrée'
    },
    futureSessionsCount: 5,
    status: 'TAPER_OPTIMAL',
    statusBadge: 'Affûtage Optimal',
    statusColor: 'emerald',
    advice: 'Maintenir la charge de fond'
  };

  const dummyFoster: FosterMetrics = {
    windowDays: 7,
    dailyLoads: [],
    totalLoad: 2500,
    meanLoad: 357,
    stdDev: 120,
    monotony: 1.2,
    strain: 3000,
    riskLevel: 'OPTIMAL',
    riskBadge: 'Optimal',
    riskColor: 'emerald',
    advice: 'Charge équilibrée'
  };

  it('préserve strictement targetTime et targetTsbUnit lors de la soumission de l objectif', () => {
    const existingComp: TargetCompetition & { customRaceId?: string; distanceKm?: number } = {
      name: 'Marathon de Valence',
      date: '2026-12-01',
      type: 'course',
      targetTsb: 20,
      targetTsbUnit: 'points',
      targetTime: '3h15',
      notes: 'Allure cible 4:37/km',
      customRaceId: 'race_valencia_2026',
      distanceKm: 42.195
    };

    // Modification du nom et des notes sans altérer le chrono
    const payload = buildTargetCompetitionPayload(existingComp, {
      name: 'Marathon de Valence 2026 (Édition Officielle)',
      date: '2026-12-01',
      type: 'course',
      targetTsb: 20,
      targetTime: '3h15',
      notes: 'Allure cible ajustée 4:35/km'
    });

    // 1. targetTime et targetTsbUnit doivent être rigoureusement conservés
    expect(payload.targetTime).toBe('3h15');
    expect(payload.targetTsbUnit).toBe('points');

    // 2. Les propriétés étendues de competition doivent être étalées sans perte
    const extendedPayload = payload as typeof existingComp;
    expect(extendedPayload.customRaceId).toBe('race_valencia_2026');
    expect(extendedPayload.distanceKm).toBe(42.195);

    // 3. Les champs modifiés sont appliqués
    expect(payload.name).toBe('Marathon de Valence 2026 (Édition Officielle)');
    expect(payload.notes).toBe('Allure cible ajustée 4:35/km');
  });

  it('gère gracieusement une nouvelle compétition vierge (competition === null)', () => {
    const payload = buildTargetCompetitionPayload(null, {
      name: 'Trail du Ventoux',
      date: '2026-06-15',
      type: 'trail',
      targetTsb: 15,
      targetTime: '4h45',
      notes: '2000m D+'
    });

    expect(payload.name).toBe('Trail du Ventoux');
    expect(payload.targetTime).toBe('4h45');
    expect(payload.targetTsbUnit).toBe('percent'); // défaut fallback
    expect(payload.targetTsb).toBe(15);
  });

  it('supprime targetTime (undefined) si l utilisateur vide le champ', () => {
    const existingComp: TargetCompetition = {
      name: '10km',
      date: '2026-05-10',
      type: 'course',
      targetTsb: 12,
      targetTime: '39 min'
    };

    const payload = buildTargetCompetitionPayload(existingComp, {
      name: '10km',
      date: '2026-05-10',
      type: 'course',
      targetTsb: 12,
      targetTime: '   ' // vide
    });

    expect(payload.targetTime).toBeUndefined();
  });

  it('affiche le champ de saisie du chrono visé et le préremplit dans le DOM statique', () => {
    const existingComp: TargetCompetition = {
      name: 'Semi de Paris',
      date: '2026-03-08',
      type: 'course',
      targetTsb: 18,
      targetTime: '1h28'
    };

    const element = React.createElement(CompetitionModal, {
      competition: existingComp,
      taperingAnalysis: dummyTapering,
      fosterMetrics: dummyFoster,
      onSave: () => {},
      onClose: () => {}
    });

    const html = renderToStaticMarkup(element);

    expect(html).toContain('Chrono visé (optionnel)');
    expect(html).toContain('id="comp-target-time"');
    expect(html).toContain('value="1h28"');
  });
});
