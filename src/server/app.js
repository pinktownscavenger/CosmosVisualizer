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

function createApp({ client, connectionManager, allowedOrigin = 'http://localhost:5173' }) {
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
    const nodeLimit = req.body.nodeLimit;
    const query = req.body.query;

    if (!isValidQuery(query)) {
      res.status(400).send({ error: 'A Gremlin query is required' });
      return;
    }

    try {
      const vertexResult = await client.submit(makeVertexQuery(query, nodeLimit), {});
      const vertices = vertexResult._items || [];
      const edgeQuery = makeEdgeQuery(vertices.map(vertex => vertex.id));
      const edgeResult = edgeQuery ? await client.submit(edgeQuery, {}) : { _items: [] };

      res.send(verticesToJson(vertices, edgeResult._items || []));
    } catch (error) {
      console.error('Error fetching graph data:', error);
      res.status(500).send({ error: 'Failed to fetch graph data' });
    }
  });

  app.post('/traverse', async (req, res) => {
    const nodeId = req.body.nodeId;
    const direction = req.body.direction;
    const nodeLimit = req.body.nodeLimit;

    if (!isValidTraversalRequest({ nodeId, direction })) {
      res.status(400).send({ error: 'A node id and traversal direction are required' });
      return;
    }

    try {
      const vertexResult = await client.submit(makeTraversalVertexQuery(nodeId, direction, nodeLimit), {});
      const vertices = vertexResult._items || [];
      const neighborIds = vertices
        .map(vertex => stringifyGremlinId(vertex.id))
        .filter(vertexId => vertexId !== nodeId);
      const edgeQuery = makeTraversalEdgeQuery(nodeId, direction, neighborIds);
      const edgeResult = edgeQuery ? await client.submit(edgeQuery, {}) : { _items: [] };

      res.send(verticesToJson(vertices, edgeResult._items || []));
    } catch (error) {
      console.error('Error fetching traversal data:', error);
      res.status(500).send({ error: 'Failed to fetch traversal data' });
    }
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
