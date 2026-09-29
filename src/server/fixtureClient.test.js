import { describe, expect, it } from 'vitest';
import { normalizedGraph } from '../__fixtures__/graphFixtures';

const { createFixtureClient } = require('./fixtureClient');
const { verticesToJson } = require('./graphHelpers');

describe('fixture Gremlin client', () => {
  it('returns fixture vertices and edges through the Gremlin submit shape', async () => {
    const client = createFixtureClient();

    const vertexResult = await client.submit('g.V().limit(25)', {});
    const edgeResult = await client.submit("g.V('person-1').bothE()", {});

    expect(verticesToJson(vertexResult._items, edgeResult._items, 'type')).toEqual(normalizedGraph);
    expect(vertexResult._items.every(vertex => vertex.properties.type[0].value === vertex.label)).toBe(true);
  });

  it('filters fixture out traversal results to connected neighbors', async () => {
    const client = createFixtureClient();

    const vertexResult = await client.submit("g.V('person-1').union(identity(), out().limit(25)).dedup()", {});
    const edgeResult = await client.submit("g.V('person-1').outE().where(inV().hasId('company-1','project-1'))", {});

    expect(vertexResult._items.map(vertex => vertex.id)).toEqual(['person-1', 'company-1', 'project-1']);
    expect(edgeResult._items.map(edge => edge.id)).toEqual(['edge-1', 'edge-2', 'edge-3']);
  });

  it('filters fixture in traversal results to connected neighbors', async () => {
    const client = createFixtureClient();

    const vertexResult = await client.submit("g.V('project-1').union(identity(), in().limit(25)).dedup()", {});
    const edgeResult = await client.submit("g.V('project-1').inE().where(outV().hasId('person-1'))", {});

    expect(vertexResult._items.map(vertex => vertex.id)).toEqual(['project-1', 'person-1']);
    expect(edgeResult._items.map(edge => edge.id)).toEqual(['edge-2', 'edge-3']);
  });

  it('returns deterministic request attributes and rejects work after closing', async () => {
    const client = createFixtureClient();

    const probe = await client.submit("g.V().has('type').limit(1)", {});
    expect(probe.attributes).toEqual(new Map([
      ['x-ms-total-request-charge', 0.5]
    ]));

    await client.close();
    await expect(client.submit('g.V()', {})).rejects.toThrow('Fixture client is closed');
    await expect(client.close()).resolves.toBeUndefined();
  });
});
