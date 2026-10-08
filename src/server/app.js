const express = require('express');
const cors = require('cors');
const {
  makeEdgeQuery,
  makeTraversalEdgeQuery,
  makeTraversalVertexQuery,
  makeVertexQuery,
  normalizePartitionKeyProperty,
  stringifyGremlinId,
  verticesToJson
} = require('./graphHelpers');
const { buildOperationDiagnostics } = require('./queryDiagnostics');

const MAX_QUERY_LENGTH = 10000;
const CONNECTION_FIELD_LIMITS = {
  endpoint: 2048,
  primaryKey: 4096,
  database: 255,
  container: 255,
  partitionKey: 255
};

function isValidQuery(query) {
  return typeof query === 'string' && query.trim().length > 0 && query.length <= MAX_QUERY_LENGTH;
}

function isValidTraversalRequest({ nodeId, direction }) {
  return typeof nodeId === 'string'
    && nodeId.trim().length > 0
    && (direction === 'out' || direction === 'in');
}

function validateConnectionInput(body) {
  const input = body && typeof body === 'object' ? body : {};
  const normalized = {};

  for (const [field, limit] of Object.entries(CONNECTION_FIELD_LIMITS)) {
    const value = input[field];
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > limit) {
      return { ok: false, message: 'Connection details are invalid' };
    }
    normalized[field] = value.trim();
  }

  let endpoint;
  try {
    endpoint = new URL(normalized.endpoint);
  } catch (_) {
    return { ok: false, message: 'Connection details are invalid' };
  }

  if (
    endpoint.protocol !== 'wss:'
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash
  ) {
    return { ok: false, message: 'Connection details are invalid' };
  }

  const partitionKey = normalizePartitionKeyProperty(normalized.partitionKey);
  if (!partitionKey || partitionKey.includes('/')) {
    return { ok: false, message: 'Connection details are invalid' };
  }

  return {
    ok: true,
    value: { ...normalized, partitionKey }
  };
}

function sendError(res, status, code, message, diagnostics) {
  const body = { error: { code, message } };
  if (diagnostics) {
    body.diagnostics = diagnostics;
  }
  res.status(status).send(body);
}

async function submitTracked(client, kind, query, requests) {
  try {
    const result = await client.submit(query, {});
    requests.push({ kind, source: result });
    return result;
  } catch (error) {
    requests.push({ kind, source: error });
    throw error;
  }
}

// Cosmos reports malformed traversals as script evaluation failures; those need an edit, not a retry.
function isQueryRejection(error) {
  return Boolean(error && /Gremlin Query (Syntax|Compilation) Error/i.test(error.message || ''));
}

function sendQueryRejection(res, operation, requests) {
  sendError(
    res,
    400,
    'COSMOS_QUERY_REJECTED',
    'Cosmos DB rejected the Gremlin query. Check its syntax.',
    buildOperationDiagnostics(operation, requests)
  );
}

function sendManagerStateError(res, error) {
  if (error && error.code === 'NO_ACTIVE_CONNECTION') {
    sendError(
      res,
      503,
      'NO_ACTIVE_CONNECTION',
      'Connect to Cosmos DB before running a graph operation'
    );
    return true;
  }

  if (error && error.code === 'CONNECTION_SWITCH_ACTIVE') {
    sendError(
      res,
      409,
      'OPERATION_IN_PROGRESS',
      'Wait for the connection switch to finish'
    );
    return true;
  }

  if (error && error.code === 'GRAPH_OPERATION_ACTIVE') {
    sendError(
      res,
      409,
      'OPERATION_IN_PROGRESS',
      'Wait for the active graph operation to finish'
    );
    return true;
  }

  return false;
}

