import { describe, expect, it, vi } from 'vitest';
import { ACTIONS } from '../constants';
import { onFetchQuery, onGraphRequestFailure } from './actionHelper';
import { normalizedGraph } from '../__fixtures__/graphFixtures';

describe('query action helper', () => {
  it('dispatches graph updates and returns a result summary for status copy', () => {
    const dispatch = vi.fn();
    const diagnostics = { operation: 'query', requestCharge: { total: 4.2, requests: [] } };

    const summary = onFetchQuery(
      { data: normalizedGraph, diagnostics },
      'g.V()',
      [],
      dispatch
    );

    expect(summary).toEqual({ nodes: 4, edges: 5, newNodes: 4, newEdges: 5 });
    expect(dispatch.mock.calls[0][0]).toEqual({
      type: ACTIONS.SET_OPERATION_DIAGNOSTICS,
      payload: diagnostics
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.ADD_QUERY_HISTORY,
      payload: 'g.V()'
    });
  });

  it('counts edges after de-duplication and new items against the current graph', () => {
    const summary = onFetchQuery(
      { data: normalizedGraph },
      'g.V()',
      [],
      vi.fn(),
      { nodes: [{ id: 'person-1' }, { id: 'company-1' }], edges: [{ id: 'edge-1' }] }
    );

    expect(summary).toEqual({ nodes: 4, edges: 5, newNodes: 2, newEdges: 4 });
  });

  it('preserves selected-node traversal strings in query history', () => {
    const dispatch = vi.fn();

    onFetchQuery(
      { data: [], diagnostics: { operation: 'traverse-in' } },
      "g.V('person-1').in()",
      [],
      dispatch
    );

    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.ADD_QUERY_HISTORY,
      payload: "g.V('person-1').in()"
    });
  });

  it('dispatches failure diagnostics before safe error feedback', () => {
    const dispatch = vi.fn();
    const diagnostics = { operation: 'query', requestCharge: { total: 3.1, requests: [] } };

    const feedback = onGraphRequestFailure({
      kind: 'server',
      code: 'COSMOS_QUERY_FAILED',
      diagnostics
    }, dispatch);

    expect(feedback.title).toBe('Cosmos graph query failed');
    expect(dispatch.mock.calls).toEqual([
      [{ type: ACTIONS.SET_OPERATION_DIAGNOSTICS, payload: diagnostics }],
      [{
        type: ACTIONS.SET_ERROR,
        payload: {
          message: 'Cosmos graph query failed. Cosmos or the graph proxy failed while running the traversal. Retry, or check the proxy logs for connection details.',
          action: 'retry',
          actionLabel: 'Retry'
        }
      }]
    ]);
  });

  it('leaves prior diagnostics untouched for transport failures', () => {
    const dispatch = vi.fn();

    onGraphRequestFailure({ kind: 'network' }, dispatch);

    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({
      type: ACTIONS.SET_OPERATION_DIAGNOSTICS
    }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: ACTIONS.SET_ERROR
    }));
  });

  it('styles new nodes with the active colour mode before adding them', () => {
    const dispatch = vi.fn();

    onFetchQuery({ data: normalizedGraph }, 'g.V()', [], dispatch, {
      nodes: [], edges: [], colorMode: 'partition', colorAssignments: { type: {}, partition: {} }
    });

    const types = dispatch.mock.calls.map(([action]) => action.type);
    expect(types.indexOf(ACTIONS.SET_COLOR_ASSIGNMENTS)).toBeLessThan(types.indexOf(ACTIONS.ADD_NODES));
    const assignments = dispatch.mock.calls.find(([action]) => action.type === ACTIONS.SET_COLOR_ASSIGNMENTS)[0].payload;
    expect(Object.keys(assignments.partition).length).toBeGreaterThan(0);
    expect(assignments.type).toEqual({});
    const added = dispatch.mock.calls.find(([action]) => action.type === ACTIONS.ADD_NODES)[0].payload;
    expect(added.every(node => node.color && node.shapeProperties)).toBe(true);
  });
});
