import { describe, it, expect } from 'vitest';
import { parseDate, compareDates, yearOf, isDateMarker } from '../src/lib/dates.js';

describe('parseDate', () => {
  it('reads ISO and partial dates', () => {
    expect(parseDate('1843-05-12')).toMatchObject({ sort: 18430512, precision: 'day', qual: 'exact' });
    expect(parseDate('1843-05')).toMatchObject({ sort: 18430500, precision: 'month' });
    expect(parseDate('1843')).toMatchObject({ sort: 18430000, precision: 'year' });
  });
  it('reads Swedish forms', () => {
    expect(parseDate('12 maj 1843')).toMatchObject({ sort: 18430512, precision: 'day' });
    expect(parseDate('12/5 1843')).toMatchObject({ sort: 18430512 });
    expect(parseDate('okt. 1843')).toMatchObject({ sort: 18431000, precision: 'month' });
  });
  it('keeps qualifiers and the original text', () => {
    expect(parseDate('ca 1843')).toMatchObject({ qual: 'about', precision: 'year', label: 'ca 1843' });
    expect(parseDate('c:a 1843').qual).toBe('about');
    expect(parseDate('före 1850')).toMatchObject({ qual: 'before', to: 18500000 });
    expect(parseDate('efter 1850').qual).toBe('after');
  });
  it('reads spans', () => {
    expect(parseDate('mellan 1840 och 1845')).toMatchObject({ qual: 'between', from: 18400000, to: 18450000, precision: 'span' });
    expect(parseDate('1840–45')).toMatchObject({ from: 18400000, to: 18450000 });
    expect(parseDate('1840-45')).toMatchObject({ from: 18400000, to: 18450000 });
    expect(parseDate('1840-1845').qual).toBe('between');
  });
  it('rejects what is not a date', () => {
    for (const x of ['B1-C03', 'EXP', '', null, 'okänt', '1843-13-01x']) expect(parseDate(x)).toBeNull();
    expect(isDateMarker('B1-C03')).toBe(false);
    expect(isDateMarker('1843')).toBe(true);
  });
});

describe('ordering', () => {
  it('orders by real time with qualifiers around their anchor', () => {
    const xs = ['efter 1850', '1850-03-02', 'före 1850', '1843', '1843-05-12', 'ca 1843', 'mellan 1840 och 1845'];
    expect([...xs].sort(compareDates)).toEqual(['mellan 1840 och 1845', '1843', 'ca 1843', '1843-05-12', 'före 1850', 'efter 1850', '1850-03-02']);
    expect(yearOf(parseDate('12 maj 1843'))).toBe(1843);
    expect(yearOf(parseDate('före 1850'))).toBe(1850);
  });
});

describe('compareDateClaims', async () => {
  const { compareDateClaims } = await import('../src/lib/dates.js');
  it('tells refinements from conflicts', () => {
    expect(compareDateClaims('ca 1812', '1812-06-24')).toBe('refines');
    expect(compareDateClaims('1867-11-02', '1867')).toBe('coarser');
    expect(compareDateClaims('1867', '1867-11-02')).toBe('refines');
    expect(compareDateClaims('före 1850', '1843')).toBe('refines');
    expect(compareDateClaims('1843-05-12', 'midsommardagen 1844')).toBe(null);
    expect(compareDateClaims('1843-05-12', '1844-06-24')).toBe('conflict');
    expect(compareDateClaims('ca 1840', '1843')).toBe('refines');
    expect(compareDateClaims('ca 1840', '1846')).toBe('conflict');
    expect(compareDateClaims('1840–45', '1843')).toBe('refines');
  });
});
