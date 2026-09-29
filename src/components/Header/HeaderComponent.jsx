import React from 'react';
import { connect } from 'react-redux';
import { Button, TextField }  from '@material-ui/core';
import {
  ACTIONS,
  EMPTY_GREMLIN_QUERY_ERROR,
  QUERY_RUNNING_MESSAGE,
  TOO_LONG_GREMLIN_QUERY_ERROR
} from '../../constants';
import { executeQuery, getConnection, switchConnection as requestConnectionSwitch } from '../../api/gremlinApi';
import { onFetchQuery, onGraphRequestFailure } from '../../logics/actionHelper';
import {
  getQueryResultStatus,
  isQueryTooLong
} from '../../logics/queryFeedback';
import { analyzePartitionFanOut } from '../../logics/partitionAnalysis';
import { ConnectionDialog } from '../Connection/ConnectionDialog';

const DEMO_QUERY = 'g.V().limit(25)';

export const getConnectionLabel = (status, connection) => {
  if (status !== 'connected' || !connection) {
    return 'Disconnected';
  }
  if (connection.mode === 'fixture') {
    return 'Fixture';
  }
  return `${connection.endpointHost} / ${connection.database} / ${connection.container}`;
};

const operationLabel = (operation) => {
  if (operation === 'traverse-in') {
    return 'Inbound traversal';
  }
  if (operation === 'traverse-out') {
    return 'Outbound traversal';
  }
  return null;
};

export const formatRequestCharge = (diagnostics) => {
  if (!diagnostics) {
    return null;
  }
  const label = operationLabel(diagnostics.operation);
  const requestCharge = diagnostics.requestCharge;
  if (!requestCharge || !Number.isFinite(requestCharge.total)) {
    return label ? `${label} - charge unavailable` : 'Charge unavailable';
  }

  const prefix = label ? `${label} - ` : '';
  const requests = Array.isArray(requestCharge.requests) ? requestCharge.requests : [];
  const breakdown = requests
    .filter(request => request && Number.isFinite(request.charge))
    .map(request => `${request.kind} ${request.charge.toFixed(2)}`)
    .join(' + ');
  return `${prefix}${requestCharge.total.toFixed(2)} RUs total${breakdown ? ` - ${breakdown}` : ''}`;
};

export class Header extends React.Component {
  constructor(props) {
    super(props);
    this.state = { connectionDialogOpen: false };
  }

