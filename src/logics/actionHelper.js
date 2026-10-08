import { extractEdgesAndNodes, getDiffEdges, getDiffNodes } from './utils';
import { ACTIONS } from '../constants';
import { getQueryFailureFeedback } from './queryFeedback';

export const onFetchQuery = (result, query, oldNodeLabels, dispatch, current = { nodes: [], edges: [] }) => {
  if (result.diagnostics !== undefined) {
    dispatch({ type: ACTIONS.SET_OPERATION_DIAGNOSTICS, payload: result.diagnostics });
  }
  const { nodes, edges, nodeLabels } = extractEdgesAndNodes(result.data, oldNodeLabels);
  dispatch({ type: ACTIONS.ADD_NODES, payload: nodes });
  dispatch({ type: ACTIONS.ADD_EDGES, payload: edges });
  dispatch({ type: ACTIONS.SET_NODE_LABELS, payload: nodeLabels });
  dispatch({ type: ACTIONS.ADD_QUERY_HISTORY, payload: query });
  const uniqueNodes = getDiffNodes(nodes, []);
  const uniqueEdges = getDiffEdges(edges, []);
  return {
    nodes: uniqueNodes.length,
    edges: uniqueEdges.length,
    newNodes: getDiffNodes(uniqueNodes, current.nodes || []).length,
    newEdges: getDiffEdges(uniqueEdges, current.edges || []).length
  };
};

export const onGraphRequestFailure = (error, dispatch) => {
  if (error && error.diagnostics) {
    dispatch({ type: ACTIONS.SET_OPERATION_DIAGNOSTICS, payload: error.diagnostics });
  }

  const feedback = getQueryFailureFeedback(error);
  dispatch({
    type: ACTIONS.SET_ERROR,
    payload: {
      message: `${feedback.title}. ${feedback.message}`,
      action: feedback.action,
      actionLabel: feedback.actionLabel
    }
  });
  return feedback;
};
