import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';
import { getConnectionLabel } from './ConnectionChip';
import { getRequestChargeParts } from './RequestChargeChip';
import { ACTIONS } from '../../constants';
import { executeQuery, getConnection, switchConnection } from '../../api/gremlinApi';
import { mount, unmountAll } from './testUtils';

vi.mock('../../api/gremlinApi', () => ({
  executeQuery: vi.fn(),
  executeTraversal: vi.fn(),
  getConnection: vi.fn(),
  switchConnection: vi.fn()
}));

const baseProps = {
  dispatch: vi.fn(),
  query: '',
  error: null,
  queryStatus: 'idle',
  queryStatusMessage: 'Ready to explore the graph.',
  nodes: [],
  edges: [],
  nodeLabels: [],
  nodeLimit: 100,
  latestDiagnostics: null,
  connectionStatus: 'connected',
  connection: { mode: 'fixture', partitionKey: 'type' },
  connectionLoading: false,
  connectionSwitching: false,
  connectionError: null,
  probeDiagnostics: null,
  queryHistory: [],
  historyCursor: null,
  isPhysicsEnabled: true,
  network: null,
  networkOptions: { physics: {} }
};

const render = (props) => ReactDOMServer.renderToStaticMarkup(<TopBar {...baseProps} {...props} />);

beforeEach(() => {
  vi.clearAllMocks();
  getConnection.mockReturnValue(new Promise(() => {}));
});

afterEach(unmountAll);

describe('top bar rendering', () => {
  it('shows the connection chip with its partition key', () => {
    const html = render();
    expect(html).toContain('Fixture');
    expect(html).toContain('partition · type');
  });

  it('labels Run with the platform shortcut', () => {
    expect(render()).toContain('Run Ctrl+↵');
    const platform = vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    expect(render()).toContain('Run ⌘↵');
    platform.mockRestore();
  });

  it('shows Running… while a query runs', () => {
    const html = render({ queryStatus: 'running' });
    expect(html).toContain('Running…');
    expect(html).toMatch(/<button[^>]*top-bar__run[^>]*disabled=""|<button[^>]*disabled=""[^>]*top-bar__run/);
  });

  it('shows the RU chip before any operation', () => {
    const html = render();
    expect(html).toContain('— RU');
    expect(html).toContain('no operation yet');
  });

  it('renders the message line with the status tone', () => {
    const html = render({ queryStatus: 'empty', queryStatusMessage: 'Query ran, but Cosmos returned no vertices for this traversal.' });
    expect(html).toContain('message-line--empty');
    expect(html).toContain('Cosmos returned no vertices');
  });

  it('shows partition advisories without disabling Run', () => {
    const html = render({ query: 'g.V()' });
    expect(html).toContain('may scan multiple partitions');
    expect(html).not.toMatch(/<button[^>]*top-bar__run[^>]*disabled=""/);
  });

  it('disables Run while disconnected, loading, or switching', () => {
    for (const props of [{ connectionStatus: 'disconnected' }, { connectionLoading: true }, { connectionSwitching: true }]) {
      expect(render(props)).toMatch(/<button[^>]*top-bar__run[^>]*disabled=""|<button[^>]*disabled=""[^>]*top-bar__run/);
    }
  });

  it.each([
    ['a graph operation is running', { queryStatus: 'running' }],
    ['initial connection state is loading', { connectionLoading: true }],
    ['a connection switch is active', { connectionSwitching: true }]
  ])('disables the connection chip while %s', (_label, props) => {
    const chip = render(props).match(/<button[^>]*top-bar__connection[^>]*>/)[0];
    expect(chip).toContain('disabled=""');
  });
});

describe('top bar labels', () => {
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

  it('splits RU charges into a total and a breakdown line', () => {
    expect(getRequestChargeParts({
      operation: 'query',
      requestCharge: { total: 47.2, requests: [{ kind: 'vertices', charge: 31.4 }, { kind: 'edges', charge: 15.8 }] }
    })).toEqual({ total: '47.20 RU', detail: 'vertices 31.40 + edges 15.80' });
    expect(getRequestChargeParts({
      operation: 'traverse-out',
      requestCharge: { total: 3.75, requests: [{ kind: 'vertices', charge: 2.5 }, { kind: 'edges', charge: 1.25 }] }
    })).toEqual({ total: '3.75 RU', detail: 'outbound · vertices 2.50 + edges 1.25' });
    expect(getRequestChargeParts({ operation: 'traverse-in', requestCharge: { total: 1204.1, requests: [] } }))
      .toEqual({ total: '1,204.10 RU', detail: 'inbound' });
    expect(getRequestChargeParts({ operation: 'query', requestCharge: null })).toEqual({ total: '— RU', detail: 'charge unavailable' });
    expect(getRequestChargeParts(null)).toEqual({ total: '— RU', detail: 'no operation yet' });
  });
});

