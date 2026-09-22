const express = require('express');
const cors = require('cors');
const {
  makeEdgeQuery,
  makeTraversalEdgeQuery,
  makeTraversalVertexQuery,
  makeVertexQuery,
  stringifyGremlinId,
  verticesToJson
} = require('./graphHelpers');

const MAX_QUERY_LENGTH = 10000;

function isValidQuery(query) {
  return typeof query === 'string' && query.trim().length > 0 && query.length <= MAX_QUERY_LENGTH;
}

function isValidTraversalRequest({ nodeId, direction }) {
  return typeof nodeId === 'string'
    && nodeId.trim().length > 0
    && (direction === 'out' || direction === 'in');
}

function createApp({ client, allowedOrigin = 'http://localhost:5173' }) {
  const app = express();

  app.use(cors({
    origin: allowedOrigin,
    credentials: true
  }));

  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
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
  MAX_QUERY_LENGTH,
  createApp,
  isValidTraversalRequest,
  isValidQuery
};
