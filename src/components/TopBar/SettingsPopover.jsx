import React from 'react';
import { Popover, Switch } from '@material-ui/core';
import SettingsIcon from '@material-ui/icons/Settings';

export const SettingsPanel = ({
  nodeLimit,
  isPhysicsEnabled,
  nodeLabels,
  onNodeLimitChange,
  onTogglePhysics,
  onAddLabel,
  onEditLabel,
  onRemoveLabel,
  onApplyLabels
}) => (
  <div className="settings-panel">
    <label className="settings-panel__field" htmlFor="settings-node-limit">
      <span>Node limit</span>
      <input
        id="settings-node-limit"
        type="number"
        min="0"
        value={nodeLimit}
        title="Maximum nodes returned by a query. Empty or 0 means no limit."
        onChange={event => onNodeLimitChange(event.target.value)}
      />
    </label>
    <label className="settings-panel__toggle">
      <span>Physics</span>
      <Switch
        color="primary"
        checked={Boolean(isPhysicsEnabled)}
        inputProps={{ 'aria-label': 'Physics' }}
        onChange={event => onTogglePhysics(event.target.checked)}
      />
    </label>
    <div className="settings-panel__labels">
      <span className="settings-panel__heading">Node labels</span>
      <p className="settings-panel__hint">Choose which property is shown for each node type.</p>
      {nodeLabels.map((nodeLabel, index) => (
        <div className="settings-panel__label-row" key={index}>
          <input
            id={`node-type-${index}`}
            aria-label={`Node type ${index + 1}`}
            placeholder="node type"
            value={nodeLabel.type || ''}
            onChange={event => onEditLabel(index, { type: event.target.value, field: nodeLabel.field })}
          />
          <input
            id={`label-field-${index}`}
            aria-label={`Label field ${index + 1}`}
            placeholder="property"
            value={nodeLabel.field || ''}
            onChange={event => onEditLabel(index, { type: nodeLabel.type, field: event.target.value })}
          />
          <button type="button" className="settings-panel__remove" aria-label={`Remove node label ${index + 1}`} onClick={() => onRemoveLabel(index)}>✕</button>
        </div>
      ))}
      <div className="settings-panel__actions">
        <button type="button" className="settings-panel__button" onClick={onAddLabel}>+ Add</button>
        <button type="button" className="settings-panel__button settings-panel__button--primary" onClick={onApplyLabels}>Apply</button>
      </div>
    </div>
  </div>
);

export class SettingsPopover extends React.Component {
  constructor(props) {
    super(props);
    this.state = { anchor: null };
  }

  render() {
    return (
      <>
        <button
          type="button"
          className="top-bar__control top-bar__gear"
          aria-label="Settings"
          aria-haspopup="true"
          aria-expanded={Boolean(this.state.anchor)}
          onClick={event => this.setState({ anchor: event.currentTarget })}
        >
          <SettingsIcon style={{ fontSize: 22 }} />
        </button>
        <Popover
          open={Boolean(this.state.anchor)}
          anchorEl={this.state.anchor}
          onClose={() => this.setState({ anchor: null })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ className: 'top-bar__popover' }}
        >
          <SettingsPanel {...this.props} />
        </Popover>
      </>
    );
  }
}
