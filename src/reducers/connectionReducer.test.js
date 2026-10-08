import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../constants';
import { reducer } from './connectionReducer';

const connection = {
  mode: 'cosmos',
  endpointHost: 'account.gremlin.cosmos.azure.com',
  database: 'db',
  container: 'graph',
  partitionKey: 'type'
};

describe('connection reducer', () => {
  it('starts disconnected while initial status is loading', () => {
    expect(reducer(undefined, { type: 'UNKNOWN' })).toEqual({
      status: 'disconnected',
      connection: null,
      loading: true,
      switching: false,
      error: null,
      probeDiagnostics: null,
      dialogOpen: false
    });
  });

  it('tracks load and switch progress independently', () => {
    expect(reducer(undefined, { type: ACTIONS.LOAD_CONNECTION_START })).toMatchObject({
      loading: true,
      switching: false,
      error: null
    });
    expect(reducer(undefined, { type: ACTIONS.SWITCH_CONNECTION_START })).toMatchObject({
      loading: true,
      switching: true,
      error: null
    });
  });

  it('stores only whitelisted sanitized fields on success', () => {
    const state = reducer(undefined, {
      type: ACTIONS.SWITCH_CONNECTION_SUCCESS,
      payload: {
        status: 'connected',
        connection: { ...connection, primaryKey: 'secret-key', unexpected: 'discard-me' },
        diagnostics: { operation: 'connection-probe' },
        primaryKey: 'secret-key'
      }
    });

    expect(state).toEqual({
      status: 'connected',
      connection,
      loading: false,
      switching: false,
      error: null,
      probeDiagnostics: { operation: 'connection-probe' },
      dialogOpen: false
    });
    expect(JSON.stringify(state)).not.toContain('secret-key');
    expect(JSON.stringify(state)).not.toContain('unexpected');
  });

  it('stores safe load and switch failures without discarding active metadata', () => {
    const connected = reducer(undefined, {
      type: ACTIONS.LOAD_CONNECTION_SUCCESS,
      payload: { status: 'connected', connection }
    });
    const failed = reducer(connected, {
      type: ACTIONS.SWITCH_CONNECTION_FAILURE,
      payload: { message: 'Could not connect', diagnostics: { operation: 'connection-probe' } }
    });

    expect(failed).toMatchObject({
      status: 'connected',
      connection,
      switching: false,
      error: 'Could not connect',
      probeDiagnostics: { operation: 'connection-probe' }
    });
  });

  it('clears switch errors and probe diagnostics without changing the connection', () => {
    const state = {
      status: 'connected',
      connection: { mode: 'fixture', partitionKey: 'type' },
      loading: false,
      switching: false,
      error: 'Could not verify the Cosmos DB connection',
      probeDiagnostics: { operation: 'connection-probe' }
    };

    expect(reducer(state, { type: ACTIONS.RESET_CONNECTION_FEEDBACK })).toEqual({
      ...state,
      error: null,
      probeDiagnostics: null
    });
  });

  it('opens and closes the connection dialog', () => {
    const closed = reducer(undefined, { type: '@@INIT' });
    expect(closed.dialogOpen).toBe(false);
    const open = reducer(closed, { type: ACTIONS.OPEN_CONNECTION_DIALOG });
    expect(open.dialogOpen).toBe(true);
    expect(reducer(open, { type: ACTIONS.CLOSE_CONNECTION_DIALOG }).dialogOpen).toBe(false);
  });
});
