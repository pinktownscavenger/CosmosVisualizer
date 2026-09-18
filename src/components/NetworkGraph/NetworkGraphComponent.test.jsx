import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GraphHint } from './NetworkGraphComponent';

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
