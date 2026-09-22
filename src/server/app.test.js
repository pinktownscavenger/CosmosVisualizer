import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { rawEdges, rawVertices, normalizedGraph } from '../__fixtures__/graphFixtures';

const { MAX_QUERY_LENGTH, createApp, isValidQuery } = require('./app');

const makeClient = (submit) => ({ submit });

describe('server app', () => {
  it('returns health status', async () => {
    const app = createApp({ client: makeClient(vi.fn()) });

    await request(app)
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('allows the Vite dev origin by default', async () => {
    const app = createApp({ client: makeClient(vi.fn()) });

    await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173')
      .expect('Access-Control-Allow-Origin', 'http://localhost:5173')
      .expect(200);
  });

  it('runs vertex and edge queries and returns normalized graph data', async () => {
    const submit = vi.fn()
      .mockResolvedValueOnce({ _items: rawVertices })
      .mockResolvedValueOnce({ _items: rawEdges });
    const app = createApp({ client: makeClient(submit) });

    const response = await request(app)
      .post('/query')
      .send({ query: 'g.V()', nodeLimit: 4 })
      .expect(200);

    expect(response.body).toEqual(normalizedGraph);
    expect(submit).toHaveBeenNthCalledWith(1, 'g.V().limit(4)', {});
    expect(submit.mock.calls[1][0]).toContain('.bothE()');
  });

  it('does not submit an edge query when no vertices are returned', async () => {
    const submit = vi.fn().mockResolvedValueOnce({ _items: [] });
    const app = createApp({ client: makeClient(submit) });

    const response = await request(app)
      .post('/query')
      .send({ query: 'g.V()' })
      .expect(200);

    expect(response.body).toEqual([]);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('rejects missing, blank, and too-large queries', async () => {
    const submit = vi.fn();
    const app = createApp({ client: makeClient(submit) });
    const tooLargeQuery = 'g'.repeat(MAX_QUERY_LENGTH + 1);

    await request(app).post('/query').send({}).expect(400);
    await request(app).post('/query').send({ query: '   ' }).expect(400);
    await request(app).post('/query').send({ query: tooLargeQuery }).expect(400);

    expect(submit).not.toHaveBeenCalled();
  });

  it('rejects JSON bodies over the configured parser limit', async () => {
    const submit = vi.fn();
    const app = createApp({ client: makeClient(submit) });

    await request(app)
      .post('/query')
      .send({ query: 'g.V()', payload: 'x'.repeat(110 * 1024) })
      .expect(413);

    expect(submit).not.toHaveBeenCalled();
  });

  it('returns a server error when the Gremlin client fails', async () => {
    const error = new Error('database unavailable');
    const submit = vi.fn().mockRejectedValue(error);
    const app = createApp({ client: makeClient(submit) });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app)
      .post('/query')
      .send({ query: 'g.V()' })
      .expect(500)
      .expect({ error: 'Failed to fetch graph data' });

    expect(console.error).toHaveBeenCalledWith('Error fetching graph data:', error);
    console.error.mockRestore();
  });

  it('rejects invalid traversal requests', async () => {
    const submit = vi.fn();
    const app = createApp({ client: makeClient(submit) });

    await request(app).post('/traverse').send({ direction: 'out' }).expect(400);
    await request(app).post('/traverse').send({ nodeId: 'person-1', direction: 'sideways' }).expect(400);

    expect(submit).not.toHaveBeenCalled();
  });

  it('returns only outbound neighbors and edges connected to the selected node', async () => {
    const vertices = [rawVertices[0], rawVertices[1], rawVertices[2]];
    const edges = [rawEdges[0], rawEdges[1], rawEdges[2]];
    const submit = vi.fn()
      .mockResolvedValueOnce({ _items: vertices })
      .mockResolvedValueOnce({ _items: edges });
    const app = createApp({ client: makeClient(submit) });

    const response = await request(app)
      .post('/traverse')
      .send({ nodeId: 'person-1', direction: 'out', nodeLimit: 2 })
      .expect(200);

    expect(response.body.map(vertex => vertex.id)).toEqual(['person-1', 'company-1', 'project-1']);
    expect(response.body.flatMap(vertex => vertex.edges).map(edge => edge.id)).toEqual([
      'edge-1',
      'edge-2',
      'edge-3',
      'edge-1',
      'edge-2',
      'edge-3'
    ]);
    expect(submit.mock.calls[0][0]).toContain("g.V('person-1').union(identity(), out().limit(2)).dedup()");
    expect(submit.mock.calls[1][0]).toContain("g.V('person-1').outE()");
    expect(submit.mock.calls[1][0]).toContain("where(inV().hasId('company-1','project-1'))");
  });

  it('returns only inbound neighbors and edges connected to the selected node', async () => {
    const vertices = [rawVertices[2], rawVertices[0]];
    const edges = [rawEdges[1], rawEdges[2]];
    const submit = vi.fn()
      .mockResolvedValueOnce({ _items: vertices })
      .mockResolvedValueOnce({ _items: edges });
    const app = createApp({ client: makeClient(submit) });

    const response = await request(app)
      .post('/traverse')
      .send({ nodeId: 'project-1', direction: 'in', nodeLimit: 5 })
      .expect(200);

    expect(response.body.map(vertex => vertex.id)).toEqual(['project-1', 'person-1']);
    expect(response.body.flatMap(vertex => vertex.edges).map(edge => edge.id)).toEqual([
      'edge-2',
      'edge-3',
      'edge-2',
      'edge-3'
    ]);
    expect(submit.mock.calls[0][0]).toContain("g.V('project-1').union(identity(), in().limit(5)).dedup()");
    expect(submit.mock.calls[1][0]).toContain("g.V('project-1').inE()");
    expect(submit.mock.calls[1][0]).toContain("where(outV().hasId('person-1'))");
  });
});

describe('query validation', () => {
  it('accepts non-empty strings within the size limit', () => {
    expect(isValidQuery('g.V()')).toBe(true);
    expect(isValidQuery(' g.V() ')).toBe(true);
  });

  it('rejects non-strings, blanks, and over-limit strings', () => {
    expect(isValidQuery()).toBe(false);
    expect(isValidQuery(42)).toBe(false);
    expect(isValidQuery('')).toBe(false);
    expect(isValidQuery(' '.repeat(5))).toBe(false);
    expect(isValidQuery('g'.repeat(MAX_QUERY_LENGTH + 1))).toBe(false);
  });
});
