import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CanvasEmptyState, GraphHint, NetworkGraph, clearGraph, handleCanvasClick, keepNodeClearOfInspector, watchFontsForNetwork } from './NetworkGraphComponent';
import { ACTIONS } from '../../constants';

describe('graph hint', () => {
  it('renders a dismiss control when visible', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <GraphHint visible={true} onDismiss={() => {}} />
    );

    expect(html).toContain('Click a node or edge to inspect it');
    expect(html).toContain('aria-label="Dismiss graph hint"');
  });

  it('fades rather than vanishing', () => {
    const html = ReactDOMServer.renderToStaticMarkup(<GraphHint visible={true} onDismiss={() => {}} />);
    expect(html).toMatch(/style="[^"]*opacity/);
  });

  it('renders nothing after it is dismissed', () => {
    expect(ReactDOMServer.renderToStaticMarkup(
      <GraphHint visible={false} onDismiss={() => {}} />
    )).toBe('');
  });
});

describe('re-measuring labels once the graph font loads', () => {
  const makeNetwork = () => {
    const update = vi.fn();
    const items = [
      { id: 'tag-production', label: 'Production', type: 'tag', color: { background: '#94a3b8' }, shapeProperties: { borderDashes: false } },
      { id: 'project-cosmos', label: 'CosmosVisualizer', type: 'project' }
    ];
    return { update, network: { body: { data: { nodes: { get: () => items, update } } }, redraw: vi.fn() } };
  };
  // Re-setting a node's label is what makes vis-network re-measure it; needsRefresh alone keeps the cached width.
  // vis-network re-applies group default colours on an update that omits color, so the palette style travels with the label.
  const relabelled = [[[
    { id: 'tag-production', label: 'Production', color: { background: '#94a3b8' }, shapeProperties: { borderDashes: false } },
    { id: 'project-cosmos', label: 'CosmosVisualizer' }
  ]]];
  const makeFonts = () => {
    const listeners = {};
    return {
      load: vi.fn(() => Promise.resolve([])),
      addEventListener: vi.fn((type, handler) => { listeners[type] = handler; }),
      removeEventListener: vi.fn((type) => { delete listeners[type]; }),
      listeners
    };
  };

  it('requests the label font explicitly and re-measures every node when it arrives', async () => {
    const { update, network } = makeNetwork();
    const fonts = makeFonts();

    await watchFontsForNetwork(network, fonts).ready;

    expect(fonts.load).toHaveBeenCalledWith('12px "JetBrains Mono"');
    expect(update.mock.calls).toEqual(relabelled);
    expect(network.redraw).toHaveBeenCalled();
  });

  it('re-measures again whenever later font loads finish, until stopped', async () => {
    const { update, network } = makeNetwork();
    const fonts = makeFonts();
    const watcher = watchFontsForNetwork(network, fonts);
    await watcher.ready;
    update.mockClear();

    fonts.listeners.loadingdone();
    expect(update).toHaveBeenCalledTimes(1);

    watcher.stop();
    expect(fonts.removeEventListener).toHaveBeenCalledWith('loadingdone', expect.any(Function));
  });

  it('still redraws when the font loading API is unavailable', async () => {
    const { network } = makeNetwork();

    await watchFontsForNetwork(network, undefined).ready;

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
