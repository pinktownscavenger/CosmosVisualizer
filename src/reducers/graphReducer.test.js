import { describe, expect, it, vi } from 'vitest';
import { ACTIONS } from '../constants';
import { reducer } from './graphReducer';

const makeHolder = () => ({
  add: vi.fn(),
  clear: vi.fn(),
  update: vi.fn()
});

const makeState = () => ({
  network: null,
  nodeHolder: makeHolder(),
  edgeHolder: makeHolder(),
  nodes: [
    {
      id: 'person-1',
      label: 'person',
      type: 'person',
      properties: { name: 'Ada Lovelace', aliases: 'Ada' }
    }
  ],
  edges: [
    {
      id: 'edge-1',
      from: 'person-1',
      to: 'company-1',
      type: 'works_at',
      properties: {}
    }
  ],
  selectedNode: {},
  selectedEdge: {}
});

describe('graph reducer', () => {
  it('adds only new nodes to state and DataSet holder', () => {
    const state = makeState();
    const nextState = reducer(state, {
      type: ACTIONS.ADD_NODES,
      payload: [
        { id: 'person-1', label: 'person' },
        { id: 'company-1', label: 'company' }
      ]
    });

    expect(nextState.nodes).toEqual([
      state.nodes[0],
      { id: 'company-1', label: 'company' }
    ]);
    expect(state.nodeHolder.add).toHaveBeenCalledWith([{ id: 'company-1', label: 'company' }]);
  });

  it('adds only new edges while preserving parallel edges', () => {
    const state = makeState();
    const nextState = reducer(state, {
      type: ACTIONS.ADD_EDGES,
      payload: [
        { id: 'edge-1', from: 'person-1', to: 'company-1', type: 'works_at' },
        { id: 'edge-2', from: 'person-1', to: 'company-1', type: 'founded' }
      ]
    });

    expect(nextState.edges).toEqual([
      state.edges[0],
      { id: 'edge-2', from: 'person-1', to: 'company-1', type: 'founded' }
    ]);
    expect(state.edgeHolder.add).toHaveBeenCalledWith([
      { id: 'edge-2', from: 'person-1', to: 'company-1', type: 'founded' }
    ]);
  });

  it('deduplicates repeated new edge ids before updating the DataSet holder', () => {
    const state = makeState();
    const nextState = reducer(state, {
      type: ACTIONS.ADD_EDGES,
      payload: [
        { id: 'edge-2', from: 'person-1', to: 'project-1', type: 'created' },
        { id: 'edge-2', from: 'person-1', to: 'project-1', type: 'created' },
        { id: 'edge-3', from: 'person-1', to: 'project-1', type: 'reviewed' }
      ]
    });

    expect(nextState.edges).toEqual([
      state.edges[0],
      { id: 'edge-2', from: 'person-1', to: 'project-1', type: 'created' },
      { id: 'edge-3', from: 'person-1', to: 'project-1', type: 'reviewed' }
    ]);
    expect(state.edgeHolder.add).toHaveBeenCalledWith([
      { id: 'edge-2', from: 'person-1', to: 'project-1', type: 'created' },
      { id: 'edge-3', from: 'person-1', to: 'project-1', type: 'reviewed' }
    ]);
  });

  it('sets selected node and clears selected edge', () => {
    const state = { ...makeState(), selectedEdge: { id: 'edge-1' } };

    expect(reducer(state, {
      type: ACTIONS.SET_SELECTED_NODE,
      payload: 'person-1'
    })).toMatchObject({
      selectedNode: state.nodes[0],
      selectedEdge: {}
    });
  });

  it('sets selected edge and clears selected node', () => {
    const state = { ...makeState(), selectedNode: { id: 'person-1' } };

    expect(reducer(state, {
      type: ACTIONS.SET_SELECTED_EDGE,
      payload: 'edge-1'
    })).toMatchObject({
      selectedEdge: state.edges[0],
      selectedNode: {}
    });
  });

  it('clears graph data and DataSet holders', () => {
    const state = makeState();
    const nextState = reducer(state, { type: ACTIONS.CLEAR_GRAPH });

    expect(nextState.nodes).toEqual([]);
    expect(nextState.edges).toEqual([]);
    expect(nextState.selectedNode).toEqual({});
    expect(nextState.selectedEdge).toEqual({});
    expect(state.nodeHolder.clear).toHaveBeenCalled();
    expect(state.edgeHolder.clear).toHaveBeenCalled();
  });

  it('refreshes node labels from configured label fields', () => {
    const state = makeState();
    const nextState = reducer(state, {
      type: ACTIONS.REFRESH_NODE_LABELS,
      payload: [{ type: 'person', field: 'aliases' }]
    });

    expect(nextState.nodes[0]).toEqual({
      ...state.nodes[0],
      label: 'Ada'
    });
    expect(state.nodeHolder.update).toHaveBeenCalledWith({ id: 'person-1', label: 'Ada' });
  });

  it('refreshes labels from Cosmos array property values as strings', () => {
    const state = makeState();
    state.nodes[0].properties = { name: ['Ada Lovelace'], type: ['person'] };
    const nextState = reducer(state, {
      type: ACTIONS.REFRESH_NODE_LABELS,
      payload: [{ type: 'person', field: 'name' }]
    });

    expect(nextState.nodes[0].label).toBe('Ada Lovelace');
    expect(state.nodeHolder.update).toHaveBeenCalledWith({ id: 'person-1', label: 'Ada Lovelace' });
  });

  it('falls back to the node type when the label field is missing', () => {
    const state = makeState();
    const nextState = reducer(state, {
      type: ACTIONS.REFRESH_NODE_LABELS,
      payload: [{ type: 'person', field: 'missing' }]
    });

    expect(nextState.nodes[0].label).toBe('person');
    expect(state.nodeHolder.update).toHaveBeenCalledWith({ id: 'person-1', label: 'person' });
  });

  it('starts with an empty graph', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state.nodes).toEqual([]);
    expect(state.edges).toEqual([]);
  });


  it('ignores duplicate ids within one batch of new nodes', () => {
    const state = makeState();
    const nextState = reducer(state, {
      type: ACTIONS.ADD_NODES,
      payload: [{ id: 'company-1', label: 'Acme' }, { id: 'company-1', label: 'Acme' }]
    });

    expect(nextState.nodes.map(node => node.id)).toEqual(['person-1', 'company-1']);
    expect(state.nodeHolder.add).toHaveBeenCalledWith([{ id: 'company-1', label: 'Acme' }]);
  });

  it('refreshes the label of the selected node too', () => {
    const selected = reducer(makeState(), { type: ACTIONS.SET_SELECTED_NODE, payload: 'person-1' });
    const refreshed = reducer(selected, { type: ACTIONS.REFRESH_NODE_LABELS, payload: [{ type: 'person', field: 'aliases' }] });

    expect(refreshed.selectedNode.label).toBe('Ada');
  });

  it('restyles nodes in state and the DataSet in one batch', () => {
    const state = makeState();
    const style = { color: { background: '#3987e5' }, shapeProperties: { borderDashes: false } };
    const next = reducer(state, { type: ACTIONS.RESTYLE_NODES, payload: [{ id: 'person-1', ...style }] });

    expect(next.nodes[0]).toMatchObject({ id: 'person-1', label: 'person', ...style });
    expect(state.nodeHolder.update).toHaveBeenCalledTimes(1);
    expect(state.nodeHolder.update).toHaveBeenCalledWith([{ id: 'person-1', ...style }]);
  });

  it('seeds the styled nodes it is given', () => {
    const seeded = reducer(undefined, {
      type: ACTIONS.SEED_DEMO_GRAPH,
      payload: { nodes: [{ id: 'n1', color: { background: '#3987e5' } }], edges: [{ id: 'e1', from: 'n1', to: 'n1' }] }
    });

    expect(seeded.nodes).toEqual([{ id: 'n1', color: { background: '#3987e5' } }]);
    expect(seeded.edges).toHaveLength(1);
  });
});
