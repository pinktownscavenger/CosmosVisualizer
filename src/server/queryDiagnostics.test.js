import { describe, expect, it } from 'vitest';

const {
  buildOperationDiagnostics,
  extractRequestCharge
} = require('./queryDiagnostics');

describe('request charge extraction', () => {
  it('prefers the total request charge from Map result attributes', () => {
    expect(extractRequestCharge({
      attributes: new Map([
        ['x-ms-request-charge', 2.5],
        ['x-ms-total-request-charge', 7.75]
      ])
    })).toBe(7.75);
  });

  it('falls back to request charge from object result attributes', () => {
    expect(extractRequestCharge({
      attributes: { 'x-ms-request-charge': '3.25' }
    })).toBe(3.25);
  });

  it('reads response error status attributes', () => {
    expect(extractRequestCharge({
      statusAttributes: new Map([['x-ms-total-request-charge', '4.5']])
    })).toBe(4.5);
  });

  it.each([
    undefined,
    null,
    '',
    '  ',
    '3.2 RUs',
    -1,
    '-2',
    Number.NaN,
    Number.POSITIVE_INFINITY,
    'Infinity'
  ])('rejects invalid request charge %s', (charge) => {
    expect(extractRequestCharge({
      attributes: { 'x-ms-total-request-charge': charge }
    })).toBeNull();
  });
});

describe('operation diagnostics', () => {
  it('sums valid request charges without rounding', () => {
    expect(buildOperationDiagnostics('query', [
      {
        kind: 'vertices',
        source: { attributes: { 'x-ms-total-request-charge': 31.4 } }
      },
      {
        kind: 'edges',
        source: { attributes: { 'x-ms-total-request-charge': 15.8 } }
      }
    ])).toEqual({
      operation: 'query',
      requestCharge: {
        total: 47.2,
        requests: [
          { kind: 'vertices', charge: 31.4 },
          { kind: 'edges', charge: 15.8 }
        ]
      }
    });
  });

  it('omits invalid requests while preserving a valid zero charge', () => {
    expect(buildOperationDiagnostics('query', [
      {
        kind: 'vertices',
        source: { attributes: { 'x-ms-total-request-charge': 0 } }
      },
      {
        kind: 'edges',
        source: { attributes: { 'x-ms-total-request-charge': 'invalid' } }
      }
    ])).toEqual({
      operation: 'query',
      requestCharge: {
        total: 0,
        requests: [{ kind: 'vertices', charge: 0 }]
      }
    });
  });

  it('omits the request charge object when metadata is unavailable', () => {
    expect(buildOperationDiagnostics('traverse-in', [
      { kind: 'vertices', source: new Error('unavailable') }
    ])).toEqual({ operation: 'traverse-in' });
  });
});
