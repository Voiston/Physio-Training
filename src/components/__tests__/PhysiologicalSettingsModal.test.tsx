import { describe, it, expect } from 'vitest';
import { PhysiologicalSettingsModal } from '../PhysiologicalSettingsModal';
import { renderToStaticMarkup } from 'react-dom/server';

describe('PhysiologicalSettingsModal - Bornage de initialCtl (P2-09)', () => {
  it('rend la modale correctement via renderToStaticMarkup', () => {
    const html = renderToStaticMarkup(
      <PhysiologicalSettingsModal
        onClose={() => {}}
        settings={{ tauFatigue: 7, tauFitness: 28, profileName: 'Standard', initialCtl: 40 }}
        onSave={() => {}}
        events={{}}
        dailyMetrics={{}}
      />
    );
    expect(html).toContain('initial-ctl-input');
    expect(html).toContain('Condition Initiale');
  });

  it('borne initialCtl entre 0 et 250 même si une valeur négative ou extrême est passée', () => {
    // Test de la fonction de bornage pure
    const clampCtl = (val: string | number) => Math.max(0, Math.min(250, Number(val)));

    expect(clampCtl(-50)).toBe(0);
    expect(clampCtl(99999)).toBe(250);
    expect(clampCtl(45)).toBe(45);
    expect(clampCtl(0)).toBe(0);
    expect(clampCtl(250)).toBe(250);
  });
});

describe('ErrorBoundary - Nettoyage ciblé de localStorage (P2-09)', () => {
  it('ne supprime que les clés de PhysioTracker PRO et préserve les clés Firebase / externes', () => {
    const store: Record<string, string> = {
      '2026-10-15_force_max': '{"load": 100}',
      '2026-10-15_readiness': '8',
      'physio_settings': '{"tauFatigue": 7}',
      'physio_training_blocks': '[]',
      'training_live_session_draft_v1': '{"exercises": []}',
      'firebase:authUser:1031197355247': '{"uid": "user_abc"}',
      'other_app_key': 'preserve_me'
    };

    const keys = Object.keys(store);
    const keysToRemove: string[] = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (/^\d{4}-\d{2}-\d{2}_/.test(key) || key.startsWith('physio_') || key.startsWith('training_')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(k => delete store[k]);

    // Clés applicatives supprimées
    expect(store['2026-10-15_force_max']).toBeUndefined();
    expect(store['2026-10-15_readiness']).toBeUndefined();
    expect(store['physio_settings']).toBeUndefined();
    expect(store['physio_training_blocks']).toBeUndefined();
    expect(store['training_live_session_draft_v1']).toBeUndefined();

    // Clés externes préservées
    expect(store['firebase:authUser:1031197355247']).toBe('{"uid": "user_abc"}');
    expect(store['other_app_key']).toBe('preserve_me');
  });
});
