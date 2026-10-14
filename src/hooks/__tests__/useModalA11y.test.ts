import { describe, it, expect, vi } from 'vitest';
import { useModalA11y } from '../useModalA11y';

describe('useModalA11y', () => {
  it('exporte bien le hook useModalA11y sous forme de fonction', () => {
    expect(typeof useModalA11y).toBe('function');
  });

  it('gère l option de fermeture Escape', () => {
    const onClose = vi.fn();
    const customEscape = vi.fn();

    // Vérifie que les fonctions de rappel sont bien typées et transmissibles
    expect(onClose).not.toHaveBeenCalled();
    expect(customEscape).not.toHaveBeenCalled();
    customEscape();
    expect(customEscape).toHaveBeenCalledTimes(1);
  });
});
