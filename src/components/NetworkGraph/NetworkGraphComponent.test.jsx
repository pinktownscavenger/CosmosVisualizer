import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GraphHint, refreshNetworkNodeMeasurementsAfterFonts } from './NetworkGraphComponent';

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
