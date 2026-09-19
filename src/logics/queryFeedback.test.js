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
      actionLabel: 'Retry query'
    });
  });

  it('maps network failures to proxy recovery feedback', () => {
    expect(getQueryFailureFeedback({ kind: 'network' })).toMatchObject({
      status: 'error',
      title: 'Cannot reach the Cosmos proxy',
      actionLabel: 'Check server'
    });
  });

  it('returns an empty state for successful queries with no graph data', () => {
    expect(getQueryResultStatus({ nodes: 0, edges: 0 })).toMatchObject({
      status: 'empty',
      message: 'Query ran, but Cosmos returned no vertices for this traversal.'
    });
  });

  it('detects queries longer than the shared server limit', () => {
    expect(isQueryTooLong('g'.repeat(10000))).toBe(false);
    expect(isQueryTooLong('g'.repeat(10001))).toBe(true);
  });
});
