import React from 'react';
import { PALETTE, getLegendRows, NOT_RETURNED } from '../../logics/nodeColors';

const pluralize = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

const MODES = [['type', 'Type'], ['partition', 'Partition']];

const swatchStyle = (slot) => {
  if (slot === NOT_RETURNED) {
    return { background: PALETTE.notReturned.background, borderColor: PALETTE.notReturned.border, borderStyle: 'dashed' };
  }
  const entry = typeof slot === 'number' ? PALETTE.slots[slot] : PALETTE.other;
  return { background: entry.background, borderColor: entry.border };
};

export const GraphLegend = ({ nodes, edgeCount, colorMode, modeAssignments, collapsed, onModeChange, onToggleCollapsed }) => {
  const counts = `${pluralize(nodes.length, 'node')} · ${pluralize(edgeCount, 'edge')}`;
  if (collapsed) {
    return (
      <div className="graph-legend graph-legend--collapsed" aria-label="Graph summary">
        <span className="graph-legend__counts">{counts}</span>
        <button type="button" className="graph-legend__chevron" aria-label="Expand legend" onClick={onToggleCollapsed}>▴</button>
      </div>
    );
  }

  const rows = getLegendRows(nodes, colorMode, modeAssignments || {});
  return (
    <div className="graph-legend" aria-label="Graph legend">
      <div className="graph-legend__header">
        <div className="graph-legend__toggle" role="group" aria-label="Colour nodes by">
          {MODES.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={colorMode === mode}
              className="graph-legend__mode"
              onClick={() => onModeChange(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="graph-legend__chevron" aria-label="Collapse legend" onClick={onToggleCollapsed}>▾</button>
      </div>
      {rows.length > 0 && (
        <ul className="graph-legend__rows">
          {rows.map(row => (
            <li key={row.key} className="graph-legend__row" title={row.keys ? row.keys.join(', ') : row.label}>
              <span className="graph-legend__swatch" style={swatchStyle(row.slot)} aria-hidden="true" />
              <span className="graph-legend__label">{row.label}</span>
              <span className="graph-legend__count">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
      <span className="graph-legend__counts">{counts}</span>
    </div>
  );
};
