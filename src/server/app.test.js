import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { rawEdges, rawVertices, normalizedGraph } from '../__fixtures__/graphFixtures';

const {
  MAX_QUERY_LENGTH,
  createApp,
  isValidQuery,
  validateConnectionInput
} = require('./app');

const makeClient = (submit) => ({ submit });
const result = (items, charge) => ({
  _items: items,
  attributes: charge === undefined
    ? new Map()
    : new Map([['x-ms-total-request-charge', charge]])
});
const makeManager = (client, connection = { mode: 'fixture', partitionKey: 'type' }) => ({
  getStatus: vi.fn().mockReturnValue({ status: 'connected', connection }),
  runGraphOperation: vi.fn(callback => callback({ client, connection })),
  switchConnection: vi.fn()
});

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
      .mockResolvedValueOnce(result(rawVertices, 31.4))
      .mockResolvedValueOnce(result(rawEdges, 15.8));
    const manager = makeManager(makeClient(submit));
    const app = createApp({ connectionManager: manager });

    const response = await request(app)
      .post('/query')
      .send({ query: 'g.V()', nodeLimit: 4 })
      .expect(200);

    expect(response.body).toEqual({
      data: normalizedGraph,
      diagnostics: {
        operation: 'query',
        requestCharge: {
          total: 47.2,
          requests: [
            { kind: 'vertices', charge: 31.4 },
            { kind: 'edges', charge: 15.8 }
          ]
        }
      }
    });
    expect(manager.runGraphOperation).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenNthCalledWith(1, 'g.V().limit(4)', {});
    expect(submit.mock.calls[1][0]).toContain('.bothE()');
  });

  it('does not submit an edge query when no vertices are returned', async () => {
    const submit = vi.fn().mockResolvedValueOnce(result([], 3.5));
    const app = createApp({ connectionManager: makeManager(makeClient(submit)) });

    const response = await request(app)
      .post('/query')
      .send({ query: 'g.V()' })
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      diagnostics: {
        operation: 'query',
        requestCharge: {
          total: 3.5,
          requests: [{ kind: 'vertices', charge: 3.5 }]
        }
      }
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('rejects missing, blank, and too-large queries', async () => {
    const submit = vi.fn();
    const app = createApp({ connectionManager: makeManager(makeClient(submit)) });
    const tooLargeQuery = 'g'.repeat(MAX_QUERY_LENGTH + 1);

    await request(app).post('/query').send({}).expect(400);
    await request(app).post('/query').send({ query: '   ' }).expect(400);
    await request(app).post('/query').send({ query: tooLargeQuery }).expect(400);

    expect(submit).not.toHaveBeenCalled();
  });

  it('rejects JSON bodies over the configured parser limit', async () => {
    const submit = vi.fn();
    const app = createApp({ connectionManager: makeManager(makeClient(submit)) });

    await request(app)
      .post('/query')
      .send({ query: 'g.V()', payload: 'x'.repeat(110 * 1024) })
      .expect(413);

    expect(submit).not.toHaveBeenCalled();
  });

  it('returns safe query failure diagnostics from a failed vertex request', async () => {
    const error = new Error('database unavailable');
    error.statusAttributes = new Map([['x-ms-total-request-charge', 3.1]]);
    const submit = vi.fn().mockRejectedValue(error);
    const app = createApp({ connectionManager: makeManager(makeClient(submit)) });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app)
      .post('/query')
      .send({ query: 'g.V()' })
      .expect(500)
      .expect({
        error: {
          code: 'COSMOS_QUERY_FAILED',
          message: 'Failed to fetch graph data'
        },
        diagnostics: {
          operation: 'query',
          requestCharge: {
            total: 3.1,
            requests: [{ kind: 'vertices', charge: 3.1 }]
          }
        }
      });

    expect(console.error).toHaveBeenCalledWith('Error fetching graph data:', error);
    console.error.mockRestore();
  });

  it('rejects invalid traversal requests', async () => {
    const submit = vi.fn();
    const app = createApp({ connectionManager: makeManager(makeClient(submit)) });

    await request(app).post('/traverse').send({ direction: 'out' }).expect(400);
    await request(app).post('/traverse').send({ nodeId: 'person-1', direction: 'sideways' }).expect(400);

    expect(submit).not.toHaveBeenCalled();
  });

  it('returns only outbound neighbors and edges connected to the selected node', async () => {
    const vertices = [rawVertices[0], rawVertices[1], rawVertices[2]];
    const edges = [rawEdges[0], rawEdges[1], rawEdges[2]];
    const submit = vi.fn()
      .mockResolvedValueOnce(result(vertices, 6.25))
      .mockResolvedValueOnce(result(edges, 2.5));
    const app = createApp({ connectionManager: makeManager(makeClient(submit)) });

    const response = await request(app)
      .post('/traverse')
      .send({ nodeId: 'person-1', direction: 'out', nodeLimit: 2 })
      .expect(200);

    expect(response.body.data.map(vertex => vertex.id)).toEqual(['person-1', 'company-1', 'project-1']);
    expect(response.body.data.flatMap(vertex => vertex.edges).map(edge => edge.id)).toEqual([
      'edge-1',
      'edge-2',
      'edge-3',
      'edge-1',
      'edge-2',
      'edge-3'
    ]);
    expect(response.body.diagnostics).toEqual({
      operation: 'traverse-out',
      requestCharge: {
        total: 8.75,
        requests: [
          { kind: 'vertices', charge: 6.25 },
          { kind: 'edges', charge: 2.5 }
        ]
      }
    });
    expect(submit.mock.calls[0][0]).toContain("g.V('person-1').union(identity(), out().limit(1)).dedup()");
    expect(submit.mock.calls[1][0]).toContain("g.V('person-1').outE()");
    expect(submit.mock.calls[1][0]).toContain("where(inV().hasId('company-1','project-1'))");
  });

  it('returns only inbound neighbors and edges connected to the selected node', async () => {
    const vertices = [rawVertices[2], rawVertices[0]];
    const edges = [rawEdges[1], rawEdges[2]];
    const submit = vi.fn()
      .mockResolvedValueOnce(result(vertices, 5))
      .mockResolvedValueOnce(result(edges, 1));
    const app = createApp({ connectionManager: makeManager(makeClient(submit)) });

    const response = await request(app)
      .post('/traverse')
      .send({ nodeId: 'project-1', direction: 'in', nodeLimit: 5 })
      .expect(200);

    expect(response.body.data.map(vertex => vertex.id)).toEqual(['project-1', 'person-1']);
    expect(response.body.data.flatMap(vertex => vertex.edges).map(edge => edge.id)).toEqual([
      'edge-2',
      'edge-3',
      'edge-2',
      'edge-3'
    ]);
    expect(response.body.diagnostics.operation).toBe('traverse-in');
    expect(submit.mock.calls[0][0]).toContain("g.V('project-1').union(identity(), in().limit(4)).dedup()");
    expect(submit.mock.calls[1][0]).toContain("g.V('project-1').inE()");
    expect(submit.mock.calls[1][0]).toContain("where(outV().hasId('person-1'))");
  });

  it('preserves completed vertex and failed edge charges in an error response', async () => {
    const edgeError = new Error('raw edge failure detail');
    edgeError.statusAttributes = {
      'x-ms-total-request-charge': 1.1
    };
    const submit = vi.fn()
      .mockResolvedValueOnce(result(rawVertices, 4.4))
      .mockRejectedValueOnce(edgeError);
    const app = createApp({ connectionManager: makeManager(makeClient(submit)) });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(app)
      .post('/query')
      .send({ query: 'g.V()' })
      .expect(500);

    expect(response.body).toEqual({
      error: {
        code: 'COSMOS_QUERY_FAILED',
        message: 'Failed to fetch graph data'
      },
      diagnostics: {
        operation: 'query',
        requestCharge: {
          total: 5.5,
          requests: [
            { kind: 'vertices', charge: 4.4 },
            { kind: 'edges', charge: 1.1 }
          ]
        }
      }
    });
    expect(JSON.stringify(response.body)).not.toContain('raw edge failure detail');
    expect(consoleError).toHaveBeenCalledWith('Error fetching graph data:', edgeError);
    consoleError.mockRestore();
  });

  it.each([
    ['NO_ACTIVE_CONNECTION', 503, 'NO_ACTIVE_CONNECTION', 'Connect to Cosmos DB before running a graph operation'],
    ['CONNECTION_SWITCH_ACTIVE', 409, 'OPERATION_IN_PROGRESS', 'Wait for the connection switch to finish'],
    ['GRAPH_OPERATION_ACTIVE', 409, 'OPERATION_IN_PROGRESS', 'Wait for the active graph operation to finish']
  ])('maps manager state %s to a stable HTTP error', async (managerCode, status, code, message) => {
    const managerError = new Error('internal manager detail');
    managerError.code = managerCode;
    const connectionManager = {
      getStatus: vi.fn(),
      runGraphOperation: vi.fn().mockRejectedValue(managerError),
      switchConnection: vi.fn()
    };

    await request(createApp({ connectionManager }))
      .post('/query')
      .send({ query: 'g.V()' })
      .expect(status)
      .expect({ error: { code, message } });
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

describe('connection routes', () => {
  const sanitizedConnection = {
    mode: 'cosmos',
    endpointHost: 'account.gremlin.cosmos.azure.com',
    database: 'db',
    container: 'graph',
    partitionKey: 'type'
  };
  const switchRequest = {
    endpoint: 'wss://account.gremlin.cosmos.azure.com:443/',
    primaryKey: 'secret-key',
    database: 'db',
    container: 'graph',
    partitionKey: '/type'
  };

  it('returns exact disconnected and connected status shapes without secrets', async () => {
    const disconnectedManager = {
      getStatus: vi.fn().mockReturnValue({ status: 'disconnected' }),
      switchConnection: vi.fn()
    };
    const connectedManager = {
      getStatus: vi.fn().mockReturnValue({
        status: 'connected',
        connection: sanitizedConnection
      }),
      switchConnection: vi.fn()
    };

    await request(createApp({ connectionManager: disconnectedManager }))
      .get('/connection')
      .expect(200)
      .expect({ status: 'disconnected' });
    const connected = await request(createApp({ connectionManager: connectedManager }))
      .get('/connection')
      .set('Origin', 'http://localhost:5173')
      .expect('Access-Control-Allow-Origin', 'http://localhost:5173')
      .expect(200);

    expect(connected.body).toEqual({
      status: 'connected',
      connection: sanitizedConnection
    });
    expect(JSON.stringify(connected.body)).not.toContain('primaryKey');
    expect(JSON.stringify(connected.body)).not.toContain('secret-key');
  });

  it('returns sanitized state and probe diagnostics after switching', async () => {
    const diagnostics = {
      operation: 'connection-probe',
      requestCharge: {
        total: 1.25,
        requests: [{ kind: 'probe', charge: 1.25 }]
      }
    };
    const connectionManager = {
      getStatus: vi.fn(),
      switchConnection: vi.fn().mockResolvedValue({
        connection: sanitizedConnection,
        diagnostics
      })
    };

    const response = await request(createApp({ connectionManager }))
      .put('/connection')
      .send(switchRequest)
      .expect(200);

    expect(response.body).toEqual({
      status: 'connected',
      connection: sanitizedConnection,
      diagnostics
    });
    expect(connectionManager.switchConnection).toHaveBeenCalledWith({
      ...switchRequest,
      partitionKey: 'type'
    });
    expect(JSON.stringify(response.body)).not.toContain('secret-key');
  });

  it('maps active-operation conflicts to a stable 409 error', async () => {
    const conflict = new Error('internal state detail');
    conflict.code = 'GRAPH_OPERATION_ACTIVE';
    const connectionManager = {
      getStatus: vi.fn(),
      switchConnection: vi.fn().mockRejectedValue(conflict)
    };

    await request(createApp({ connectionManager }))
      .put('/connection')
      .send(switchRequest)
      .expect(409)
      .expect({
        error: {
          code: 'OPERATION_IN_PROGRESS',
          message: 'Wait for the active graph operation to finish'
        }
      });
  });

  it('rejects invalid switch input before constructing a client', async () => {
    const connectionManager = {
      getStatus: vi.fn(),
      switchConnection: vi.fn()
    };

    await request(createApp({ connectionManager }))
      .put('/connection')
      .send({ ...switchRequest, endpoint: 'https://account.example.com' })
      .expect(400)
      .expect({
        error: {
          code: 'CONNECTION_INPUT_INVALID',
          message: 'Connection details are invalid'
        }
      });

    expect(connectionManager.switchConnection).not.toHaveBeenCalled();
  });

  it('returns safe failed-probe diagnostics and preserves manager status', async () => {
    const diagnostics = {
      operation: 'connection-probe',
      requestCharge: {
        total: 2.75,
        requests: [{ kind: 'probe', charge: 2.75 }]
      }
    };
    const failure = new Error('upstream included secret-key');
    failure.code = 'CONNECTION_PROBE_FAILED';
    failure.diagnostics = diagnostics;
    const connectionManager = {
      getStatus: vi.fn().mockReturnValue({
        status: 'connected',
        connection: { mode: 'fixture', partitionKey: 'type' }
      }),
      switchConnection: vi.fn().mockRejectedValue(failure)
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(createApp({ connectionManager }))
      .put('/connection')
      .send(switchRequest)
      .expect(502);

    expect(response.body).toEqual({
      error: {
        code: 'CONNECTION_PROBE_FAILED',
        message: 'Could not verify the Cosmos DB connection'
      },
      diagnostics
    });
    await request(createApp({ connectionManager }))
      .get('/connection')
      .expect(200)
      .expect({
        status: 'connected',
        connection: { mode: 'fixture', partitionKey: 'type' }
      });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret-key');
    consoleError.mockRestore();
  });
});

describe('connection input validation', () => {
  const valid = {
    endpoint: 'wss://account.gremlin.cosmos.azure.com:443/',
    primaryKey: 'key',
    database: 'db',
    container: 'graph',
    partitionKey: '/type'
  };

  it('normalizes valid input', () => {
    expect(validateConnectionInput(valid)).toEqual({
      ok: true,
      value: { ...valid, partitionKey: 'type' }
    });
  });

  it.each([
    [{ ...valid, endpoint: 'https://account.example.com' }],
    [{ ...valid, endpoint: 'wss://user:pass@account.example.com' }],
    [{ ...valid, endpoint: 'wss://account.example.com/?query=yes' }],
    [{ ...valid, endpoint: 'wss://account.example.com/#fragment' }],
    [{ ...valid, endpoint: 'not a URL' }],
    [{ ...valid, partitionKey: '/' }],
    [{ ...valid, partitionKey: '/nested/value' }]
  ])('rejects unsafe endpoint or partition input %#', (input) => {
    expect(validateConnectionInput(input)).toMatchObject({ ok: false });
  });

  it.each([
    'endpoint',
    'primaryKey',
    'database',
    'container',
    'partitionKey'
  ])('rejects missing, non-string, and blank %s values', (field) => {
    expect(validateConnectionInput({ ...valid, [field]: undefined }).ok).toBe(false);
    expect(validateConnectionInput({ ...valid, [field]: 42 }).ok).toBe(false);
    expect(validateConnectionInput({ ...valid, [field]: '   ' }).ok).toBe(false);
  });

  it.each([
    ['endpoint', 2048],
    ['primaryKey', 4096],
    ['database', 255],
    ['container', 255],
    ['partitionKey', 255]
  ])('rejects %s values beyond the configured length', (field, limit) => {
    expect(validateConnectionInput({ ...valid, [field]: 'x'.repeat(limit + 1) }).ok).toBe(false);
  });
});

describe('request body handling', () => {
  const makeApp = () => createApp({ connectionManager: makeManager(makeClient(vi.fn())) });

  it.each([
    ['/query', 'QUERY_INPUT_INVALID'],
    ['/traverse', 'TRAVERSAL_INPUT_INVALID']
  ])('rejects %s without a JSON body as invalid input', async (route, code) => {
    const response = await request(makeApp())
      .post(route)
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body.error.code).toBe(code);
  });

  it('rejects malformed JSON with a JSON error envelope', async () => {
    const response = await request(makeApp())
      .post('/query')
      .set('Content-Type', 'application/json')
      .send('{bad')
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body).toEqual({
      error: { code: 'REQUEST_BODY_INVALID', message: 'Request body must be valid JSON' }
    });
  });
});

describe('connection switch during shutdown', () => {
  it('reports a closed manager as unavailable instead of a failed probe', async () => {
    const manager = makeManager(makeClient(vi.fn()));
    manager.switchConnection.mockRejectedValue(
      Object.assign(new Error('closed'), { code: 'CONNECTION_MANAGER_CLOSED' })
    );

    const response = await request(createApp({ connectionManager: manager }))
      .put('/connection')
      .send({
        endpoint: 'wss://account.gremlin.cosmos.azure.com:443/',
        primaryKey: 'key',
        database: 'db',
        container: 'graph',
        partitionKey: 'type'
      })
      .expect(503);

    expect(response.body.error.code).toBe('PROXY_SHUTTING_DOWN');
  });
});
