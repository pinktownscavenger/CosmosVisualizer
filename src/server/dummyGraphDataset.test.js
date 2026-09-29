import { describe, expect, it } from 'vitest';

const {
  dummyGraphDataset,
  getDummyGraphSummary,
  validateDummyGraphDataset
} = require('./dummyGraphDataset');

describe('dummy graph dataset', () => {
  it('keeps every vertex compatible with the /type partition key', () => {
    const validation = validateDummyGraphDataset(dummyGraphDataset);

    expect(validation.errors).toEqual([]);
    expect(dummyGraphDataset.vertices.every(vertex => vertex.properties.type === vertex.label)).toBe(true);
  });

  it('covers the visualizer graph scenarios with a compact seed', () => {
    const summary = getDummyGraphSummary(dummyGraphDataset);

    expect(summary.vertexCount).toBe(13);
    expect(summary.edgeCount).toBe(18);
    expect(summary.vertexLabels).toEqual([
      'dataset',
      'incident',
      'note',
      'person',
      'project',
      'service',
      'tag'
    ]);
    expect(summary.edgeLabels).toEqual([
      'depends_on',
      'maintains',
      'mitigated_by',
      'monitors',
      'owns',
      'queries',
      'reported',
      'tagged',
      'uses'
    ]);
    expect(summary.orphanVertexIds).toEqual(['note-orphan-import-plan']);
    expect(summary.parallelPairs).toContain('person-ada->project-cosmos-visualizer');
  });
});
