import { describe, expect, it } from 'vitest';
import { analyzePartitionFanOut } from './partitionAnalysis';

const codes = (query, partitionKey = 'type') => {
  return analyzePartitionFanOut(query, partitionKey).map(finding => finding.code);
};

describe('partition fan-out risk recognition', () => {
  it.each([
    'g.V()',
    'g . V ( )',
    'g\n.\nV( )'
  ])('warns for an unscoped vertex scan: %s', (query) => {
    expect(codes(query)).toEqual(['UNSCOPED_VERTEX_SCAN']);
  });

  it.each([
    "g.V('person-1')",
    'g.V("person-1")'
  ])('warns for an id lookup without its partition value: %s', (query) => {
    expect(codes(query)).toEqual(['ID_WITHOUT_PARTITION']);
  });

  it.each([
    ["g.V().has('type', 'person').in()", 'INBOUND_TRAVERSAL'],
    ["g.V().has('type', 'person').inE()", 'INBOUND_TRAVERSAL'],
    ["g.V().has('type', 'person').both()", 'BIDIRECTIONAL_TRAVERSAL'],
    ["g.V().has('type', 'person').bothE()", 'BIDIRECTIONAL_TRAVERSAL']
  ])('warns for inbound or bidirectional access: %s', (query, code) => {
    expect(codes(query)).toContain(code);
  });

  it('deduplicates repeated signals while preserving distinct findings', () => {
    expect(codes("g.V('person-1').in().inE().both().bothE()")).toEqual([
      'ID_WITHOUT_PARTITION',
      'INBOUND_TRAVERSAL',
      'BIDIRECTIONAL_TRAVERSAL'
    ]);
  });
});

describe('recognized partition scope', () => {
  it.each([
    "g.V().has('type', 'person').limit(10)",
    'g.V( ).has( "type" , "person" )',
    "g.V('person-1').has('type', 'person')"
  ])('recognizes an early matching partition predicate: %s', (query) => {
    expect(codes(query)).toEqual([]);
  });

  it('recognizes a partition-and-id tuple', () => {
    expect(codes("g.V(['person', 'person-1'])")).toEqual([]);
    expect(codes('g.V(["person", "person-1"])')).toEqual([]);
  });

  it('recognizes a matching PartitionStrategy', () => {
    const query = "g.withStrategies(PartitionStrategy.build().partitionKey('type').create()).V()";

    expect(codes(query)).toEqual([]);
  });

  it('keeps directional warnings even when the start is partition scoped', () => {
    expect(codes("g.V().has('type', 'person').in()")).toEqual(['INBOUND_TRAVERSAL']);
  });

  it('does not treat another property as the configured partition key', () => {
    expect(codes("g.V().has('category', 'person')", 'type')).toEqual([
      'UNSCOPED_VERTEX_SCAN'
    ]);
  });
});

describe('false-positive avoidance and ambiguous input', () => {
  it('ignores traversal text inside strings and comments', () => {
    const query = `
      g.V().has('type', "text with .in() and escaped \\\".both()\\\"")
      // .inE()
      /* .bothE() */
    `;

    expect(codes(query)).toEqual([]);
  });

  it.each([
    '',
    '   ',
    'g.V()',
    "g.V('id')"
  ])('returns no findings without a usable partition property: %s', (query) => {
    expect(codes(query, '')).toEqual([]);
  });

  it.each([
    "g.V('unterminated)",
    'g.V() /* unterminated',
    'g.V(',
    'g.V(someFunction())'
  ])('returns no findings for malformed or unsupported input: %s', (query) => {
    expect(codes(query)).toEqual([]);
  });

  it('returns explanatory messages for every finding', () => {
    const findings = analyzePartitionFanOut("g.V('id').in()", 'type');

    expect(findings.every(finding => typeof finding.message === 'string' && finding.message.length > 20)).toBe(true);
  });
});
