import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './HeaderComponent';
import { ACTIONS } from '../../constants';

const baseProps = {
  dispatch: vi.fn(),
  query: '',
  error: null,
  queryStatus: 'idle',
  queryStatusMessage: 'Ready to explore the graph.',
  nodes: [{ id: 'node-1' }],
  edges: [],
  nodeLabels: [],
  nodeLimit: 100
};

describe('header query controls', () => {
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
});
