import { describe, it, expect } from 'vitest';
import { parseMoney, findMoney } from '../money';

describe('parseMoney', () => {
  it('lee el formato espanol con coma decimal', () => {
    expect(parseMoney('2,50')).toBe(2.5);
    expect(parseMoney('12,00')).toBe(12);
  });

  it('lee el formato anglosajon con punto decimal', () => {
    expect(parseMoney('2.50')).toBe(2.5);
  });

  it('distingue millares de decimales por la posicion del separador', () => {
    expect(parseMoney('1.234,56')).toBe(1234.56);
    expect(parseMoney('1,234.56')).toBe(1234.56);
  });

  it('ignora el simbolo de moneda y los espacios', () => {
    expect(parseMoney('2,50 €')).toBe(2.5);
    expect(parseMoney('2,50EUR')).toBe(2.5);
    expect(parseMoney(' 2 , 50 ')).toBe(2.5);
  });

  it('conserva los negativos de los descuentos', () => {
    expect(parseMoney('-1,20')).toBe(-1.2);
  });

  it('devuelve null cuando no hay nada legible', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
  });
});

describe('findMoney', () => {
  it('no confunde una cantidad suelta con un precio', () => {
    // "2" no lleva decimales, asi que no es un importe. Esta regla es la que
    // sostiene todo el parser.
    const found = findMoney('2 CERVEZA 2,50 5,00');
    expect(found.map((m) => m.value)).toEqual([2.5, 5]);
  });

  it('devuelve los importes en orden con su posicion', () => {
    const found = findMoney('CAFE 1,20');
    expect(found).toHaveLength(1);
    expect(found[0]!.value).toBe(1.2);
    expect(found[0]!.index).toBe(5);
  });

  it('no trocea un numero de mas de dos decimales', () => {
    expect(findMoney('REF 1234,5678')).toHaveLength(0);
  });
});
