import { ACTIONS } from '../constants';

const COLOR_MODES = ['type', 'partition'];

const initialState = {
  nodeLabels: [],
  queryHistory: [],
  isPhysicsEnabled: true,
  nodeLimit: 100,
  selectedResultViewMode: 'table',
  inspectorCollapsed: false,
  historyCursor: null,
  colorMode: 'type',
  colorAssignments: { type: {}, partition: {} },
  legendCollapsed: false,
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
      // Colour comes from the node palette (nodeColors.js); this group only shapes tags as boxes.
      tag: {
        labelHighlightBold: false,
        shape: 'box',
        margin: {
          top: 7,
          right: 20,
          bottom: 7,
          left: 20
        },
        font: {
          color: '#f1f5f9',
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
        background: 'rgba(11, 17, 32, 0.92)',
        strokeWidth: 0
      },
      smooth: {
        type: 'dynamic'
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
      return { ...state, queryHistory: [ ...state.queryHistory, action.payload], historyCursor: null }
    }
    case ACTIONS.CLEAR_QUERY_HISTORY: {
      return { ...state, queryHistory: [], historyCursor: null }
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
    case ACTIONS.SET_COLOR_MODE: {
      return COLOR_MODES.includes(action.payload) ? { ...state, colorMode: action.payload } : state;
    }
    case ACTIONS.SET_COLOR_ASSIGNMENTS: {
      return { ...state, colorAssignments: action.payload };
    }
    case ACTIONS.SET_LEGEND_COLLAPSED: {
      return { ...state, legendCollapsed: Boolean(action.payload) };
    }
    case ACTIONS.SWITCH_CONNECTION_SUCCESS: {
      return { ...state, colorAssignments: { type: {}, partition: {} } };
    }
    case ACTIONS.SET_INSPECTOR_COLLAPSED: {
      return { ...state, inspectorCollapsed: Boolean(action.payload) };
    }
    case ACTIONS.SET_HISTORY_CURSOR: {
      return { ...state, historyCursor: action.payload === undefined ? null : action.payload };
    }
    default:
      return state;
  }
};
