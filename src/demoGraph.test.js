import { describe, expect, it } from 'vitest';
import { demoEdges, demoNodes } from './demoGraph';
import { extractEdgesAndNodes } from './logics/utils';

const { createFixtureClient } = require('./server/fixtureClient');
const { makeEdgeQuery, makeVertexQuery, verticesToJson } = require('./server/graphHelpers');

const uniqueById = (items) => [...new Map(items.map(item => [item.id, item])).values()];

describe('startup demo graph', () => {
  it('matches what fixture mode returns for the demo query', async () => {
    const client = createFixtureClient();
    const vertexResult = await client.submit(makeVertexQuery('g.V()', 25), {});
    const edgeResult = await client.submit(
      makeEdgeQuery(vertexResult._items.map(vertex => vertex.id)),
      {}
    );
    const { nodes, edges } = extractEdgesAndNodes(
      verticesToJson(vertexResult._items, edgeResult._items, 'type'),
      []
    );

    expect(demoNodes).toEqual(nodes);
    expect(demoEdges).toEqual(uniqueById(edges));
  });

  it('labels each node with a readable name rather than its type', () => {
    expect(demoNodes.map(node => node.label)).toEqual([
      'Ada Lovelace',
      'Analytical Engines',
      'CosmosVisualizer',
      'User graph',
      'Production'
    ]);
  });
});
