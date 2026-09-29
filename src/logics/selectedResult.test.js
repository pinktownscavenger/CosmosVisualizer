import { describe, expect, it } from 'vitest';
import { getSelectedResultPayload } from './selectedResult';

describe('selected result utilities', () => {
  it('returns a normalized node payload for a selected node', () => {
    const selectedNode = {
      id: 'person-1',
      type: 'person',
      partition: { name: 'type', value: 'person' },
      properties: { name: 'Ada Lovelace' }
    };

    expect(getSelectedResultPayload(selectedNode, {})).toEqual({
      kind: 'node',
      id: 'person-1',
      type: 'person',
      partition: { name: 'type', value: 'person' },
      properties: { name: 'Ada Lovelace' }
    });
  });

  it('returns a normalized edge payload for a selected edge', () => {
    const selectedEdge = {
      id: 'edge-1',
      type: 'created',
      properties: { since: 1843 }
    };

    expect(getSelectedResultPayload({}, selectedEdge)).toEqual({
      kind: 'edge',
      id: 'edge-1',
      type: 'created',
      properties: { since: 1843 }
    });
  });

  it('prefers the selected node when node and edge are both populated', () => {
    const selectedNode = {
      id: 'person-1',
      type: 'person',
      partition: { name: 'type', value: null },
      properties: { name: 'Ada Lovelace' }
    };
    const selectedEdge = {
      id: 'edge-1',
      type: 'created',
      properties: { since: 1843 }
    };

    expect(getSelectedResultPayload(selectedNode, selectedEdge)).toEqual({
      kind: 'node',
      id: 'person-1',
      type: 'person',
      partition: { name: 'type', value: null },
      properties: { name: 'Ada Lovelace' }
    });
  });

  it('returns null when no result is selected', () => {
    expect(getSelectedResultPayload({}, {})).toBeNull();
    expect(getSelectedResultPayload(null, undefined)).toBeNull();
  });

  it('defaults missing properties to an empty object', () => {
    expect(getSelectedResultPayload({ id: 'person-1', type: 'person' }, {})).toEqual({
      kind: 'node',
      id: 'person-1',
      type: 'person',
      partition: undefined,
      properties: {}
    });
  });

  it('preserves an explicitly missing partition value without inferring it', () => {
    expect(getSelectedResultPayload({
      id: 'person-1',
      type: 'person',
      partition: { name: 'type', value: null },
      properties: {}
    }, {})).toMatchObject({
      partition: { name: 'type', value: null }
    });
  });
});
