import { ACTIONS } from '../constants';

const initialState = {
  nodeLabels: [],
  queryHistory: [],
  isPhysicsEnabled: true,
  nodeLimit: 100,
  selectedResultViewMode: 'table',
  networkOptions: {
    physics: {
      forceAtlas2Based: {
        gravitationalConstant: -26,
        centralGravity: 0.005,
        springLength: 230,
        springConstant: 0.18,
        avoidOverlap: 1.5
      },
      maxVelocity: 40,
      solver: 'forceAtlas2Based',
      timestep: 0.35,
      stabilization: {
        enabled: true,
        iterations: 50,
        updateInterval: 25,
        fit: false
      }
    },
    nodes: {
      shape: "dot",
      size: 20,
      borderWidth: 2,
      color: {
        background: '#22c55e',
        border: '#bbf7d0',
        highlight: {
          background: '#86efac',
          border: '#f8fafc'
        }
      },
      font: {
        color: '#f8fafc',
        face: 'JetBrains Mono',
        size: 12,
        strokeColor: '#0f172a',
        strokeWidth: 4
      }
    },
    groups: {
      person: {
        color: { background: '#22c55e', border: '#bbf7d0' }
      },
      company: {
        color: { background: '#38bdf8', border: '#bae6fd' }
      },
      project: {
        color: { background: '#a78bfa', border: '#ddd6fe' }
      },
      dataset: {
        color: { background: '#f59e0b', border: '#fde68a' }
      },
      tag: {
        color: { background: '#f43f5e', border: '#fecdd3' },
        shape: 'box',
        margin: {
          top: 7,
          right: 14,
          bottom: 7,
          left: 14
        },
        font: {
          color: '#fff1f2',
          face: 'JetBrains Mono',
          size: 10,
          strokeColor: '#0f172a',
          strokeWidth: 2
        }
      }
    },
    edges: {
      color: {
        color: '#64748b',
        highlight: '#22c55e',
        hover: '#94a3b8'
      },
      selectionWidth: 3,
      width: 1.5,
      font: {
        color: '#cbd5e1',
        face: 'JetBrains Mono',
        size: 11,
        strokeColor: '#0f172a',
        strokeWidth: 3
      },
      smooth: {
        type: 'continuous'
      }
    }
  }
};

export const reducer =  (state=initialState, action)=>{
  switch (action.type){
    case ACTIONS.SET_IS_PHYSICS_ENABLED: {
      const isPhysicsEnabled = action.payload === undefined ? true : action.payload;
      return { ...state, isPhysicsEnabled };
    }
    case ACTIONS.ADD_QUERY_HISTORY: {
      return { ...state, queryHistory: [ ...state.queryHistory, action.payload] }
    }
    case ACTIONS.CLEAR_QUERY_HISTORY: {
      return { ...state, queryHistory: [] }
    }
    case ACTIONS.SET_NODE_LABELS: {
      const nodeLabels = action.payload === undefined ? [] : action.payload;
      return { ...state, nodeLabels };
    }
    case ACTIONS.ADD_NODE_LABEL: {
      const nodeLabels = [...state.nodeLabels, {}];
      return { ...state, nodeLabels };
    }
    case ACTIONS.EDIT_NODE_LABEL: {
      const editIndex = action.payload.id;
      const editedNodeLabel = action.payload.nodeLabel;

      if (state.nodeLabels[editIndex]) {
        const nodeLabels = [...state.nodeLabels.slice(0, editIndex), editedNodeLabel, ...state.nodeLabels.slice(editIndex+1)];
        return { ...state, nodeLabels };
      }
      return state;
    }
    case ACTIONS.REMOVE_NODE_LABEL: {
      const removeIndex = action.payload;
      if (removeIndex < state.nodeLabels.length) {
        const nodeLabels = [...state.nodeLabels.slice(0, removeIndex), ...state.nodeLabels.slice(removeIndex+1)];
        return { ...state, nodeLabels };
      }
      return state;
    }
    case ACTIONS.SET_NODE_LIMIT: {
      const nodeLimit = action.payload;
      return { ...state, nodeLimit };
    }
    case ACTIONS.SET_SELECTED_RESULT_VIEW_MODE: {
      if (action.payload !== 'table' && action.payload !== 'json') {
        return state;
      }
      return { ...state, selectedResultViewMode: action.payload };
    }
    default:
      return state;
  }
};
