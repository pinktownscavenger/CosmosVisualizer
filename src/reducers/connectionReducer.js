import { ACTIONS } from '../constants';

const initialState = {
  status: 'disconnected',
  connection: null,
  loading: true,
  switching: false,
  error: null,
  probeDiagnostics: null
};

const sanitizeConnection = (connection) => {
  if (!connection) {
    return null;
  }

  const sanitized = {
    mode: connection.mode,
    partitionKey: connection.partitionKey
  };
  if (connection.mode === 'cosmos') {
    sanitized.endpointHost = connection.endpointHost;
    sanitized.database = connection.database;
    sanitized.container = connection.container;
  }
  return sanitized;
};

export const reducer = (state = initialState, action) => {
  const payload = action.payload || {};

  switch (action.type) {
    case ACTIONS.LOAD_CONNECTION_START:
      return { ...state, loading: true, error: null };
    case ACTIONS.LOAD_CONNECTION_SUCCESS:
      return {
        ...state,
        status: payload.status || 'disconnected',
        connection: sanitizeConnection(payload.connection),
        loading: false,
        error: null
      };
    case ACTIONS.LOAD_CONNECTION_FAILURE:
      return {
        ...state,
        status: 'disconnected',
        connection: null,
        loading: false,
        error: payload.message || 'Could not load connection status'
      };
    case ACTIONS.SWITCH_CONNECTION_START:
      return { ...state, switching: true, error: null, probeDiagnostics: null };
    case ACTIONS.SWITCH_CONNECTION_SUCCESS:
      return {
        ...state,
        status: payload.status || 'connected',
        connection: sanitizeConnection(payload.connection),
        loading: false,
        switching: false,
        error: null,
        probeDiagnostics: payload.diagnostics || null
      };
    case ACTIONS.SWITCH_CONNECTION_FAILURE:
      return {
        ...state,
        switching: false,
        error: payload.message || 'Could not switch connection',
        probeDiagnostics: payload.diagnostics || null
      };
    default:
      return state;
  }
};
