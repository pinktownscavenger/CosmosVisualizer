import { afterEach, describe, expect, it, vi } from 'vitest';

const gremlin = require('gremlin');
const { createGremlinClient } = require('./gremlinClientFactory');

describe('Gremlin client factory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs an authenticated Cosmos Gremlin client without mutating config', () => {
    const authenticator = vi.spyOn(
      gremlin.driver.auth,
      'PlainTextSaslAuthenticator'
    );
    const Client = vi.spyOn(gremlin.driver, 'Client');
    const config = {
      endpoint: 'wss://account.gremlin.cosmos.azure.com:443/',
      primaryKey: 'secret-key',
      database: 'db',
      container: 'graph',
      partitionKey: 'type'
    };
    const original = { ...config };

    createGremlinClient(config);

    expect(authenticator).toHaveBeenCalledWith(
      '/dbs/db/colls/graph',
      'secret-key'
    );
    expect(Client).toHaveBeenCalledWith(config.endpoint, {
      authenticator: authenticator.mock.results[0].value,
      traversalSource: 'g',
      mimeType: 'application/vnd.gremlin-v2.0+json',
      rejectUnauthorized: true
    });
    expect(config).toEqual(original);
    expect(Client.mock.calls[0][1]).not.toHaveProperty('primaryKey');
    expect(Client.mock.calls[0][1]).not.toHaveProperty('password');
  });
});
