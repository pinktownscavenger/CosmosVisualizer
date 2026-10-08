import {
  ACTIONS,
  EMPTY_GREMLIN_QUERY_ERROR,
  QUERY_RUNNING_MESSAGE,
  TOO_LONG_GREMLIN_QUERY_ERROR
} from '../constants';
import { executeQuery, executeTraversal } from '../api/gremlinApi';
import { onFetchQuery, onGraphRequestFailure } from './actionHelper';
import { getQueryResultStatus, isQueryTooLong } from './queryFeedback';
import { makeTraversalHistoryQuery } from './utils';

let lastSubmittedQuery = null;

export const getLastSubmittedQuery = () => lastSubmittedQuery;

const rejectQuery = (message, dispatch) => {
  dispatch({ type: ACTIONS.SET_ERROR, payload: { message, action: 'edit-query', actionLabel: 'Edit query' } });
  return Promise.resolve();
};

const publishResult = (request, historyQuery, nodeLabels, current, dispatch) => request
  .then((response) => {
    const summary = onFetchQuery(response, historyQuery, nodeLabels, dispatch, current);
    dispatch({ type: ACTIONS.SET_QUERY_STATUS, payload: getQueryResultStatus(summary) });
  })
  .catch((error) => {
    onGraphRequestFailure(error, dispatch);
  });

export const runQuery = ({ query, nodeLimit, nodeLabels, current, dispatch }) => {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return rejectQuery(EMPTY_GREMLIN_QUERY_ERROR, dispatch);
  }
  if (isQueryTooLong(trimmed)) {
    return rejectQuery(TOO_LONG_GREMLIN_QUERY_ERROR, dispatch);
  }

  lastSubmittedQuery = trimmed;
  dispatch({ type: ACTIONS.SET_QUERY_STATUS, payload: { status: 'running', message: QUERY_RUNNING_MESSAGE } });
  return publishResult(executeQuery({ query: trimmed, nodeLimit }), trimmed, nodeLabels, current, dispatch);
};

export const runTraversal = ({ nodeId, direction, nodeLimit, nodeLabels, current, dispatch }) => {
  dispatch({
    type: ACTIONS.SET_QUERY_STATUS,
    payload: { status: 'running', message: `Traversing ${direction === 'in' ? 'inbound' : 'outbound'} edges...` }
  });
  return publishResult(
    executeTraversal({ nodeId, direction, nodeLimit }),
    makeTraversalHistoryQuery(nodeId, direction),
    nodeLabels,
    current,
    dispatch
  );
};
