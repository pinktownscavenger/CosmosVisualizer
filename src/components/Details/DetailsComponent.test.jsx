import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  Details,
  QueryHistoryList,
  SelectedResultPanel
} from './DetailsComponent';
import { executeQuery } from '../../api/gremlinApi';
import { ACTIONS } from '../../constants';
import { normalizedGraph } from '../../__fixtures__/graphFixtures';

vi.mock('../../api/gremlinApi', () => ({
  executeQuery: vi.fn()
}));

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
      payload: { status: 'success', message: 'Query complete. Added 4 nodes and 9 edges.' }
    });
  });
});
