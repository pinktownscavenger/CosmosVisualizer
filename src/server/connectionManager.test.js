import { describe, expect, it, vi } from 'vitest';

const { createConnectionManager } = require('./connectionManager');

const cosmosConfig = {
  endpoint: 'wss://account.gremlin.cosmos.azure.com:443/',
  primaryKey: 'secret-key',
  database: 'db',
  container: 'graph',
  partitionKey: '/type'
};

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const makeClient = (submit = vi.fn()) => ({
  close: vi.fn().mockResolvedValue(undefined),
  submit
});

describe('connection manager status', () => {
  it('starts disconnected without an initial client', () => {
    const manager = createConnectionManager({ clientFactory: vi.fn() });

    expect(manager.getStatus()).toEqual({ status: 'disconnected' });
  });

  it('reports fixture startup metadata', () => {
    const manager = createConnectionManager({
      clientFactory: vi.fn(),
      initialClient: makeClient(),
      initialConnection: { mode: 'fixture', partitionKey: 'type' }
    });

    expect(manager.getStatus()).toEqual({
      status: 'connected',
      connection: { mode: 'fixture', partitionKey: 'type' }
    });
  });

  it('sanitizes Cosmos metadata and normalizes its partition property', () => {
    const manager = createConnectionManager({
      clientFactory: vi.fn(),
      initialClient: makeClient(),
      initialConnection: { mode: 'cosmos', ...cosmosConfig }
    });

    const status = manager.getStatus();
    expect(status).toEqual({
      status: 'connected',
      connection: {
        mode: 'cosmos',
        endpointHost: 'account.gremlin.cosmos.azure.com',
        database: 'db',
        container: 'graph',
        partitionKey: 'type'
      }
    });
    expect(JSON.stringify(status)).not.toContain('secret-key');
    expect(status.connection).not.toHaveProperty('primaryKey');
  });
});

describe('connection switching', () => {
  it('probes and atomically installs a candidate before closing the old client', async () => {
    const oldClient = makeClient();
    const candidate = makeClient(vi.fn().mockResolvedValue({
      _items: [],
      attributes: new Map([['x-ms-total-request-charge', 1.25]])
    }));
    const clientFactory = vi.fn().mockReturnValue(candidate);
    const manager = createConnectionManager({
      clientFactory,
      initialClient: oldClient,
      initialConnection: { mode: 'fixture', partitionKey: 'type' }
    });
    oldClient.close.mockImplementation(async () => {
      expect(manager.getStatus().connection.mode).toBe('cosmos');
    });

    await expect(manager.switchConnection(cosmosConfig)).resolves.toEqual({
      connection: {
        mode: 'cosmos',
        endpointHost: 'account.gremlin.cosmos.azure.com',
        database: 'db',
        container: 'graph',
        partitionKey: 'type'
      },
      diagnostics: {
        operation: 'connection-probe',
        requestCharge: {
          total: 1.25,
          requests: [{ kind: 'probe', charge: 1.25 }]
        }
      }
    });
    expect(clientFactory).toHaveBeenCalledWith(cosmosConfig);
    expect(candidate.submit).toHaveBeenCalledWith("g.V().has('type').limit(1)", {});
    expect(oldClient.close).toHaveBeenCalledOnce();
    expect(candidate.close).not.toHaveBeenCalled();
  });

  it('closes a failed candidate and preserves the active connection with diagnostics', async () => {
    const oldClient = makeClient();
    const upstream = new Error('raw upstream details');
    upstream.statusAttributes = {
      'x-ms-total-request-charge': 2.75
    };
    const candidate = makeClient(vi.fn().mockRejectedValue(upstream));
    const manager = createConnectionManager({
      clientFactory: vi.fn().mockReturnValue(candidate),
      initialClient: oldClient,
      initialConnection: { mode: 'fixture', partitionKey: 'type' }
    });

    await expect(manager.switchConnection(cosmosConfig)).rejects.toMatchObject({
      code: 'CONNECTION_PROBE_FAILED',
      diagnostics: {
        operation: 'connection-probe',
        requestCharge: {
          total: 2.75,
          requests: [{ kind: 'probe', charge: 2.75 }]
        }
      }
    });
    expect(candidate.close).toHaveBeenCalledOnce();
    expect(oldClient.close).not.toHaveBeenCalled();
    expect(manager.getStatus().connection.mode).toBe('fixture');
  });

  it('preserves the active client when candidate construction fails', async () => {
    const oldClient = makeClient();
    const manager = createConnectionManager({
      clientFactory: vi.fn(() => { throw new Error('factory failed'); }),
      initialClient: oldClient,
      initialConnection: { mode: 'fixture', partitionKey: 'type' }
    });

    await expect(manager.switchConnection(cosmosConfig)).rejects.toMatchObject({
      code: 'CONNECTION_PROBE_FAILED'
    });
    expect(oldClient.close).not.toHaveBeenCalled();
    expect(manager.getStatus().connection.mode).toBe('fixture');
  });
});

