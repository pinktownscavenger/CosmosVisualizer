import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { executeQuery } from './gremlinApi';
import { QUERY_ENDPOINT } from '../constants';
import { normalizedGraph } from '../__fixtures__/graphFixtures';

describe('gremlin API client', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('posts queries to the configured endpoint and returns Axios-like response data', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(normalizedGraph)
    });

    await expect(executeQuery({ query: 'g.V()', nodeLimit: 25 })).resolves.toEqual({
      data: normalizedGraph
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

  it('throws when the server returns a non-success status', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn()
    });

    await expect(executeQuery({ query: 'g.V()', nodeLimit: 25 }))
      .rejects
      .toMatchObject({
        kind: 'server',
        status: 500,
        message: 'Query request failed with status 500'
      });
  });

  it('classifies validation and oversized query responses', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: vi.fn()
    });
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: vi.fn()
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
});
