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

  it('moves to an error status when an error is set', () => {
    expect(reducer(undefined, {
      type: ACTIONS.SET_ERROR,
      payload: 'Enter a Gremlin query before executing.'
    })).toMatchObject({
      error: 'Enter a Gremlin query before executing.',
      queryStatus: 'error',
      queryStatusMessage: 'Enter a Gremlin query before executing.'
    });
  });
});
