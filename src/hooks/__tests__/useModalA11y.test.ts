import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Environnement Node sans DOM : useEffect est exécuté de façon synchrone et sa
// fonction de nettoyage capturée, pour tester la logique du hook sans renderer.
const effectCleanups: Array<() => void> = [];
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useRef: <T,>(initial: T) => ({ current: initial }),
    useEffect: (effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (typeof cleanup === 'function') effectCleanups.push(cleanup);
    }
  };
});

import { useModalA11y } from '../useModalA11y';

type KeyHandler = (e: KeyboardEvent) => void;

let keyHandlers: KeyHandler[];
let previousFocus: { focus: ReturnType<typeof vi.fn> } | null;

function pressKey(key: string, extra: Partial<KeyboardEvent> = {}) {
  const preventDefault = vi.fn();
  const event = { key, shiftKey: false, preventDefault, ...extra } as unknown as KeyboardEvent;
  keyHandlers.forEach(h => h(event));
  return preventDefault;
}

function containerWith(focusables: Array<{ focus: () => void; offsetParent: object | null }>) {
  return {
    current: {
      focus: vi.fn(),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => focusables)
    } as unknown as HTMLElement
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  keyHandlers = [];
  previousFocus = { focus: vi.fn() };
  vi.stubGlobal('window', {
    addEventListener: (type: string, h: KeyHandler) => { if (type === 'keydown') keyHandlers.push(h); },
    removeEventListener: (_type: string, h: KeyHandler) => { keyHandlers = keyHandlers.filter(x => x !== h); }
  });
  vi.stubGlobal('document', { get activeElement() { return previousFocus; } });
});

afterEach(() => {
  effectCleanups.splice(0).forEach(c => c());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useModalA11y', () => {
  it('ne fait rien quand la modale est fermée', () => {
    const onClose = vi.fn();
    useModalA11y(false, onClose, containerWith([]));
    expect(keyHandlers).toHaveLength(0);
    pressKey('Escape');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ferme sur Escape, ou appelle le gestionnaire personnalisé à la place', () => {
    const onClose = vi.fn();
    useModalA11y(true, onClose, containerWith([]));
    const prevent = pressKey('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(prevent).toHaveBeenCalled();

    effectCleanups.splice(0).forEach(c => c());
    const onEscape = vi.fn();
    useModalA11y(true, onClose, containerWith([]), { onEscape });
    pressKey('Escape');
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignore les autres touches et un Tab sans élément focusable visible', () => {
    const onClose = vi.fn();
    const hidden = { focus: vi.fn(), offsetParent: null };
    useModalA11y(true, onClose, containerWith([hidden]));
    expect(pressKey('a')).not.toHaveBeenCalled();
    expect(pressKey('Tab')).not.toHaveBeenCalled();
    expect(hidden.focus).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('boucle le focus du dernier vers le premier élément sur Tab', () => {
    const first = { focus: vi.fn(), offsetParent: {} };
    const last = { focus: vi.fn(), offsetParent: {} };
    useModalA11y(true, vi.fn(), containerWith([first, last]));
    previousFocus = last;
    expect(pressKey('Tab')).toHaveBeenCalled();
    expect(first.focus).toHaveBeenCalled();
  });

  it('focalise le conteneur quand aucun élément initial n est trouvé, sans erreur si le ref est vide', () => {
    const container = containerWith([]);
    useModalA11y(true, vi.fn(), container);
    vi.advanceTimersByTime(60);
    expect(container.current?.focus).toHaveBeenCalled();

    expect(() => {
      useModalA11y(true, vi.fn(), { current: null });
      vi.advanceTimersByTime(60);
    }).not.toThrow();
  });

  it('retire l écouteur et restaure le focus précédent au nettoyage', () => {
    const before = previousFocus;
    useModalA11y(true, vi.fn(), containerWith([]));
    expect(keyHandlers).toHaveLength(1);
    effectCleanups.splice(0).forEach(c => c());
    expect(keyHandlers).toHaveLength(0);
    expect(before?.focus).toHaveBeenCalled();
  });

  it('ne plante pas au nettoyage si l élément actif précédent était null', () => {
    previousFocus = null;
    useModalA11y(true, vi.fn(), containerWith([]));
    expect(() => effectCleanups.splice(0).forEach(c => c())).not.toThrow();
  });
});
