import { describe, expect, it } from 'vitest';
import {
  getQueryFailureFeedback,
  getQueryResultStatus,
  isQueryTooLong
} from './queryFeedback';

describe('query feedback', () => {
  it('maps validation failures to editable query feedback', () => {
    expect(getQueryFailureFeedback({ kind: 'validation', status: 400 })).toMatchObject({
      status: 'error',
      title: 'Query needs an edit',
      message: 'Cosmos DB for Gremlin rejected the traversal before it ran.',
      actionLabel: 'Edit query'
    });
  });

  it('maps server failures to Cosmos connection recovery feedback', () => {
    expect(getQueryFailureFeedback({ kind: 'server', status: 500 })).toMatchObject({
      status: 'error',
      title: 'Cosmos graph query failed',
      actionLabel: 'Retry'
    });
  });

  it('maps network failures to proxy recovery feedback', () => {
    expect(getQueryFailureFeedback({ kind: 'network' })).toMatchObject({
      status: 'error',
      title: 'Cannot reach the Cosmos proxy',
      actionLabel: 'Check server'
    });
  });

  it('maps operation conflicts to wait-and-retry feedback', () => {
    expect(getQueryFailureFeedback({ code: 'OPERATION_IN_PROGRESS', status: 409 })).toMatchObject({
      title: 'Another Cosmos operation is running',
      actionLabel: 'Wait and retry'
    });
  });

  it('maps disconnected responses to connection feedback', () => {
    expect(getQueryFailureFeedback({ code: 'NO_ACTIVE_CONNECTION', status: 503 })).toMatchObject({
      title: 'Connect to Cosmos DB',
      actionLabel: 'Switch connection'
    });
  });

  it('returns an empty state for successful queries with no graph data', () => {
    expect(getQueryResultStatus({ nodes: 0, edges: 0 })).toMatchObject({
      status: 'empty',
      message: 'Query ran, but Cosmos returned no vertices for this traversal.'
    });
  });

  it.each([
    [{ status: 409 }, 'wait-and-retry'],
    [{ code: 'NO_ACTIVE_CONNECTION' }, 'switch-connection'],
    [{ status: 400 }, 'edit-query'],
    [{ status: 413 }, 'reduce-query'],
    [{ kind: 'network' }, 'check-server'],
    [{ status: 500 }, 'retry'],
    [{}, 'retry']
  ])('maps %o to recovery action %s', (error, action) => {
    expect(getQueryFailureFeedback(error).action).toBe(action);
  });

  it('labels every recovery action with fixed copy', () => {
    expect(getQueryFailureFeedback({ status: 413 }).actionLabel).toBe('Reduce query');
    expect(getQueryFailureFeedback({}).actionLabel).toBe('Retry');
  });

  it('reports unique and new counts in the success status', () => {
    expect(getQueryResultStatus({ nodes: 5, edges: 5, newNodes: 2, newEdges: 0 })).toEqual({
      status: 'success',
      message: '5 nodes, 5 edges · 2 new'
    });
    expect(getQueryResultStatus({ nodes: 1, edges: 1, newNodes: 0, newEdges: 0 }).message)
      .toBe('1 node, 1 edge · nothing new');
  });

  it('detects queries longer than the shared server limit', () => {
    expect(isQueryTooLong('g'.repeat(10000))).toBe(false);
    expect(isQueryTooLong('g'.repeat(10001))).toBe(true);
  });
});
