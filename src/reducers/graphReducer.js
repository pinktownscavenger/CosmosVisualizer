import vis from 'vis-network';
import { ACTIONS } from '../constants';
import { getDiffNodes, getDiffEdges, findNodeById, getNodeLabel } from '../logics/utils';

const keyBy = (list, key) => list.reduce((result, item) => {
  result[item[key]] = item;
  return result;
}, {});

const mapValues = (obj, mapper) => Object.keys(obj).reduce((result, key) => {
  result[key] = mapper(obj[key], key);
  return result;
}, {});

// The demo graph is only seeded in fixture mode, so a real Cosmos account never shows fake data.
const initialState = {
  network: null,
  nodeHolder: new vis.DataSet([]),
  edgeHolder: new vis.DataSet([]),
  nodes: [],
  edges: [],
  selectedNode: {},
  selectedEdge: {},
};

const addNodes = (state, incoming) => {
  const newNodes = getDiffNodes(incoming, state.nodes);
  state.nodeHolder.add(newNodes);
  return { ...state, nodes: [...state.nodes, ...newNodes] };
};

const addEdges = (state, incoming) => {
  const newEdges = getDiffEdges(incoming, state.edges);
  state.edgeHolder.add(newEdges);
  return { ...state, edges: [...state.edges, ...newEdges] };
};

export const reducer =  (state=initialState, action)=>{
  switch (action.type){
    case ACTIONS.CLEAR_GRAPH: {
      state.nodeHolder.clear();
      state.edgeHolder.clear();

      return { ...state, nodes: [], edges: [], selectedNode:{}, selectedEdge: {} };
    }
    case ACTIONS.SET_NETWORK: {
      return { ...state, network: action.payload };
    }
    case ACTIONS.ADD_NODES: {
      return addNodes(state, action.payload);
    }
    case ACTIONS.ADD_EDGES: {
      return addEdges(state, action.payload);
    }
    case ACTIONS.SEED_DEMO_GRAPH: {
      return addEdges(addNodes(state, action.payload.nodes), action.payload.edges);
    }
    case ACTIONS.RESTYLE_NODES: {
      const styles = new Map(action.payload.map(style => [style.id, style]));
      state.nodeHolder.update(action.payload);
      const restyle = node => (styles.has(node.id) ? { ...node, ...styles.get(node.id) } : node);
      const selectedNode = state.selectedNode && styles.has(state.selectedNode.id) ? restyle(state.selectedNode) : state.selectedNode;
      return { ...state, nodes: state.nodes.map(restyle), selectedNode };
    }
    case ACTIONS.SET_SELECTED_NODE: {
      const nodeId = action.payload;
      let selectedNode = {};
      if (nodeId !== null) {
        selectedNode = findNodeById(state.nodes, nodeId);
      }
      return { ...state, selectedNode, selectedEdge: {} };
    }
    case ACTIONS.SET_SELECTED_EDGE: {
      const edgeId = action.payload;
      let selectedEdge = {};
      if (edgeId !== null) {
        selectedEdge = findNodeById(state.edges, edgeId);
      }
      return { ...state, selectedEdge, selectedNode: {} };
    }
    case ACTIONS.REFRESH_NODE_LABELS: {
      const nodeLabelMap = mapValues(keyBy(action.payload, 'type'), (nodeLabel) => nodeLabel.field);
      const nodes = state.nodes.map(node => {
        if (node.type in nodeLabelMap) {
          const field = nodeLabelMap[node.type];
          const label = getNodeLabel(node.properties, field, node.type);
          state.nodeHolder.update({id:node.id, label: label});
          return {...node, label };
        }
        return node;
      });
      const selectedNode = state.selectedNode && state.selectedNode.id !== undefined
        ? nodes.find(node => node.id === state.selectedNode.id) || state.selectedNode
        : state.selectedNode;
      return { ...state, nodes, selectedNode };
    }
    default:
      return state;
  }
};
