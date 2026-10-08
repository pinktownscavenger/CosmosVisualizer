import { describe, expect, it } from 'vitest';
import { getMessageLine } from './messageLine';

const base = {
  gremlin: {
    query: '',
    error: null,
    queryStatus: 'idle',
    queryStatusMessage: 'Ready to explore the graph.'
  },
  connection: {
    status: 'connected',
    connection: { mode: 'fixture', partitionKey: 'type' },
    error: null
  }
};

describe('message line', () => {
  it('prefers a query error and carries its recovery action', () => {
    const line = getMessageLine({
      ...base,
      gremlin: {
        ...base.gremlin,
        query: "g.V().in('x')",
        error: { message: 'Query needs an edit. Fix it.', action: 'edit-query', actionLabel: 'Edit query' }
      },
      connection: { ...base.connection, error: 'Probe failed' }
    });

    expect(line).toEqual({
      tone: 'error',
      text: 'Query needs an edit. Fix it.',
      action: 'edit-query',
      actionLabel: 'Edit query'
    });
  });

  it('shows a query error without an action when none applies', () => {
    expect(getMessageLine({
      ...base,
      gremlin: { ...base.gremlin, error: { message: 'Enter a Gremlin query before executing.' } }
    })).toEqual({ tone: 'error', text: 'Enter a Gremlin query before executing.' });
  });

  it('shows a connection error with a switch action when there is no query error', () => {
    expect(getMessageLine({ ...base, connection: { ...base.connection, error: 'Probe failed' } })).toEqual({
      tone: 'error',
      text: 'Connection: Probe failed',
      action: 'switch-connection',
      actionLabel: 'Switch connection'
    });
  });

  it('shows the first advisory with a +N more suffix and every advisory in the tooltip', () => {
    const line = getMessageLine({ ...base, gremlin: { ...base.gremlin, query: "g.V().in('x').both()" } });

    expect(line.tone).toBe('advisory');
    expect(line.text).toMatch(/^This traversal starts with g\.V\(\)/);
    expect(line.text).toMatch(/ \+2 more$/);
    expect(line.tooltip.split('\n')).toHaveLength(3);
  });

  it('shows a single advisory without a suffix or tooltip', () => {
    const line = getMessageLine({ ...base, gremlin: { ...base.gremlin, query: 'g.V().limit(25)' } });

    expect(line).toEqual({
      tone: 'advisory',
      text: 'This traversal starts with g.V() without an early type partition predicate and may scan multiple partitions.'
    });
  });

  it('shows no advisories while disconnected', () => {
    expect(getMessageLine({
      ...base,
      gremlin: { ...base.gremlin, query: 'g.V().limit(25)' },
      connection: { status: 'disconnected', connection: null, error: null }
    })).toEqual({ tone: 'idle', text: 'Ready to explore the graph.' });
  });

  it('falls back to the status message with the status as its tone', () => {
    expect(getMessageLine({
      ...base,
      gremlin: { ...base.gremlin, queryStatus: 'success', queryStatusMessage: '5 nodes, 5 edges · 2 new' }
    })).toEqual({ tone: 'success', text: '5 nodes, 5 edges · 2 new' });
  });

  it.each(['running', 'success', 'empty'])('shows a fresh %s result ahead of the advisory', (queryStatus) => {
    expect(getMessageLine({
      ...base,
      gremlin: { ...base.gremlin, query: 'g.V().limit(25)', queryStatus, queryStatusMessage: '5 nodes, 5 edges · 2 new' }
    })).toEqual({ tone: queryStatus, text: '5 nodes, 5 edges · 2 new' });
  });
});
