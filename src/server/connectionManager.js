const { makeConnectionProbeQuery, normalizePartitionKeyProperty } = require('./graphHelpers');
const { buildOperationDiagnostics } = require('./queryDiagnostics');

function managerError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

async function closeQuietly(client) {
  if (client && typeof client.close === 'function') {
    try {
      await client.close();
    } catch (_) {
      // Preserve the original probe/factory/shutdown failure.
    }
  }
}

function sanitizeConnection(connection) {
  if (!connection) {
    return null;
  }

  const partitionKey = normalizePartitionKeyProperty(connection.partitionKey);
  if (connection.mode === 'fixture') {
    return { mode: 'fixture', partitionKey };
  }

  return {
    mode: 'cosmos',
    endpointHost: new URL(connection.endpoint).hostname,
    database: connection.database,
    container: connection.container,
    partitionKey
  };
}

function createConnectionManager({ clientFactory, initialClient = null, initialConnection = null }) {
  let activeClient = initialClient;
  let activeConnection = initialClient ? sanitizeConnection(initialConnection) : null;
  let activeOperations = 0;
  let switching = false;
  let closed = false;

  function getStatus() {
    if (!activeClient || !activeConnection) {
      return { status: 'disconnected' };
    }

    return {
      status: 'connected',
      connection: { ...activeConnection }
    };
  }

  async function runGraphOperation(callback) {
    if (closed || !activeClient || !activeConnection) {
      throw managerError('NO_ACTIVE_CONNECTION', 'No active graph connection');
    }
    if (switching) {
      throw managerError('CONNECTION_SWITCH_ACTIVE', 'A connection switch is in progress');
    }

    activeOperations += 1;
    try {
      return await callback({
        client: activeClient,
        connection: { ...activeConnection }
      });
    } finally {
      activeOperations -= 1;
    }
  }

  async function switchConnection(config) {
    if (closed) {
      throw managerError('CONNECTION_MANAGER_CLOSED', 'The connection manager is closed');
    }
    if (switching) {
      throw managerError('CONNECTION_SWITCH_ACTIVE', 'A connection switch is in progress');
    }
    if (activeOperations > 0) {
      throw managerError('GRAPH_OPERATION_ACTIVE', 'A graph operation is in progress');
    }

    switching = true;
    let candidate = null;
    try {
      candidate = await clientFactory(config);
      if (closed) {
        throw managerError('CONNECTION_MANAGER_CLOSED', 'The connection manager is closed');
      }
      const partitionKey = normalizePartitionKeyProperty(config.partitionKey);
      const probeResult = await candidate.submit(makeConnectionProbeQuery(partitionKey), {});
      const diagnostics = buildOperationDiagnostics('connection-probe', [
        { kind: 'probe', source: probeResult }
      ]);
      if (closed) {
        throw managerError('CONNECTION_MANAGER_CLOSED', 'The connection manager is closed');
      }
      const connection = sanitizeConnection({ mode: 'cosmos', ...config, partitionKey });
      const previousClient = activeClient;

      activeClient = candidate;
      activeConnection = connection;
      candidate = null;

      if (previousClient && typeof previousClient.close === 'function') {
        try {
          await previousClient.close();
        } catch (_) {
          // The new connection is already active; failed cleanup must not roll it back.
        }
      }

      return { connection: { ...connection }, diagnostics };
    } catch (cause) {
      if (cause && cause.code === 'CONNECTION_MANAGER_CLOSED') {
        await closeQuietly(candidate);
        throw cause;
      }

      const diagnostics = buildOperationDiagnostics('connection-probe', [
        { kind: 'probe', source: cause }
      ]);

      await closeQuietly(candidate);

      throw managerError('CONNECTION_PROBE_FAILED', 'Connection probe failed', {
        cause,
        diagnostics
      });
    } finally {
      switching = false;
    }
  }

  async function close() {
    if (closed) {
      return;
    }

    closed = true;
    const client = activeClient;
    activeClient = null;
    activeConnection = null;

    if (client && typeof client.close === 'function') {
      await client.close();
    }
  }

  return {
    close,
    getStatus,
    runGraphOperation,
    switchConnection
  };
}

module.exports = {
  createConnectionManager,
  sanitizeConnection
};
