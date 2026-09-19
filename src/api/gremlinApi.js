import { QUERY_ENDPOINT } from '../constants';
import { QUERY_FAILURE_KINDS } from '../logics/queryFeedback';

const createQueryRequestError = ({ kind, status, message }) => {
  const error = new Error(message || 'Query request failed');
  error.kind = kind;
  error.status = status;
  return error;
};

export const executeQuery = ({ query, nodeLimit }) => {
  return fetch(QUERY_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, nodeLimit })
  }).then((response) => {
    if (!response.ok) {
      const kind = response.status === 400
        ? QUERY_FAILURE_KINDS.VALIDATION
        : response.status === 413
          ? QUERY_FAILURE_KINDS.PAYLOAD_TOO_LARGE
          : response.status >= 500
            ? QUERY_FAILURE_KINDS.SERVER
            : QUERY_FAILURE_KINDS.UNKNOWN;

      throw createQueryRequestError({
        kind,
        status: response.status,
        message: `Query request failed with status ${response.status}`
      });
    }

    return response.json();
  }).then((data) => ({ data })).catch((error) => {
    if (error.kind) {
      throw error;
    }

    throw createQueryRequestError({
      kind: QUERY_FAILURE_KINDS.NETWORK,
      message: error.message
    });
  });
};
