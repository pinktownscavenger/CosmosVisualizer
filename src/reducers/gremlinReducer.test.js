import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../constants';
import { reducer } from './gremlinReducer';

describe('gremlin reducer', () => {
  it('stores and clears operation diagnostics independently', () => {
    const diagnostics = { operation: 'query', requestCharge: { total: 4.2, requests: [] } };
    const withDiagnostics = reducer(undefined, {
      type: ACTIONS.SET_OPERATION_DIAGNOSTICS,
      payload: diagnostics
    });

    expect(withDiagnostics.latestDiagnostics).toEqual(diagnostics);
    expect(reducer(withDiagnostics, {
      type: ACTIONS.CLEAR_OPERATION_DIAGNOSTICS
    })).toMatchObject({
      query: '',
      latestDiagnostics: null
    });
  });

  it('tracks query execution status and clears stale errors when a run starts', () => {
    const errorState = reducer(undefined, {
      type: ACTIONS.SET_ERROR,
      payload: 'Server unavailable'
    });

    const runningState = reducer(errorState, {
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'running', message: 'Executing Gremlin traversal...' }
    });

    expect(runningState).toMatchObject({
      error: null,
      queryStatus: 'running',
      queryStatusMessage: 'Executing Gremlin traversal...'
    });
  });

  it('stores success status messages after a query completes', () => {
    expect(reducer(undefined, {
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'success', message: 'Added 4 nodes and 3 edges.' }
    })).toMatchObject({
      queryStatus: 'success',
      queryStatusMessage: 'Added 4 nodes and 3 edges.'
    });
  });

  it('stores empty-result status messages after a query returns no vertices', () => {
    expect(reducer(undefined, {
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'empty', message: 'Query ran, but Cosmos returned no vertices for this traversal.' }
    })).toMatchObject({
      queryStatus: 'empty',
      queryStatusMessage: 'Query ran, but Cosmos returned no vertices for this traversal.'
    });
  });

  it('keeps a structured error and mirrors its message to the status line', () => {
    const error = { message: 'Query needs an edit. Fix it.', action: 'edit-query', actionLabel: 'Edit query' };
    const state = reducer(undefined, { type: ACTIONS.SET_ERROR, payload: error });

    expect(state.error).toEqual(error);
    expect(state.queryStatus).toBe('error');
    expect(state.queryStatusMessage).toBe('Query needs an edit. Fix it.');
  });

  it('moves to an error status when an error is set', () => {
    expect(reducer(undefined, {
      type: ACTIONS.SET_ERROR,
      payload: 'Enter a Gremlin query before executing.'
    })).toMatchObject({
      error: { message: 'Enter a Gremlin query before executing.' },
      queryStatus: 'error',
      queryStatusMessage: 'Enter a Gremlin query before executing.'
    });
  });

  it('returns a finished or failed status to idle when the query is edited', () => {
    const done = reducer(undefined, { type: ACTIONS.SET_QUERY_STATUS, payload: { status: 'success', message: '5 nodes, 5 edges · 2 new' } });
    const edited = reducer(done, { type: ACTIONS.SET_QUERY, payload: 'g.V().limit(2)' });
    expect(edited.queryStatus).toBe('idle');
    expect(edited.queryStatusMessage).toBe('5 nodes, 5 edges · 2 new');

    const running = reducer(undefined, { type: ACTIONS.SET_QUERY_STATUS, payload: { status: 'running', message: 'Executing Gremlin traversal...' } });
    expect(reducer(running, { type: ACTIONS.SET_QUERY, payload: 'g.V()' }).queryStatus).toBe('running');
  });

  it('tallies priced, unpriced and failed-but-charged operations for the session', () => {
    let state = reducer(undefined, { type: '@@INIT' });
    expect(state.session).toEqual({ total: 0, operations: 0, unpricedOperations: 0 });

    state = reducer(state, { type: ACTIONS.SET_OPERATION_DIAGNOSTICS, payload: { operation: 'query', requestCharge: { total: 3.75 } } });
    state = reducer(state, { type: ACTIONS.SET_OPERATION_DIAGNOSTICS, payload: { operation: 'query', requestCharge: null } });
    state = reducer(state, { type: ACTIONS.SET_OPERATION_DIAGNOSTICS, payload: { operation: 'traverse-in', requestCharge: { total: 0.75 } } });

    expect(state.session).toEqual({ total: 4.5, operations: 3, unpricedOperations: 1 });
  });

  it('resets the session on demand and after a successful switch, but not after a failed one', () => {
    const charged = reducer(undefined, { type: ACTIONS.SET_OPERATION_DIAGNOSTICS, payload: { requestCharge: { total: 2 } } });
    const zero = { total: 0, operations: 0, unpricedOperations: 0 };

    expect(reducer(charged, { type: ACTIONS.RESET_SESSION_CHARGE }).session).toEqual(zero);
    expect(reducer(charged, { type: ACTIONS.SWITCH_CONNECTION_SUCCESS, payload: {} }).session).toEqual(zero);
    expect(reducer(charged, { type: ACTIONS.SWITCH_CONNECTION_FAILURE, payload: {} }).session.total).toBe(2);
  });
});
