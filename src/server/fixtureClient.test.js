import { describe, expect, it } from 'vitest';

const { createFixtureClient } = require('./fixtureClient');

describe('fixture Gremlin client', () => {
  it('returns the demo graph vertices with type partition values', async () => {
    const client = createFixtureClient();

    const vertexResult = await client.submit('g.V().limit(25)', {});

    expect(vertexResult._items.map(vertex => vertex.id)).toEqual([
      'person-ada',
      'company-engine',
      'project-cosmos',
      'dataset-users',
      'tag-production'
    ]);
    expect(vertexResult._items.every(vertex => vertex.properties.type[0].value === vertex.label)).toBe(true);
  });

  it('filters fixture out traversal results to connected neighbors', async () => {
    const client = createFixtureClient();

    const vertexResult = await client.submit("g.V('project-cosmos').union(identity(), out().limit(25)).dedup()", {});
    const edgeResult = await client.submit("g.V('project-cosmos').outE().where(inV().hasId('dataset-users','tag-production'))", {});

    expect(vertexResult._items.map(vertex => vertex.id)).toEqual(['project-cosmos', 'dataset-users', 'tag-production']);
    expect(edgeResult._items.map(edge => edge.id)).toEqual(['edge-queries', 'edge-deploys']);
  });

  it('filters fixture in traversal results to connected neighbors', async () => {
    const client = createFixtureClient();

    const vertexResult = await client.submit("g.V('project-cosmos').union(identity(), in().limit(25)).dedup()", {});
    const edgeResult = await client.submit("g.V('project-cosmos').inE().where(outV().hasId('person-ada','company-engine'))", {});

    expect(vertexResult._items.map(vertex => vertex.id)).toEqual(['project-cosmos', 'person-ada', 'company-engine']);
    expect(edgeResult._items.map(edge => edge.id)).toEqual(['edge-owns', 'edge-builds']);
  });

  it('returns only the origin vertex when traversal neighbors are limited to zero', async () => {
    const client = createFixtureClient();

    const vertexResult = await client.submit("g.V('project-cosmos').union(identity(), in().limit(0)).dedup()", {});

    expect(vertexResult._items.map(vertex => vertex.id)).toEqual(['project-cosmos']);
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

  it.each([
    ["g.V().has('type', 'person'"],
    ["g.V().has('name, 'Ada')"],
    ["g.V()).limit(2)"]
  ])('rejects %s as a Gremlin syntax error', async (query) => {
    const client = createFixtureClient();

    await expect(client.submit(query, {})).rejects.toMatchObject({
      statusCode: 597,
      message: expect.stringMatching(/Gremlin Query Syntax Error/)
    });
  });

  it('accepts brackets and quotes inside string literals', async () => {
    const client = createFixtureClient();

    const result = await client.submit("g.V().has('name', 'O\\'Brien (x)').limit(2)", {});

    expect(Array.isArray(result._items)).toBe(true);
  });
});
