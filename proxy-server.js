const { createApp: defaultCreateApp } = require('./src/server/app');
const { createConnectionManager: defaultCreateConnectionManager } = require('./src/server/connectionManager');
const { createFixtureClient: defaultCreateFixtureClient } = require('./src/server/fixtureClient');
const { createGremlinClient: defaultCreateGremlinClient } = require('./src/server/gremlinClientFactory');

const COSMOS_CONFIG_KEYS = [
  'COSMOS_ENDPOINT',
  'COSMOS_PRIMARY_KEY',
  'COSMOS_DATABASE',
  'COSMOS_CONTAINER',
  'COSMOS_PARTITION_KEY'
];

const hasCompleteCosmosConfig = (env) => COSMOS_CONFIG_KEYS.every((key) => (
  typeof env[key] === 'string' && env[key].trim().length > 0
));

function createServerRuntime(env = process.env, dependencies = {}) {
  const createApp = dependencies.createApp || defaultCreateApp;
  const createConnectionManager = dependencies.createConnectionManager || defaultCreateConnectionManager;
  const createFixtureClient = dependencies.createFixtureClient || defaultCreateFixtureClient;
  const createGremlinClient = dependencies.createGremlinClient || defaultCreateGremlinClient;
  const signalSource = dependencies.signalSource || process;
  const logger = dependencies.logger || console;

  const port = Number(env.PORT || 3001);
  const allowedOrigin = env.CORS_ORIGIN || 'http://localhost:5173';
  const useFixtureData = env.USE_FIXTURE_DATA === 'true';
  const completeCosmosConfig = hasCompleteCosmosConfig(env);

  let initialClient = null;
  let initialConnection = null;
  let mode = 'disconnected';

  if (useFixtureData) {
    initialClient = createFixtureClient();
    initialConnection = { mode: 'fixture', partitionKey: 'type' };
    mode = 'fixture data';
  } else if (completeCosmosConfig) {
    const config = {
      endpoint: env.COSMOS_ENDPOINT.trim(),
      primaryKey: env.COSMOS_PRIMARY_KEY.trim(),
      database: env.COSMOS_DATABASE.trim(),
      container: env.COSMOS_CONTAINER.trim(),
      partitionKey: env.COSMOS_PARTITION_KEY.trim()
    };
    initialClient = createGremlinClient(config);
    initialConnection = {
      mode: 'cosmos',
      endpoint: config.endpoint,
      database: config.database,
      container: config.container,
      partitionKey: config.partitionKey
    };
    mode = 'Cosmos DB';
  }

  const connectionManager = createConnectionManager({
    clientFactory: createGremlinClient,
    initialClient,
    initialConnection
  });
  const app = createApp({ connectionManager, allowedOrigin });
  let httpServer = null;
  let shutdownPromise = null;
  let handlersRegistered = false;

  function handleSignal() {
    shutdown().catch((error) => {
      logger.error('Failed to shut down the Cosmos proxy cleanly:', error);
    });
  }

  const removeSignalHandlers = () => {
    if (!handlersRegistered || typeof signalSource.removeListener !== 'function') {
      return;
    }
    signalSource.removeListener('SIGINT', handleSignal);
    signalSource.removeListener('SIGTERM', handleSignal);
    handlersRegistered = false;
  };

  const closeHttpServer = () => new Promise((resolve, reject) => {
    if (!httpServer || typeof httpServer.close !== 'function') {
      resolve();
      return;
    }
    httpServer.close((error) => error ? reject(error) : resolve());
  });

  const shutdown = () => {
    if (!shutdownPromise) {
      shutdownPromise = (async () => {
        removeSignalHandlers();
        try {
          await connectionManager.close();
        } finally {
          await closeHttpServer();
        }
      })();
    }
    return shutdownPromise;
  };

  const start = () => {
    if (httpServer) {
      return httpServer;
    }
    httpServer = app.listen(port, () => {
      if (!handlersRegistered && typeof signalSource.once === 'function') {
        signalSource.once('SIGINT', handleSignal);
        signalSource.once('SIGTERM', handleSignal);
        handlersRegistered = true;
      }
      logger.log(`CosmosVisualizer proxy listening on port ${port} using ${mode}`);
    });
    return httpServer;
  };

  return {
    app,
    connectionManager,
    shutdown,
    start
  };
}

if (require.main === module) {
  createServerRuntime().start();
}

module.exports = {
  COSMOS_CONFIG_KEYS,
  createServerRuntime,
  hasCompleteCosmosConfig
};
