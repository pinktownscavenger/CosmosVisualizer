function mapPropertiesToObj(properties) {
  const obj = {};
  Object.entries(properties || {}).forEach(([key, value]) => {
    obj[key] = Array.isArray(value) ? value.map(item => item.value !== undefined ? item.value : item) : value;
  });
  return obj;
}

function normalizePartitionKeyProperty(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/^\//, '');
  return normalized || null;
}

function stringifyGremlinId(id) {
  return typeof id === 'string' ? id : JSON.stringify(id);
}

function normalizeEdge(edge) {
  return {
    id: stringifyGremlinId(edge.id),
    from: edge.from,
    to: edge.to,
    label: edge.label,
    properties: mapPropertiesToObj(edge.properties)
  };
}

function buildEdgeMap(edges) {
  const edgeMap = {};

  edges.forEach((edge) => {
    const formattedEdge = normalizeEdge(edge);
    [formattedEdge.from, formattedEdge.to].forEach((vertexId) => {
      if (!edgeMap[vertexId]) {
        edgeMap[vertexId] = [];
      }
      edgeMap[vertexId].push(formattedEdge);
    });
  });

  return edgeMap;
}

function uniqueEdges(edges) {
  const seen = new Set();

  return edges.filter((edge) => {
    const edgeKey = edge.id || `${edge.from}:${edge.label}:${edge.to}`;
    if (seen.has(edgeKey)) {
      return false;
    }

    seen.add(edgeKey);
    return true;
  });
}

function verticesToJson(vertices, edges, partitionKey) {
  const edgeMap = buildEdgeMap(edges);
  const partitionName = normalizePartitionKeyProperty(partitionKey);

  return vertices.map(vertex => {
    const connectedEdges = uniqueEdges(edgeMap[vertex.id] || []);
    const properties = mapPropertiesToObj(vertex.properties);

    const normalizedVertex = {
      id: vertex.id,
      label: vertex.label,
      type: vertex.type,
      properties,
      edges: connectedEdges
    };

    if (partitionName) {
      const partitionValues = properties[partitionName];
      normalizedVertex.partition = {
        name: partitionName,
        value: Array.isArray(partitionValues) && partitionValues.length > 0
          ? partitionValues[0]
          : null
      };
    }

    return normalizedVertex;
  });
}

function makeLimitClause(nodeLimit) {
  const parsedLimit = Number(nodeLimit);
  return Number.isInteger(parsedLimit) && parsedLimit > 0 ? `.limit(${parsedLimit})` : '';
}

function escapeGremlinString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function makeEdgeQuery(vertexIds) {
  if (vertexIds.length === 0) {
    return null;
  }

  const ids = vertexIds
    .map(id => typeof id === 'string' ? id : JSON.stringify(id))
    .map(id => `'${escapeGremlinString(id)}'`)
    .join(',');
  return `
    g.V(${ids})
      .bothE()
      .dedup()
      .project('id', 'label', 'from', 'to', 'properties')
      .by(id())
      .by(label())
      .by(outV().id())
      .by(inV().id())
      .by(valueMap())
  `;
}

function makeConnectionProbeQuery(partitionKey) {
  return `g.V().has('${escapeGremlinString(partitionKey)}').limit(1)`;
}

function makeVertexQuery(query, nodeLimit) {
  return `${query}${makeLimitClause(nodeLimit)}`;
}

function makeTraversalVertexQuery(nodeId, direction, nodeLimit) {
  const id = `'${escapeGremlinString(nodeId)}'`;
  const step = direction === 'in' ? 'in' : 'out';
  return `g.V(${id}).union(identity(), ${step}()${makeLimitClause(nodeLimit)}).dedup()`;
}

function makeTraversalEdgeQuery(nodeId, direction, neighborIds) {
  if (neighborIds.length === 0) {
    return null;
  }

  const id = `'${escapeGremlinString(nodeId)}'`;
  const ids = neighborIds
    .map(neighborId => typeof neighborId === 'string' ? neighborId : JSON.stringify(neighborId))
    .map(neighborId => `'${escapeGremlinString(neighborId)}'`)
    .join(',');
  const edgeStep = direction === 'in' ? 'inE' : 'outE';
  const vertexStep = direction === 'in' ? 'outV' : 'inV';

  return `
    g.V(${id}).${edgeStep}()
      .where(${vertexStep}().hasId(${ids}))
      .dedup()
      .project('id', 'label', 'from', 'to', 'properties')
      .by(id())
      .by(label())
      .by(outV().id())
      .by(inV().id())
      .by(valueMap())
  `;
}

module.exports = {
  buildEdgeMap,
  escapeGremlinString,
  makeConnectionProbeQuery,
  makeEdgeQuery,
  makeLimitClause,
  makeTraversalEdgeQuery,
  makeTraversalVertexQuery,
  makeVertexQuery,
  mapPropertiesToObj,
  normalizePartitionKeyProperty,
  normalizeEdge,
  stringifyGremlinId,
  uniqueEdges,
  verticesToJson
};
