import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GraphCounts, GraphHint, NetworkGraph, clearGraph, handleCanvasClick, keepNodeClearOfInspector, refreshNetworkNodeMeasurementsAfterFonts } from './NetworkGraphComponent';
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
  const makeNetwork = (domX) => ({
    getPositions: vi.fn(() => ({ 'node-1': { x: 50, y: 60 } })),
    canvasToDOM: vi.fn(() => ({ x: domX, y: 100 })),
    moveTo: vi.fn(),
    body: { container: { clientWidth: 1400 } }
  });

  it('pans a node that sits under the inspector into the visible region', () => {
    const network = makeNetwork(1200);

    keepNodeClearOfInspector(network, 'node-1', 384);

    expect(network.moveTo).toHaveBeenCalledWith({
      position: { x: 50, y: 60 },
      offset: { x: -192, y: 0 },
      animation: true
    });
  });

  it('leaves a visible node where it is', () => {
    const network = makeNetwork(400);

    keepNodeClearOfInspector(network, 'node-1', 384);

    expect(network.moveTo).not.toHaveBeenCalled();
  });

  it('ignores missing networks and positions', () => {
    expect(() => keepNodeClearOfInspector(null, 'node-1', 384)).not.toThrow();
    const network = { ...makeNetwork(1200), getPositions: vi.fn(() => ({})) };
    keepNodeClearOfInspector(network, 'node-1', 384);
    expect(network.moveTo).not.toHaveBeenCalled();
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

  it('counts nodes and edges with singular forms', () => {
    expect(ReactDOMServer.renderToStaticMarkup(<GraphCounts nodes={5} edges={5} />)).toContain('5 nodes · 5 edges');
    expect(ReactDOMServer.renderToStaticMarkup(<GraphCounts nodes={1} edges={1} />)).toContain('1 node · 1 edge');
  });

  it('hides the hint after the first selection', () => {
    const graph = new NetworkGraph({ dispatch: vi.fn() });
    expect(graph.isHintVisible()).toBe(true);

    graph.state = { ...graph.state, hasSelectedOnce: true };

    expect(graph.isHintVisible()).toBe(false);
  });
});
