import { describe, it, expect, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhysiologicalSettingsModal } from '../PhysiologicalSettingsModal';
import type { EventsByQuality } from '../../types';
import type { PhysiologicalSettings, DailyMetrics } from '../../hooks/useData';

vi.mock('../../hooks/useModalA11y', () => ({ useModalA11y: vi.fn() }));

type ElProps = Record<string, unknown> & { children?: ReactNode };

const base: PhysiologicalSettings = { tauFatigue: 7, tauFitness: 28, profileName: 'Standard', initialCtl: 40 };

const textOf = (node: ReactNode): string =>
  Array.isArray(node) ? node.map(textOf).join('') :
  typeof node === 'string' || typeof node === 'number' ? String(node) :
  node && typeof node === 'object' && 'props' in node ? textOf((node as ReactElement<ElProps>).props.children) : '';

function findButtons(node: ReactNode, label: string, acc: ReactElement<ElProps>[] = []): ReactElement<ElProps>[] {
  if (Array.isArray(node)) node.forEach(n => findButtons(n, label, acc));
  else if (node && typeof node === 'object' && 'props' in node) {
    const el = node as ReactElement<ElProps>;
    if (el.type === 'button' && textOf(el.props.children).includes(label)) acc.push(el);
    findButtons(el.props.children, label, acc);
  }
  return acc;
}

/** Rend la modale en tant qu'élément (hooks exécutés via un rendu serveur jetable) et renvoie son arbre. */
function callModal(settings: PhysiologicalSettings, onSave: (s: PhysiologicalSettings) => void, onClose: () => void): ReactNode {
  let tree: ReactNode = null;
  const Probe = () => {
    tree = PhysiologicalSettingsModal({ settings, onSave, onClose, events: {}, dailyMetrics: {} }) as ReactNode;
    return null;
  };
  renderToStaticMarkup(<Probe />);
  return tree;
}

function clickButton(tree: ReactNode, label: string) {
  const [btn] = findButtons(tree, label);
  expect(btn).toBeDefined();
  (btn.props.onClick as () => void)();
}

function save(settings: PhysiologicalSettings): PhysiologicalSettings {
  const onSave = vi.fn<(s: PhysiologicalSettings) => void>();
  clickButton(callModal(settings, onSave, () => {}), 'Appliquer le Calibrage');
  return onSave.mock.calls[0][0];
}

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

  it('borne initialCtl entre 0 et 250 à l enregistrement (valeur négative ou extrême)', () => {
    expect(save({ ...base, initialCtl: -50 }).initialCtl).toBe(0);
    expect(save({ ...base, initialCtl: 99999 }).initialCtl).toBe(250);
    expect(save({ ...base, initialCtl: 45 }).initialCtl).toBe(45);
    expect(save({ ...base, initialCtl: 0 }).initialCtl).toBe(0);
  });

  it('enregistre initialCtl undefined quand il est absent (mode automatique)', () => {
    expect(save({ tauFatigue: 7, tauFitness: 28, profileName: 'Standard' }).initialCtl).toBeUndefined();
  });

  it('retombe sur 7/28/Standard quand les réglages sont absents, nuls ou à 0', () => {
    const corrupt = { tauFatigue: 0, tauFitness: Number.NaN, profileName: '' } as PhysiologicalSettings;
    expect(save(corrupt)).toEqual({ tauFatigue: 7, tauFitness: 28, profileName: 'Standard', initialCtl: undefined });
  });

  it('Appliquer appelle onSave puis onClose ; Annuler ferme sans enregistrer', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const tree = callModal(base, onSave, onClose);
    clickButton(tree, 'Annuler');
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    clickButton(tree, 'Appliquer le Calibrage');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('rend sans planter avec des événements et métriques corrompus', () => {
    const events = { force_max: { 'pas-une-date': { load: Number.NaN }, '2026-10-15': null } } as unknown as EventsByQuality;
    const dailyMetrics = { 'pas-une-date': { readiness: 'abc' } } as unknown as DailyMetrics;
    const html = renderToStaticMarkup(
      <PhysiologicalSettingsModal onClose={() => {}} settings={base} onSave={() => {}} events={events} dailyMetrics={dailyMetrics} />
    );
    expect(html).toContain('initial-ctl-input');
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
