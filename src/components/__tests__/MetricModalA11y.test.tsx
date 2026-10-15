import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Pour appeler le composant comme une fonction (sans DOM), les hooks React sont
// remplacés par des versions synchrones : useState renvoie la valeur initiale.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: <T,>(init: T | (() => T)) => [typeof init === 'function' ? (init as () => T)() : init, vi.fn()],
    useRef: <T,>(initial: T) => ({ current: initial })
  };
});
vi.mock('../../hooks/useModalA11y', () => ({ useModalA11y: vi.fn() }));

import MetricModal, { type MetricModalInfo } from '../MetricModal';
import { extractDaySessionsForDate } from '../PhysiologyDashboard';
import { useModalA11y } from '../../hooks/useModalA11y';
import type { Quality, EventsByQuality } from '../../types';

type AnyProps = Record<string, unknown> & { children?: ReactNode };

/** Parcourt l'arbre d'éléments hôtes renvoyé par le composant. */
function findAll(node: ReactNode, pred: (el: ReactElement<AnyProps>) => boolean, acc: ReactElement<AnyProps>[] = []) {
  if (Array.isArray(node)) {
    node.forEach(n => findAll(n, pred, acc));
  } else if (node && typeof node === 'object' && 'props' in node) {
    const el = node as ReactElement<AnyProps>;
    if (pred(el)) acc.push(el);
    findAll(el.props.children, pred, acc);
  }
  return acc;
}

const textOf = (node: ReactNode): string =>
  Array.isArray(node) ? node.map(textOf).join('') :
  typeof node === 'string' || typeof node === 'number' ? String(node) :
  node && typeof node === 'object' && 'props' in node ? textOf((node as ReactElement<AnyProps>).props.children) : '';

const baseInfo = (over: Partial<MetricModalInfo> = {}): MetricModalInfo => ({
  type: 'readiness',
  dateStr: '2026-10-15',
  currentValue: 8,
  title: 'Score de Forme (Readiness)',
  label: 'Niveau d énergie au réveil (1 à 10)',
  min: 1,
  max: 10,
  ...over
});

function renderTree(info: MetricModalInfo) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const tree = MetricModal({ info, onClose, onSave });
  return { tree, onSave, onClose };
}

function submit(tree: ReactNode) {
  const [form] = findAll(tree, el => el.type === 'form');
  const preventDefault = vi.fn();
  (form.props.onSubmit as (e: { preventDefault: () => void }) => void)({ preventDefault });
  return preventDefault;
}

beforeEach(() => vi.clearAllMocks());

describe('MetricModal - Accessibilité et useModalA11y (P3-01)', () => {
  it('rend la modale avec les attributs d accessibilité role="dialog" et aria-modal="true"', () => {
    const html = renderToStaticMarkup(<MetricModal info={baseInfo()} onClose={() => {}} onSave={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="metric-modal-title"');
    expect(html).toContain('Score de Forme (Readiness)');
  });

  it('branche useModalA11y sur onClose (Escape / focus trap)', () => {
    const { onClose } = renderTree(baseInfo());
    expect(useModalA11y).toHaveBeenCalledWith(true, onClose, expect.objectContaining({ current: null }));
  });

  it('enregistre la valeur numérique existante et ferme la modale', () => {
    const { tree, onSave, onClose } = renderTree(baseInfo({ currentValue: '8' }));
    expect(submit(tree)).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith(8);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sans saisie (valeur '-'), Valider enregistre null et aucun bouton Effacer n'est proposé", () => {
    const { tree, onSave } = renderTree(baseInfo({ currentValue: '-' }));
    expect(findAll(tree, el => el.type === 'button' && textOf(el.props.children) === 'Effacer')).toHaveLength(0);
    const [input] = findAll(tree, el => el.type === 'input');
    expect(input.props.value).toBe('');
    submit(tree);
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('Effacer enregistre null quand une valeur existe', () => {
    const { tree, onSave, onClose } = renderTree(baseInfo());
    const [clear] = findAll(tree, el => el.type === 'button' && textOf(el.props.children) === 'Effacer');
    (clear.props.onClick as () => void)();
    expect(onSave).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalled();
  });

  it('une valeur non numérique enregistre NaN (non filtrée par la modale, à valider en aval)', () => {
    const { tree, onSave } = renderTree(baseInfo({ currentValue: 'abc' }));
    submit(tree);
    expect(onSave).toHaveBeenCalledWith(Number.NaN);
  });

  it('propose des raccourcis adaptés au type, avec repli FC repos pour un type inconnu', () => {
    const quick = (type: string) =>
      findAll(renderTree(baseInfo({ type })).tree, el => el.type === 'button' && /^\d+$/.test(textOf(el.props.children)))
        .map(el => Number(textOf(el.props.children)));
    expect(quick('readiness')).toEqual([5, 6, 7, 8, 9, 10]);
    expect(quick('vfc')).toEqual([45, 55, 65, 75, 85, 95]);
    expect(quick('inconnu')).toEqual([48, 52, 56, 60, 64, 68]);
  });

  it('transmet min/max absents sans planter (champ non borné)', () => {
    const html = renderToStaticMarkup(
      <MetricModal info={baseInfo({ min: undefined, max: undefined })} onClose={() => {}} onSave={() => {}} />
    );
    expect(html).not.toContain('min=');
    expect(html).not.toContain('max=');
  });
});

describe('PhysiologyDashboard - Fonction pure extractDaySessionsForDate (P3-01)', () => {
  const dummyQualities: Quality[] = [
    { id: 'force_max', name: 'Force Maximale', category: 'force' },
    { id: 'endurance', name: 'Endurance Fondamentale', category: 'cardio' }
  ];

  it('extrait fidèlement les séances primaires et filtre les impacts secondaires ou vides', () => {
    const events: EventsByQuality = {
      force_max: { '2026-10-15': { rpeMusc: 8, duration: 60, load: 480, type: 'primary', notes: 'Séance lourde' } },
      endurance: { '2026-10-15': { rpeCardio: 5, duration: 45, load: 225, isSecondary: true, notes: 'Impact rémanent' } }
    };
    const sessions = extractDaySessionsForDate(events, dummyQualities, '2026-10-15');
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ qualityId: 'force_max', qualityName: 'Force Maximale', load: 480, duration: 60, notes: 'Séance lourde' });
  });

  it('renvoie une liste vide lorsqu aucune séance n existe à la date donnée', () => {
    expect(extractDaySessionsForDate({}, dummyQualities, '2026-10-15')).toEqual([]);
    expect(extractDaySessionsForDate({ force_max: {} }, dummyQualities, 'pas-une-date')).toEqual([]);
  });

  it('ignore les filières nulles et garde une séance de qualité inconnue sous son id', () => {
    const events = {
      force_max: null,
      inconnue: { '2026-10-15': { load: 100, duration: 20 } }
    } as unknown as EventsByQuality;
    const sessions = extractDaySessionsForDate(events, dummyQualities, '2026-10-15');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].qualityId).toBe('inconnue');
  });

  it('accepte une séance historique numérique (RPE brut) avec RPE par défaut si > 10', () => {
    const events = { force_max: { '2026-10-15': 7, '2026-10-16': 400 } } as unknown as EventsByQuality;
    const [rpe] = extractDaySessionsForDate(events, dummyQualities, '2026-10-15');
    expect(rpe.load).toBe(315);
    const [foster] = extractDaySessionsForDate(events, dummyQualities, '2026-10-16');
    expect(foster.load).toBe(400);
  });
});
