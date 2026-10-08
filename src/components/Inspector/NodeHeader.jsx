import React from 'react';
import { Tooltip } from '@material-ui/core';

export const INBOUND_FAN_OUT_HINT = 'Inbound traversals can fan out across Cosmos DB partitions.';

const PartitionChip = ({ partition }) => {
  if (!partition || !partition.name) {
    return null;
  }
  if (partition.value == null) {
    return <span className="inspector-chip inspector-chip--muted">partition · {partition.name} not returned</span>;
  }
  return <span className="inspector-chip inspector-chip--partition">partition · {partition.name} = {String(partition.value)}</span>;
};

export const NodeHeader = ({ node, collapsed, disabled, idRow, onTraverse, onCenter }) => (
  <>
    <div className="inspector-card__meta">
      <PartitionChip partition={node.partition} />
    </div>
    {!collapsed && idRow}
    <div className="inspector-card__actions">
      <button
        type="button"
        className="inspector-action"
        aria-label="Traverse out edges"
        disabled={disabled}
        onClick={() => onTraverse(node.id, 'out')}
      >
        → Traverse out
      </button>
      <Tooltip title={INBOUND_FAN_OUT_HINT}>
        <span>
          <button
            type="button"
            className="inspector-action inspector-action--warn"
            aria-label="Traverse in edges"
            disabled={disabled}
            onClick={() => onTraverse(node.id, 'in')}
          >
            ← Traverse in ⚠
          </button>
        </span>
      </Tooltip>
      <button type="button" className="inspector-action" aria-label="Center selected node" onClick={onCenter}>
        ◎ Center
      </button>
    </div>
  </>
);
