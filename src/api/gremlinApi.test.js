import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  executeQuery,
  executeTraversal,
  getConnection,
  switchConnection
} from './gremlinApi';
import { CONNECTION_ENDPOINT, QUERY_ENDPOINT, TRAVERSE_ENDPOINT } from '../constants';
import { normalizedGraph } from '../__fixtures__/graphFixtures';

describe('gremlin API client', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('posts queries and preserves the graph response envelope', async () => {
    const diagnostics = { operation: 'query', requestCharge: { total: 1, requests: [] } };
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: normalizedGraph, diagnostics })
    });

    await expect(executeQuery({ query: 'g.V()', nodeLimit: 25 })).resolves.toEqual({
      data: normalizedGraph,
      diagnostics
    });

    expect(global.fetch).toHaveBeenCalledWith(QUERY_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: 'g.V()', nodeLimit: 25 })
    });
  });

  it('posts traversal requests to the traversal endpoint', async () => {
    const diagnostics = { operation: 'traverse-out' };
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: normalizedGraph, diagnostics })
    });

    await expect(executeTraversal({ nodeId: 'person-1', direction: 'out', nodeLimit: 25 })).resolves.toEqual({
      data: normalizedGraph,
      diagnostics
    });

    expect(global.fetch).toHaveBeenCalledWith(TRAVERSE_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nodeId: 'person-1', direction: 'out', nodeLimit: 25 })
    });
  });

  it('classifies traversal request failures with the same query feedback kinds', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({
        error: { code: 'TRAVERSAL_INPUT_INVALID', message: 'Traversal input is invalid' }
      })
    });

    await expect(executeTraversal({ nodeId: '', direction: 'out', nodeLimit: 25 }))
      .rejects
      .toMatchObject({ kind: 'validation', status: 400 });
  });

  it('throws when the server returns a non-success status', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({
        error: { code: 'COSMOS_QUERY_FAILED', message: 'Failed to fetch graph data' },
        diagnostics: {
          operation: 'query',
          requestCharge: { total: 3.1, requests: [{ kind: 'vertices', charge: 3.1 }] }
        }
      })
    });

    await expect(executeQuery({ query: 'g.V()', nodeLimit: 25 }))
      .rejects
      .toMatchObject({
        kind: 'server',
        status: 500,
        code: 'COSMOS_QUERY_FAILED',
        message: 'Failed to fetch graph data',
        diagnostics: {
          operation: 'query',
          requestCharge: { total: 3.1, requests: [{ kind: 'vertices', charge: 3.1 }] }
        }
      });
  });

  it('classifies validation and oversized query responses', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ error: { code: 'QUERY_INPUT_INVALID' } })
    });
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: vi.fn().mockResolvedValue({ error: { code: 'PAYLOAD_TOO_LARGE' } })
    });

    await expect(executeQuery({ query: '', nodeLimit: 25 }))
      .rejects
      .toMatchObject({ kind: 'validation', status: 400 });
    await expect(executeQuery({ query: 'g.V()', nodeLimit: 25 }))
      .rejects
      .toMatchObject({ kind: 'payload-too-large', status: 413 });
  });

  it('throws when fetch rejects', async () => {
    const networkError = new Error('network unavailable');
    global.fetch.mockRejectedValue(networkError);

    await expect(executeQuery({ query: 'g.V()', nodeLimit: 25 }))
      .rejects
      .toMatchObject({
        kind: 'network',
        message: 'network unavailable'
      });
  });

  it('gets sanitized connection status', async () => {
    const status = {
      status: 'connected',
      connection: { mode: 'fixture', partitionKey: 'type' }
    };
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(status)
    });

    await expect(getConnection()).resolves.toEqual(status);
    expect(global.fetch).toHaveBeenCalledWith(CONNECTION_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
  });

  it('puts one-shot connection credentials without retaining them', async () => {
    const config = {
      endpoint: 'wss://account.example.com:443/',
      primaryKey: 'secret-key',
      database: 'db',
      container: 'graph',
      partitionKey: 'type'
    };
    const response = {
      status: 'connected',
      connection: {
        mode: 'cosmos',
        endpointHost: 'account.example.com',
        database: 'db',
        container: 'graph',
        partitionKey: 'type'
      },
      diagnostics: { operation: 'connection-probe' }
    };
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response)
    });

    await expect(switchConnection(config)).resolves.toEqual(response);
    expect(global.fetch).toHaveBeenCalledWith(CONNECTION_ENDPOINT, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  });

  it('uses a fallback message when an error response is not JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: vi.fn().mockRejectedValue(new Error('invalid JSON'))
    });

    await expect(switchConnection({
      endpoint: 'wss://account.example.com',
      primaryKey: 'key',
      database: 'db',
      container: 'graph',
      partitionKey: 'type'
    })).rejects.toMatchObject({
      kind: 'server',
      status: 502,
      message: 'Request failed with status 502'
    });
  });
});
