const rawVertices = [
  {
    id: 'person-1',
    label: 'person',
    type: 'vertex',
    properties: {
      name: [{ value: 'Ada Lovelace' }],
      aliases: [{ value: 'Ada' }, { value: 'Enchantress of Numbers' }],
      active: [{ value: true }]
    }
  },
  {
    id: 'company-1',
    label: 'company',
    type: 'vertex',
    properties: {
      name: [{ value: 'Analytical Engines Ltd' }],
      founded: [{ value: 1843 }]
    }
  },
  {
    id: 'project-1',
    label: 'project',
    type: 'vertex',
    properties: {
      title: [{ value: 'Graph Modernization' }],
      priority: [{ value: 1 }]
    }
  },
  {
    id: "tag-'quoted\\id",
    label: 'tag',
    type: 'vertex',
    properties: {}
  }
];

const rawEdges = [
  {
    id: 'edge-1',
    label: 'works_at',
    from: 'person-1',
    to: 'company-1',
    properties: {
      since: [{ value: 1843 }]
    }
  },
  {
    id: 'edge-2',
    label: 'created',
    from: 'person-1',
    to: 'project-1',
    properties: {
      confidence: [{ value: 0.98 }]
    }
  },
  {
    id: 'edge-3',
    label: 'reviewed',
    from: 'person-1',
    to: 'project-1',
    properties: {
      status: [{ value: 'complete' }]
    }
  },
  {
    id: 'edge-4',
    label: 'related_to',
    from: 'project-1',
    to: "tag-'quoted\\id",
    properties: {}
  },
  {
    id: 'edge-5',
    label: 'self',
    from: 'project-1',
    to: 'project-1',
    properties: {
      note: [{ value: 'self-loop' }]
    }
  }
];

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
  return Number.isInteger(limit) && limit > 0 ? list.slice(0, limit) : list;
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

function createFixtureClient() {
  return {
    submit(query) {
      if (query.includes('.inE()') || query.includes('.outE()')) {
        return Promise.resolve({ _items: getTraversalEdges(query) });
      }

      if (query.includes('.bothE()')) {
        return Promise.resolve({ _items: rawEdges });
      }

      if (query.includes('union(identity(),')) {
        return Promise.resolve({ _items: getTraversalVertices(query) });
      }

      return Promise.resolve({ _items: rawVertices });
    }
  };
}

module.exports = {
  createFixtureClient,
  rawEdges,
  rawVertices
};
