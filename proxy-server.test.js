import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const { createServerRuntime, loadEnvFile } = require('./proxy-server');

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
    logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
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

  it.each([
    ['not a URL', 'not a url'],
    ['not a wss URL', 'https://account.gremlin.cosmos.azure.com:443/']
  ])('starts disconnected with a warning when COSMOS_ENDPOINT is %s', (_name, endpoint) => {
    const { runtime, dependencies } = createRuntime({
      COSMOS_ENDPOINT: endpoint,
      COSMOS_PRIMARY_KEY: 'secret-key',
      COSMOS_DATABASE: 'db',
      COSMOS_CONTAINER: 'graph',
      COSMOS_PARTITION_KEY: 'type'
    });

    expect(runtime.connectionManager.getStatus()).toEqual({ status: 'disconnected' });
    expect(dependencies.createGremlinClient).not.toHaveBeenCalled();
    expect(dependencies.logger.warn).toHaveBeenCalledOnce();
    expect(dependencies.logger.warn.mock.calls[0].join(' ')).not.toContain('secret-key');
  });
});

describe('proxy server network binding', () => {
  const startWith = (env) => {
    const app = { listen: vi.fn(() => ({ close: vi.fn() })) };
    const { runtime } = createRuntime(env, { createApp: vi.fn(() => app) });
    runtime.start();
    return app.listen.mock.calls[0];
  };

  it('listens on loopback only by default', () => {
    const [port, host] = startWith({});

    expect(port).toBe(3001);
    expect(host).toBe('127.0.0.1');
  });

  it('listens on the HOST override when one is set', () => {
    const [, host] = startWith({ HOST: '0.0.0.0' });

    expect(host).toBe('0.0.0.0');
  });
});

describe('loadEnvFile', () => {
  const writeEnvFile = (contents) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmos-env-'));
    const file = path.join(dir, '.env');
    fs.writeFileSync(file, contents);
    return file;
  };

  it('adds variables from the file that are not already set', () => {
    const env = {};
    loadEnvFile(writeEnvFile('COSMOS_DATABASE=db\nCOSMOS_CONTAINER=graph\n'), env);

    expect(env).toEqual({ COSMOS_DATABASE: 'db', COSMOS_CONTAINER: 'graph' });
  });

  it('keeps variables already set in the process environment', () => {
    const env = { USE_FIXTURE_DATA: 'true' };
    loadEnvFile(writeEnvFile('USE_FIXTURE_DATA=false\n'), env);

    expect(env.USE_FIXTURE_DATA).toBe('true');
  });

  it('does nothing when the file does not exist', () => {
    const env = {};
    loadEnvFile(path.join(os.tmpdir(), 'cosmos-env-missing', '.env'), env);

    expect(env).toEqual({});
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
      listen: vi.fn((_port, _host, callback) => {
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
