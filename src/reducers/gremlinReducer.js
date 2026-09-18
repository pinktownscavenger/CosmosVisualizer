import { ACTIONS } from '../constants';

const initialState = {
  query: '',
  error: null,
  queryStatus: 'idle',
  queryStatusMessage: 'Ready to explore the graph.'
};

export const reducer =  (state=initialState, action)=>{
  switch (action.type){
    case ACTIONS.SET_QUERY: {
      return { ...state, query: action.payload, error: null }
    }
    case ACTIONS.SET_ERROR: {
      return {
        ...state,
        error: action.payload,
        queryStatus: action.payload ? 'error' : state.queryStatus,
        queryStatusMessage: action.payload || state.queryStatusMessage
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
    default:
      return state;
  }
};
