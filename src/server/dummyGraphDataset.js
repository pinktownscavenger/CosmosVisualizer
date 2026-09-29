const SEED_SET = 'cosmos-visualizer-dummy-v1';

const vertex = (id, label, properties) => ({
  id,
  label,
  properties: {
    ...properties,
    seedSet: SEED_SET,
    type: label
  }
});

const edge = (id, from, to, label, properties = {}) => ({
  id,
  from,
  to,
  label,
  properties: {
    ...properties,
    seedSet: SEED_SET
  }
});

const dummyGraphDataset = {
  seedSet: SEED_SET,
  vertices: [
    vertex('person-ada', 'person', {
      name: 'Ada Lovelace',
      role: 'Graph analyst',
      active: true,
      region: 'eu-west'
    }),
    vertex('person-grace', 'person', {
      name: 'Grace Hopper',
      role: 'Runtime lead',
      active: true,
      region: 'us-east'
    }),
    vertex('person-katherine', 'person', {
      name: 'Katherine Johnson',
      role: 'Reliability reviewer',
      active: true,
      region: 'us-west'
    }),
    vertex('person-alan', 'person', {
      name: 'Alan Turing',
      role: 'Automation owner',
      active: false,
      region: 'uk-south'
    }),
    vertex('project-cosmos-visualizer', 'project', {
      name: 'Cosmos Visualizer',
      status: 'testing',
      priority: 1
    }),
    vertex('project-seed-lab', 'project', {
      name: 'Seed Lab',
      status: 'demo',
      priority: 3
    }),
    vertex('service-gremlin-proxy', 'service', {
      name: 'Gremlin Proxy',
      runtime: 'node',
      criticality: 'high'
    }),
    vertex('service-vite-client-with-long-readable-name', 'service', {
      name: 'Vite Client With Long Readable Name',
      runtime: 'browser',
      criticality: 'medium'
    }),
    vertex('dataset-sample-graph', 'dataset', {
      name: 'Sample Graph',
      records: 12,
      synthetic: true
    }),
    vertex('tag-production', 'tag', {
      name: 'production',
      color: 'green'
    }),
    vertex('tag-demo', 'tag', {
      name: 'demo',
      color: 'blue'
    }),
    vertex('incident-2026-09-empty-sample', 'incident', {
      name: 'Empty sample response',
      severity: 2,
      resolved: true
    }),
    vertex('note-orphan-import-plan', 'note', {
      name: 'Import plan orphan',
      body: 'Intentionally disconnected vertex for empty-neighborhood testing.'
    })
  ],
  edges: [
    edge('edge-ada-owns-visualizer', 'person-ada', 'project-cosmos-visualizer', 'owns', {
      since: '2026-09-29'
    }),
    edge('edge-ada-maintains-visualizer', 'person-ada', 'project-cosmos-visualizer', 'maintains', {
      cadence: 'weekly'
    }),
    edge('edge-grace-uses-proxy', 'person-grace', 'service-gremlin-proxy', 'uses', {
      frequency: 'daily'
    }),
    edge('edge-katherine-reported-incident', 'person-katherine', 'incident-2026-09-empty-sample', 'reported', {
      channel: 'test'
    }),
    edge('edge-alan-owns-seed-lab', 'person-alan', 'project-seed-lab', 'owns', {
      since: '2026-09-28'
    }),
    edge('edge-visualizer-queries-dataset', 'project-cosmos-visualizer', 'dataset-sample-graph', 'queries', {
      limit: 10
    }),
    edge('edge-visualizer-uses-proxy', 'project-cosmos-visualizer', 'service-gremlin-proxy', 'uses', {
      mode: 'api'
    }),
    edge('edge-visualizer-uses-client', 'project-cosmos-visualizer', 'service-vite-client-with-long-readable-name', 'uses', {
      mode: 'ui'
    }),
    edge('edge-proxy-depends-dataset', 'service-gremlin-proxy', 'dataset-sample-graph', 'depends_on', {
      reason: 'read model'
    }),
    edge('edge-client-depends-proxy', 'service-vite-client-with-long-readable-name', 'service-gremlin-proxy', 'depends_on', {
      protocol: 'http'
    }),
    edge('edge-proxy-monitors-client', 'service-gremlin-proxy', 'service-vite-client-with-long-readable-name', 'monitors', {
      signal: 'health'
    }),
    edge('edge-seed-lab-queries-dataset', 'project-seed-lab', 'dataset-sample-graph', 'queries', {
      limit: 5
    }),
    edge('edge-visualizer-tagged-prod', 'project-cosmos-visualizer', 'tag-production', 'tagged', {
      confidence: 0.98
    }),
    edge('edge-visualizer-tagged-demo', 'project-cosmos-visualizer', 'tag-demo', 'tagged', {
      confidence: 0.92
    }),
    edge('edge-seed-lab-tagged-demo', 'project-seed-lab', 'tag-demo', 'tagged', {
      confidence: 1
    }),
    edge('edge-incident-mitigated-proxy', 'incident-2026-09-empty-sample', 'service-gremlin-proxy', 'mitigated_by', {
      minutesToMitigate: 14
    }),
    edge('edge-incident-tagged-demo', 'incident-2026-09-empty-sample', 'tag-demo', 'tagged', {
      confidence: 0.8
    }),
    edge('edge-dataset-tagged-prod', 'dataset-sample-graph', 'tag-production', 'tagged', {
      confidence: 0.75
    })
  ]
};

function validateDummyGraphDataset(dataset) {
  const errors = [];
  const vertexIds = new Set(dataset.vertices.map(item => item.id));
  const edgeIds = new Set();

  dataset.vertices.forEach((item) => {
    if (!item.properties || item.properties.type !== item.label) {
      errors.push(`Vertex ${item.id} must set properties.type to its label for the /type partition key`);
    }
  });

  dataset.edges.forEach((item) => {
    if (!vertexIds.has(item.from)) {
      errors.push(`Edge ${item.id} references missing source vertex ${item.from}`);
    }

    if (!vertexIds.has(item.to)) {
      errors.push(`Edge ${item.id} references missing target vertex ${item.to}`);
    }

    if (edgeIds.has(item.id)) {
      errors.push(`Duplicate edge id ${item.id}`);
    }

    edgeIds.add(item.id);
  });

  return { errors };
}

function getDummyGraphSummary(dataset) {
  const connectedVertexIds = new Set();
  const pairCounts = {};

  dataset.edges.forEach((item) => {
    connectedVertexIds.add(item.from);
    connectedVertexIds.add(item.to);

    const pair = `${item.from}->${item.to}`;
    pairCounts[pair] = (pairCounts[pair] || 0) + 1;
  });

  return {
    vertexCount: dataset.vertices.length,
    edgeCount: dataset.edges.length,
    vertexLabels: [...new Set(dataset.vertices.map(item => item.label))].sort(),
    edgeLabels: [...new Set(dataset.edges.map(item => item.label))].sort(),
    orphanVertexIds: dataset.vertices
      .map(item => item.id)
      .filter(id => !connectedVertexIds.has(id))
      .sort(),
    parallelPairs: Object.entries(pairCounts)
      .filter(([, count]) => count > 1)
      .map(([pair]) => pair)
      .sort()
  };
}

module.exports = {
  dummyGraphDataset,
  getDummyGraphSummary,
  validateDummyGraphDataset
};