describe('connection concurrency and shutdown', () => {
  it('allows graph operations to overlap and blocks switching until all settle', async () => {
    const client = makeClient();
    const manager = createConnectionManager({
      clientFactory: vi.fn(),
      initialClient: client,
      initialConnection: { mode: 'fixture', partitionKey: 'type' }
    });
    const first = deferred();
    const second = deferred();
    const firstRun = manager.runGraphOperation(() => first.promise);
    const secondRun = manager.runGraphOperation(() => second.promise);

    await expect(manager.switchConnection(cosmosConfig)).rejects.toMatchObject({
      code: 'GRAPH_OPERATION_ACTIVE'
    });
    first.resolve('first');
    await expect(firstRun).resolves.toBe('first');
    await expect(manager.switchConnection(cosmosConfig)).rejects.toMatchObject({
      code: 'GRAPH_OPERATION_ACTIVE'
    });
    second.resolve('second');
    await expect(secondRun).resolves.toBe('second');
  });

  it('rejects graph work while a switch probe is active', async () => {
    const probe = deferred();
    const candidate = makeClient(vi.fn().mockReturnValue(probe.promise));
    const manager = createConnectionManager({
      clientFactory: vi.fn().mockReturnValue(candidate),
      initialClient: makeClient(),
      initialConnection: { mode: 'fixture', partitionKey: 'type' }
    });
    const switching = manager.switchConnection(cosmosConfig);

    await expect(manager.runGraphOperation(vi.fn())).rejects.toMatchObject({
      code: 'CONNECTION_SWITCH_ACTIVE'
    });
    probe.resolve({ _items: [], attributes: new Map() });
    await switching;
  });

  it('rejects graph work when disconnected', async () => {
    const manager = createConnectionManager({ clientFactory: vi.fn() });

    await expect(manager.runGraphOperation(vi.fn())).rejects.toMatchObject({
      code: 'NO_ACTIVE_CONNECTION'
    });
  });

  it('closes the active client once and leaves the manager disconnected', async () => {
    const client = makeClient();
    const manager = createConnectionManager({
      clientFactory: vi.fn(),
      initialClient: client,
      initialConnection: { mode: 'fixture', partitionKey: 'type' }
    });

    await manager.close();
    await manager.close();

    expect(client.close).toHaveBeenCalledOnce();
    expect(manager.getStatus()).toEqual({ status: 'disconnected' });
    await expect(manager.runGraphOperation(vi.fn())).rejects.toMatchObject({
      code: 'NO_ACTIVE_CONNECTION'
    });
  });

  it('closes an in-flight candidate instead of installing it after shutdown', async () => {
    const probe = deferred();
    const candidate = makeClient(vi.fn().mockReturnValue(probe.promise));
    const manager = createConnectionManager({
      clientFactory: vi.fn().mockReturnValue(candidate)
    });
    const switching = manager.switchConnection(cosmosConfig);

    await manager.close();
    probe.resolve({
      _items: [],
      attributes: new Map([['x-ms-total-request-charge', 1]])
    });

    await expect(switching).rejects.toMatchObject({ code: 'CONNECTION_MANAGER_CLOSED' });
    expect(candidate.close).toHaveBeenCalledOnce();
    expect(manager.getStatus()).toEqual({ status: 'disconnected' });
  });

  it('does not probe a candidate created after shutdown begins', async () => {
    const factory = deferred();
    const candidate = makeClient(vi.fn().mockResolvedValue({ _items: [], attributes: new Map() }));
    const manager = createConnectionManager({
      clientFactory: vi.fn().mockReturnValue(factory.promise)
    });
    const switching = manager.switchConnection(cosmosConfig);

    await manager.close();
    factory.resolve(candidate);

    await expect(switching).rejects.toMatchObject({ code: 'CONNECTION_MANAGER_CLOSED' });
    expect(candidate.submit).not.toHaveBeenCalled();
    expect(candidate.close).toHaveBeenCalledOnce();
    expect(manager.getStatus()).toEqual({ status: 'disconnected' });
  });
});
