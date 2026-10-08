import { describe, expect, it } from 'vitest';
import { formatPropertyValue, getDisplayProperties } from './propertyFormat';

describe('property formatting', () => {
  it('unwraps single-value Cosmos arrays', () => {
    expect(formatPropertyValue(['CosmosVisualizer'])).toEqual({ kind: 'text', value: 'CosmosVisualizer' });
  });

  it('shows multi-value arrays as chips', () => {
    expect(formatPropertyValue(['graph', 'cosmos'])).toEqual({ kind: 'chips', value: ['graph', 'cosmos'] });
  });

  it('renders objects, including a single wrapped object, as compact JSON', () => {
    expect(formatPropertyValue({ a: 1 })).toEqual({ kind: 'json', value: '{"a":1}' });
    expect(formatPropertyValue([{ a: 1 }])).toEqual({ kind: 'json', value: '{"a":1}' });
  });

  it('stringifies scalars and treats an empty array as empty text', () => {
    expect(formatPropertyValue(true)).toEqual({ kind: 'text', value: 'true' });
    expect(formatPropertyValue(1843)).toEqual({ kind: 'text', value: '1843' });
    expect(formatPropertyValue([])).toEqual({ kind: 'text', value: '' });
    expect(formatPropertyValue(null)).toEqual({ kind: 'text', value: 'null' });
  });

  it('omits the partition-key property and keeps key order', () => {
    expect(getDisplayProperties({ name: ['x'], type: ['project'], status: ['y'] }, 'type').map(([key]) => key))
      .toEqual(['name', 'status']);
    expect(getDisplayProperties({ name: ['x'] }, null)).toEqual([['name', { kind: 'text', value: 'x' }]]);
  });

  it('returns no rows for missing properties', () => {
    expect(getDisplayProperties(undefined, 'type')).toEqual([]);
    expect(getDisplayProperties(null, 'type')).toEqual([]);
  });
});
