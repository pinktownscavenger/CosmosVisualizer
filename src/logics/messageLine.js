import { analyzePartitionFanOut } from './partitionAnalysis';
import { scopeQueryToPartition } from './partitionRewrite';

const SCOPABLE_ADVISORIES = ['UNSCOPED_VERTEX_SCAN', 'ID_WITHOUT_PARTITION'];

const errorLine = ({ message, action, actionLabel }) => {
  const line = { tone: 'error', text: message };
  if (action) {
    line.action = action;
    line.actionLabel = actionLabel;
  }
  return line;
};

// A result the user just produced outranks advisories about the text they ran.
const FRESH_RESULT_STATUSES = ['running', 'success', 'empty'];

// The top bar has room for exactly one message; this picks it by priority.
export const getMessageLine = ({ gremlin, connection }) => {
  if (gremlin.error) {
    return errorLine(gremlin.error);
  }

  if (connection.error) {
    return errorLine({
      message: `Connection: ${connection.error}`,
      action: 'switch-connection',
      actionLabel: 'Switch connection'
    });
  }

  if (FRESH_RESULT_STATUSES.includes(gremlin.queryStatus)) {
    return { tone: gremlin.queryStatus, text: gremlin.queryStatusMessage };
  }

  const advisories = connection.status === 'connected' && connection.connection
    ? analyzePartitionFanOut(gremlin.query, connection.connection.partitionKey)
    : [];
  if (advisories.length > 0) {
    const line = { tone: 'advisory', text: advisories[0].message };
    if (advisories.length > 1) {
      line.text = `${advisories[0].message} +${advisories.length - 1} more`;
      line.tooltip = advisories.map(advisory => advisory.message).join('\n');
    }
    if (SCOPABLE_ADVISORIES.includes(advisories[0].code)
      && scopeQueryToPartition(gremlin.query, connection.connection.partitionKey, '')) {
      line.action = 'scope-partition';
      line.actionLabel = 'Scope to partition';
    }
    return line;
  }

  return { tone: gremlin.queryStatus, text: gremlin.queryStatusMessage };
};
