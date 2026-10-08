import React from 'react';
import { connect } from 'react-redux';
import { CircularProgress } from '@material-ui/core';
import { ACTIONS } from '../../constants';
import { getConnection, switchConnection as requestConnectionSwitch } from '../../api/gremlinApi';
import { retryLastOperation, runQuery, seedDemoGraph } from '../../logics/graphOperations';
import { getMessageLine } from '../../logics/messageLine';
import { stepHistory } from '../../logics/queryHistory';
import { scopeQueryToPartition } from '../../logics/partitionRewrite';
import { applyGraphControl } from '../../logics/graphControls';
import { ConnectionDialog } from '../Connection/ConnectionDialog';
import { ConnectionChip, getConnectionLabel } from './ConnectionChip';
import { QueryEditor } from './QueryEditor';
import { HistoryMenu } from './HistoryMenu';
import { RequestChargeChip } from './RequestChargeChip';
import { SettingsPopover } from './SettingsPopover';
import { MessageLine } from './MessageLine';

const runShortcut = () => (typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘↵' : 'Ctrl+↵');

const normalizePartitionKey = (partitionKey) => (
  typeof partitionKey === 'string' ? partitionKey.trim().replace(/^\//, '') || null : null
);

export class TopBar extends React.Component {
  constructor(props) {
    super(props);
    this.editorRef = React.createRef();
  }

  // The caret can only be placed once the rewritten query has rendered into the editor.
  componentDidUpdate() {
    const editor = this.editorRef.current;
    if (this.pendingCaret != null && editor && editor.value.length >= this.pendingCaret) {
      editor.focus();
      editor.setSelectionRange(this.pendingCaret, this.pendingCaret);
      this.pendingCaret = null;
    }
  }

  scopeToPartition() {
    const selected = this.props.selectedNode;
    const value = selected && selected.partition && selected.partition.value != null
      ? String(selected.partition.value)
      : '';
    const scoped = scopeQueryToPartition(
      this.props.query,
      this.props.connection && this.props.connection.partitionKey,
      value
    );
    if (!scoped) {
      return;
    }
    this.pendingCaret = scoped.cursor;
    this.onQueryChanged(scoped.query);
  }

  componentDidMount() {
    return this.loadConnection().then((payload) => {
      if (payload && payload.connection && payload.connection.mode === 'fixture') {
        seedDemoGraph({
          colorMode: this.props.colorMode,
          colorAssignments: this.props.colorAssignments,
          dispatch: this.props.dispatch
        });
      }
    });
  }

  loadConnection() {
    this.props.dispatch({ type: ACTIONS.LOAD_CONNECTION_START });
    return getConnection().then((payload) => {
      this.props.dispatch({ type: ACTIONS.LOAD_CONNECTION_SUCCESS, payload });
      return payload;
    }).catch((error) => {
      this.props.dispatch({
        type: ACTIONS.LOAD_CONNECTION_FAILURE,
        payload: { message: error.message || 'Could not load connection status' }
      });
      return null;
    });
  }

  switchConnection(config) {
    this.props.dispatch({ type: ACTIONS.SWITCH_CONNECTION_START });
    return requestConnectionSwitch(config).then((payload) => {
      this.props.dispatch({ type: ACTIONS.SWITCH_CONNECTION_SUCCESS, payload });
      this.props.dispatch({ type: ACTIONS.CLEAR_GRAPH });
      this.props.dispatch({ type: ACTIONS.CLEAR_OPERATION_DIAGNOSTICS });
      this.props.dispatch({ type: ACTIONS.SET_ERROR, payload: null });
      this.props.dispatch({
        type: ACTIONS.SET_QUERY_STATUS,
        payload: {
          status: 'idle',
          message: `Connected to ${getConnectionLabel('connected', payload.connection)}. Run a query to load the graph.`
        }
      });
      return payload;
    }).catch((error) => {
      this.props.dispatch({
        type: ACTIONS.SWITCH_CONNECTION_FAILURE,
        payload: { message: error.message || 'Could not switch connection', diagnostics: error.diagnostics }
      });
      throw error;
    });
  }

  openConnectionDialog() {
    this.props.dispatch({ type: ACTIONS.RESET_CONNECTION_FEEDBACK });
    this.props.dispatch({ type: ACTIONS.OPEN_CONNECTION_DIALOG });
  }

  // A failed probe changed nothing, so its error should not outlive the dialog.
  closeConnectionDialog() {
    this.props.dispatch({ type: ACTIONS.RESET_CONNECTION_FEEDBACK });
    this.props.dispatch({ type: ACTIONS.CLOSE_CONNECTION_DIALOG });
  }

  connectionSwitchDisabled() {
    return this.props.queryStatus === 'running' || this.props.connectionLoading || this.props.connectionSwitching;
  }

  currentGraph() {
    return {
      nodes: this.props.nodes,
      edges: this.props.edges,
      colorMode: this.props.colorMode,
      colorAssignments: this.props.colorAssignments
    };
  }

  graphActionsDisabled() {
    return this.props.queryStatus === 'running'
      || this.props.connectionLoading
      || this.props.connectionSwitching
      || this.props.connectionStatus !== 'connected';
  }

  runGraphQuery(query) {
    return runQuery({
      query,
      nodeLimit: this.props.nodeLimit,
      nodeLabels: this.props.nodeLabels,
      current: this.currentGraph(),
      dispatch: this.props.dispatch
    });
  }

  sendQuery() {
    return this.runGraphQuery(this.props.query);
  }

  onQueryChanged(query) {
    if (this.props.historyCursor !== null) {
      this.props.dispatch({ type: ACTIONS.SET_HISTORY_CURSOR, payload: null });
    }
    this.props.dispatch({ type: ACTIONS.SET_QUERY, payload: query });
  }

  onHistoryStep(direction) {
    const step = stepHistory({
      history: this.props.queryHistory,
      cursor: this.props.historyCursor,
      draft: '',
      editorValue: this.props.query
    }, direction);
    if (!step) {
      return null;
    }
    this.props.dispatch({ type: ACTIONS.SET_HISTORY_CURSOR, payload: step.cursor });
    this.props.dispatch({ type: ACTIONS.SET_QUERY, payload: step.value });
    return step.value;
  }

  focusEditor() {
    if (this.editorRef.current) {
      this.editorRef.current.focus();
    }
  }

  onMessageAction(action) {
    if (action === 'edit-query' || action === 'reduce-query') {
      this.focusEditor();
      return undefined;
    }
    if (action === 'retry' || action === 'wait-and-retry') {
      if (this.graphActionsDisabled()) {
        return undefined;
      }
      return retryLastOperation({
        nodeLimit: this.props.nodeLimit,
        nodeLabels: this.props.nodeLabels,
        current: this.currentGraph(),
        dispatch: this.props.dispatch,
        fallbackQuery: this.props.query
      });
    }
    if (action === 'scope-partition') {
      this.scopeToPartition();
      return undefined;
    }
    if (action === 'switch-connection') {
      if (!this.connectionSwitchDisabled()) {
        this.openConnectionDialog();
      }
      return undefined;
    }
    if (action === 'check-server') {
      return this.loadConnection();
    }
    return undefined;
  }

  loadHistoryQuery(query) {
    this.onQueryChanged(query);
    this.props.dispatch({
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'idle', message: 'History query loaded. Run it to refresh the graph.' }
    });
    this.focusEditor();
  }

  runHistoryQuery(query) {
    this.onQueryChanged(query);
    return this.runGraphQuery(query);
  }

  togglePhysics(enabled) {
    this.props.dispatch({ type: ACTIONS.SET_IS_PHYSICS_ENABLED, payload: enabled });
    applyGraphControl(this.props.network, 'physics', { enabled, networkOptions: this.props.networkOptions });
  }

  render() {
    const { dispatch } = this.props;
    const isRunning = this.props.queryStatus === 'running';
    const connectionLabel = getConnectionLabel(this.props.connectionStatus, this.props.connection);
    const partitionKey = this.props.connection ? normalizePartitionKey(this.props.connection.partitionKey) : null;
    const line = getMessageLine({
      gremlin: {
        query: this.props.query,
        error: this.props.error,
        queryStatus: this.props.queryStatus,
        queryStatusMessage: this.props.queryStatusMessage
      },
      connection: {
        status: this.props.connectionStatus,
        connection: this.props.connection,
        error: this.props.connectionError
      }
    });

    return (
      <header className="top-bar">
        <ConnectionChip
          label={connectionLabel}
          partitionKey={partitionKey}
          disabled={this.connectionSwitchDisabled()}
          onClick={() => this.openConnectionDialog()}
        />
        <div className="top-bar__editor">
          <QueryEditor
            value={this.props.query}
            disabled={this.graphActionsDisabled()}
            inputRef={this.editorRef}
            onChange={query => this.onQueryChanged(query)}
            onSubmit={() => this.sendQuery()}
            onHistoryStep={direction => this.onHistoryStep(direction)}
          />
        </div>
        <HistoryMenu
          queries={this.props.queryHistory}
          disabled={this.graphActionsDisabled()}
          onRun={query => this.runHistoryQuery(query)}
          onLoad={query => this.loadHistoryQuery(query)}
          onClear={() => dispatch({ type: ACTIONS.CLEAR_QUERY_HISTORY })}
        />
        <button
          type="button"
          className="top-bar__control top-bar__run"
          disabled={this.graphActionsDisabled()}
          onClick={() => this.sendQuery()}
        >
          {isRunning
            ? <><CircularProgress size={16} color="inherit" /> Running…</>
            : `Run ${runShortcut()}`}
        </button>
        <RequestChargeChip
          diagnostics={this.props.latestDiagnostics}
          session={this.props.session}
          onResetSession={() => dispatch({ type: ACTIONS.RESET_SESSION_CHARGE })}
        />
        <SettingsPopover
          nodeLimit={this.props.nodeLimit}
          isPhysicsEnabled={this.props.isPhysicsEnabled}
          nodeLabels={this.props.nodeLabels}
          onNodeLimitChange={limit => dispatch({ type: ACTIONS.SET_NODE_LIMIT, payload: limit })}
          onTogglePhysics={enabled => this.togglePhysics(enabled)}
          onAddLabel={() => dispatch({ type: ACTIONS.ADD_NODE_LABEL })}
          onEditLabel={(index, nodeLabel) => dispatch({ type: ACTIONS.EDIT_NODE_LABEL, payload: { id: index, nodeLabel } })}
          onRemoveLabel={index => dispatch({ type: ACTIONS.REMOVE_NODE_LABEL, payload: index })}
          onApplyLabels={() => dispatch({ type: ACTIONS.REFRESH_NODE_LABELS, payload: this.props.nodeLabels })}
        />
        <MessageLine line={line} onAction={action => this.onMessageAction(action)} />
        <ConnectionDialog
          open={Boolean(this.props.connectionDialogOpen)}
          connection={this.props.connection}
          switching={this.props.connectionSwitching}
          error={this.props.connectionError}
          probeDiagnostics={this.props.probeDiagnostics}
          onClose={() => this.closeConnectionDialog()}
          onSubmit={this.switchConnection.bind(this)}
        />
      </header>
    );
  }
}

export default connect((state) => ({
  query: state.gremlin.query,
  error: state.gremlin.error,
  queryStatus: state.gremlin.queryStatus,
  queryStatusMessage: state.gremlin.queryStatusMessage,
  latestDiagnostics: state.gremlin.latestDiagnostics,
  session: state.gremlin.session,
  nodes: state.graph.nodes,
  edges: state.graph.edges,
  selectedNode: state.graph.selectedNode,
  network: state.graph.network,
  nodeLabels: state.options.nodeLabels,
  nodeLimit: state.options.nodeLimit,
  queryHistory: state.options.queryHistory,
  historyCursor: state.options.historyCursor,
  colorMode: state.options.colorMode,
  colorAssignments: state.options.colorAssignments,
  isPhysicsEnabled: state.options.isPhysicsEnabled,
  networkOptions: state.options.networkOptions,
  connectionStatus: state.connection.status,
  connection: state.connection.connection,
  connectionLoading: state.connection.loading,
  connectionSwitching: state.connection.switching,
  connectionError: state.connection.error,
  probeDiagnostics: state.connection.probeDiagnostics,
  connectionDialogOpen: state.connection.dialogOpen
}))(TopBar);
