import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Header, getRequestChargeParts, getConnectionLabel } from './HeaderComponent';
import { ACTIONS } from '../../constants';
import { executeQuery, getConnection, switchConnection } from '../../api/gremlinApi';

vi.mock('../../api/gremlinApi', () => ({
  executeQuery: vi.fn(),
  getConnection: vi.fn(),
  switchConnection: vi.fn()
}));

const baseProps = {
  dispatch: vi.fn(),
  query: '',
  error: null,
  queryStatus: 'idle',
  queryStatusMessage: 'Ready to explore the graph.',
  nodes: [{ id: 'node-1' }],
  edges: [],
  nodeLabels: [],
  nodeLimit: 100,
  latestDiagnostics: null,
  connectionStatus: 'connected',
  connection: { mode: 'fixture', partitionKey: 'type' },
  connectionLoading: false,
  connectionSwitching: false,
  connectionError: null,
  probeDiagnostics: null
};

describe('header query controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears the graph without clearing query history', () => {
    const dispatch = vi.fn();
    const header = new Header({ ...baseProps, dispatch });

    header.clearGraph();

    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.CLEAR_GRAPH });
    expect(dispatch).not.toHaveBeenCalledWith({ type: ACTIONS.CLEAR_QUERY_HISTORY });
  });

  it('renders Cosmos-specific empty-result status styling', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <Header
        {...baseProps}
        queryStatus="empty"
        queryStatusMessage="Query ran, but Cosmos returned no vertices for this traversal."
      />
    );

    expect(html).toContain('query-status--empty');
    expect(html).toContain('Cosmos returned no vertices');
  });

  it('loads sanitized connection status on mount', async () => {
    const dispatch = vi.fn();
    const payload = { status: 'connected', connection: { mode: 'fixture', partitionKey: 'type' } };
    getConnection.mockResolvedValue(payload);
    const header = new Header({ ...baseProps, dispatch });

    await header.componentDidMount();

    expect(dispatch.mock.calls).toEqual([
      [{ type: ACTIONS.LOAD_CONNECTION_START }],
      [{ type: ACTIONS.LOAD_CONNECTION_SUCCESS, payload }]
    ]);
  });

  it('renders exact fixture, disconnected, and Cosmos labels', () => {
    expect(getConnectionLabel('connected', { mode: 'fixture' })).toBe('Fixture');
    expect(getConnectionLabel('disconnected', null)).toBe('Disconnected');
    expect(getConnectionLabel('connected', {
      mode: 'cosmos',
      endpointHost: 'account.gremlin.cosmos.azure.com',
      database: 'db',
      container: 'graph'
    })).toBe('account.gremlin.cosmos.azure.com / db / graph');
  });

  it('disables graph execution while disconnected, loading, or switching', () => {
    for (const props of [
      { connectionStatus: 'disconnected' },
      { connectionLoading: true },
      { connectionSwitching: true }
    ]) {
      const html = ReactDOMServer.renderToStaticMarkup(<Header {...baseProps} {...props} />);
      expect(html).toMatch(/type="submit"[^>]*disabled=""/);
    }
  });

  it.each([
    ['a graph operation is running', { queryStatus: 'running' }],
    ['initial connection state is loading', { connectionLoading: true }],
    ['a connection switch is active', { connectionSwitching: true }]
  ])('disables switching while %s', (_label, props) => {
    const html = ReactDOMServer.renderToStaticMarkup(<Header {...baseProps} {...props} />);
    const switchButton = html.match(/<button[^>]*connection-control__switch[^>]*>/)[0];

    expect(switchButton).toContain('disabled=""');
  });

  it('disables graph clearing while a graph operation is running', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <Header {...baseProps} queryStatus="running" />
    );
    const clearButton = html.match(/<button[^>]*query-button--clear[^>]*>/)[0];

    expect(clearButton).toContain('disabled=""');
  });

  it('clears graph and graph diagnostics after a successful connection switch without clearing query state', async () => {
    const dispatch = vi.fn();
    const response = {
      status: 'connected',
      connection: {
        mode: 'cosmos',
        endpointHost: 'next.example.com',
        database: 'next-db',
        container: 'next-graph',
        partitionKey: 'type'
      },
      diagnostics: { operation: 'connection-probe' }
    };
    switchConnection.mockResolvedValue(response);
    const header = new Header({ ...baseProps, dispatch });

    await header.switchConnection({
      endpoint: 'wss://next.example.com:443/',
      primaryKey: 'one-shot-secret',
      database: 'next-db',
      container: 'next-graph',
      partitionKey: 'type'
    });

    expect(dispatch.mock.calls).toEqual([
      [{ type: ACTIONS.SWITCH_CONNECTION_START }],
      [{ type: ACTIONS.SWITCH_CONNECTION_SUCCESS, payload: response }],
      [{ type: ACTIONS.CLEAR_GRAPH }],
      [{ type: ACTIONS.CLEAR_OPERATION_DIAGNOSTICS }],
      [{ type: ACTIONS.SET_ERROR, payload: null }],
      [{
        type: ACTIONS.SET_QUERY_STATUS,
        payload: {
          status: 'idle',
          message: 'Connected to next.example.com / next-db / next-graph. Run a query to load the graph.'
        }
      }]
    ]);
    expect(JSON.stringify(dispatch.mock.calls)).not.toContain('one-shot-secret');
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: ACTIONS.SET_QUERY }));
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: ACTIONS.CLEAR_QUERY_HISTORY }));
  });

  it('preserves graph state after a failed switch and exposes only a safe failure action', async () => {
    const dispatch = vi.fn();
    const error = Object.assign(new Error('Connection probe failed'), {
      diagnostics: { operation: 'connection-probe', requestCharge: { total: 1.5 } }
    });
    switchConnection.mockRejectedValue(error);
    const header = new Header({ ...baseProps, dispatch });

    await expect(header.switchConnection({ primaryKey: 'one-shot-secret' })).rejects.toThrow('Connection probe failed');

    expect(dispatch.mock.calls).toEqual([
      [{ type: ACTIONS.SWITCH_CONNECTION_START }],
      [{
        type: ACTIONS.SWITCH_CONNECTION_FAILURE,
        payload: { message: 'Connection probe failed', diagnostics: error.diagnostics }
      }]
    ]);
    expect(JSON.stringify(dispatch.mock.calls)).not.toContain('one-shot-secret');
  });

  it('splits RU charges into a total and a breakdown line', () => {
    expect(getRequestChargeParts({
      operation: 'query',
      requestCharge: {
        total: 47.2,
        requests: [
          { kind: 'vertices', charge: 31.4 },
          { kind: 'edges', charge: 15.8 }
        ]
      }
    })).toEqual({ total: '47.20 RU', detail: 'vertices 31.40 + edges 15.80' });
    expect(getRequestChargeParts({
      operation: 'traverse-out',
      requestCharge: { total: 3.75, requests: [{ kind: 'vertices', charge: 2.5 }, { kind: 'edges', charge: 1.25 }] }
    })).toEqual({ total: '3.75 RU', detail: 'outbound · vertices 2.50 + edges 1.25' });
    expect(getRequestChargeParts({ operation: 'traverse-in', requestCharge: { total: 1204.1, requests: [] } }))
      .toEqual({ total: '1,204.10 RU', detail: 'inbound' });
    expect(getRequestChargeParts({ operation: 'query', requestCharge: null }))
      .toEqual({ total: '— RU', detail: 'charge unavailable' });
    expect(getRequestChargeParts(null)).toEqual({ total: '— RU', detail: 'no operation yet' });
  });

  it('shows partition advisories without disabling Execute or changing history', () => {
    const dispatch = vi.fn();
    const html = ReactDOMServer.renderToStaticMarkup(
      <Header {...baseProps} dispatch={dispatch} query="g.V()" />
    );

    expect(html).toContain('may scan multiple partitions');
    expect(html).not.toMatch(/type="submit"[^>]*disabled=""/);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('connection dialog opening', () => {
  it('clears the previous switch result before opening the dialog', () => {
    const dispatch = vi.fn();
    const header = new Header({ ...baseProps, dispatch });
    header.setState = vi.fn();

    header.openConnectionDialog();

    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.RESET_CONNECTION_FEEDBACK });
    expect(header.setState).toHaveBeenCalledWith({ connectionDialogOpen: true });
  });
});
