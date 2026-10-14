import { describe, it, expect } from 'vitest';
import { indexToX, normalize, valueToY, xToNearestIndex } from '../chartMath';

describe('indexToX', () => {
  it('répartit les points de start à start + span', () => {
    expect(indexToX(0, 5, 4, 100)).toBe(4);
    expect(indexToX(4, 5, 4, 100)).toBe(104);
    expect(indexToX(2, 5, 4, 100)).toBe(54);
  });
  it('renvoie start pour une série vide ou à un seul point', () => {
    expect(indexToX(0, 0, 4, 100)).toBe(4);
    expect(indexToX(0, 1, 4, 100)).toBe(4);
  });
  it('renvoie start pour un index NaN', () => {
    expect(indexToX(Number.NaN, 5, 4, 100)).toBe(4);
  });
});

describe('normalize', () => {
  it('ramène la plage à [0, 1]', () => {
    expect(normalize(5, 0, 10)).toBe(0.5);
    expect(normalize(0, 0, 10)).toBe(0);
    expect(normalize(10, 0, 10)).toBe(1);
  });
  it('gère les valeurs négatives et une plage négative', () => {
    expect(normalize(-5, -10, 0)).toBe(0.5);
    expect(normalize(-20, -10, 0)).toBe(-1);
  });
  it('traite une plage nulle comme une plage de 1', () => {
    expect(normalize(3, 3, 3)).toBe(0);
    expect(normalize(0, 0, 0)).toBe(0);
  });
  it('propage NaN', () => {
    expect(normalize(Number.NaN, 0, 10)).toBeNaN();
  });
});

describe('valueToY', () => {
  it('place min en bas et max en haut', () => {
    expect(valueToY(0, 0, 10, 26, 22)).toBe(26);
    expect(valueToY(10, 0, 10, 26, 22)).toBe(4);
  });
  it('reste en bas pour une valeur nulle avec une plage nulle', () => {
    expect(valueToY(0, 0, 0, 26, 22)).toBe(26);
  });
  it('propage NaN au lieu de lever une erreur', () => {
    expect(valueToY(Number.NaN, 0, 10, 26, 22)).toBeNaN();
  });
});

describe('xToNearestIndex', () => {
  it('trouve le point le plus proche', () => {
    expect(xToNearestIndex(54, 5, 4, 100)).toBe(2);
    expect(xToNearestIndex(30, 5, 4, 100)).toBe(1);
  });
  it('borne les abscisses hors du graphique', () => {
    expect(xToNearestIndex(-50, 5, 4, 100)).toBe(0);
    expect(xToNearestIndex(500, 5, 4, 100)).toBe(4);
  });
  it('renvoie 0 pour une série vide, un span nul ou une abscisse NaN', () => {
    expect(xToNearestIndex(10, 0, 4, 100)).toBe(0);
    expect(xToNearestIndex(10, 5, 4, 0)).toBe(0);
    expect(xToNearestIndex(Number.NaN, 5, 4, 100)).toBe(0);
  });
});
