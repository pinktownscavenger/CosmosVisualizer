import { describe, expect, it } from 'vitest';
import {
  NOT_RETURNED,
  assignSlots,
  getColorKey,
  getLegendRows,
  getNodeStyle,
  styleNodes
} from './nodeColors';

const node = (id, type, partitionValue) => ({
  id,
  type,
  partition: partitionValue === undefined ? undefined : { name: 'type', value: partitionValue }
});

describe('colour keys', () => {
  it('keys by vertex label in type mode', () => {
    expect(getColorKey(node('a', 'person', 'p1'), 'type')).toBe('person');
  });

  it('keys by partition value as a string in partition mode', () => {
    expect(getColorKey(node('a', 'company', 1843), 'partition')).toBe('1843');
    expect(getColorKey(node('b', 'flag', true), 'partition')).toBe('true');
  });

  it('uses the reserved key when the partition value is missing', () => {
    expect(getColorKey(node('a', 'person', null), 'partition')).toBe(NOT_RETURNED);
    expect(getColorKey(node('b', 'person'), 'partition')).toBe(NOT_RETURNED);
  });
});

describe('slot assignment', () => {
  it('gives the first three keys hues in order and the rest Other', () => {
    expect(assignSlots({}, ['a', 'b', 'c', 'd'])).toEqual({ a: 0, b: 1, c: 2, d: 'other' });
  });

  it('keeps existing slots stable and skips keys already assigned', () => {
    const existing = { b: 0 };
    expect(assignSlots(existing, ['a', 'b'])).toEqual({ b: 0, a: 1 });
    expect(existing).toEqual({ b: 0 });
  });

  it('never gives the not-returned key a slot', () => {
    expect(assignSlots({}, [NOT_RETURNED, 'a'])).toEqual({ a: 0 });
  });
});

describe('node styles', () => {
  it('styles hue slots with a lighter border and a white highlight border', () => {
    expect(getNodeStyle(0)).toEqual({
      color: {
        background: '#3987e5',
        border: '#86b6ef',
        highlight: { background: '#3987e5', border: '#f8fafc' },
        hover: { background: '#3987e5', border: '#f8fafc' }
      },
      shapeProperties: { borderDashes: false }
    });
    expect(getNodeStyle(1).color.background).toBe('#d95926');
    expect(getNodeStyle(2).color.border).toBe('#7fd1b2');
  });

  it('styles Other as neutral slate', () => {
    expect(getNodeStyle('other').color.background).toBe('#94a3b8');
    expect(getNodeStyle('other').color.border).toBe('#cbd5e1');
  });

  it('draws not-returned nodes hollow and dashed', () => {
    expect(getNodeStyle(NOT_RETURNED)).toEqual({
      color: {
        background: '#0b1120',
        border: '#94a3b8',
        highlight: { background: '#0b1120', border: '#f8fafc' },
        hover: { background: '#0b1120', border: '#f8fafc' }
      },
      shapeProperties: { borderDashes: [4, 3] }
    });
  });

  it('styles nodes and returns assignments for the active mode only', () => {
    const assignments = { type: { tag: 0 }, partition: {} };
    const result = styleNodes([node('a', 'person', 'x'), node('b', 'tag', 'y')], 'type', assignments);

    expect(result.colorAssignments).toEqual({ type: { tag: 0, person: 1 }, partition: {} });
    expect(result.nodes[0].color.background).toBe('#d95926');
    expect(result.nodes[1].color.background).toBe('#3987e5');
    expect(result.nodes[0].id).toBe('a');
  });
});

describe('legend rows', () => {
  it('orders rows by slot, then Other, then not returned', () => {
    const nodes = [
      node('a', 'person', 'p'), node('b', 'person', 'p'), node('c', 'company', null),
      node('d', 'project', 'q'), node('e', 'tag', 'r'), node('f', 'dataset', 's')
    ];
    const typeRows = getLegendRows(nodes, 'type', { person: 0, company: 1, project: 2, tag: 'other', dataset: 'other' });

    expect(typeRows).toEqual([
      { key: 'person', label: 'person', slot: 0, count: 2 },
      { key: 'company', label: 'company', slot: 1, count: 1 },
      { key: 'project', label: 'project', slot: 2, count: 1 },
      { key: 'other', label: 'Other (2 keys)', slot: 'other', count: 2, keys: ['tag', 'dataset'] }
    ]);

    const partitionRows = getLegendRows(nodes, 'partition', { p: 0 , q: 1, r: 2, s: 'other' });
    expect(partitionRows[partitionRows.length - 1]).toEqual({ key: NOT_RETURNED, label: 'partition not returned', slot: NOT_RETURNED, count: 1 });
  });

  it('returns no rows for an empty graph', () => {
    expect(getLegendRows([], 'type', {})).toEqual([]);
  });
});
