import { CONNECTION_ENDPOINT, QUERY_ENDPOINT, TRAVERSE_ENDPOINT } from '../constants';
import { QUERY_FAILURE_KINDS } from '../logics/queryFeedback';

const createQueryRequestError = ({ kind, status, code, diagnostics, message }) => {
  const error = new Error(message || 'Request failed');
  error.kind = kind;
  error.status = status;
  error.code = code;
  error.diagnostics = diagnostics;
  return error;
};

const classifyStatus = (status) => {
  return status === 400
    ? QUERY_FAILURE_KINDS.VALIDATION
    : status === 413
      ? QUERY_FAILURE_KINDS.PAYLOAD_TOO_LARGE
      : status >= 500
        ? QUERY_FAILURE_KINDS.SERVER
        : QUERY_FAILURE_KINDS.UNKNOWN;
};

const requestJson = (endpoint, method, body) => {
  const options = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  return fetch(endpoint, options).then(async (response) => {
    let payload;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (!response.ok) {
      throw createQueryRequestError({
        kind: classifyStatus(response.status),
        status: response.status,
        code: payload && payload.error && payload.error.code,
        diagnostics: payload && payload.diagnostics,
        message: payload && payload.error && payload.error.message
          ? payload.error.message
          : `Request failed with status ${response.status}`
      });
    }

    return payload;
  }).catch((error) => {
    if (error.kind) {
      throw error;
    }

    throw createQueryRequestError({
      kind: QUERY_FAILURE_KINDS.NETWORK,
      message: error.message
    });
  });
};

export const executeQuery = ({ query, nodeLimit }) => {
  return requestJson(QUERY_ENDPOINT, 'POST', { query, nodeLimit });
};

export const executeTraversal = ({ nodeId, direction, nodeLimit }) => {
  return requestJson(TRAVERSE_ENDPOINT, 'POST', { nodeId, direction, nodeLimit });
};

export const getConnection = () => {
  return requestJson(CONNECTION_ENDPOINT, 'GET');
};

export const switchConnection = ({ endpoint, primaryKey, database, container, partitionKey }) => {
  return requestJson(CONNECTION_ENDPOINT, 'PUT', {
    endpoint,
    primaryKey,
    database,
    container,
    partitionKey
  });
};