  componentDidMount() {
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
      return payload;
    }).catch((error) => {
      this.props.dispatch({
        type: ACTIONS.SWITCH_CONNECTION_FAILURE,
        payload: {
          message: error.message || 'Could not switch connection',
          diagnostics: error.diagnostics
        }
      });
      throw error;
    });
  }

  clearGraph() {
    this.props.dispatch({ type: ACTIONS.CLEAR_GRAPH });
    this.props.dispatch({
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'idle', message: 'Graph cleared. Query history is still available for reruns.' }
    });
  }

  sendQuery() {
    const query = this.props.query.trim();
    if (!query) {
      this.props.dispatch({ type: ACTIONS.SET_ERROR, payload: EMPTY_GREMLIN_QUERY_ERROR });
      return;
    }
    if (isQueryTooLong(query)) {
      this.props.dispatch({ type: ACTIONS.SET_ERROR, payload: TOO_LONG_GREMLIN_QUERY_ERROR });
      return;
    }

    this.props.dispatch({
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'running', message: QUERY_RUNNING_MESSAGE }
    });
    executeQuery({ query, nodeLimit: this.props.nodeLimit }).then((response) => {
      const summary = onFetchQuery(response, query, this.props.nodeLabels, this.props.dispatch);
      const resultStatus = getQueryResultStatus(summary);
      this.props.dispatch({
        type: ACTIONS.SET_QUERY_STATUS,
        payload: resultStatus
      });
    }).catch((error) => {
      console.error('Error sending query:', error);
      onGraphRequestFailure(error, this.props.dispatch);
    });
  }

  onQueryChanged(query) {
    this.props.dispatch({ type: ACTIONS.SET_QUERY, payload: query });
  }

  onSubmit(event) {
    event.preventDefault();
    this.sendQuery();
  }

  useDemoQuery() {
    this.onQueryChanged(DEMO_QUERY);
    this.props.dispatch({
      type: ACTIONS.SET_QUERY_STATUS,
      payload: { status: 'idle', message: 'Demo traversal loaded. Execute it to refresh the graph.' }
    });
  }

  render(){
    const isExecuting = this.props.queryStatus === 'running';
    const graphActionsDisabled = isExecuting
      || this.props.connectionLoading
      || this.props.connectionSwitching
      || this.props.connectionStatus !== 'connected';
    const connectionLabel = getConnectionLabel(this.props.connectionStatus, this.props.connection);
    const diagnosticsSummary = formatRequestCharge(this.props.latestDiagnostics);
    const advisories = this.props.connectionStatus === 'connected' && this.props.connection
      ? analyzePartitionFanOut(this.props.query, this.props.connection.partitionKey)
      : [];
    return (
      <div className={'header'}>
        <div className="header__topline">
          <div>
            <h1 className="header__title">CosmosVisualizer</h1>
            <p className="header__subtitle">Cosmos graph exploration console</p>
          </div>
          <div className="header__meta" aria-label="Graph summary">
            <div className="connection-control" aria-label="Connection status">
              <span className="connection-control__label">{connectionLabel}</span>
              <Button
                variant="outlined"
                size="small"
                className="connection-control__switch"
                disabled={isExecuting}
                onClick={() => this.setState({ connectionDialogOpen: true })}
              >
                Switch
              </Button>
            </div>
            <span className="metric-pill">
              <span className="metric-pill__value">{this.props.nodes.length}</span>
              <span className="metric-pill__label">Nodes</span>
            </span>
            <span className="metric-pill">
              <span className="metric-pill__value">{this.props.edges.length}</span>
              <span className="metric-pill__label">Edges</span>
            </span>
          </div>
        </div>

        <form noValidate autoComplete="off" className="query-form" onSubmit={this.onSubmit.bind(this)}>
          <TextField
            value={this.props.query}
            onChange={(event => this.onQueryChanged(event.target.value))}
            id="gremlin-query"
            label="Gremlin query"
            className="query-field"
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={graphActionsDisabled}
            className="query-button query-button--execute"
          >
            {isExecuting ? 'Executing...' : 'Execute'}
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={this.clearGraph.bind(this)}
            className="query-button query-button--clear"
          >
            Clear Graph
          </Button>
        </form>

        {advisories.length > 0 && (
          <div className="query-advisories" role="status" aria-label="Query advisories">
            {advisories.map(advisory => (
              <p key={advisory.code}>{advisory.message}</p>
            ))}
          </div>
        )}

        <div className={`query-status query-status--${this.props.queryStatus}`} role="status">
          <span>{this.props.queryStatusMessage}</span>
          <Button
            variant="text"
            size="small"
            onClick={this.useDemoQuery.bind(this)}
            className="query-status__demo"
          >
            Use demo query
          </Button>
        </div>

        {diagnosticsSummary && (
          <div className="operation-diagnostics" role="status" aria-label="Latest operation request charge">
            {diagnosticsSummary}
          </div>
        )}

        {this.props.error && <div className="error-banner" role="alert">{this.props.error}</div>}
        {this.props.connectionError && (
          <div className="connection-error" role="alert">Connection: {this.props.connectionError}</div>
        )}
        <ConnectionDialog
          open={this.state.connectionDialogOpen}
          connection={this.props.connection}
          switching={this.props.connectionSwitching}
          error={this.props.connectionError}
          probeDiagnostics={this.props.probeDiagnostics}
          onClose={() => this.setState({ connectionDialogOpen: false })}
          onSubmit={this.switchConnection.bind(this)}
        />
      </div>

    );
  }
}

export const HeaderComponent = connect((state)=>{
  return {
    query: state.gremlin.query,
    error: state.gremlin.error,
    queryStatus: state.gremlin.queryStatus,
    queryStatusMessage: state.gremlin.queryStatusMessage,
    nodes: state.graph.nodes,
    edges: state.graph.edges,
    nodeLabels: state.options.nodeLabels,
    nodeLimit: state.options.nodeLimit,
    latestDiagnostics: state.gremlin.latestDiagnostics,
    connectionStatus: state.connection.status,
    connection: state.connection.connection,
    connectionLoading: state.connection.loading,
    connectionSwitching: state.connection.switching,
    connectionError: state.connection.error,
    probeDiagnostics: state.connection.probeDiagnostics
  };
})(Header);
