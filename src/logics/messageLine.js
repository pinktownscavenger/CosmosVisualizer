import { analyzePartitionFanOut } from './partitionAnalysis';

const errorLine = ({ message, action, actionLabel }) => {
  const line = { tone: 'error', text: message };
  if (action) {
    line.action = action;
    line.actionLabel = actionLabel;
  }
  return line;
};

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

  const advisories = connection.status === 'connected' && connection.connection
    ? analyzePartitionFanOut(gremlin.query, connection.connection.partitionKey)
    : [];
  if (advisories.length === 1) {
    return { tone: 'advisory', text: advisories[0].message };
  }
  if (advisories.length > 1) {
    return {
      tone: 'advisory',
      text: `${advisories[0].message} +${advisories.length - 1} more`,
      tooltip: advisories.map(advisory => advisory.message).join('\n')
    };
  }

  return { tone: gremlin.queryStatus, text: gremlin.queryStatusMessage };
};
