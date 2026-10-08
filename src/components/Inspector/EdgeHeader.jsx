import React from 'react';

const nodeLabelFor = (nodes, id) => {
  const node = nodes.find(candidate => candidate.id === id);
  return node && node.label != null ? String(node.label) : String(id);
};

export const EdgeHeader = ({ edge, nodes, collapsed, idRow, onSelectNode }) => (
  <>
    <div className="inspector-card__meta inspector-card__endpoints">
      <button type="button" className="inspector-link" data-endpoint="from" onClick={() => onSelectNode(edge.from)}>
        {nodeLabelFor(nodes, edge.from)}
      </button>
      <span aria-hidden="true">→</span>
      <button type="button" className="inspector-link" data-endpoint="to" onClick={() => onSelectNode(edge.to)}>
        {nodeLabelFor(nodes, edge.to)}
      </button>
    </div>
    {!collapsed && idRow}
  </>
);
