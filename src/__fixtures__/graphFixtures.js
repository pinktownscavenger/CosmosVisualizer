export const rawVertices = [
  {
    id: 'person-1',
    label: 'person',
    type: 'vertex',
    properties: {
      name: [{ value: 'Ada Lovelace' }],
      aliases: [{ value: 'Ada' }, { value: 'Enchantress of Numbers' }],
      active: [{ value: true }],
      type: [{ value: 'person' }]
    }
  },
  {
    id: 'company-1',
    label: 'company',
    type: 'vertex',
    properties: {
      name: [{ value: 'Analytical Engines Ltd' }],
      founded: [{ value: 1843 }],
      type: [{ value: 'company' }]
    }
  },
  {
    id: 'project-1',
    label: 'project',
    type: 'vertex',
    properties: {
      title: [{ value: 'Graph Modernization' }],
      priority: [{ value: 1 }],
      type: [{ value: 'project' }]
    }
  },
  {
    id: "tag-'quoted\\id",
    label: 'tag',
    type: 'vertex',
    properties: {
      type: [{ value: 'tag' }]
    }
  }
];

export const rawEdges = [
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

export const normalizedGraph = [
  {
    id: 'person-1',
    label: 'person',
    type: 'vertex',
    properties: {
      name: ['Ada Lovelace'],
      aliases: ['Ada', 'Enchantress of Numbers'],
      active: [true],
      type: ['person']
    },
    partition: { name: 'type', value: 'person' },
    edges: [
      {
        id: 'edge-1',
        label: 'works_at',
        from: 'person-1',
        to: 'company-1',
        properties: {
          since: [1843]
        }
      },
      {
        id: 'edge-2',
        label: 'created',
        from: 'person-1',
        to: 'project-1',
        properties: {
          confidence: [0.98]
        }
      },
      {
        id: 'edge-3',
        label: 'reviewed',
        from: 'person-1',
        to: 'project-1',
        properties: {
          status: ['complete']
        }
      }
    ]
  },
  {
    id: 'company-1',
    label: 'company',
    type: 'vertex',
    properties: {
      name: ['Analytical Engines Ltd'],
      founded: [1843],
      type: ['company']
    },
    partition: { name: 'type', value: 'company' },
    edges: [
      {
        id: 'edge-1',
        label: 'works_at',
        from: 'person-1',
        to: 'company-1',
        properties: {
          since: [1843]
        }
      }
    ]
  },
  {
    id: 'project-1',
    label: 'project',
    type: 'vertex',
    properties: {
      title: ['Graph Modernization'],
      priority: [1],
      type: ['project']
    },
    partition: { name: 'type', value: 'project' },
    edges: [
      {
        id: 'edge-2',
        label: 'created',
        from: 'person-1',
        to: 'project-1',
        properties: {
          confidence: [0.98]
        }
      },
      {
        id: 'edge-3',
        label: 'reviewed',
        from: 'person-1',
        to: 'project-1',
        properties: {
          status: ['complete']
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
          note: ['self-loop']
        }
      }
    ]
  },
  {
    id: "tag-'quoted\\id",
    label: 'tag',
    type: 'vertex',
    properties: { type: ['tag'] },
    partition: { name: 'type', value: 'tag' },
    edges: [
      {
        id: 'edge-4',
        label: 'related_to',
        from: 'project-1',
        to: "tag-'quoted\\id",
        properties: {}
      }
    ]
  }
];
