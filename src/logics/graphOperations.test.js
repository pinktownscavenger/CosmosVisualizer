import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIONS, EMPTY_GREMLIN_QUERY_ERROR, TOO_LONG_GREMLIN_QUERY_ERROR } from '../constants';
import { executeQuery, executeTraversal } from '../api/gremlinApi';
import { getLastSubmittedQuery, retryLastOperation, runQuery, runTraversal } from './graphOperations';
import { normalizedGraph } from '../__fixtures__/graphFixtures';

vi.mock('../api/gremlinApi', () => ({
  executeQuery: vi.fn(),
  executeTraversal: vi.fn()
}));

const emptyGraph = { nodes: [], edges: [] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runQuery', () => {
  it('publishes running then a completion status', async () => {
    const dispatch = vi.fn();
    executeQuery.mockResolvedValue({ data: normalizedGraph });

    await runQuery({ query: 'g.V().limit(25)', nodeLimit: 100, nodeLabels: [], current: emptyGraph, dispatch });

    expect(executeQuery).toHaveBeenCalledWith({ query: 'g.V().limit(25)', nodeLimit: 100 });
    expect(dispatch.mock.calls[0][0]).toEqual({
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'running', message: 'Executing Gremlin traversal...' }
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'success', message: '4 nodes, 5 edges · 9 new' }
    });
  });

  it('trims the query and remembers it for retry', async () => {
    executeQuery.mockResolvedValue({ data: [] });

    await runQuery({ query: '  g.V()  ', nodeLimit: 10, nodeLabels: [], current: emptyGraph, dispatch: vi.fn() });

    expect(executeQuery).toHaveBeenCalledWith({ query: 'g.V()', nodeLimit: 10 });
    expect(getLastSubmittedQuery()).toBe('g.V()');
  });

  it('rejects an empty query with an edit-query error and no request', async () => {
    const dispatch = vi.fn();

    await runQuery({ query: '   ', nodeLimit: 100, nodeLabels: [], current: emptyGraph, dispatch });

    expect(executeQuery).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.SET_ERROR,
      payload: { message: EMPTY_GREMLIN_QUERY_ERROR, action: 'edit-query', actionLabel: 'Edit query' }
    });
  });

  it('rejects an over-long query with an edit-query error and no request', async () => {
    const dispatch = vi.fn();

    await runQuery({ query: 'g'.repeat(10001), nodeLimit: 100, nodeLabels: [], current: emptyGraph, dispatch });

    expect(executeQuery).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.SET_ERROR,
      payload: { message: TOO_LONG_GREMLIN_QUERY_ERROR, action: 'edit-query', actionLabel: 'Edit query' }
    });
  });

  it('dispatches failure diagnostics and a structured error without rejecting', async () => {
    const dispatch = vi.fn();
    executeQuery.mockRejectedValue(Object.assign(new Error('unavailable'), {
      kind: 'network',
      diagnostics: { operation: 'query', requestCharge: { total: 0.5 } }
    }));

    await expect(runQuery({ query: 'g.V()', nodeLimit: 100, nodeLabels: [], current: emptyGraph, dispatch }))
      .resolves.toBeUndefined();

    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.SET_OPERATION_DIAGNOSTICS,
      payload: { operation: 'query', requestCharge: { total: 0.5 } }
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.SET_ERROR,
      payload: expect.objectContaining({ action: 'check-server' })
    });
  });
});

describe('runTraversal', () => {
  it('requests connected results without clearing the existing graph', async () => {
    const dispatch = vi.fn();
    executeTraversal.mockResolvedValue({ data: normalizedGraph });

    await runTraversal({ nodeId: "o'brien", direction: 'out', nodeLimit: 100, nodeLabels: [], current: emptyGraph, dispatch });

    expect(dispatch.mock.calls[0][0]).toEqual({
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'running', message: 'Traversing outbound edges...' }
    });
    expect(executeTraversal).toHaveBeenCalledWith({ nodeId: "o'brien", direction: 'out', nodeLimit: 100 });
    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.ADD_QUERY_HISTORY,
      payload: "g.V('o\\'brien').union(identity(), out())"
    });
    expect(dispatch).not.toHaveBeenCalledWith({ type: ACTIONS.CLEAR_GRAPH });
    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.ADD_NODES, payload: expect.any(Array) });
  });

  it.each([
    ['out', 'traverse-out'],
    ['in', 'traverse-in']
  ])('stores %s traversal diagnostics and its synthetic history entry', async (direction, operation) => {
    const dispatch = vi.fn();
    const diagnostics = { operation, requestCharge: { total: 2.5, requests: [{ kind: 'vertices', charge: 2.5 }] } };
    executeTraversal.mockResolvedValue({ data: normalizedGraph, diagnostics });

    await runTraversal({ nodeId: 'person-1', direction, nodeLimit: 100, nodeLabels: [], current: emptyGraph, dispatch });

    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.SET_OPERATION_DIAGNOSTICS, payload: diagnostics });
    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.ADD_QUERY_HISTORY,
      payload: `g.V('person-1').union(identity(), ${direction}())`
    });
  });

  it('dispatches charged failure diagnostics before safe traversal feedback', async () => {
    const dispatch = vi.fn();
    executeTraversal.mockRejectedValue(Object.assign(new Error('raw driver failure'), {
      kind: 'server',
      diagnostics: { operation: 'traverse-in', requestCharge: { total: 0.75 } }
    }));

    await runTraversal({ nodeId: 'person-1', direction: 'in', nodeLimit: 100, nodeLabels: [], current: emptyGraph, dispatch });

    const actions = dispatch.mock.calls.map(call => call[0]);
    const diagnosticsIndex = actions.findIndex(action => action.type === ACTIONS.SET_OPERATION_DIAGNOSTICS);
    const errorIndex = actions.findIndex(action => action.type === ACTIONS.SET_ERROR);
    expect(diagnosticsIndex).toBeGreaterThan(-1);
    expect(errorIndex).toBeGreaterThan(diagnosticsIndex);
    expect(JSON.stringify(actions[errorIndex].payload)).not.toContain('raw driver failure');
  });
});

describe('retryLastOperation', () => {
  it('replays a failed traversal rather than the last query', async () => {
    executeQuery.mockResolvedValue({ data: [] });
    await runQuery({ query: 'g.V().limit(1)', nodeLimit: 100, nodeLabels: [], current: emptyGraph, dispatch: vi.fn() });
    executeTraversal.mockRejectedValue(Object.assign(new Error('boom'), { kind: 'server' }));
    await runTraversal({ nodeId: 'person-1', direction: 'in', nodeLimit: 100, nodeLabels: [], current: emptyGraph, dispatch: vi.fn() });
    executeQuery.mockClear();
    executeTraversal.mockClear();
    executeTraversal.mockResolvedValue({ data: [] });

    await retryLastOperation({ nodeLimit: 50, nodeLabels: [], current: emptyGraph, dispatch: vi.fn() });

    expect(executeTraversal).toHaveBeenCalledWith({ nodeId: 'person-1', direction: 'in', nodeLimit: 50 });
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('replays the last query after a query', async () => {
    executeQuery.mockResolvedValue({ data: [] });
    await runQuery({ query: 'g.V().limit(4)', nodeLimit: 100, nodeLabels: [], current: emptyGraph, dispatch: vi.fn() });
    executeQuery.mockClear();

    await retryLastOperation({ nodeLimit: 100, nodeLabels: [], current: emptyGraph, dispatch: vi.fn() });

    expect(executeQuery).toHaveBeenCalledWith({ query: 'g.V().limit(4)', nodeLimit: 100 });
  });
});
