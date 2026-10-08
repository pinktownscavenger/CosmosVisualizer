const demoGraphData = require('../demoGraphData.json');

// Fixture mode serves the same graph the client shows on startup, in the raw
// Gremlin GraphSON shape Cosmos returns (each property value wrapped in a list).
const toGremlinProperties = (properties) => Object.fromEntries(
  Object.entries(properties).map(([key, value]) => [key, [{ value }]])
);

const rawVertices = demoGraphData.vertices.map(vertex => ({
  id: vertex.id,
  label: vertex.label,
  type: 'vertex',
  properties: toGremlinProperties(vertex.properties)
}));

const rawEdges = demoGraphData.edges.map(edge => ({
  ...edge,
  properties: toGremlinProperties(edge.properties)
}));

function unique(values) {
  return [...new Set(values)];
}

function vertexById(id) {
  return rawVertices.find(vertex => vertex.id === id);
}

function parseOriginId(query) {
  const match = query.match(/g\.V\('((?:\\.|[^'])*)'\)/);
  if (!match) {
    return null;
  }

  return match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

function parseLimit(query) {
  const match = query.match(/\.limit\((\d+)\)/);
  return match ? Number(match[1]) : null;
}

function limitList(list, limit) {
  return Number.isInteger(limit) && limit >= 0 ? list.slice(0, limit) : list;
}

function getTraversalVertices(query) {
  const originId = parseOriginId(query);
  if (!originId) {
    return rawVertices;
  }

  const direction = query.includes(' in()') ? 'in' : 'out';
  const limit = parseLimit(query);
  const connectedEdges = direction === 'in'
    ? rawEdges.filter(edge => edge.to === originId)
    : rawEdges.filter(edge => edge.from === originId);
  const neighborIds = limitList(
    unique(connectedEdges.map(edge => direction === 'in' ? edge.from : edge.to))
      .filter(neighborId => neighborId !== originId),
    limit
  );
  return [originId, ...neighborIds].map(vertexById).filter(Boolean);
}

function getTraversalEdges(query) {
  const originId = parseOriginId(query);
  if (!originId) {
    return rawEdges;
  }

  if (query.includes('.inE()')) {
    return rawEdges.filter(edge => edge.to === originId && edge.from !== originId);
  }

  if (query.includes('.outE()')) {
    return rawEdges.filter(edge => edge.from === originId && edge.to !== originId);
  }

  return rawEdges;
}

const CLOSERS = { ')': '(', ']': '[', '}': '{' };

// Mimics Cosmos rejecting malformed Gremlin so the client's edit-query recovery can be exercised.
function findSyntaxError(query) {
  const stack = [];
  let quote = null;
  for (let index = 0; index < query.length; index += 1) {
    const char = query[index];
    if (quote) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if ('([{'.includes(char)) {
      stack.push(char);
    } else if (CLOSERS[char]) {
      if (stack.pop() !== CLOSERS[char]) {
        return `unexpected '${char}' at position ${index + 1}`;
      }
    }
  }
  if (quote) {
    return 'unterminated string literal';
  }
  if (stack.length > 0) {
    return `missing closing bracket for '${stack[stack.length - 1]}'`;
  }
  return null;
}

function syntaxError(detail) {
  return Object.assign(
    new Error(`ScriptEvaluationError: Gremlin Query Syntax Error: ${detail}`),
    { statusCode: 597 }
  );
}

function createFixtureClient() {
  let closed = false;

  const response = (items, charge) => ({
    _items: items,
    attributes: new Map([['x-ms-total-request-charge', charge]])
  });

  return {
    submit(query) {
      if (closed) {
        return Promise.reject(new Error('Fixture client is closed'));
      }

      const syntaxProblem = findSyntaxError(query);
      if (syntaxProblem) {
        return Promise.reject(syntaxError(syntaxProblem));
      }

      if (query === "g.V().has('type').limit(1)") {
        return Promise.resolve(response(rawVertices.slice(0, 1), 0.5));
      }

      if (query.includes('.inE()') || query.includes('.outE()')) {
        return Promise.resolve(response(getTraversalEdges(query), 1.25));
      }

      if (query.includes('.bothE()')) {
        return Promise.resolve(response(rawEdges, 1.25));
      }

      if (query.includes('union(identity(),')) {
        return Promise.resolve(response(getTraversalVertices(query), 2.5));
      }

      return Promise.resolve(response(rawVertices, 2.5));
    },
    close() {
      closed = true;
      return Promise.resolve();
    }
  };
}

module.exports = {
  createFixtureClient,
  rawEdges,
  rawVertices
};
