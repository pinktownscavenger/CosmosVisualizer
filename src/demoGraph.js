const arrowToTarget = { to: { enabled: true, scaleFactor: 0.55 } };

export const demoNodes = [
  {
    id: 'person-ada',
    label: 'Ada Lovelace',
    group: 'person',
    type: 'person',
    properties: {
      name: 'Ada Lovelace',
      role: 'Graph analyst',
      active: 'true'
    }
  },
  {
    id: 'company-engine',
    label: 'Analytical Engines',
    group: 'company',
    type: 'company',
    properties: {
      name: 'Analytical Engines',
      founded: '1843'
    }
  },
  {
    id: 'project-cosmos',
    label: 'CosmosVisualizer',
    group: 'project',
    type: 'project',
    properties: {
      name: 'CosmosVisualizer',
      status: 'Frontend revamp'
    }
  },
  {
    id: 'dataset-users',
    label: 'User graph',
    group: 'dataset',
    type: 'dataset',
    properties: {
      records: '12.4k',
      freshness: 'live'
    }
  },
  {
    id: 'tag-production',
    label: 'Production',
    group: 'tag',
    type: 'tag',
    properties: {
      environment: 'production'
    }
  }
];

export const demoEdges = [
  {
    id: 'edge-owns',
    from: 'person-ada',
    to: 'project-cosmos',
    label: 'owns',
    type: 'owns',
    arrows: arrowToTarget,
    properties: {
      since: '2026'
    }
  },
  {
    id: 'edge-builds',
    from: 'company-engine',
    to: 'project-cosmos',
    label: 'builds',
    type: 'builds',
    arrows: arrowToTarget,
    properties: {
      confidence: '0.98'
    }
  },
  {
    id: 'edge-queries',
    from: 'project-cosmos',
    to: 'dataset-users',
    label: 'queries',
    type: 'queries',
    arrows: arrowToTarget,
    properties: {
      limit: '100'
    }
  },
  {
    id: 'edge-deploys',
    from: 'project-cosmos',
    to: 'tag-production',
    label: 'deploys_to',
    type: 'deploys_to',
    arrows: arrowToTarget,
    properties: {
      frequency: 'daily'
    }
  },
  {
    id: 'edge-labels',
    from: 'dataset-users',
    to: 'tag-production',
    label: 'tagged',
    type: 'tagged',
    arrows: arrowToTarget,
    properties: {
      source: 'demo'
    }
  }
];
