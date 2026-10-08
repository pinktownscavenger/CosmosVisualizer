import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Details,
  QueryHistoryList,
  SelectedResultPanel
} from './DetailsComponent';
import { executeQuery, executeTraversal } from '../../api/gremlinApi';
import { ACTIONS } from '../../constants';
import { normalizedGraph } from '../../__fixtures__/graphFixtures';

vi.mock('../../api/gremlinApi', () => ({
  executeQuery: vi.fn(),
  executeTraversal: vi.fn()
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('query history list', () => {
  it('renders query history rows with run and load actions', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <QueryHistoryList
        queries={['g.V().limit(25)']}
        onRunQuery={() => {}}
        onLoadQuery={() => {}}
        onClearHistory={() => {}}
      />
    );

    expect(html).toContain('g.V().limit(25)');
    expect(html).toContain('Run query 1');
    expect(html).toContain('Load query 1');
    expect(html).toContain('Clear History');
  });

  it('keeps the empty query history state quiet', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <QueryHistoryList
        queries={[]}
        onRunQuery={() => {}}
        onLoadQuery={() => {}}
        onClearHistory={() => {}}
      />
    );

    expect(html).toContain('No queries have been executed yet.');
    expect(html).not.toContain('Clear History');
  });

  it('disables Run but keeps Load available while graph requests are unavailable', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <QueryHistoryList
        queries={['g.V()']}
        disabled
        onRunQuery={() => {}}
        onLoadQuery={() => {}}
        onClearHistory={() => {}}
      />
    );
    const runButton = html.match(/<button[^>]*aria-label="Run query 1"[^>]*>/)[0];
    const loadButton = html.match(/<button[^>]*aria-label="Load query 1"[^>]*>/)[0];

    expect(runButton).toContain('disabled=""');
    expect(loadButton).not.toContain('disabled=""');
  });
});

describe('selected result panel', () => {
  it('marks selected details as a mobile sheet when a result is selected', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <SelectedResultPanel
        selectedResult={{
          kind: 'node',
          type: 'person',
          id: 'person-ada',
          properties: { name: 'Ada Lovelace' }
        }}
        selectedResultViewMode="table"
        onViewModeChanged={() => {}}
        onTraverse={() => {}}
        onCloseMobileInspector={() => {}}
      />
    );

    expect(html).toContain('selected-panel--mobile-sheet');
    expect(html).toContain('Close selected result');
    expect(html).toContain('Selected Node');
  });

  it('omits mobile sheet treatment when no result is selected', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <SelectedResultPanel
        selectedResult={null}
        selectedResultViewMode="table"
        onViewModeChanged={() => {}}
        onTraverse={() => {}}
        onCloseMobileInspector={vi.fn()}
      />
    );

    expect(html).not.toContain('selected-panel--mobile-sheet');
    expect(html).toContain('No graph result is selected yet.');
  });

  it('shows node partition metadata in table and JSON views', () => {
    const selectedResult = {
      kind: 'node',
      type: 'person',
      id: 'person-ada',
      partition: { name: 'type', value: 'person' },
      properties: { name: 'Ada Lovelace' }
    };
    const props = {
      selectedResult,
      onViewModeChanged: vi.fn(),
      onTraverse: vi.fn(),
      onCloseMobileInspector: vi.fn()
    };

    const table = ReactDOMServer.renderToStaticMarkup(
      <SelectedResultPanel {...props} selectedResultViewMode="table" />
    );
    const json = ReactDOMServer.renderToStaticMarkup(
      <SelectedResultPanel {...props} selectedResultViewMode="json" />
    );

    expect(table).toContain('Partition key (type)');
    expect(table).toContain('person');
    expect(json).toContain('&quot;partition&quot;');
    expect(json).toContain('&quot;value&quot;: &quot;person&quot;');
  });

  it('shows a missing partition value explicitly and omits partition rows for edges', () => {
    const common = {
      selectedResultViewMode: 'table',
      onViewModeChanged: vi.fn(),
      onTraverse: vi.fn(),
      onCloseMobileInspector: vi.fn()
    };
    const node = ReactDOMServer.renderToStaticMarkup(
      <SelectedResultPanel
        {...common}
        selectedResult={{
          kind: 'node',
          type: 'person',
          id: 'person-1',
          partition: { name: 'type', value: null },
          properties: {}
        }}
      />
    );
    const edge = ReactDOMServer.renderToStaticMarkup(
      <SelectedResultPanel
        {...common}
        selectedResult={{ kind: 'edge', type: 'knows', id: 'edge-1', properties: {} }}
      />
    );

    expect(node).toContain('Partition key value not returned');
    expect(edge).not.toContain('Partition key');
  });

  it('places a persistent fan-out advisory beside inbound traversal only', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <SelectedResultPanel
        selectedResult={{ kind: 'node', type: 'person', id: 'person-1', properties: {} }}
        selectedResultViewMode="table"
        onViewModeChanged={vi.fn()}
        onTraverse={vi.fn()}
        onCloseMobileInspector={vi.fn()}
      />
    );

    expect(html).toContain('Inbound traversals can fan out');
    expect(html.indexOf('Inbound traversals can fan out')).toBeGreaterThan(html.indexOf('Traverse In Edges'));
    expect(html.indexOf('Inbound traversals can fan out')).toBeGreaterThan(html.indexOf('Traverse Out Edges'));
  });

  it('disables both traversal actions while graph requests are unavailable', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <SelectedResultPanel
        selectedResult={{ kind: 'node', type: 'person', id: 'person-1', properties: {} }}
        selectedResultViewMode="table"
        disabled
        onViewModeChanged={vi.fn()}
        onTraverse={vi.fn()}
        onCloseMobileInspector={vi.fn()}
      />
    );

    expect((html.match(/disabled=""/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('Traverse Out Edges');
    expect(html).toContain('Traverse In Edges');
  });
});

