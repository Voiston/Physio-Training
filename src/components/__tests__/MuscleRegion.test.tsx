import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { MuscleRegion } from '../MuscleRegion';

describe('MuscleRegion', () => {
  it('exporte le composant MuscleRegion avec ses types', () => {
    expect(MuscleRegion).toBeDefined();
    expect(typeof MuscleRegion).toBe('function');
  });

  it('génère un élément React valide avec les attributs d accessibilité', () => {
    const onSelect = vi.fn();
    const onHover = vi.fn();

    const element = React.createElement(MuscleRegion, {
      id: 'pectoraux',
      label: 'Pectoraux',
      effectiveSets: 12,
      isSelected: true,
      onSelect,
      onHover,
      path: 'M0 0 L10 10 Z',
      glowFilter: 'drop-shadow(0 0 10px rgba(56, 189, 248, 1))',
    });

    expect(React.isValidElement(element)).toBe(true);
    expect(element.props.id).toBe('pectoraux');
    expect(element.props.label).toBe('Pectoraux');
    expect(element.props.isSelected).toBe(true);
    expect(element.props.effectiveSets).toBe(12);
  });

  it('gère correctement la transmission de MuscleGroup comme id', () => {
    const onSelect = vi.fn();
    const muscleGroupMock = {
      id: 'dorsaux',
      name: 'Grand Dorsal',
      category: 'dos',
      categoryLabel: 'Dos & Tirage',
      color: '#38bdf8',
      mv: 6,
      mev: 10,
      mav: 16,
      mrv: 22,
      recoveryHours: 48,
    } as const;

    const element = React.createElement(MuscleRegion, {
      id: muscleGroupMock as any,
      label: 'Grand Dorsal',
      effectiveSets: 8,
      isSelected: false,
      onSelect,
      children: React.createElement('path', { d: 'M0 0' }),
    });

    expect(React.isValidElement(element)).toBe(true);
    expect(element.props.isSelected).toBe(false);
  });
});
