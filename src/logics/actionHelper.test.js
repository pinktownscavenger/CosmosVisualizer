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

    expect(summary).toEqual({ nodes: 4, edges: 9 });
    expect(dispatch.mock.calls[0][0]).toEqual({
      type: ACTIONS.SET_OPERATION_DIAGNOSTICS,
      payload: diagnostics
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.ADD_QUERY_HISTORY,
      payload: 'g.V()'
    });
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
        payload: 'Cosmos graph query failed. Cosmos or the graph proxy failed while running the traversal. Retry, or check the proxy logs for connection details.'
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
});
