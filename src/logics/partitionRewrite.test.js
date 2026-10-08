import { describe, expect, it } from 'vitest';
import { scopeQueryToPartition } from './partitionRewrite';

const caretContext = ({ query, cursor }) => `${query.slice(0, cursor)}|${query.slice(cursor)}`;

describe('scopeQueryToPartition', () => {
  it('adds an empty partition filter after g.V() with the caret inside the quotes', () => {
    const result = scopeQueryToPartition('g.V().limit(25)', 'type', '');

    expect(result.query).toBe("g.V().has('type', '').limit(25)");
    expect(caretContext(result)).toBe("g.V().has('type', '|').limit(25)");
  });

  it('scopes an id lookup and pre-fills an escaped value with the caret after it', () => {
    const result = scopeQueryToPartition("g.V('a\\'b').out()", 'type', "O'Brien");

    expect(result.query).toBe("g.V('a\\'b').has('type', 'O\\'Brien').out()");
    expect(caretContext(result)).toBe("g.V('a\\'b').has('type', 'O\\'Brien|').out()");
  });

  it('recognises double-quoted ids', () => {
    expect(scopeQueryToPartition('g.V("x").both()', 'pk', 'p1').query).toBe('g.V("x").has(\'pk\', \'p1\').both()');
  });

  it('keeps leading whitespace and normalises a /path partition key', () => {
    expect(scopeQueryToPartition('  g.V()', '/tenant', '').query).toBe("  g.V().has('tenant', '')");
  });

  it('still scopes a query that filters a different property', () => {
    expect(scopeQueryToPartition("g.V().has('name','x')", 'type', '').query).toBe("g.V().has('type', '').has('name','x')");
  });

  it.each([
    ["g.V().has('type', 'x')", 'type'],
    ['g.V().has("type", "x").out()', 'type'],
    ['g.E().limit(5)', 'type'],
    ['V().limit(5)', 'type'],
    ['g.V().limit(25)', null],
    ['g.V().limit(25)', '  ']
  ])('returns null for %s with partition key %s', (query, partitionKey) => {
    expect(scopeQueryToPartition(query, partitionKey, '')).toBeNull();
  });

  it.each([
    [1843, "g.V().has('tenant', 1843).limit(2)", "g.V().has('tenant', 1843|).limit(2)"],
    [true, "g.V().has('tenant', true).limit(2)", "g.V().has('tenant', true|).limit(2)"]
  ])('inserts the typed partition value %s unquoted', (value, expected, caret) => {
    const result = scopeQueryToPartition('g.V().limit(2)', 'tenant', value);
    expect(result.query).toBe(expected);
    expect(caretContext(result)).toBe(caret);
  });
});
