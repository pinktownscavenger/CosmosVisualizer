import React from 'react';
import { connect } from 'react-redux';
import { ACTIONS } from '../../constants';
import { getSelectedResultPayload } from '../../logics/selectedResult';
import { getDisplayProperties } from '../../logics/propertyFormat';
import { runTraversal } from '../../logics/graphOperations';
import { applyGraphControl } from '../../logics/graphControls';
import { NodeHeader } from './NodeHeader';
import { EdgeHeader } from './EdgeHeader';
import { PropertyList } from './PropertyList';

const isEmpty = (selection) => !selection || Object.keys(selection).length === 0;

// Escape belongs to whatever the user is typing in, or to an open dialog/popover.
const isEscapeOwnedElsewhere = (target) => {
  if (!target || typeof target.closest !== 'function') {
    return false;
  }
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="presentation"]'));
};

const defaultCopyText = (text) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return Promise.reject(new Error('Clipboard unavailable'));
  }
  return navigator.clipboard.writeText(text);
};

const COPY_STATUS_MS = 2000;

const selectionId = ({ selectedNode, selectedEdge }) => (
  (selectedNode && selectedNode.id) || (selectedEdge && selectedEdge.id)
);

export class Inspector extends React.Component {
  constructor(props) {
    super(props);
    this.state = { copyStatus: null };
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown);
  }

  componentDidUpdate(previousProps) {
    if (selectionId(previousProps) !== selectionId(this.props) && this.state.copyStatus) {
      this.clearCopyStatus();
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
    clearTimeout(this.copyTimer);
    this.unmounted = true;
  }

  onKeyDown(event) {
    if (event.key !== 'Escape' || !this.hasSelection() || isEscapeOwnedElsewhere(event.target)) {
      return;
    }
    this.props.onClose();
  }

  hasSelection() {
    return !isEmpty(this.props.selectedNode) || !isEmpty(this.props.selectedEdge);
  }

  clearCopyStatus() {
    clearTimeout(this.copyTimer);
    this.setState({ copyStatus: null });
  }

  // The result only belongs to the item that was copied, and fades after a moment.
  copyId(id) {
    const copyText = this.props.copyText || defaultCopyText;
    const showStatus = (copyStatus) => {
      if (this.unmounted || selectionId(this.props) !== id) {
        return;
      }
      clearTimeout(this.copyTimer);
      this.setState({ copyStatus });
      this.copyTimer = setTimeout(() => {
        if (!this.unmounted) {
          this.setState({ copyStatus: null });
        }
      }, COPY_STATUS_MS);
    };
    return Promise.resolve()
      .then(() => copyText(String(id)))
      .then(() => showStatus('Copied'), () => showStatus('Copy failed'));
  }

  renderIdRow(id) {
    return (
      <div className="inspector-card__id">
        <code>{String(id)}</code>
        <button type="button" className="inspector-icon" aria-label="Copy id" onClick={() => this.copyId(id)}>⧉</button>
        {this.state.copyStatus && <span className="inspector-card__copy-status" role="status">{this.state.copyStatus}</span>}
      </div>
    );
  }

  render() {
    const { selectedNode, selectedEdge, collapsed, viewMode } = this.props;
    const kind = !isEmpty(selectedNode) ? 'node' : (!isEmpty(selectedEdge) ? 'edge' : null);
    if (!kind) {
      return null;
    }
    const item = kind === 'node' ? selectedNode : selectedEdge;
    const title = kind === 'node' ? item.label : item.type;
    const badge = kind === 'node' ? item.type : 'edge';
    const isJson = viewMode === 'json';
    const idRow = this.renderIdRow(item.id);

    return (
      <aside
        className={`inspector-card${collapsed ? ' inspector-card--collapsed' : ''}`}
        aria-label="Selection inspector"
      >
        <header className="inspector-card__header">
          <div className="inspector-card__title-row">
            <h2 className="inspector-card__title">{String(title)}</h2>
            <span className={`inspector-card__badge inspector-card__badge--${kind}`}>{String(badge)}</span>
            <span className="inspector-card__spacer" />
            {!collapsed && (
              <button
                type="button"
                className="inspector-icon"
                aria-label="Show JSON"
                aria-pressed={isJson}
                onClick={() => this.props.onViewModeChanged(isJson ? 'table' : 'json')}
              >
                {'{ }'}
              </button>
            )}
            <button
              type="button"
              className="inspector-icon"
              aria-label={collapsed ? 'Expand inspector' : 'Collapse inspector'}
              onClick={this.props.onToggleCollapsed}
            >
              {collapsed ? '+' : '–'}
            </button>
            <button type="button" className="inspector-icon" aria-label="Close inspector" onClick={this.props.onClose}>✕</button>
          </div>
          {kind === 'node' ? (
            <NodeHeader
              node={item}
              collapsed={collapsed}
              disabled={this.props.disabled}
              idRow={idRow}
              onTraverse={this.props.onTraverse}
              onCenter={this.props.onCenter}
            />
          ) : (
            <EdgeHeader
              edge={item}
              nodes={this.props.nodes}
              collapsed={collapsed}
              idRow={idRow}
              onSelectNode={this.props.onSelectNode}
            />
          )}
        </header>
        {!collapsed && (
          <div className="inspector-card__body">
            {isJson
              ? <pre className="inspector-card__json">{JSON.stringify(getSelectedResultPayload(selectedNode, selectedEdge), null, 2)}</pre>
              : <PropertyList rows={getDisplayProperties(item.properties, kind === 'node' ? this.props.partitionKey : null)} />}
          </div>
        )}
      </aside>
    );
  }
}