function createApp({ connectionManager, allowedOrigin = 'http://localhost:5173' }) {
  const app = express();

  app.use(cors({
    origin: allowedOrigin,
    credentials: true
  }));

  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/connection', (req, res) => {
    res.json(connectionManager
      ? connectionManager.getStatus()
      : { status: 'disconnected' });
  });

  app.put('/connection', async (req, res) => {
    const validation = validateConnectionInput(req.body);
    if (!validation.ok) {
      sendError(res, 400, 'CONNECTION_INPUT_INVALID', validation.message);
      return;
    }

    if (!connectionManager) {
      sendError(res, 503, 'NO_CONNECTION_MANAGER', 'Connection switching is unavailable');
      return;
    }

    try {
      const result = await connectionManager.switchConnection(validation.value);
      res.json({ status: 'connected', ...result });
    } catch (error) {
      const code = error && error.code;
      console.error('Connection switch failed:', code || 'UNKNOWN');
      if (code === 'CONNECTION_MANAGER_CLOSED') {
        sendError(res, 503, 'PROXY_SHUTTING_DOWN', 'The Cosmos proxy is shutting down');
        return;
      }
      if (code === 'GRAPH_OPERATION_ACTIVE' || code === 'CONNECTION_SWITCH_ACTIVE') {
        sendError(
          res,
          409,
          'OPERATION_IN_PROGRESS',
          'Wait for the active graph operation to finish'
        );
        return;
      }

      sendError(
        res,
        502,
        'CONNECTION_PROBE_FAILED',
        'Could not verify the Cosmos DB connection',
        error && error.diagnostics
      );
    }
  });

  app.post('/query', async (req, res) => {
    const { nodeLimit, query } = req.body || {};

    if (!isValidQuery(query)) {
      sendError(res, 400, 'QUERY_INPUT_INVALID', 'A Gremlin query is required');
      return;
    }

    const operation = 'query';
    const requests = [];
    try {
      const data = await connectionManager.runGraphOperation(async ({ client, connection }) => {
        const vertexResult = await submitTracked(
          client,
          'vertices',
          makeVertexQuery(query, nodeLimit),
          requests
        );
        const vertices = vertexResult._items || [];
        const edgeQuery = makeEdgeQuery(vertices.map(vertex => vertex.id));
        const edgeResult = edgeQuery
          ? await submitTracked(client, 'edges', edgeQuery, requests)
          : { _items: [] };

        return verticesToJson(vertices, edgeResult._items || [], connection.partitionKey);
      });

      res.send({
        data,
        diagnostics: buildOperationDiagnostics(operation, requests)
      });
    } catch (error) {
      if (sendManagerStateError(res, error)) {
        return;
      }
      if (isQueryRejection(error)) {
        sendQueryRejection(res, operation, requests);
        return;
      }
      console.error('Error fetching graph data:', error);
      sendError(
        res,
        500,
        'COSMOS_QUERY_FAILED',
        'Failed to fetch graph data',
        buildOperationDiagnostics(operation, requests)
      );
    }
  });

  app.post('/traverse', async (req, res) => {
    const { nodeId, direction, nodeLimit } = req.body || {};

    if (!isValidTraversalRequest({ nodeId, direction })) {
      sendError(
        res,
        400,
        'TRAVERSAL_INPUT_INVALID',
        'A node id and traversal direction are required'
      );
      return;
    }

    const operation = `traverse-${direction}`;
    const requests = [];
    try {
      const data = await connectionManager.runGraphOperation(async ({ client, connection }) => {
        const vertexResult = await submitTracked(
          client,
          'vertices',
          makeTraversalVertexQuery(nodeId, direction, nodeLimit),
          requests
        );
        const vertices = vertexResult._items || [];
        const neighborIds = vertices
          .map(vertex => stringifyGremlinId(vertex.id))
          .filter(vertexId => vertexId !== nodeId);
        const edgeQuery = makeTraversalEdgeQuery(nodeId, direction, neighborIds);
        const edgeResult = edgeQuery
          ? await submitTracked(client, 'edges', edgeQuery, requests)
          : { _items: [] };

        return verticesToJson(vertices, edgeResult._items || [], connection.partitionKey);
      });

      res.send({
        data,
        diagnostics: buildOperationDiagnostics(operation, requests)
      });
    } catch (error) {
      if (sendManagerStateError(res, error)) {
        return;
      }
      console.error('Error fetching traversal data:', error);
      sendError(
        res,
        500,
        'COSMOS_TRAVERSAL_FAILED',
        'Failed to fetch traversal data',
        buildOperationDiagnostics(operation, requests)
      );
    }
  });

  app.use((error, req, res, next) => {
    if (error && error.type === 'entity.too.large') {
      sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
      return;
    }
    if (error && error.type === 'entity.parse.failed') {
      sendError(res, 400, 'REQUEST_BODY_INVALID', 'Request body must be valid JSON');
      return;
    }
    next(error);
  });

  return app;
}

module.exports = {
  CONNECTION_FIELD_LIMITS,
  MAX_QUERY_LENGTH,
  createApp,
  isValidTraversalRequest,
  isValidQuery,
  validateConnectionInput
};
