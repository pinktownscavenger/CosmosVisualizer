import { describe, expect, it } from 'vitest';
import { rawEdges, rawVertices, normalizedGraph } from '../__fixtures__/graphFixtures';

const {
  escapeGremlinString,
  makeEdgeQuery,
  makeConnectionProbeQuery,
  makeLimitClause,
  makeTraversalEdgeQuery,
  makeTraversalVertexQuery,
  makeVertexQuery,
  mapPropertiesToObj,
  normalizePartitionKeyProperty,
  normalizeEdge,
  uniqueEdges,
  verticesToJson
} = require('./graphHelpers');

describe('graph helper normalization', () => {
  it('normalizes supported partition key property paths', () => {
    expect(normalizePartitionKeyProperty('type')).toBe('type');
    expect(normalizePartitionKeyProperty('/type')).toBe('type');
    expect(normalizePartitionKeyProperty('')).toBeNull();
    expect(normalizePartitionKeyProperty('/')).toBeNull();
    expect(normalizePartitionKeyProperty(null)).toBeNull();
  });

  it('maps Cosmos valueMap properties to plain object arrays', () => {
    expect(mapPropertiesToObj(rawVertices[0].properties)).toEqual({
      name: ['Ada Lovelace'],
      aliases: ['Ada', 'Enchantress of Numbers'],
      active: [true],
      type: ['person']
    });
  });

  it('normalizes edge ids and properties', () => {
    expect(normalizeEdge({
      id: { relation: 'composite' },
      label: 'knows',
      from: 'person-1',
      to: 'person-2',
      properties: { weight: [{ value: 2 }] }
    })).toEqual({
      id: '{"relation":"composite"}',
      label: 'knows',
      from: 'person-1',
      to: 'person-2',
      properties: { weight: [2] }
    });
  });

  it('attaches adjacent edges to normalized vertices', () => {
    expect(verticesToJson(rawVertices, rawEdges, 'type')).toEqual(normalizedGraph);
  });

  it('adds scalar partition metadata while preserving the property array', () => {
    const [vertex] = verticesToJson([
      {
        id: 'person-1',
        label: 'person',
        type: 'vertex',
        properties: { type: [{ value: 'person' }] }
      }
    ], [], '/type');

    expect(vertex.partition).toEqual({ name: 'type', value: 'person' });
    expect(vertex.properties.type).toEqual(['person']);
  });

  it('reports a missing configured partition value without inferring one', () => {
    const [vertex] = verticesToJson([
      {
        id: 'person-1',
        label: 'person',
        type: 'vertex',
        properties: {}
      }
    ], [], 'type');

    expect(vertex.partition).toEqual({ name: 'type', value: null });
  });

  it('omits partition metadata when no partition property is configured', () => {
    const [vertex] = verticesToJson([
      { id: 'person-1', label: 'person', type: 'vertex', properties: {} }
    ], []);

    expect(vertex).not.toHaveProperty('partition');
  });

  it('returns an empty graph for empty vertex results', () => {
    expect(verticesToJson([], rawEdges)).toEqual([]);
  });

  it('deduplicates repeated edges while preserving parallel edges', () => {
    const repeatedEdges = [rawEdges[1], rawEdges[1], rawEdges[2]];

    expect(uniqueEdges(repeatedEdges)).toEqual([rawEdges[1], rawEdges[2]]);
  });
});

describe('graph helper query builders', () => {
  it('builds a read-only connection probe for the configured partition property', () => {
    expect(makeConnectionProbeQuery('type')).toBe("g.V().has('type').limit(1)");
    expect(makeConnectionProbeQuery("kind'\\value")).toBe(
      "g.V().has('kind\\'\\\\value').limit(1)"
    );
  });

  it('escapes Gremlin string ids', () => {
    expect(escapeGremlinString("tag-'quoted\\id")).toBe("tag-\\'quoted\\\\id");
  });

  it('builds edge queries for selected vertex ids', () => {
    const query = makeEdgeQuery(['person-1', "tag-'quoted\\id", { partition: 'a' }]);

    expect(query).toContain("g.V('person-1','tag-\\'quoted\\\\id','{\"partition\":\"a\"}')");
    expect(query).toContain('.bothE()');
    expect(query).toContain('.dedup()');
    expect(query).toContain(".project('id', 'label', 'from', 'to', 'properties')");
  });

  it('skips edge queries when no vertices were returned', () => {
    expect(makeEdgeQuery([])).toBeNull();
  });

  it('applies limits only for positive integers', () => {
    expect(makeLimitClause(10)).toBe('.limit(10)');
    expect(makeLimitClause('25')).toBe('.limit(25)');
    expect(makeLimitClause(0)).toBe('');
    expect(makeLimitClause(-1)).toBe('');
    expect(makeLimitClause('10.5')).toBe('');
    expect(makeLimitClause('not-a-number')).toBe('');
  });

  it('appends a valid node limit to vertex queries', () => {
    expect(makeVertexQuery('g.V()', 2)).toBe('g.V().limit(2)');
    expect(makeVertexQuery('g.V()', '')).toBe('g.V()');
  });

  it('builds traversal vertex queries that keep the selected origin node', () => {
    expect(makeTraversalVertexQuery('person-1', 'out', 3)).toContain(
      "g.V('person-1').union(identity(), out().limit(3)).dedup()"
    );
    expect(makeTraversalVertexQuery("tag-'quoted\\id", 'in', '')).toContain(
      "g.V('tag-\\'quoted\\\\id').union(identity(), in()).dedup()"
    );
  });

  it('builds traversal edge queries scoped to the selected node and returned neighbors', () => {
    const outQuery = makeTraversalEdgeQuery('person-1', 'out', ['company-1', 'project-1']);
    const inQuery = makeTraversalEdgeQuery('project-1', 'in', ['person-1']);

    expect(outQuery).toContain("g.V('person-1').outE()");
    expect(outQuery).toContain("where(inV().hasId('company-1','project-1'))");
    expect(inQuery).toContain("g.V('project-1').inE()");
    expect(inQuery).toContain("where(outV().hasId('person-1'))");
    expect(makeTraversalEdgeQuery('person-1', 'out', [])).toBeNull();
  });
});
