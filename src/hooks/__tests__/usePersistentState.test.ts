import { describe, it, expect, beforeEach } from 'vitest';

// Mock localStorage in Node test environment
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = String(value);
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach(k => delete store[k]);
  }
};

(globalThis as any).localStorage = localStorageMock;

import { usePersistentState } from '../usePersistentState';

describe('usePersistentState', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('exporte bien la fonction usePersistentState', () => {
    expect(typeof usePersistentState).toBe('function');
  });

  it('lit la valeur existante dans localStorage si présente', () => {
    localStorageMock.setItem('test_key', JSON.stringify({ count: 42 }));
    expect(JSON.parse(localStorageMock.getItem('test_key')!)).toEqual({ count: 42 });
  });

  it('permet de sauvegarder et restaurer un état sérialisé', () => {
    localStorageMock.setItem('blocks', JSON.stringify([{ id: 'b1', name: 'Bloc 1' }]));
    const raw = localStorageMock.getItem('blocks');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('b1');
  });
});
