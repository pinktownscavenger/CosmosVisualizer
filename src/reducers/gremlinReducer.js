import { ACTIONS } from '../constants';

const initialState = {
  query: '',
  error: null,
  queryStatus: 'idle',
  queryStatusMessage: 'Ready to explore the graph.',
  latestDiagnostics: null
};

export const reducer =  (state=initialState, action)=>{
  switch (action.type){
    case ACTIONS.SET_QUERY: {
      return { ...state, query: action.payload, error: null }
    }
    case ACTIONS.SET_ERROR: {
      const error = typeof action.payload === 'string' ? { message: action.payload } : action.payload || null;
      return {
        ...state,
        error,
        queryStatus: error ? 'error' : state.queryStatus,
        queryStatusMessage: error ? error.message : state.queryStatusMessage
      }
    }
    case ACTIONS.SET_QUERY_STATUS: {
      const payload = action.payload || {};
      const status = payload.status || 'idle';
      return {
        ...state,
        error: status === 'running' ? null : state.error,
        queryStatus: status,
        queryStatusMessage: payload.message || ''
      }
    }
    case ACTIONS.SET_OPERATION_DIAGNOSTICS: {
      return { ...state, latestDiagnostics: action.payload || null };
    }
    case ACTIONS.CLEAR_OPERATION_DIAGNOSTICS: {
      return { ...state, latestDiagnostics: null };
    }
    default:
      return state;
  }
};
