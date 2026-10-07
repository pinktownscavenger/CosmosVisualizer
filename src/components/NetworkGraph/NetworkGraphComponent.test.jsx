import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GraphHint, handleCanvasClick, refreshNetworkNodeMeasurementsAfterFonts } from './NetworkGraphComponent';
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
