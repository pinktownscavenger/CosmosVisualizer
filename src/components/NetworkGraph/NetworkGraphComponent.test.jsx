import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CanvasEmptyState, GraphHint, NetworkGraph, clearGraph, handleCanvasClick, keepNodeClearOfInspector, refreshNetworkNodeMeasurementsAfterFonts } from './NetworkGraphComponent';
import { ACTIONS } from '../../constants';

describe('graph hint', () => {
  it('renders a dismiss control when visible', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <GraphHint visible={true} onDismiss={() => {}} />
    );

    expect(html).toContain('Click a node or edge to inspect it');
    expect(html).toContain('aria-label="Dismiss graph hint"');
  });

  it('renders nothing after it is dismissed', () => {
    expect(ReactDOMServer.renderToStaticMarkup(
      <GraphHint visible={false} onDismiss={() => {}} />
    )).toBe('');
  });
});

describe('font-ready graph measurement refresh', () => {
  it('refreshes cached node dimensions after web fonts load', async () => {
    const nodes = {
      'tag-production': { needsRefresh: vi.fn() },
      'project-cosmos': { needsRefresh: vi.fn() }
    };
    const network = {
      body: { nodes },
      redraw: vi.fn()
    };

    await refreshNetworkNodeMeasurementsAfterFonts(network, {
      ready: Promise.resolve()
    });

    expect(nodes['tag-production'].needsRefresh).toHaveBeenCalled();
    expect(nodes['project-cosmos'].needsRefresh).toHaveBeenCalled();
    expect(network.redraw).toHaveBeenCalled();
  });

  it('redraws safely when the browser font loading API is unavailable', async () => {
    const network = {
      body: { nodes: {} },
      redraw: vi.fn()
    };

    await refreshNetworkNodeMeasurementsAfterFonts(network, undefined);

    expect(network.redraw).toHaveBeenCalled();
  });
});

describe('canvas click selection handling', () => {
  it('clears the selection when empty canvas is clicked', () => {
    const dispatch = vi.fn();
    handleCanvasClick({ nodes: [], edges: [] }, dispatch);

    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.SET_SELECTED_NODE, payload: null });
  });

  it.each([
    ['a node', { nodes: ['person-1'], edges: ['edge-1'] }],
    ['an edge', { nodes: [], edges: ['edge-1'] }]
  ])('leaves selection to the select handlers when %s is clicked', (_name, params) => {
    const dispatch = vi.fn();
    handleCanvasClick(params, dispatch);

    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('keeping the selection clear of the inspector', () => {
  const card = { left: 1030, top: 12, right: 1390, bottom: 300 };
  const makeNetwork = (dom) => ({
    getPositions: vi.fn(() => ({ 'node-1': { x: 50, y: 60 } })),
    canvasToDOM: vi.fn(() => dom),
    moveTo: vi.fn()
  });

  it('moves a node hidden under the card to the middle of the canvas', () => {
    const network = makeNetwork({ x: 1200, y: 100 });

    keepNodeClearOfInspector(network, 'node-1', card);

    expect(network.moveTo).toHaveBeenCalledWith({ position: { x: 50, y: 60 }, animation: true });
  });

  it('treats the area just around the card as covered', () => {
    const network = makeNetwork({ x: 1015, y: 310 });

    keepNodeClearOfInspector(network, 'node-1', card);

    expect(network.moveTo).toHaveBeenCalled();
  });

  it('leaves nodes beside or below the card where they are', () => {
    for (const dom of [{ x: 400, y: 100 }, { x: 1200, y: 420 }]) {
      const network = makeNetwork(dom);
      keepNodeClearOfInspector(network, 'node-1', card);
      expect(network.moveTo).not.toHaveBeenCalled();
    }
  });

  it('ignores missing networks, positions and cards', () => {
    expect(() => keepNodeClearOfInspector(null, 'node-1', card)).not.toThrow();
    const missing = { ...makeNetwork({ x: 1200, y: 100 }), getPositions: vi.fn(() => ({})) };
    keepNodeClearOfInspector(missing, 'node-1', card);
    expect(missing.moveTo).not.toHaveBeenCalled();
    const noCard = makeNetwork({ x: 1200, y: 100 });
    keepNodeClearOfInspector(noCard, 'node-1', null);
    expect(noCard.moveTo).not.toHaveBeenCalled();
  });
});

describe('canvas overlays', () => {
  it('clears the graph and its diagnostics without clearing query history', () => {
    const dispatch = vi.fn();

    clearGraph(dispatch);

    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.CLEAR_GRAPH });
    expect(dispatch).toHaveBeenCalledWith({ type: ACTIONS.CLEAR_OPERATION_DIAGNOSTICS });
    expect(dispatch).not.toHaveBeenCalledWith({ type: ACTIONS.CLEAR_QUERY_HISTORY });
  });


  it('hides the hint after the first selection', () => {
    const graph = new NetworkGraph({ dispatch: vi.fn() });
    expect(graph.isHintVisible()).toBe(true);

    graph.state = { ...graph.state, hasSelectedOnce: true };

    expect(graph.isHintVisible()).toBe(false);
  });
});

describe('canvas empty state', () => {
  it('prompts for a query on an empty connected graph', () => {
    const html = ReactDOMServer.renderToStaticMarkup(<CanvasEmptyState connectionStatus="connected" loading={false} onConnect={() => {}} />);
    expect(html).toContain('Run a query to load your graph');
  });

  it('offers to connect while disconnected', () => {
    const onConnect = vi.fn();
    const element = CanvasEmptyState({ connectionStatus: 'disconnected', loading: false, onConnect });
    const html = ReactDOMServer.renderToStaticMarkup(element);
    expect(html).toContain('Connect to Cosmos DB');
    element.props.children.find(child => child && child.type === 'button').props.onClick();
    expect(onConnect).toHaveBeenCalled();
  });

  it('stays quiet while the connection is loading', () => {
    expect(ReactDOMServer.renderToStaticMarkup(<CanvasEmptyState connectionStatus="disconnected" loading={true} onConnect={() => {}} />)).toBe('');
  });
});
