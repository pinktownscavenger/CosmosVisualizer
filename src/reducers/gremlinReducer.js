import { ACTIONS } from '../constants';

const initialState = {
  query: '',
  error: null,
  queryStatus: 'idle',
  queryStatusMessage: 'Ready to explore the graph.',
  latestDiagnostics: null,
  session: { total: 0, operations: 0, unpricedOperations: 0 }
};

const EMPTY_SESSION = { total: 0, operations: 0, unpricedOperations: 0 };

// Every query or traversal is counted; charges add up when Cosmos reports them.
const tallySession = (session, diagnostics) => {
  const charge = diagnostics && diagnostics.requestCharge && diagnostics.requestCharge.total;
  const priced = Number.isFinite(charge);
  return {
    total: priced ? session.total + charge : session.total,
    operations: session.operations + 1,
    unpricedOperations: priced ? session.unpricedOperations : session.unpricedOperations + 1
  };
};

export const reducer =  (state=initialState, action)=>{
  switch (action.type){
    case ACTIONS.SET_QUERY: {
      // Editing retires the last result; the message line can then show advisories for the new text.
      const queryStatus = state.queryStatus === 'running' ? 'running' : 'idle';
      return { ...state, query: action.payload, error: null, queryStatus }
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
      return {
        ...state,
        latestDiagnostics: action.payload || null,
        session: tallySession(state.session, action.payload)
      };
    }
    case ACTIONS.RESET_SESSION_CHARGE:
    case ACTIONS.SWITCH_CONNECTION_SUCCESS: {
      return { ...state, session: EMPTY_SESSION };
    }
    case ACTIONS.CLEAR_OPERATION_DIAGNOSTICS: {
      return { ...state, latestDiagnostics: null };
    }
    default:
      return state;
  }
};
