const fs = require('fs');
const path = require('path');
const util = require('util');
const { createApp: defaultCreateApp, validateConnectionInput } = require('./src/server/app');
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

// Shell variables win over .env so `USE_FIXTURE_DATA=true npm run ...` still works
// with a .env that sets it to false. process.loadEnvFile() would override them.
function loadEnvFile(filePath, env = process.env) {
  let contents;
  try {
    contents = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  for (const [key, value] of Object.entries(util.parseEnv(contents))) {
    if (env[key] === undefined) {
      env[key] = value;
    }
  }
}

function createServerRuntime(env = process.env, dependencies = {}) {
  const createApp = dependencies.createApp || defaultCreateApp;
  const createConnectionManager = dependencies.createConnectionManager || defaultCreateConnectionManager;
  const createFixtureClient = dependencies.createFixtureClient || defaultCreateFixtureClient;
  const createGremlinClient = dependencies.createGremlinClient || defaultCreateGremlinClient;
  const signalSource = dependencies.signalSource || process;
  const logger = dependencies.logger || console;

  const port = Number(env.PORT || 3001);
  const host = env.HOST || '127.0.0.1';
  const allowedOrigin = env.CORS_ORIGIN || 'http://localhost:5173';
  const useFixtureData = env.USE_FIXTURE_DATA === 'true';
  const completeCosmosConfig = hasCompleteCosmosConfig(env);

  let initialClient = null;
  let initialConnection = null;
  let mode = 'disconnected';
  let cosmosConfig = null;

  if (useFixtureData) {
    initialClient = createFixtureClient();
    initialConnection = { mode: 'fixture', partitionKey: 'type' };
    mode = 'fixture data';
  } else if (completeCosmosConfig) {
    const validation = validateConnectionInput({
      endpoint: env.COSMOS_ENDPOINT,
      primaryKey: env.COSMOS_PRIMARY_KEY,
      database: env.COSMOS_DATABASE,
      container: env.COSMOS_CONTAINER,
      partitionKey: env.COSMOS_PARTITION_KEY
    });
    if (validation.ok) {
      cosmosConfig = validation.value;
    } else {
      logger.warn(
        'Ignoring invalid COSMOS_* settings; starting disconnected. '
        + 'COSMOS_ENDPOINT must be a wss:// URL and COSMOS_PARTITION_KEY a single property name.'
      );
    }
  }

  if (cosmosConfig) {
    initialClient = createGremlinClient(cosmosConfig);
    initialConnection = {
      mode: 'cosmos',
      endpoint: cosmosConfig.endpoint,
      database: cosmosConfig.database,
      container: cosmosConfig.container,
      partitionKey: cosmosConfig.partitionKey
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
    httpServer = app.listen(port, host, () => {
      if (!handlersRegistered && typeof signalSource.once === 'function') {
        signalSource.once('SIGINT', handleSignal);
        signalSource.once('SIGTERM', handleSignal);
        handlersRegistered = true;
      }
      logger.log(`CosmosVisualizer proxy listening on ${host}:${port} using ${mode}`);
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
  loadEnvFile(path.join(__dirname, '.env'));
  createServerRuntime().start();
}

module.exports = {
  COSMOS_CONFIG_KEYS,
  createServerRuntime,
  hasCompleteCosmosConfig,
  loadEnvFile
};
