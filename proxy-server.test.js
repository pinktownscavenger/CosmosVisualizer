import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

const { createServerRuntime } = require('./proxy-server');

const createClient = () => ({
  submit: vi.fn(),
  close: vi.fn().mockResolvedValue()
});

const createRuntime = (env, overrides = {}) => {
  const client = createClient();
  const dependencies = {
    createApp: vi.fn(() => ({ listen: vi.fn() })),
    createFixtureClient: vi.fn(() => client),
    createGremlinClient: vi.fn(() => client),
    logger: { log: vi.fn(), error: vi.fn() },
    ...overrides
  };
  return { runtime: createServerRuntime(env, dependencies), dependencies, client };
};

describe('proxy server runtime modes', () => {
  it('starts connected when the complete Cosmos configuration is present', () => {
    const { runtime, dependencies } = createRuntime({
      COSMOS_ENDPOINT: 'wss://account.gremlin.cosmos.azure.com:443/',
      COSMOS_PRIMARY_KEY: 'not-logged',
      COSMOS_DATABASE: 'db',
      COSMOS_CONTAINER: 'graph',
      COSMOS_PARTITION_KEY: '/type'
    });

    expect(runtime.connectionManager.getStatus()).toEqual({
      status: 'connected',
      connection: {
        mode: 'cosmos',
        endpointHost: 'account.gremlin.cosmos.azure.com',
        database: 'db',
        container: 'graph',
        partitionKey: 'type'
      }
    });
    expect(dependencies.createGremlinClient).toHaveBeenCalledOnce();
  });

  it('starts fixture mode connected with the type partition property', () => {
    const { runtime, dependencies } = createRuntime({ USE_FIXTURE_DATA: 'true' });

    expect(runtime.connectionManager.getStatus()).toEqual({
      status: 'connected',
      connection: { mode: 'fixture', partitionKey: 'type' }
    });
    expect(dependencies.createFixtureClient).toHaveBeenCalledOnce();
    expect(dependencies.createGremlinClient).not.toHaveBeenCalled();
  });

  it('starts disconnected when any Cosmos setting is incomplete', () => {
    const { runtime, dependencies } = createRuntime({
      COSMOS_ENDPOINT: 'wss://account.gremlin.cosmos.azure.com:443/',
      COSMOS_DATABASE: 'db',
      COSMOS_CONTAINER: 'graph',
      COSMOS_PARTITION_KEY: 'type'
    });

    expect(runtime.connectionManager.getStatus()).toEqual({ status: 'disconnected' });
    expect(dependencies.createGremlinClient).not.toHaveBeenCalled();
  });
});

describe('proxy server lifecycle', () => {
  it.each(['SIGINT', 'SIGTERM'])('closes the manager before the HTTP server once on %s', async (signal) => {
    const events = [];
    const signalSource = new EventEmitter();
    let listeningCallback;
    const httpServer = {
      close: vi.fn((callback) => {
        events.push('server');
        callback();
      })
    };
    const manager = {
      close: vi.fn(async () => { events.push('manager'); }),
      getStatus: vi.fn(() => ({ status: 'disconnected' }))
    };
    const app = {
      listen: vi.fn((_port, callback) => {
        listeningCallback = callback;
        return httpServer;
      })
    };
    const { runtime } = createRuntime({}, {
      createApp: vi.fn(() => app),
      createConnectionManager: vi.fn(() => manager),
      signalSource
    });

    runtime.start();
    listeningCallback();
    signalSource.emit(signal);
    signalSource.emit(signal);
    await runtime.shutdown();

    expect(events).toEqual(['manager', 'server']);
    expect(manager.close).toHaveBeenCalledOnce();
    expect(httpServer.close).toHaveBeenCalledOnce();
  });
});
