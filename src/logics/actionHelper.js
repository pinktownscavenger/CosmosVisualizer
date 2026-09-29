import { extractEdgesAndNodes } from './utils';
import { ACTIONS } from '../constants';
import { getQueryFailureFeedback } from './queryFeedback';

export const onFetchQuery = (result, query, oldNodeLabels, dispatch) => {
  if (result.diagnostics !== undefined) {
    dispatch({ type: ACTIONS.SET_OPERATION_DIAGNOSTICS, payload: result.diagnostics });
  }
  const { nodes, edges, nodeLabels } = extractEdgesAndNodes(result.data, oldNodeLabels);
  dispatch({ type: ACTIONS.ADD_NODES, payload: nodes });
  dispatch({ type: ACTIONS.ADD_EDGES, payload: edges });
  dispatch({ type: ACTIONS.SET_NODE_LABELS, payload: nodeLabels });
  dispatch({ type: ACTIONS.ADD_QUERY_HISTORY, payload: query });
  return { nodes: nodes.length, edges: edges.length };
};

export const onGraphRequestFailure = (error, dispatch) => {
  if (error && error.diagnostics) {
    dispatch({ type: ACTIONS.SET_OPERATION_DIAGNOSTICS, payload: error.diagnostics });
  }

  const feedback = getQueryFailureFeedback(error);
  dispatch({ type: ACTIONS.SET_ERROR, payload: `${feedback.title}. ${feedback.message}` });
  return feedback;
};