describe('top bar behaviour', () => {
  it('loads sanitized connection status on mount', async () => {
    const dispatch = vi.fn();
    const payload = { status: 'connected', connection: { mode: 'fixture', partitionKey: 'type' } };
    getConnection.mockResolvedValue(payload);
    const bar = new TopBar({ ...baseProps, dispatch });

    await bar.loadConnection();

    expect(dispatch.mock.calls).toEqual([
      [{ type: ACTIONS.LOAD_CONNECTION_START }],
      [{ type: ACTIONS.LOAD_CONNECTION_SUCCESS, payload }]
    ]);
  });

  it('clears graph and graph diagnostics after a successful connection switch without clearing query state', async () => {
    const dispatch = vi.fn();
    const response = {
      status: 'connected',
      connection: { mode: 'cosmos', endpointHost: 'next.example.com', database: 'next-db', container: 'next-graph', partitionKey: 'type' },
      diagnostics: { operation: 'connection-probe' }
    };
    switchConnection.mockResolvedValue(response);
    const bar = new TopBar({ ...baseProps, dispatch });

    await bar.switchConnection({ endpoint: 'wss://next.example.com:443/', primaryKey: 'one-shot-secret', database: 'next-db', container: 'next-graph', partitionKey: 'type' });

    expect(dispatch.mock.calls).toEqual([
      [{ type: ACTIONS.SWITCH_CONNECTION_START }],
      [{ type: ACTIONS.SWITCH_CONNECTION_SUCCESS, payload: response }],
      [{ type: ACTIONS.CLEAR_GRAPH }],
      [{ type: ACTIONS.CLEAR_OPERATION_DIAGNOSTICS }],
      [{ type: ACTIONS.SET_ERROR, payload: null }],
      [{
        type: ACTIONS.SET_QUERY_STATUS,
        payload: { status: 'idle', message: 'Connected to next.example.com / next-db / next-graph. Run a query to load the graph.' }
      }]
    ]);
    expect(JSON.stringify(dispatch.mock.calls)).not.toContain('one-shot-secret');
  });

  it('preserves graph state after a failed switch and exposes only a safe failure action', async () => {
    const dispatch = vi.fn();
    const error = Object.assign(new Error('Connection probe failed'), {
      diagnostics: { operation: 'connection-probe', requestCharge: { total: 1.5 } }
    });
    switchConnection.mockRejectedValue(error);
    const bar = new TopBar({ ...baseProps, dispatch });

    await expect(bar.switchConnection({ primaryKey: 'one-shot-secret' })).rejects.toThrow('Connection probe failed');

    expect(dispatch.mock.calls).toEqual([
      [{ type: ACTIONS.SWITCH_CONNECTION_START }],
      [{ type: ACTIONS.SWITCH_CONNECTION_FAILURE, payload: { message: 'Connection probe failed', diagnostics: error.diagnostics } }]
    ]);
    expect(JSON.stringify(dispatch.mock.calls)).not.toContain('one-shot-secret');
  });

  it('clears the previous switch result before opening the dialog', () => {
    const dispatch = vi.fn();
    const bar = new TopBar({ ...baseProps, dispatch });
    bar.setState = vi.fn();

    bar.openConnectionDialog();

    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.RESET_CONNECTION_FEEDBACK });
    expect(bar.setState).toHaveBeenCalledWith({ connectionDialogOpen: true });
  });

  it('opens the connection dialog from the message-line action', () => {
    const root = mount(<TopBar {...baseProps} connectionError="Probe failed" />);

    Simulate.click(root.querySelector('.message-line__action'));

    expect(document.body.textContent).toContain('Switch Cosmos connection');
  });

  it('retries the last submitted query from the message-line action', async () => {
    executeQuery.mockResolvedValue({ data: [] });
    const dispatch = vi.fn();
    const bar = new TopBar({ ...baseProps, dispatch, query: 'g.V().limit(3)' });
    await bar.sendQuery();
    executeQuery.mockClear();

    await bar.onMessageAction('retry');

    expect(executeQuery).toHaveBeenCalledWith({ query: 'g.V().limit(3)', nodeLimit: 100 });
  });

  it('reloads connection status for the check-server action', () => {
    const dispatch = vi.fn();
    const bar = new TopBar({ ...baseProps, dispatch });

    bar.onMessageAction('check-server');

    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.LOAD_CONNECTION_START });
  });

  it('runs on Cmd+Enter but not while a query is already running', () => {
    executeQuery.mockReturnValue(new Promise(() => {}));
    const root = mount(<TopBar {...baseProps} query="g.V()" />);
    Simulate.keyDown(root.querySelector('textarea'), { key: 'Enter', metaKey: true });
    expect(executeQuery).toHaveBeenCalledTimes(1);

    executeQuery.mockClear();
    const running = mount(<TopBar {...baseProps} query="g.V()" queryStatus="running" />);
    Simulate.keyDown(running.querySelector('textarea'), { key: 'Enter', metaKey: true });
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('recalls history into the editor and resets the cursor on edit', () => {
    const dispatch = vi.fn();
    const bar = new TopBar({ ...baseProps, dispatch, queryHistory: ['g.V().limit(1)', 'g.V().limit(2)'] });

    expect(bar.onHistoryStep('up')).toBe('g.V().limit(2)');
    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.SET_HISTORY_CURSOR, payload: 1 });
    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.SET_QUERY, payload: 'g.V().limit(2)' });

    dispatch.mockClear();
    const cycling = new TopBar({ ...baseProps, dispatch, query: 'g.V().limit(2)', historyCursor: 1 });
    cycling.onQueryChanged('g.V().limit(20)');
    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.SET_HISTORY_CURSOR, payload: null });
  });
});
