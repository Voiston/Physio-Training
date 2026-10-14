import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MuscleRegion, type MuscleRegionProps } from '../MuscleRegion';
import type { MuscleGroup } from '../../utils/muscleHelpers';

type GroupProps = React.SVGProps<SVGGElement>;

/** Évalue le composant (sans DOM) et renvoie l'élément <g> racine et ses handlers. */
function renderRoot(props: MuscleRegionProps): GroupProps {
  const root = MuscleRegion(props) as React.ReactElement<GroupProps>;
  return root.props;
}

const baseProps = (over: Partial<MuscleRegionProps> = {}): MuscleRegionProps => ({
  id: 'pectoraux',
  label: 'Pectoraux',
  isSelected: false,
  onSelect: vi.fn(),
  ...over
});

describe('MuscleRegion', () => {
  it('génère un élément React valide avec les attributs d accessibilité', () => {
    const element = React.createElement(MuscleRegion, baseProps({ effectiveSets: 12, isSelected: true, path: 'M0 0 L10 10 Z' }));
    expect(React.isValidElement(element)).toBe(true);

    const html = renderToStaticMarkup(element);
    expect(html).toContain('aria-label="Pectoraux : 12 séries effectives"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('stroke="#38bdf8"');
  });

  it('utilise des valeurs par défaut quand séries, fatigue et remplissage sont absents (undefined)', () => {
    const html = renderToStaticMarkup(
      React.createElement(MuscleRegion, baseProps({ effectiveSets: undefined, fatigueLevel: undefined, path: 'M0 0' }))
    );
    expect(html).toContain('0 séries effectives');
    expect(html).toContain('data-fatigue="0"');
    expect(html).toContain('fill="#1e293b"');
  });

  it('ne rend aucun <path> sans tracé et préfère le dégradé au remplissage par défaut', () => {
    expect(renderToStaticMarkup(React.createElement(MuscleRegion, baseProps()))).not.toContain('<path');
    const html = renderToStaticMarkup(React.createElement(MuscleRegion, baseProps({ path: 'M0 0', gradientId: 'g1' })));
    expect(html).toContain('fill="url(#g1)"');
  });

  it('transmet un MuscleGroup comme id et survole avec son identifiant', () => {
    const group: MuscleGroup = { id: 'dorsaux', name: 'Grand Dorsal', category: 'upper_pull', categoryLabel: 'Dos & Tirage', color: '#38bdf8' };
    const onSelect = vi.fn();
    const onHover = vi.fn();
    const root = renderRoot(baseProps({ id: group, onSelect, onHover }));

    root.onClick?.({} as React.MouseEvent<SVGGElement>);
    expect(onSelect).toHaveBeenCalledWith(group);

    root.onMouseEnter?.({} as React.MouseEvent<SVGGElement>);
    root.onMouseLeave?.({} as React.MouseEvent<SVGGElement>);
    expect(onHover).toHaveBeenNthCalledWith(1, 'dorsaux');
    expect(onHover).toHaveBeenNthCalledWith(2, null);
  });

  it('sélectionne au clavier avec Entrée/Espace uniquement', () => {
    const onSelect = vi.fn();
    const preventDefault = vi.fn();
    const root = renderRoot(baseProps({ onSelect }));
    const key = (k: string) => ({ key: k, preventDefault } as unknown as React.KeyboardEvent<SVGGElement>);

    root.onKeyDown?.(key('a'));
    root.onKeyDown?.(key('Tab'));
    expect(onSelect).not.toHaveBeenCalled();

    root.onKeyDown?.(key('Enter'));
    root.onKeyDown?.(key(' '));
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });

  it('ne plante pas sans callback onHover', () => {
    const root = renderRoot(baseProps({ onHover: undefined }));
    expect(() => root.onFocus?.({} as React.FocusEvent<SVGGElement>)).not.toThrow();
    expect(() => root.onBlur?.({} as React.FocusEvent<SVGGElement>)).not.toThrow();
  });
});