describe('details query history actions', () => {
  it('publishes a completion status after rerunning a history query', async () => {
    const dispatch = vi.fn();
    executeQuery.mockResolvedValue({ data: normalizedGraph });

    const details = new Details({
      dispatch,
      nodeLimit: 100,
      nodeLabels: []
    });

    await details.onRunQuery('g.V().limit(25)');

    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'success', message: '4 nodes, 5 edges · 9 new' }
    });
  });
});

describe('details traversal actions', () => {
  it('requests connected traversal results without clearing the existing graph', async () => {
    const dispatch = vi.fn();
    executeTraversal.mockResolvedValue({ data: normalizedGraph });

    const details = new Details({
      dispatch,
      nodeLimit: 100,
      nodeLabels: []
    });

    await details.onTraverse("o'brien", 'out');

    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.ADD_QUERY_HISTORY,
      payload: "g.V('o\\'brien').union(identity(), out())"
    });
    expect(executeTraversal).toHaveBeenCalledWith({
      nodeId: "o'brien",
      direction: 'out',
      nodeLimit: 100
    });
    expect(dispatch).not.toHaveBeenCalledWith({ type: ACTIONS.CLEAR_GRAPH });
    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.ADD_NODES, payload: expect.any(Array) });
    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.ADD_EDGES, payload: expect.any(Array) });
  });

  it.each([
    ['out', 'traverse-out'],
    ['in', 'traverse-in']
  ])('stores %s traversal diagnostics and its synthetic history entry', async (direction, operation) => {
    const dispatch = vi.fn();
    const diagnostics = {
      operation,
      requestCharge: { total: 2.5, requests: [{ kind: 'vertices', charge: 2.5 }] }
    };
    executeTraversal.mockResolvedValue({ data: normalizedGraph, diagnostics });
    const details = new Details({ dispatch, nodeLimit: 100, nodeLabels: [] });

    await details.onTraverse('person-1', direction);

    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.SET_OPERATION_DIAGNOSTICS, payload: diagnostics });
    expect(dispatch).toHaveBeenCalledWith({
      type: ACTIONS.ADD_QUERY_HISTORY,
      payload: `g.V('person-1').union(identity(), ${direction}())`
    });
  });

  it('dispatches charged failure diagnostics before safe traversal feedback', async () => {
    const dispatch = vi.fn();
    const diagnostics = { operation: 'traverse-in', requestCharge: { total: 0.75 } };
    executeTraversal.mockRejectedValue(Object.assign(new Error('raw driver failure'), {
      kind: 'server',
      diagnostics
    }));
    const details = new Details({ dispatch, nodeLimit: 100, nodeLabels: [] });

    await details.onTraverse('person-1', 'in');

    const actions = dispatch.mock.calls.map(call => call[0]);
    const diagnosticsIndex = actions.findIndex(action => action.type === ACTIONS.SET_OPERATION_DIAGNOSTICS);
    const errorIndex = actions.findIndex(action => action.type === ACTIONS.SET_ERROR);
    expect(diagnosticsIndex).toBeGreaterThan(-1);
    expect(errorIndex).toBeGreaterThan(diagnosticsIndex);
    expect(actions[errorIndex].payload).not.toContain('raw driver failure');
  });
});

describe('details graph action availability', () => {
  const baseDetailsProps = {
    dispatch: vi.fn(),
    network: null,
    selectedNode: {
      id: 'person-1',
      type: 'person',
      partition: { name: 'type', value: 'person' },
      properties: {}
    },
    selectedEdge: {},
    queryHistory: ['g.V()'],
    nodeLabels: [],
    nodeLimit: 100,
    isPhysicsEnabled: true,
    selectedResultViewMode: 'table',
    networkOptions: {},
    connectionStatus: 'connected',
    connectionLoading: false,
    connectionSwitching: false,
    queryStatus: 'idle'
  };

  it.each([
    ['loading', { connectionLoading: true }],
    ['disconnected', { connectionStatus: 'disconnected' }],
    ['switching', { connectionSwitching: true }],
    ['running', { queryStatus: 'running' }]
  ])('disables remote graph controls while %s', (_label, state) => {
    const html = ReactDOMServer.renderToStaticMarkup(<Details {...baseDetailsProps} {...state} />);
    const runButton = html.match(/<button[^>]*aria-label="Run query 1"[^>]*>/)[0];
    const loadButton = html.match(/<button[^>]*aria-label="Load query 1"[^>]*>/)[0];
    const outButton = html.match(/<button[^>]*aria-label="Traverse out edges"[^>]*>/)[0];
    const inButton = html.match(/<button[^>]*aria-label="Traverse in edges"[^>]*>/)[0];

    expect(runButton).toContain('disabled=""');
    expect(loadButton).not.toContain('disabled=""');
    expect(outButton).toContain('disabled=""');
    expect(inButton).toContain('disabled=""');
  });
});
