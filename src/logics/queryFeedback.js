import { MAX_QUERY_LENGTH } from '../constants';

export const QUERY_FAILURE_KINDS = {
  VALIDATION: 'validation',
  PAYLOAD_TOO_LARGE: 'payload-too-large',
  SERVER: 'server',
  NETWORK: 'network',
  UNKNOWN: 'unknown'
};

export const isQueryTooLong = (query) => {
  return typeof query === 'string' && query.length > MAX_QUERY_LENGTH;
};

export const getQueryFailureFeedback = (error = {}) => {
  if (error.kind === QUERY_FAILURE_KINDS.VALIDATION || error.status === 400) {
    return {
      status: 'error',
      title: 'Query needs an edit',
      message: 'Cosmos DB for Gremlin rejected the traversal before it ran.',
      actionLabel: 'Edit query'
    };
  }

  if (error.kind === QUERY_FAILURE_KINDS.PAYLOAD_TOO_LARGE || error.status === 413) {
    return {
      status: 'error',
      title: 'Query is too large',
      message: `Keep Gremlin traversals under ${MAX_QUERY_LENGTH} characters before sending them to Cosmos.`,
      actionLabel: 'Reduce query'
    };
  }

  if (error.kind === QUERY_FAILURE_KINDS.NETWORK) {
    return {
      status: 'error',
      title: 'Cannot reach the Cosmos proxy',
      message: 'The browser could not reach the local Cosmos graph proxy. Check that the server is running, then retry.',
      actionLabel: 'Check server'
    };
  }

  if (error.kind === QUERY_FAILURE_KINDS.SERVER || error.status >= 500) {
    return {
      status: 'error',
      title: 'Cosmos graph query failed',
      message: 'Cosmos or the graph proxy failed while running the traversal. Retry, or check the proxy logs for connection details.',
      actionLabel: 'Retry query'
    };
  }

  return {
    status: 'error',
    title: 'Query failed',
    message: 'The traversal could not be completed. Check the query and try again.',
    actionLabel: 'Try again'
  };
};

export const getQueryResultStatus = ({ nodes, edges }) => {
  if (nodes === 0 && edges === 0) {
    return {
      status: 'empty',
      message: 'Query ran, but Cosmos returned no vertices for this traversal.'
    };
  }

  const nodeLabel = nodes === 1 ? 'node' : 'nodes';
  const edgeLabel = edges === 1 ? 'edge' : 'edges';
  return {
    status: 'success',
    message: `Query complete. Added ${nodes} ${nodeLabel} and ${edges} ${edgeLabel}.`
  };
};