const normalizePartitionKey = (partitionKey) => {
  if (typeof partitionKey !== 'string') {
    return null;
  }
  return partitionKey.trim().replace(/^\//, '') || null;
};

class ConnectedInspector extends React.Component {
  centerOn(nodeId) {
    applyGraphControl(this.props.network, 'center-selection', { selectedNode: { id: nodeId } });
  }

  render() {
    const { dispatch, network } = this.props;
    return (
      <Inspector
        selectedNode={this.props.selectedNode}
        selectedEdge={this.props.selectedEdge}
        nodes={this.props.nodes}
        edges={this.props.edges}
        partitionKey={this.props.partitionKey}
        viewMode={this.props.viewMode}
        collapsed={this.props.collapsed}
        disabled={this.props.disabled}
        onClose={() => {
          dispatch({ type: ACTIONS.SET_SELECTED_NODE, payload: null });
          if (network && typeof network.unselectAll === 'function') {
            network.unselectAll();
          }
        }}
        onToggleCollapsed={() => dispatch({ type: ACTIONS.SET_INSPECTOR_COLLAPSED, payload: !this.props.collapsed })}
        onViewModeChanged={mode => dispatch({ type: ACTIONS.SET_SELECTED_RESULT_VIEW_MODE, payload: mode })}
        onTraverse={(nodeId, direction) => runTraversal({
          nodeId,
          direction,
          nodeLimit: this.props.nodeLimit,
          nodeLabels: this.props.nodeLabels,
          current: {
            nodes: this.props.nodes,
            edges: this.props.edges,
            colorMode: this.props.colorMode,
            colorAssignments: this.props.colorAssignments
          },
          dispatch
        })}
        onCenter={() => this.centerOn(this.props.selectedNode.id)}
        onSelectNode={(nodeId) => {
          dispatch({ type: ACTIONS.SET_SELECTED_NODE, payload: nodeId });
          if (network && typeof network.selectNodes === 'function') {
            network.selectNodes([nodeId]);
          }
          this.centerOn(nodeId);
        }}
      />
    );
  }
}

export default connect((state) => ({
  network: state.graph.network,
  selectedNode: state.graph.selectedNode,
  selectedEdge: state.graph.selectedEdge,
  nodes: state.graph.nodes,
  edges: state.graph.edges,
  partitionKey: normalizePartitionKey(state.connection.connection && state.connection.connection.partitionKey),
  viewMode: state.options.selectedResultViewMode,
  collapsed: state.options.inspectorCollapsed,
  nodeLimit: state.options.nodeLimit,
  nodeLabels: state.options.nodeLabels,
  colorMode: state.options.colorMode,
  colorAssignments: state.options.colorAssignments,
  disabled: state.gremlin.queryStatus === 'running'
    || state.connection.loading
    || state.connection.switching
    || state.connection.status !== 'connected'
}))(ConnectedInspector);
