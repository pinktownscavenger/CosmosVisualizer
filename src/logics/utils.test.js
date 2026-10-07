import { describe, expect, it } from 'vitest';
import {
  makeTraversalHistoryQuery,
  extractEdgesAndNodes,
  getDiffEdges,
  getDiffNodes,
  stringifyObjectValues
} from './utils';
import { normalizedGraph } from '../__fixtures__/graphFixtures';

describe('frontend graph utilities', () => {
  it('extracts vis-network nodes and edges from normalized graph data', () => {
    const result = extractEdgesAndNodes(normalizedGraph, []);

    expect(result.nodes).toEqual([
      {
        id: 'person-1',
        label: 'Ada Lovelace',
        group: 'person',
        type: 'person',
        partition: { name: 'type', value: 'person' },
        properties: normalizedGraph[0].properties
      },
      {
        id: 'company-1',
        label: 'Analytical Engines Ltd',
        group: 'company',
        type: 'company',
        partition: { name: 'type', value: 'company' },
        properties: normalizedGraph[1].properties
      },
      {
        id: 'project-1',
        label: 'Graph Modernization',
        group: 'project',
        type: 'project',
        partition: { name: 'type', value: 'project' },
        properties: normalizedGraph[2].properties
      },
      {
        id: "tag-'quoted\\id",
        label: 'tag',
        group: 'tag',
        type: 'tag',
        partition: { name: 'type', value: 'tag' },
        properties: normalizedGraph[3].properties
      }
    ]);
    expect(result.edges).toHaveLength(9);
    expect(result.edges[0]).toMatchObject({
      id: 'edge-1',
      type: 'works_at',
      arrows: { to: { enabled: true, scaleFactor: 0.5 } }
    });
    expect(result.nodeLabels).toEqual([
      { type: 'person', field: 'name' },
      { type: 'company', field: 'name' },
      { type: 'project', field: 'title' },
      { type: 'tag', field: 'type' }
    ]);
  });

  it('keeps existing node label preferences', () => {
    const result = extractEdgesAndNodes(normalizedGraph, [
      { type: 'person', field: 'aliases' }
    ]);

    expect(result.nodes[0].label).toBe('Ada,Enchantress of Numbers');
    expect(result.nodeLabels[0]).toEqual({ type: 'person', field: 'aliases' });
  });

  it('treats missing edge collections as empty', () => {
    const result = extractEdgesAndNodes([
      { id: 'person-1', label: 'person', properties: { name: 'Ada Lovelace' } }
    ], []);

    expect(result.edges).toEqual([]);
    expect(result.nodes).toHaveLength(1);
  });

  it('preserves dedicated partition metadata on graph nodes', () => {
    const partition = { name: 'type', value: 'person' };
    const result = extractEdgesAndNodes([
      {
        id: 'person-1',
        label: 'person',
        properties: { name: ['Ada Lovelace'] },
        partition,
        edges: []
      }
    ], []);

    expect(result.nodes[0].partition).toEqual(partition);
    expect(result.nodes[0].properties).not.toHaveProperty('partition');
  });

  it('diffs nodes by id', () => {
    expect(getDiffNodes(
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'a' }]
    )).toEqual([{ id: 'b' }]);
  });

  it('diffs edges by fallback endpoint signature when ids are missing', () => {
    expect(getDiffEdges(
      [
        { from: 'person-1', to: 'project-1', type: 'created' },
        { from: 'person-1', to: 'company-1', type: 'works_at' }
      ],
      [{ from: 'person-1', to: 'project-1', type: 'created' }]
    )).toEqual([
      { from: 'person-1', to: 'company-1', type: 'works_at' }
    ]);
  });

  it('diffs edges by id without collapsing parallel edges', () => {
    expect(getDiffEdges(
      [
        { id: 'edge-2', from: 'person-1', to: 'project-1', type: 'created' },
        { id: 'edge-3', from: 'person-1', to: 'project-1', type: 'reviewed' }
      ],
      [{ id: 'edge-2', from: 'person-1', to: 'project-1', type: 'created' }]
    )).toEqual([
      { id: 'edge-3', from: 'person-1', to: 'project-1', type: 'reviewed' }
    ]);
  });

  it('deduplicates incoming edges before diffing against existing edges', () => {
    expect(getDiffEdges(
      [
        { id: 'edge-2', from: 'person-1', to: 'project-1', type: 'created' },
        { id: 'edge-2', from: 'person-1', to: 'project-1', type: 'created' },
        { id: 'edge-3', from: 'person-1', to: 'project-1', type: 'reviewed' }
      ],
      []
    )).toEqual([
      { id: 'edge-2', from: 'person-1', to: 'project-1', type: 'created' },
      { id: 'edge-3', from: 'person-1', to: 'project-1', type: 'reviewed' }
    ]);
  });

  it('stringifies non-string property values without mutating the input', () => {
    const properties = {
      name: 'Ada',
      scores: [1, 2],
      active: true
    };

    expect(stringifyObjectValues(properties)).toEqual({
      name: 'Ada',
      scores: '[1,2]',
      active: 'true'
    });
    expect(properties.scores).toEqual([1, 2]);
  });

  it('preserves string object values while stringifying other objects', () => {
    expect(stringifyObjectValues({
      name: new String('Ada'),
      details: { role: 'mathematician' }
    })).toEqual({
      name: new String('Ada'),
      details: '{"role":"mathematician"}'
    });
  });
});

describe('makeTraversalHistoryQuery', () => {
  it('builds a rerunnable query that keeps the origin node', () => {
    expect(makeTraversalHistoryQuery('person-1', 'out')).toBe("g.V('person-1').union(identity(), out())");
    expect(makeTraversalHistoryQuery('person-1', 'in')).toBe("g.V('person-1').union(identity(), in())");
  });

  it('escapes quotes and backslashes in node ids', () => {
    expect(makeTraversalHistoryQuery("o'brien\\x", 'out')).toBe("g.V('o\\'brien\\\\x').union(identity(), out())");
  });
});
