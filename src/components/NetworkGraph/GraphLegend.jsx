import React from 'react';
import { Collapse } from '@material-ui/core';
import { motionTimeout } from '../../logics/motion';
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

export const GraphLegend = ({ nodes, edgeCount, colorMode, modeAssignments, collapsed, modeLocked, onModeChange, onToggleCollapsed }) => {
  const counts = `${pluralize(nodes.length, 'node')} · ${pluralize(edgeCount, 'edge')}`;
  const rows = getLegendRows(nodes, colorMode, modeAssignments || {});
  return (
    <div className={`graph-legend${collapsed ? ' graph-legend--collapsed' : ''}`} aria-label="Graph legend">
      <Collapse in={!collapsed} timeout={motionTimeout(200)} unmountOnExit>
        <div className="graph-legend__body">
          <div className="graph-legend__toggle" role="group" aria-label="Colour nodes by">
            {MODES.map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={colorMode === mode}
                disabled={modeLocked}
                title={modeLocked ? 'Available when the current operation finishes' : undefined}
                className="graph-legend__mode"
                onClick={() => onModeChange(mode)}
              >
                {label}
              </button>
            ))}
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
        </div>
      </Collapse>
      <div className="graph-legend__footer">
        <span className="graph-legend__counts">{counts}</span>
        <button
          type="button"
          className={`graph-legend__chevron${collapsed ? ' graph-legend__chevron--collapsed' : ''}`}
          aria-label={collapsed ? 'Expand legend' : 'Collapse legend'}
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
        >
          ▾
        </button>
      </div>
    </div>
  );
};
